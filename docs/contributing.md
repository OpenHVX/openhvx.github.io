# How to Contribute

OpenHVX is under active development. Documentation improvements, bug reports,
reproducible lab findings, and focused pull requests are welcome.

## Repositories

| Repository | Scope |
| --- | --- |
| [openhvx-backend](https://github.com/openhvx/openhvx-backend) | Auth, gateway, controller, WebSocket broker |
| [openhvx-agent](https://github.com/openhvx/openhvx-agent) | Hyper-V agent, journal, PowerShell adapters |
| [openhvx-cli](https://github.com/openhvx/openhvx-cli) | `hvx` HTTP client |
| [openhvx-ceph-connector](https://github.com/openhvx/openhvx-ceph-connector) | Storage connector (protocol v2 required for new tasks) |
| [openhvx.github.io](https://github.com/openhvx/openhvx.github.io) | This documentation site |

Each repository keeps focused English guides under `docs/` (architecture,
configuration, development, task protocol, API where applicable). Prefer updating
those guides alongside code changes.

## Expectations

- Keep secrets, real `.env` profiles, agent journals, and PATs out of Git.
- Coordinate backend and agent protocol changes; drain legacy operations before rolling v2.
- Do not treat simulated Hyper-V or local Compose success as production readiness.
- Use discussions and issues on the [OpenHVX GitHub organization](https://github.com/openhvx)
  for proposals and questions.

## Local docs site

From this repository:

```bash
npm install
npm run docs:dev
```

Build with `npm run docs:build`.
