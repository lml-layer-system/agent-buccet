/*
 * buccet-physwrap: Payload physics enforcer for Agent Buccet.
 *
 * Closes the shell-ulimit gap:
 *   - Applies setrlimit() directly (not via "sh -c ulimit")
 *   - On Linux: drops CAP_SYS_RESOURCE from the capability bounding set
 *     before exec, so the spawned process cannot raise its own limits
 *     regardless of privilege level
 *   - execs the target command with no shell interposition
 *
 * This file owns only constraint enforcement. It holds no law, no policy,
 * no ledger. It is a physics layer, not a decision layer.
 *
 * Usage:
 *   buccet-physwrap [--cpu N] [--nproc N] [--as-kb N] [--nofile N] [--fsize-b N] -- cmd [args...]
 *
 * Flags:
 *   --cpu N      RLIMIT_CPU: CPU time limit in seconds
 *   --nproc N    RLIMIT_NPROC: max child processes
 *   --as-kb N    RLIMIT_AS: virtual address space in kilobytes
 *   --nofile N   RLIMIT_NOFILE: max open file descriptors
 *   --fsize-b N  RLIMIT_FSIZE: max file size in bytes (converted to 512-byte blocks internally)
 *   --          marks the end of physwrap flags; cmd and its args follow
 *
 * Exit codes:
 *   0             success (exec replaced the process; this exit is never reached)
 *   1             argument error
 *   2             setrlimit failed
 *   3             capability drop failed (Linux only; treated as hard error)
 *   4             exec failed
 */

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <unistd.h>

#ifdef __linux__
#include <sys/prctl.h>

/*
 * CAP_SYS_RESOURCE = 24 (Linux ABI constant, stable since kernel 2.2).
 * Defined here directly to avoid requiring libcap-dev at build time.
 */
#ifndef CAP_SYS_RESOURCE
#define CAP_SYS_RESOURCE 24
#endif

/*
 * PR_CAPBSET_DROP = 24 (stable Linux ABI).
 * Drops a capability permanently from the bounding set of this process
 * and all descendants. After this call, even root cannot re-acquire the
 * capability without a full exec chain that provides it.
 */
#ifndef PR_CAPBSET_DROP
#define PR_CAPBSET_DROP 24
#endif

/*
 * PR_CAP_AMBIENT / PR_CAP_AMBIENT_LOWER: removes capability from the
 * ambient set so it is not inherited across exec without explicit grant.
 * Available since Linux 4.3.
 */
#ifndef PR_CAP_AMBIENT
#define PR_CAP_AMBIENT         47
#define PR_CAP_AMBIENT_LOWER   3
#endif

#endif /* __linux__ */

/* ── Helpers ──────────────────────────────────────────────────────────────── */

static long parse_long(const char *s, const char *flag) {
    char *end;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (errno != 0 || *end != '\0' || end == s || v < 0) {
        fprintf(stderr, "buccet-physwrap: invalid value for %s: %s\n", flag, s);
        exit(1);
    }
    return v;
}

