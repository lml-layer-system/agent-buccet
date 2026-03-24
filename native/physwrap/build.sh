#!/bin/sh
#
# Build buccet-physwrap for the current platform.
#
# Usage:
#   ./build.sh [OUT_DIR]
#
# OUT_DIR defaults to ./build
# The resulting binary is buccet-physwrap (ELF on Linux, Mach-O on macOS).
# On Windows this script exits 0 without building (physwrap is not used there;
# process.ts falls back to the shell-ulimit path on win32).
#
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUT_DIR=${1:-"$SCRIPT_DIR/build"}
CC_BIN=${CC:-cc}

case "$(uname -s)" in
  MINGW*|CYGWIN*|MSYS*)
    echo "buccet-physwrap: Windows — physwrap not built; shell-ulimit fallback will be used" >&2
    exit 0
    ;;
esac

mkdir -p "$OUT_DIR"
OUT_BIN="$OUT_DIR/buccet-physwrap"

case "$(uname -s)" in
  Linux)
    exec "$CC_BIN" \
      -O2 -Wall -Wextra -pedantic \
      -D_POSIX_C_SOURCE=200809L \
      -o "$OUT_BIN" \
      "$SCRIPT_DIR/physwrap.c"
    ;;
  Darwin)
    exec "$CC_BIN" \
      -O2 -Wall -Wextra -pedantic \
      -o "$OUT_BIN" \
      "$SCRIPT_DIR/physwrap.c"
    ;;
  *)
    echo "buccet-physwrap: unknown platform $(uname -s) — shell-ulimit fallback will be used" >&2
    exit 0
    ;;
esac
