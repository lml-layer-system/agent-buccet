const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("buccetBox", Object.freeze({
  getState: () => ipcRenderer.invoke("box:get-state"),
  setMode: (mode) => ipcRenderer.invoke("box:set-mode", mode),
  decide: (id, choice, fingerprint) => ipcRenderer.invoke("box:decide", id, choice, fingerprint),
  connect: (host) => ipcRenderer.invoke("box:connect", host),
  openLogs: () => ipcRenderer.invoke("box:open-logs"),
  hide: () => ipcRenderer.invoke("box:hide"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("box-state", listener);
    return () => ipcRenderer.removeListener("box-state", listener);
  },
}));
