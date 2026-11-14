#!/bin/sh
# Privileged second-factor operator gate for an ALREADY protected native broker.
# Never grants the untrusted MCP process access to root, policy.json,
# operator.sock or the raw broker socket. An administrator must stage this
# verified installer itself in a root-owned directory before invocation.
set -eu
fail() { printf 'BUCCET_GATE_PROVISION_DENIED: %s\n' "$*" >&2; exit 73; }
trusted_ancestor_tree() {
  candidate=$1
  case "$candidate" in /*) ;; *) fail "trusted executable path must be absolute" ;; esac
  while [ "$candidate" != "/" ]; do
    [ -e "$candidate" ] && [ ! -L "$candidate" ] ||
      fail "trusted executable has linked or absent ancestor"
    [ "$(stat -c %u "$candidate")" = 0 ] ||
      fail "trusted executable has non-root owner"
    [ -z "$(find "$candidate" -maxdepth 0 -perm /022 -print)" ] ||
      fail "trusted executable has mutable ancestor"
    candidate=$(dirname "$candidate")
  done
}
[ "$#" -eq 5 ] || [ "$#" -eq 6 ] ||
  fail "usage: provision-operator-gate.sh INSTANCE GATE_SRC GATE_SHA REVIEW_SRC REVIEW_SHA [--files-only]"
INSTANCE=$1
GATE_SRC=$2
GATE_HASH=$3
REVIEW_SRC=$4
REVIEW_HASH=$5
OPTION=${6:-}
# Registration code is part of the independently privileged trust root and
# must be pinned like the broker and operator reviewer, never loaded from
# a mutable agent checkout at execution time.
ENROLLER_SRC=${BUCCET_HOST_ENROLLER_SRC:-}
ENROLLER_HASH=${BUCCET_HOST_ENROLLER_SHA256:-}
[ -n "$ENROLLER_SRC" ] && [ -n "$ENROLLER_HASH" ] ||
  fail "verified host enrollment program and release digest are required"
case "$INSTANCE" in ""|*[!a-z0-9-]*|-*|*-) fail "invalid instance identifier" ;; esac
[ "${#INSTANCE}" -ge 4 ] && [ "${#INSTANCE}" -le 32 ] || fail "invalid instance length"
[ -z "$OPTION" ] || [ "$OPTION" = "--files-only" ] ||
  [ "$OPTION" = "--recover-incomplete" ] || fail "unknown option"
[ "$(uname -s)" = Linux ] && [ "$(id -u)" -eq 0 ] ||
  fail "trusted Linux administrator required"
for hash in "$GATE_HASH" "$REVIEW_HASH" "$ENROLLER_HASH"; do
  case "$hash" in ""|*[!a-f0-9]*) fail "invalid release digest" ;; esac
  [ "${#hash}" -eq 64 ] || fail "release digest must be 64 hexadecimal characters"
done
for file in "$GATE_SRC" "$REVIEW_SRC" "$ENROLLER_SRC"; do
  [ -f "$file" ] && [ -r "$file" ] && [ ! -L "$file" ] ||
    fail "missing or linked release source"
done
[ "$(sha256sum "$GATE_SRC" | cut -d' ' -f1)" = "$GATE_HASH" ] ||
  fail "approval gate digest mismatch"
[ "$(sha256sum "$REVIEW_SRC" | cut -d' ' -f1)" = "$REVIEW_HASH" ] ||
  fail "operator reviewer digest mismatch"
[ "$(sha256sum "$ENROLLER_SRC" | cut -d' ' -f1)" = "$ENROLLER_HASH" ] ||
  fail "host enrollment issuer digest mismatch"
INSTALLER=$(readlink -f "$0") || fail "cannot resolve privileged installer"
trusted_ancestor_tree "$INSTALLER"
NODE=${BUCCET_BROKER_NODE:-}
[ -n "$NODE" ] || NODE=$(command -v node) || fail "no trusted Node interpreter"
NODE=$(readlink -f "$NODE") || fail "unresolved Node interpreter"
trusted_ancestor_tree "$NODE"
[ -f "$NODE" ] && [ -x "$NODE" ] || fail "untrusted Node interpreter"
case "$NODE" in *" "*|*'"'*|*"' "*|*\`*) fail "unsafe Node interpreter service path" ;; esac

ROOT=/var/lib/buccet-native/$INSTANCE
RUN=/run/buccet-native-gates/$INSTANCE
[ -d "$ROOT" ] && [ ! -L "$ROOT" ] || fail "protected broker workspace missing"
trusted_ancestor_tree "$ROOT"
for item in "$ROOT/box-fs-guard" "$ROOT/broker.mjs" "$ROOT/policy-controller.mjs" "$ROOT/policy.json"; do
  [ -f "$item" ] && [ ! -L "$item" ] && [ "$(stat -c %u "$item")" = 0 ] &&
    [ -z "$(find "$item" -maxdepth 0 -perm /022 -print)" ] ||
    fail "protected broker policy or code not installed"
done
if [ "$OPTION" != "--recover-incomplete" ]; then
  [ ! -e "$ROOT/approval-gate.mjs" ] && [ ! -e "$ROOT/operator-review.mjs" ] &&
  [ ! -e "$ROOT/host-enroll.mjs" ] &&
  [ ! -e "$ROOT/host-identities.json" ] ||
    fail "refusing to overwrite an existing privileged gate installation"
fi
[ ! -L /run/buccet-native-gates ] && [ ! -L "$RUN" ] &&
{ [ ! -e "$RUN" ] || [ "$OPTION" = "--recover-incomplete" ]; } ||
  fail "request namespace is linked or already exists"
UNIT=/etc/systemd/system/buccet-operator-gate-$INSTANCE.service
TXN=$ROOT/.buccet-gate-install.incomplete
[ ! -L "$UNIT" ] &&
{ [ ! -e "$UNIT" ] || [ "$OPTION" = "--recover-incomplete" ]; } ||
  fail "refusing an existing operator gate unit"
RUN_CREATED=0
UNIT_CREATED=0
TXN_CLAIMED=0
INSTALL_COMMITTED=0
rollback_if_uncommitted() {
  status=$?
  trap - EXIT
  if [ "$INSTALL_COMMITTED" -ne 1 ]; then
    if [ "$UNIT_CREATED" -eq 1 ]; then
      systemctl stop "buccet-operator-gate-$INSTANCE.service" >/dev/null 2>&1 || :
      systemctl disable "buccet-operator-gate-$INSTANCE.service" >/dev/null 2>&1 || :
      /usr/bin/rm -f -- "$UNIT"
      systemctl daemon-reload >/dev/null 2>&1 || :
    fi
    /usr/bin/rm -f -- "$ROOT/approval-gate.mjs" "$ROOT/operator-review.mjs" \
      "$ROOT/host-enroll.mjs" "$ROOT/host-identities.json"
    if [ "$RUN_CREATED" -eq 1 ]; then
      /usr/bin/rm -rf -- "$RUN"
    fi
    if [ "$TXN_CLAIMED" -eq 1 ]; then
      /usr/bin/rm -f -- "$TXN"
    fi
  fi
  exit "$status"
}
install -d -o root -g root -m 0755 /run/buccet-native-gates ||
  fail "cannot install root-controlled request base"
[ "$(stat -c '%u:%a' /run/buccet-native-gates)" = "0:755" ] ||
  fail "request base ownership or permissions invalid"
# An independent OS flock survives parallel installer processes but is
# automatically released on crash; a stale lock pathname is never trusted.
exec 9< /run/buccet-native-gates || fail "cannot open operator install lock"
flock -n 9 || fail "another privileged gate installation is active"
if [ "$OPTION" = "--recover-incomplete" ]; then
  [ -f "$TXN" ] && [ ! -L "$TXN" ] &&
    [ "$(stat -c '%u:%a:%h:%F' "$TXN")" = "0:600:1:regular file" ] &&
    [ "$(cat "$TXN")" = "BUCCET_GATE_INCOMPLETE_V1:$INSTANCE" ] ||
    fail "no verified root-only incomplete gate witness; manual review required"
  if systemctl is-active --quiet "buccet-operator-gate-$INSTANCE.service"; then
    fail "operator gate is running; preserve approval state"
  fi
  [ ! -S "$RUN/request.sock" ] && [ ! -S "$RUN/operator.sock" ] ||
    fail "operator sockets still present; manual recovery required"
  if [ -e "$UNIT" ]; then
    [ "$(stat -c '%u:%F' "$UNIT")" = "0:regular file" ] &&
      [ -z "$(find "$UNIT" -maxdepth 0 -perm /022 -print)" ] ||
      fail "untrusted operator service unit; refuse recovery"
  fi
  if [ -e "$RUN" ]; then
    [ "$(stat -c '%u:%a:%F' "$RUN")" = "0:755:directory" ] ||
      fail "untrusted public request namespace; refuse deletion"
    for item in "$RUN"/* "$RUN"/.[!.]* "$RUN"/..?*; do
      [ -e "$item" ] || [ -L "$item" ] || continue
      fail "unexpected request namespace entry; refuse recovery"
    done
  fi
  if [ -e "$ROOT/host-identities.json" ]; then
    [ "$(cat "$ROOT/host-identities.json")" =       "{\"schema\":1,\"root\":\"$ROOT\",\"allowed\":[]}" ] ||
      fail "nonempty root host registry; preserve registration"
  fi
  for item in "$ROOT/approval-gate.mjs" "$ROOT/operator-review.mjs"               "$ROOT/host-enroll.mjs" "$ROOT/host-identities.json"; do
    [ ! -L "$item" ] || fail "linked protected gate file; refuse recovery"
    if [ -e "$item" ]; then
      [ "$(stat -c '%u:%F' "$item")" = "0:regular file" ] ||
        fail "untrusted gate recovery file"
    fi
  done
  systemctl stop "buccet-operator-gate-$INSTANCE.service" >/dev/null 2>&1 || :
  systemctl disable "buccet-operator-gate-$INSTANCE.service" >/dev/null 2>&1 || :
  /usr/bin/rm -f -- "$UNIT"
  systemctl daemon-reload >/dev/null 2>&1 || fail "cannot reload systemd after gate recovery"
  /usr/bin/rm -f -- "$ROOT/approval-gate.mjs" "$ROOT/operator-review.mjs"     "$ROOT/host-enroll.mjs" "$ROOT/host-identities.json" ||
    fail "cannot clean verified uncommitted gate files"
  if [ -e "$RUN" ]; then /usr/bin/rm -rf -- "$RUN" || fail "cannot clean request namespace"; fi
  /usr/bin/rm -f -- "$TXN" || fail "cannot remove gate recovery witness"
  printf 'BUCCET_GATE_INCOMPLETE_RECOVERED instance=%s\n' "$INSTANCE"
  exit 0
fi
[ ! -e "$RUN" ] && [ ! -L "$RUN" ] &&
[ ! -e "$UNIT" ] && [ ! -L "$UNIT" ] &&
[ ! -e "$TXN" ] && [ ! -L "$TXN" ] &&
[ ! -e "$ROOT/approval-gate.mjs" ] && [ ! -e "$ROOT/operator-review.mjs" ] &&
[ ! -e "$ROOT/host-enroll.mjs" ] && [ ! -e "$ROOT/host-identities.json" ] ||
  fail "operator installation appeared concurrently; refuse overwrite"
trap rollback_if_uncommitted EXIT
TXN_CLAIMED=1
umask 077
( set -C; printf 'BUCCET_GATE_INCOMPLETE_V1:%s\n' "$INSTANCE" > "$TXN" ) ||
  fail "cannot create exclusive root-only gate recovery witness"
[ "$(stat -c '%u:%a:%h:%F' "$TXN")" = "0:600:1:regular file" ] ||
  fail "gate recovery witness permissions invalid"
/usr/bin/sync -d "$TXN" || fail "cannot sync gate recovery witness"
/usr/bin/sync -f "$ROOT" || fail "cannot sync protected gate recovery directory"
# A failed command can create the namespace before returning EIO.
RUN_CREATED=1
install -d -o root -g root -m 0755 "$RUN" ||
  fail "cannot install root-controlled request namespace"
[ "$(stat -c '%u:%a' "$RUN")" = "0:755" ] ||
  fail "untrusted public request directory"
install -o root -g root -m 0400 "$GATE_SRC" "$ROOT/approval-gate.mjs" ||
  fail "cannot install protected gate"
install -o root -g root -m 0400 "$REVIEW_SRC" "$ROOT/operator-review.mjs" ||
  fail "cannot install protected reviewer"
install -o root -g root -m 0400 "$ENROLLER_SRC" "$ROOT/host-enroll.mjs" ||
  fail "cannot install verified host issuer"
# Root-held host registry is a distinct trust root from user-controlled
# sessions and Box tokens. Fresh installations DENY all host requests until
# a privileged operator registers a separate OS-isolated launch identity.
REGISTRY=$ROOT/host-identities.json
[ ! -e "$REGISTRY" ] && [ ! -L "$REGISTRY" ] ||
  fail "refusing preexisting host registration"
umask 077
printf '{"schema":1,"root":"%s","allowed":[]}\n' "$ROOT" > "$REGISTRY"
chmod 0400 "$REGISTRY"
chown root:root "$REGISTRY"
[ "$(stat -c '%u:%a' "$REGISTRY")" = "0:400" ] ||
  fail "host identity registry must be root-exclusive"
[ "$(sha256sum "$ROOT/approval-gate.mjs" | cut -d' ' -f1)" = "$GATE_HASH" ] &&
[ "$(sha256sum "$ROOT/operator-review.mjs" | cut -d' ' -f1)" = "$REVIEW_HASH" ] &&
[ "$(sha256sum "$ROOT/host-enroll.mjs" | cut -d' ' -f1)" = "$ENROLLER_HASH" ] ||
  fail "privileged operator gate or host issuer changed during installation"
if [ "$OPTION" = "--files-only" ]; then
  /usr/bin/rm -f -- "$TXN" || fail "cannot finalize gate recovery witness"
  INSTALL_COMMITTED=1
  printf 'BUCCET_GATE_PROVISIONED_FILES_ONLY root=%s request=%s\n' "$ROOT" "$RUN/request.sock"
  exit 0
fi
command -v systemctl >/dev/null 2>&1 || fail "systemd unavailable"
umask 077
UNIT_CREATED=1
cat > "$UNIT" <<EOF
[Unit]
Description=Agent Buccet independent operator approval gate ($INSTANCE)
Requires=buccet-native-$INSTANCE.service
After=buccet-native-$INSTANCE.service

[Service]
Type=simple
User=root
Group=root
UMask=0077
ExecStartPre=/usr/bin/install -d -o root -g root -m 0755 /run/buccet-native-gates /run/buccet-native-gates/$INSTANCE
ExecStart=$NODE $ROOT/approval-gate.mjs $ROOT $ROOT/broker.sock $RUN/request.sock $RUN/operator.sock
WorkingDirectory=/
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$ROOT $RUN
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
systemctl daemon-reload || fail "cannot reload protected gate service"
systemctl enable --now "buccet-operator-gate-$INSTANCE.service" ||
  fail "operator gate service activation failed"
# The gate binds two sockets asynchronously after systemd Type=simple
# activation. Require both actual sockets and their kernel ownership/modes.
attempt=0
while [ "$attempt" -lt 100 ]; do
  if [ -S "$RUN/request.sock" ] && [ -S "$RUN/operator.sock" ]; then
    [ "$(stat -c '%u:%a' "$RUN/request.sock")" = "0:666" ] &&
    [ "$(stat -c '%u:%a' "$RUN/operator.sock")" = "0:600" ] ||
      fail "operator socket separation failed"
    break
  fi
  systemctl is-active --quiet "buccet-operator-gate-$INSTANCE.service" ||
    fail "operator gate service exited before becoming ready"
  attempt=$((attempt + 1))
  sleep 0.1
done
[ -S "$RUN/request.sock" ] && [ -S "$RUN/operator.sock" ] ||
  fail "operator gate sockets unavailable within bounded readiness window"
/usr/bin/rm -f -- "$TXN" || fail "cannot finalize gate recovery witness"
INSTALL_COMMITTED=1
printf 'BUCCET_GATE_PROVISIONED_PROTECTED request=%s operator=%s\n' "$RUN/request.sock" "$RUN/operator.sock"
