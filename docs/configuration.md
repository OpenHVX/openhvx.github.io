# Configuration

K3s injects environment variables into each backend process. ConfigMaps, Secrets, and
lab/production values are owned by the separate `deployment` repository; pods do
not need mounted `.env` files. Secrets below are blank in the versioned examples and
must be supplied - copying examples unchanged does not create a runnable production
environment.

Local Compose uses per-service profiles (`.env.auth`, `.env.gateway`, `.env.controller`,
`.env.ws`) plus a root `.env` for Compose-only interpolation.

## Shared secrets

These values must match across consumers:

| Variable | Consumers | Requirement |
| --- | --- | --- |
| `INTERNAL_API_SECRET` | Gateway, Controller | Same random secret, at least 32 characters |
| `JWT_AGENT_SECRET` | Controller, WS Broker | Matching ticket signing/verification key |
| `JWT_BROWSER_SECRET` | Controller, WS Broker | Matching browser ticket key, distinct from the agent key |
| `OUTBOX_ENCRYPTION_KEY` | Controller | Stable key, at least 32 characters; retain for restores |
| `MONGO_URL` | Controller, WS Broker | Same application database and replica set |
| `AMQP_QUEUE_TYPE` | Controller, Agent | Must match existing queue declarations |

When `OUTBOX_ENCRYPTION_KEY` is omitted, encryption derives from `INTERNAL_API_SECRET`.
Changing the effective encryption key makes existing outbox and idempotency records
unreadable. Auth uses a **separate** MongoDB database from the controller/broker app DB.

Use authenticated replica-set MongoDB and authenticated RabbitMQ URIs in production.
Percent-encode credential components in URIs.

## Auth service

| Variable | Example / default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `4000` | HTTP listen port |
| `MONGO_URL` | `mongodb://mongo:27017/hvwm_auth?replicaSet=rs0` | Auth database URI (separate from controller) |
| `CORS_ORIGIN` | `https://app.openhvx.local` | Allowed browser origin(s) |
| `JWT_TENANT_SECRET` | *(required, blank)* | Tenant JWT signing secret (≥ 32 chars) |
| `JWT_ADMIN_SECRET` | *(required, blank)* | Admin JWT signing secret (≥ 32 chars, distinct) |
| `JWT_TENANT_ISS` | `auth-service/tenant` | Tenant token issuer |
| `JWT_TENANT_AUD` | `api://tenant` | Tenant token audience |
| `JWT_TENANT_EXPIRES` | `8h` | Tenant token lifetime |
| `JWT_ADMIN_ISS` | `auth-service/admin` | Admin token issuer |
| `JWT_ADMIN_AUD` | `api://admin` | Admin token audience |
| `JWT_ADMIN_EXPIRES` | `30m` | Admin token lifetime |
| `REGISTER_ENABLED` | `false` | Enable admin bootstrap registration |
| `REGISTER_API_KEY` | *(blank)* | API key required when admin registration is enabled |
| `TENANT_REGISTER_APIKEY` | *(optional)* | Tenant registration key; absent means authenticated registration only |
| `AUTH_DEBUG` | `false` | Verbose auth logging |
| `MONGO_DB` | *(optional, commented)* | Legacy DB name override; prefer the database in `MONGO_URL` |

## API Gateway

| Variable | Example / default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `8080` | HTTP listen port |
| `AUTH_URL` | `http://auth:4000` | Internal Auth service base URL |
| `CONTROLLER_URL` | `http://controller:3000` | Internal Controller base URL |
| `BROKER_URL` | `http://ws-broker:8081` | Internal WS Broker base URL |
| `CORS_ORIGIN` | `https://app.openhvx.local` | Comma-separated exact frontend origins (no trailing slash) |
| `ENABLE_APIDOCS` | `false` | Serve Swagger UI at `/docs` when `true` |
| `GW_DEBUG` | `false` | Verbose gateway logging |
| `INTERNAL_API_SECRET` | *(required, blank)* | Shared with controller (≥ 32 chars) |

## Controller

| Variable | Example / default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `3000` | HTTP listen port |
| `MONGO_URL` | `mongodb://mongo:27017/hvwm?replicaSet=rs0` | Application MongoDB URI (replica set) |
| `CORS_ORIGIN` | `https://app.openhvx.local` | Allowed browser origin(s) |
| `RMQ_URL` | *(required, blank)* | Authenticated AMQP URI |
| `AMQP_QUEUE_TYPE` | `classic` | `classic` or `quorum`; migrate before changing |
| `JOBS_EXCHANGE` | `jobs` | Jobs exchange name |
| `TELEMETRY_EXCHANGE` | `agent.telemetry` | Telemetry exchange name |
| `RESULTS_EXCHANGE` | `results` | Results exchange name |
| `AMQP_CONNECT_MAX_ATTEMPTS` | `6` | AMQP connect retry budget |
| `INTERNAL_API_SECRET` | *(required, blank)* | Shared with gateway (≥ 32 chars) |
| `OUTBOX_ENCRYPTION_KEY` | *(optional)* | Outbox/idempotency encryption (≥ 32 chars); else derived from `INTERNAL_API_SECRET` |
| `JWT_AGENT_SECRET` | *(required, blank)* | Console agent ticket secret (shared with broker) |
| `JWT_BROWSER_SECRET` | *(required, blank)* | Console browser ticket secret (shared with broker) |
| `PUBLIC_WS_BASE` | `wss://console.openhvx.local/api` | Browser-facing console WebSocket base (not a pod URL) |
| `BROKER_WS_BASE` | `wss://ws.openhvx.local` | Agent-facing WebSocket base (not a pod URL) |
| `STORAGE_CONTROLLER_AGENT_ID` | *(optional)* | Default agent for storage operations |
| `AGENT_STALE_MS` | `300000` | Mark agent stale after this many ms without heartbeat |
| `AGENT_FRESHNESS_SEC` | `300` | Freshness window used by inventory/election logic |
| `INVENTORY_MAX_AGE_MS` | `300000` | Maximum accepted inventory age |
| `IMAGES_TTL_MS` | `5000` | Image catalog cache TTL |
| `QUOTA_REAPER_INTERVAL_MS` | `300000` | Quota reaper interval |
| `QUOTA_REAPER_BATCH` | `200` | Quota reaper batch size |
| `ELECTION_WEIGHT_CPU` | `0.6` | Host election weight for CPU |
| `ELECTION_WEIGHT_MEM` | `0.4` | Host election weight for memory |
| `LOG_ENABLED` | `1` | Enable structured logging |
| `LOG_LEVEL` | `info` | Log level |
| `LOG_JSON` | `1` | JSON log format when enabled |
| `LOG_SERVICE_NAME` | `controller` | Service name in logs |

