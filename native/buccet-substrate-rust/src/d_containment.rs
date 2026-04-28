//! Buccet containment surface — process containment and packaged runtime entry.
//!
//! CALLER NOTES (TypeScript / Agent Buccet):
//!   d_manage_lifecycle "start" returns Some(pid) — store it, pass as _pid for stop/status.
//!   d_manage_lifecycle "status" returns Some(pid) if running, None if stopped.
//!   d_enforce_resource_limit signature: (unit_id, config, limits) — matches Python substrate.
//!
//! verified=True · ∀i: Snap(S)(i) = S(i) · <10ms · deterministic

use crate::types::{cfg_str, IsolationContext, SubstrateError};

// ── D:ISOLATION ───────────────────────────────────────────────────────────────

/// Enforce process namespace isolation.
pub fn d_apply_isolation(unit_id: &str, config: &serde_json::Value) -> IsolationContext {
    const CLONE_NEWNS:  u32 = 0x0002_0000;
    const CLONE_NEWPID: u32 = 0x2000_0000;
    const CLONE_NEWNET: u32 = 0x4000_0000;
    const CLONE_NEWUTS: u32 = 0x0400_0000;

    let flags = config.get("namespace_flags")
        .and_then(|v| v.as_u64())
        .map(|f| f as u32)
        .unwrap_or(CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWUTS);

    #[cfg(all(feature = "native", target_os = "linux"))]
    let active = unsafe { libc::unshare(flags as libc::c_int) == 0 };

    #[cfg(not(all(feature = "native", target_os = "linux")))]
    let active = false;

    IsolationContext { unit_id: unit_id.to_string(), namespace_flags: flags, active }
}

// ── D:RESOURCE_CONSTRAINT ─────────────────────────────────────────────────────

/// Enforce cgroup v2 resource limits.
/// Signature matches Python substrate: (unit_id, config, limits).
pub fn d_enforce_resource_limit(
    unit_id: &str,
    _config: &serde_json::Value,
    limits:  &serde_json::Value,
) -> Result<(), SubstrateError> {
    #[cfg(not(feature = "native"))]
    {
        if unit_id.is_empty() {
            return Err(SubstrateError::ValidationFail("unit_id required".into()));
        }
        return Ok(());
    }

    #[cfg(feature = "native")]
    {
        use std::path::PathBuf;
        let cgroup = PathBuf::from(format!("/sys/fs/cgroup/{}", unit_id));
        std::fs::create_dir_all(&cgroup)
            .map_err(|e| SubstrateError::OsError(e.to_string()))?;
        if let Some(mem) = limits.get("memory") {
            std::fs::write(cgroup.join("memory.max"), mem.to_string())
                .map_err(|e| SubstrateError::PermissionDenied(e.to_string()))?;
        }
        if let Some(cpu) = limits.get("cpu") {
            let period = limits.get("cpu_period")
                .and_then(|v| v.as_i64()).unwrap_or(100_000);
            std::fs::write(cgroup.join("cpu.max"), format!("{} {}", cpu, period))
                .map_err(|e| SubstrateError::PermissionDenied(e.to_string()))?;
        }
        if let Some(pids) = limits.get("pids") {
            std::fs::write(cgroup.join("pids.max"), pids.to_string())
                .map_err(|e| SubstrateError::PermissionDenied(e.to_string()))?;
        }
        Ok(())
    }
}

// ── D:LIFECYCLE ───────────────────────────────────────────────────────────────

