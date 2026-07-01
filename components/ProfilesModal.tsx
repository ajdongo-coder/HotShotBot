"use client";
import { useState, useEffect } from "react";
import type { ControlMapping } from "@/lib/mapping";
import type { Profile } from "@/lib/mapping";
import { loadProfiles, saveProfiles } from "@/lib/mapping";

interface Props {
  currentMapping: ControlMapping;
  onLoad: (mapping: ControlMapping, name: string) => void;
  onClose: () => void;
}

export default function ProfilesModal({ currentMapping, onLoad, onClose }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(loadProfiles());
  }, []);

  function saveNew() {
    const name = newName.trim();
    if (!name) return;
    const profile: Profile = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      mapping: JSON.parse(JSON.stringify(currentMapping)),
    };
    const updated = [...profiles, profile];
    setProfiles(updated);
    saveProfiles(updated);
    setNewName("");
  }

  function loadProfile(profile: Profile) {
    onLoad(profile.mapping, profile.name);
    onClose();
  }

  function deleteProfile(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    const updated = profiles.filter((p) => p.id !== id);
    setProfiles(updated);
    saveProfiles(updated);
    setConfirmDelete(null);
  }

  function overwrite(profile: Profile) {
    const updated = profiles.map((p) =>
      p.id === profile.id
        ? { ...p, mapping: JSON.parse(JSON.stringify(currentMapping)) }
        : p
    );
    setProfiles(updated);
    saveProfiles(updated);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-white text-xl font-bold">Operator Profiles</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {profiles.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-6">No profiles saved yet.</p>
          )}

          {profiles.map((profile) => (
            <div key={profile.id} className="bg-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{profile.name}</p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => overwrite(profile)}
                  title="Overwrite with current settings"
                  className="text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors"
                >
                  Update
                </button>
                <button
                  onClick={() => loadProfile(profile)}
                  className="text-xs text-blue-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => deleteProfile(profile.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    confirmDelete === profile.id
                      ? "bg-red-600 text-white"
                      : "text-zinc-500 hover:text-red-400 bg-zinc-700 hover:bg-zinc-600"
                  }`}
                >
                  {confirmDelete === profile.id ? "Confirm" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Save current as new profile */}
        <div className="px-6 py-4 border-t border-zinc-800 space-y-3">
          <p className="text-zinc-500 text-xs">Save current mapping as a new profile</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder='Operator name (e.g. "Alex")'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveNew()}
              className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={saveNew}
              disabled={!newName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl py-2 text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
