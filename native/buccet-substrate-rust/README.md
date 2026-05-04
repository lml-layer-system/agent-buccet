# Agent Buccet Rust Substrate

Vendored fused substrate crate for Agent Buccet.

This is the native Rust substrate surface: containment, lifecycle, reconciliation-style validation hooks, isolation boundaries, and portable workload execution — fused into one crate shipped in-repo.

What it is for:

- native Rust build for substrate verification and future low-level integration
- WASM build for TypeScript-side consumers that want the fused substrate functions without a second repo
- vendored `pkg/` bundle already built for the current repo
- Buccet-owned adapter at `src/runtime/substrate/substrate-rust.ts`
- a portable bounded substrate surface for moving demos and runtime behavior between machines without an extra heavyweight host stack beside Buccet

Portable runtime chain:

1. `applyIsolation` = bounded namespace shell
2. `persistState` = overlay and writable layer
3. `enterEnvironment` = pivot into the merged root so the workload stops seeing the host filesystem as `/`

That third step turns an isolated mounted tree into an actually portable runtime body.

What it is not:

- it is not turning the whole Buccet runtime into pure Rust
- it is not a separate product outside this repo anymore

Builds:

```bash
cargo build --manifest-path native/buccet-substrate-rust/Cargo.toml --release
```

```bash
wasm-pack build native/buccet-substrate-rust --target bundler --features wasm --no-default-features
```

Repo-owned helper:

```bash
python3 native/buccet-substrate-rust/scripts/build_buccet_rust.py
```

Repo contract:

```bash
npm run test:agent-buccet:substrate-rust
```
