# Security Policy

## What Agent Buccet Protects

Agent Buccet is an **add-on containment layer** for AI agents. It enforces law-based authorization at the point where agents attempt to cross into real system boundaries — filesystem, process execution, network sends, database mutations, credential/system access.

Specifically, Agent Buccet:
- Enforces default-deny on destructive and out-of-scope actions
- Requires explicit user-opened scope for all reachable paths and resources
- Records every decision in a signed, append-only audit ledger
- Provides standing user-law (UPL) persistence across restarts

## Explicit Limits

Agent Buccet does **not** claim:
- Full kernel mediation on every OS path — the current public release uses a hook/preload interception model, not a kernel-level syscall filter
- Impossible bypass on all platforms — determined local processes with root can circumvent user-space hooks
- Independent external attestation by default — the ledger is locally signed; external witness publishing is opt-in

See [`docs/current-limits.md`](docs/current-limits.md) for the full, plain-language limits statement.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately using [GitHub Security Advisories](https://github.com/lml-layer-system/agent-buccet/security/advisories/new).

In your report, include:
- A description of the vulnerability and what boundary it breaks
- Steps to reproduce
- What an attacker can achieve
- Any suggested mitigations you have identified

**Response SLA:**
- Acknowledgement within 72 hours
- Initial assessment within 7 days
- Fix or documented workaround within 30 days for confirmed vulnerabilities

We will coordinate disclosure timing with you. We follow responsible disclosure — we will not ship a fix publicly without giving you credit unless you prefer anonymity.

## Threat Model

The current security and boundary model is documented in [`docs/security-model.md`](docs/security-model.md).
