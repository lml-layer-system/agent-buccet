# Current limits

Agent Buccet is a **local runtime** enforcement and audit layer beside your agent tooling. This page states what the **public open-source build** is intended to cover today.

## Runtime scope

Shipping work centers on **supported framework surfaces, wrappers, and in-process integration paths**—not a drop-in replacement for full operating-system mediation across every workload on a machine.

## Ledger and telemetry

The default audit ledger is **local**, **cryptographically signed**, and remains on your disk unless **you** deliberately configure an outbound destination (for example, your own witness endpoint on infrastructure you control).

## Fleet and hosted control

A **hosted multi-tenant fleet control plane is not part** of this repository’s public release scope.

## Deeper platform mediation

Tighter coordination with **kernels, hypervisors, firmware, low-level syscall filtering, memory isolation, tracing, and similar platform layers** stays on the **roadmap and private engineering** side. Do not read the OSS tree as a blanket guarantee in those areas yet.

---

Security posture and honesty boundaries: see [security-model.md](security-model.md) and [public-private-boundary.md](public-private-boundary.md).
