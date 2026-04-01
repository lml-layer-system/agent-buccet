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
  "$DETECTED_RUNTIME" scripts/prepare-agent-buccet-package.ts
  SOURCE_ROOT="$REPO_ROOT/dist/agent-buccet"
fi

mkdir -p "$BUCCET_HOME/current" "$LAUNCHER_DIR"
rm -rf "$BUCCET_HOME/current"
mkdir -p "$BUCCET_HOME/current"
cp -R "$SOURCE_ROOT/." "$BUCCET_HOME/current"

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

printf '%s\n' "Agent Buccet installed." \
  "home: $BUCCET_HOME" \
  "launcher: $LAUNCHER_PATH"

case ":$PATH:" in
  *":$LAUNCHER_DIR:"*)
    ;;
  *)
    printf '%s\n' "Add this to your shell profile if needed:" "  export PATH=\"$LAUNCHER_DIR:\$PATH\""
    ;;
esac