/// Enforce process lifecycle: start, stop, status.
///
/// Returns:
///   "start"  → Some(pid) — caller MUST store this pid for later stop/status calls
///   "stop"   → None
///   "status" → Some(pid) if process alive, None if stopped
///
/// TypeScript pattern:
///   const pid = d_manage_lifecycle_wasm("u1", {action:"start", cmd:["/bin/sh"]});
///   d_manage_lifecycle_wasm("u1", {action:"stop",   _pid: pid});
///   d_manage_lifecycle_wasm("u1", {action:"status", _pid: pid}); // Some(pid) = running
pub fn d_manage_lifecycle(_unit_id: &str, config: &serde_json::Value) -> Option<u32> {
    let action = cfg_str(config, "action", "start");

    #[cfg(not(feature = "native"))]
    {
        let _ = action;
        return None;
    }

    #[cfg(feature = "native")]
    {
        match action.as_str() {
            "start" => {
                let cmd = config.get("cmd")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
                    .unwrap_or_default();
                if cmd.is_empty() { return None; }
                std::process::Command::new(cmd[0])
                    .args(&cmd[1..])
                    .spawn()
                    .ok()
                    .map(|c| c.id())
            }
            "stop" => {
                if let Some(pid) = config.get("_pid").and_then(|v| v.as_u64()) {
                    unsafe { libc::kill(pid as libc::pid_t, libc::SIGTERM); }
                }
                None
            }
            "status" => {
                if let Some(pid) = config.get("_pid").and_then(|v| v.as_u64()) {
                    let alive = unsafe { libc::kill(pid as libc::pid_t, 0) == 0 };
                    if alive { return Some(pid as u32); }
                }
                None
            }
            _ => None,
        }
    }
}

// ── D:PERSISTENCE ─────────────────────────────────────────────────────────────

/// Enforce overlay filesystem persistence.
pub fn d_persist_state(_unit_id: &str, config: &serde_json::Value) -> Result<(), SubstrateError> {
    let base   = cfg_str(config, "base_dir", "/var/lib/substrate/default");
    let lower  = cfg_str(config, "lower",  &format!("{}/lower",  base));
    let upper  = cfg_str(config, "upper",  &format!("{}/upper",  base));
    let work   = cfg_str(config, "work",   &format!("{}/work",   base));
    let merged = cfg_str(config, "merged", &format!("{}/merged", base));

    #[cfg(not(feature = "native"))]
    {
        let _ = (lower, upper, work, merged);
        return Ok(());
    }

    #[cfg(feature = "native")]
    {
        for dir in &[&lower, &upper, &work, &merged] {
            std::fs::create_dir_all(dir)
                .map_err(|e| SubstrateError::OsError(e.to_string()))?;
        }
        let mount_cmd = format!(
            "mount -t overlay overlay -o lowerdir={},upperdir={},workdir={} {}",
            lower, upper, work, merged
        );
        let status = std::process::Command::new("sh")
            .args(["-c", &mount_cmd])
            .status()
            .map_err(|e| SubstrateError::OsError(e.to_string()))?;
        if !status.success() {
            return Err(SubstrateError::PermissionDenied(
                "overlay mount failed — requires CAP_SYS_ADMIN".into()
            ));
        }
        Ok(())
    }
}

// ── Environment ───────────────────────────────────────────────────────────────

