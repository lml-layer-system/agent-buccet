#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/*
 * Frontier03 TEST ONLY: root-owned adapter used by an actual broker process.
 * It execs the unchanged production C guard with a root-only fault interposer.
 * Never install as a normal shipped actuator or enable in production.
 */
#ifndef BUCCET_F03_REAL_GUARD
#error "test fixture requires pinned real guard path"
#endif
#ifndef BUCCET_F03_INTERPOSER
#error "test fixture requires root-owned syscall interposer path"
#endif
#ifndef BUCCET_F03_TRACE
#error "test fixture requires disposable trace path"
#endif
int main(int argc, char **argv) {
  if (argc < 4) return 81;
  if (setenv("LD_PRELOAD", BUCCET_F03_INTERPOSER, 1) != 0 ||
      setenv("BUCCET_F03_TRACE", BUCCET_F03_TRACE, 1) != 0) return 82;
  if (!strcmp(argv[1], "write")) {
    if (!strcmp(argv[3], "files/post-eio.txt")) {
      if (setenv("BUCCET_F03_DIR_FSYNC_EIO", "1", 1) != 0) return 83;
    } else if (!strcmp(argv[3], "files/post-crash.txt")) {
      if (setenv("BUCCET_F03_CRASH_RENAME", "after", 1) != 0) return 84;
    } else if (!strcmp(argv[3], "files/pre-eio.txt")) {
      if (setenv("BUCCET_F03_FILE_FSYNC_EIO", "1", 1) != 0) return 85;
    }
  }
  execv(BUCCET_F03_REAL_GUARD, argv);
  perror("exec real native guard");
  return 86;
}
