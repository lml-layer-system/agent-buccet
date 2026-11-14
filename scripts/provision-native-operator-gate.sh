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
[ -z "$OPTION" ] || [ "$OPTION" = "--files-only" ] || fail "unknown option"
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
[ ! -e "$ROOT/approval-gate.mjs" ] && [ ! -e "$ROOT/operator-review.mjs" ] &&
[ ! -e "$ROOT/host-enroll.mjs" ] ||
  fail "refusing to overwrite a privileged gate installation"
[ ! -L /run/buccet-native-gates ] && [ ! -L "$RUN" ] ||
  fail "request namespace is symlinked"
install -d -o root -g root -m 0755 /run/buccet-native-gates "$RUN" ||
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
  printf 'BUCCET_GATE_PROVISIONED_FILES_ONLY root=%s request=%s\n' "$ROOT" "$RUN/request.sock"
  exit 0
fi
command -v systemctl >/dev/null 2>&1 || fail "systemd unavailable"
UNIT=/etc/systemd/system/buccet-operator-gate-$INSTANCE.service
[ ! -e "$UNIT" ] && [ ! -L "$UNIT" ] || fail "refusing existing gate service unit"
umask 077
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
[ -S "$RUN/request.sock" ] && [ -S "$RUN/operator.sock" ] ||
  fail "operator gate sockets unavailable"
[ "$(stat -c '%u:%a' "$RUN/request.sock")" = "0:666" ] &&
[ "$(stat -c '%u:%a' "$RUN/operator.sock")" = "0:600" ] ||
  fail "operator socket separation failed"
printf 'BUCCET_GATE_PROVISIONED_PROTECTED request=%s operator=%s\n' "$RUN/request.sock" "$RUN/operator.sock"
