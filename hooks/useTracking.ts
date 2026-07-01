"use client";
import { useRef, useCallback, useState } from "react";

export type TrackingState = "idle" | "detecting" | "tracking" | "lost";

export interface Detection {
  x: number; y: number; w: number; h: number; // normalized 0-1
  score: number;
  id: number;
}

export type ShotPreset = "full" | "mid" | "none";

// Target bounding box height as fraction of frame height for each preset
export const SHOT_PRESETS: Record<ShotPreset, number | null> = {
  full: 0.85, // person fills 85% of frame height
  mid:  0.50, // waist-up, ~50% of frame height
  none: null, // no zoom control
};

export interface TrackingControls {
  trackingState: TrackingState;
  detections: Detection[];
  lockedId: number | null;
  lockedBox: { x: number; y: number; w: number; h: number } | null;
  loadModel: () => Promise<void>;
  modelReady: boolean;
  processFrame: (img: HTMLImageElement, sendPT: (pan: number, tilt: number) => void, sendZoom: (zoom: number) => void, speed: number, shotPreset: ShotPreset) => Promise<void>;
  lockTarget: (id: number) => void;
  clearLock: () => void;
}

let modelCache: import("@tensorflow-models/coco-ssd").ObjectDetection | null = null;
async function getModel() {
  if (modelCache) return modelCache;
  // Load WebGL backend first for GPU-accelerated inference (~5-10x faster than CPU)
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");
  await tf.setBackend("webgl");
  await tf.ready();
  const cocoSsd = await import("@tensorflow-models/coco-ssd");
  modelCache = await cocoSsd.load({ base: "mobilenet_v2" });
  return modelCache;
}

let detectionId = 0;
const DEAD_ZONE = 0.08; // 8% of frame — ignore small jitter

export function useTracking(): TrackingControls {
  const [trackingState, setTrackingState] = useState<TrackingState>("idle");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [lockedBox, setLockedBox] = useState<Detection | null>(null);

  // Refs so processFrame never needs to re-create (stable callback, no dep churn)
  const inferringRef = useRef(false);
  const lockedIdRef = useRef<number | null>(null);
  const lockedBoxRef = useRef<Detection | null>(null);

  // Keep refs in sync with state
  lockedIdRef.current = lockedId;
  lockedBoxRef.current = lockedBox;

  const loadModel = useCallback(async () => {
    await getModel();
    setModelReady(true);
    setTrackingState("detecting");
  }, []);

  const lockTarget = useCallback((id: number) => {
    lockedIdRef.current = id;
    setLockedId(id);
  }, []);

  const clearLock = useCallback(() => {
    lockedIdRef.current = null;
    lockedBoxRef.current = null;
    setLockedId(null);
    setLockedBox(null);
    setTrackingState("detecting");
  }, []);

  const ZOOM_DEAD_ZONE = 0.08; // 8% tolerance before adjusting zoom

  // Stable callback — reads state via refs only, never in deps array
  const processFrame = useCallback(async (
    img: HTMLImageElement,
    sendPT: (pan: number, tilt: number) => void,
    sendZoom: (zoom: number) => void,
    speed: number,
    shotPreset: ShotPreset,
  ) => {
    if (inferringRef.current) return;
    if (!img.complete || img.naturalWidth === 0) return;

    inferringRef.current = true;
    try {
      const model = await getModel();
      const preds = await model.detect(img);
      const people = preds.filter((p) => p.class === "person");
      // COCO-SSD bbox is in pixels relative to the element's rendered size
      const iw = img.width || img.naturalWidth;
      const ih = img.height || img.naturalHeight;

      const dets: Detection[] = people.map((p) => ({
        x: p.bbox[0] / iw,
        y: p.bbox[1] / ih,
        w: p.bbox[2] / iw,
        h: p.bbox[3] / ih,
        score: p.score,
        id: detectionId++,
      }));

      setDetections(dets);

      const currentLockId = lockedIdRef.current;

      if (currentLockId === null) {
        setTrackingState(dets.length > 0 ? "detecting" : "idle");
        sendPT(0, 0);
        return;
      }

      // Find best matching person by center proximity to last known box
      const lb = lockedBoxRef.current;
      const lx = lb ? lb.x + lb.w / 2 : 0.5;
      const ly = lb ? lb.y + lb.h / 2 : 0.5;

      let best: Detection | null = null;
      let bestDist = Infinity;
      for (const d of dets) {
        const cx = d.x + d.w / 2;
        const cy = d.y + d.h / 2;
        const dist = Math.hypot(cx - lx, cy - ly);
        if (dist < bestDist) { bestDist = dist; best = d; }
      }

      if (!best || bestDist > 0.6) {
        setTrackingState("lost");
        sendPT(0, 0);
        return;
      }

      lockedBoxRef.current = best;
      setLockedBox(best);
      setTrackingState("tracking");

      const cx = best.x + best.w / 2;
      const cy = best.y + best.h / 2;
      // offsetX/Y in [-0.5, 0.5] — positive = right/down of center
      const offsetX = cx - 0.5;
      const offsetY = cy - 0.5;

      // Proportional control: speed scales with how far off-center the subject is.
      // Clamp to [-1, 1] so we never exceed full speed.
      // Two-zone control:
      // - Close to center (< 20%): proportional slow-down for smooth settling
      // - Far from center (> 20%): fixed near-max speed so camera catches up fast
      const FAST_ZONE = 0.20;
      function trackAxis(offset: number): number {
        const abs = Math.abs(offset);
        if (abs < DEAD_ZONE) return 0;
        const dir = offset > 0 ? 1 : -1;
        if (abs > FAST_ZONE) return dir * speed; // full tracking speed when far
        return dir * (abs / FAST_ZONE) * speed * 0.5; // proportional when close
      }
      const pan  = trackAxis(offsetX);
      const tilt = trackAxis(offsetY);

      sendPT(pan, tilt);

      // Zoom control: drive zoom to keep box height at target preset
      const targetH = SHOT_PRESETS[shotPreset];
      if (targetH !== null) {
        const heightError = best.h - targetH; // positive = too big → zoom out, negative = too small → zoom in
        if (Math.abs(heightError) > ZOOM_DEAD_ZONE) {
          // zoom axis: positive = tele (zoom in), negative = wide (zoom out)
          const zoomCmd = Math.max(-1, Math.min(1, -heightError * speed * 2));
          sendZoom(zoomCmd);
        } else {
          sendZoom(0);
        }
      }
    } finally {
      inferringRef.current = false;
    }
  }, []); // stable — reads all mutable state via refs

  return {
    trackingState, detections,
    lockedId, lockedBox,
    loadModel, modelReady,
    processFrame, lockTarget, clearLock,
  };
}
