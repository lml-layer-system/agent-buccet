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
| No ambient authority; proposals do not self-authorize | `src/runtime/meta.ts`, `src/law/laws.ts`, `src/boundaries/bodyguard.ts` | `contracts/engines/agent-buccet-gravity-contract.ts`, `scripts/agent-buccet-e2e.ts` | Relies on consumers to route all high-risk actions through boundary APIs |
| Out-of-scope targets are denied or elevated to lawful grant path | `src/runtime/orchestrator.ts`, `src/runtime/runtime.ts`, `src/engines/gravity/gravity-core/skills.ts` | `scripts/agent-buccet-e2e.ts`, `contracts/engines/agent-buccet-gravity-contract.ts`, `contracts/runtime/agent-buccet-action-classes-contract.ts` | Depends on complete interception/adapter coverage for every action surface |
| High-risk classes require explicit approval by policy/law | `src/law/laws.ts`, `src/boundaries/approval.ts`, `src/boundaries/bodyguard.ts` | `scripts/agent-buccet-e2e.ts`, `contracts/runtime/agent-buccet-swarm-contract.ts` | Approval UX and reviewer quality remain an operator concern |
| Incomplete ledger traces remain auditable history, not live authorization | `src/proof/ledger-audit.ts`, `src/boundaries/bodyguard.ts`, `src/runtime/intercept.ts` | `contracts/engines/agent-buccet-gravity-contract.ts`, `contracts/proof/agent-buccet-ledger-contract.ts` | Strong local integrity; independent external anchoring requires explicit operator wiring |
| Signed, inspectable ledger chain with checkpoints | `src/proof/ledger.ts`, `src/runtime/witness.ts` | `contracts/proof/agent-buccet-ledger-contract.ts`, `contracts/proof/agent-buccet-ledger-witness-contract.ts` | No hardware-backed key isolation by default |
| Release packaging publishes witness evidence by default or records explicit break-glass opt-out | `src/runtime/release-witness.ts`, `scripts/prepare-agent-buccet-package.ts` | `contracts/proof/agent-buccet-release-witness-contract.ts` | Witness publication defaults to local/file mode unless operators wire an external target |
| Track Extractor snaps lawful meaning into structured expression/output/completion/action corridors and refuses partial snap | `src/runtime/track-extractor.ts`, `src/runtime/expression-track-extractor.ts`, `src/runtime/output-track-extractor.ts`, `src/runtime/track-extractor-action.ts`, `src/law/upl-tracks.ts` | `contracts/law/agent-buccet-document-law-contract.ts`, `contracts/law/agent-buccet-upl-tracks-contract.ts`, `contracts/boundaries/agent-buccet-chat-boundary-contract.ts` | Corridor materialization is bounded by current extractor dimensions, not arbitrary future phrasing |
| External policy sources can be bound into standing Buccet law on the enforcement plane | `src/boundaries/policy-binding.ts`, `src/proof/user-path-ledger.ts` | `contracts/boundaries/agent-buccet-policy-binding-contract.ts` | Source systems still need an operator or adapter to produce the policy binding payload |
| Wrapper process policy enforcement (command/cwd/env) | `src/runtime/process.ts`, `src/runtime/wrapper.ts` | `contracts/runtime/agent-buccet-wrapper-contract.ts` | Bypass possible if process runs outside wrapper/hook boundary |
| Hook/supervisor split with fail-closed-on-dead-brain semantics | `native/deep-intercept/gravity.c`, `src/engines/gravity/gravity-supervisor.ts`, `scripts/agent-buccet-hook-daemon.ts` | `contracts/runtime/agent-buccet-hook-runtime-contract.ts`, `contracts/engines/agent-buccet-gravity-supervisor-contract.ts` | Not full kernel mediation on every platform path |
| Shared swarm approvals resolve matching frozen requests | `src/runtime/swarm.ts`, `src/runtime/intercept.ts` | `contracts/runtime/agent-buccet-swarm-contract.ts` | Grouping quality depends on request normalization and action classification |
| Intercept bridge maps low-level events into finite boundary action classes | `src/runtime/system-intercept.ts`, `src/runtime/intercept.ts`, `scripts/agent-buccet-system-intercept-bridge.ts` | `contracts/runtime/agent-buccet-system-intercept-contract.ts` | Mapping layer cannot enforce events it does not observe |
| Observed contracts remain visible with timing and failure-signature reporting | `.github/workflows/agent-buccet-contracts.yml`, `scripts/agent-buccet-flake-reliability.ts` | `npm run check:agent-buccet:contracts-observed` | Non-blocking lanes still require operator review and promotion discipline |

## Reviewer Notes

- This repo enforces a strong user-space containment model and signed local audit chain.
- Public claims should continue to follow `current-limits.md` and avoid universal-kernel guarantees.
- Release flows now publish witness state by default and require explicit break-glass logging to skip it.
- Use `contracts/runtime/agent-buccet-doc-links-contract.ts` and `contracts/runtime/agent-buccet-artifact-hygiene-contract.ts` to keep release quality and portability non-regressing.
