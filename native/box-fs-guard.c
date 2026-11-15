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
#include <dirent.h>
#include <fcntl.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/file.h>
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
/*
 * Staged writes are not published until renameat. Failures before that point
 * must remove the private inode, including its sensitive staged bytes.
 * The parent descriptor remains pinned and root-locked for this entire phase.
 * SIGKILL cannot run this handler; orphaned crash-state cleanup is a separate
 * recovery obligation, not falsely claimed here.
 */
static int staged_parent = -1;
static char staged_name[96];
/*
 * Only freshly created MOVE destination parents are owned by this tentative
 * transaction. Keep their pinned parent fds and exact entry names, reverse
 * ordered; a precommit native failure can then remove only empty directories
 * allocated by THIS move. Never delete unknown or nonempty directories.
 * SIGKILL still needs separate durable recovery; it cannot invoke handlers.
 */
struct move_created_parent {
  int parent;
  char *name;
  struct move_created_parent *previous;
};
static struct move_created_parent *move_created = NULL;
static int track_move_parents = 0;
static int move_published = 0;
/* One durable move intent per protected root, serialized by its kernel flock. */
#define MOVE_INTENT ".buccet-move-intent"
#define MOVE_INTENT_TEMP ".buccet-move-intent.tmp"
#define MOVE_MAGIC "BUCCET_MOVE_V1"
static int move_intent_root = -1;
static int move_intent_active = 0;
static int clear_move_intent(void) {
  if (!move_intent_active) return 0;
  if (unlinkat(move_intent_root, MOVE_INTENT, 0) < 0 && errno != ENOENT)
    return -1;
  if (fsync(move_intent_root) < 0) return -1;
  move_intent_active = 0;
  return 0;
}
static int rollback_uncommitted_move_parents(void) {
  if (move_published) return 0;
  while (move_created) {
    struct move_created_parent *entry = move_created;
    if (unlinkat(entry->parent, entry->name, AT_REMOVEDIR) < 0 &&
        errno != ENOENT) return -1;
    if (fsync(entry->parent) < 0) return -1;
    move_created = entry->previous;
    close(entry->parent);
    free(entry->name);
    free(entry);
  }
  return 0;
}
static int cleanup_failed_stage(void) {
  if (staged_parent < 0 || !staged_name[0]) return 0;
  if (unlinkat(staged_parent, staged_name, 0) < 0 && errno != ENOENT) return -1;
  staged_name[0] = '\0';
  if (fsync(staged_parent) < 0) return -1;
  staged_parent = -1;
  return 0;
}
static void fail(const char *message) {
  int saved = errno;
  int cleanup_error = 0;
  if (cleanup_failed_stage() < 0) cleanup_error = errno;
  if (rollback_uncommitted_move_parents() < 0 && !cleanup_error)
    cleanup_error = errno;
  if (!cleanup_error && !move_published && clear_move_intent() < 0)
    cleanup_error = errno;
  if (cleanup_error) {
    fprintf(stderr, "BUCCET_FS_COMMIT_UNCERTAIN: tentative resource rollback not durable (%s)\n",
      strerror(cleanup_error));
    exit(74);
  }
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
  // An EIO while synchronizing newly allocated destination ancestry occurs
  // before native rename. Attempt precise rollback, but keep the receipt
  // UNCERTAIN: the kernel may not have persisted either metadata transition.
  if (track_move_parents && !move_published) {
    if (rollback_uncommitted_move_parents() == 0)
      (void)clear_move_intent();
  }
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
  // Internal private temp names are never valid agent/operator path targets.
  // This reservation makes crash-recovery sweeping unambiguous.
  if (strncmp(piece, ".buccet-fs-", 11) == 0 ||
      strcmp(piece, ".buccet-host-nonces") == 0 ||
      strcmp(piece, MOVE_INTENT) == 0 ||
      strcmp(piece, MOVE_INTENT_TEMP) == 0) {
    errno = EINVAL; fail("reserved private native or host-replay component");
  }
}
/*
 * A rejected relative path must have ZERO native effects. Parsing and
 * validating one component at a time while mkdirat(create=1) runs can create
 * a protected intermediate directory before a later ".." or reserved
 * component fails. Preflight EVERY component before opening or creating
 * ANY part of the requested path.
 */
