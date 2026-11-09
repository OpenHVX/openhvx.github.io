# Task protocol

Protocol v2 joins HTTP admission, durable backend state, RabbitMQ delivery, and the
Hyper-V agent's local journal. Backend and agent must be updated together after
draining older operations. All new commands require the `task.protocol.v2` capability.

## End-to-end flow

Happy path from the client (UI or `hvx`) to Hyper-V and back. HTTP 202 only means
the controller durably accepted the operation - not that the host finished.

<pre class="mermaid">
sequenceDiagram
  autonumber
  actor User as User / CLI / UI
  participant GW as API Gateway
  participant Auth as Auth Service
  participant Ctrl as Controller
  participant DB as MongoDB
  participant RMQ as RabbitMQ
  participant Agent as Hyper-V Agent
  participant Jour as Agent journal
  participant HV as Hyper-V / PowerShell

  rect rgb(240, 248, 255)
    Note over User,Auth: 1. Authenticated admission
    User->>GW: POST /api/v1/{tenant|admin}/tasks<br/>Authorization + Idempotency-Key
    GW->>Auth: Validate JWT / PAT (audience, active user)
    Auth-->>GW: Claims OK
    GW->>GW: Policy checks + short-lived controller identity
    GW->>Ctrl: Proxy task submit
  end

  rect rgb(245, 255, 245)
    Note over Ctrl,DB: 2. Durable acceptance (one MongoDB transaction)
    Ctrl->>DB: Begin txn
    Ctrl->>DB: Resolve Idempotency-Key<br/>(same key+body → same op / conflict → 409)
    alt Invalid schema or quota precondition
      Ctrl-->>GW: 4xx (before durable accept)
      GW-->>User: Rejection
    else Accepted
      Ctrl->>DB: Persist task + holds/locks + ownership + outbox
      Ctrl->>DB: Commit txn
      Ctrl-->>GW: 202 Accepted { taskId, statusUrl }
      GW-->>User: 202 (queued) - not host success
    end
  end

  rect rgb(255, 250, 240)
    Note over Ctrl,RMQ: 3. Reliable delivery
    Ctrl->>RMQ: Outbox publish immutable v2 command<br/>(confirms, mandatory routing)
    Note right of Ctrl: Retries keep same operationId + eventId
    Ctrl->>DB: Mark delivery / task → sent
    RMQ->>Agent: Consume agent.AGENT_ID.tasks
  end

  rect rgb(255, 245, 245)
    Note over Agent,HV: 4. Journal before effect
    Agent->>Agent: Validate contractVersion=2,<br/>fingerprint, agentId, destination
    alt Non-v2 / invalid envelope
      Agent->>RMQ: Quarantine to *.tasks.invalid + ack
    else Valid command
      Agent->>Jour: fsync intent (operation identity)
      alt Already known operation
        Jour-->>Agent: Stored result (no second effect)
      else New / interrupted → observe only
        Agent->>HV: Invoke PowerShell adapter once
        HV-->>Agent: Host observation
        Agent->>Jour: Persist result + eventId + sequence
      end
      Agent->>RMQ: Publish confirmed result
      Agent->>RMQ: Ack command after confirm + journal mark
    end
  end

  rect rgb(245, 240, 255)
    Note over Ctrl,DB: 5. Apply result (one MongoDB transaction)
    RMQ->>Ctrl: Result message
    Ctrl->>DB: Inbox + task transition + quota/ownership + unlock
    alt applied (ok)
      Ctrl->>DB: Task → done (consume reservation)
    else not_applied
      Ctrl->>DB: Task → error (release reservation)
    else unknown
      Ctrl->>DB: Task → reconciling (retain holds/locks)
    end
    Ctrl->>DB: Commit / ack result
  end

  rect rgb(240, 240, 240)
    Note over User,Ctrl: 6. Client observation
    User->>GW: GET /api/v1/.../tasks/{taskId}
    GW->>Ctrl: Proxy status
    Ctrl-->>User: queued | sent | reconciling | done | error
  end
</pre>

### What each hop guarantees

