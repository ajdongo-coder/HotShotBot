"use client";
// Hidden component that loads a camera stream and periodically sends frames to a worker.
// Used for background cameras (not currently displayed).
import { useRef, useEffect } from "react";
import type { ShotPreset } from "@/hooks/useTracking";

interface Props {
  streamUrl: string;
  cameraId: string;
  speed: number;
  shotPreset: ShotPreset;
  workerReady: boolean;
  onSendFrame: (imageData: ImageData, w: number, h: number) => void;
}

const CAPTURE_W = 640;
const CAPTURE_H = 360;
const FRAME_INTERVAL_MS = 100;

export default function FrameCapture({ streamUrl, workerReady, onSendFrame }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSendFrameRef = useRef(onSendFrame);
  onSendFrameRef.current = onSendFrame;

  useEffect(() => {
    if (!workerReady) return;

    timerRef.current = setInterval(() => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas || !img.complete || img.naturalWidth === 0) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, CAPTURE_W, CAPTURE_H);
      const imageData = ctx.getImageData(0, 0, CAPTURE_W, CAPTURE_H);
      onSendFrameRef.current(imageData, CAPTURE_W, CAPTURE_H);
    }, FRAME_INTERVAL_MS);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [workerReady]);

  return (
    <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={streamUrl}
        alt=""
        crossOrigin="anonymous"
        style={{ width: CAPTURE_W, height: CAPTURE_H }}
      />
      <canvas ref={canvasRef} width={CAPTURE_W} height={CAPTURE_H} />
    </div>
  );
}
