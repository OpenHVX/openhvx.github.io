# Task flow

How a mutating task moves from the client to a Hyper-V host and back under
protocol v2. For consistency rules and crash semantics, see
[Task protocol](/task-protocol).

## Pipeline

Fewer participants, shorter labels - click **Expand** (or the diagram) for a
full-size view. Scroll horizontally if the page column is narrower than the SVG.

<pre class="mermaid">
sequenceDiagram
  autonumber
  actor Client
  participant Gateway
  participant Controller
  participant MongoDB
  participant RabbitMQ
  participant Agent
  participant Host as Hyper-V

  Client->>Gateway: POST /tasks + Idempotency-Key
  Gateway->>Gateway: AuthZ + policy
  Gateway->>Controller: Proxy submit

  Controller->>MongoDB: Admit op, holds, outbox
  alt Rejected before accept
    Controller-->>Client: 4xx
  else Accepted
    Controller-->>Client: 202 taskId
  end

  Controller->>RabbitMQ: Publish immutable v2 command
  RabbitMQ->>Agent: agent.AGENT_ID.tasks

  Agent->>Agent: Validate + journal intent
  alt Known / interrupted
    Agent->>Host: Observe only
  else New
    Agent->>Host: PowerShell once
  end
  Host-->>Agent: Outcome
  Agent->>RabbitMQ: Confirmed result + ack

  RabbitMQ->>Controller: Result
  Controller->>MongoDB: Apply state + quotas
  Note over Controller,MongoDB: done / error / reconciling

  Client->>Gateway: GET /tasks/taskId
  Gateway-->>Client: Status
</pre>

### Hop summary

| Stage | Durable? | Meaning |
| --- | --- | --- |
| HTTP submit | No | Retry with the same key + body |
| Controller admission | Yes | 202 = accepted, not host-done |
| Outbox → RabbitMQ | At-least-once | Same operation / event identity |
| Agent journal | Yes | No second effectful run |
| Hyper-V | Outside ACID | Uncertainty → `reconciling` |
| Result apply | Yes | Terminal or retain holds |
| Status poll | Read | `queued` → `sent` → terminal |

## Example: `vm.create`

### 1. Client → API Gateway

```text
POST /api/v1/tenant/tasks
Host: api.openhvx.local
Authorization: Bearer <tenant-token>
Idempotency-Key: <stable-command-key>
Content-Type: application/json

{
  "action": "vm.create",
  "target": {
    "kind": "vm",
    "agentId": "HOST-OPENHVX-HYPERV-001"
  },
  "data": {
    "name": "example",
    "cpu": 2,
    "ram": "2GB",
    "imageId": "Rocky-10-GenericCloud-Base",
    "cloudInit": {}
  }
}
```

Admin submissions use `/api/v1/admin/tasks` and include `tenantId`.

Gateway actions:

1. Validate the JWT (tenant or admin audience) via Auth.
2. Enforce roles, scopes, and anti-spoofing policy.
3. Sign a short-lived controller identity bound to actor, tenant, mode, method, path, and body.
4. Proxy to the controller.

The [`hvx` CLI](/cli) generates and retains the idempotency key automatically.

### 2. Controller admission

In one MongoDB transaction the controller:

1. Acquires request identity from the idempotency key (same key + content → same operation; conflict → 409).
2. Validates the action schema and quota/ownership preconditions (`vm.create` requires RAM; invalid requests fail before durable acceptance).
3. Persists the task, response envelope, holds/locks, and outbox event.
4. Returns **HTTP 202** with `taskId` and `statusUrl`.

HTTP 202 means durable acceptance, not Hyper-V success. Clients poll
`GET /api/v1/{tenant|admin}/tasks/{taskId}`.

### 3. Outbox → RabbitMQ → Agent

The controller outbox publishes the immutable protocol v2 command to
`agent.<agentId>.tasks` with confirms and mandatory routing. Retries retain the
same operation and event identity.

The agent:

1. Validates `contractVersion: 2`, fingerprint, and destination.
2. Commits journal intent before invoking PowerShell.
3. Runs the `vm.create` adapter (image path from inventory, cloud-init helper as needed).
4. Persists a stable result/event, publishes it, then acknowledges the command.

### 4. Result → Controller

| Outcome | Task state |
| --- | --- |
| Applied | `done` |
| Definitive rejection | `error` |
| Unknown / unproved | `reconciling` (holds retained) |

Partial creation without a conclusive observation stays `reconciling`. The effectful
handler is not rerun merely to obtain a result.

### 5. Follow-up

- Inventory/telemetry updates refresh resources and the image catalog in MongoDB.
- Console access is a separate ticketed task through the WebSocket broker.
- Use the same idempotency key (or `hvx retry`) for uncertain HTTP delivery; use a
  new key only for a new user intention.

See [task protocol](/task-protocol) for crash/redelivery rules and
[architecture](/architecture) for service boundaries.
