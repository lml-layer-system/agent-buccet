#!/bin/sh
#
# Build buccet-physwrap for the current platform.
#
# Platform dispatch:
#   Linux   → physwrap.c     (setrlimit + PR_CAPBSET_DROP)
#   Darwin  → physwrap_mac.c (setrlimit, no cap system)
#   MinGW / Cygwin / MSYS → physwrap_win.c (NT Job Objects, gcc)
#   Other   → exit 0, shell-ulimit fallback will be used
#
# For native Windows MSVC builds, use build_win.bat instead.
#
# Usage:
#   ./build.sh [OUT_DIR]
#
# OUT_DIR defaults to ./build
#
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUT_DIR=${1:-"$SCRIPT_DIR/build"}
CC_BIN=${CC:-cc}

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
      "$SCRIPT_DIR/physwrap_mac.c"
    ;;
  MINGW*|CYGWIN*|MSYS*)
    exec "$CC_BIN" \
      -O2 -Wall -Wextra \
      -o "${OUT_BIN}.exe" \
      "$SCRIPT_DIR/physwrap_win.c" \
      -lkernel32
    ;;
  *)
    echo "buccet-physwrap: unknown platform $(uname -s) — shell-ulimit fallback will be used" >&2
    exit 0
    ;;
esac
