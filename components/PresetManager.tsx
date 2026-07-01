"use client";
import { useState, useEffect } from "react";
import type { Camera } from "@/lib/ptz";
import { recallPresetCmd, savePresetCmd } from "@/lib/ptz";
import type { ControlMapping } from "@/lib/mapping";

interface Props {
  camera: Camera;
  mapping: ControlMapping;
  onMappingChange: (m: ControlMapping) => void;
  onSendCmd: (cmd: string) => void;
  onClose: () => void;
}

const FACE_BUTTONS = [
  { label: "✕", color: "text-blue-400 border-blue-500 bg-blue-600/20",        key: "cross"     },
  { label: "○", color: "text-red-400 border-red-500 bg-red-600/20",           key: "circle"    },
  { label: "□", color: "text-purple-400 border-purple-500 bg-purple-600/20",  key: "square"    },
  { label: "△", color: "text-emerald-400 border-emerald-500 bg-emerald-600/20", key: "triangle" },
] as const;

// Thumbnail URL — proxy through Next.js in browser, direct in Electron (webSecurity:false)
function thumbUrl(ip: string, port: number, index: number): string {
  const direct = `http://${ip}:${port}/cgi-bin/get_preset_thumbnail?preset_number=${index + 1}`;
  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI;
  return isElectron ? direct : `/api/proxy-image?url=${encodeURIComponent(direct)}`;
}

// Query the camera for a preset name via QSJ:35:XX (hex index)
async function fetchPresetName(ip: string, port: number, index: number): Promise<string> {
  const hex = index.toString(16).padStart(2, "0").toUpperCase();
  try {
    const res = await fetch(`/api/camera`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, port, cmd: `QSJ:35:${hex}`, endpoint: "aw_cam" }),
    });
    const data = await res.json();
    // Response: "OSJ:35:XX:Name" — extract the name part
    const text: string = data.response ?? "";
    const parts = text.split(":");
    return parts.length >= 4 ? parts.slice(3).join(":").trim() : "";
  } catch {
    return "";
  }
}

