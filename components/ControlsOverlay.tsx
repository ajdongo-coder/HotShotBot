"use client";
import type { GamepadState } from "@/hooks/useGamepad";
import type { ControlMapping } from "@/lib/mapping";
import { ACTION_LABELS } from "@/lib/mapping";

interface Props {
  state: GamepadState;
  mapping: ControlMapping;
  side: "dpad" | "face";
}

const S = 36; // button size px
const G = 4;  // gap px
const TOTAL = S * 3 + G * 2; // total cross width/height = 116

function FaceBtn({ label, action, active, color, x, y }: {
  label: string; action: string; active: boolean; color: string; x: number; y: number;
}) {
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x, top: y, width: S }}>
      <div
        className={`flex items-center justify-center text-sm font-bold rounded-full border-2 transition-all duration-75`}
        style={{ width: S, height: S }}
        data-active={active}
      >
        <div className={`w-full h-full rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-75 ${
          active ? `${color} scale-110 shadow-lg` : "bg-black/25 border-white/15 text-white/35"
        }`}>
          {label}
        </div>
      </div>
      <div className="mt-1 whitespace-nowrap text-white/40 text-[8px] text-center leading-tight">
        {action}
      </div>
    </div>
  );
}

function DpadArm({ label, action, active, x, y, wide }: {
  label: string; action: string; active: boolean; x: number; y: number; wide?: boolean;
}) {
  const w = wide ? S : S;
  const h = S;
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x, top: y, width: w }}>
      <div
        className={`flex items-center justify-center text-sm font-bold border-2 transition-all duration-75 rounded-sm ${
          active ? "bg-blue-500 border-blue-300 text-white scale-105 shadow-lg" : "bg-black/25 border-white/15 text-white/35"
        }`}
        style={{ width: w, height: h }}
      >
        {label}
      </div>
      <div className="mt-1 whitespace-nowrap text-white/40 text-[8px] text-center leading-tight">
        {action}
      </div>
    </div>
  );
}

// Cross-shaped dpad: arms connected by a center piece
function Dpad({ state, up, down, left, right }: {
  state: GamepadState;
  up: string; down: string; left: string; right: string;
}) {
  const mid = S + G; // offset to center column/row

  return (
    <div className="relative" style={{ width: TOTAL, height: TOTAL }}>
      {/* Horizontal bar background */}
      <div
        className="absolute bg-black/15 border border-white/10 rounded-sm"
        style={{ left: 0, top: mid, width: TOTAL, height: S }}
      />
      {/* Vertical bar background */}
      <div
        className="absolute bg-black/15 border border-white/10 rounded-sm"
        style={{ left: mid, top: 0, width: S, height: TOTAL }}
      />
      {/* Arms */}
      <DpadArm label="↑" action={up}    active={state.dpadUp}    x={mid} y={0}    />
      <DpadArm label="↓" action={down}  active={state.dpadDown}  x={mid} y={mid * 2} />
      <DpadArm label="←" action={left}  active={state.dpadLeft}  x={0}   y={mid} />
      <DpadArm label="→" action={right} active={state.dpadRight} x={mid * 2} y={mid} />
    </div>
  );
}

export default function ControlsOverlay({ state, mapping, side }: Props) {
  const m = mapping.buttons;
  const lbl = (k: keyof typeof m) => ACTION_LABELS[m[k]] ?? m[k];

  if (side === "dpad") {
    return (
      <Dpad
        state={state}
        up={lbl("dpadUp")} down={lbl("dpadDown")}
        left={lbl("dpadLeft")} right={lbl("dpadRight")}
      />
    );
  }

  // Face buttons: same total size as the dpad cross for symmetry
  const mid = S + G;
  return (
    <div className="relative" style={{ width: TOTAL, height: TOTAL }}>
      <FaceBtn label="△" action={lbl("triangle")} active={state.triangle}
        color="bg-emerald-500 border-emerald-300 text-white" x={mid} y={0} />
      <FaceBtn label="□" action={lbl("square")} active={state.square}
        color="bg-purple-500 border-purple-300 text-white" x={0} y={mid} />
      <FaceBtn label="○" action={lbl("circle")} active={state.circle}
        color="bg-red-500 border-red-300 text-white" x={mid * 2} y={mid} />
      <FaceBtn label="✕" action={lbl("cross")} active={state.cross}
        color="bg-blue-500 border-blue-300 text-white" x={mid} y={mid * 2} />
    </div>
  );
}
