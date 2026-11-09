# Agents

The OpenHVX Agent executes Hyper-V operations through PowerShell and exchanges
commands, results, and host telemetry with the backend over RabbitMQ.

**Status:** active development. Durable execution and recovery are tested with
simulated host effects; real Windows/Hyper-V failure testing remains necessary.

Repository: [openhvx/openhvx-agent](https://github.com/openhvx/openhvx-agent)

## Role

| Component | Responsibility |
| --- | --- |
| Agent process | Configuration, host context, telemetry, recovery loop, shutdown |
| AMQP consumer | Command validation, execution coordination, confirmed results |
| Journal | Durable operation identity, execution state, result publication state |
| PowerShell adapters | Script execution and Hyper-V operations |
| `serial-bridge` / `cloudinit-iso` | Console connection and cloud-init ISO helpers |

The agent consumes `agent.<agentId>.tasks`, validates protocol v2 envelopes, records
intent in its journal before host effects, then publishes results for the controller
to apply transactionally. See [task protocol](/task-protocol).

## Configuration

The agent reads a JSON file selected with `-config` (default `config.json`).
It does not load backend `.env` profiles.

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
    "echo",
    "console",
    "vm.edit"
  ]
}
```

| Setting | Meaning |
| --- | --- |
| `agentId` | Stable host identity; must match backend routing and inventory |
| `rabbitmqUrl` | Reachable AMQP URI with dedicated broker credentials |
| `basePath` | Managed host data root (absolute Windows path) |
| `journalPath` | Absolute persistent journal path |
| `capabilities` | Advertised actions; defaults to `inventory` and `vm.power` when empty |

The agent adds `task.protocol.v2` after opening its journal. Do not add that
capability manually as a substitute for a working journal.

`AMQP_QUEUE_TYPE` (`classic` or `quorum`) must match the backend and existing queues.

## Build and run

On Windows, from the agent repository root:

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

.\openhvx-agent.exe -config .\config.json
```

Keep the journal on durable local storage with restrictive ACLs. Do not delete it,
substitute an empty journal, or reuse the same `agentId` on another host to retry
an unknown outcome.

Host installation and environment-specific infrastructure belong to deployment
automation maintained separately from the agent repository.

## Limitations

The journal provides local ACID persistence. RabbitMQ and Hyper-V do not share that
transaction. Partial VM creation and uncertain restarts can require operator
investigation. CI runs on Linux with simulated Hyper-V effects; real host and
cluster failure validation remains necessary.
