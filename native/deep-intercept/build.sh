#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUT_DIR=${1:-"$SCRIPT_DIR/build"}
CC_BIN=${CC:-cc}

mkdir -p "$OUT_DIR"

case "$(uname -s)" in
  Darwin)
    OUT_LIB="$OUT_DIR/libbuccet-hook.dylib"
    exec "$CC_BIN" -dynamiclib -fPIC -o "$OUT_LIB" "$SCRIPT_DIR/gravity.c" -ldl
    ;;
  *)
    OUT_LIB="$OUT_DIR/libbuccet-hook.so"
    exec "$CC_BIN" -shared -fPIC -o "$OUT_LIB" "$SCRIPT_DIR/gravity.c" -ldl
    ;;
esac
