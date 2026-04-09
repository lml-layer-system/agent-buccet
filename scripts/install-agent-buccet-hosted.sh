#!/bin/sh
set -eu

BASE_URL=${AGENT_BUCCET_INSTALL_BASE_URL:-"https://buccet.lml.dev/releases"}
BUCCET_HOME=${AGENT_BUCCET_HOME:-"$HOME/.buccet"}
LAUNCHER_DIR=${AGENT_BUCCET_LAUNCHER_DIR:-"$HOME/.local/bin"}
AUTO_INIT=${AGENT_BUCCET_AUTO_INIT:-"1"}

if [ -n "${AGENT_BUCCET_MANIFEST_URL:-}" ]; then
  MANIFEST_URL=$AGENT_BUCCET_MANIFEST_URL
elif [ -f "$0" ]; then
  SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
  MANIFEST_URL="file://$SCRIPT_DIR/latest.json"
else
  MANIFEST_URL="$BASE_URL/latest.json"
fi

for command in curl tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Agent Buccet hosted install requires $command on PATH." >&2
    exit 1
  fi
done

# Detect a JS runtime: prefer bun, fall back to node, auto-install bun if neither found.
detect_or_install_runtime() {
  if command -v bun >/dev/null 2>&1; then
    echo "bun"
    return 0
  fi
  if command -v node >/dev/null 2>&1; then
    echo "node"
    return 0
  fi
  # Neither found — install bun automatically (single static binary, no root needed).
  echo "Agent Buccet: neither bun nor node found. Installing bun automatically..." >&2
  if ! curl -fsSL https://bun.sh/install | sh >/dev/null 2>&1; then
    echo "Agent Buccet: automatic bun install failed. Install node or bun and retry." >&2
    exit 1
  fi
  # Add bun to PATH for the rest of this session.
  BUN_BIN="$HOME/.bun/bin"
  if [ -x "$BUN_BIN/bun" ]; then
    export PATH="$BUN_BIN:$PATH"
    echo "bun"
    return 0
  fi
  echo "Agent Buccet: bun installed but not found at $BUN_BIN/bun. Add ~/.bun/bin to PATH and retry." >&2
  exit 1
}

BUCCET_RUNTIME=$(detect_or_install_runtime)

TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/agent-buccet-hosted-install.XXXXXX")
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

MANIFEST_PATH="$TMP_ROOT/latest.json"
ARCHIVE_PATH="$TMP_ROOT/agent-buccet.tar.gz"

curl -fsSL "$MANIFEST_URL" -o "$MANIFEST_PATH"

VERSION=$("$BUCCET_RUNTIME" -e '
  const fs = require("node:fs");
  const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(manifest.version || "");
' "$MANIFEST_PATH")

SHA256=$("$BUCCET_RUNTIME" -e '
  const fs = require("node:fs");
  const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(manifest.sha256 || "");
' "$MANIFEST_PATH")

ARCHIVE_URL=$("$BUCCET_RUNTIME" -e '
  const fs = require("node:fs");
  const manifestUrl = process.argv[2];
  const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!manifest.archive) {
    throw new Error("manifest is missing archive");
  }
  process.stdout.write(new URL(manifest.archive, manifestUrl).toString());
' "$MANIFEST_PATH" "$MANIFEST_URL")

curl -fsSL "$ARCHIVE_URL" -o "$ARCHIVE_PATH"

"$BUCCET_RUNTIME" -e '
  const fs = require("node:fs");
  const crypto = require("node:crypto");
  const expected = process.argv[2];
  const actual = crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex");
  if (expected && actual !== expected) {
    console.error(`sha256 mismatch: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
' "$ARCHIVE_PATH" "$SHA256"

tar -xzf "$ARCHIVE_PATH" -C "$TMP_ROOT"
PACKAGE_ROOT="$TMP_ROOT/agent-buccet"

if [ ! -f "$PACKAGE_ROOT/install.sh" ]; then
  echo "hosted package is missing install.sh" >&2
  exit 1
fi

AGENT_BUCCET_HOME="$BUCCET_HOME" AGENT_BUCCET_LAUNCHER_DIR="$LAUNCHER_DIR" AGENT_BUCCET_RUNTIME="$BUCCET_RUNTIME" sh "$PACKAGE_ROOT/install.sh"

if [ "$AUTO_INIT" = "1" ]; then
  LAUNCHER_PATH="$LAUNCHER_DIR/buccet"
  AGENT_BUCCET_HOME="$BUCCET_HOME" AGENT_BUCCET_LAUNCHER_PATH="$LAUNCHER_PATH" "$LAUNCHER_PATH" init --no-default-scope >/dev/null
fi

printf '%s\n' \
  "Agent Buccet is now protecting your system." \
  "version: ${VERSION:-unknown}" \
  "home: $BUCCET_HOME" \
  "launcher: $LAUNCHER_DIR/buccet" \
  "start: buccet console"
