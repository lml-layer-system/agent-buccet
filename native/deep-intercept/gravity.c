/*
 * Agent Buccet deep intercept front-layer.
 *
 * This file is intentionally sensor-only:
 * - intercept libc-level operations
 * - serialize ACTION|TARGET|PID|EXTRA
 * - send to BUCCET_SOCKET_PATH
 * - wait for "1" or "0"
 * - deny on transport failure
 *
 * It does not own law, scope, approvals, ledger, or gravity decisions.
 */

#define _GNU_SOURCE
#include <arpa/inet.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <netinet/in.h>
#include <stdarg.h>
#include <stdio.h>
#include <spawn.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <sys/un.h>
#include <time.h>
#include <unistd.h>

#ifdef __APPLE__
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <mach/mach.h>
#endif

#define BUCCET_MAX_PAYLOAD 4096
#define BUCCET_POLL_MS 250

static int (*real_open)(const char*, int, ...) = NULL;
static int (*real_openat)(int, const char*, int, ...) = NULL;
static int (*real_renameat)(int, const char*, int, const char*) = NULL;
static int (*real_unlinkat)(int, const char*, int) = NULL;
static int (*real_mkdirat)(int, const char*, mode_t) = NULL;
static int (*real_fchmodat)(int, const char*, mode_t, int) = NULL;
static int (*real_fchownat)(int, const char*, uid_t, gid_t, int) = NULL;
static int (*real_linkat)(int, const char*, int, const char*, int) = NULL;
static int (*real_symlinkat)(const char*, int, const char*) = NULL;
static FILE* (*real_fopen)(const char*, const char*) = NULL;
static int (*real_creat)(const char*, mode_t) = NULL;
static int (*real_unlink)(const char*) = NULL;
static int (*real_remove)(const char*) = NULL;
static int (*real_rename)(const char*, const char*) = NULL;
static int (*real_mkdir)(const char*, mode_t) = NULL;
static int (*real_rmdir)(const char*) = NULL;
static int (*real_chmod)(const char*, mode_t) = NULL;
static int (*real_chown)(const char*, uid_t, gid_t) = NULL;
static int (*real_link)(const char*, const char*) = NULL;
static int (*real_symlink)(const char*, const char*) = NULL;
static ssize_t (*real_write)(int, const void*, size_t) = NULL;
static int (*real_execve)(const char*, char* const[], char* const[]) = NULL;
static int (*real_execv)(const char*, char* const[]) = NULL;
static int (*real_execvp)(const char*, char* const[]) = NULL;
static int (*real_posix_spawn)(pid_t*, const char*, const posix_spawn_file_actions_t*, const posix_spawnattr_t*, char* const[], char* const[]) = NULL;
static int (*real_posix_spawnp)(pid_t*, const char*, const posix_spawn_file_actions_t*, const posix_spawnattr_t*, char* const[], char* const[]) = NULL;
static int (*real_system)(const char*) = NULL;
static int (*real_connect)(int, const struct sockaddr*, socklen_t) = NULL;
static ssize_t (*real_sendto)(int, const void*, size_t, int, const struct sockaddr*, socklen_t) = NULL;
static ssize_t (*real_sendmsg)(int, const struct msghdr*, int) = NULL;
#ifdef __linux__
static int (*real_execvpe)(const char*, char* const[], char* const[]) = NULL;
static int (*real_sendmmsg)(int, struct mmsghdr*, unsigned int, int) = NULL;
#endif
static ssize_t (*real_read)(int, void*, size_t) = NULL;
static int (*real_close)(int) = NULL;
static int (*real_socket)(int, int, int) = NULL;

static int g_initialized = 0;
static __thread int g_buccet_internal = 0;

#ifdef __APPLE__
typedef struct {
    const char* name;
    void* replacement;
    void** replaced;
} buccet_rebinding_t;
#endif

static const char* gravity_socket_path(void) {
    const char* socket_path = getenv("BUCCET_SOCKET_PATH");
    if (socket_path && socket_path[0]) {
        return socket_path;
    }
    return "/tmp/buccet.sock";
}

static const char* brain_status_path(void) {
    const char* status_path = getenv("BUCCET_BRAIN_STATUS_PATH");
    if (status_path && status_path[0]) {
        return status_path;
    }
    return "";
}

static int buccet_retry_ms(void) {
    const char* raw = getenv("BUCCET_CONNECT_RETRY_MS");
    if (!raw || !raw[0]) {
        return BUCCET_POLL_MS;
    }
    int parsed = atoi(raw);
    return parsed > 0 ? parsed : BUCCET_POLL_MS;
}

