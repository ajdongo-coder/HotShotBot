"use client";
import { useEffect, useRef, useCallback, useState } from "react";

export interface GamepadState {
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  cross: boolean;
  circle: boolean;
  square: boolean;
  triangle: boolean;
  l1: boolean;
  r1: boolean;
  l2: number;
  r2: number;
  l3: boolean;
  r3: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  options: boolean;
  touchpad: boolean;
  connected: boolean;
}

const DEFAULT_STATE: GamepadState = {
  leftX: 0, leftY: 0, rightX: 0, rightY: 0,
  cross: false, circle: false, square: false, triangle: false,
  l1: false, r1: false, l2: 0, r2: 0, l3: false, r3: false,
  dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
  options: false, touchpad: false,
  connected: false,
};

function readGamepad(gp: Gamepad): GamepadState {
  const b = gp.buttons;
  const a = gp.axes;
  const btn = (i: number) => b[i]?.pressed ?? false;
  const val = (i: number) => b[i]?.value ?? 0;

  return {
    leftX: a[0] ?? 0,
    leftY: a[1] ?? 0,
    rightX: a[2] ?? 0,
    rightY: a[3] ?? 0,
    cross: btn(0),
    circle: btn(1),
    square: btn(2),
    triangle: btn(3),
    l1: btn(4),
    r1: btn(5),
    l2: val(6),
    r2: val(7),
    l3: btn(10),
    r3: btn(11),
    dpadUp: btn(12),
    dpadDown: btn(13),
    dpadLeft: btn(14),
    dpadRight: btn(15),
    options: btn(9),
    touchpad: btn(17),
    connected: true,
  };
}

// Returns the first connected gamepad, checking all slots
export function findGamepad(): Gamepad | null {
  for (const gp of navigator.getGamepads()) {
    if (gp && gp.connected) return gp;
  }
  return null;
}

export function useGamepad(onFrame: (state: GamepadState) => void): {
  waitingForPress: boolean;
} {
  const rafRef = useRef<number | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // Whether we have a gamepad that the browser has exposed (requires a button press first)
  const [waitingForPress, setWaitingForPress] = useState(false);

  const loop = useCallback(() => {
    const gp = findGamepad();
    if (gp) {
      setWaitingForPress(false);
      onFrameRef.current(readGamepad(gp));
    } else {
      onFrameRef.current({ ...DEFAULT_STATE, connected: false });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    function onConnected(e: GamepadEvent) {
      // Browser fires this after the first button press on a newly connected gamepad
      console.log("Gamepad connected:", e.gamepad.id);
      setWaitingForPress(false);
    }

    function onDisconnected() {
      // Check if any gamepad is still connected
      if (!findGamepad()) {
        onFrameRef.current({ ...DEFAULT_STATE, connected: false });
      }
    }

    window.addEventListener("gamepadconnected", onConnected);
    window.addEventListener("gamepaddisconnected", onDisconnected);

    // If a gamepad is already exposed (e.g. USB plugged in before page load), detect it
    const existing = findGamepad();
    if (existing) {
      setWaitingForPress(false);
    } else {
      // Controller may be paired via BT but browser hasn't seen a button press yet
      setWaitingForPress(true);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("gamepadconnected", onConnected);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
    };
  }, [loop]);

  return { waitingForPress };
}
