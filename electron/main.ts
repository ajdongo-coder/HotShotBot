import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const isDev = process.env.NODE_ENV === "development";
const NEXT_PORT = 3000;

let nextServer: ChildProcess | null = null;

function startNextServer(): Promise<void> {
  return new Promise((resolve) => {
    if (isDev) { resolve(); return; }

    const nextBin = path.join(app.getAppPath(), "node_modules", ".bin", "next");
    const nextDir = app.getAppPath();

    nextServer = spawn(nextBin, ["start", "-p", String(NEXT_PORT)], {
      cwd: nextDir,
      env: { ...process.env, NODE_ENV: "production" },
    });

    nextServer.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("started server") || data.toString().includes("ready")) {
        resolve();
      }
    });

    // Fallback — give it 5s to start
    setTimeout(resolve, 5000);
  });
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isHudMode = false;

const FULL_SIZE  = { width: 1400, height: 900 };
const HUD_SIZE   = { width: 420,  height: 320 };

function createWindow() {
  mainWindow = new BrowserWindow({
    ...FULL_SIZE,
    minWidth: 400,
    minHeight: 280,
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    backgroundColor: "#09090b",
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // keep JS running when window is hidden/unfocused
    },
  });

  mainWindow.loadURL(`http://localhost:${NEXT_PORT}`);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

function toggleHudMode() {
  if (!mainWindow) return;
  isHudMode = !isHudMode;

  if (isHudMode) {
    mainWindow.setSize(HUD_SIZE.width, HUD_SIZE.height, true);
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setResizable(false);
    // Move to bottom-right corner
    const { screen } = require("electron");
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    mainWindow.setPosition(width - HUD_SIZE.width - 20, height - HUD_SIZE.height - 20, true);
    mainWindow.webContents.send("hud:mode", true);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setResizable(true);
    mainWindow.setSize(FULL_SIZE.width, FULL_SIZE.height, true);
    mainWindow.center();
    mainWindow.focus();
    mainWindow.webContents.send("hud:mode", false);
  }
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("HotShotBot");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show / Hide HUD  ⌘⇧H", click: toggleHudMode },
    { label: "Open Full Window", click: () => {
      if (isHudMode) toggleHudMode();
      mainWindow?.show();
      mainWindow?.focus();
    }},
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]));
}

app.whenReady().then(async () => {
  await startNextServer();
  createWindow();
  createTray();

  // Global shortcut: Cmd+Shift+H toggles HUD mode from anywhere
  globalShortcut.register("CommandOrControl+Shift+H", toggleHudMode);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  nextServer?.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// IPC: renderer can request HUD toggle too
ipcMain.on("window:toggleHud", toggleHudMode);
ipcMain.handle("window:isHud", () => isHudMode);

// ── DualSense light bar via HID ──────────────────────────────────────────────

let hidModule: typeof import("node-hid") | null = null;
let dualSenseDevice: InstanceType<typeof import("node-hid").HID> | null = null;

const DUALSENSE_VENDOR  = 0x054c;
const DUALSENSE_PRODUCT = 0x0ce6;

async function getHid() {
  if (!hidModule) hidModule = await import("node-hid");
  return hidModule;
}

ipcMain.handle("hid:setLightBar", async (_event, r: number, g: number, b: number) => {
  try {
    const hid = await getHid();
    if (!dualSenseDevice) {
      const devices = hid.devices(DUALSENSE_VENDOR, DUALSENSE_PRODUCT);
      if (!devices.length) return { ok: false, error: "DualSense not found via USB" };
      dualSenseDevice = new hid.HID(DUALSENSE_VENDOR, DUALSENSE_PRODUCT);
    }
    const report = new Array(48).fill(0);
    report[0]  = 0x02;
    report[1]  = 0xff;
    report[2]  = 0x0f;
    report[44] = r;
    report[45] = g;
    report[46] = b;
    dualSenseDevice.write(report);
    return { ok: true };
  } catch (err) {
    dualSenseDevice = null;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("hid:disconnect", () => {
  if (dualSenseDevice) { try { dualSenseDevice.close(); } catch {} dualSenseDevice = null; }
  return { ok: true };
});
