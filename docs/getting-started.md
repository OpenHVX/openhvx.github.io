# Getting Started (Developer Preview)

> ⚠️ **Active Development:** OpenHVX is not production-ready. This guide targets **contributors and early testers**.

## Prerequisites

- Windows host with **Hyper-V** (for Agent tests)
- **Docker/Podman & Docker Compose**
- **Node.js 20+** and **npm**
- **Go 1.21+** (to build Agent tools)

## Quick Start (Backend)

```bash
# 1) Clone
git clone https://github.com/openhvx/openhvx-backend.git
cd openhvx-backend

# 2) Environment
# Create and fill env files:
#   .env.auth, .env.controller, .env.gateway, .env.ws

# 3) Run services
docker compose up -d
```

> **All variables and examples are documented in** [Environment variables](https://openhvx.org/docs/environment-variables.html).

## Create a Global Admin (one-time bootstrap)

This initializes the **platform-wide administrator** via the Admin Auth API.

> **Notes**
>
> - Requires `REGISTER_ENABLED=true` and a valid `REGISTER_API_KEY` on the **Auth** side.
> - The `mode` parameter defines the registration behavior:
>   - `once`: create only if missing (409 if already exists)
>   - `reset`: reset password only if user exists
>   - `upsert`: create if missing, or reset if exists (**recommended for bootstrap**)
> - Replace `x-api-key` and credentials as needed.

### Curl

```bash
curl -k -X POST "https://admin-api.openhvx.local/api/v1/admin/auth/register?mode=upsert"   -H "content-type: application/json"   -H "x-api-key: example"   --data-binary '{"email":"admin@openhvx.local","password":"3x4mpl3"}'
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

> **Security**
>
> - Avoid exposing the API key in your shell history: export it to a variable (`export ADMIN_REGISTER_KEY=...`) and use `-H "x-api-key: $ADMIN_REGISTER_KEY"`.
> - Change the password and registration key in real environments.

## Set up the Image Repository (with **openhvx-img**)

OpenHVX expects a JSON index describing available base images (cloud-init compatible `.vhdx` files).  
The easiest way to generate this index is via the **[OpenHVX/openhvx-img](https://github.com/OpenHVX/openhvx-img)** tool.

### 1) Place your images on a shared path

Store your `.vhdx` base images in a shared folder accessible by all Hyper‑V Agents — typically an SMB share.

Example layout on the share:

```
\\fileserver\EXAMPLE\
├─ public/
│  ├─ Rocky-10-GenericCloud-Base.vhdx
│  ├─ Ubuntu-22.04-LTS.vhdx
│  └─ ...
└─ _index/
```

### 2) Generate the image index

Run the `openhvx-img` tool with the `-root` and `-output` options to automatically scan your repository and produce the index file.

```bash
openhvx-img -root \\fileserver\EXAMPLE\ -output \\fileserver\EXAMPLE\_index\images.json
```

This creates a JSON structure like:

```json
{
  "schema": "openhvx.images/v1",
  "generatedAt": "2025-09-07T09:20:02Z",
  "images": [
    {
      "id": "Rocky-10-GenericCloud-Base",
      "scope": "public",
      "tenantId": null,
      "name": "Rocky-10-GenericCloud-Base",
      "path": "\\192.168.1.37\\openhvx\\public\\Rocky-10-GenericCloud-Base.vhdx",
      "os": "linux",
      "arch": "x86_64",
      "gen": 2,
      "sizeBytes": 1501560832,
      "mtime": "2025-09-07T09:17:04Z"
    }
  ]
}
```

> 💡 The `path` values must correspond to actual network locations accessible by the Agents.

### 3) Mount the index in the Controller

Bind the `_index` directory in the Controller container and set the `IMAGES_INDEX_PATH` environment variable.

**docker-compose.override.yml (example):**

```yaml
services:
  controller:
    volumes:
      - /mnt/openhvx/_index:/share/_index:ro
    environment:
      - IMAGES_INDEX_PATH=/share/_index/images.json
```

### 4) Verify access from the Agent

Make sure that each Hyper‑V host running an Agent can access the `public/` folder (where the images are stored).

Example test (Windows PowerShell):

```powershell
Test-Path "\\fileserver\EXAMPLE\public\Rocky-10-GenericCloud-Base.vhdx"
```

## Build Agent Tools (Windows helpers)

These binaries are required by the PowerShell Agent to create **cloud-init ISOs** and to bridge **serial consoles**.

**Layout:**

```
/tools/
  cloudinit-iso/
    src/     # Go project
  serial-bridge/
    src/     # Go project
/src/powershell/bin/   # ← final target for the built .exe files
```

Use the provided **Makefile**:

```bash
# From repo root
make agent-bin
```

This will:

1. Build Go projects in `/tools/cloudinit-iso/src` and `/tools/serial-bridge/src`
2. Place the resulting binaries into `/src/powershell/bin`

> If you build manually, ensure you build `src/` first, then the tools, then move outputs to `/src/powershell/bin`.

## Running the Agent (on a Hyper-V host)

1. Copy the folder `src/powershell/` and its `bin/` subfolder (containing the built `.exe`) to the Windows host.
2. Open an elevated PowerShell.
3. Create and configure the **config.json** file with your environment.

### Example `config.json`

```json
{
  "agentId": "HOST-HVX-TEST-001",
  "rabbitmqUrl": "amqp://guest:guest@10.0.0.15:5672/",
  "heartbeatIntervalSec": 30,
  "inventoryIntervalSec": 90,
  "basePath": "D:\\VM-REPO",
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

### Start the Agent

```powershell
# Example (adapt to your parameters)
# .\openhvx-agent.exe
```
