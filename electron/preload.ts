import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  setLightBar: (r: number, g: number, b: number) =>
    ipcRenderer.invoke("hid:setLightBar", r, g, b),
  disconnectHid: () =>
    ipcRenderer.invoke("hid:disconnect"),
  toggleHud: () =>
    ipcRenderer.send("window:toggleHud"),
  isHud: () =>
    ipcRenderer.invoke("window:isHud"),
  onHudMode: (cb: (isHud: boolean) => void) =>
    ipcRenderer.on("hud:mode", (_e, val) => cb(val)),
});
