/*
 * buccet-ioboundary — Windows Tier 2b I/O Object Boundary Hook DLL
 *
 * Platform: Windows (Win32 / NT)
 * Method:   IAT (Import Address Table) patching — hooks CreateFileA/W,
 *           CloseHandle, WriteFile, and LoadLibraryA/W/ExA/ExW in all
 *           loaded modules' IATs to enforce per-operation file limits.
 *
 * ── Enforcement semantics ─────────────────────────────────────────────────
 *
 *   maxOpenFiles (BUCCET_MAX_OPEN_FILES env var):
 *     When the limit is reached, CreateFileA/W returns INVALID_HANDLE_VALUE
 *     with SetLastError(ERROR_TOO_MANY_OPEN_FILES).
 *     Semantics: EMFILE equivalent — per-operation REFUSAL.
 *     The calling process can catch and handle the error. The process is not
 *     terminated. Only disk file handles count; pipes, consoles, sockets,
 *     devices do not.
 *
 *   maxFileSizeBytes (BUCCET_MAX_FILE_SIZE_BYTES env var):
 *     When a WriteFile call would cause a file to exceed the limit,
 *     WriteFile returns FALSE with SetLastError(ERROR_FILE_TOO_LARGE).
 *     Semantics: SIGXFSZ/EFBIG equivalent — per-operation REFUSAL.
 *     The size check is against the file's current size at write time.
 *     Only disk files are checked.
 *
 * ── Enforcement scope ─────────────────────────────────────────────────────
 *
 *   Win32 API callers: CreateFileA, CreateFileW, WriteFile (kernel32.dll).
 *   Processes that call ntdll directly (NtCreateFile, NtWriteFile bypassing
 *   kernel32) are outside this boundary. Standard agent workloads —
 *   Python, Node.js, PowerShell, cmd.exe — use Win32 and are covered.
 *
 * ── Injection lifecycle ───────────────────────────────────────────────────
 *
 *   physwrap.exe creates the target process SUSPENDED, assigns it to a
 *   Job Object, then injects this DLL via CreateRemoteThread(LoadLibraryW).
 *   physwrap waits for the injection thread to finish before calling
 *   ResumeThread on the main thread. IAT patching completes before any
 *   user code in the target process runs — no race condition.
 *
 *   Limits are read from environment variables set by physwrap.exe in its
 *   own environment (inherited by the child):
 *     BUCCET_MAX_OPEN_FILES       = decimal integer  (0 = not set)
 *     BUCCET_MAX_FILE_SIZE_BYTES  = decimal integer  (0 = not set)
 *
 * ── IAT patching ──────────────────────────────────────────────────────────
 *
 *   On DLL_PROCESS_ATTACH: all loaded modules are enumerated via
 *   EnumProcessModules. Each module's import table is scanned; CreateFileA,
 *   CreateFileW, CloseHandle, WriteFile, and LoadLibrary* IAT entries are
 *   overwritten to point to our hooks. Original pointers are saved once.
 *
 *   LoadLibraryA/W/ExA/ExW are also hooked so that modules loaded after
 *   injection also get patched.
 *
 *   We do NOT patch our own IAT, so calls from inside this DLL go directly
 *   to kernel32.dll — no reentrancy.
 *
 * ── Fail-closed notes ─────────────────────────────────────────────────────
 *
 *   If kernel32.dll exports are not resolvable (never happens in practice),
 *   DllMain returns FALSE, causing LoadLibraryW to fail.
 *   physwrap treats injection failure as a fatal error (exit code 2).
 *   If g_open_count is at g_max_open when a file is opened, the real handle
 *   is opened, then immediately closed, and INVALID_HANDLE_VALUE returned.
 *   There is no silent pass-through.
 *
 * Build:
 *   cl /nologo /O2 /W3 /LD buccet_ioboundary_win.c /Fe:buccet-ioboundary.dll
 *      kernel32.lib psapi.lib
 */

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <psapi.h>
#include <stdlib.h>
#include <string.h>

/* ── Limits ───────────────────────────────────────────────────────────────── */
/* Read once from env vars at DLL_PROCESS_ATTACH. Zero = not set. */
static LONG  g_max_open  = 0;
static LONG64 g_max_fsize = 0;

