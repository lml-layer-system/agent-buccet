/*
 * buccet-physwrap — Windows Native Physics Translator
 *
 * Platform: Windows (Win32 / NT)
 * Method:   NT Job Objects (Tier 2a envelope) + DLL injection (Tier 2b
 *           I/O boundary) + Job Object I/O rate control (Tier 2b throttle).
 *
 * The target process is created SUSPENDED, assigned to the Job Object, then
 * the I/O boundary DLL is injected before the main thread is resumed. All
 * limits are in effect before any user code runs.
 *
 * ── Tier 2a: Payload Envelope Physics ────────────────────────────────────
 * Launch-time ceilings; kernel terminates the process when exceeded.
 *   --cpu N      PerJobUserTimeLimit (user-mode CPU, 100ns units)
 *                Action: JOB_OBJECT_TERMINATE_AT_END_OF_JOB
 *   --nproc N    ActiveProcessLimit (simultaneous live processes in job)
 *   --as-kb N    ProcessMemoryLimit (per-process virtual memory, in bytes)
 *
 * ── Tier 2b: Live I/O / Object Boundary ──────────────────────────────────
 * Ongoing enforcement on file operations during execution.
 *
 * Per-operation refusal path (EMFILE / EFBIG semantics):
 *   --nofile N   Max open disk file handles. Implemented by injecting
 *                buccet-ioboundary.dll (same directory as this .exe) into
 *                the suspended child process before the main thread runs.
 *                The DLL hooks CreateFileA/W via IAT patching; when the
 *                limit is reached, CreateFile returns INVALID_HANDLE_VALUE
 *                + ERROR_TOO_MANY_OPEN_FILES.  Fail closed: if the DLL
 *                cannot be found or injection fails, physwrap exits 2.
 *   --fsize-b N  Max bytes per file. Same DLL hooks WriteFile; when a
 *                write would exceed the limit, WriteFile returns FALSE +
 *                ERROR_FILE_TOO_LARGE.  Fail closed: same as --nofile.
 *
 *   Scope: Win32 API callers (CreateFileA/W, WriteFile). Programs that call
 *   ntdll directly (NtCreateFile / NtWriteFile bypassing kernel32) are
 *   outside this boundary — standard agent workloads are covered.
 *
 * I/O rate throttle path (delay semantics, Windows 10 1607+):
 *   --io-rate-bps N   I/O bandwidth throttle (bytes/sec; API takes bits/sec)
 *                     Via SetIoRateControlInformationJobObject.
 *                     Semantics: kernel I/O scheduler DELAYS operations
 *                     exceeding the budget. Operations complete at the
 *                     controlled rate; they are not refused.
 *   --io-max-iops N   Maximum I/O operations per second; same API.
 *
 * Job lifetime: physwrap.exe holds the only handle. JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
 * ensures that if physwrap exits unexpectedly, all job processes are terminated.
 *
 * Usage:
 *   buccet-physwrap.exe [--cpu N] [--nproc N] [--as-kb N]
 *                       [--nofile N] [--fsize-b N]
 *                       [--io-rate-bps N] [--io-max-iops N]
 *                       -- cmd [args...]
 *
 * Exit codes:
 *   0  target exited 0
 *   N  target exit code N (propagated)
 *   1  argument error
 *   2  job object / limit setup / DLL injection failed
 *   3  process creation failed
 *   4  process assignment to job failed
 *
 * Architecture note: unlike the Linux/macOS backends, physwrap.exe does NOT
 * exec-replace itself. It stays alive as parent, waits for the job to finish,
 * and exits with the target's exit code. From process.ts (Node.js spawn),
 * the observable contract is identical: physwrap exits when the work is done
 * and carries the target's exit code.
 *
 * Ledger visibility: caller (process.ts) records PROCESS_PHYSWRAP_ACTIVE
 * with physwrap_platform=windows, physwrap_io_boundary_active, and
 * physwrap_io_boundary_skipped when this binary is used.
 */

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 * ── Windows I/O Rate Control — inline type definitions ────────────────────
 *
 * JOBOBJECT_IO_RATE_CONTROL_INFORMATION lives in <jobapi2.h> (Windows 10 SDK).
 * We define a compatible struct here for portability across SDK versions and
 * to allow dynamic loading of SetIoRateControlInformationJobObject, which
 * lets physwrap.exe run on older Windows with graceful degradation.
 *
 * MaxBandwidth is in BITS per second (not bytes). We accept bytes/sec on the
 * command line and multiply by 8 before calling the API.
 */