export default function PresetManager({ camera, mapping, onMappingChange, onSendCmd, onClose }: Props) {
  const [names, setNames] = useState<Record<number, string>>({});
  const [loadingNames, setLoadingNames] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [lastAction, setLastAction] = useState("");
  // Which face button index (0-3) is currently waiting for a slot assignment
  const [bindingButton, setBindingButton] = useState<number | null>(null);
  const [thumbBusters, setThumbBusters] = useState<Record<number, number>>({});

  // Load all preset names from the camera on open
  useEffect(() => {
    if (!camera.ip) { setLoadingNames(false); return; }
    let cancelled = false;
    async function loadNames() {
      const result: Record<number, string> = {};
      // Fetch in batches of 10 to avoid hammering the camera
      for (let batch = 0; batch < 10; batch++) {
        if (cancelled) break;
        const promises = Array.from({ length: 10 }, (_, i) => {
          const idx = batch * 10 + i;
          return fetchPresetName(camera.ip, camera.port, idx).then((name) => ({ idx, name }));
        });
        const results = await Promise.all(promises);
        if (cancelled) break;
        results.forEach(({ idx, name }) => { if (name) result[idx] = name; });
        setNames({ ...result }); // update progressively
      }
      if (!cancelled) setLoadingNames(false);
    }
    loadNames();
    return () => { cancelled = true; };
  }, [camera.ip, camera.port]);

  function getName(index: number) {
    return names[index] ?? "";
  }

  function handleSlotClick(index: number, e: React.MouseEvent) {
    if (editingIndex === index) return;
    // If a button is waiting for binding, assign it instead of recalling
    if (bindingButton !== null) {
      rebindButton(bindingButton, index);
      setBindingButton(null);
      setLastAction(`${FACE_BUTTONS[bindingButton].label} → Slot ${index + 1}`);
      return;
    }
    if (e.shiftKey) {
      onSendCmd(savePresetCmd(index));
      setLastAction(`Saved → Slot ${index + 1}`);
      // Reload thumbnail after camera has had time to update it (~1.5s)
      setTimeout(() => setThumbBusters((prev) => ({ ...prev, [index]: Date.now() })), 1500);
    } else {
      onSendCmd(recallPresetCmd(index));
      setLastAction(`Recalled Slot ${index + 1}`);
    }
  }

  function startEdit(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingIndex(index);
    setEditingName(getName(index));
  }

  function commitEdit() {
    if (editingIndex === null) return;
    setNames((prev) => ({ ...prev, [editingIndex]: editingName.trim() }));
    // Write name back to camera: OSJ:35:XX:Name
    if (camera.ip && editingName.trim()) {
      const hex = editingIndex.toString(16).padStart(2, "0").toUpperCase();
      fetch(`/api/camera`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: camera.ip, port: camera.port, cmd: `OSJ:35:${hex}:${editingName.trim()}`, endpoint: "aw_cam" }),
      }).catch(() => {});
    }
    setEditingIndex(null);
  }

  function rebindButton(buttonIdx: number, slotIndex: number) {
    const newBindings = [...mapping.presetBindings] as [number, number, number, number];
    newBindings[buttonIdx] = slotIndex;
    onMappingChange({ ...mapping, presetBindings: newBindings });
  }

  function boundButton(slotIndex: number): number | null {
    const i = mapping.presetBindings.indexOf(slotIndex);
    return i >= 0 ? i : null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-white text-xl font-bold">Preset Manager</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              {camera.name} · Click to recall · Shift+click to save · Double-click name to rename
              {loadingNames && <span className="ml-2 text-blue-400">Loading names…</span>}
            </p>
          </div>
          {lastAction && (
            <span className="text-zinc-400 text-xs bg-zinc-800 px-3 py-1 rounded-full">{lastAction}</span>
          )}
        </div>

        {/* Button bindings */}
        <div className="px-6 py-3 border-b border-zinc-800 flex flex-wrap gap-3 items-center">
          <span className="text-zinc-500 text-xs uppercase tracking-widest shrink-0">
            {bindingButton !== null ? "Now click a preset slot →" : "Controller bindings"}
          </span>
          {FACE_BUTTONS.map((btn, i) => {
            const boundSlot = mapping.presetBindings[i];
            const isActive = bindingButton === i;
            return (
              <button
                key={btn.key}
                onClick={() => setBindingButton(isActive ? null : i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white/10 border-white/40 text-white scale-105 shadow-lg"
                    : `${btn.color} hover:opacity-80`
                }`}
                title="Click then click a preset slot to rebind"
              >
                <span className="text-base leading-none">{btn.label}</span>
                <span className="text-zinc-400 font-normal">
                  {`→ ${boundSlot + 1}${names[boundSlot] ? `: ${names[boundSlot]}` : ""}`}
                </span>
              </button>
            );
          })}
          {bindingButton !== null && (
            <button
              onClick={() => setBindingButton(null)}
              className="text-xs text-zinc-500 hover:text-white transition-colors ml-1"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Preset grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 100 }, (_, index) => {
              const name = getName(index);
              const bound = boundButton(index);
              const btn = bound !== null ? FACE_BUTTONS[bound] : null;
              const isEditing = editingIndex === index;
              const buster = thumbBusters[index];
              const thumb = camera.ip
                ? `${thumbUrl(camera.ip, camera.port, index)}${buster ? `&t=${buster}` : ""}`
                : null;

              return (
                <div
                  key={index}
                  onClick={(e) => handleSlotClick(index, e)}
                  className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all group ${
                    bindingButton !== null
                      ? "border-white/30 hover:border-white hover:scale-105 hover:shadow-lg hover:shadow-white/10"
                      : btn ? "border-zinc-600 hover:border-zinc-500" : "border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  {/* Thumbnail */}
                  {thumb ? (
                    <div className="w-full aspect-video bg-zinc-800 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt={`Preset ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      {/* Slot number overlay */}
                      <div className="absolute top-1 left-1.5 text-[10px] font-mono text-white/60 bg-black/50 px-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center">
                      <span className="text-zinc-600 text-xs font-mono">{index + 1}</span>
                    </div>
                  )}

                  {/* Name row */}
                  <div className="px-2 py-1.5 bg-zinc-900">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingIndex(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-zinc-700 text-white text-xs rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <div
                        className="text-xs truncate cursor-text"
                        style={{ color: name ? "#d4d4d8" : "#52525b" }}
                        onDoubleClick={(e) => startEdit(index, e)}
                      >
                        {name || "—"}
                      </div>
                    )}
                  </div>

                  {/* Button badge */}
                  {btn && (
                    <div className={`absolute top-1 right-1.5 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${btn.color}`}>
                      {btn.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-zinc-600 text-xs">Slot number = camera preset number (1-based)</p>
          <button
            onClick={onClose}
            className="bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl px-6 py-2 text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