/* ── Open-file counter ────────────────────────────────────────────────────── */
static volatile LONG g_open_count = 0;

/* ── Handle tracking hash table ───────────────────────────────────────────── */
/*
 * Tracks file handles we opened so CloseHandle can decrement g_open_count.
 * Open-addressed, power-of-2 capacity, linear probing.
 * Slot value 0 = empty. HT_TOMBSTONE = deleted entry.
 * Windows handles are always >= 4 and multiples of 4, so 1 is safe tombstone.
 */
#define HT_CAPACITY  8192
#define HT_MASK      (HT_CAPACITY - 1)
#define HT_TOMBSTONE ((HANDLE)(ULONG_PTR)1)

static HANDLE           g_ht[HT_CAPACITY];
static CRITICAL_SECTION g_ht_cs;

static void ht_add(HANDLE h) {
    ULONG_PTR k = (((ULONG_PTR)h) >> 2) & HT_MASK;
    EnterCriticalSection(&g_ht_cs);
    while (g_ht[k] && g_ht[k] != HT_TOMBSTONE) {
        k = (k + 1) & HT_MASK;
    }
    g_ht[k] = h;
    LeaveCriticalSection(&g_ht_cs);
}

/* Returns 1 if found and removed, 0 if not present in table. */
static int ht_remove(HANDLE h) {
    ULONG_PTR k = (((ULONG_PTR)h) >> 2) & HT_MASK;
    int found = 0;
    EnterCriticalSection(&g_ht_cs);
    while (g_ht[k]) {
        if (g_ht[k] == h) {
            g_ht[k] = HT_TOMBSTONE;
            found = 1;
            break;
        }
        k = (k + 1) & HT_MASK;
    }
    LeaveCriticalSection(&g_ht_cs);
    return found;
}

/* ── Original function pointer typedefs ───────────────────────────────────── */
typedef HANDLE (WINAPI *FN_CreateFileA)(
    LPCSTR, DWORD, DWORD, LPSECURITY_ATTRIBUTES, DWORD, DWORD, HANDLE);
typedef HANDLE (WINAPI *FN_CreateFileW)(
    LPCWSTR, DWORD, DWORD, LPSECURITY_ATTRIBUTES, DWORD, DWORD, HANDLE);
typedef BOOL   (WINAPI *FN_CloseHandle)(HANDLE);
typedef BOOL   (WINAPI *FN_WriteFile)(
    HANDLE, LPCVOID, DWORD, LPDWORD, LPOVERLAPPED);
typedef HMODULE (WINAPI *FN_LoadLibraryA)(LPCSTR);
typedef HMODULE (WINAPI *FN_LoadLibraryW)(LPCWSTR);
typedef HMODULE (WINAPI *FN_LoadLibraryExA)(LPCSTR,  HANDLE, DWORD);
typedef HMODULE (WINAPI *FN_LoadLibraryExW)(LPCWSTR, HANDLE, DWORD);

/* Saved original pointers — resolved from kernel32.dll in DllMain. */
static FN_CreateFileA    Real_CreateFileA    = NULL;
static FN_CreateFileW    Real_CreateFileW    = NULL;
static FN_CloseHandle    Real_CloseHandle    = NULL;
static FN_WriteFile      Real_WriteFile      = NULL;
static FN_LoadLibraryA   Real_LoadLibraryA   = NULL;
static FN_LoadLibraryW   Real_LoadLibraryW   = NULL;
static FN_LoadLibraryExA Real_LoadLibraryExA = NULL;
static FN_LoadLibraryExW Real_LoadLibraryExW = NULL;

/* ── IAT patching infrastructure ──────────────────────────────────────────── */

typedef struct {
    const char *import_module;  /* e.g. "KERNEL32.DLL" — matched case-insensitively */
    const char *func_name;      /* e.g. "CreateFileW" — matched exactly */
    void       *hook_fn;        /* replacement function pointer */
    void      **original_fn;    /* where to store the original (set once, first patch) */
} HOOK_ENTRY;

/*
 * Patch one module's IAT. Wrapped in __try/__except so a malformed PE or
 * transient access violation doesn't bring down the target process.
 */
