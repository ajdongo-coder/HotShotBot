"use client";
import { useRef, useCallback, useState } from "react";
import type { ShotPreset } from "./useTracking";

export type TrackingState = "idle" | "detecting" | "tracking" | "lost";

export interface Detection {
  x: number; y: number; w: number; h: number;
  score: number; id: number;
}

export interface CameraTrackingConfig {
  enabled: boolean;
  shotPreset: ShotPreset;
  trackingSpeed: number;
}

export interface CameraTrackingState {
  detections: Detection[];
  trackingState: TrackingState;
  lockedBox: Detection | null;
  workerReady: boolean;
}

interface SendCommands {
  sendPT: (pan: number, tilt: number) => void;
  sendZoom: (zoom: number) => void;
}

const DEFAULT_TRACKING_STATE: CameraTrackingState = {
  detections: [], trackingState: "idle", lockedBox: null, workerReady: false,
};

export function useMultiCameraTracking() {
  const workers = useRef(new Map<string, Worker>());
  const sendCommandsMap = useRef(new Map<string, SendCommands>());
  const [trackingStates, setTrackingStates] = useState<Record<string, CameraTrackingState>>({});

  function getState(cameraId: string): CameraTrackingState {
    return trackingStates[cameraId] ?? DEFAULT_TRACKING_STATE;
  }

  const enableTracking = useCallback((
    cameraId: string,
    commands: SendCommands,
  ) => {
    if (workers.current.has(cameraId)) return; // already running

    const worker = new Worker("/tracking.worker.js");
    sendCommandsMap.current.set(cameraId, commands);

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "ready") {
        setTrackingStates((prev) => ({
          ...prev,
          [cameraId]: { ...(prev[cameraId] ?? DEFAULT_TRACKING_STATE), workerReady: true },
        }));
      } else if (msg.type === "result") {
        const { detections, trackingState, lockedBox, pan, tilt, zoom } = msg;
        setTrackingStates((prev) => ({
          ...prev,
          [cameraId]: { detections, trackingState, lockedBox, workerReady: true },
        }));
        const cmds = sendCommandsMap.current.get(cameraId);
        if (cmds) {
          if (pan !== 0 || tilt !== 0) cmds.sendPT(pan, tilt);
          else cmds.sendPT(0, 0);
          if (zoom !== 0) cmds.sendZoom(zoom);
          else cmds.sendZoom(0);
        }
      }
    };

    worker.postMessage({ type: "init" });
    workers.current.set(cameraId, worker);
  }, []);

  const disableTracking = useCallback((cameraId: string) => {
    const worker = workers.current.get(cameraId);
    if (worker) { worker.terminate(); workers.current.delete(cameraId); }
    sendCommandsMap.current.delete(cameraId);
    setTrackingStates((prev) => {
      const next = { ...prev };
      delete next[cameraId];
      return next;
    });
  }, []);

  const sendFrame = useCallback((
    cameraId: string,
    imageData: ImageData,
    width: number,
    height: number,
    speed: number,
    shotPreset: ShotPreset,
    deadZone: number,
  ) => {
    const worker = workers.current.get(cameraId);
    if (!worker) return;
    worker.postMessage(
      { type: "frame", imageData, width, height, speed, shotPreset, deadZone },
      [imageData.data.buffer]
    );
  }, []);

  const lockTarget = useCallback((cameraId: string, box: Detection) => {
    workers.current.get(cameraId)?.postMessage({ type: "lock", box });
    setTrackingStates((prev) => ({
      ...prev,
      [cameraId]: { ...(prev[cameraId] ?? DEFAULT_TRACKING_STATE), lockedBox: box },
    }));
  }, []);

  const clearLock = useCallback((cameraId: string) => {
    workers.current.get(cameraId)?.postMessage({ type: "unlock" });
    setTrackingStates((prev) => ({
      ...prev,
      [cameraId]: { ...(prev[cameraId] ?? DEFAULT_TRACKING_STATE), lockedBox: null, trackingState: "detecting" },
    }));
  }, []);

  const isEnabled = useCallback((cameraId: string) => workers.current.has(cameraId), []);

  return {
    getState,
    trackingStates,
    enableTracking,
    disableTracking,
    sendFrame,
    lockTarget,
    clearLock,
    isEnabled,
  };
}