static void buccet_sleep_ms(int milliseconds) {
    struct timespec ts;
    ts.tv_sec = milliseconds / 1000;
    ts.tv_nsec = (milliseconds % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}

static int brain_is_dead(void) {
    const char* status_path = brain_status_path();
    if (!status_path[0]) {
        return 0;
    }

    char buffer[1024];
    memset(buffer, 0, sizeof(buffer));

    g_buccet_internal += 1;
    int fd = real_open ? real_open(status_path, O_RDONLY) : -1;
    if (fd < 0) {
        g_buccet_internal -= 1;
        return 0;
    }
    ssize_t count = real_read ? real_read(fd, buffer, sizeof(buffer) - 1) : -1;
    if (real_close) {
        real_close(fd);
    } else {
        close(fd);
    }
    g_buccet_internal -= 1;

    if (count <= 0) {
        return 0;
    }

    return strstr(buffer, "\"state\": \"dead\"") != NULL || strstr(buffer, "\"state\":\"dead\"") != NULL;
}

#ifdef __APPLE__
static buccet_rebinding_t g_buccet_rebindings[] = {
    { "open", (void*)open, (void**)&real_open },
    { "openat", (void*)openat, (void**)&real_openat },
    { "renameat", (void*)renameat, (void**)&real_renameat },
    { "unlinkat", (void*)unlinkat, (void**)&real_unlinkat },
    { "mkdirat", (void*)mkdirat, (void**)&real_mkdirat },
    { "fchmodat", (void*)fchmodat, (void**)&real_fchmodat },
    { "fchownat", (void*)fchownat, (void**)&real_fchownat },
    { "linkat", (void*)linkat, (void**)&real_linkat },
    { "symlinkat", (void*)symlinkat, (void**)&real_symlinkat },
    { "fopen", (void*)fopen, (void**)&real_fopen },
    { "creat", (void*)creat, (void**)&real_creat },
    { "unlink", (void*)unlink, (void**)&real_unlink },
    { "remove", (void*)remove, (void**)&real_remove },
    { "rename", (void*)rename, (void**)&real_rename },
    { "mkdir", (void*)mkdir, (void**)&real_mkdir },
    { "rmdir", (void*)rmdir, (void**)&real_rmdir },
    { "chmod", (void*)chmod, (void**)&real_chmod },
    { "chown", (void*)chown, (void**)&real_chown },
    { "link", (void*)link, (void**)&real_link },
    { "symlink", (void*)symlink, (void**)&real_symlink },
    { "execve", (void*)execve, (void**)&real_execve },
    { "execv", (void*)execv, (void**)&real_execv },
    { "execvp", (void*)execvp, (void**)&real_execvp },
    { "posix_spawn", (void*)posix_spawn, (void**)&real_posix_spawn },
    { "posix_spawnp", (void*)posix_spawnp, (void**)&real_posix_spawnp },
    { "system", (void*)system, (void**)&real_system },
    { "connect", (void*)connect, (void**)&real_connect },
    { "sendto", (void*)sendto, (void**)&real_sendto },
    { "sendmsg", (void*)sendmsg, (void**)&real_sendmsg },
#ifdef __linux__
    { "execvpe", (void*)execvpe, (void**)&real_execvpe },
    { "sendmmsg", (void*)sendmmsg, (void**)&real_sendmmsg },
#endif
};

static size_t g_buccet_rebinding_count = sizeof(g_buccet_rebindings) / sizeof(g_buccet_rebindings[0]);

static int buccet_symbol_matches(const char* symbol_name, const char* expected) {
    if (!symbol_name || !expected) {
        return 0;
    }
    if (symbol_name[0] == '_') {
        symbol_name += 1;
    }
    return strcmp(symbol_name, expected) == 0;
}

static void buccet_rebind_section(
    intptr_t slide,
    const struct section_64* section,
    const struct symtab_command* symtab_cmd,
    const struct dysymtab_command* dysymtab_cmd,
    struct nlist_64* symbols,
    char* strings,
    uint32_t* indirect_symbols
) {
    uint32_t section_type = section->flags & SECTION_TYPE;
    if (section_type != S_LAZY_SYMBOL_POINTERS && section_type != S_NON_LAZY_SYMBOL_POINTERS) {
        return;
    }

    void** bindings = (void**)((uintptr_t)slide + section->addr);
    uint32_t* section_indirect_symbols = indirect_symbols + section->reserved1;
    size_t binding_count = section->size / sizeof(void*);

    vm_size_t page_size = (vm_size_t)getpagesize();
    vm_address_t region_start = ((vm_address_t)bindings) & ~(page_size - 1);
    vm_address_t region_end = (((vm_address_t)bindings + section->size + page_size - 1) & ~(page_size - 1));
    vm_size_t region_size = region_end - region_start;
    vm_protect(mach_task_self(), region_start, region_size, 0, VM_PROT_READ | VM_PROT_WRITE | VM_PROT_COPY);

    for (size_t index = 0; index < binding_count; index += 1) {
        uint32_t symbol_index = section_indirect_symbols[index];
        if (symbol_index == INDIRECT_SYMBOL_ABS ||
            symbol_index == INDIRECT_SYMBOL_LOCAL ||
            symbol_index == (INDIRECT_SYMBOL_ABS | INDIRECT_SYMBOL_LOCAL) ||
            symbol_index >= symtab_cmd->nsyms) {
            continue;
        }

        const char* symbol_name = strings + symbols[symbol_index].n_un.n_strx;
        for (size_t rebinding_index = 0; rebinding_index < g_buccet_rebinding_count; rebinding_index += 1) {
            buccet_rebinding_t* rebinding = &g_buccet_rebindings[rebinding_index];
            if (!buccet_symbol_matches(symbol_name, rebinding->name)) {
                continue;
            }

            if (rebinding->replaced && *rebinding->replaced == NULL) {
                *rebinding->replaced = bindings[index];
            }
            bindings[index] = rebinding->replacement;
            break;
        }
    }

    if (strcmp(section->segname, "__DATA_CONST") == 0) {
        vm_protect(mach_task_self(), region_start, region_size, 0, VM_PROT_READ);
    }
}

static void buccet_rebind_image(const struct mach_header* header, intptr_t slide) {
    if (!header || header->magic != MH_MAGIC_64) {
        return;
    }

    const struct mach_header_64* mach_header = (const struct mach_header_64*)header;
    const struct load_command* command = (const struct load_command*)(mach_header + 1);
    const struct segment_command_64* linkedit_segment = NULL;
    const struct symtab_command* symtab_cmd = NULL;
    const struct dysymtab_command* dysymtab_cmd = NULL;

    for (uint32_t index = 0; index < mach_header->ncmds; index += 1) {
        if (command->cmd == LC_SEGMENT_64) {
            const struct segment_command_64* segment = (const struct segment_command_64*)command;
            if (strcmp(segment->segname, SEG_LINKEDIT) == 0) {
                linkedit_segment = segment;
            }
        } else if (command->cmd == LC_SYMTAB) {
            symtab_cmd = (const struct symtab_command*)command;
        } else if (command->cmd == LC_DYSYMTAB) {
            dysymtab_cmd = (const struct dysymtab_command*)command;
        }
        command = (const struct load_command*)((const char*)command + command->cmdsize);
    }

    if (!linkedit_segment || !symtab_cmd || !dysymtab_cmd) {
        return;
    }

    uintptr_t linkedit_base = (uintptr_t)slide + linkedit_segment->vmaddr - linkedit_segment->fileoff;
    struct nlist_64* symbols = (struct nlist_64*)(linkedit_base + symtab_cmd->symoff);
    char* strings = (char*)(linkedit_base + symtab_cmd->stroff);
    uint32_t* indirect_symbols = (uint32_t*)(linkedit_base + dysymtab_cmd->indirectsymoff);

    command = (const struct load_command*)(mach_header + 1);
    for (uint32_t index = 0; index < mach_header->ncmds; index += 1) {
        if (command->cmd == LC_SEGMENT_64) {
            const struct segment_command_64* segment = (const struct segment_command_64*)command;
            if (strcmp(segment->segname, SEG_DATA) == 0 || strcmp(segment->segname, "__DATA_CONST") == 0) {
                const struct section_64* section = (const struct section_64*)(segment + 1);
                for (uint32_t section_index = 0; section_index < segment->nsects; section_index += 1) {
                    buccet_rebind_section(slide, section + section_index, symtab_cmd, dysymtab_cmd, symbols, strings, indirect_symbols);
                }
            }
        }
        command = (const struct load_command*)((const char*)command + command->cmdsize);
    }
}

static void buccet_register_rebindings(void) {
    static int registered = 0;
    if (registered) {
        return;
    }
    registered = 1;
    _dyld_register_func_for_add_image(buccet_rebind_image);
}
#endif

static void gravity_init(void) {
    if (g_initialized) return;

    real_open = dlsym(RTLD_NEXT, "open");
    real_openat = dlsym(RTLD_NEXT, "openat");
    real_renameat = dlsym(RTLD_NEXT, "renameat");
    real_unlinkat = dlsym(RTLD_NEXT, "unlinkat");
    real_mkdirat = dlsym(RTLD_NEXT, "mkdirat");
    real_fchmodat = dlsym(RTLD_NEXT, "fchmodat");
    real_fchownat = dlsym(RTLD_NEXT, "fchownat");
    real_linkat = dlsym(RTLD_NEXT, "linkat");
    real_symlinkat = dlsym(RTLD_NEXT, "symlinkat");
    real_fopen = dlsym(RTLD_NEXT, "fopen");
    real_creat = dlsym(RTLD_NEXT, "creat");
    real_unlink = dlsym(RTLD_NEXT, "unlink");
    real_remove = dlsym(RTLD_NEXT, "remove");
    real_rename = dlsym(RTLD_NEXT, "rename");
    real_mkdir = dlsym(RTLD_NEXT, "mkdir");
    real_rmdir = dlsym(RTLD_NEXT, "rmdir");
    real_chmod = dlsym(RTLD_NEXT, "chmod");
    real_chown = dlsym(RTLD_NEXT, "chown");
    real_link = dlsym(RTLD_NEXT, "link");
    real_symlink = dlsym(RTLD_NEXT, "symlink");
    real_write = dlsym(RTLD_NEXT, "write");
    real_execve = dlsym(RTLD_NEXT, "execve");
    real_execv = dlsym(RTLD_NEXT, "execv");
    real_execvp = dlsym(RTLD_NEXT, "execvp");
    real_posix_spawn = dlsym(RTLD_NEXT, "posix_spawn");
    real_posix_spawnp = dlsym(RTLD_NEXT, "posix_spawnp");
    real_system = dlsym(RTLD_NEXT, "system");
    real_connect = dlsym(RTLD_NEXT, "connect");
    real_sendto = dlsym(RTLD_NEXT, "sendto");
    real_sendmsg = dlsym(RTLD_NEXT, "sendmsg");
#ifdef __linux__
    real_execvpe = dlsym(RTLD_NEXT, "execvpe");
    real_sendmmsg = dlsym(RTLD_NEXT, "sendmmsg");
#endif
    real_read = dlsym(RTLD_NEXT, "read");
    real_close = dlsym(RTLD_NEXT, "close");
    real_socket = dlsym(RTLD_NEXT, "socket");

    g_initialized = 1;
}

__attribute__((constructor))
static void gravity_constructor(void) {
    gravity_init();
#ifdef __APPLE__
    buccet_register_rebindings();
#endif
}

static int is_payload_safe_char(unsigned char ch) {
    return ch >= 0x20 && ch <= 0x7E && ch != '%' && ch != '|';
}

static void encode_payload_component(const char* input, char* output, size_t size) {
    if (!output || size == 0) {
        return;
    }
    output[0] = '\0';
    if (!input) {
        return;
    }

    size_t out = 0;
    for (size_t index = 0; input[index] != '\0'; index += 1) {
        unsigned char ch = (unsigned char)input[index];
        if (is_payload_safe_char(ch)) {
            if (out + 1 >= size) {
                break;
            }
            output[out++] = (char)ch;
            continue;
        }

        if (out + 3 >= size) {
            break;
        }
        snprintf(output + out, size - out, "%%%02X", ch);
        out += 3;
    }
    output[out] = '\0';
}

static int ask_buccet(const char* action, const char* target, const char* extra) {
    struct sockaddr_un addr;
    char payload[BUCCET_MAX_PAYLOAD];
    char encoded_target[BUCCET_MAX_PAYLOAD];
    char encoded_extra[BUCCET_MAX_PAYLOAD];
    pid_t pid = getpid();

    encode_payload_component(target ? target : "", encoded_target, sizeof(encoded_target));
    encode_payload_component(extra ? extra : "", encoded_extra, sizeof(encoded_extra));

    if (encoded_extra[0]) {
        snprintf(payload, sizeof(payload), "%s|%s|%d|%s\n", action, encoded_target, pid, encoded_extra);
    } else {
        snprintf(payload, sizeof(payload), "%s|%s|%d|\n", action, encoded_target, pid);
    }

    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, gravity_socket_path(), sizeof(addr.sun_path) - 1);

    for (;;) {
        if (brain_is_dead()) {
            return 0;
        }

        g_buccet_internal += 1;
        int sock = real_socket ? real_socket(AF_UNIX, SOCK_STREAM, 0) : socket(AF_UNIX, SOCK_STREAM, 0);
        g_buccet_internal -= 1;
        if (sock < 0) {
            buccet_sleep_ms(buccet_retry_ms());
            continue;
        }

        g_buccet_internal += 1;
        int connected = real_connect ? real_connect(sock, (struct sockaddr*)&addr, sizeof(addr)) : connect(sock, (struct sockaddr*)&addr, sizeof(addr));
        g_buccet_internal -= 1;
        if (connected < 0) {
            if (real_close) {
                real_close(sock);
            } else {
                close(sock);
            }
            buccet_sleep_ms(buccet_retry_ms());
            continue;
        }

        g_buccet_internal += 1;
        ssize_t sent = real_write ? real_write(sock, payload, strlen(payload)) : write(sock, payload, strlen(payload));
        g_buccet_internal -= 1;
        if (sent <= 0) {
            if (real_close) {
                real_close(sock);
            } else {
                close(sock);
            }
            buccet_sleep_ms(buccet_retry_ms());
            continue;
        }

        for (;;) {
            if (brain_is_dead()) {
                if (real_close) {
                    real_close(sock);
                } else {
                    close(sock);
                }
                return 0;
            }

            fd_set set;
            FD_ZERO(&set);
            FD_SET(sock, &set);
            struct timeval timeout;
            timeout.tv_sec = 0;
            timeout.tv_usec = buccet_retry_ms() * 1000;

            int ready = select(sock + 1, &set, NULL, NULL, &timeout);
            if (ready < 0) {
                if (errno == EINTR) {
                    continue;
                }
                break;
            }
            if (ready == 0) {
                continue;
            }

            char response[2] = {0};
            g_buccet_internal += 1;
            ssize_t received = real_read ? real_read(sock, response, 1) : read(sock, response, 1);
            g_buccet_internal -= 1;
            if (received == 1) {
                if (real_close) {
                    real_close(sock);
                } else {
                    close(sock);
                }
                return response[0] == '1' ? 1 : 0;
            }
            break;
        }

        if (real_close) {
            real_close(sock);
        } else {
            close(sock);
        }
        buccet_sleep_ms(buccet_retry_ms());
    }
}