#ifndef JOB_OBJECT_IO_RATE_CONTROL_ENABLE
#define JOB_OBJECT_IO_RATE_CONTROL_ENABLE 0x1UL

typedef struct {
    LONG64  MaxIops;            /* max I/O operations per second (0 = unlimited) */
    LONG64  MaxBandwidth;       /* max bandwidth in BITS/sec   (0 = unlimited) */
    LONG64  ReservationIops;    /* reserved IOPS (0 = none)    */
    PWSTR   VolumeName;         /* NULL = apply to all volumes */
    DWORD   BaseIoSize;         /* min I/O unit (0 = system default) */
    DWORD   ControlFlags;       /* JOB_OBJECT_IO_RATE_CONTROL_ENABLE = 0x1 */
} BUCCET_IO_RATE_CONTROL;

#endif /* JOB_OBJECT_IO_RATE_CONTROL_ENABLE */

typedef BOOL (WINAPI *PFN_SetIoRateControl)(HANDLE, BUCCET_IO_RATE_CONTROL *);

/* ── Helpers ──────────────────────────────────────────────────────────────── */

static long long parse_llong(const char *s, const char *flag) {
    char *end;
    long long v = strtoll(s, &end, 10);
    if (*end != '\0' || end == s || v < 0) {
        fprintf(stderr, "buccet-physwrap(windows): invalid value for %s: %s\n", flag, s);
        exit(1);
    }
    return v;
}

/*
 * Build a properly quoted Windows command line string from an argv array.
 * Uses the CommandLineToArgvW quoting convention:
 * - Arguments containing spaces or quotes are wrapped in double quotes.
 * - Inner double quotes are escaped as \".
 * - Backslashes before a double quote are doubled.
 */
static char *build_cmdline(char **argv) {
    /* First pass: calculate required length */
    size_t len = 0;
    for (char **p = argv; *p; p++) {
        len += strlen(*p) * 2 + 4; /* worst case: every char escaped + quotes + space */
    }
    len += 1;

    char *buf = (char *)malloc(len);
    if (!buf) {
        fprintf(stderr, "buccet-physwrap(windows): out of memory building command line\n");
        exit(2);
    }
    char *out = buf;

    for (char **p = argv; *p; p++) {
        const char *arg = *p;
        int needs_quote = (strchr(arg, ' ') != NULL ||
                           strchr(arg, '"') != NULL ||
                           strchr(arg, '\t') != NULL ||
                           *arg == '\0');

        if (p != argv) *out++ = ' ';

        if (needs_quote) *out++ = '"';

        for (const char *c = arg; *c; c++) {
            if (*c == '"') {
                /* Escape backslashes immediately before closing quote */
                *out++ = '\\';
                *out++ = '"';
            } else if (*c == '\\' && *(c + 1) == '"') {
                *out++ = '\\';
                *out++ = '\\';
            } else {
                *out++ = *c;
            }
        }

        if (needs_quote) *out++ = '"';
    }
    *out = '\0';
    return buf;
}

/*
 * Resolve the path to buccet-ioboundary.dll, expected in the same directory
 * as this physwrap.exe binary.
 */
static int get_ioboundary_dll_path(wchar_t *out, DWORD out_cap) {
    wchar_t exe_path[MAX_PATH];
    DWORD got = GetModuleFileNameW(NULL, exe_path, MAX_PATH);
    if (!got || got >= MAX_PATH) return 0;

    wchar_t *last_sep = wcsrchr(exe_path, L'\\');
    if (!last_sep) last_sep = wcsrchr(exe_path, L'/');
    if (!last_sep) return 0;

    last_sep[1] = L'\0'; /* truncate to directory */

    int written = _snwprintf(out, out_cap, L"%lsbuccet-ioboundary.dll", exe_path);
    return (written > 0 && (DWORD)written < out_cap);
}

/*
 * Inject a DLL into the target process by creating a remote thread that
 * calls LoadLibraryW with the DLL path as argument.
 *
 * physwrap.exe calls this while the child's main thread is SUSPENDED and
 * after AssignProcessToJobObject. The remote thread runs LoadLibraryW, which
 * loads the DLL and executes its DllMain (which patches IATs). physwrap waits
 * for the remote thread to complete before resuming the main thread.
 *
 * Returns 1 on success (DLL loaded), 0 on failure.
 */
