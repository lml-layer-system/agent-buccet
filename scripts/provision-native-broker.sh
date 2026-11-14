#!/bin/sh
# Explicit privileged deployment of Buccet's protected Linux filesystem broker.
#
# MUST be run by an OS administrator from a verified, trusted release source.
# This installs a root-owned broker and native guard, NOT a way for an untrusted
# agent to gain root access. The independent policy controller/host launcher
# remains a separate prerequisite for autonomous operation.
set -eu
fail() { printf 'BUCCET_PROVISION_DENIED: %s\n' "$*" >&2; exit 73; }
# Privileged setup cannot execute a script or interpreter supplied from the
# same-UID agent's mutable checkout. Only root-owned, non-writable ancestry
# may provide code invoked with elevated authority.
trusted_executable_tree() {
  entry=$1
  [ -n "$entry" ] && [ "${entry#/}" != "$entry" ] ||
    fail "trusted executable path must be absolute"
  while [ "$entry" != "/" ]; do
    [ -e "$entry" ] && [ ! -L "$entry" ] ||
      fail "trusted executable has missing or linked ancestor"
    [ "$(stat -c '%u' "$entry")" = "0" ] ||
      fail "trusted executable has non-root owner"
    [ -z "$(find "$entry" -maxdepth 0 -perm /022 -print)" ] ||
      fail "trusted executable has group/other writable ancestor"
    entry=$(dirname "$entry")
  done
}
if [ "$#" -ne 5 ] && [ "$#" -ne 6 ]; then
  fail "usage: provision-native-broker.sh INSTANCE GUARD BROKER GUARD_SHA256 BROKER_SHA256 [--files-only]"
fi
INSTANCE=$1
GUARD_SRC=$2
BROKER_SRC=$3
GUARD_EXPECTED=$4
BROKER_EXPECTED=$5
FILES_ONLY=${6:-}
case "$INSTANCE" in
  ""|*[!a-z0-9-]*|-*|*- ) fail "instance must use lowercase letters, digits and hyphens" ;;
esac
[ "${#INSTANCE}" -ge 4 ] && [ "${#INSTANCE}" -le 32 ] || fail "instance length must be 4..32"
[ -z "$FILES_ONLY" ] || [ "$FILES_ONLY" = "--files-only" ] ||
  [ "$FILES_ONLY" = "--recover-incomplete" ] || fail "invalid option"
[ "$(id -u)" -eq 0 ] || fail "installation requires the OS administrator"
[ "$(uname -s)" = Linux ] || fail "only Linux isolated broker is supported"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum unavailable"
command -v install >/dev/null 2>&1 || fail "install unavailable"
command -v systemctl >/dev/null 2>&1 || [ -n "$FILES_ONLY" ] || fail "systemd unavailable"
# Trusted policy controller code must also be release-digest pinned. It
# authorizes effects from an independent root-only policy, never agent claims.
CONTROLLER_SRC=${BUCCET_POLICY_CONTROLLER_SRC:-}
CONTROLLER_EXPECTED=${BUCCET_POLICY_CONTROLLER_SHA256:-}
[ -n "$CONTROLLER_SRC" ] && [ -n "$CONTROLLER_EXPECTED" ] ||
  fail "root-owned policy controller artifact and SHA256 required"
for hash in "$GUARD_EXPECTED" "$BROKER_EXPECTED" "$CONTROLLER_EXPECTED"; do
  case "$hash" in *[!a-f0-9]*|"") fail "expected SHA256 must use lowercase hexadecimal" ;; esac
  [ "${#hash}" -eq 64 ] || fail "expected SHA256 must contain exactly 64 hex characters"
done
[ -f "$GUARD_SRC" ] && [ ! -L "$GUARD_SRC" ] || fail "missing native guard source"
[ -f "$BROKER_SRC" ] && [ ! -L "$BROKER_SRC" ] || fail "missing broker source"
[ -r "$GUARD_SRC" ] && [ -r "$BROKER_SRC" ] || fail "unreadable deployment sources"
[ -f "$CONTROLLER_SRC" ] && [ ! -L "$CONTROLLER_SRC" ] &&
  [ -r "$CONTROLLER_SRC" ] || fail "missing trusted policy controller source"