### Obsolete controller variables

Not supported: `MONGO_DB` (as controller DB), `HEARTBEATS_QUEUE`, `HEARTBEATS_TTL_MS`,
`HEARTBEATS_MAX_LENGTH`, `INVENTORIES_QUEUE`, `RESULTS_QUEUE`, `RESULTS_BINDING`,
`IMAGES_INDEX_PATH`. Queue names and telemetry retention are defined in code. The
image catalog comes from MongoDB inventory.

## WS Broker

| Variable | Example / default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `8081` | HTTP / WS listen port |
| `MONGO_URL` | `mongodb://mongo:27017/hvwm?replicaSet=rs0` | Same application DB as controller |
| `BROKER_ID` | `broker-0` | Unique identity per broker replica |
| `BROKER_PEERS` | `{"broker-0":"http://broker-0.brokers:8081"}` | JSON allowlist of broker ID → internal URL |
| `JWT_AGENT_SECRET` | *(required, blank)* | Same value as controller |
| `JWT_BROWSER_SECRET` | *(required, blank)* | Same value as controller |
| `WS_ORIGINS` | `https://app.openhvx.local` | Browser **page** origins (not WS URLs); empty disables origin allowlist (tickets still verified) |
| `MAX_TUNNELS` | `1000` | Max concurrent tunnels on this broker |
| `MAX_TUNNELS_PER_IP` | `10` | Per-IP tunnel cap |
| `BROWSER_WAIT_MS` | `10000` | Browser side wait budget for pairing |

## Local Compose root (`.env`)

Compose-only interpolation inputs. **Not** a K3s runtime configuration.

| Variable | Example / default | Description |
| --- | --- | --- |
| `INTERNAL_API_SECRET` | *(blank)* | Injected into gateway and controller by Compose |
| `NODE_ENV` | `development` | Local stack mode |
| `RABBITMQ_DEFAULT_USER` | `openhvx` | RabbitMQ user for the Compose broker |
| `RABBITMQ_DEFAULT_PASS` | *(blank / dev default)* | URL-safe password; Compose builds `RMQ_URL` from these credentials |
| `PODMAN_SOCKET_PATH` | `/run/podman/podman.sock` | Optional Podman socket for the Compose override |

## Agent (`config.json`)

Agents use JSON, not backend `.env` profiles. Default path: `config.json` (override with `-config`).

| Setting | Example | Description |
| --- | --- | --- |
| `agentId` | `HOST-OPENHVX-HYPERV-001` | Stable host identity; must match backend routing |
| `rabbitmqUrl` | `amqps://agent-user:…@rabbitmq:5671/` | Reachable AMQP URI with dedicated credentials |
| `heartbeatIntervalSec` | `30` | Heartbeat interval (default 30 if omitted/nonpositive) |
| `inventoryIntervalSec` | `60` | Full inventory interval (default 60) |
| `basePath` | `D:\\DATA` | Managed host data root (absolute Windows path) |
| `journalPath` | `D:\\DATA\\agent-state\\operations.db` | Absolute journal path; default `<basePath>/agent-state/operations.db` |
| `capabilities` | `inventory`, `vm.power`, … | Advertised actions; defaults to `inventory` + `vm.power` when empty |

The agent adds `task.protocol.v2` after opening its journal. Do not add that capability
manually as a substitute for a working journal.

| Environment variable | Description |
| --- | --- |
| `AMQP_QUEUE_TYPE` | `classic` (default) or `quorum`; must match backend and existing queues |
| `AMQP_INTEGRATION_URL` | Test-only broker URI |
| `PWSH_BINARY` | Test-only PowerShell executable override |

## CLI (`hvx`)

Default config path: `~/.config/hvx/config.json`.

| Environment variable | Description |
| --- | --- |
| `HVX_CONFIG` | Alternate configuration file path |
| `HVX_PASSWORD` | Login password fallback for `hvx init` when not using `--password-stdin` |

| Config field | Description |
| --- | --- |
| `profile.mode` | Active `tenant` or `admin` API surface |
| `profile.currentTenant` | Default tenant for admin operations |
| `endpoints.tenant.server` | Tenant gateway URL |
| `endpoints.admin.server` | Admin gateway URL |
| `auth.tenantPat` | Tenant PAT |
| `auth.adminPat` | Admin PAT |
| `auth.insecure` | Disable TLS verification (default `false`) |

See [CLI](/cli) for `hvx init`, contexts, and common commands.