static void preflight_relative_path(const char *relative) {
  if (!relative || !relative[0] || relative[0] == '/' ||
      strstr(relative, "//") || relative[strlen(relative) - 1] == '/') {
    errno = EINVAL; fail("invalid relative path");
  }
  char *copy = strdup(relative);
  if (!copy) fail("out of memory");
  char *save = NULL;
  for (char *piece = strtok_r(copy, "/", &save); piece;
       piece = strtok_r(NULL, "/", &save)) {
    check_component(piece);
  }
  free(copy);
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
static struct move_created_parent *prepare_move_parent(int parent, const char *name) {
  if (!track_move_parents) return NULL;
  struct move_created_parent *entry = calloc(1, sizeof(*entry));
  if (!entry) fail("cannot allocate move rollback record");
  entry->parent = dup(parent);
  if (entry->parent < 0) {
    free(entry); fail("cannot pin move destination rollback parent");
  }
  entry->name = strdup(name);
  if (!entry->name) {
    close(entry->parent); free(entry);
    fail("cannot retain exact created destination directory name");
  }
  return entry;
}
static void discard_move_parent(struct move_created_parent *entry) {
  if (!entry) return;
  close(entry->parent);
  free(entry->name);
  free(entry);
}
/* Caller owns returned parent fd and leaf name. */
static int parent_from_root(int rootfd, const char *relative, int create, char **leaf) {
  preflight_relative_path(relative);
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
      struct move_created_parent *owned = prepare_move_parent(fd, piece);
      int made = mkdirat(fd, piece, 0700);
      int create_error = errno;
      if (made == 0 && owned) {
        owned->previous = move_created;
        move_created = owned;
      } else {
        discard_move_parent(owned);
      }
      if (made < 0 && create_error != EEXIST) {
        errno = create_error;
        fail("cannot create authorized subdirectory");
      }
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

/*
 * G06 crash-durable intent protocol for moves that create destination
 * ancestry. The root flock excludes concurrent cooperating guard generations.
 * The intent is fully fsynced and published BEFORE any destination mkdirat.
 * SIGKILL during journal preparation leaves only a disposable .tmp file.
 * Recovery never removes preexisting directories: first_created is the exact
 * first absent destination ancestor, recorded before mkdir under the lock.
 *
 * This protocol covers SAME-ROOT moves only when creating ancestry. A move
 * across two distinct roots with missing destination parents is refused until
 * a cross-root locking and durable journal protocol is established.
 */
struct move_intent_record {
  char magic[24];
  char source[PATH_MAX];
  char dest_root[PATH_MAX];
  char destination[PATH_MAX];
  char first_created[PATH_MAX];
  uint64_t source_device;
  uint64_t source_inode;
};
static void intent_string(char *out, size_t capacity, const char *value) {
  if (!value || strlen(value) >= capacity) {
    errno = ENAMETOOLONG; fail("move intent path exceeds durable record bounds");
  }
  memcpy(out, value, strlen(value) + 1);
}
static char *first_missing_move_parent(int dstRoot, const char *relative) {
  preflight_relative_path(relative);
  int fd = dup(dstRoot);
  if (fd < 0) fail("cannot pin destination root during move preflight");
  char *copy = strdup(relative);
  if (!copy) fail("cannot allocate destination preflight");
  char built[PATH_MAX] = "";
  char *save = NULL;
  char *piece = strtok_r(copy, "/", &save);
  while (piece) {
    char *nextPiece = strtok_r(NULL, "/", &save);
    if (!nextPiece) break; /* leaf is not a parent */
    size_t used = strlen(built);
    int n = snprintf(built + used, sizeof(built) - used,
      "%s%s", used ? "/" : "", piece);
    if (n < 0 || (size_t)n >= sizeof(built) - used) {
      errno = ENAMETOOLONG; fail("destination ancestry exceeds journal bounds");
    }
    int next = openat(fd, piece, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) {
      if (errno != ENOENT) fail("move destination ancestry is unsafe");
      char *first = strdup(built);
      if (!first) fail("cannot retain first missing destination parent");
      close(fd); free(copy);
      return first;
    }
    require_protected_directory(next);
    close(fd); fd = next; piece = nextPiece;
  }
  close(fd); free(copy);
  return NULL;
}
static int protected_path_status(int rootfd, const char *relative, int directory,
                                 struct stat *identity) {
  preflight_relative_path(relative);
  int fd = dup(rootfd);
  if (fd < 0) fail("cannot pin recovery path root");
  char *copy = strdup(relative);
  if (!copy) fail("cannot allocate recovery path");
  char *save = NULL;
  char *piece = strtok_r(copy, "/", &save);
  while (piece) {
    char *nextPiece = strtok_r(NULL, "/", &save);
    int flags = O_RDONLY | O_NOFOLLOW | O_CLOEXEC;
    if (nextPiece || directory) flags |= O_DIRECTORY;
    else flags |= O_NONBLOCK;
    int next = openat(fd, piece, flags);
    if (next < 0 && errno == ENOENT) {
      close(fd); free(copy); return 0;
    }
    if (next < 0) fail("unsafe or inaccessible move recovery path");
    if (nextPiece || directory) require_protected_directory(next);
    else regular_unique(next);
    close(fd); fd = next; piece = nextPiece;
  }
  if (identity && fstat(fd, identity) < 0)
    fail("cannot verify recovered move inode identity");
  close(fd); free(copy);
  return 1;
}
static void publish_move_intent(int rootfd, const char *source,
                                const char *destRoot, const char *destination,
                                const char *firstCreated,
                                const struct stat *sourceIdentity) {
  struct move_intent_record record = {0};
  intent_string(record.magic, sizeof(record.magic), MOVE_MAGIC);
  intent_string(record.source, sizeof(record.source), source);
  char resolved[PATH_MAX];
  if (!realpath(destRoot, resolved))
    fail("cannot canonicalize move journal destination root");
  intent_string(record.dest_root, sizeof(record.dest_root), resolved);
  intent_string(record.destination, sizeof(record.destination), destination);
  intent_string(record.first_created, sizeof(record.first_created), firstCreated);
  record.source_device = (uint64_t)sourceIdentity->st_dev;
  record.source_inode = (uint64_t)sourceIdentity->st_ino;
  struct stat prior;
  if (fstatat(rootfd, MOVE_INTENT, &prior, AT_SYMLINK_NOFOLLOW) == 0) {
    errno = EEXIST; fail("prior move intent not reconciled");
  }
  if (errno != ENOENT) fail("cannot inspect prior move intent");
  int fd = openat(rootfd, MOVE_INTENT_TEMP,
    O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (fd < 0) fail("cannot reserve private move intent preparation");
  write_all(fd, &record, sizeof(record));
  if (fsync(fd) < 0) commit_uncertain("cannot durably write pre-create move intent");
  if (close(fd) < 0) commit_uncertain("cannot close durable move intent");
  if (renameat(rootfd, MOVE_INTENT_TEMP, rootfd, MOVE_INTENT) < 0)
    fail("cannot atomically publish move intent");
  move_intent_root = rootfd;
  move_intent_active = 1;
  if (fsync(rootfd) < 0)
    commit_uncertain("cannot durably publish pre-create move intent");
}
static void remove_recovery_move_parents(int dstRoot,
                                         const struct move_intent_record *record) {
  char *prefixes[PATH_MAX / 2] = {0};
  size_t count = 0;
  char built[PATH_MAX] = "";
  char *copy = strdup(record->destination);
  if (!copy) fail("cannot allocate move recovery ancestry");
  char *save = NULL;
  char *piece = strtok_r(copy, "/", &save);
  int found = 0;
  while (piece) {
    char *nextPiece = strtok_r(NULL, "/", &save);
    if (!nextPiece) break; /* final leaf is not a created directory */
    size_t used = strlen(built);
    int n = snprintf(built + used, sizeof(built) - used,
      "%s%s", used ? "/" : "", piece);
    if (n < 0 || (size_t)n >= sizeof(built) - used) {
      errno = ENAMETOOLONG; fail("recovery ancestry exceeds path bounds");
    }
    if (!strcmp(built, record->first_created)) found = 1;
    if (found) {
      if (count >= PATH_MAX / 2) {
        errno = ENAMETOOLONG; fail("recovery ancestry too deep");
      }
      prefixes[count] = strdup(built);
      if (!prefixes[count]) fail("cannot retain recovery directory identity");
      count++;
    }
    piece = nextPiece;
  }
  free(copy);
  if (!found) {
    errno = EINVAL; fail("move intent first-created path is not destination ancestry");
  }
  while (count) {
    char *relative = prefixes[--count];
    if (protected_path_status(dstRoot, relative, 1, NULL)) {
      char *leaf = NULL;
      int parent = parent_from_root(dstRoot, relative, 0, &leaf);
      if (unlinkat(parent, leaf, AT_REMOVEDIR) < 0)
        fail("cannot remove abandoned move-owned destination directory");
      sync_directory_after_mutation(parent);
      close(parent); free(leaf);
    }
    free(relative);
  }
}
static void recover_crashed_move(int rootfd) {
  /*
   * An incomplete temporary intent cannot have authorized any mkdir:
   * publish+fsync of the final intent is strictly before the first mkdir.
   */
  struct stat st;
  if (fstatat(rootfd, MOVE_INTENT_TEMP, &st, AT_SYMLINK_NOFOLLOW) == 0) {
    if (!S_ISREG(st.st_mode) || st.st_uid != 0 || st.st_nlink != 1 ||
        (st.st_mode & 07777) != 0600) {
      errno = EPERM; fail("unsafe incomplete move intent candidate");
    }
    if (unlinkat(rootfd, MOVE_INTENT_TEMP, 0) < 0)
      fail("cannot remove incomplete move intent");
    sync_directory_after_mutation(rootfd);
  } else if (errno != ENOENT) {
    fail("cannot inspect incomplete move intent");
  }
  if (fstatat(rootfd, MOVE_INTENT, &st, AT_SYMLINK_NOFOLLOW) < 0) {
    if (errno == ENOENT) return;
    fail("cannot inspect crash move intent");
  }
  if (!S_ISREG(st.st_mode) || st.st_uid != 0 || st.st_nlink != 1 ||
      (st.st_mode & 07777) != 0600 ||
      st.st_size != (off_t)sizeof(struct move_intent_record)) {
    errno = EPERM; fail("corrupt or unsafe durable move intent");
  }
  int fd = openat(rootfd, MOVE_INTENT, O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0) fail("cannot open durable move intent");
  struct move_intent_record record;
  size_t done = 0;
  while (done < sizeof(record)) {
    ssize_t n = read(fd, (char *)&record + done, sizeof(record) - done);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) fail("truncated durable move intent");
    done += (size_t)n;
  }
  close(fd);
  if (!memchr(record.magic, 0, sizeof(record.magic)) ||
      strcmp(record.magic, MOVE_MAGIC) ||
      !memchr(record.source, 0, sizeof(record.source)) ||
      !memchr(record.dest_root, 0, sizeof(record.dest_root)) ||
      !memchr(record.destination, 0, sizeof(record.destination)) ||
      !memchr(record.first_created, 0, sizeof(record.first_created))) {
    errno = EINVAL; fail("invalid durable move intent schema");
  }
  preflight_relative_path(record.source);
  preflight_relative_path(record.destination);
  preflight_relative_path(record.first_created);
  if (record.dest_root[0] != '/') {
    errno = EINVAL; fail("invalid durable move destination root");
  }
  struct stat sourceIdentity = {0}, destIdentity = {0};
  int sourcePresent = protected_path_status(rootfd, record.source, 0, &sourceIdentity);
  int dstRoot = directory_root(record.dest_root);
  struct stat rootIdentity, dstIdentity;
  if (fstat(rootfd, &rootIdentity) < 0 || fstat(dstRoot, &dstIdentity) < 0)
    fail("cannot verify recovery root identities");
  if (rootIdentity.st_dev != dstIdentity.st_dev ||
      rootIdentity.st_ino != dstIdentity.st_ino) {
    errno = EXDEV; fail("move journal recovery cannot cross independent roots");
  }
  int destinationPresent = protected_path_status(dstRoot, record.destination, 0, &destIdentity);
  if (sourcePresent && !destinationPresent) {
    if ((uint64_t)sourceIdentity.st_dev != record.source_device ||
        (uint64_t)sourceIdentity.st_ino != record.source_inode) {
      errno = EPERM; fail("move source inode changed after crash");
    }
    remove_recovery_move_parents(dstRoot, &record);
  } else if (!sourcePresent && destinationPresent) {
    if ((uint64_t)destIdentity.st_dev != record.source_device ||
        (uint64_t)destIdentity.st_ino != record.source_inode) {
      errno = EPERM; fail("published move destination inode identity mismatch");
    }
    char *srcLeaf = NULL, *dstLeaf = NULL;
    int srcParent = parent_from_root(rootfd, record.source, 0, &srcLeaf);
    int dstParent = parent_from_root(dstRoot, record.destination, 0, &dstLeaf);
    sync_directory_after_mutation(srcParent);
    sync_directory_after_mutation(dstParent);
    close(srcParent); close(dstParent); free(srcLeaf); free(dstLeaf);
  } else {
    errno = EPERM; fail("ambiguous move crash state; manual recovery required");
  }
  if (unlinkat(rootfd, MOVE_INTENT, 0) < 0)
    fail("cannot retire reconciled move intent");
  sync_directory_after_mutation(rootfd);
  close(dstRoot);
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
/*
 * A SIGKILL bypasses error handlers and leaves uncommitted private inodes.
 * The root-level kernel flock excludes concurrent cooperating native guards,
 * including old broker generations, so staged files in the pinned parent
 * matching this exact internal name grammar are abandoned by definition.
 * Never touch a nonregular, non-root-owned, linked or permissive entry.
 */
static int stage_name(const char *n) {
  const char *p = n;
  if (strncmp(p, ".buccet-fs-", 11) != 0) return 0;
  p += 11;
  if (*p < '0' || *p > '9') return 0;
  while (*p >= '0' && *p <= '9') p++;
  if (*p++ != '-') return 0;
  if (*p < '0' || *p > '9') return 0;
  while (*p >= '0' && *p <= '9') p++;
  return *p == '\0';
}
static void recover_crashed_staging(int parent) {
  int scanfd = dup(parent);
  if (scanfd < 0) fail("cannot inspect protected staging directory");
  DIR *d = fdopendir(scanfd);
  if (!d) { close(scanfd); fail("cannot open protected staging directory"); }
  struct dirent *entry;
  int removed = 0;
  errno = 0;
  while ((entry = readdir(d)) != NULL) {
    if (stage_name(entry->d_name)) {
      struct stat st;
      if (fstatat(parent, entry->d_name, &st, AT_SYMLINK_NOFOLLOW) < 0) {
        if (errno != ENOENT) fail("cannot inspect stale stage inode");
      } else {
        if (!S_ISREG(st.st_mode) || st.st_uid != 0 || st.st_nlink != 1 ||
            (st.st_mode & 0777) != 0600) {
          errno = EPERM; fail("unsafe private stage recovery candidate");
        }
        if (unlinkat(parent, entry->d_name, 0) < 0)
          fail("cannot remove abandoned root-only staging inode");
        removed++;
      }
    }
    errno = 0;
  }
  if (errno != 0) fail("cannot complete private staging scan");
  closedir(d);
  if (removed && fsync(parent) < 0)
    commit_uncertain("cannot durably reconcile crashed private staging");
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
  move_published = 1; // never roll back directories after publication
  /* A cross-directory move mutates TWO directory entries. */
  sync_directory_after_mutation(dstParent);
  sync_directory_after_mutation(srcParent);
}
int main(int argc, char **argv) {
  if (argc < 4 || argc > 6) { errno = EINVAL; fail("usage: guard OP ROOT RELATIVE [DEST_ROOT DEST_RELATIVE]"); }
  require_protected_executor();
  const char *op = argv[1];
  int root = directory_root(argv[2]);
  /*
   * A broker-local queue does not survive SIGKILL: its already-spawned C
   * guard can outlive the daemon and race a new daemon generation. Use an
   * inode-scoped KERNEL flock, shared by all native guard processes for this
   * root, from BEFORE reading the append base until AFTER durable commit.
   * This is advisory against root peers; the untrusted agent cannot mutate
   * this independently root-owned namespace or start the privileged guard.
   */
  if (flock(root, LOCK_EX) < 0) fail("cannot acquire protected root transaction lock");
  recover_crashed_move(root);
  char *leaf = NULL;
  int parent = parent_from_root(root, argv[3], !strcmp(op,"write") || !strcmp(op,"mkdir"), &leaf);
  /* A post-crash read/write is a recovery entrypoint, not merely a lookup. */
  recover_crashed_staging(parent);
  /* Keep root fd and its kernel lock open across the entire native effect. */
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
    staged_parent = parent;
    snprintf(staged_name, sizeof(staged_name), "%s", tmp);
    if (append) { copy_stream(original, destination); close(original); }
    copy_stream(STDIN_FILENO, destination);
    if (fsync(destination) < 0) fail("cannot fsync confined output");
    if (close(destination) < 0) fail("cannot close confined output");
    /* Rename changes ONLY this pinned directory entry; it does not write
       through any substituted symlink or hardlink inode. */
    if (renameat(parent, tmp, parent, leaf) < 0) fail("cannot commit confined output");
    // From here the file may be published. Never "roll back" by removing
    // a name whose inode was already renamed into the authorized destination.
    staged_name[0] = '\0';
    staged_parent = -1;
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
    // mkdirat(...)=EEXIST is not proof that the leaf is independently
    // protected: a preexisting 0777 or non-root-owned directory must NEVER
    // be blessed with a success receipt. Apply the same inode/rights check
    // used for every traversed protected parent, including on idempotent
    // mkdir operations.
    require_protected_directory(opened);
    close(opened);
  } else if (!strcmp(op,"move")) {
    if (argc != 6) { errno = EINVAL; fail("move requires destination root and relative path"); }
    /*
     * G06 prepare-before-allocation: parent_from_root(..., create=1) can
     * durably mkdir destination ancestry. Verify the source exists, is
     * nonsymlinked, root-owned and uniquely linked BEFORE that irreversible
     * preparatory effect. move_regular() re-verifies after destination
     * resolution; the root flock excludes cooperating broker generations.
     */
    preflight_relative_path(argv[5]);
    int verifiedSource = openat(parent, leaf,
      O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
    if (verifiedSource < 0) fail("move source missing or symlinked");
    regular_unique(verifiedSource);
    struct stat sourceIdentity;
    if (fstat(verifiedSource, &sourceIdentity) < 0)
      fail("cannot pin move source identity");
    close(verifiedSource);
    int dstRoot = directory_root(argv[4]);
    char *firstMissing = first_missing_move_parent(dstRoot, argv[5]);
    if (firstMissing) {
      struct stat srcRootIdentity, dstRootIdentity;
      if (fstat(root, &srcRootIdentity) < 0 ||
          fstat(dstRoot, &dstRootIdentity) < 0)
        fail("cannot verify same-root move journaling scope");
      if (srcRootIdentity.st_dev != dstRootIdentity.st_dev ||
          srcRootIdentity.st_ino != dstRootIdentity.st_ino) {
        errno = EXDEV;
        fail("cross-root move creating destination ancestry requires a separate lock protocol");
      }
      publish_move_intent(root, argv[3], argv[4], argv[5],
        firstMissing, &sourceIdentity);
      free(firstMissing);
    }
    char *dstLeaf = NULL;
    track_move_parents = 1;
    int dstParent = parent_from_root(dstRoot, argv[5], 1, &dstLeaf);
    move_regular(parent, leaf, dstParent, dstLeaf);
    track_move_parents = 0;
    if (clear_move_intent() < 0)
      commit_uncertain("cannot durably retire completed move intent");
    close(dstRoot); close(dstParent); free(dstLeaf);
  } else {
    errno = EINVAL; fail("unrecognized operation");
  }
  close(parent); free(leaf);
  close(root); /* release kernel lock only after the operation has finished */
  return 0;
}