static int inject_dll(HANDLE hProcess, const wchar_t *dll_path) {
    SIZE_T path_bytes = (wcslen(dll_path) + 1) * sizeof(wchar_t);

    void *remote_mem = VirtualAllocEx(hProcess, NULL, path_bytes,
                                       MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!remote_mem) return 0;

    if (!WriteProcessMemory(hProcess, remote_mem, dll_path, path_bytes, NULL)) {
        VirtualFreeEx(hProcess, remote_mem, 0, MEM_RELEASE);
        return 0;
    }

    LPTHREAD_START_ROUTINE pfnLoadLibW = (LPTHREAD_START_ROUTINE)
        GetProcAddress(GetModuleHandleA("kernel32.dll"), "LoadLibraryW");
    if (!pfnLoadLibW) {
        VirtualFreeEx(hProcess, remote_mem, 0, MEM_RELEASE);
        return 0;
    }

    HANDLE hThread = CreateRemoteThread(
        hProcess, NULL, 0, pfnLoadLibW, remote_mem, 0, NULL);
    if (!hThread) {
        VirtualFreeEx(hProcess, remote_mem, 0, MEM_RELEASE);
        return 0;
    }

    /* Wait for DllMain to complete; 5 seconds is generous for IAT patching */
    DWORD wait = WaitForSingleObject(hThread, 5000);

    DWORD exit_code = 0;
    GetExitCodeThread(hThread, &exit_code);
    CloseHandle(hThread);
    VirtualFreeEx(hProcess, remote_mem, 0, MEM_RELEASE);

    /* exit_code from the LoadLibraryW thread is the HMODULE value; 0 = failure */
    return (wait == WAIT_OBJECT_0 && exit_code != 0);
}

/* ── main ─────────────────────────────────────────────────────────────────── */