static void resolve_path(const char* path, char* resolved, size_t size) {
    if (!path || !resolved) return;

    if (path[0] == '/') {
        strncpy(resolved, path, size - 1);
        resolved[size - 1] = '\0';
    } else {
        char cwd[PATH_MAX];
        if (getcwd(cwd, sizeof(cwd))) {
            snprintf(resolved, size, "%s/%s", cwd, path);
        } else {
            strncpy(resolved, path, size - 1);
            resolved[size - 1] = '\0';
        }
    }
}

static void join_path(const char* base, const char* leaf, char* resolved, size_t size) {
    if (!resolved || size == 0) return;
    if (!base || !base[0]) {
        strncpy(resolved, leaf ? leaf : "", size - 1);
        resolved[size - 1] = '\0';
        return;
    }
    if (!leaf || !leaf[0]) {
        strncpy(resolved, base, size - 1);
        resolved[size - 1] = '\0';
        return;
    }
    if (base[strlen(base) - 1] == '/') {
        snprintf(resolved, size, "%s%s", base, leaf);
    } else {
        snprintf(resolved, size, "%s/%s", base, leaf);
    }
}

static void resolve_parent_dir(const char* path, char* resolved, size_t size) {
    if (!resolved || size == 0) return;
    resolved[0] = '\0';
    if (!path || !path[0]) {
        return;
    }

    strncpy(resolved, path, size - 1);
    resolved[size - 1] = '\0';
    char* slash = strrchr(resolved, '/');
    if (!slash) {
        if (getcwd(resolved, size) == NULL) {
            resolved[0] = '.';
            resolved[1] = '\0';
        }
        return;
    }
    if (slash == resolved) {
        slash[1] = '\0';
        return;
    }
    *slash = '\0';
}