| Hop | Durable? | Notes |
| --- | --- | --- |
| Client → Gateway | No | Retry with the **same** `Idempotency-Key` and body |
| Gateway → Auth | No | Audience and active-user / PAT checks |
| Controller admission | **Yes** (Mongo txn) | Task, holds, locks, outbox share one commit |
| Outbox → RabbitMQ | At-least-once | Same `operationId` / `eventId` on retry |
| Agent journal intent | **Yes** (bbolt + fsync) | Effectful handler never runs twice for that identity |
| Hyper-V mutation | Outside ACID | Crash/stderr ⇒ `unknown`, not automatic re-exec |
| Result → controller | **Yes** (Mongo txn) | Terminal vs `reconciling` decided here |
| Client poll | Read model | 202 ≠ done |

## Crash and redelivery paths

<pre class="mermaid">
flowchart TD
  A[Client retries same Idempotency-Key] --> B{Controller has accepted op?}
  B -->|No| C[New admission transaction]
  B -->|Yes same body| D[Return same taskId]
  B -->|Yes different body| E[HTTP 409]

  F[RMQ redelivers command] --> G{Journal knows operation?}
  G -->|Stored terminal result| H[Republish stored result - no PowerShell]
  G -->|Intent without result| I[Read-only observe host state]
  G -->|Unknown identity| J[Validate + journal intent + execute once]

  I --> K{Observation conclusive?}
  K -->|applied / not_applied| L[Persist result and publish]
  K -->|still unknown| M[Remain reconciling - no clear-and-retry]

  N[Controller loses result channel after commit] --> O[Safe redelivery of same result]
  P[Agent crash after Hyper-V effect] --> I
</pre>

## Consistency boundaries

| Boundary | Invariant |
| --- | --- |
| Client → HTTP | A stable `Idempotency-Key`, scoped to tenant/actor/mode/action, returns the same operation; changed content returns 409 |
| Admission → MongoDB | One transaction acquires request identity and persists task, response, hold/counter, ownership guards, locks, and outbox |
| Outbox → RabbitMQ | Confirms, mandatory routing, renewable claims, and retry backoff; retries retain the same operation and event identity |
| Delivery → agent | Verify immutable command and destination, then commit journal intent before invoking PowerShell |
| Host → result | Persist a stable result/event before publishing; confirm delivery before acknowledging the command |
| Result → backend | Inbox, task transition, quota/allocation, associations, and lock release commit together before acknowledgment |

ACID applies within MongoDB transactions and within the agent's journal.
Hyper-V effects are outside both transactions. An uncertain effect is not executed again.
Clients must retain their idempotency key across network retries of the same intention.

## Task states

| Host outcome | Task state | Reservation |
| --- | --- | --- |
| `applied` (`ok: true`) | `done` | Consumed; effects and locks resolved atomically |
| `not_applied` (`ok: false`) | `error` | Released after definitive no-effect rejection |
| `unknown` (`ok: false`) | `reconciling` | Hold and locks retained |

Observed HTTP/task progression includes `queued`, `sent`, `reconciling`, `done`, and `error`.
HTTP 202 means durable acceptance, not host success.

## Immutable command

A command carries `contractVersion: 2`, `taskId == operationId`, `eventId`, and:

- `commandBody`: canonical JSON for `{operationId, tenantId, agentId, action, data}`
- `commandFingerprint`: SHA-256 of that string's UTF-8 bytes

The agent executes only the validated inner command. Reusing an operation ID with
a different fingerprint is rejected.

## Host journal and recovery

The agent journal uses fsync and an exclusive file lock. Configure an absolute,
persistent `journalPath`, or an absolute `basePath` for the default
`<basePath>/agent-state/operations.db`. Bind it to one host identity and retain it
through backups/restores.

Known commands replay their stored result. An interrupted command is observed,
never sent through the effectful handler again. Partial creation, ambiguous restart,
or other unproved actions can remain `reconciling`. There is no automatic
"clear locks and retry" path.

## Quotas and ownership

A resource retains its reserved allocation. Deletion reverses it once, after a
conclusive result. Pending operations prevent tenant deletion and resource unclaim.
Invalid create requests fail before durable acceptance.

## Compatibility

The controller refuses active legacy operations at startup. Non-v2 commands are
quarantined by the new agent. Backend and agent queue types must match. Other
execution agents, including storage, must implement v2 before receiving tasks.

For deeper recovery and migration details, see the backend and agent repositories'
`docs/task-protocol.md` guides.
