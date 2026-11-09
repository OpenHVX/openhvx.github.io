# Workflow example - `vm.create`

End-to-end flow for creating a VM with protocol v2, from client request to durable
host result.

## 1. Client → API Gateway

A tenant or admin submits a task. Every mutating task requires a stable
`Idempotency-Key`:

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

### Gateway actions

1. Validate the JWT (tenant or admin audience) via Auth.
2. Enforce roles, scopes, and anti-spoofing policy.
3. Sign a short-lived controller identity bound to actor, tenant, mode, method, path, and body.
4. Proxy to the controller.

The [`hvx` CLI](/cli) generates and retains the idempotency key automatically.

## 2. Controller admission

In one MongoDB transaction the controller:

1. Acquires request identity from the idempotency key (same key + content → same operation; conflict → 409).
2. Validates the action schema and quota/ownership preconditions (`vm.create` requires RAM; invalid requests fail before durable acceptance).
3. Persists the task, response envelope, holds/locks, and outbox event.
4. Returns **HTTP 202** with `taskId` and `statusUrl`.

HTTP 202 means durable acceptance, not Hyper-V success. Clients poll
`GET /api/v1/{tenant|admin}/tasks/{taskId}`.

## 3. Outbox → RabbitMQ → Agent

The controller outbox publishes the immutable protocol v2 command to the host queue
`agent.<agentId>.tasks` with confirms and mandatory routing. Retries retain the same
operation and event identity.

The agent:

1. Validates `contractVersion: 2`, fingerprint, and destination.
2. Commits journal intent before invoking PowerShell.
3. Runs the `vm.create` adapter (image path from inventory, cloud-init helper as needed).
4. Persists a stable result/event, publishes it, then acknowledges the command.

## 4. Result → Controller

The controller applies the result in a transaction: inbox, task transition,
quota/allocation, associations, and lock release. States:

| Outcome | Task state |
| --- | --- |
| Applied | `done` |
| Definitive rejection | `error` |
| Unknown / unproved | `reconciling` (holds retained) |

Partial creation without a conclusive observation stays `reconciling`. The effectful
handler is not rerun merely to obtain a result.

## 5. Follow-up

- Inventory/telemetry updates refresh resources and the image catalog in MongoDB.
- Console access is a separate ticketed task through the WebSocket broker.
- Use the same idempotency key (or `hvx retry`) for uncertain HTTP delivery; use a
  new key only for a new user intention.

See [task protocol](/task-protocol) for consistency boundaries and
[architecture](/architecture) for service and console details.