static void patch_module_iat(HMODULE hMod, const HOOK_ENTRY *hooks, int n) {
    if (!hMod) return;

    __try {
        IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)hMod;
        if (dos->e_magic != IMAGE_DOS_SIGNATURE) return;

        IMAGE_NT_HEADERS *nt =
            (IMAGE_NT_HEADERS *)((BYTE *)hMod + dos->e_lfanew);
        if (nt->Signature != IMAGE_NT_SIGNATURE) return;

        DWORD iat_rva = nt->OptionalHeader
            .DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT].VirtualAddress;
        if (!iat_rva) return;

        IMAGE_IMPORT_DESCRIPTOR *imp =
            (IMAGE_IMPORT_DESCRIPTOR *)((BYTE *)hMod + iat_rva);

        for (; imp->Name; imp++) {
            const char *mod_name = (const char *)((BYTE *)hMod + imp->Name);

            /* Check if any hook targets this imported module */
            int relevant = 0;
            for (int h = 0; h < n; h++) {
                if (_stricmp(mod_name, hooks[h].import_module) == 0) {
                    relevant = 1;
                    break;
                }
            }
            if (!relevant) continue;
            if (!imp->OriginalFirstThunk) continue;

            IMAGE_THUNK_DATA *orig_th =
                (IMAGE_THUNK_DATA *)((BYTE *)hMod + imp->OriginalFirstThunk);
            IMAGE_THUNK_DATA *first_th =
                (IMAGE_THUNK_DATA *)((BYTE *)hMod + imp->FirstThunk);

            for (; orig_th->u1.AddressOfData; orig_th++, first_th++) {
                if (IMAGE_SNAP_BY_ORDINAL(orig_th->u1.Ordinal)) continue;

                IMAGE_IMPORT_BY_NAME *by_name = (IMAGE_IMPORT_BY_NAME *)
                    ((BYTE *)hMod + orig_th->u1.AddressOfData);

                for (int h = 0; h < n; h++) {
                    if (_stricmp(mod_name, hooks[h].import_module) != 0) continue;
                    if (strcmp((char *)by_name->Name, hooks[h].func_name) != 0) continue;

                    /* Save original the first time we see this function */
                    if (*hooks[h].original_fn == NULL) {
                        *hooks[h].original_fn = (void *)first_th->u1.Function;
                    }

                    /* Overwrite the IAT slot */
                    DWORD old_prot;
                    VirtualProtect(&first_th->u1.Function, sizeof(ULONG_PTR),
                                   PAGE_READWRITE, &old_prot);
                    first_th->u1.Function = (ULONG_PTR)hooks[h].hook_fn;
                    VirtualProtect(&first_th->u1.Function, sizeof(ULONG_PTR),
                                   old_prot, &old_prot);
                    break;
                }
            }
        }
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        /* Malformed PE header or transient AV — skip this module safely */
    }
}

/* Forward declarations for all hook functions */
static HANDLE  WINAPI Hook_CreateFileA(LPCSTR,  DWORD, DWORD, LPSECURITY_ATTRIBUTES, DWORD, DWORD, HANDLE);
static HANDLE  WINAPI Hook_CreateFileW(LPCWSTR, DWORD, DWORD, LPSECURITY_ATTRIBUTES, DWORD, DWORD, HANDLE);
static BOOL    WINAPI Hook_CloseHandle(HANDLE);
static BOOL    WINAPI Hook_WriteFile(HANDLE, LPCVOID, DWORD, LPDWORD, LPOVERLAPPED);
static HMODULE WINAPI Hook_LoadLibraryA(LPCSTR);
static HMODULE WINAPI Hook_LoadLibraryW(LPCWSTR);
static HMODULE WINAPI Hook_LoadLibraryExA(LPCSTR,  HANDLE, DWORD);
static HMODULE WINAPI Hook_LoadLibraryExW(LPCWSTR, HANDLE, DWORD);

