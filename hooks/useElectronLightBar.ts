"use client";
import { useEffect } from "react";

// Parse a hex color string like "#1d4ed8" into [r, g, b]
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

declare global {
  interface Window {
    electronAPI?: {
      setLightBar: (r: number, g: number, b: number) => Promise<{ ok: boolean; error?: string }>;
      disconnectHid: () => Promise<{ ok: boolean }>;
      toggleHud: () => void;
      isHud: () => Promise<boolean>;
      onHudMode: (cb: (isHud: boolean) => void) => void;
    };
  }
}

export function useElectronLightBar(color: string | undefined) {
  useEffect(() => {
    if (!window.electronAPI || !color) return;
    const [r, g, b] = hexToRgb(color);
    window.electronAPI.setLightBar(r, g, b).catch(() => {});
  }, [color]);
}
