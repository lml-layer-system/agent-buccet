# Agent Buccet Rust Substrate

Vendored fused substrate crate for Agent Buccet.

This is the Rust-native D/K/Q surface:

- `D` = Docker lineage → containment, resource limits, lifecycle, network, contract
- `K` = Kubernetes lineage → scheduling, reconciliation, validation, routing, enforcement
- `Q` = Qubes lineage → trust domains, policy gates, interception, isolation

It is carried in this repo as a first-class native surface.

What it is for:

- native Rust build for substrate verification and future low-level integration
- WASM build for TypeScript-side consumers that want the fused substrate functions without a second repo

What it is not:

- it is not replacing Buccet's live TypeScript runtime in this pass
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
