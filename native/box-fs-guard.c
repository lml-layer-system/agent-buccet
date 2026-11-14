#define _GNU_SOURCE
#define _POSIX_C_SOURCE 200809L
/*
 * Expose BSD extensions (notably O_NOFOLLOW) on macOS/BSD. Without this, the
 * _POSIX_C_SOURCE define above puts clang in strict-POSIX mode under -std=c11
 * and hides O_NOFOLLOW, so this guard fails to compile on the macOS DMG build.
 * Ignored by glibc, so Linux is unaffected.
 */
#define _DARWIN_C_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

/*
 * Agent Buccet confined filesystem actuator (POSIX).
 *
 * Trusted caller supplies an existing authorized root and lexical relative
 * path. Every component is opened relative to an already-pinned directory fd;
 * symlinks cannot be followed. Existing multiply linked regular files are
 * rejected. Writes/appends commit by renameat of a fresh private inode,
 * never by truncating/appending to a potentially shared inode.
 *
 * This is an actuator, not a second policy engine or system-wide sandbox.
 */
static void fail(const char *message) {
  int saved = errno;
  if (saved) fprintf(stderr, "BUCCET_FS_DENIED: %s (%s)\n", message, strerror(saved));
  else fprintf(stderr, "BUCCET_FS_DENIED: %s\n", message);
  exit(73);
}
/*
 * Once a directory entry has changed, an I/O error cannot safely be
 * represented as "denied/no effect". The effect may exist but may not survive
 * power loss. The caller must receive an explicit UNCERTAIN outcome and must
 * not blindly retry a non-idempotent operation.
 */
static void commit_uncertain(const char *message) {
  int saved = errno;
  if (saved) fprintf(stderr, "BUCCET_FS_COMMIT_UNCERTAIN: %s (%s)\n", message, strerror(saved));
  else fprintf(stderr, "BUCCET_FS_COMMIT_UNCERTAIN: %s\n", message);
  exit(74);
}
static void sync_directory_after_mutation(int fd) {
  if (fsync(fd) < 0) commit_uncertain("cannot durably sync changed directory");
}
/*
 * Structural boundary: this native helper must never run as a same-UID agent
 * on an attacker-writable namespace. Only the independently privileged,
 * root-owned broker can enter the execution path. A valid fd alone does not
 * prevent a different same-UID process from renaming its directory.
 *
 * BUCCET_INSECURE_TEST_ONLY deliberately compiles the historical vulnerable
 * behavior for a disposable red-team control. NEVER enable it in a release.
 */
