#!/usr/bin/env python3
"""
build_buccet_rust.py — vendored Buccet Rust substrate builder.

This crate is already the fused D/K/Q substrate artifact. In this repo it is a
first-class native surface, not a separate extractor workspace. This helper
builds the native release artifact and, when available, the WASM bundle used by
TypeScript consumers.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


CRATE_ROOT = Path(__file__).resolve().parents[1]
MANIFEST = CRATE_ROOT / "Cargo.toml"


def run(cmd: list[str], cwd: Path) -> None:
    print(f"$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=str(cwd), check=True)


def main() -> int:
    cargo = shutil.which("cargo")
    if cargo is None:
        print("cargo not found on PATH", file=sys.stderr)
        return 1

    print("=" * 70)
    print("  Agent Buccet Rust Substrate")
    print("  D/K/Q fused crate build")
    print("=" * 70)
    print(f"  crate: {CRATE_ROOT}")
    print()

    run([cargo, "build", "--manifest-path", str(MANIFEST), "--release"], cwd=CRATE_ROOT)
    print()
    print("  native release build: OK")

    wasm_pack = shutil.which("wasm-pack")
    if wasm_pack is None:
        print("  wasm build: skipped (wasm-pack not installed)")
    else:
        run(
            [
                wasm_pack,
                "build",
                str(CRATE_ROOT),
                "--target",
                "bundler",
                "--features",
                "wasm",
                "--no-default-features",
            ],
            cwd=CRATE_ROOT,
        )
        print("  wasm build: OK")

    print()
    print("  ready surfaces:")
    print("  - cargo build --manifest-path native/buccet-substrate-rust/Cargo.toml --release")
    print("  - wasm-pack build native/buccet-substrate-rust --target bundler --features wasm --no-default-features")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
