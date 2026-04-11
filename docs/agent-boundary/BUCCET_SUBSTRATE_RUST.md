# Buccet Rust Substrate

Agent Buccet now carries the fused Rust substrate in-repo at:

```text
native/buccet-substrate-rust
```

This is the D/K/Q fused surface:

- `D` = Docker lineage
- `K` = Kubernetes lineage
- `Q` = Qubes lineage

It contains the native and WASM build targets for the vendored substrate crate.

## What It Means

This is the merged substrate artifact, not a separate side project.

The crate is part of the Agent Buccet repo now so the system can:

- keep the fused substrate under the same version control as the live runtime
- build native Rust artifacts from the same repo surface
- build a WASM target for future TypeScript-side consumption
- keep D/K/Q lineage visible and auditable inside Buccet itself

## What It Does Not Mean

This pass does **not** swap the current live TypeScript runtime over to the Rust crate.

That would be a runtime replacement and needs a separate parity pass.

What this pass closes is the repo/system split:

- the substrate is now inside the Buccet repo
- the build surface is repo-owned
- the release package carries it
- the docs surface names it explicitly

## Build

Native:

```bash
npm run build:agent-buccet:substrate:native
```

Check only:

```bash
npm run build:agent-buccet:substrate:check
```

WASM:

```bash
npm run build:agent-buccet:substrate:wasm
```

If `wasm-pack` is not installed, the WASM build will not run until that tool is added locally.

## Verification

```bash
npm run test:agent-buccet:substrate-rust
```

That contract proves:

- the vendored crate files are present
- the crate still builds from inside this repo
- the substrate is not just copied in name only
