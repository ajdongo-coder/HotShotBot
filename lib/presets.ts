export interface PresetSlot {
  index: number;   // 0-99
  name: string;
}

export function loadPresets(cameraId: string): PresetSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`ptz-presets-${cameraId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function savePresets(cameraId: string, slots: PresetSlot[]) {
  localStorage.setItem(`ptz-presets-${cameraId}`, JSON.stringify(slots));
}

// Returns a map of index → name for quick lookup
export function presetsToMap(slots: PresetSlot[]): Map<number, string> {
  return new Map(slots.map((s) => [s.index, s.name]));
}
