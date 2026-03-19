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
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <sys/un.h>
#include <time.h>
#include <unistd.h>

#define BUCCET_MAX_PAYLOAD 4096
#define BUCCET_POLL_MS 250

static int (*real_open)(const char*, int, ...) = NULL;
static int (*real_openat)(int, const char*, int, ...) = NULL;
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
static int (*real_system)(const char*) = NULL;
static int (*real_connect)(int, const struct sockaddr*, socklen_t) = NULL;
static ssize_t (*real_read)(int, void*, size_t) = NULL;
static int (*real_close)(int) = NULL;
static int (*real_socket)(int, int, int) = NULL;

static int g_initialized = 0;
static __thread int g_buccet_internal = 0;

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

static void gravity_init(void) {
    if (g_initialized) return;

    real_open = dlsym(RTLD_NEXT, "open");
    real_openat = dlsym(RTLD_NEXT, "openat");
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
    real_system = dlsym(RTLD_NEXT, "system");
    real_connect = dlsym(RTLD_NEXT, "connect");
    real_read = dlsym(RTLD_NEXT, "read");
    real_close = dlsym(RTLD_NEXT, "close");
    real_socket = dlsym(RTLD_NEXT, "socket");

    g_initialized = 1;
}

__attribute__((constructor))
static void gravity_constructor(void) {
    gravity_init();
}

static int ask_buccet(const char* action, const char* target, const char* extra) {
    struct sockaddr_un addr;
    char payload[BUCCET_MAX_PAYLOAD];
    pid_t pid = getpid();

    if (extra && extra[0]) {
        snprintf(payload, sizeof(payload), "%s|%s|%d|%s\n", action, target, pid, extra);
    } else {
        snprintf(payload, sizeof(payload), "%s|%s|%d|\n", action, target, pid);
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
    resolve_path(pathname, resolved, sizeof(resolved));

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

    char resolved[PATH_MAX];
    resolve_path(linkpath, resolved, sizeof(resolved));

    if (!ask_buccet("symlink", resolved, target)) {
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

    char cmdline[BUCCET_MAX_PAYLOAD] = "";
    for (int i = 0; argv[i] && strlen(cmdline) < BUCCET_MAX_PAYLOAD - 256; i++) {
        if (i > 0) strcat(cmdline, " ");
        strncat(cmdline, argv[i], 255);
    }

    if (!ask_buccet("exec", file, cmdline)) {
        errno = EACCES;
        return -1;
    }

    return real_execvp(file, argv);
}

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

    char target[256] = "unknown";
    if (addr->sa_family == AF_INET) {
        struct sockaddr_in* addr_in = (struct sockaddr_in*)addr;
        snprintf(target, sizeof(target), "%s:%d", inet_ntoa(addr_in->sin_addr), ntohs(addr_in->sin_port));
    } else if (addr->sa_family == AF_INET6) {
        struct sockaddr_in6* addr_in6 = (struct sockaddr_in6*)addr;
        char ip6[INET6_ADDRSTRLEN];
        inet_ntop(AF_INET6, &addr_in6->sin6_addr, ip6, sizeof(ip6));
        snprintf(target, sizeof(target), "[%s]:%d", ip6, ntohs(addr_in6->sin6_port));
    } else if (addr->sa_family == AF_UNIX) {
        struct sockaddr_un* addr_un = (struct sockaddr_un*)addr;
        if (strcmp(addr_un->sun_path, gravity_socket_path()) == 0) {
            return real_connect(sockfd, addr, addrlen);
        }
        snprintf(target, sizeof(target), "unix:%s", addr_un->sun_path);
    }

    if (!ask_buccet("connect", target, "")) {
        errno = EACCES;
        return -1;
    }

    return real_connect(sockfd, addr, addrlen);
}
