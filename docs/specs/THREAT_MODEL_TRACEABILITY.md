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
| No ambient authority; proposals do not self-authorize | Runtime law and boundary modules | Public contract and e2e coverage | Relies on consumers to route all high-risk actions through boundary APIs |
| Out-of-scope targets are denied or elevated to lawful grant path | Runtime routing and action classification modules | Public contract and e2e coverage | Depends on complete adapter coverage for every action surface |
| High-risk classes require explicit approval by policy/law | Law, approval, and boundary modules | Public contract and e2e coverage | Approval UX and reviewer quality remain an operator concern |
| Incomplete ledger traces remain auditable history, not live authorization | Ledger audit and boundary modules | Public ledger and boundary contract coverage | Strong local integrity; independent external anchoring requires explicit operator wiring |
| Signed, inspectable ledger chain with checkpoints | Ledger and witness modules | Public ledger and witness contract coverage | No hardware-backed key isolation by default |
| Release packaging publishes witness evidence by default or records explicit break-glass opt-out | Release witness and package preparation modules | Public release-witness contract coverage | Witness publication defaults to local/file mode unless operators wire an external target |
| UPL track handling maps request meaning into structured boundary decisions and refuses partial interpretation | Runtime track and UPL modules | Public UPL and boundary contract coverage | Mapping is bounded by current extractor dimensions, not arbitrary future phrasing |
| External policy sources can be bound into standing Buccet law on the enforcement plane | Policy binding and ledger modules | Public policy-binding contract coverage | Source systems still need an operator or adapter to produce the policy binding payload |
| Wrapper process policy enforcement (command/cwd/env) | Process and wrapper modules | Public wrapper contract coverage | Bypass possible if process runs outside wrapper/hook boundary |
| Hook/supervisor split with fail-closed-on-dead-brain semantics | Native hook and supervisor modules | Public hook-runtime and supervisor contract coverage | Not full kernel mediation on every platform path |
| Shared swarm approvals resolve matching frozen requests | Swarm and intercept modules | Public swarm contract coverage | Grouping quality depends on request normalization and action classification |
| Intercept bridge maps low-level events into finite boundary action classes | System-intercept and bridge modules | Public system-intercept contract coverage | Mapping layer cannot enforce events it does not observe |
| Observed contracts remain visible with timing and failure-signature reporting | CI and reliability tooling | Public observed-contracts lane | Non-blocking lanes still require operator review and promotion discipline |

## Reviewer Notes

- This repo enforces a strong user-space containment model and signed local audit chain.
- Public claims should continue to follow `current-limits.md` and avoid universal platform-mediation guarantees.
- Release flows now publish witness state by default and require explicit break-glass logging to skip it.
- Use `contracts/runtime/agent-buccet-doc-links-contract.ts` and `contracts/runtime/agent-buccet-artifact-hygiene-contract.ts` to keep release quality and portability non-regressing.
