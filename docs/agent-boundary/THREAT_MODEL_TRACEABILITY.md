# Threat Model Traceability

This document maps public guarantees to implementation, test evidence, and residual risks.

## Method

- Guarantee: what the runtime claims.
- Implementation: primary enforcement files.
- Evidence: contract/e2e scripts that prove behavior.
- Residual risk: what is still out of scope or requires hardened deployment.

## Guarantee Mapping

| Guarantee | Implementation | Evidence | Residual Risk |
| --- | --- | --- | --- |
| No ambient authority; proposals do not self-authorize | `lib/lml/agent-boundary/meta.ts`, `lib/lml/agent-boundary/laws.ts`, `lib/lml/agent-boundary/executor.ts` | `scripts/agent-buccet-gravity-contract.ts`, `scripts/agent-buccet-e2e.ts` | Relies on consumers to route all high-risk actions through boundary APIs |
| Out-of-scope targets are denied or elevated to lawful grant path | `lib/lml/agent-boundary/orchestrator.ts`, `lib/lml/agent-boundary/runtime.ts`, `lib/lml/agent-boundary/gravity-core/skills.ts` | `scripts/agent-buccet-e2e.ts`, `scripts/agent-buccet-gravity-contract.ts`, `scripts/agent-buccet-action-classes-contract.ts` | Depends on complete interception/adapter coverage for every action surface |
| High-risk classes require explicit approval by policy/law | `lib/lml/agent-boundary/laws.ts`, `lib/lml/agent-boundary/approval.ts`, `lib/lml/agent-boundary/executor.ts` | `scripts/agent-buccet-e2e.ts`, `scripts/agent-buccet-swarm-contract.ts` | Approval UX and reviewer quality remain an operator concern |
| Incomplete ledger traces are non-authoritative | `lib/lml/agent-boundary/ledger-audit.ts`, `lib/lml/agent-boundary/executor.ts`, `lib/lml/agent-boundary/intercept.ts` | `scripts/agent-buccet-gravity-contract.ts`, `scripts/agent-buccet-ledger-contract.ts` | Strong local integrity, but independent external anchoring remains optional |
| Signed, inspectable ledger chain with checkpoints | `lib/lml/agent-boundary/ledger.ts`, `lib/lml/agent-boundary/witness.ts` | `scripts/agent-buccet-ledger-contract.ts`, `scripts/agent-buccet-ledger-witness-contract.ts` | No hardware-backed key isolation by default |
| Release packaging publishes witness evidence by default or records explicit break-glass opt-out | `lib/lml/agent-boundary/release-witness.ts`, `scripts/prepare-agent-buccet-package.ts` | `scripts/agent-buccet-release-witness-contract.ts` | Witness publication defaults to local/file mode unless operators wire an external target |
| Wrapper process policy enforcement (command/cwd/env) | `lib/lml/agent-boundary/process.ts`, `lib/lml/agent-boundary/wrapper.ts` | `scripts/agent-buccet-wrapper-contract.ts` | Bypass possible if process runs outside wrapper/hook boundary |
| Hook/supervisor split with fail-closed-on-dead-brain semantics | `native/deep-intercept/gravity.c`, `lib/lml/agent-boundary/gravity-supervisor.ts`, `scripts/agent-buccet-hook-daemon.ts` | `scripts/agent-buccet-hook-runtime-contract.ts`, `scripts/agent-buccet-gravity-supervisor-contract.ts` | Not full kernel mediation on every platform path |
| Shared swarm approvals resolve matching frozen requests | `lib/lml/agent-boundary/swarm.ts`, `lib/lml/agent-boundary/intercept.ts` | `scripts/agent-buccet-swarm-contract.ts` | Grouping quality depends on request normalization and action classification |
| Intercept bridge maps low-level events into finite boundary action classes | `lib/lml/agent-boundary/system-intercept.ts`, `lib/lml/agent-boundary/intercept.ts`, `scripts/agent-buccet-system-intercept-bridge.ts` | `scripts/agent-buccet-system-intercept-contract.ts` | Mapping layer cannot enforce events it does not observe |
| Observed contracts remain visible with timing and failure-signature reporting | `.github/workflows/agent-buccet-contracts.yml`, `scripts/agent-buccet-flake-reliability.ts` | `npm run check:agent-buccet:contracts-observed` | Non-blocking lanes still require operator review and promotion discipline |

## Reviewer Notes

- This repo enforces a strong user-space containment model and signed local audit chain.
- Public claims should continue to follow `CURRENT_LIMITS.md` and avoid universal-kernel guarantees.
- Release flows now publish witness state by default and require explicit break-glass logging to skip it.
- Use `scripts/agent-buccet-doc-links-contract.ts` and `scripts/agent-buccet-artifact-hygiene-contract.ts` to keep release quality and portability non-regressing.
