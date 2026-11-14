#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

/*
 * Frontier03 TEST ONLY. Instrument the actual native guard's syscall boundary
 * without changing the shipped guard. Installed only under a disposable,
 * independently root-owned test root; not present in production.
 */
static void trace_event(const char *event) {
  const char *marker = getenv("BUCCET_F03_TRACE");
  if (!marker || !*marker) return;
  int fd = open(marker, O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC, 0600);
  if (fd < 0) _exit(88);
  size_t len = strlen(event);
  if (write(fd, event, len) != (ssize_t)len || write(fd, "\n", 1) != 1) _exit(89);
  close(fd);
}
static int target_count = 0;
int fsync(int fd) {
  static int (*real_fsync)(int) = NULL;
  if (!real_fsync) {
    *(void **)(&real_fsync) = dlsym(RTLD_NEXT, "fsync");
    if (!real_fsync) _exit(90);
  }
  struct stat st;
  if (fstat(fd, &st) == 0) {
    if (S_ISDIR(st.st_mode)) {
      target_count++;
      trace_event("fsync:directory");
      const char *fail_dir = getenv("BUCCET_F03_DIR_FSYNC_EIO");
      if (fail_dir && *fail_dir && atoi(fail_dir) == target_count) {
        errno = EIO;
        return -1;
      }
    } else if (S_ISREG(st.st_mode)) {
      trace_event("fsync:file");
      if (getenv("BUCCET_F03_FILE_FSYNC_EIO")) {
        errno = EIO;
        return -1;
      }
    }
  }
  return real_fsync(fd);
}
/*
 * Actual kernel's tiny-full-filesystem outcome, injected at the real write()
 * boundary of the shipped C guard. This does not emulate a real disk quota
 * or media power loss; it proves prepublication handling of ENOSPC.
 * Trace descriptors use O_APPEND, staging descriptors do not.
 */
ssize_t write(int fd, const void *buffer, size_t length) {
  static ssize_t (*real_write)(int, const void *, size_t) = NULL;
  if (!real_write) {
    *(void **)(&real_write) = dlsym(RTLD_NEXT, "write");
    if (!real_write) _exit(94);
  }
  if (fd > 2 && getenv("BUCCET_F03_WRITE_ENOSPC")) {
    const int flags = fcntl(fd, F_GETFL);
    struct stat st;
    if (flags >= 0 && (flags & O_ACCMODE) == O_WRONLY &&
        !(flags & O_APPEND) && fstat(fd, &st) == 0 && S_ISREG(st.st_mode)) {
      trace_event("write:ENOSPC");
      errno = ENOSPC;
      return -1;
    }
  }
  return real_write(fd, buffer, length);
}
int renameat(int oldfd, const char *oldname, int newfd, const char *newname) {
  static int (*real_renameat)(int, const char *, int, const char *) = NULL;
  if (!real_renameat) {
    *(void **)(&real_renameat) = dlsym(RTLD_NEXT, "renameat");
    if (!real_renameat) _exit(91);
  }
  trace_event("rename:before");
  const char *crash = getenv("BUCCET_F03_CRASH_RENAME");
  if (crash && strcmp(crash, "before") == 0) {
    raise(SIGKILL);
    _exit(92);
  }
  int result = real_renameat(oldfd, oldname, newfd, newname);
  if (result == 0) {
    trace_event("rename:after");
    if (crash && strcmp(crash, "after") == 0) {
      raise(SIGKILL);
      _exit(93);
    }
  }
  return result;
}
