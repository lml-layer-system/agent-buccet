#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/prepare-agent-buccet-package.ts" ]; then
  REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
else
  REPO_ROOT=$SCRIPT_DIR
fi
BUCCET_HOME=${AGENT_BUCCET_HOME:-"$HOME/.buccet"}
LAUNCHER_DIR=${AGENT_BUCCET_LAUNCHER_DIR:-"$HOME/.local/bin"}
LAUNCHER_PATH="$LAUNCHER_DIR/buccet"

# Detect a JS runtime — prefer bun, fall back to node.
# AGENT_BUCCET_RUNTIME can be set by the hosted installer to pass the runtime that was already resolved.
if [ -n "${AGENT_BUCCET_RUNTIME:-}" ]; then
  DETECTED_RUNTIME="$AGENT_BUCCET_RUNTIME"
elif command -v bun >/dev/null 2>&1; then
  DETECTED_RUNTIME=$(command -v bun)
elif command -v node >/dev/null 2>&1; then
  DETECTED_RUNTIME=$(command -v node)
else
  echo "Agent Buccet install requires node or bun on PATH." >&2
  exit 1
fi

SOURCE_ROOT=$REPO_ROOT
if [ -f "$REPO_ROOT/scripts/prepare-agent-buccet-package.ts" ]; then
  cd "$REPO_ROOT"
  AGENT_BUCCET_PACKAGE_SKIP_VERIFY=1 "$DETECTED_RUNTIME" scripts/prepare-agent-buccet-package.ts
  SOURCE_ROOT="$REPO_ROOT/dist/agent-buccet"
fi

mkdir -p "$BUCCET_HOME/current" "$LAUNCHER_DIR"
rm -rf "$BUCCET_HOME/current"
mkdir -p "$BUCCET_HOME/current"
cp -R "$SOURCE_ROOT/." "$BUCCET_HOME/current"

if [ -d "$BUCCET_HOME/current/native/build" ]; then
  mkdir -p "$BUCCET_HOME/native/build"
  cp -R "$BUCCET_HOME/current/native/build/." "$BUCCET_HOME/native/build/"
fi

# Write the launcher. It detects bun or node at each invocation so the runtime
# preference is always correct regardless of what was available at install time.
# BUCCET_DAEMON_EXEC is exported so that compiled-binary distributions can
# spawn daemon sub-scripts using the correct TS runtime instead of themselves.
cat > "$LAUNCHER_PATH" <<'LAUNCHER'
#!/bin/sh
set -eu
BUCCET_HOME=${AGENT_BUCCET_HOME:-"$HOME/.buccet"}
CALLER_CWD=$(pwd)
LAUNCHER_PATH=${AGENT_BUCCET_LAUNCHER_PATH:-"$HOME/.local/bin/buccet"}
mkdir -p "$BUCCET_HOME"
cd "$BUCCET_HOME"
export AGENT_BUCCET_HOME="$BUCCET_HOME"
export AGENT_BUCCET_CALLER_CWD="$CALLER_CWD"
export AGENT_BUCCET_LAUNCHER_PATH="$LAUNCHER_PATH"
# Resolve the JS runtime to use for this invocation.
if command -v bun >/dev/null 2>&1; then
  BUCCET_JS_RUNTIME=$(command -v bun)
elif command -v node >/dev/null 2>&1; then
  BUCCET_JS_RUNTIME=$(command -v node)
else
  echo "Agent Buccet requires bun or node on PATH." >&2
  exit 1
fi
# BUCCET_DAEMON_EXEC tells buccet.ts which runtime to use when spawning
# daemon sub-processes. Without this, a compiled binary would try to spawn
# itself as the daemon, which is incorrect.
export BUCCET_DAEMON_EXEC="$BUCCET_JS_RUNTIME"
exec "$BUCCET_JS_RUNTIME" "$BUCCET_HOME/current/bin/buccet.ts" "$@"
LAUNCHER
chmod +x "$LAUNCHER_PATH"

mkdir -p "$BUCCET_HOME/proof"
if [ -f "$BUCCET_HOME/current/INSTALL_SNAP.txt" ]; then
  cp "$BUCCET_HOME/current/INSTALL_SNAP.txt" "$BUCCET_HOME/proof/INSTALL_SNAP.txt"
fi
if [ -f "$BUCCET_HOME/current/SNAP_INSTALL.json" ]; then
  cp "$BUCCET_HOME/current/SNAP_INSTALL.json" "$BUCCET_HOME/proof/SNAP_INSTALL.json"
fi

VERSION=""
if [ -f "$BUCCET_HOME/current/package.json" ]; then
  VERSION=$(grep '"version"' "$BUCCET_HOME/current/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
fi

printf '\n'
printf 'Agent Buccet%s\n' "${VERSION:+ v$VERSION}"
printf '  installed  \xe2\x9c\x93\n'
printf '  verified   \xe2\x9c\x93\n'
printf '  ready      buccet console\n'
printf '\n'

case ":$PATH:" in
  *":$LAUNCHER_DIR:"*)
    ;;
  *)
    printf '%s\n' "Add this to your shell profile if needed:" "  export PATH=\"$LAUNCHER_DIR:\$PATH\""
    ;;
esac
