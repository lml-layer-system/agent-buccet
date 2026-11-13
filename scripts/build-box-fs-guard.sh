#!/bin/sh
# Native POSIX filesystem actuator. No automatic fallback if this build fails.
set -eu
if [ "$(uname -s)" = "Linux" ] || [ "$(uname -s)" = "Darwin" ]; then
  mkdir -p native/build
  "${CC:-cc}" -std=c11 -O2 -Wall -Wextra -Werror -D_FILE_OFFSET_BITS=64 \
    native/box-fs-guard.c -o native/build/box-fs-guard
  test -x native/build/box-fs-guard
else
  echo "No confined filesystem actuator backend for this OS; filesystem tools must deny" >&2
  exit 1
fi