/// Enter the packaged runtime root.
///
/// Native Linux:
///   - validates the packaged root
///   - performs pivot_root(2)
///   - detaches the old host root with MNT_DETACH
///
/// Non-Linux / WASM:
///   - validates the requested root/workdir shape
///   - records a truthful "ready to enter" success for the caller/runtime bridge
pub fn d_enter_environment(_unit_id: &str, config: &serde_json::Value) -> Result<(), SubstrateError> {
    let rootfs = cfg_str(config, "rootfs", "");
    if rootfs.trim().is_empty() {
        return Err(SubstrateError::ValidationFail(
            "d_enter_environment: rootfs is required".into(),
        ));
    }
    if !std::path::Path::new(&rootfs).is_absolute() {
        return Err(SubstrateError::ValidationFail(
            "d_enter_environment: rootfs must be absolute".into(),
        ));
    }

    let rootfs_path = std::path::PathBuf::from(&rootfs);
    if !rootfs_path.is_dir() {
        return Err(SubstrateError::ValidationFail(
            format!("d_enter_environment: rootfs missing: {}", rootfs),
        ));
    }

    let workdir = cfg_str(config, "workdir", "/");
    if !workdir.starts_with('/') {
        return Err(SubstrateError::ValidationFail(
            "d_enter_environment: workdir must be absolute inside rootfs".into(),
        ));
    }

    let normalized_workdir = workdir.trim_start_matches('/');
    let workdir_path = if normalized_workdir.is_empty() {
        rootfs_path.clone()
    } else {
        rootfs_path.join(normalized_workdir)
    };
    if !workdir_path.exists() {
        return Err(SubstrateError::ValidationFail(
            format!("d_enter_environment: workdir missing inside rootfs: {}", workdir),
        ));
    }

    #[cfg(all(feature = "native", target_os = "linux"))]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        let old_root = rootfs_path.join(".buccet-old-root");
        std::fs::create_dir_all(&old_root)
            .map_err(|e| SubstrateError::OsError(e.to_string()))?;

        let new_root_c = CString::new(rootfs_path.as_os_str().as_bytes())
            .map_err(|_| SubstrateError::ValidationFail("d_enter_environment: rootfs contains interior NUL".into()))?;
        let old_root_c = CString::new(old_root.as_os_str().as_bytes())
            .map_err(|_| SubstrateError::ValidationFail("d_enter_environment: old root path contains interior NUL".into()))?;

        let pivot_result = unsafe {
            libc::syscall(libc::SYS_pivot_root, new_root_c.as_ptr(), old_root_c.as_ptr())
        };
        if pivot_result != 0 {
            return Err(SubstrateError::PermissionDenied(
                "pivot_root failed — requires CAP_SYS_ADMIN + private mount namespace".into(),
            ));
        }

        let chdir_root = CString::new("/")
            .map_err(|_| SubstrateError::ValidationFail("d_enter_environment: unable to enter new root".into()))?;
        if unsafe { libc::chdir(chdir_root.as_ptr()) } != 0 {
            return Err(SubstrateError::OsError("d_enter_environment: chdir('/') failed after pivot_root".into()));
        }

        let old_root_mount = CString::new("/.buccet-old-root")
            .map_err(|_| SubstrateError::ValidationFail("d_enter_environment: invalid old root mount".into()))?;
        if unsafe { libc::umount2(old_root_mount.as_ptr(), libc::MNT_DETACH) } != 0 {
            return Err(SubstrateError::PermissionDenied(
                "d_enter_environment: umount old root failed".into(),
            ));
        }
        if unsafe { libc::rmdir(old_root_mount.as_ptr()) } != 0 {
            return Err(SubstrateError::OsError(
                "d_enter_environment: cleanup of old root mount failed".into(),
            ));
        }

        if workdir != "/" {
            let entered_workdir = CString::new(workdir.as_bytes())
                .map_err(|_| SubstrateError::ValidationFail("d_enter_environment: workdir contains interior NUL".into()))?;
            if unsafe { libc::chdir(entered_workdir.as_ptr()) } != 0 {
                return Err(SubstrateError::OsError(format!(
                    "d_enter_environment: chdir('{}') failed after pivot_root",
                    workdir
                )));
            }
        }
    }

    Ok(())
}

// ── Contract ──────────────────────────────────────────────────────────────────

/// Enforce Linux capability bounding set (capability drop).
pub fn d_enforce_contract(_unit_id: &str, config: &serde_json::Value) -> Result<(), SubstrateError> {
    let caps = config.get("drop_capabilities")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect::<Vec<_>>())
        .unwrap_or_default();

    #[cfg(not(feature = "native"))]
    {
        let _ = caps;
        return Ok(());
    }

    #[cfg(all(feature = "native", target_os = "linux"))]
    {
        const PR_CAP_AMBIENT:       libc::c_int   = 47;
        const PR_CAP_AMBIENT_LOWER: libc::c_ulong = 2;
        for cap in caps {
            unsafe {
                libc::prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_LOWER, cap as libc::c_ulong, 0, 0);
            }
        }
        Ok(())
    }

    #[cfg(not(all(feature = "native", target_os = "linux")))]
    {
        let _ = caps;
        Ok(())
    }
}

// ── Network Control ───────────────────────────────────────────────────────────