static int resolve_dirfd_base(int dirfd, char* resolved, size_t size) {
    if (!resolved || size == 0) return 0;
    resolved[0] = '\0';

    if (dirfd == AT_FDCWD) {
        return getcwd(resolved, size) != NULL;
    }

#ifdef __APPLE__
    g_buccet_internal += 1;
    int status = fcntl(dirfd, F_GETPATH, resolved);
    g_buccet_internal -= 1;
    return status == 0 && resolved[0] != '\0';
#else
    char proc_path[64];
    snprintf(proc_path, sizeof(proc_path), "/proc/self/fd/%d", dirfd);
    g_buccet_internal += 1;
    ssize_t count = readlink(proc_path, resolved, size - 1);
    g_buccet_internal -= 1;
    if (count <= 0) {
        resolved[0] = '\0';
        return 0;
    }
    resolved[count] = '\0';
    return 1;
#endif
}

static void resolve_path_at(int dirfd, const char* pathname, char* resolved, size_t size) {
    if (!pathname || !resolved) return;

    if (pathname[0] == '/' || dirfd == AT_FDCWD) {
        resolve_path(pathname, resolved, size);
        return;
    }

    char base[PATH_MAX];
    memset(base, 0, sizeof(base));
    if (!resolve_dirfd_base(dirfd, base, sizeof(base))) {
        resolve_path(pathname, resolved, size);
        return;
    }

    join_path(base, pathname, resolved, size);
}

static void resolve_symlink_target(const char* target, const char* resolved_linkpath, char* resolved, size_t size) {
    if (!target || !resolved) return;

    if (target[0] == '/') {
        resolve_path(target, resolved, size);
        return;
    }

    char parent[PATH_MAX];
    memset(parent, 0, sizeof(parent));
    resolve_parent_dir(resolved_linkpath, parent, sizeof(parent));
    if (!parent[0]) {
        resolve_path(target, resolved, size);
        return;
    }
    join_path(parent, target, resolved, size);
}

static int resolve_executable_path(const char* file, char* resolved, size_t size) {
    if (!file || !file[0] || !resolved || size == 0) {
        return 0;
    }

    if (strchr(file, '/')) {
        resolve_path(file, resolved, size);
        return 1;
    }

    const char* path_env = getenv("PATH");
    if (!path_env || !path_env[0]) {
        strncpy(resolved, file, size - 1);
        resolved[size - 1] = '\0';
        return 0;
    }

    char* path_copy = strdup(path_env);
    if (!path_copy) {
        strncpy(resolved, file, size - 1);
        resolved[size - 1] = '\0';
        return 0;
    }

    int found = 0;
    char* cursor = path_copy;
    char candidate[PATH_MAX];
    while (1) {
        char* entry = strsep(&cursor, ":");
        if (!entry) break;
        const char* base = entry[0] ? entry : ".";
        join_path(base, file, candidate, sizeof(candidate));
        if (access(candidate, X_OK) == 0) {
            resolve_path(candidate, resolved, size);
            found = 1;
            break;
        }
    }

    free(path_copy);
    if (!found) {
        strncpy(resolved, file, size - 1);
        resolved[size - 1] = '\0';
    }
    return found;
}

static void format_socket_target(const struct sockaddr* addr, char* target, size_t size) {
    strncpy(target, "unknown", size - 1);
    target[size - 1] = '\0';

    if (!addr) {
        return;
    }

    if (addr->sa_family == AF_INET) {
        const struct sockaddr_in* addr_in = (const struct sockaddr_in*)addr;
        snprintf(target, size, "%s:%d", inet_ntoa(addr_in->sin_addr), ntohs(addr_in->sin_port));
        return;
    }

    if (addr->sa_family == AF_INET6) {
        const struct sockaddr_in6* addr_in6 = (const struct sockaddr_in6*)addr;
        char ip6[INET6_ADDRSTRLEN];
        inet_ntop(AF_INET6, &addr_in6->sin6_addr, ip6, sizeof(ip6));
        snprintf(target, size, "[%s]:%d", ip6, ntohs(addr_in6->sin6_port));
        return;
    }

    if (addr->sa_family == AF_UNIX) {
        const struct sockaddr_un* addr_un = (const struct sockaddr_un*)addr;
        snprintf(target, size, "unix:%s", addr_un->sun_path);
    }
}

