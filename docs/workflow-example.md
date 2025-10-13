# 🧩 Workflow example — `task: vm.create`

This document describes the full end-to-end workflow for the `vm.create` task in **OpenHVX**, from user request to resource persistence.

---

## 1. User → API Gateway

A user (tenant or admin) sends a request to create a new virtual machine:

```bash
POST /api/v1/admin/tasks
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "tenantId": "test1",
  "action": "vm.create",
  "data": {
    "name": "example",
    "cpu": 2,
    "ram": "2GB",
    "imageId": "Rocky-10-GenericCloud-Base.latest",
    "cloudInit": { ... }
  }
}
```

### Gateway actions
1. **Validate JWT** using the appropriate audience (`tenant` or `admin`) via the **Auth Service**, depending on the host (`api.` or `api-admin.`).  
2. **Check roles and scopes** according to the request domain.  
3. Run **anti-spoofing and policy checks** (e.g., tenant ID consistency).  
4. **Proxy the request** to the **Controller** service at `controller:[PORT]/api/admin/tasks`.

---

## 2. API Gateway → Controller

### Middleware & context setup
- **accessMode middleware**: sets `req.isAdmin = true`.
- **Envelope validation**: ensures presence of `kind`, `refId`, and `target`.
- **Schema pre-validation**: uses `src/lib/schemas/task.js` (per action, e.g. `vm.create`).
- **Tenant context resolution**:
  - For admin requests → tenantId is taken from the request body.
  - For tenant users → tenantId is extracted from JWT claims.
- **Ownership validation**: confirms user’s access to `refId`; skipped for global admins.

---

## 3. Agent Selection & Ownership

The **Controller** performs **agent election** based on:
- Agent heartbeat freshness.
- Available resources (CPU, RAM, storage).
- Advertised capabilities (`vm.create`, `network.*`, etc.).

If the selected agent already satisfies capability and availability requirements, additional checks are skipped.

---

## 4. Payload Enrichment

**Controller** enriches and normalizes the incoming payload through `src/lib/enrich.js (vm.create)`:
- Sets default values for RAM, CPU, and storage.
- Ensures proper image ID and generation type.
- Adds default `cloud-init` configuration when missing.

---

## 5. Quota Reservation

1. Compute **resource deltas** (vCPU, RAM, storage).  
2. Perform a **quota hold** with TTL to reserve capacity temporarily.  
3. If limits are exceeded → respond with `ERR_QUOTA_EXCEEDED`.  
4. If successful → continue with persistence and dispatch.

---

## 6. Task Persistence & Dispatch

- Persist the new Task document in MongoDB with `status: "sent"`.  
- Publish the message to RabbitMQ:

  ```
  Exchange: jobs
  Routing key: agent.<agentId>
  Queue: agent.<agentId>.tasks (durable)
  ```

- Return initial response to the client (`202 Accepted`) with task ID and status.

---

## 7. Agent Execution

- The **Agent** consumes messages from its queue `agent.<agentId>.tasks`.
- Executes the PowerShell script `vm.create.ps1` on the Hyper-V host.
- Upon completion, publishes a result message to the **results** exchange:

  ```
  Exchange: results
  Routing key: task.<taskId>
  ```

  Payload includes the results.

---

## 8. Result Handling

The **Controller** consumes results from the `results` exchange:
- Updates the Task document with final status (`SUCCESS` or `FAILED`).
- Stores logs and execution metadata.

Depending on the result:
- **Success** → consume the quota hold (commit resources).  
- **Failure** → release the quota hold (rollback).

---

## 9. Resource Linking

- Link the newly created VM to the corresponding **TenantResource** entry.  

---

## ✅ Summary (High-Level Flow)

| Step | Service | Description |
|------|----------|-------------|
| 1 | API Gateway | Auth, scopes, anti-spoofing, proxy |
| 2 | Controller | Envelope & schema validation |
| 3 | Controller | Agent election & ownership checks |
| 4 | Controller | Payload enrichment |
| 5 | Controller | Quota hold reservation |
| 6 | Controller + MQ | Persist and publish task to agent queue |
| 7 | Agent | Execute PowerShell script on Hyper-V |
| 8 | Controller | Process result and adjust quota |
| 9 | Controller | Link resources |

---

> **Note:**  
> The same workflow structure applies to other task types (e.g., `vm.delete`, `vm.edit`), with different schemas, enrichers, and capability filters per action.