controller_actual=$(sha256sum "$CONTROLLER_SRC" | cut -d' ' -f1)
[ "$controller_actual" = "$CONTROLLER_EXPECTED" ] ||
  fail "trusted policy controller does not match pinned release digest"
guard_actual=$(sha256sum "$GUARD_SRC" | cut -d' ' -f1)
broker_actual=$(sha256sum "$BROKER_SRC" | cut -d' ' -f1)
[ "$guard_actual" = "$GUARD_EXPECTED" ] || fail "native guard does not match pinned release digest"
[ "$broker_actual" = "$BROKER_EXPECTED" ] || fail "broker does not match pinned release digest"
BASE=/var/lib/buccet-native
ROOT=$BASE/$INSTANCE
[ ! -L "$BASE" ] && [ ! -L "$ROOT" ] || fail "refusing symlinked managed root"
# A crashed installer can leave a protected partial instance. Only the
# explicit, independently verified recovery route may inspect such a root.
[ ! -e "$ROOT" ] || [ "$FILES_ONLY" = "--recover-incomplete" ] ||
  fail "managed instance already exists; refuse overwrite"
# Both privileged code origins are checked before installing any code.
# A root-admin must first stage this reviewed installer in a protected tree.
INSTALLER=$(readlink -f "$0") || fail "cannot resolve trusted installer"
trusted_executable_tree "$INSTALLER"
# A release operator may specify a separately installed root-owned Node.
# The interpreter must be independently trusted; CI toolcache can be writable
# by the runner, so it is NOT accepted merely because it is on PATH.
NODE=${BUCCET_BROKER_NODE:-}
if [ -z "$NODE" ]; then NODE=$(command -v node) || fail "node binary unavailable"; fi
case "$NODE" in /*) ;; *) fail "node must resolve to absolute trusted executable" ;; esac
NODE=$(readlink -f "$NODE") || fail "cannot resolve Node executable"
trusted_executable_tree "$NODE"
[ -f "$NODE" ] && [ -x "$NODE" ] || fail "untrusted or unavailable Node interpreter"
# The instance did not exist at preflight. Only delete resources owned by
# THIS installation. Never remove another instance or a preexisting root.
# A failed release is a rollback, not a half-provisioned privileged service.
ROOT_CREATED=0
UNIT_CREATED=0
TXN_CLAIMED=0
INSTALL_COMMITTED=0
UNIT=/etc/systemd/system/buccet-native-$INSTANCE.service
TXN=$BASE/.buccet-broker-install-$INSTANCE.incomplete
rollback_if_uncommitted() {
  status=$?
  trap - EXIT
  if [ "$INSTALL_COMMITTED" -ne 1 ]; then
    if [ "$UNIT_CREATED" -eq 1 ]; then
      systemctl stop "buccet-native-$INSTANCE.service" >/dev/null 2>&1 || :
      systemctl disable "buccet-native-$INSTANCE.service" >/dev/null 2>&1 || :
      /usr/bin/rm -f -- "$UNIT"
      systemctl daemon-reload >/dev/null 2>&1 || :
    fi
    if [ "$ROOT_CREATED" -eq 1 ]; then
      /usr/bin/rm -rf -- "$ROOT"
    fi
    if [ "$TXN_CLAIMED" -eq 1 ]; then
      /usr/bin/rm -f -- "$TXN"
    fi
  fi
  exit "$status"
}
install -d -o root -g root -m 0700 "$BASE" || fail "cannot create protected base"
[ "$(stat -c '%u:%a' "$BASE")" = "0:700" ] ||
  fail "protected base ownership or permissions invalid"
# Lock the root-owned base directory itself: no stale lockfiles remain on
# SIGKILL, and two administrators cannot both claim the same newly made root.
exec 9< "$BASE" || fail "cannot open installation transaction lock"
flock -n 9 || fail "another privileged installation is active"
# Crash-recovery marker lives OUTSIDE the as-yet-uncreated root, under a
# root-only directory. It exists before any privileged instance is allocated,
# so SIGKILL cannot leave an orphan without a trustworthy recovery witness.
if [ "$FILES_ONLY" = "--recover-incomplete" ]; then
  [ -f "$TXN" ] && [ ! -L "$TXN" ] &&
    [ "$(stat -c '%u:%a:%h:%F' "$TXN")" = "0:600:1:regular file" ] &&
    [ "$(cat "$TXN")" = "BUCCET_BROKER_INCOMPLETE_V1:$INSTANCE" ] ||
    fail "no valid root-owned incomplete-install witness; manual review required"
  [ ! -L "$ROOT" ] && [ ! -L "$UNIT" ] ||
    fail "linked recovery resource; refuse automatic deletion"
  [ ! -S "$ROOT/broker.sock" ] ||
    fail "broker socket still exists; refuse automatic recovery"
  # Active or previously enrolled instances are NEVER auto-deleted; exact
  # bytes and operator approvals are more important than convenience.
  if systemctl is-active --quiet "buccet-native-$INSTANCE.service" ||
     systemctl is-active --quiet "buccet-operator-gate-$INSTANCE.service"; then
    fail "service is active; cannot safely recover interrupted install"
  fi
  [ ! -e "$ROOT/approval-gate.mjs" ] && [ ! -e "$ROOT/host-identities.json" ] ||
    fail "operator registration present; preserve protected instance"
  if [ -e "$UNIT" ]; then
    [ "$(stat -c '%u:%F' "$UNIT")" = "0:regular file" ] &&
      [ -z "$(find "$UNIT" -maxdepth 0 -perm /022 -print)" ] ||
      fail "untrusted service unit; refuse recovery"
  fi
  if [ -e "$ROOT" ]; then
    [ "$(stat -c '%u:%a:%F' "$ROOT")" = "0:700:directory" ] ||
      fail "untrusted recovered root; refuse deletion"
    for entry in "$ROOT"/* "$ROOT"/.[!.]* "$ROOT"/..?*; do
      [ -e "$entry" ] || [ -L "$entry" ] || continue
      case "$entry" in
        "$ROOT/box-fs-guard"|"$ROOT/broker.mjs"|"$ROOT/policy-controller.mjs"|"$ROOT/policy.json") ;;
        *) fail "unexpected protected data; manual recovery required" ;;
      esac
    done
  fi
  systemctl stop "buccet-native-$INSTANCE.service" >/dev/null 2>&1 || :
  systemctl disable "buccet-native-$INSTANCE.service" >/dev/null 2>&1 || :
  /usr/bin/rm -f -- "$UNIT"
  systemctl daemon-reload >/dev/null 2>&1 || fail "cannot reload systemd after recovery"
  if [ -e "$ROOT" ]; then /usr/bin/rm -rf -- "$ROOT" || fail "root recovery failed"; fi
  /usr/bin/rm -f -- "$TXN" || fail "incomplete marker cleanup failed"
  printf 'BUCCET_BROKER_INCOMPLETE_RECOVERED instance=%s\n' "$INSTANCE"
  exit 0
fi
[ ! -e "$ROOT" ] && [ ! -L "$ROOT" ] &&
[ ! -e "$TXN" ] && [ ! -L "$TXN" ] ||
  fail "previous or concurrent installation exists; refuse overwrite"
trap rollback_if_uncommitted EXIT
# Reserve the transaction witness BEFORE creating its protected namespace.
TXN_CLAIMED=1
umask 077
( set -C; printf 'BUCCET_BROKER_INCOMPLETE_V1:%s\n' "$INSTANCE" > "$TXN" ) ||
  fail "cannot create exclusive incomplete-install witness"
[ "$(stat -c '%u:%a:%h:%F' "$TXN")" = "0:600:1:regular file" ] ||
  fail "incomplete-install witness permissions invalid"
/usr/bin/sync -d "$TXN" || fail "cannot sync incomplete-install witness"
/usr/bin/sync -f "$BASE" || fail "cannot sync witness directory"
# Claim the absent root BEFORE invoking install: a command can create the
# directory and then return EIO, so recording ownership after success is late.
ROOT_CREATED=1
install -d -o root -g root -m 0700 "$ROOT" || fail "cannot create protected root"
GUARD=$ROOT/box-fs-guard
BROKER=$ROOT/broker.mjs
CONTROLLER=$ROOT/policy-controller.mjs
POLICY=$ROOT/policy.json
SOCKET=$ROOT/broker.sock
install -o root -g root -m 0500 "$GUARD_SRC" "$GUARD" || fail "cannot install guard"
install -o root -g root -m 0400 "$BROKER_SRC" "$BROKER" || fail "cannot install broker"
install -o root -g root -m 0400 "$CONTROLLER_SRC" "$CONTROLLER" ||
  fail "cannot install trusted policy controller"
# DENY ALL until an OS-privileged operator deliberately installs and reviews
# an independently protected policy for this exact managed root.
printf '{"schema":1,"root":"%s","allowed":[]}\n' "$ROOT" > "$POLICY"
chmod 0400 "$POLICY"
chown root:root "$POLICY"
[ "$(sha256sum "$GUARD" | cut -d' ' -f1)" = "$GUARD_EXPECTED" ] ||
  fail "native guard changed during protected installation"
[ "$(sha256sum "$BROKER" | cut -d' ' -f1)" = "$BROKER_EXPECTED" ] ||
  fail "broker changed during protected installation"
[ "$(sha256sum "$CONTROLLER" | cut -d' ' -f1)" = "$CONTROLLER_EXPECTED" ] ||
  fail "policy controller changed during protected installation"
[ "$(stat -c '%u:%a' "$CONTROLLER")" = "0:400" ] ||
  fail "policy controller permissions invalid"
[ "$(stat -c '%u:%a' "$POLICY")" = "0:400" ] ||
  fail "operator policy permissions invalid"
[ "$(stat -c '%u:%a' "$ROOT")" = "0:700" ] || fail "managed root permissions invalid"
[ "$(stat -c '%u:%a' "$GUARD")" = "0:500" ] || fail "native guard ownership invalid"
[ "$(stat -c '%u:%a' "$BROKER")" = "0:400" ] || fail "broker ownership invalid"
if [ "$FILES_ONLY" = "--files-only" ]; then
  /usr/bin/rm -f -- "$TXN" || fail "cannot finalize install witness"
  INSTALL_COMMITTED=1
  printf 'BUCCET_PROVISIONED_FILES_ONLY root=%s socket=%s\n' "$ROOT" "$SOCKET"
  exit 0
fi
# This service is not reachable by an untrusted user or agent. Only a separate
# trusted authorization controller running under the privileged principal can
# connect to the socket. No socket chmod or group delegation is performed.
[ ! -e "$UNIT" ] && [ ! -L "$UNIT" ] || fail "refusing existing service unit"
umask 077
UNIT_CREATED=1
cat > "$UNIT" <<EOF
[Unit]
Description=Agent Buccet protected native filesystem broker ($INSTANCE)
After=local-fs.target

[Service]
Type=simple
User=root
Group=root
UMask=0077
ExecStart=$NODE $BROKER $ROOT $GUARD $SOCKET
WorkingDirectory=/
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$ROOT
RestrictAddressFamilies=AF_UNIX
CapabilityBoundingSet=
LockPersonality=true
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$UNIT"
chown root:root "$UNIT"
systemctl daemon-reload || fail "cannot reload systemd"
systemctl enable --now "buccet-native-$INSTANCE.service" ||
  fail "protected broker service failed to start"
# systemd Type=simple reports unit activation before Node has finished
# binding its socket. The installer must wait for REAL daemon readiness.
# A bounded wait prevents a false failed deployment or unbounded stall.
attempt=0
while [ "$attempt" -lt 100 ]; do
  if [ -S "$SOCKET" ]; then
    [ "$(stat -c '%u:%a' "$SOCKET")" = "0:600" ] ||
      fail "broker socket permissions invalid"
    # A stale root-owned pathname may survive daemon death; Type=simple
    # readiness is not enough. Connect to the ACTUAL listener before success.
    if "$NODE" -e '
      const net=require("node:net");
      const s=net.createConnection({path:process.argv[1]});
      s.once("connect",()=>{s.destroy();process.exit(0)});
      s.once("error",()=>process.exit(1));
      s.setTimeout(750,()=>process.exit(1));
    ' "$SOCKET" >/dev/null 2>&1; then break; fi
  fi
  systemctl is-active --quiet "buccet-native-$INSTANCE.service" ||
    fail "broker service exited before becoming ready"
  attempt=$((attempt + 1))
  sleep 0.1
done
[ -S "$SOCKET" ] || fail "broker socket not created within bounded readiness window"
/usr/bin/rm -f -- "$TXN" || fail "cannot finalize install witness"
INSTALL_COMMITTED=1
printf 'BUCCET_PROVISIONED_PROTECTED root=%s socket=%s\n' "$ROOT" "$SOCKET"