static int is_buccet_socket_addr(const struct sockaddr* addr) {
    if (!addr || addr->sa_family != AF_UNIX) {
        return 0;
    }
    const struct sockaddr_un* addr_un = (const struct sockaddr_un*)addr;
    return strcmp(addr_un->sun_path, gravity_socket_path()) == 0;
}

static int resolve_peer_socket_addr(int sockfd, struct sockaddr_storage* storage, socklen_t* size) {
    if (!storage || !size) {
        return 0;
    }
    memset(storage, 0, sizeof(*storage));
    *size = sizeof(*storage);
    return getpeername(sockfd, (struct sockaddr*)storage, size) == 0;
}

int open(const char* pathname, int flags, ...) {
    gravity_init();
    if (g_buccet_internal) {
        if (flags & O_CREAT) {
            mode_t mode = 0;
            va_list args;
            va_start(args, flags);
            mode = (mode_t)va_arg(args, int);
            va_end(args);
            return real_open(pathname, flags, mode);
        }
        return real_open(pathname, flags);
    }

    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = (mode_t)va_arg(args, int);
        va_end(args);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));

    const char* action = "read";
    if (flags & (O_WRONLY | O_RDWR | O_CREAT | O_TRUNC | O_APPEND)) {
        action = "write";
    }

    if (!ask_buccet(action, resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_open(pathname, flags, mode);
}

int openat(int dirfd, const char* pathname, int flags, ...) {
    gravity_init();
    if (g_buccet_internal) {
        if (flags & O_CREAT) {
            mode_t mode = 0;
            va_list args;
            va_start(args, flags);
            mode = (mode_t)va_arg(args, int);
            va_end(args);
            return real_openat(dirfd, pathname, flags, mode);
        }
        return real_openat(dirfd, pathname, flags);
    }

    mode_t mode = 0;
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode = (mode_t)va_arg(args, int);
        va_end(args);
    }

    char resolved[PATH_MAX];
    resolve_path_at(dirfd, pathname, resolved, sizeof(resolved));

    const char* action = "read";
    if (flags & (O_WRONLY | O_RDWR | O_CREAT | O_TRUNC | O_APPEND)) {
        action = "write";
    }

    if (!ask_buccet(action, resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_openat(dirfd, pathname, flags, mode);
}

int renameat(int olddirfd, const char* oldpath, int newdirfd, const char* newpath) {
    gravity_init();
    if (g_buccet_internal) {
        return real_renameat(olddirfd, oldpath, newdirfd, newpath);
    }

    char resolved_old[PATH_MAX], resolved_new[PATH_MAX];
    resolve_path_at(olddirfd, oldpath, resolved_old, sizeof(resolved_old));
    resolve_path_at(newdirfd, newpath, resolved_new, sizeof(resolved_new));

    if (!ask_buccet("rename", resolved_old, resolved_new)) {
        errno = EACCES;
        return -1;
    }

    return real_renameat(olddirfd, oldpath, newdirfd, newpath);
}

int unlinkat(int dirfd, const char* pathname, int flags) {
    gravity_init();
    if (g_buccet_internal) {
        return real_unlinkat(dirfd, pathname, flags);
    }

    char resolved[PATH_MAX];
    resolve_path_at(dirfd, pathname, resolved, sizeof(resolved));
    const char* action = (flags & AT_REMOVEDIR) ? "rmdir" : "delete";

    if (!ask_buccet(action, resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_unlinkat(dirfd, pathname, flags);
}

int mkdirat(int dirfd, const char* pathname, mode_t mode) {
    gravity_init();
    if (g_buccet_internal) {
        return real_mkdirat(dirfd, pathname, mode);
    }

    char resolved[PATH_MAX];
    resolve_path_at(dirfd, pathname, resolved, sizeof(resolved));

    if (!ask_buccet("mkdir", resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_mkdirat(dirfd, pathname, mode);
}

int fchmodat(int dirfd, const char* pathname, mode_t mode, int flags) {
    gravity_init();
    if (g_buccet_internal) {
        return real_fchmodat(dirfd, pathname, mode, flags);
    }

    char resolved[PATH_MAX];
    resolve_path_at(dirfd, pathname, resolved, sizeof(resolved));
    char extra[32];
    snprintf(extra, sizeof(extra), "%o", mode);

    if (!ask_buccet("chmod", resolved, extra)) {
        errno = EACCES;
        return -1;
    }

    return real_fchmodat(dirfd, pathname, mode, flags);
}

int fchownat(int dirfd, const char* pathname, uid_t owner, gid_t group, int flags) {
    gravity_init();
    if (g_buccet_internal) {
        return real_fchownat(dirfd, pathname, owner, group, flags);
    }

    char resolved[PATH_MAX];
    resolve_path_at(dirfd, pathname, resolved, sizeof(resolved));
    char extra[64];
    snprintf(extra, sizeof(extra), "%d:%d", owner, group);

    if (!ask_buccet("chown", resolved, extra)) {
        errno = EACCES;
        return -1;
    }

    return real_fchownat(dirfd, pathname, owner, group, flags);
}

int linkat(int olddirfd, const char* oldpath, int newdirfd, const char* newpath, int flags) {
    gravity_init();
    if (g_buccet_internal) {
        return real_linkat(olddirfd, oldpath, newdirfd, newpath, flags);
    }

    char resolved_old[PATH_MAX], resolved_new[PATH_MAX];
    resolve_path_at(olddirfd, oldpath, resolved_old, sizeof(resolved_old));
    resolve_path_at(newdirfd, newpath, resolved_new, sizeof(resolved_new));

    if (!ask_buccet("link", resolved_old, resolved_new)) {
        errno = EACCES;
        return -1;
    }

    return real_linkat(olddirfd, oldpath, newdirfd, newpath, flags);
}

int symlinkat(const char* target, int newdirfd, const char* linkpath) {
    gravity_init();
    if (g_buccet_internal) {
        return real_symlinkat(target, newdirfd, linkpath);
    }

    char resolved_link[PATH_MAX];
    char resolved_target[PATH_MAX];
    resolve_path_at(newdirfd, linkpath, resolved_link, sizeof(resolved_link));
    resolve_symlink_target(target, resolved_link, resolved_target, sizeof(resolved_target));

    if (!ask_buccet("symlink", resolved_link, resolved_target)) {
        errno = EACCES;
        return -1;
    }

    return real_symlinkat(target, newdirfd, linkpath);
}

FILE* fopen(const char* pathname, const char* mode) {
    gravity_init();
    if (g_buccet_internal) {
        return real_fopen(pathname, mode);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));

    const char* action = "read";
    if (strchr(mode, 'w') || strchr(mode, 'a') || strchr(mode, '+')) {
        action = "write";
    }

    if (!ask_buccet(action, resolved, mode)) {
        errno = EACCES;
        return NULL;
    }

    return real_fopen(pathname, mode);
}

int creat(const char* pathname, mode_t mode) {
    gravity_init();
    if (g_buccet_internal) {
        return real_creat(pathname, mode);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));

    if (!ask_buccet("create", resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_creat(pathname, mode);
}

int unlink(const char* pathname) {
    gravity_init();
    if (g_buccet_internal) {
        return real_unlink(pathname);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));

    if (!ask_buccet("delete", resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_unlink(pathname);
}

int remove(const char* pathname) {
    gravity_init();
    if (g_buccet_internal) {
        return real_remove(pathname);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));

    if (!ask_buccet("delete", resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_remove(pathname);
}

int rename(const char* oldpath, const char* newpath) {
    gravity_init();
    if (g_buccet_internal) {
        return real_rename(oldpath, newpath);
    }

    char resolved_old[PATH_MAX], resolved_new[PATH_MAX];
    resolve_path(oldpath, resolved_old, sizeof(resolved_old));
    resolve_path(newpath, resolved_new, sizeof(resolved_new));

    if (!ask_buccet("rename", resolved_old, resolved_new)) {
        errno = EACCES;
        return -1;
    }

    return real_rename(oldpath, newpath);
}

int mkdir(const char* pathname, mode_t mode) {
    gravity_init();
    if (g_buccet_internal) {
        return real_mkdir(pathname, mode);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));

    if (!ask_buccet("mkdir", resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_mkdir(pathname, mode);
}

int rmdir(const char* pathname) {
    gravity_init();
    if (g_buccet_internal) {
        return real_rmdir(pathname);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));

    if (!ask_buccet("rmdir", resolved, "")) {
        errno = EACCES;
        return -1;
    }

    return real_rmdir(pathname);
}

int chmod(const char* pathname, mode_t mode) {
    gravity_init();
    if (g_buccet_internal) {
        return real_chmod(pathname, mode);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));
    char extra[32];
    snprintf(extra, sizeof(extra), "%o", mode);

    if (!ask_buccet("chmod", resolved, extra)) {
        errno = EACCES;
        return -1;
    }

    return real_chmod(pathname, mode);
}

int chown(const char* pathname, uid_t owner, gid_t group) {
    gravity_init();
    if (g_buccet_internal) {
        return real_chown(pathname, owner, group);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));
    char extra[64];
    snprintf(extra, sizeof(extra), "%d:%d", owner, group);

    if (!ask_buccet("chown", resolved, extra)) {
        errno = EACCES;
        return -1;
    }

    return real_chown(pathname, owner, group);
}

int link(const char* oldpath, const char* newpath) {
    gravity_init();
    if (g_buccet_internal) {
        return real_link(oldpath, newpath);
    }

    char resolved_old[PATH_MAX], resolved_new[PATH_MAX];
    resolve_path(oldpath, resolved_old, sizeof(resolved_old));
    resolve_path(newpath, resolved_new, sizeof(resolved_new));

    if (!ask_buccet("link", resolved_old, resolved_new)) {
        errno = EACCES;
        return -1;
    }

    return real_link(oldpath, newpath);
}

int symlink(const char* target, const char* linkpath) {
    gravity_init();
    if (g_buccet_internal) {
        return real_symlink(target, linkpath);
    }

    char resolved_link[PATH_MAX];
    char resolved_target[PATH_MAX];
    resolve_path(linkpath, resolved_link, sizeof(resolved_link));
    resolve_symlink_target(target, resolved_link, resolved_target, sizeof(resolved_target));

    if (!ask_buccet("symlink", resolved_link, resolved_target)) {
        errno = EACCES;
        return -1;
    }

    return real_symlink(target, linkpath);
}

int execve(const char* pathname, char* const argv[], char* const envp[]) {
    gravity_init();
    if (g_buccet_internal) {
        return real_execve(pathname, argv, envp);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));
    char cmdline[BUCCET_MAX_PAYLOAD] = "";
    for (int i = 0; argv[i] && strlen(cmdline) < BUCCET_MAX_PAYLOAD - 256; i++) {
        if (i > 0) strcat(cmdline, " ");
        strncat(cmdline, argv[i], 255);
    }

    if (!ask_buccet("exec", resolved, cmdline)) {
        errno = EACCES;
        return -1;
    }

    return real_execve(pathname, argv, envp);
}

int execv(const char* pathname, char* const argv[]) {
    gravity_init();
    if (g_buccet_internal) {
        return real_execv(pathname, argv);
    }

    char resolved[PATH_MAX];
    resolve_path(pathname, resolved, sizeof(resolved));
    char cmdline[BUCCET_MAX_PAYLOAD] = "";
    for (int i = 0; argv[i] && strlen(cmdline) < BUCCET_MAX_PAYLOAD - 256; i++) {
        if (i > 0) strcat(cmdline, " ");
        strncat(cmdline, argv[i], 255);
    }

    if (!ask_buccet("exec", resolved, cmdline)) {
        errno = EACCES;
        return -1;
    }

    return real_execv(pathname, argv);
}

int execvp(const char* file, char* const argv[]) {
    gravity_init();
    if (g_buccet_internal) {
        return real_execvp(file, argv);
    }

    char resolved[PATH_MAX];
    resolve_executable_path(file, resolved, sizeof(resolved));
    char cmdline[BUCCET_MAX_PAYLOAD] = "";
    for (int i = 0; argv[i] && strlen(cmdline) < BUCCET_MAX_PAYLOAD - 256; i++) {
        if (i > 0) strcat(cmdline, " ");
        strncat(cmdline, argv[i], 255);
    }

    if (!ask_buccet("exec", resolved, cmdline)) {
        errno = EACCES;
        return -1;
    }

    return real_execvp(file, argv);
}

int posix_spawn(
    pid_t* pid,
    const char* path,
    const posix_spawn_file_actions_t* file_actions,
    const posix_spawnattr_t* attrp,
    char* const argv[],
    char* const envp[]
) {
    gravity_init();
    if (g_buccet_internal) {
        return real_posix_spawn(pid, path, file_actions, attrp, argv, envp);
    }

    char resolved[PATH_MAX];
    resolve_path(path, resolved, sizeof(resolved));
    char cmdline[BUCCET_MAX_PAYLOAD] = "";
    for (int i = 0; argv && argv[i] && strlen(cmdline) < BUCCET_MAX_PAYLOAD - 256; i++) {
        if (i > 0) strcat(cmdline, " ");
        strncat(cmdline, argv[i], 255);
    }

    if (!ask_buccet("exec", resolved, cmdline)) {
        return EACCES;
    }

    return real_posix_spawn(pid, path, file_actions, attrp, argv, envp);
}

int posix_spawnp(
    pid_t* pid,
    const char* file,
    const posix_spawn_file_actions_t* file_actions,
    const posix_spawnattr_t* attrp,
    char* const argv[],
    char* const envp[]
) {
    gravity_init();
    if (g_buccet_internal) {
        return real_posix_spawnp(pid, file, file_actions, attrp, argv, envp);
    }

    char resolved[PATH_MAX];
    resolve_executable_path(file, resolved, sizeof(resolved));
    char cmdline[BUCCET_MAX_PAYLOAD] = "";
    for (int i = 0; argv && argv[i] && strlen(cmdline) < BUCCET_MAX_PAYLOAD - 256; i++) {
        if (i > 0) strcat(cmdline, " ");
        strncat(cmdline, argv[i], 255);
    }

    if (!ask_buccet("exec", resolved, cmdline)) {
        return EACCES;
    }

    return real_posix_spawnp(pid, file, file_actions, attrp, argv, envp);
}

#ifdef __linux__
int execvpe(const char* file, char* const argv[], char* const envp[]) {
    gravity_init();
    if (g_buccet_internal) {
        return real_execvpe(file, argv, envp);
    }

    char resolved[PATH_MAX];
    resolve_executable_path(file, resolved, sizeof(resolved));
    char cmdline[BUCCET_MAX_PAYLOAD] = "";
    for (int i = 0; argv && argv[i] && strlen(cmdline) < BUCCET_MAX_PAYLOAD - 256; i++) {
        if (i > 0) strcat(cmdline, " ");
        strncat(cmdline, argv[i], 255);
    }

    if (!ask_buccet("exec", resolved, cmdline)) {
        errno = EACCES;
        return -1;
    }

    return real_execvpe(file, argv, envp);
}
#endif

int system(const char* command) {
    gravity_init();
    if (g_buccet_internal) {
        return real_system(command);
    }

    if (!command) return real_system(command);
    if (!ask_buccet("system", command, "")) {
        errno = EACCES;
        return -1;
    }

    return real_system(command);
}

int connect(int sockfd, const struct sockaddr* addr, socklen_t addrlen) {
    gravity_init();
    if (g_buccet_internal) {
        return real_connect(sockfd, addr, addrlen);
    }

    char target[256];
    format_socket_target(addr, target, sizeof(target));
    if (is_buccet_socket_addr(addr)) {
        return real_connect(sockfd, addr, addrlen);
    }

    if (!ask_buccet("connect", target, "")) {
        errno = EACCES;
        return -1;
    }

    return real_connect(sockfd, addr, addrlen);
}

static int resolve_send_target(int sockfd, const struct sockaddr* addr, char* target, size_t size) {
    if (addr) {
        if (is_buccet_socket_addr(addr)) {
            return -1;
        }
        format_socket_target(addr, target, size);
        return 1;
    }

    struct sockaddr_storage peer;
    socklen_t peer_size = 0;
    if (!resolve_peer_socket_addr(sockfd, &peer, &peer_size)) {
        return 0;
    }
    if (is_buccet_socket_addr((const struct sockaddr*)&peer)) {
        return -1;
    }
    format_socket_target((const struct sockaddr*)&peer, target, size);
    return 1;
}

ssize_t sendto(int sockfd, const void* buf, size_t len, int flags, const struct sockaddr* dest_addr, socklen_t addrlen) {
    gravity_init();
    if (g_buccet_internal) {
        return real_sendto(sockfd, buf, len, flags, dest_addr, addrlen);
    }

    char target[256];
    int target_state = resolve_send_target(sockfd, dest_addr, target, sizeof(target));
    if (target_state < 0) {
        return real_sendto(sockfd, buf, len, flags, dest_addr, addrlen);
    }
    if (target_state == 0) {
        return real_sendto(sockfd, buf, len, flags, dest_addr, addrlen);
    }

    if (!ask_buccet("connect", target, "transport=sendto")) {
        errno = EACCES;
        return -1;
    }

    return real_sendto(sockfd, buf, len, flags, dest_addr, addrlen);
}

ssize_t sendmsg(int sockfd, const struct msghdr* msg, int flags) {
    gravity_init();
    if (g_buccet_internal) {
        return real_sendmsg(sockfd, msg, flags);
    }

    const struct sockaddr* dest_addr = msg && msg->msg_name && msg->msg_namelen > 0
        ? (const struct sockaddr*)msg->msg_name
        : NULL;
    char target[256];
    int target_state = resolve_send_target(sockfd, dest_addr, target, sizeof(target));
    if (target_state < 0 || target_state == 0) {
        return real_sendmsg(sockfd, msg, flags);
    }

    if (!ask_buccet("connect", target, "transport=sendmsg")) {
        errno = EACCES;
        return -1;
    }

    return real_sendmsg(sockfd, msg, flags);
}

#ifdef __linux__
int sendmmsg(int sockfd, struct mmsghdr* msgvec, unsigned int vlen, int flags) {
    gravity_init();
    if (g_buccet_internal) {
        return real_sendmmsg(sockfd, msgvec, vlen, flags);
    }

    if (!msgvec || vlen == 0) {
        return real_sendmmsg(sockfd, msgvec, vlen, flags);
    }

    const struct sockaddr* dest_addr = msgvec[0].msg_hdr.msg_name && msgvec[0].msg_hdr.msg_namelen > 0
        ? (const struct sockaddr*)msgvec[0].msg_hdr.msg_name
        : NULL;
    char target[256];
    int target_state = resolve_send_target(sockfd, dest_addr, target, sizeof(target));
    if (target_state < 0 || target_state == 0) {
        return real_sendmmsg(sockfd, msgvec, vlen, flags);
    }

    if (!ask_buccet("connect", target, "transport=sendmmsg")) {
        errno = EACCES;
        return -1;
    }

    return real_sendmmsg(sockfd, msgvec, vlen, flags);
}
#endif

#ifdef __APPLE__
typedef struct {
    const void* replacement;
    const void* replacee;
} buccet_interpose_t;

static int buccet_open(const char* pathname, int flags, ...) {
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode_t mode = (mode_t)va_arg(args, int);
        va_end(args);
        return open(pathname, flags, mode);
    }
    return open(pathname, flags);
}

static int buccet_openat(int dirfd, const char* pathname, int flags, ...) {
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode_t mode = (mode_t)va_arg(args, int);
        va_end(args);
        return openat(dirfd, pathname, flags, mode);
    }
    return openat(dirfd, pathname, flags);
}

static int buccet_renameat(int olddirfd, const char* oldpath, int newdirfd, const char* newpath) {
    return renameat(olddirfd, oldpath, newdirfd, newpath);
}
static int buccet_unlinkat(int dirfd, const char* pathname, int flags) { return unlinkat(dirfd, pathname, flags); }
static int buccet_mkdirat(int dirfd, const char* pathname, mode_t mode) { return mkdirat(dirfd, pathname, mode); }
static int buccet_fchmodat(int dirfd, const char* pathname, mode_t mode, int flags) {
    return fchmodat(dirfd, pathname, mode, flags);
}
static int buccet_fchownat(int dirfd, const char* pathname, uid_t owner, gid_t group, int flags) {
    return fchownat(dirfd, pathname, owner, group, flags);
}
static int buccet_linkat(int olddirfd, const char* oldpath, int newdirfd, const char* newpath, int flags) {
    return linkat(olddirfd, oldpath, newdirfd, newpath, flags);
}
static int buccet_symlinkat(const char* target, int newdirfd, const char* linkpath) {
    return symlinkat(target, newdirfd, linkpath);
}
static FILE* buccet_fopen(const char* pathname, const char* mode) { return fopen(pathname, mode); }
static int buccet_creat(const char* pathname, mode_t mode) { return creat(pathname, mode); }
static int buccet_unlink(const char* pathname) { return unlink(pathname); }
static int buccet_remove(const char* pathname) { return remove(pathname); }
static int buccet_rename(const char* oldpath, const char* newpath) { return rename(oldpath, newpath); }
static int buccet_mkdir(const char* pathname, mode_t mode) { return mkdir(pathname, mode); }
static int buccet_rmdir(const char* pathname) { return rmdir(pathname); }
static int buccet_chmod(const char* pathname, mode_t mode) { return chmod(pathname, mode); }
static int buccet_chown(const char* pathname, uid_t owner, gid_t group) { return chown(pathname, owner, group); }
static int buccet_link(const char* oldpath, const char* newpath) { return link(oldpath, newpath); }
static int buccet_symlink(const char* target, const char* linkpath) { return symlink(target, linkpath); }
static int buccet_execve(const char* pathname, char* const argv[], char* const envp[]) { return execve(pathname, argv, envp); }
static int buccet_execv(const char* pathname, char* const argv[]) { return execv(pathname, argv); }
static int buccet_execvp(const char* file, char* const argv[]) { return execvp(file, argv); }
static int buccet_posix_spawn(pid_t* pid, const char* path, const posix_spawn_file_actions_t* file_actions,
                              const posix_spawnattr_t* attrp, char* const argv[], char* const envp[]) {
    return posix_spawn(pid, path, file_actions, attrp, argv, envp);
}
static int buccet_posix_spawnp(pid_t* pid, const char* file, const posix_spawn_file_actions_t* file_actions,
                               const posix_spawnattr_t* attrp, char* const argv[], char* const envp[]) {
    return posix_spawnp(pid, file, file_actions, attrp, argv, envp);
}
static int buccet_system(const char* command) { return system(command); }
static int buccet_connect(int sockfd, const struct sockaddr* addr, socklen_t addrlen) { return connect(sockfd, addr, addrlen); }
static ssize_t buccet_sendto(int sockfd, const void* buf, size_t len, int flags, const struct sockaddr* dest_addr, socklen_t addrlen) {
    return sendto(sockfd, buf, len, flags, dest_addr, addrlen);
}
static ssize_t buccet_sendmsg(int sockfd, const struct msghdr* msg, int flags) { return sendmsg(sockfd, msg, flags); }

#define BUCCET_INTERPOSE(replacement, replacee) \
    __attribute__((used)) static const buccet_interpose_t interpose_##replacee \
    __attribute__((section("__DATA,__interpose"))) = { \
        (const void*)(unsigned long)&replacement, \
        (const void*)(unsigned long)&replacee, \
    };

BUCCET_INTERPOSE(buccet_open, open)
BUCCET_INTERPOSE(buccet_openat, openat)
BUCCET_INTERPOSE(buccet_renameat, renameat)
BUCCET_INTERPOSE(buccet_unlinkat, unlinkat)
BUCCET_INTERPOSE(buccet_mkdirat, mkdirat)
BUCCET_INTERPOSE(buccet_fchmodat, fchmodat)
BUCCET_INTERPOSE(buccet_fchownat, fchownat)
BUCCET_INTERPOSE(buccet_linkat, linkat)
BUCCET_INTERPOSE(buccet_symlinkat, symlinkat)
BUCCET_INTERPOSE(buccet_fopen, fopen)
BUCCET_INTERPOSE(buccet_creat, creat)
BUCCET_INTERPOSE(buccet_unlink, unlink)
BUCCET_INTERPOSE(buccet_remove, remove)
BUCCET_INTERPOSE(buccet_rename, rename)
BUCCET_INTERPOSE(buccet_mkdir, mkdir)
BUCCET_INTERPOSE(buccet_rmdir, rmdir)
BUCCET_INTERPOSE(buccet_chmod, chmod)
BUCCET_INTERPOSE(buccet_chown, chown)
BUCCET_INTERPOSE(buccet_link, link)
BUCCET_INTERPOSE(buccet_symlink, symlink)
BUCCET_INTERPOSE(buccet_execve, execve)
BUCCET_INTERPOSE(buccet_execv, execv)
BUCCET_INTERPOSE(buccet_execvp, execvp)
BUCCET_INTERPOSE(buccet_posix_spawn, posix_spawn)
BUCCET_INTERPOSE(buccet_posix_spawnp, posix_spawnp)
BUCCET_INTERPOSE(buccet_system, system)
BUCCET_INTERPOSE(buccet_connect, connect)
BUCCET_INTERPOSE(buccet_sendto, sendto)
BUCCET_INTERPOSE(buccet_sendmsg, sendmsg)
#endif
