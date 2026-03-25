/*
 * buccet-physwrap — Darwin/macOS Native Physics Translator
 *
 * Platform: Darwin (macOS)
 * Method:   POSIX setrlimit() + memorystatus_control (arm64 memory coverage) +
 *           setuid/setgid privilege drop. No shell, no capability system.
 *
 * macOS does not have the Linux capability model. There is no
 * CAP_SYS_RESOURCE to drop. The hard-limit == soft-limit constraint
 * (applied by this binary) is sufficient to prevent self-elevation
 * for unprivileged processes.
 *
 * Root privilege drop: when --uid / --gid are provided, physwrap calls
 * setgid() then setuid() AFTER applying rlimits and BEFORE execvp().
 * The target process runs as the specified uid/gid, not as root.
 * If physwrap is run as root without --uid, a warning is emitted to
 * stderr and execution continues — the caller is explicitly informed
 * of the missing drop.
 *
 * Without --uid drop, root processes can exceed POSIX rlimits on Darwin
 * (hard limit is advisory for root). The setuid drop is the correct
 * mitigation until a Darwin-native sandbox backend (App Sandbox /
 * launchd seatbelt-class) is available.
 *
 * Supported limits on Darwin:
 *   RLIMIT_CPU    (--cpu N)      CPU time in seconds → SIGXCPU then SIGKILL
 *   RLIMIT_NOFILE (--nofile N)   Max open file descriptors → EMFILE
 *   RLIMIT_FSIZE  (--fsize-b N)  Max file size in bytes → 512-byte blocks → SIGXFSZ
 *   RLIMIT_NPROC  (--nproc N)    Max processes for the UID. NOTE: per-user on macOS
 *                                (not per-process-tree as on Linux). fork() and
 *                                posix_spawn() return EAGAIN when the per-user count
 *                                hits the limit. Enforcement is real; scope differs
 *                                from Linux. Ledgered in physwrap_envelope_active.
 *   RLIMIT_AS     (--as-kb N)    Virtual memory ceiling. Fully enforced on Intel macOS.
 *                                Partial on Apple Silicon (arm64): tagged-pointer
 *                                address layout causes the kernel to reserve regions
 *                                beyond the limit before user allocations. Applied
 *                                regardless — belt-and-suspenders:
 *                                memorystatus_control jetsam ceiling is applied
 *                                alongside RLIMIT_AS for full arm64 RSS coverage.
 *
 * Usage:
 *   buccet-physwrap [--cpu N] [--nofile N] [--fsize-b N] [--nproc N] [--as-kb N]
 *                   [--uid N] [--gid N] -- cmd [args...]
 *
 * Exit codes:
 *   1  argument error
 *   2  setrlimit failed
 *   4  exec failed
 *   5  setuid/setgid drop failed
 *
 * Ledger visibility: caller (process.ts) records PROCESS_PHYSWRAP_ACTIVE
 * with physwrap_platform=macos when this binary is used.
 *
 * Darwin jetsam status protocol:
 *   process.ts passes BUCCET_PHYSWRAP_STATUS_FILE=/tmp/buccet-physwrap-*.status
 *   in the environment. physwrap_mac writes the jetsam reinforcement outcome
 *   to that file before execvp(). process.ts reads the file after the child
 *   exits and includes the result in PROCESS_PHYSWRAP_ACTIVE as:
 *     physwrap_macos_jetsam_reinforcement = active | failed | unavailable | not_configured
 */

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <unistd.h>

/*
 * memorystatus_control — XNU private API, available since macOS 10.9 on all
 * architectures including Apple Silicon (arm64).
 *
 * Sets an RSS-based jetsam memory ceiling: the kernel terminates the process
 * when its RSS exceeds the configured limit, using the same mechanism as OS
 * memory-pressure jetsam. This covers the arm64 gap where RLIMIT_AS is only
 * partially enforced due to tagged-pointer address space layout.
 *
 * The `flags` argument is the limit in megabytes (uint32_t). The limit persists
 * across execvp() because it is stored in the Mach task.
 *
 * Declared with __attribute__((weak_import)) so physwrap links cleanly even if
 * the symbol is absent in a hypothetical future OS configuration. The call site
 * checks for NULL before invoking.
 */
#define MEMORYSTATUS_CMD_SET_JETSAM_TASK_LIMIT 6
extern int memorystatus_control(uint32_t command, int32_t pid, uint32_t flags,
                                void *buffer, size_t buffersize)
    __attribute__((weak_import));

/* ── Darwin jetsam status protocol ───────────────────────────────────────── */
/*
 * Tracks the runtime outcome of the memorystatus_control call.
 * Written to BUCCET_PHYSWRAP_STATUS_FILE (set by process.ts) before execvp()
 * so process.ts can include the result in the PROCESS_PHYSWRAP_ACTIVE ledger
 * event as physwrap_macos_jetsam_reinforcement.
 */
static const char *g_jetsam_status = "not_configured";

