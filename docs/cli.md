# CLI (`hvx`)

`hvx` is a Go command-line client for the OpenHVX tenant and admin HTTP APIs.
It manages contexts, lists resources, and submits and inspects asynchronous tasks.
The backend builds the internal agent protocol envelopes.

**Status:** active development. HTTP behavior is tested with local test servers;
validation against a complete deployed OpenHVX environment remains necessary.

Repository: [openhvx/openhvx-cli](https://github.com/openhvx/openhvx-cli)

## Build

Use the Go version declared in the module. From `src`:

```bash
go build -o ../bin/hvx ./cmd/hvx
```

## Initialize authentication

```bash
bin/hvx init --mode tenant \
  --tenant-server https://api.openhvx.example.test \
  --username user@example.test --password-stdin
```

Initialization logs in, creates a PAT, and stores it without printing token material.
Admin mode uses `--mode admin --admin-server URL`. Prefer `--password-stdin` or
`HVX_PASSWORD` over placing credentials in shell history.

Default config path: `~/.config/hvx/config.json` (`HVX_CONFIG` overrides).

## Common commands

```bash
bin/hvx get vms
bin/hvx get disks
bin/hvx get images
bin/hvx describe vm web01
bin/hvx create vm web01 --ram 4GB --cpu 2 --disk-id DISK_REF
bin/hvx start vm web01 --wait
bin/hvx stop vm web01
bin/hvx delete vm web01 --agent-id host-1

bin/hvx create -f examples/task.example.json
bin/hvx get requests
bin/hvx retry REQUEST_ID
bin/hvx get tasks
bin/hvx wait task TASK_ID --timeout 5m
```

Names resolve against current tenant inventory. Multiple matches fail before
submission; use canonical references and `--agent-id` when needed. Keys are
generated and saved automatically before submission. Use `retry` to recover an
uncertain request; running a new task command creates a new operation.

## Contexts

```bash
bin/hvx config get-contexts
bin/hvx config use-context lab
bin/hvx config current-context
bin/hvx context show
```

Named contexts select environments and accounts. Context lists never print tokens.

## HTTP mapping

| Command | HTTP API |
| --- | --- |
| `init` | `/api/v1/{tenant\|admin}/auth/login`, then `/auth/pats` |
| `get vms` / `get disks` / `get resources` | Tenant or admin tenant resources |
| `get images` | Images under the selected API prefix |
| `get quotas` | Tenant quotas or admin quota routes |
| Task mutations | `POST /api/v1/{tenant\|admin}/tasks` |
| Task inspection / wait | `GET /api/v1/{tenant\|admin}/tasks/{taskId}` |

See the [API overview](/api) and [task protocol](/task-protocol) for server semantics.
