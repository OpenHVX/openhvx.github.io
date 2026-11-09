# Configuration

K3s injects environment variables into each backend process. ConfigMaps, Secrets, and
lab/production values are owned by the separate `deployment` repository; pods do
not need mounted `.env` files.

This page documents **shared contracts**. Per-service variable catalogs live in the
versioned examples in [openhvx-backend](https://github.com/openhvx/openhvx-backend)
and are not duplicated here.

## Backend service contracts

| Service | Versioned example | Local profile (gitignored) |
| --- | --- | --- |
| Auth | [`.env.auth.example`](https://github.com/openhvx/openhvx-backend/blob/main/.env.auth.example) | `.env.auth` |
| Gateway | [`.env.gateway.example`](https://github.com/openhvx/openhvx-backend/blob/main/.env.gateway.example) | `.env.gateway` |
| Controller | [`.env.controller.example`](https://github.com/openhvx/openhvx-backend/blob/main/.env.controller.example) | `.env.controller` |
| Broker | [`.env.ws.example`](https://github.com/openhvx/openhvx-backend/blob/main/.env.ws.example) | `.env.ws` |

The examples list variables consumed by the code, with comments for required and
optional settings. Secrets are blank and must be supplied. Copying them unchanged
does not create a runnable production environment.

## Shared values

| Variable | Consumers | Requirement |
| --- | --- | --- |
| `INTERNAL_API_SECRET` | Gateway, all controllers | Same random secret, at least 32 characters |
| `JWT_AGENT_SECRET` | Controller, all brokers | Matching ticket signing/verification key |
| `JWT_BROWSER_SECRET` | Controller, all brokers | Matching browser ticket key, distinct from the agent key |
| `OUTBOX_ENCRYPTION_KEY` | All controllers | Stable key, at least 32 characters; retain for restores |
| `MONGO_URL` | Controller, brokers | Same application database and replica set; auth uses a separate database |
| `BROKER_PEERS` | All brokers | Same allowlist of broker IDs and internal URLs |
| `BROKER_ID` | Each broker | Distinct identity per replica |

When `OUTBOX_ENCRYPTION_KEY` is omitted, encryption derives from
`INTERNAL_API_SECRET`. Changing the effective encryption key makes existing outbox
and idempotency records unreadable. Preserve it through rotation and restoration.

`PUBLIC_WS_BASE` is the browser-facing console URL. `BROKER_WS_BASE` is the
agent-facing WebSocket URL. `BROKER_PEERS` contains internal broker URLs.
Browser `WS_ORIGINS` contains page origins, not WebSocket URLs.

Use an authenticated replica-set MongoDB URI and authenticated RabbitMQ URI for
production. Percent-encode credentials in URI components. `AMQP_QUEUE_TYPE` must
match agent declarations and existing queues. New tasks require the
`task.protocol.v2` agent capability.

## Local Compose profiles

[`.env.example`](https://github.com/openhvx/openhvx-backend/blob/main/.env.example)
contains only local Compose interpolation inputs. The root `.env` is not an implicit
shared runtime configuration for K3s or native processes.

Compose loads each service profile with `env_file`, then applies `environment`
overrides. The local base sets controller/broker MongoDB URIs, derives controller
`RMQ_URL` from the RabbitMQ account, injects the root internal secret, and sets the
single broker's ID/peer map.

### Obsolete controller variables

These are **not** supported: `MONGO_DB` (as controller DB), `HEARTBEATS_QUEUE`,
`HEARTBEATS_TTL_MS`, `HEARTBEATS_MAX_LENGTH`, `INVENTORIES_QUEUE`, `RESULTS_QUEUE`,
`RESULTS_BINDING`, and `IMAGES_INDEX_PATH`. Queue names and telemetry retention are
currently defined in code. The image catalog comes from MongoDB inventory.

## Agent configuration

Agents use a JSON file (`config.json`), not backend `.env` profiles. See
[Agents](/agents) for `agentId`, `rabbitmqUrl`, `basePath`, `journalPath`, and
capabilities. `AMQP_QUEUE_TYPE` must match the backend.

## CLI configuration

`hvx` stores contexts and PATs under `~/.config/hvx/config.json` (or `HVX_CONFIG`).
See [CLI](/cli) for `hvx init` and context selection.
