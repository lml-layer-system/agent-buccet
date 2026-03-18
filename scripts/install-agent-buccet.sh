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

if ! command -v node >/dev/null 2>&1; then
  echo "Agent Buccet install requires node on PATH." >&2
  exit 1
fi

cd "$REPO_ROOT"
node scripts/prepare-agent-buccet-package.ts

mkdir -p "$BUCCET_HOME/current" "$LAUNCHER_DIR"
rm -rf "$BUCCET_HOME/current"
mkdir -p "$BUCCET_HOME/current"
cp -R "$REPO_ROOT/dist/agent-buccet/." "$BUCCET_HOME/current"

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
exec node "$BUCCET_HOME/current/bin/buccet.ts" "$@"
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
