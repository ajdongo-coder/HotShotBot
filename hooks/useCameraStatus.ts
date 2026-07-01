"use client";
import { useState, useEffect, useRef } from "react";
import type { Camera } from "@/lib/ptz";

export interface CameraStatus {
  iris: string;
  gain: string;
  zoom: number;
  focus: number;
  autoFocus: boolean;
  autoIris: boolean;
  raw?: Record<string, string>;
}

const POLL_MS = 300;

export function useCameraStatus(camera: Camera | null): {
  status: CameraStatus | null;
  error: boolean;
} {
  const [status, setStatus] = useState<CameraStatus | null>(null);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!camera?.ip) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/camera/status?ip=${encodeURIComponent(camera!.ip)}&port=${camera!.port ?? 80}`
        );
        const data = await res.json();
        if (!cancelled && !data.error) {
          setStatus(data as CameraStatus);
          setError(false);
        } else if (!cancelled) {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) timerRef.current = setTimeout(poll, POLL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [camera?.ip, camera?.port]);

  return { status, error };
}
