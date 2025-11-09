# Overview

OpenHVX is an open-source orchestration platform for **multi-tenant Hyper-V infrastructures**. It provides a unified control plane to manage virtual machines, quotas, and networking across distributed hosts, built on a lightweight and modular design.

> ⚠️ **Active Development Notice:** OpenHVX is under active development and not yet production-ready.
> Expect rapid iteration and potential breaking changes between releases.
> Community testing and contributions are highly encouraged!

## Architecture

OpenHVX separates orchestration and execution into clear layers.

The architecture is divided into two functional layers:

### Architecture Diagram

<br>

<img src="/assets/schema.openhvx.light.png" alt="OpenHVX Architecture Diagram" class="only-light" data-zoomable />
<img src="/assets/schema.openhvx.dark.png"  alt="OpenHVX Architecture Diagram" class="only-dark" data-zoomable />

- **Control Plane:** Includes the API Gateway, Authentication Service, Controller, WS-Broker (console tunneling), MongoDB, and RabbitMQ. It handles orchestration logic, workflows, multi-tenancy and quota enforcement.
- **Data Plane:** Consists of lightweight PowerShell Agents running on Hyper-V hosts. Agents execute tasks, collect inventory, and stream console sessions.

The design emphasizes **asynchronous communication**, **tenant isolation**, and **extensibility** through modular services.

## Features

- **VM Lifecycle:** Create, edit, clone, and manage VMs with cloud-init and serial console access.
- **Quotas:** Per-tenant CPU, RAM, storage, and VM limits with atomic reservation (hold → execute → release).
- **Multi-Tenancy:** Logical separation of compute, storage, and network resources per tenant.
- **Networking:** Automated provisioning via VyOS API and IPAM integration for NAT, routing, and isolation. (Still under development)
- **Authentication:** Admin and tenant login flows with JWT tokens and different audiences.
- **Agents:** Lightweight, host-based agents for secure orchestration and telemetry.
- **Extensible:** Modular microservice architecture, event-driven.
- **Modern UI:** Specific UI for tenant & admin scope.

## User Interface

### Admin Dashboard

The admin dashboard provides a global overview of tenants, resources, and running tasks.

<img src="/assets/dashboard.png" alt="OpenHVX Admin Dashboard" width="900" data-zoomable />

### Serial Console

Each VM exposes a live serial console, **established as a tunnel** between the **client browser** and the **Agent**, with the **WebSocket Broker** acting as an intermediary relay.  
The broker maintains secure, tenant-scoped channels, ensuring that only authenticated users can attach to their own virtual machines.

This architecture provides near real-time console streaming, independent of the hypervisor’s native UI or RDP, and works even in fully headless environments.

<img src="/assets/serial-console.png" alt="OpenHVX Serial Console" width="900" data-zoomable />

### 🤝 Contributing

We welcome contributions from the community! Whether it’s documentation improvements, feature suggestions, or bug reports — every input helps make OpenHVX better. Visit the [GitHub organization](https://github.com/openhvx) to get started.
