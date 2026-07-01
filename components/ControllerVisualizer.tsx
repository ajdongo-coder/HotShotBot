"use client";
import type { GamepadState } from "@/hooks/useGamepad";
import type { ControlMapping } from "@/lib/mapping";
import { ACTION_LABELS } from "@/lib/mapping";

interface Props {
  state: GamepadState;
  mapping: ControlMapping;
  onRemap?: () => void;
  lightBarColor?: string;
}

function shorten(s: string, max = 9): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export default function ControllerVisualizer({ state, mapping, onRemap, lightBarColor = "#1d4ed8" }: Props) {
  const m = mapping.buttons;
  const lbl = (k: keyof typeof m) => shorten(ACTION_LABELS[m[k]] ?? "");

  const l2Fill = Math.min(state.l2 * 34, 34);
  const r2Fill = Math.min(state.r2 * 34, 34);

  // Stick knob offsets (max travel = r_base - r_knob - 2 = 30 - 16 - 2 = 12)
  const lx = state.leftX * 12;
  const ly = state.leftY * 12;
  const rx = state.rightX * 12;
  const ry = state.rightY * 12;

  const on = (active: boolean) => ({
    fill: active ? "#2563eb" : "#27272a",
    stroke: active ? "#60a5fa" : "#52525b",
  });
  const txt = (active: boolean) => (active ? "#fff" : "#a1a1aa");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 select-none">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-zinc-400 text-xs uppercase tracking-widest">Controller</h3>
        {onRemap && (
          <button
            onClick={onRemap}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Remap
          </button>
        )}
      </div>

      <svg
        viewBox="0 0 540 320"
        className="w-full max-w-[600px] mx-auto"
        style={{ filter: "drop-shadow(0 6px 28px rgba(0,0,0,0.7))" }}
        fontFamily="system-ui,sans-serif"
      >
        <defs>
          <radialGradient id="bodyGrad" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#28282c" />
            <stop offset="100%" stopColor="#18181b" />
          </radialGradient>
          <radialGradient id="gripGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#222225" />
            <stop offset="100%" stopColor="#141416" />
          </radialGradient>
        </defs>

        {/* ── Body ── */}
        <path
          d="
            M 90 66
            C 70 66, 58 57, 58 40
            C 58 16, 80 6, 108 6
            L 432 6
            C 460 6, 482 16, 482 40
            C 482 57, 470 66, 450 66
            L 450 192
            C 456 226, 476 260, 480 296
            C 480 307, 463 313, 447 307
            C 427 279, 416 246, 412 210
            C 407 195, 394 187, 378 184
            C 348 180, 308 178, 270 178
            C 232 178, 192 180, 162 184
            C 146 187, 133 195, 128 210
            C 124 246, 113 279, 93 307
            C 77 313, 60 307, 60 296
            C 64 260, 84 226, 90 192
            Z
          "
          fill="url(#bodyGrad)"
          stroke="#3f3f46"
          strokeWidth="2"
        />

        {/* Grip texture shading */}
        <path
          d="M 90 192 C 84 226, 64 260, 60 296 C 60 307, 77 313, 93 307 C 113 279, 124 246, 128 210 C 133 195, 146 187, 162 184 C 192 180, 232 178, 270 178 C 308 178, 348 180, 378 184 C 394 187, 407 195, 412 210 C 416 246, 427 279, 447 307 C 463 313, 480 307, 480 296 C 476 260, 456 226, 450 192 L 90 192 Z"
          fill="url(#gripGrad)"
        />

        {/* Light bar — color matches active camera */}
        <rect x="196" y="6" width="148" height="5" rx="2.5" fill={lightBarColor} opacity="0.85" />

        {/* ── L2 Trigger ── */}
        <rect x="52" y="1" width="82" height="34" rx="9" fill="#1e1e21" stroke="#3f3f46" strokeWidth="1.5" />
        {l2Fill > 0.5 && (
          <rect x="52" y={35 - l2Fill} width="82" height={l2Fill} rx="9" fill="#2563eb" opacity="0.85" />
        )}
        <rect x="52" y="1" width="82" height="34" rx="9" fill="none" stroke={state.l2 > 0.05 ? "#60a5fa" : "#3f3f46"} strokeWidth="1.5" />
        <text x="93" y="23" textAnchor="middle" fill={state.l2 > 0.08 ? "#fff" : "#a1a1aa"} fontSize="13" fontWeight="700">L2</text>

        {/* ── R2 Trigger ── */}
        <rect x="406" y="1" width="82" height="34" rx="9" fill="#1e1e21" stroke="#3f3f46" strokeWidth="1.5" />
        {r2Fill > 0.5 && (
          <rect x="406" y={35 - r2Fill} width="82" height={r2Fill} rx="9" fill="#2563eb" opacity="0.85" />
        )}
        <rect x="406" y="1" width="82" height="34" rx="9" fill="none" stroke={state.r2 > 0.05 ? "#60a5fa" : "#3f3f46"} strokeWidth="1.5" />
        <text x="447" y="23" textAnchor="middle" fill={state.r2 > 0.08 ? "#fff" : "#a1a1aa"} fontSize="13" fontWeight="700">R2</text>

        {/* ── L1 Bumper ── */}
        <rect x="60" y="38" width="74" height="25" rx="7" {...on(state.l1)} strokeWidth="1.5" />
        <text x="97" y="54" textAnchor="middle" fill={txt(state.l1)} fontSize="12" fontWeight="700">L1</text>
        <text x="97" y="72" textAnchor="middle" fill="#3f3f46" fontSize="8">{lbl("l1")}</text>

        {/* ── R1 Bumper ── */}
        <rect x="406" y="38" width="74" height="25" rx="7" {...on(state.r1)} strokeWidth="1.5" />
        <text x="443" y="54" textAnchor="middle" fill={txt(state.r1)} fontSize="12" fontWeight="700">R1</text>
        <text x="443" y="72" textAnchor="middle" fill="#3f3f46" fontSize="8">{lbl("r1")}</text>

        {/* ── Touchpad ── */}
        <rect x="202" y="106" width="136" height="78" rx="11" fill={state.touchpad ? "#1e3a8a" : "#232326"} stroke={state.touchpad ? "#3b82f6" : "#3f3f46"} strokeWidth="1.5" />
        <text x="270" y="147" textAnchor="middle" fill="#3f3f46" fontSize="9" letterSpacing="1">TOUCHPAD</text>
        <text x="270" y="160" textAnchor="middle" fill={state.touchpad ? "#93c5fd" : "#52525b"} fontSize="8">{lbl("touchpad")}</text>

        {/* ── Options ── */}
        <circle cx="350" cy="92" r="14" {...on(state.options)} strokeWidth="1.5" />
        <text x="350" y="97" textAnchor="middle" fill={txt(state.options)} fontSize="13">≡</text>
        <text x="350" y="114" textAnchor="middle" fill="#3f3f46" fontSize="7.5">{lbl("options")}</text>

        {/* ── Create/Share (no action, decorative) ── */}
        <circle cx="190" cy="92" r="14" fill="#1e1e21" stroke="#3f3f46" strokeWidth="1.5" />
        <text x="190" y="97" textAnchor="middle" fill="#52525b" fontSize="11">✎</text>

        {/* ── PS button ── */}
        <circle cx="270" cy="214" r="17" fill="#1e1e21" stroke="#3f3f46" strokeWidth="1.5" />
        <text x="270" y="220" textAnchor="middle" fill="#71717a" fontSize="11" fontWeight="bold">PS</text>

        {/* ── D-Pad ── */}
        {/* Up */}
        <rect x="91" y="162" width="22" height="32" rx="4" {...on(state.dpadUp)} strokeWidth="1.5" />
        <text x="102" y="182" textAnchor="middle" fill={txt(state.dpadUp)} fontSize="10">▲</text>
        {/* Down */}
        <rect x="91" y="210" width="22" height="32" rx="4" {...on(state.dpadDown)} strokeWidth="1.5" />
        <text x="102" y="230" textAnchor="middle" fill={txt(state.dpadDown)} fontSize="10">▼</text>
        {/* Left */}
        <rect x="61" y="193" width="32" height="22" rx="4" {...on(state.dpadLeft)} strokeWidth="1.5" />
        <text x="77" y="207" textAnchor="middle" fill={txt(state.dpadLeft)} fontSize="10">◀</text>
        {/* Right */}
        <rect x="113" y="193" width="32" height="22" rx="4" {...on(state.dpadRight)} strokeWidth="1.5" />
        <text x="129" y="207" textAnchor="middle" fill={txt(state.dpadRight)} fontSize="10">▶</text>
        {/* Center fill */}
        <rect x="91" y="193" width="22" height="22" fill="#1c1c1e" />
        <text x="102" y="258" textAnchor="middle" fill="#3f3f46" fontSize="7.5">{lbl("dpadUp")}</text>

        {/* ── Left Stick ── */}
        <circle cx="163" cy="128" r="30" fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1.5" />
        <circle
          cx={163 + lx}
          cy={128 + ly}
          r="16"
          fill={state.l3 ? "#2563eb" : "#3a3a3e"}
          stroke={state.l3 ? "#93c5fd" : "#52525b"}
          strokeWidth="2"
        />
        <text x="163" y="170" textAnchor="middle" fill="#3f3f46" fontSize="7.5">
          L3 · {lbl("l3")}
        </text>

        {/* ── Right Stick ── */}
        <circle cx="376" cy="202" r="30" fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1.5" />
        <circle
          cx={376 + rx}
          cy={202 + ry}
          r="16"
          fill={state.r3 ? "#2563eb" : "#3a3a3e"}
          stroke={state.r3 ? "#93c5fd" : "#52525b"}
          strokeWidth="2"
        />
        <text x="376" y="244" textAnchor="middle" fill="#3f3f46" fontSize="7.5">
          R3 · {lbl("r3")}
        </text>

        {/* ── Face Buttons ── */}

        {/* △ Triangle — green */}
        <circle cx="420" cy="117" r="20" fill={state.triangle ? "#065f46" : "#232326"} stroke={state.triangle ? "#34d399" : "#3f3f46"} strokeWidth="1.5" />
        <text x="420" y="124" textAnchor="middle" fill={state.triangle ? "#34d399" : "#4b8c6e"} fontSize="17">△</text>
        <text x="420" y="98" textAnchor="middle" fill="#3f3f46" fontSize="7.5">{lbl("triangle")}</text>

        {/* ○ Circle — red */}
        <circle cx="450" cy="148" r="20" fill={state.circle ? "#7f1d1d" : "#232326"} stroke={state.circle ? "#f87171" : "#3f3f46"} strokeWidth="1.5" />
        <text x="450" y="155" textAnchor="middle" fill={state.circle ? "#f87171" : "#7a4040"} fontSize="17">○</text>
        <text x="475" y="148" textAnchor="start" fill="#3f3f46" fontSize="7.5">{lbl("circle")}</text>

        {/* ✕ Cross — blue */}
        <circle cx="420" cy="179" r="20" fill={state.cross ? "#1e3a8a" : "#232326"} stroke={state.cross ? "#60a5fa" : "#3f3f46"} strokeWidth="1.5" />
        <text x="420" y="186" textAnchor="middle" fill={state.cross ? "#60a5fa" : "#3a5070"} fontSize="17">✕</text>
        <text x="420" y="208" textAnchor="middle" fill="#3f3f46" fontSize="7.5">{lbl("cross")}</text>

        {/* □ Square — pink/purple */}
        <circle cx="390" cy="148" r="20" fill={state.square ? "#4c1d95" : "#232326"} stroke={state.square ? "#c084fc" : "#3f3f46"} strokeWidth="1.5" />
        <text x="390" y="155" textAnchor="middle" fill={state.square ? "#c084fc" : "#5a406a"} fontSize="17">□</text>
        <text x="365" y="148" textAnchor="end" fill="#3f3f46" fontSize="7.5">{lbl("square")}</text>
      </svg>
    </div>
  );
}
