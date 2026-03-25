/*
 * buccet-physwrap — Darwin/macOS Native Physics Translator
 *
 * Platform: Darwin (macOS)
 * Method:   POSIX setrlimit() — no shell, no capability system.
 *
 * macOS does not have the Linux capability model. There is no
 * CAP_SYS_RESOURCE to drop. The hard-limit == soft-limit constraint
 * (applied by this binary) is sufficient to prevent self-elevation
 * for unprivileged processes. Root processes can exceed POSIX rlimits
 * on Darwin regardless — a Darwin-native sandbox backend (App Sandbox /
 * launchd seatbelt-class) is the correct next-phase mechanism for
 * privileged containment. This is documented as a known gap.
 *
 * Supported limits on Darwin:
 *   RLIMIT_CPU    (--cpu N)      CPU time in seconds → SIGXCPU then SIGKILL
 *   RLIMIT_NOFILE (--nofile N)   Max open file descriptors → EMFILE
 *   RLIMIT_FSIZE  (--fsize-b N)  Max file size in bytes → 512-byte blocks → SIGXFSZ
 *
 * Accepted but NOT enforced on Darwin (silently skipped):
 *   --nproc N   (RLIMIT_NPROC — per-user on macOS, not per-process; unreliable)
 *   --as-kb N   (RLIMIT_AS   — not reliably enforced on Darwin)
 *
 * Usage:
 *   buccet-physwrap [--cpu N] [--nofile N] [--fsize-b N] [--nproc N] [--as-kb N] -- cmd [args...]
 *
 * Exit codes:
 *   1  argument error
 *   2  setrlimit failed
 *   4  exec failed
 *
 * Ledger visibility: caller (process.ts) records PROCESS_PHYSWRAP_ACTIVE
 * with physwrap_platform=macos when this binary is used.
 */

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <unistd.h>

/* ── Helpers ──────────────────────────────────────────────────────────────── */

static long parse_long(const char *s, const char *flag) {
    char *end;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (errno != 0 || *end != '\0' || end == s || v < 0) {
        fprintf(stderr, "buccet-physwrap(darwin): invalid value for %s: %s\n", flag, s);
        exit(1);
    }
    return v;
}

static int apply_rlimit(int resource, rlim_t val, const char *name) {
    struct rlimit rl;
    rl.rlim_cur = val;
    rl.rlim_max = val;  /* hard == soft: child cannot raise above this */
    if (setrlimit(resource, &rl) != 0) {
        fprintf(stderr, "buccet-physwrap(darwin): setrlimit(%s, %lu) failed: %s\n",
                name, (unsigned long)val, strerror(errno));
        return -1;
    }
    return 0;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

int main(int argc, char *argv[]) {
    long cpu_sec   = -1;
    long nofile    = -1;
    long fsize_b   = -1;
    int  separator = 0;

    int i;
    for (i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--") == 0) {
            separator = i;
            break;
        }
        if (strcmp(argv[i], "--cpu") == 0 && i + 1 < argc) {
            cpu_sec = parse_long(argv[++i], "--cpu");
        } else if (strcmp(argv[i], "--nofile") == 0 && i + 1 < argc) {
            nofile = parse_long(argv[++i], "--nofile");
        } else if (strcmp(argv[i], "--fsize-b") == 0 && i + 1 < argc) {
            fsize_b = parse_long(argv[++i], "--fsize-b");
        } else if (strcmp(argv[i], "--nproc") == 0 && i + 1 < argc) {
            ++i; /* accepted, not enforced on Darwin — skip value */
        } else if (strcmp(argv[i], "--as-kb") == 0 && i + 1 < argc) {
            ++i; /* accepted, not enforced on Darwin — skip value */
        } else {
            fprintf(stderr, "buccet-physwrap(darwin): unknown flag: %s\n", argv[i]);
            exit(1);
        }
    }

    if (separator == 0 || separator + 1 >= argc) {
        fprintf(stderr, "buccet-physwrap(darwin): missing -- <cmd> after flags\n");
        exit(1);
    }

    char **cmd = &argv[separator + 1];

    /*
     * ── setrlimit() ────────────────────────────────────────────────────────
     * hard == soft for all limits. Unprivileged child cannot raise the soft
     * limit above the hard. Root can exceed on Darwin — documented gap until
     * a seatbelt-class backend is implemented.
     */
    if (cpu_sec >= 0) {
        if (apply_rlimit(RLIMIT_CPU, (rlim_t)cpu_sec, "RLIMIT_CPU") != 0)
            exit(2);
    }

    if (nofile >= 0) {
        if (apply_rlimit(RLIMIT_NOFILE, (rlim_t)nofile, "RLIMIT_NOFILE") != 0)
            exit(2);
    }

    if (fsize_b >= 0) {
        /* RLIMIT_FSIZE unit = 512-byte blocks. Round up. */
        rlim_t blocks = ((rlim_t)fsize_b + 511UL) / 512UL;
        if (apply_rlimit(RLIMIT_FSIZE, blocks, "RLIMIT_FSIZE") != 0)
            exit(2);
    }

    /*
     * ── exec ───────────────────────────────────────────────────────────────
     * No shell interposition. physwrap process is replaced by the target.
     * The target inherits the rlimits we just set.
     */
    execvp(cmd[0], cmd);

    fprintf(stderr, "buccet-physwrap(darwin): exec '%s' failed: %s\n",
            cmd[0], strerror(errno));
    exit(4);
}