#define N_HOOKS 8
static HOOK_ENTRY g_hooks[N_HOOKS] = {
    { "KERNEL32.DLL", "CreateFileA",    (void *)Hook_CreateFileA,    (void **)&Real_CreateFileA    },
    { "KERNEL32.DLL", "CreateFileW",    (void *)Hook_CreateFileW,    (void **)&Real_CreateFileW    },
    { "KERNEL32.DLL", "CloseHandle",    (void *)Hook_CloseHandle,    (void **)&Real_CloseHandle    },
    { "KERNEL32.DLL", "WriteFile",      (void *)Hook_WriteFile,      (void **)&Real_WriteFile      },
    { "KERNEL32.DLL", "LoadLibraryA",   (void *)Hook_LoadLibraryA,   (void **)&Real_LoadLibraryA   },
    { "KERNEL32.DLL", "LoadLibraryW",   (void *)Hook_LoadLibraryW,   (void **)&Real_LoadLibraryW   },
    { "KERNEL32.DLL", "LoadLibraryExA", (void *)Hook_LoadLibraryExA, (void **)&Real_LoadLibraryExA },
    { "KERNEL32.DLL", "LoadLibraryExW", (void *)Hook_LoadLibraryExW, (void **)&Real_LoadLibraryExW },
};

static void patch_all_loaded_modules(void) {
    HMODULE mods[1024];
    DWORD   needed = 0;
    if (EnumProcessModules(GetCurrentProcess(), mods, sizeof(mods), &needed)) {
        DWORD count = needed / sizeof(HMODULE);
        for (DWORD i = 0; i < count; i++) {
            patch_module_iat(mods[i], g_hooks, N_HOOKS);
        }
    }
}

/* ── Hook implementations ─────────────────────────────────────────────────── */

/*
 * Common post-open logic for both CreateFileA and CreateFileW.
 * If the open succeeded and the handle is a disk file:
 *   - check against g_max_open
 *   - if over limit: close the handle and return EMFILE equivalent
 *   - if within limit: track the handle
 */
static HANDLE handle_file_open(HANDLE h) {
    if (h == INVALID_HANDLE_VALUE) return h;
    if (g_max_open <= 0) return h;
    if (GetFileType(h) != FILE_TYPE_DISK) return h;

    LONG new_count = InterlockedIncrement(&g_open_count);
    if (new_count > g_max_open) {
        /* Over limit — close the handle we just opened, report EMFILE */
        InterlockedDecrement(&g_open_count);
        Real_CloseHandle(h);
        SetLastError(ERROR_TOO_MANY_OPEN_FILES);
        return INVALID_HANDLE_VALUE;
    }

    ht_add(h);
    return h;
}

static HANDLE WINAPI Hook_CreateFileA(
    LPCSTR lpFileName, DWORD dwAccess, DWORD dwShare,
    LPSECURITY_ATTRIBUTES lpSA, DWORD dwCreate,
    DWORD dwFlags, HANDLE hTemplate)
{
    HANDLE h = Real_CreateFileA(
        lpFileName, dwAccess, dwShare, lpSA, dwCreate, dwFlags, hTemplate);
    return handle_file_open(h);
}

static HANDLE WINAPI Hook_CreateFileW(
    LPCWSTR lpFileName, DWORD dwAccess, DWORD dwShare,
    LPSECURITY_ATTRIBUTES lpSA, DWORD dwCreate,
    DWORD dwFlags, HANDLE hTemplate)
{
    HANDLE h = Real_CreateFileW(
        lpFileName, dwAccess, dwShare, lpSA, dwCreate, dwFlags, hTemplate);
    return handle_file_open(h);
}

static BOOL WINAPI Hook_CloseHandle(HANDLE hObject) {
    if (g_max_open > 0 && ht_remove(hObject)) {
        InterlockedDecrement(&g_open_count);
    }
    return Real_CloseHandle(hObject);
}

static BOOL WINAPI Hook_WriteFile(
    HANDLE hFile, LPCVOID lpBuffer, DWORD nBytes,
    LPDWORD lpWritten, LPOVERLAPPED lpOverlapped)
{
    if (g_max_fsize > 0 && GetFileType(hFile) == FILE_TYPE_DISK) {
        LARGE_INTEGER size;
        if (GetFileSizeEx(hFile, &size)) {
            if (size.QuadPart + (LONG64)nBytes > g_max_fsize) {
                SetLastError(ERROR_FILE_TOO_LARGE);
                return FALSE;
            }
        }
    }
    return Real_WriteFile(hFile, lpBuffer, nBytes, lpWritten, lpOverlapped);
}

