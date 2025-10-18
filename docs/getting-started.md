# Getting Started (Developer Preview)

> ⚠️ **Active Development:** OpenHVX is not production‑ready. This guide targets **contributors and early testers**.

## Prerequisites

- Windows host with **Hyper‑V** (for Agent tests)
- **Docker/Podman & Docker Compose**
- **Node.js 20+** and **npm**
- **Go 1.21+** (to build Agent tools)

## Quick Start (Backend)

```bash
# 1) Clone
git clone https://github.com/openhvx/openhvx-backend.git
cd openhvx-backend
# 2) Env
Create and fill env files (.env.auth, .env.controller, .env.gateway, .env.ws)
# 3) Run services
docker compose up -d

```

> **All variables and examples are documented in** [Environment variables](https://openhvx.org/docs/environment-variables.html).

## Build Agent Tools (Windows helpers)

These binaries are required by the PowerShell Agent to create cloud‑init ISOs and to bridge serial consoles.

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

## Running the Agent (on a Hyper‑V host)

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

## Next Steps

- Read: **Overview → Architecture & Features**
- Contribute: open issues/PRs on GitHub: [https://github.com/openhvx](https://github.com/openhvx)
- Roadmap & known limitations: _(coming soon)_