static void require_protected_executor(void) {
#ifndef BUCCET_INSECURE_TEST_ONLY
  if (geteuid() != 0) {
    errno = EPERM; fail("native effects require an independent privileged broker");
  }
#endif
}
static void require_protected_directory(int fd) {
#ifndef BUCCET_INSECURE_TEST_ONLY
  struct stat st;
  if (fstat(fd, &st) < 0) fail("cannot verify protected directory identity");
  if (!S_ISDIR(st.st_mode) || st.st_uid != 0 || (st.st_mode & 0022) != 0) {
    errno = EPERM; fail("untrusted or writable filesystem namespace");
  }
#else
  (void)fd;
#endif
}
static void require_protected_regular_file(const struct stat *st) {
#ifndef BUCCET_INSECURE_TEST_ONLY
  if (st->st_uid != 0 || (st->st_mode & 0022) != 0) {
    errno = EPERM; fail("target file is mutable by an untrusted OS principal");
  }
#else
  (void)st;
#endif
}
static void check_component(const char *piece) {
  if (!piece || !piece[0] || !strcmp(piece, ".") || !strcmp(piece, "..") || strchr(piece, '/')) {
    errno = EINVAL; fail("invalid path component");
  }
}
static void write_all(int fd, const void *data, size_t length) {
  const char *buf = (const char *)data;
  while (length > 0) {
    ssize_t n = write(fd, buf, length);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) fail("write failed");
    buf += n; length -= (size_t)n;
  }
}
static void copy_stream(int from, int to) {
  char buf[65536];
  for (;;) {
    ssize_t n = read(from, buf, sizeof(buf));
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) fail("read failed");
    if (n == 0) return;
    write_all(to, buf, (size_t)n);
  }
}
static int directory_root(const char *absolute) {
  if (!absolute || absolute[0] != '/') { errno = EINVAL; fail("root must be absolute"); }
  /*
   * The authorized root is the trust boundary and may legitimately be reached
   * through symlinked system directories (notably on macOS, where /tmp, /var
   * and /etc are symlinks into /private, so every mktemp/app temp scope lives
   * under a symlinked ancestor). Canonicalize the root once, then re-verify
   * every component of the RESOLVED path with O_NOFOLLOW below.
   *
   * This only resolves symlinks on the path TO the operator-authorized root.
   * Confinement of the attacker-controlled relative path (parent_from_root) is
   * unchanged and still refuses to follow any symlink inside the scope, so the
   * leaf/hardlink/ancestor-substitution defenses are untouched.
   */
  char resolved[PATH_MAX];
  if (!realpath(absolute, resolved)) fail("scope root missing or unreadable");
  int fd = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0) fail("cannot open filesystem root");
  require_protected_directory(fd);
  char *copy = strdup(resolved + 1);
  if (!copy) fail("out of memory");
  char *save = NULL;
  for (char *piece = strtok_r(copy, "/", &save); piece; piece = strtok_r(NULL, "/", &save)) {
    check_component(piece);
    int next = openat(fd, piece, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) fail("scope root has missing or symlinked directory");
    require_protected_directory(next);
    close(fd); fd = next;
  }
  free(copy);
  return fd;
}
/* Caller owns returned parent fd and leaf name. */
static int parent_from_root(int rootfd, const char *relative, int create, char **leaf) {
  if (!relative || !relative[0] || relative[0] == '/' || strstr(relative, "//") || relative[strlen(relative)-1] == '/') {
    errno = EINVAL; fail("invalid relative path");
  }
  int fd = dup(rootfd);
  if (fd < 0) fail("cannot pin authorized root");
  require_protected_directory(fd);
  char *copy = strdup(relative);
  if (!copy) fail("out of memory");
  char *save = NULL;
  char *piece = strtok_r(copy, "/", &save);
  while (piece) {
    check_component(piece);
    char *nextPiece = strtok_r(NULL, "/", &save);
    if (!nextPiece) { *leaf = strdup(piece); if (!*leaf) fail("out of memory"); free(copy); return fd; }
    int next = openat(fd, piece, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0 && errno == ENOENT && create) {
      int made = mkdirat(fd, piece, 0700);
      if (made < 0 && errno != EEXIST) fail("cannot create authorized subdirectory");
      if (made == 0) sync_directory_after_mutation(fd);
      next = openat(fd, piece, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    }
    if (next < 0) fail("symlinked, missing, or inaccessible parent directory");
    require_protected_directory(next);
    close(fd); fd = next; piece = nextPiece;
  }
  errno = EINVAL; fail("relative path is empty"); return -1;
}
static void regular_unique(int fd) {
  struct stat st;
  if (fstat(fd, &st) < 0) fail("cannot inspect target inode");
  if (!S_ISREG(st.st_mode) || st.st_nlink != 1) {
    errno = EPERM; fail("target is not a unique regular file");
  }
  require_protected_regular_file(&st);
}
static void check_existing_target(int parent, const char *leaf) {
  struct stat st;
  if (fstatat(parent, leaf, &st, AT_SYMLINK_NOFOLLOW) < 0) {
    if (errno == ENOENT) return;
    fail("cannot inspect target entry");
  }
  if (!S_ISREG(st.st_mode) || st.st_nlink != 1) {
    errno = EPERM; fail("target entry is linked, shared, or nonregular");
  }
  require_protected_regular_file(&st);
}
static int private_temp(int parent, char *name, size_t nameSize) {
  for (unsigned int attempt = 0; attempt < 10000; attempt++) {
    snprintf(name, nameSize, ".buccet-fs-%ld-%u", (long)getpid(), attempt);
    int fd = openat(parent, name, O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW | O_CLOEXEC, 0600);
    if (fd >= 0) return fd;
    if (errno != EEXIST) fail("cannot create confined temporary file");
  }
  errno = EEXIST; fail("temporary filename exhausted"); return -1;
}
static void move_regular(int srcParent, const char *srcLeaf, int dstParent, const char *dstLeaf) {
  int src = openat(srcParent, srcLeaf, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (src < 0) fail("source missing or symlinked");
  regular_unique(src);
  close(src);
  check_existing_target(dstParent, dstLeaf);
  if (renameat(srcParent, srcLeaf, dstParent, dstLeaf) < 0) fail("confined rename failed");
  /* A cross-directory move mutates TWO directory entries. */
  sync_directory_after_mutation(dstParent);
  sync_directory_after_mutation(srcParent);
}
int main(int argc, char **argv) {
  if (argc < 4 || argc > 6) { errno = EINVAL; fail("usage: guard OP ROOT RELATIVE [DEST_ROOT DEST_RELATIVE]"); }
  require_protected_executor();
  const char *op = argv[1];
  int root = directory_root(argv[2]);
  char *leaf = NULL;
  int parent = parent_from_root(root, argv[3], !strcmp(op,"write") || !strcmp(op,"mkdir"), &leaf);
  close(root);
  if (!strcmp(op,"read")) {
    int input = openat(parent, leaf, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
    if (input < 0) fail("read target missing or symlinked");
    regular_unique(input);
    copy_stream(input, STDOUT_FILENO); close(input);
  } else if (!strcmp(op,"write") || !strcmp(op,"append")) {
    int append = !strcmp(op,"append");
    int original = -1;
    if (append) {
      original = openat(parent, leaf, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
      if (original < 0) fail("append target missing or symlinked");
      regular_unique(original);
    }
    check_existing_target(parent, leaf);
    char tmp[96];
    int destination = private_temp(parent, tmp, sizeof(tmp));
    if (append) { copy_stream(original, destination); close(original); }
    copy_stream(STDIN_FILENO, destination);
    if (fsync(destination) < 0) fail("cannot fsync confined output");
    if (close(destination) < 0) fail("cannot close confined output");
    /* Rename changes ONLY this pinned directory entry; it does not write
       through any substituted symlink or hardlink inode. */
    if (renameat(parent, tmp, parent, leaf) < 0) fail("cannot commit confined output");
    sync_directory_after_mutation(parent);
  } else if (!strcmp(op,"delete")) {
    check_existing_target(parent, leaf);
    if (unlinkat(parent, leaf, 0) < 0) fail("cannot unlink confined entry");
    sync_directory_after_mutation(parent);
  } else if (!strcmp(op,"mkdir")) {
    int created = mkdirat(parent, leaf, 0700);
    if (created < 0 && errno != EEXIST) fail("cannot mkdir under confined root");
    if (created == 0) sync_directory_after_mutation(parent);
    int opened = openat(parent, leaf, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (opened < 0) fail("created directory was substituted");
    close(opened);
  } else if (!strcmp(op,"move")) {
    if (argc != 6) { errno = EINVAL; fail("move requires destination root and relative path"); }
    int dstRoot = directory_root(argv[4]);
    char *dstLeaf = NULL;
    int dstParent = parent_from_root(dstRoot, argv[5], 1, &dstLeaf);
    move_regular(parent, leaf, dstParent, dstLeaf);
    close(dstRoot); close(dstParent); free(dstLeaf);
  } else {
    errno = EINVAL; fail("unrecognized operation");
  }
  close(parent); free(leaf);
  return 0;
}
