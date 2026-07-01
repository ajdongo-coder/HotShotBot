# HotShotBot

PS5 DualSense PTZ camera controller with AI person tracking. Built for Panasonic AW-UE70, UE160, and HE130 cameras. Runs as a native Mac app via Electron.

## Features

**Camera Control**
- Full PS5 DualSense gamepad control — pan, tilt, zoom, focus, iris, gain
- Fully remappable buttons and axes
- Multiple control modes: momentum, dual-stick (additive), trigger zoom
- R2 speed brake for precision shots
- PT speed modifier button (slow/fast)

**AI Tracking**
- Click-to-track person detection via COCO-SSD + WebGPU (Metal on Apple Silicon)
- Multi-camera parallel tracking — each camera runs its own Web Worker
- **Full Shot** preset — keeps whole body (head to feet) in frame, auto-zooms
- **Mid Shot** preset — keeps head-to-waist in frame, auto-zooms
- Adjustable dead zone and tracking speed

**Live Feed**
- MJPEG stream display per camera
- Overlay with iris, zoom, focus, AF/MF state
- Full screen mode
- Always-on-top HUD mode (compact overlay for use alongside other software)

**Profiles & Settings**
- Per-operator profiles — save and load full controller configs
- Camera auto-discovery via network scan
- DualSense light bar color per camera (USB)
- Global shortcut `⌘⇧H` to toggle HUD mode

## Requirements

- Apple Silicon Mac (M1/M2/M3)
- macOS 13+
- PS5 DualSense controller (USB or Bluetooth)
- Panasonic PTZ camera on the same local network (AW-UE70, AW-UE160, AW-HE130)

## Installation

Download the latest release from [Releases](../../releases).

1. Open `HotShotBot-x.x.x-arm64.dmg`
2. Drag **HotShotBot** to Applications
3. First launch: right-click the app → **Open** (bypasses Gatekeeper — app is unsigned)

## Development

```bash
npm install
npm run electron:dev
```

Runs Next.js + Electron together. The app opens at `localhost:3000` inside an Electron window.

## Build

```bash
npm run electron:build
```

Outputs a signed-ready `.dmg` and `.zip` to `release/` for Apple Silicon.

## Camera Setup

1. Open the app → click **Cameras**
2. Click **Discover** to auto-scan your network for Panasonic PTZ cameras
3. Or add manually: enter IP, port (default 80), and select the model
4. Each camera gets a color — the DualSense light bar changes to match the active camera (USB only)

## Controller Setup

Connect the DualSense via USB or Bluetooth. Press any button once to activate the Gamepad API — the status dot turns green.

**Default mapping:**

| Input | Action |
|---|---|
| Left stick | Pan / Tilt |
| Right stick Y | Zoom |
| Right stick X | Focus (manual) |
| R2 | Speed brake (hold for precision) |
| L2 | Iris close |
| ✕ / ○ / □ / △ | Recall presets 1–4 |
| L1/R1 + face button | Save preset |
| L3 | Toggle auto focus |
| Options | Cycle camera |
| Touchpad | Cycle white balance |

All buttons and axes are remappable via **Remap → Advanced**.

## Tech Stack

- **Next.js 16** — UI and API routes (PTZ proxy, camera status, network discovery)
- **Electron 42** — native Mac app wrapper, HID light bar control
- **TensorFlow.js + COCO-SSD** — on-device person detection via WebGPU (Metal)
- **Web Workers** — one inference worker per camera for parallel tracking
- **Gamepad API** — DualSense input at 60fps