int main(int argc, char *argv[]) {
    long long cpu_sec      = -1;
    long long nproc        = -1;
    long long as_kb        = -1;
    long long nofile       = -1;
    long long fsize_b      = -1;
    long long io_rate_bps  = -1;  /* bytes/sec; multiplied by 8 before API call */
    long long io_max_iops  = -1;
    int       separator    = 0;

    int i;
    for (i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--") == 0) {
            separator = i;
            break;
        }
        if (strcmp(argv[i], "--cpu") == 0 && i + 1 < argc) {
            cpu_sec = parse_llong(argv[++i], "--cpu");
        } else if (strcmp(argv[i], "--nproc") == 0 && i + 1 < argc) {
            nproc = parse_llong(argv[++i], "--nproc");
        } else if (strcmp(argv[i], "--as-kb") == 0 && i + 1 < argc) {
            as_kb = parse_llong(argv[++i], "--as-kb");
        } else if (strcmp(argv[i], "--nofile") == 0 && i + 1 < argc) {
            nofile = parse_llong(argv[++i], "--nofile");
        } else if (strcmp(argv[i], "--fsize-b") == 0 && i + 1 < argc) {
            fsize_b = parse_llong(argv[++i], "--fsize-b");
        } else if (strcmp(argv[i], "--io-rate-bps") == 0 && i + 1 < argc) {
            io_rate_bps = parse_llong(argv[++i], "--io-rate-bps");
        } else if (strcmp(argv[i], "--io-max-iops") == 0 && i + 1 < argc) {
            io_max_iops = parse_llong(argv[++i], "--io-max-iops");
        } else {
            fprintf(stderr, "buccet-physwrap(windows): unknown flag: %s\n", argv[i]);
            exit(1);
        }
    }

    if (separator == 0 || separator + 1 >= argc) {
        fprintf(stderr, "buccet-physwrap(windows): missing -- <cmd> after flags\n");
        exit(1);
    }

    char **cmd = &argv[separator + 1];

    /*
     * ── Set env vars for Tier 2b I/O boundary DLL ─────────────────────────
     * Communicate limits to buccet-ioboundary.dll via environment variables
     * before creating the child process. The child inherits physwrap's
     * environment, and the DLL reads these in DllMain.
     */
    if (nofile >= 0) {
        char buf[32];
        snprintf(buf, sizeof(buf), "%lld", nofile);
        SetEnvironmentVariableA("BUCCET_MAX_OPEN_FILES", buf);
    }
    if (fsize_b >= 0) {
        char buf[32];
        snprintf(buf, sizeof(buf), "%lld", fsize_b);
        SetEnvironmentVariableA("BUCCET_MAX_FILE_SIZE_BYTES", buf);
    }

    /*
     * ── Create Job Object ──────────────────────────────────────────────────
     * Anonymous job — no name, so it cannot be opened by name from another
     * process. physwrap.exe holds the only handle.
     */
    HANDLE hJob = CreateJobObject(NULL, NULL);
    if (hJob == NULL) {
        fprintf(stderr, "buccet-physwrap(windows): CreateJobObject failed: %lu\n",
                GetLastError());
        exit(2);
    }

    /*
     * ── Apply Tier 2a limits ───────────────────────────────────────────────
     * JOBOBJECT_EXTENDED_LIMIT_INFORMATION covers both basic and extended
     * limits in one call.
     */
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION extLimit;
    ZeroMemory(&extLimit, sizeof(extLimit));
    DWORD limitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

    if (cpu_sec >= 0) {
        /* PerJobUserTimeLimit: total user-mode CPU for all processes, 100ns units */
        extLimit.BasicLimitInformation.PerJobUserTimeLimit.QuadPart =
            (LONGLONG)cpu_sec * 10000000LL;
        limitFlags |= JOB_OBJECT_LIMIT_JOB_TIME;
    }

    if (nproc >= 0) {
        extLimit.BasicLimitInformation.ActiveProcessLimit = (DWORD)nproc;
        limitFlags |= JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
    }

    if (as_kb >= 0) {
        /* ProcessMemoryLimit: per-process virtual memory ceiling, in bytes */
        extLimit.ProcessMemoryLimit = (SIZE_T)(as_kb * 1024LL);
        limitFlags |= JOB_OBJECT_LIMIT_PROCESS_MEMORY;
    }

    extLimit.BasicLimitInformation.LimitFlags = limitFlags;

    if (!SetInformationJobObject(hJob, JobObjectExtendedLimitInformation,
                                 &extLimit, sizeof(extLimit))) {
        fprintf(stderr, "buccet-physwrap(windows): SetInformationJobObject(limits) failed: %lu\n",
                GetLastError());
        CloseHandle(hJob);
        exit(2);
    }

    /*
     * JOB_OBJECT_TERMINATE_AT_END_OF_JOB: when the CPU time limit is hit,
     * terminate all processes in the job immediately (not just notify).
     */
    if (cpu_sec >= 0) {
        JOBOBJECT_END_OF_JOB_TIME_INFORMATION endInfo;
        endInfo.EndOfJobTimeAction = JOB_OBJECT_TERMINATE_AT_END_OF_JOB;
        if (!SetInformationJobObject(hJob, JobObjectEndOfJobTimeInformation,
                                     &endInfo, sizeof(endInfo))) {
            fprintf(stderr, "buccet-physwrap(windows): SetInformationJobObject(end-of-job) failed: %lu\n",
                    GetLastError());
            CloseHandle(hJob);
            exit(2);
        }
    }

    /*
     * ── Tier 2b: I/O rate throttle (Windows 10 1607+) ─────────────────────
     *
     * SetIoRateControlInformationJobObject applies an I/O bandwidth and/or
     * IOPS budget to the entire job tree. When processes exceed the budget,
     * the kernel I/O scheduler DELAYS their I/O operations (throttle semantics).
     * Operations complete at the controlled rate; they are not refused.
     *
     * Dynamically loaded so physwrap.exe runs on older Windows. Logs a warning
     * if the API is unavailable (pre-1607). Execution continues with Tier 2a
     * limits intact. The caller sees this in physwrap_io_boundary_skipped.
     */
    if (io_rate_bps >= 0 || io_max_iops >= 0) {
        PFN_SetIoRateControl pfnSetIoRate = (PFN_SetIoRateControl)
            GetProcAddress(GetModuleHandleA("kernel32.dll"),
                           "SetIoRateControlInformationJobObject");

        if (pfnSetIoRate == NULL) {
            fprintf(stderr,
                "buccet-physwrap(windows): WARNING: --io-rate-bps/--io-max-iops "
                "requested but SetIoRateControlInformationJobObject is not available "
                "(requires Windows 10 1607+). I/O rate control NOT applied.\n");
        } else {
            BUCCET_IO_RATE_CONTROL ioRate;
            ZeroMemory(&ioRate, sizeof(ioRate));
            ioRate.ControlFlags = JOB_OBJECT_IO_RATE_CONTROL_ENABLE;
            ioRate.VolumeName   = NULL;  /* NULL = apply to all volumes */
            ioRate.BaseIoSize   = 0;     /* 0 = use system default I/O unit */

            if (io_rate_bps > 0) {
                ioRate.MaxBandwidth = io_rate_bps * 8LL;  /* bytes/sec → bits/sec */
            }
            if (io_max_iops > 0) {
                ioRate.MaxIops = io_max_iops;
            }

            if (!pfnSetIoRate(hJob, &ioRate)) {
                fprintf(stderr,
                    "buccet-physwrap(windows): SetIoRateControlInformationJobObject "
                    "failed: %lu\n", GetLastError());
                CloseHandle(hJob);
                exit(2);
            }
        }
    }

    /*
     * ── Create target process SUSPENDED ────────────────────────────────────
     * CREATE_SUSPENDED: the primary thread does not start until ResumeThread.
     * This guarantees the process is in the job and the I/O boundary DLL is
     * injected before any user code executes.
     *
     * CREATE_BREAKAWAY_FROM_JOB is NOT set: if physwrap itself is already in
     * a job (e.g., launched from Node.js which is in a job), the child will
     * be in a nested job. This is correct — we want the child in OUR job.
     */
    char *cmdline = build_cmdline(cmd);

    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    if (!CreateProcessA(
            NULL,             /* lpApplicationName — let Windows resolve via PATH */
            cmdline,          /* lpCommandLine */
            NULL,             /* lpProcessAttributes */
            NULL,             /* lpThreadAttributes */
            TRUE,             /* bInheritHandles — inherit stdin/stdout/stderr */
            CREATE_SUSPENDED, /* dwCreationFlags */
            NULL,             /* lpEnvironment — inherit parent (includes BUCCET_* vars) */
            NULL,             /* lpCurrentDirectory — inherit parent */
            &si,
            &pi)) {
        fprintf(stderr, "buccet-physwrap(windows): CreateProcess('%s') failed: %lu\n",
                cmd[0], GetLastError());
        CloseHandle(hJob);
        free(cmdline);
        exit(3);
    }
    free(cmdline);

    /*
     * ── Assign to job BEFORE resuming ──────────────────────────────────────
     * The process is still suspended. Assigning here guarantees it is in the
     * job before any thread runs.
     */
    if (!AssignProcessToJobObject(hJob, pi.hProcess)) {
        fprintf(stderr, "buccet-physwrap(windows): AssignProcessToJobObject failed: %lu\n",
                GetLastError());
        TerminateProcess(pi.hProcess, 1);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        CloseHandle(hJob);
        exit(4);
    }

    /*
     * ── Inject Tier 2b I/O boundary DLL (EMFILE / EFBIG path) ────────────
     *
     * buccet-ioboundary.dll hooks CreateFileA/W and WriteFile via IAT
     * patching to enforce maxOpenFiles and maxFileSizeBytes with
     * per-operation refusal semantics. The DLL must be injected while the
     * main thread is SUSPENDED so patching completes before any user code
     * runs.
     *
     * Fail closed: if the DLL is missing or injection fails, we terminate
     * the child and exit 2. The limits cannot be silently skipped.
     */
    if (nofile >= 0 || fsize_b >= 0) {
        wchar_t dll_path[MAX_PATH + 64];
        if (!get_ioboundary_dll_path(dll_path, (DWORD)(MAX_PATH + 64))) {
            fprintf(stderr,
                "buccet-physwrap(windows): failed to resolve buccet-ioboundary.dll path\n");
            TerminateProcess(pi.hProcess, 1);
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            CloseHandle(hJob);
            exit(2);
        }

        if (!inject_dll(pi.hProcess, dll_path)) {
            fprintf(stderr,
                "buccet-physwrap(windows): buccet-ioboundary.dll injection failed: %lu\n"
                "  nofile/fsize limits NOT applied — failing closed.\n",
                GetLastError());
            TerminateProcess(pi.hProcess, 1);
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            CloseHandle(hJob);
            exit(2);
        }
    }

    /* Resume — the target now runs under all limits */
    ResumeThread(pi.hThread);
    CloseHandle(pi.hThread);

    /*
     * ── Wait and propagate exit code ───────────────────────────────────────
     * physwrap waits for the job's primary process to finish, then exits
     * with the same exit code. All other job processes are cleaned up via
     * JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE when hJob is closed.
     */
    WaitForSingleObject(pi.hProcess, INFINITE);

    DWORD exitCode = 1;
    GetExitCodeProcess(pi.hProcess, &exitCode);

    CloseHandle(pi.hProcess);
    CloseHandle(hJob);

    return (int)exitCode;
}