static void write_physwrap_status_file(void) {
    const char *path = getenv("BUCCET_PHYSWRAP_STATUS_FILE");
    if (!path || !path[0]) return;
    FILE *f = fopen(path, "w");
    if (!f) return;
    fprintf(f, "jetsam_reinforcement=%s\n", g_jetsam_status);
    fclose(f);
}

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
    long nproc     = -1;
    long as_kb     = -1;
    long drop_uid  = -1;
    long drop_gid  = -1;
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
            nproc = parse_long(argv[++i], "--nproc");
        } else if (strcmp(argv[i], "--as-kb") == 0 && i + 1 < argc) {
            as_kb = parse_long(argv[++i], "--as-kb");
        } else if (strcmp(argv[i], "--uid") == 0 && i + 1 < argc) {
            drop_uid = parse_long(argv[++i], "--uid");
        } else if (strcmp(argv[i], "--gid") == 0 && i + 1 < argc) {
            drop_gid = parse_long(argv[++i], "--gid");
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
     * limit above the hard. Root can exceed hard limits on Darwin without
     * a uid drop — mitigated by --uid below.
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
     * nproc: RLIMIT_NPROC — enforced on macOS. Scope: per-user (applies to all
     * processes running as this UID), not per-process-tree as on Linux.
     * fork() and posix_spawn() return EAGAIN when the per-user process count
     * reaches the limit. hard == soft prevents the child from raising the limit.
     * Enforcement is real; the per-user vs per-tree scope difference is documented
     * in the ledger via physwrap_envelope_active.
     */
    if (nproc >= 0) {
        if (apply_rlimit(RLIMIT_NPROC, (rlim_t)nproc, "RLIMIT_NPROC") != 0)
            exit(2);
    }

    /*
     * as: virtual memory ceiling — belt-and-suspenders enforcement:
     *
     * 1. RLIMIT_AS — POSIX virtual memory limit. Fully enforced on Intel macOS.
     *    On Apple Silicon (arm64), enforcement is partial: tagged-pointer address
     *    space layout causes the kernel to reserve regions beyond the configured
     *    limit before user allocations begin. Applied regardless — Intel gets full
     *    enforcement; arm64 gets partial. hard == soft.
     *
     * 2. memorystatus_control(MEMORYSTATUS_CMD_SET_JETSAM_TASK_LIMIT) — XNU
     *    private API. Sets an RSS-based jetsam ceiling: the kernel terminates the
     *    process when RSS exceeds the limit. Works on all macOS architectures
     *    including arm64. Limit is in megabytes. Persists across execvp() (stored
     *    in the Mach task). Declared with __attribute__((weak_import)); if the
     *    symbol is absent, a warning is emitted and execution continues with
     *    RLIMIT_AS alone.
     */
    if (as_kb >= 0) {
        /* RLIMIT_AS value is in bytes */
        if (apply_rlimit(RLIMIT_AS, (rlim_t)as_kb * 1024UL, "RLIMIT_AS") != 0)
            exit(2);

        /* Belt-and-suspenders: memorystatus_control jetsam ceiling for arm64 coverage */
        uint32_t limit_mb = (uint32_t)(((unsigned long)as_kb + 1023UL) / 1024UL);
        if (memorystatus_control == NULL) {
            fprintf(stderr,
                "buccet-physwrap(darwin): warning: memorystatus_control not available "
                "(symbol absent) — RLIMIT_AS applied, jetsam ceiling not set\n");
            g_jetsam_status = "unavailable";
        } else {
            int mc_ret = memorystatus_control(
                MEMORYSTATUS_CMD_SET_JETSAM_TASK_LIMIT, (int32_t)getpid(),
                limit_mb, NULL, 0);
            if (mc_ret != 0) {
                fprintf(stderr,
                    "buccet-physwrap(darwin): warning: memorystatus_control(%u MB) "
                    "failed (errno=%d) — RLIMIT_AS still applied\n",
                    limit_mb, errno);
                g_jetsam_status = "failed";
            } else {
                g_jetsam_status = "active";
            }
        }
    }

    /*
     * ── Root privilege drop ────────────────────────────────────────────────
     * setrlimit() must be called BEFORE setuid() — a non-root process cannot
     * set hard limits above the current hard limit. Drop order: gid first,
     * uid second (once uid is dropped we may lose setgid capability).
     *
     * If physwrap is running as root and --uid is NOT provided, warn to
     * stderr. The caller (process.ts) records this in the ledger. Root can
     * exceed rlimit hard limits on Darwin; the warning makes the gap explicit.
     */
    if (drop_uid < 0 && getuid() == 0) {
        fprintf(stderr,
            "buccet-physwrap(darwin): warning: running as root without --uid "
            "drop — root can exceed rlimit hard limits on Darwin. "
            "Pass --uid to drop privileges before exec.\n");
    }

    if (drop_gid >= 0) {
        if (setgid((gid_t)drop_gid) != 0) {
            fprintf(stderr,
                "buccet-physwrap(darwin): setgid(%ld) failed: %s\n",
                drop_gid, strerror(errno));
            exit(5);
        }
    }

    if (drop_uid >= 0) {
        if (setuid((uid_t)drop_uid) != 0) {
            fprintf(stderr,
                "buccet-physwrap(darwin): setuid(%ld) failed: %s\n",
                drop_uid, strerror(errno));
            exit(5);
        }
    }

    /*
     * ── Darwin jetsam status write ─────────────────────────────────────────
     * Write the jetsam reinforcement outcome to BUCCET_PHYSWRAP_STATUS_FILE
     * (set by process.ts) before execvp() replaces this process. process.ts
     * reads this file after the child exits and includes the result in the
     * PROCESS_PHYSWRAP_ACTIVE ledger event as physwrap_macos_jetsam_reinforcement.
     * The file survives execvp() because it is on disk, not in this process's memory.
     */
    write_physwrap_status_file();

    /*
     * ── exec ───────────────────────────────────────────────────────────────
     * No shell interposition. physwrap process is replaced by the target.
     * The target inherits the rlimits and uid/gid we just set.
     */
    execvp(cmd[0], cmd);

    fprintf(stderr, "buccet-physwrap(darwin): exec '%s' failed: %s\n",
            cmd[0], strerror(errno));
    exit(4);
}
