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
It also now carries the built `pkg/` WASM bundle and a Buccet-owned TypeScript adapter.
That means Buccet can carry a portable bounded runtime surface across machines in the same way teams used Docker for "works here, works there" transport, but without inheriting Docker's full runtime bloat or dropping Buccet's law/ledger/governor stack.

## What It Means

This is the merged substrate artifact, not a separate side project.

The crate is part of the Agent Buccet repo now so the system can:

- keep the fused substrate under the same version control as the live runtime
- build native Rust artifacts from the same repo surface
- build and vendor a WASM target for Buccet-side consumption
- carry portable bounded demos, workloads, and runtime behavior between machines through the same Buccet substrate surface
- keep D/K/Q lineage visible and auditable inside Buccet itself

## What It Does Not Mean

This does **not** mean the whole Buccet runtime is pure Rust.

TypeScript still carries orchestration, ledger, and higher-layer runtime glue.

What this closes is the repo/system split and makes the lower substrate a real first-class Buccet transport surface:

- the substrate is now inside the Buccet repo
- the build surface is repo-owned
- the built WASM package is now inside the repo too
- the TypeScript adapter is now inside Buccet's library surface
- the release package carries it
- the docs surface names it explicitly

## WASM Bridge

Vendored WASM package:

```text
native/buccet-substrate-rust/pkg
```

Buccet-owned TypeScript adapter:

```text
src/runtime/substrate/substrate-rust.ts
```

The adapter wraps the generated exports and exposes a `BuccetSubstrate` class plus the shared `substrate` singleton.
The current vendored package exposes 18 functions total.
The missing portability step is now present too: `d_enter_environment_wasm`, exposed in Buccet as `enterEnvironment(...)`.

## Portable Runtime Chain

Docker-style portability is three steps, not two:

1. `applyIsolation(...)` creates the bounded namespace shell.
2. `persistState(...)` mounts the portable overlay and writable layer.
3. `enterEnvironment(...)` pivots the workload into that merged root so host `/usr`, `/bin`, and `/lib` are no longer the live runtime surface.

Without step 3, a process can still see the host body.
With step 3, Buccet has an actual portable bounded runtime root.

TypeScript shape:

```ts
await substrate.init();
substrate.applyIsolation("unit-1");
substrate.persistState("unit-1", { base_dir: "/images/my-app" });
substrate.enterEnvironment("unit-1");
```

Node note:

- Node can load the vendored WASM package with `--experimental-wasm-modules`
- bundler environments can load the package directly
- full live cutover of the hot Buccet runtime into this substrate remains a separate parity phase

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
- the vendored WASM package exposes 18 functions
- the vendored WASM package is synchronized into the repo
- the portability chain is exposed through Buccet's adapter
- the substrate is not just copied in name only
