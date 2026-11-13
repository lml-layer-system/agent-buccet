import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell, Tray } from "electron";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuccetBoxBackend } from "./backend.mjs";
import { chooseBoxRuntimeLaunch, mergeBoxHostConfig } from "./runtime-launch.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const home = process.env.AGENT_BUCCET_HOME || path.join(os.homedir(), ".buccet");
const backend = createBuccetBoxBackend({ home, onChange: publish, notify: showNotification });
let win;
let tray;
let quitting = false;
let hostStatus = { cursor: false, claude: false, error: null };

function publish() {
  if (win && !win.isDestroyed()) win.webContents.send("box-state", visibleState());
}
function visibleState() {
  const s = backend.state();
  return { ...s, hosts: hostStatus, connected: s.activity.length > 0 };
}
function showWindow() {
  if (!win || win.isDestroyed()) return;
  win.show();
  win.focus();
}
function showNotification(e) {
  if (e.type === "approval") showWindow();
  if (!Notification.isSupported()) return;
  const notification = e.type === "approval"
    ? new Notification({
        title: "Agent Buccet needs your decision",
        body: `${e.actionKind} — ${String(e.target).slice(0, 110)}`,
      })
    : new Notification({
        title: e.decision === "allow" ? "Buccet allowed an action" : "Buccet blocked an action",
        body: `${e.actionKind} — ${String(e.target).slice(0, 110)}`,
      });
  notification.on("click", showWindow);
  notification.show();
}

function createWindow() {
  win = new BrowserWindow({
    title: "Agent Buccet",
    width: 430,
    height: 590,
    minWidth: 360,
    minHeight: 450,
    backgroundColor: "#101a2a",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(root, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadFile(path.join(root, "index.html"));
  win.once("ready-to-show", () => { win.show(); publish(); });
  win.on("close", (event) => {
    if (!quitting) { event.preventDefault(); win.hide(); }
  });
}

function createMenuBarIcon() {
  try {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="#000" d="M12 2 3 6v6c0 5 3.4 8.9 9 10 5.6-1.1 9-5 9-10V6l-9-4Zm0 3.1 6 2.7V12c0 3.5-2.1 6.1-6 7.2-3.9-1.1-6-3.7-6-7.2V7.8l6-2.7Zm-1 8.8-2.2-2.2-1.4 1.4 3.6 3.6 6-6-1.4-1.4-4.6 4.6Z"/></svg>';
    const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
    if (icon.isEmpty()) return;
    icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setToolTip("Agent Buccet");
    tray.on("click", showWindow);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open Agent Buccet", click: showWindow },
      { label: "Quit Agent Buccet", click: () => app.quit() },
    ]));
  } catch (error) {
    console.warn("[buccet-box] tray icon unavailable", error);
  }
}

function findExecutable(name) {
  const envOverride = name === "buccet" ? process.env.BUCCET_BIN : process.env.BUCCET_NODE_BIN;
  if (envOverride && existsSync(envOverride)) return envOverride;
  if (process.platform !== "win32") {
    const result = spawnSync("/usr/bin/which", [name], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
    for (const prefix of [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]) {
      const candidate = path.join(prefix, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function mcpLaunchResult() {
  return chooseBoxRuntimeLaunch({
    packaged: app.isPackaged,
    executable: process.execPath,
    resourcesPath: process.resourcesPath,
    home,
    sourceRoot: path.resolve(root, "../.."),
    findExecutable,
  });
}

function hostConfigPath(host) {
  if (host === "cursor") return path.join(os.homedir(), ".cursor", "mcp.json");
  if (host === "claude" && process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  throw new Error("Unsupported host. Cursor and macOS Claude Desktop are available in this preview.");
}

function configured(host) {
  try {
    const config = JSON.parse(readFileSync(hostConfigPath(host), "utf8"));
    const spec = config?.mcpServers?.buccet;
    const expected = mcpLaunchResult();
    if (!expected.ok || !spec) return false;
    return spec.command === expected.spec.command &&
      JSON.stringify(spec.args ?? []) === JSON.stringify(expected.spec.args);
  } catch { return false; }
}

function updateHostStatus() {
  hostStatus = { cursor: configured("cursor"), claude: configured("claude"), error: null };
  publish();
}

async function connectHost(host) {
  const confPath = hostConfigPath(host);
  const launch = mcpLaunchResult();
  if (!launch.ok) return { ok: false, error: launch.error };
  const spec = launch.spec;
  const decision = await dialog.showMessageBox(win, {
    type: "question",
    title: "Connect Agent Buccet",
    message: `Connect ${host === "cursor" ? "Cursor" : "Claude Desktop"} through Buccet MCP?`,
    detail: "Buccet will back up your existing MCP configuration and add its own server. Other MCP servers are left intact. Restart the host afterward. Protection applies only to actions actually routed through Buccet or supported hooks.",
    buttons: ["Connect", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });
  if (decision.response !== 0) return { ok: false, cancelled: true };
  try {
    mkdirSync(path.dirname(confPath), { recursive: true, mode: 0o700 });
    let original = "{}";
    if (existsSync(confPath)) {
      original = readFileSync(confPath, "utf8");
      copyFileSync(confPath, `${confPath}.buccet-backup-${Date.now()}`);
    }
    const parsed = mergeBoxHostConfig(JSON.parse(original), spec);
    const tmp = `${confPath}.buccet-tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(parsed, null, 2) + "\n", { mode: 0o600 });
    renameSync(tmp, confPath);
    updateHostStatus();
    return {
      ok: true,
      detail: "Buccet MCP installed. Restart your agent host, then send a test action through Buccet. An MCP config alone is not verified enforcement.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
}

app.whenReady().then(async () => {
  if (!singleInstance) return;
  try {
    await backend.start();
    createWindow();
    createMenuBarIcon();
    updateHostStatus();
  } catch (error) {
    dialog.showErrorBox("Agent Buccet could not start", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

ipcMain.handle("box:get-state", () => visibleState());
ipcMain.handle("box:set-mode", async (event, mode) => {
  if (event.sender !== win?.webContents) throw new Error("unauthorized window");
  return backend.setMode(mode);
});
ipcMain.handle("box:decide", (event, id, choice) => {
  if (event.sender !== win?.webContents) throw new Error("unauthorized window");
  return backend.settle(id, choice);
});
ipcMain.handle("box:connect", async (event, host) => {
  if (event.sender !== win?.webContents) throw new Error("unauthorized window");
  return connectHost(host);
});
ipcMain.handle("box:open-logs", async (event) => {
  if (event.sender !== win?.webContents) throw new Error("unauthorized window");
  return shell.openPath(path.join(home, "box"));
});
ipcMain.handle("box:hide", (event) => {
  if (event.sender !== win?.webContents) throw new Error("unauthorized window");
  win.hide();
});

app.on("window-all-closed", () => { /* Keep local authorization server alive. */ });
app.on("activate", showWindow);
app.on("before-quit", (event) => {
  if (!quitting) {
    event.preventDefault();
    quitting = true;
    backend.stop().finally(() => app.quit());
  }
});