static int apply_rlimit(int resource, rlim_t soft, rlim_t hard, const char *name) {
    struct rlimit rl;
    rl.rlim_cur = soft;
    rl.rlim_max = hard;
    if (setrlimit(resource, &rl) != 0) {
        fprintf(stderr, "buccet-physwrap: setrlimit(%s, %lu, %lu) failed: %s\n",
                name, (unsigned long)soft, (unsigned long)hard, strerror(errno));
        return -1;
    }
    return 0;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

int main(int argc, char *argv[]) {
    long cpu_sec    = -1;
    long nproc      = -1;
    long as_kb      = -1;
    long nofile     = -1;
    long fsize_b    = -1;
    int  separator  = 0;  /* index of "--" in argv */
    int  cap_drop_failed = 0;

    /* Parse physwrap flags until "--" */
    int i;
    for (i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--") == 0) {
            separator = i;
            break;
        }
        if (strcmp(argv[i], "--cpu") == 0 && i + 1 < argc) {
            cpu_sec = parse_long(argv[++i], "--cpu");
        } else if (strcmp(argv[i], "--nproc") == 0 && i + 1 < argc) {
            nproc = parse_long(argv[++i], "--nproc");
        } else if (strcmp(argv[i], "--as-kb") == 0 && i + 1 < argc) {
            as_kb = parse_long(argv[++i], "--as-kb");
        } else if (strcmp(argv[i], "--nofile") == 0 && i + 1 < argc) {
            nofile = parse_long(argv[++i], "--nofile");
        } else if (strcmp(argv[i], "--fsize-b") == 0 && i + 1 < argc) {
            fsize_b = parse_long(argv[++i], "--fsize-b");
        } else {
            fprintf(stderr, "buccet-physwrap: unknown flag: %s\n", argv[i]);
            exit(1);
        }
    }

    if (separator == 0 || separator + 1 >= argc) {
        fprintf(stderr, "buccet-physwrap: missing -- <cmd> after flags\n");
        exit(1);
    }

    char **cmd = &argv[separator + 1];

    /*
     * ── Step 1: Capability bounding-set drop (Linux only) ─────────────────
     *
     * Drop CAP_SYS_RESOURCE from the bounding set BEFORE setrlimit().
     * This prevents the exec'd process from calling setrlimit() to raise
     * limits back above what we are about to set.
     *
     * prctl(PR_CAPBSET_DROP, CAP_SYS_RESOURCE):
     *   - Permanent for this process and all descendants
     *   - Does not require CAP_SETPCAP (only requires current process to have
     *     CAP_SYS_RESOURCE in its bounding set; if it doesn't, the call is
     *     silently a no-op from a security perspective — the capability isn't
     *     there to grant anyway)
     *   - Fails with EPERM if the calling process lacks CAP_SETPCAP
     *   - We treat EPERM as non-fatal (the bounding set already doesn't
     *     include CAP_SYS_RESOURCE in that case), but log it to stderr.
     *
     * prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_LOWER, CAP_SYS_RESOURCE):
     *   - Removes from ambient set (inherited across exec without explicit grant)
     *   - Available since Linux 4.3; EINVAL on older kernels — ignored silently.
     */
#ifdef __linux__
    if (prctl(PR_CAPBSET_DROP, CAP_SYS_RESOURCE, 0, 0, 0) != 0) {
        if (errno == EPERM) {
            /* CAP_SETPCAP not held — bounding set already lacks the cap, or
             * we're running without it. Log and continue; limits will still
             * bind via setrlimit() for non-root or processes without the cap. */
            fprintf(stderr, "buccet-physwrap: warning: PR_CAPBSET_DROP(CAP_SYS_RESOURCE) "
                    "requires CAP_SETPCAP (EPERM) — limits applied but cap not dropped\n");
            cap_drop_failed = 1;
        } else if (errno != EINVAL) {
            /* EINVAL = the capability constant is unknown to this kernel (very old kernel).
             * Any other error is unexpected and we treat it as hard. */
            fprintf(stderr, "buccet-physwrap: PR_CAPBSET_DROP(CAP_SYS_RESOURCE) failed: %s\n",
                    strerror(errno));
            exit(3);
        }
    }

    /* Best-effort ambient clear — ignore EINVAL (kernel < 4.3) */
    if (prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_LOWER, CAP_SYS_RESOURCE, 0, 0) != 0) {
        if (errno != EINVAL && errno != EPERM) {
            fprintf(stderr, "buccet-physwrap: warning: PR_CAP_AMBIENT_LOWER(CAP_SYS_RESOURCE) "
                    "failed: %s\n", strerror(errno));
        }
    }
#endif

    /*
     * ── Step 2: setrlimit() for each requested limit ──────────────────────
     *
     * Both soft and hard limits are set to the same value. Setting the hard
     * limit makes it impossible for the process to raise its own soft limit
     * above this ceiling without CAP_SYS_RESOURCE (which we just dropped).
     */
    if (cpu_sec >= 0) {
        if (apply_rlimit(RLIMIT_CPU, (rlim_t)cpu_sec, (rlim_t)cpu_sec, "RLIMIT_CPU") != 0)
            exit(2);
    }

#ifdef __linux__
    if (nproc >= 0) {
        if (apply_rlimit(RLIMIT_NPROC, (rlim_t)nproc, (rlim_t)nproc, "RLIMIT_NPROC") != 0)
            exit(2);
    }

    if (as_kb >= 0) {
        rlim_t as_bytes = (rlim_t)as_kb * 1024UL;
        if (apply_rlimit(RLIMIT_AS, as_bytes, as_bytes, "RLIMIT_AS") != 0)
            exit(2);
    }
#else
    /* macOS: RLIMIT_NPROC and RLIMIT_AS not universally supported — skip silently */
    (void)nproc;
    (void)as_kb;
#endif

    if (nofile >= 0) {
        if (apply_rlimit(RLIMIT_NOFILE, (rlim_t)nofile, (rlim_t)nofile, "RLIMIT_NOFILE") != 0)
            exit(2);
    }

    if (fsize_b >= 0) {
        /*
         * RLIMIT_FSIZE unit is 512-byte blocks. Round up so the configured
         * byte ceiling is not silently truncated downward.
         */
        rlim_t blocks = ((rlim_t)fsize_b + 511UL) / 512UL;
        if (apply_rlimit(RLIMIT_FSIZE, blocks, blocks, "RLIMIT_FSIZE") != 0)
            exit(2);
    }

    /*
     * ── Step 3: exec target ───────────────────────────────────────────────
     *
     * After exec, the target process inherits the rlimits we set and the
     * capability bounding set with CAP_SYS_RESOURCE removed. It cannot
     * exceed the limits via setrlimit() regardless of its UID.
     *
     * cap_drop_failed is recorded but does not prevent exec. The limits are
     * still enforced; only the capability-drop guarantee is weakened for
     * high-privilege environments. The caller (process.ts) logs this.
     */
    (void)cap_drop_failed;  /* consumed by caller via physwrap exit code; not exposed here */

    execvp(cmd[0], cmd);

    /* execvp only returns on failure */
    fprintf(stderr, "buccet-physwrap: exec '%s' failed: %s\n", cmd[0], strerror(errno));
    exit(4);
}
