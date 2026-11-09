# Task protocol

Protocol v2 joins HTTP admission, durable backend state, RabbitMQ delivery, and the
Hyper-V agent's local journal. Backend and agent must be updated together after
draining older operations. All new commands require the `task.protocol.v2` capability.

For the visual pipeline and a `vm.create` walkthrough, see [Task flow](/task-flow).

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

## Crash and redelivery paths

<pre class="mermaid">
flowchart TD
  A[Client retries same Idempotency-Key] --> B{Controller has accepted op?}
  B -->|No| C[New admission transaction]
  B -->|Yes same body| D[Return same taskId]
  B -->|Yes different body| E[HTTP 409]

  F[RMQ redelivers command] --> G{Journal knows operation?}
  G -->|Stored terminal result| H[Republish stored result]
  G -->|Intent without result| I[Read-only observe host]
  G -->|Unknown identity| J[Journal intent + execute once]

  I --> K{Observation conclusive?}
  K -->|applied / not_applied| L[Persist result and publish]
  K -->|still unknown| M[Stay reconciling]

  N[Result channel lost after commit] --> O[Safe result redelivery]
  P[Crash after Hyper-V effect] --> I
</pre>

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
