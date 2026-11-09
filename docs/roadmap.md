# Roadmap

OpenHVX is under active development. This roadmap lists the next platform bricks
after the current control plane (auth, gateway, controller, agents, tasks, storage).
Dates are not commitments; scope can shift with lab validation.

## 1. Networking

Deliver a **cloud-style virtual network** for tenants, with a dedicated **Network
Orchestrator** on RabbitMQ. Tenants never see Hyper-V switches, VLAN IDs, or VyOS.

### Tenant model

| Object | Purpose |
| --- | --- |
| VPC | Tenant-isolated address space |
| Subnet | CIDR segment with `access`: `private` or `public` |
| Network interface (NIC) | Attach a VM to a ready subnet |
| Internet Gateway | VPC path to/from the public Internet |
| NAT Gateway | Managed egress for private subnets |
| Public IP | Allocatable address associated to a NIC or NAT Gateway |

### Rules

- A subnet (and its VPC) must be **`ready` before** any NIC attach - on a new VM
  (`vm.create` + `subnetId`) or an existing VM. No implicit network create during
  VM create.
- Controller owns API admission, quotas, IPAM, and operation identity.
- Controller sends **compute** tasks to the Hyper-V agent; it sends **network jobs**
  to the Network Orchestrator.
- Network Orchestrator realizes the plan: host L2/NIC tasks to the Hyper-V agent,
  and edge L3 (Internet/NAT/Public IP) to VyOS. It does not expose provider details
  on the tenant API.
- Hyper-V agent and Network Orchestrator both may publish protocol v2 commands to
  `agent.<id>.tasks`, partitioned by action family (`vm.*` / compute vs `network.*`).

### In scope

- VPC / subnet / NIC / IGW / NAT / Public IP lifecycle
- IPAM with durable holds (same consistency spirit as quotas/tasks)
- Provider mapping kept internal (fabric VLAN pools, vSwitch segments, VyOS)
- CLI and API for the objects above

### Out of scope for this phase

- Security groups / microsegmentation as a full product
- VPC peering / transit
- Tenant-visible overlays (VXLAN as a feature)
- Controller talking to VyOS or publishing network host tasks directly

## 2. High availability (VM host failover)

After networking, add **automatic VM failover** when a Hyper-V host becomes
unavailable.

### Goals

- Detect host failure from agent heartbeats / inventory freshness already in the
  control plane
- Select a target host (capacity, placement, shared storage readiness)
- Restart or live-recover eligible VMs on the target host through durable tasks
- Keep tenant identity, disks, and network attachments consistent after move
  (depends on shared storage and ready networks from phase 1)

### Expected building blocks

- HA policy per VM or per tenant (opt-in, fail over vs stay stopped)
- Placement / election using existing host metrics hooks
- Orchestrated evacuate saga: fence or confirm source loss → ensure storage access
  on target → redefine/start VM → re-attach NICs via Network Orchestrator
- Clear `reconciling` behavior when failover outcome is uncertain (protocol v2)

### Out of scope for this phase

- Stretch clusters / storage replication productization beyond what the storage
  connector already provides
- Cross-site DR / backup as a substitute for host HA
- Transparent live migration for every workload (failover may imply restart unless
  lab-proven otherwise)

## Sequencing

```text
Current platform  →  1. Networking  →  2. HA (VM host failover)
```

Networking first so failover can re-bind NICs to **existing ready** subnets and
preserve cloud-style attachments instead of host-local switch names.
