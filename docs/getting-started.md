# Getting Started (Developer Preview)

> **Active Development:** OpenHVX is not production-ready. This guide targets **contributors and early testers**.

## Prerequisites

- Windows host with **Hyper-V** (for Agent tests)
- **Docker or Podman** with a Compose provider
- **Node.js 22** and **npm**
- **Go** (version declared in each Go module’s `go.mod`) for the agent and CLI

Lab and production deployment automation belong to the separate `deployment` repository. Compose is the optional local stack only.

## Quick Start (Backend)

```bash
# 1) Clone
git clone https://github.com/openhvx/openhvx-backend.git
cd openhvx-backend

# 2) Environment
# Create local profiles from the versioned examples:
#   .env.auth, .env.gateway, .env.controller, .env.ws
# Plus root .env for Compose interpolation inputs.
# See Configuration for shared secrets.

# 3) Traefik TLS material
# Provide .traefik/certs/app.pem and app-key.pem covering:
#   api.openhvx.local, admin-api.openhvx.local,
#   console.openhvx.local, ws.openhvx.local
# Resolve those names from the browser and agents (hosts/DNS).

# 4) Run services
docker compose -f compose.yaml up --build -d

# Podman: same base stack + socket override
podman compose -f compose.yaml -f compose.podman.yaml up --build -d
```

Validate rendered config before starting:

```bash
docker compose -f compose.yaml config --quiet
```

Shared secrets and service contracts are documented in [Configuration](/configuration). Detailed per-service variables live in the backend `.env.<service>.example` files on GitHub — do not treat those examples as a runnable production environment.

## Create a Global Admin (one-time bootstrap)

This initializes the **platform-wide administrator** via the Admin Auth API.

> **Notes**
>
> - Requires `REGISTER_ENABLED=true` and a valid `REGISTER_API_KEY` on Auth.
> - The `mode` query parameter defines registration behavior:
>   - `once`: create only if missing (409 if already exists)
>   - `reset`: reset password only if user exists
>   - `upsert`: create if missing, or reset if exists (**recommended for bootstrap**)
> - Passwords must be at least 12 characters.

### Curl

```bash
export ADMIN_REGISTER_KEY='your-register-key'

curl -k -X POST \
  "https://admin-api.openhvx.local/api/v1/admin/auth/register?mode=upsert" \
  -H "content-type: application/json" \
  -H "x-api-key: $ADMIN_REGISTER_KEY" \
  --data-binary '{"email":"admin@openhvx.local","password":"change-me-now-12"}'
```

**Expected response (example):**

```json
{
  "ok": true,
  "user": {
    "id": "adm_01J....",
    "email": "admin@openhvx.local",
    "role": "global-admin"
  }
}
```

## Image catalog

The controller reads the image catalog from **storage inventory in MongoDB**. It does **not** mount a local `/share` index or consume `IMAGES_INDEX_PATH`.

Agents (and storage connectors) publish inventory that includes available base images. Ensure Hyper-V hosts can reach the image storage paths they advertise, then confirm images through the tenant/admin image API or the CLI (`hvx get images`).

## Build and run the Agent

Clone [openhvx-agent](https://github.com/openhvx/openhvx-agent). On a Windows Hyper-V host, build the agent and helpers (from the repository root in PowerShell):

```powershell
New-Item -ItemType Directory -Force src/powershell/bin | Out-Null
Push-Location tools/cloudinit-iso/src
go build -o ../../../src/powershell/bin/openhvx-cidata-iso.exe .
Pop-Location
Push-Location tools/serial-bridge/src
go build -o ../../../src/powershell/bin/openhvx-serial-bridge.exe .
Pop-Location
Push-Location src
go build -o openhvx-agent.exe .
Pop-Location
```

Create a private `config.json` (kept out of Git):

```json
{
  "agentId": "HOST-OPENHVX-HYPERV-001",
  "rabbitmqUrl": "amqps://agent-user:REPLACE_ME@rabbitmq.example.test:5671/",
  "heartbeatIntervalSec": 30,
  "inventoryIntervalSec": 60,
  "basePath": "D:\\DATA",
  "journalPath": "D:\\DATA\\agent-state\\operations.db",
  "capabilities": [
    "inventory",
    "vm.power",
    "vm.create",
    "vm.delete",
    "console",
    "vm.edit"
  ]
}
```

The agent advertises `task.protocol.v2` after opening its journal. Keep `journalPath` on durable local storage bound to one host identity. See [Agents](/agents) for details.

```powershell
.\openhvx-agent.exe -config .\config.json
```

External agents need explicitly configured, restricted broker connectivity. The local Compose stack does not publish MongoDB/AMQP to the host by default.

## CLI (`hvx`)

Clone [openhvx-cli](https://github.com/openhvx/openhvx-cli). From `src`:

```bash
go build -o ../bin/hvx ./cmd/hvx
```

Initialize a context, then explore inventory and tasks:

```bash
bin/hvx init --mode tenant \
  --tenant-server https://api.openhvx.local \
  --username user@openhvx.local --password-stdin

bin/hvx get vms
bin/hvx start vm web01 --wait
```

See [CLI](/cli) for command mapping and idempotent retries.

## Next steps

- [Workflow example](/workflow-example) — end-to-end `vm.create`
- [Architecture](/architecture) — service boundaries and console routing
- [Task protocol](/task-protocol) — idempotency and recovery
- [API](/api) — public routes
