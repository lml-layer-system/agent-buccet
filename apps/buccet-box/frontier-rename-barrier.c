#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

/*
 * TEST ONLY: create a deterministic barrier immediately before the REAL
 * confined actuator's renameat syscall. This shared library is not shipped.
 * The attacker modifies disposable filesystem entries while the guard waits.
 *
 * LD_PRELOAD is used only for the standalone adversarial test child, never
 * for production Buccet or the ordinary MCP executor.
 */
int renameat(int olddirfd, const char *oldpath, int newdirfd, const char *newpath) {
  static int (*real_renameat)(int, const char *, int, const char *) = NULL;
  if (!real_renameat) {
    *(void **)(&real_renameat) = dlsym(RTLD_NEXT, "renameat");
    if (!real_renameat) _exit(88);
  }
  const char *gate = getenv("BUCCET_TEST_RENAME_GATE");
  const char *prefix = getenv("BUCCET_TEST_OLD_PREFIX");
  if (gate && *gate && (!prefix || !*prefix || strncmp(oldpath, prefix, strlen(prefix)) == 0)) {
    char ready[4096], release[4096];
    if (snprintf(ready, sizeof(ready), "%s/ready", gate) >= (int)sizeof(ready) ||
        snprintf(release, sizeof(release), "%s/release", gate) >= (int)sizeof(release)) _exit(89);
    int marker = open(ready, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
    if (marker >= 0) {
      (void)write(marker, oldpath, strlen(oldpath));
      close(marker);
    } else if (errno != EEXIST) {
      _exit(90);
    }
    struct timespec pause = { .tv_sec = 0, .tv_nsec = 10000000 };
    for (int i = 0; i < 1500; i++) {
      if (access(release, F_OK) == 0) break;
      nanosleep(&pause, NULL);
      if (i == 1499) _exit(91);
    }
  }
  return real_renameat(olddirfd, oldpath, newdirfd, newpath);
}