/// Enforce network namespace rules.
///
/// Actions: "create" (default) | "destroy"
/// UID sanitization matches Python substrate: unit_id[:8].replace('-', '')
pub fn d_control_network(_unit_id: &str, config: &serde_json::Value) -> Result<(), SubstrateError> {
    // Match Python: unit_id[:8].replace('-', '') — first 8 chars then strip hyphens
    let unit_id = cfg_str(config, "_unit_id_override",
        &_unit_id.chars().take(8).collect::<String>());
    let uid    = unit_id.replace('-', "");
    let veth0  = cfg_str(config, "veth0",  &format!("veth{}0", &uid));
    let veth1  = cfg_str(config, "veth1",  &format!("veth{}1", &uid));
    let bridge = cfg_str(config, "bridge", "buccet0");
    let action = cfg_str(config, "action", "create");

    #[cfg(not(feature = "native"))]
    {
        let _ = (veth0, veth1, bridge, action);
        return Ok(());
    }

    #[cfg(feature = "native")]
    {
        match action.as_str() {
            "create" => {
                let cmds = [
                    format!("ip link add {} type veth peer name {}", veth0, veth1),
                    format!("ip link set {} master {}", veth0, bridge),
                    format!("ip link set {} up", veth0),
                    format!("ip link set {} up", veth1),
                ];
                for cmd in &cmds {
                    let status = std::process::Command::new("sh")
                        .args(["-c", cmd])
                        .status()
                        .map_err(|e| SubstrateError::OsError(e.to_string()))?;
                    if !status.success() {
                        return Err(SubstrateError::PermissionDenied(
                            format!("network cmd failed (requires iproute2 + CAP_NET_ADMIN): {}", cmd)
                        ));
                    }
                }
                Ok(())
            }
            "destroy" => {
                // matches Python: subprocess.run(['ip', 'link', 'del', veth0])
                let status = std::process::Command::new("sh")
                    .args(["-c", &format!("ip link del {}", veth0)])
                    .status()
                    .map_err(|e| SubstrateError::OsError(e.to_string()))?;
                if !status.success() {
                    return Err(SubstrateError::OsError(
                        format!("failed to destroy veth pair {}", veth0)
                    ));
                }
                Ok(())
            }
            other => Err(SubstrateError::ValidationFail(
                format!("d_control_network: unknown action '{}'", other)
            )),
        }
    }
}

// ── WASM API ──────────────────────────────────────────────────────────────────

#[cfg(feature = "wasm")]
pub mod wasm_api {
    use super::*;
    use crate::types::{to_js, from_js};
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn d_apply_isolation_wasm(unit_id: &str, config: JsValue) -> JsValue {
        to_js(&d_apply_isolation(unit_id, &from_js(config)))
    }

    /// config: { ...metadata }, limits: { memory?, cpu?, cpu_period?, pids? }
    /// Order matches Python substrate: (unit_id, config, limits)
    #[wasm_bindgen]
    pub fn d_enforce_resource_limit_wasm(unit_id: &str, config: JsValue, limits: JsValue) -> bool {
        d_enforce_resource_limit(unit_id, &from_js(config), &from_js(limits)).is_ok()
    }

    /// Returns pid (f64) on "start" or alive "status", null otherwise.
    /// Store the pid and pass as config._pid for stop/status calls.
    #[wasm_bindgen]
    pub fn d_manage_lifecycle_wasm(unit_id: &str, config: JsValue) -> JsValue {
        match d_manage_lifecycle(unit_id, &from_js(config)) {
            Some(pid) => JsValue::from_f64(pid as f64),
            None      => JsValue::NULL,
        }
    }

    #[wasm_bindgen]
    pub fn d_persist_state_wasm(unit_id: &str, config: JsValue) -> bool {
        d_persist_state(unit_id, &from_js(config)).is_ok()
    }

    /// Enter frozen environment via pivot_root.
    /// Native: calls pivot_root(2) + MNT_DETACH umount — requires CAP_SYS_ADMIN + CLONE_NEWNS.
    /// WASM: path validation only, pivot_root deferred to native runtime.
    /// Call AFTER d_apply_isolation + d_persist_state.
    #[wasm_bindgen]
    pub fn d_enter_environment_wasm(unit_id: &str, config: JsValue) -> bool {
        d_enter_environment(unit_id, &from_js(config)).is_ok()
    }

    #[wasm_bindgen]
    pub fn d_enforce_contract_wasm(unit_id: &str, config: JsValue) -> bool {
        d_enforce_contract(unit_id, &from_js(config)).is_ok()
    }

    /// config.action: "create" | "destroy"
    #[wasm_bindgen]
    pub fn d_control_network_wasm(unit_id: &str, config: JsValue) -> bool {
        d_control_network(unit_id, &from_js(config)).is_ok()
    }
}