/* Patch newly loaded modules so future DLL loads are also covered */
static HMODULE WINAPI Hook_LoadLibraryA(LPCSTR path) {
    HMODULE h = Real_LoadLibraryA(path);
    if (h) patch_module_iat(h, g_hooks, N_HOOKS);
    return h;
}

static HMODULE WINAPI Hook_LoadLibraryW(LPCWSTR path) {
    HMODULE h = Real_LoadLibraryW(path);
    if (h) patch_module_iat(h, g_hooks, N_HOOKS);
    return h;
}

static HMODULE WINAPI Hook_LoadLibraryExA(LPCSTR path, HANDLE hFile, DWORD flags) {
    HMODULE h = Real_LoadLibraryExA(path, hFile, flags);
    if (h) patch_module_iat(h, g_hooks, N_HOOKS);
    return h;
}

static HMODULE WINAPI Hook_LoadLibraryExW(LPCWSTR path, HANDLE hFile, DWORD flags) {
    HMODULE h = Real_LoadLibraryExW(path, hFile, flags);
    if (h) patch_module_iat(h, g_hooks, N_HOOKS);
    return h;
}

/* ── DllMain ──────────────────────────────────────────────────────────────── */

BOOL WINAPI DllMain(HINSTANCE hDll, DWORD reason, LPVOID reserved) {
    (void)hDll; (void)reserved;

    if (reason != DLL_PROCESS_ATTACH) return TRUE;

    /* Read limits from env vars — physwrap.exe sets these before CreateProcess
     * so the child inherits them. We read once here; no runtime re-read. */
    char buf[32];
    DWORD len;

    len = GetEnvironmentVariableA("BUCCET_MAX_OPEN_FILES", buf, sizeof(buf));
    if (len > 0 && len < sizeof(buf)) {
        long long v = strtoll(buf, NULL, 10);
        if (v > 0) g_max_open = (LONG)v;
    }

    len = GetEnvironmentVariableA("BUCCET_MAX_FILE_SIZE_BYTES", buf, sizeof(buf));
    if (len > 0 && len < sizeof(buf)) {
        long long v = strtoll(buf, NULL, 10);
        if (v > 0) g_max_fsize = (LONG64)v;
    }

    /* Nothing to enforce — skip all hook setup */
    if (!g_max_open && !g_max_fsize) return TRUE;

    /* Initialize handle tracking */
    InitializeCriticalSection(&g_ht_cs);
    memset(g_ht, 0, sizeof(g_ht));

    /* Resolve original function pointers from kernel32.dll.
     * These are the real implementations. Our hooks call through these;
     * our own DLL's calls don't go through any patched IAT — no reentrancy. */
    HMODULE hK32 = GetModuleHandleA("kernel32.dll");
    Real_CreateFileA    = (FN_CreateFileA)   GetProcAddress(hK32, "CreateFileA");
    Real_CreateFileW    = (FN_CreateFileW)   GetProcAddress(hK32, "CreateFileW");
    Real_CloseHandle    = (FN_CloseHandle)   GetProcAddress(hK32, "CloseHandle");
    Real_WriteFile      = (FN_WriteFile)     GetProcAddress(hK32, "WriteFile");
    Real_LoadLibraryA   = (FN_LoadLibraryA)  GetProcAddress(hK32, "LoadLibraryA");
    Real_LoadLibraryW   = (FN_LoadLibraryW)  GetProcAddress(hK32, "LoadLibraryW");
    Real_LoadLibraryExA = (FN_LoadLibraryExA)GetProcAddress(hK32, "LoadLibraryExA");
    Real_LoadLibraryExW = (FN_LoadLibraryExW)GetProcAddress(hK32, "LoadLibraryExW");

    if (!Real_CreateFileA || !Real_CreateFileW ||
        !Real_CloseHandle || !Real_WriteFile) {
        /* kernel32.dll is always present; this path is unreachable in practice */
        return FALSE;
    }

    /* Patch IATs of all currently loaded modules.
     * The main thread is SUSPENDED at this point (physwrap ensures this),
     * so patching completes before any user code runs. */
    patch_all_loaded_modules();

    return TRUE;
}
