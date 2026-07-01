// Tracking Web Worker — runs TF.js + COCO-SSD fully off the main thread.
// One instance per camera. Receives ImageData frames, sends back detections + PTZ commands.

let model = null;
let lockedBox = null;
let inferring = false;

// Defaults — overridden per-frame by the deadZone param
const DEFAULT_DEAD_ZONE = 0.03;
const DEFAULT_ZOOM_DEAD_ZONE = 0.05;
// targetH = desired bounding box height as fraction of frame height.
// full: whole person visible, box fills ~80% of frame height
// mid:  waist-up only — zoom in until box is ~1.8× frame height (top 50% of body fills frame)
const SHOT_PRESETS = { full: 0.80, mid: 1.80, none: null };

// Tilt target Y per preset — where to aim the vertical anchor point in the frame
// full: center the whole body → anchor = box center → target = 0.5
// mid:  show head to waist → anchor = head → target = 0.22 (upper quarter)
// All presets anchor on the head — ensures head is always in frame.
// targetY = where the head should sit vertically (0 = top, 1 = bottom).
// full: head near top so feet have room below (~15% from top)
// mid:  head higher in frame for waist-up framing (~20% from top)
// none: head at comfortable upper-third (~28% from top)
const TILT_TARGETS = {
  full: { targetY: 0.15 },
  mid:  { targetY: 0.20 },
  none: { targetY: 0.28 },
};

const HEAD_OFFSET = 0.04; // fraction of box height from top where head sits

async function loadModel() {
  // Import TF.js and COCO-SSD via CDN — workers can't use webpack bundled modules
  importScripts(
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgpu@4.22.0/dist/tf-backend-webgpu.min.js",
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"
  );
  // WebGPU maps to Metal on Apple Silicon — significantly faster than WebGL on M-series chips
  // Falls back to CPU if WebGPU isn't available
  const backend = (await tf.setBackend("webgpu").then(() => true).catch(() => false))
    ? "webgpu"
    : await tf.setBackend("cpu").then(() => "cpu");
  console.log(`[tracking worker] TF.js backend: ${backend}`);
  await tf.ready();
  model = await cocoSsd.load({ base: "mobilenet_v2" });
  postMessage({ type: "ready" });
}

function trackAxis(offset, speed, deadZone) {
  const abs = Math.abs(offset);
  if (abs < deadZone) return 0;
  const dir = offset > 0 ? 1 : -1;
  // Proportional in the near zone, full speed beyond 3x dead zone
  const fastZone = deadZone * 3;
  if (abs > fastZone) return dir * speed;
  return dir * ((abs - deadZone) / (fastZone - deadZone)) * speed;
}

async function processFrame(imageData, width, height, speed, shotPreset, deadZone) {
  deadZone = deadZone ?? DEFAULT_DEAD_ZONE;
  const zoomDeadZone = deadZone * 1.5;
  if (!model || inferring) return;
  inferring = true;

  try {
    // Convert ImageData → ImageBitmap for model.detect()
    const bitmap = await createImageBitmap(new Blob([imageData.data.buffer], { type: "image/raw" })
      .constructor === Blob
      ? imageData
      : imageData
    );

    // Actually createImageBitmap accepts ImageData directly in workers
    const bmp = await createImageBitmap(imageData);
    const preds = await model.detect(bmp);
    bmp.close();

    const people = preds.filter(p => p.class === "person");
    const dets = people.map((p, i) => ({
      x: p.bbox[0] / width,
      y: p.bbox[1] / height,
      w: p.bbox[2] / width,
      h: p.bbox[3] / height,
      score: p.score,
      id: i,
    }));

    if (!lockedBox) {
      postMessage({ type: "result", detections: dets, trackingState: dets.length > 0 ? "detecting" : "idle", lockedBox: null, pan: 0, tilt: 0, zoom: 0 });
      return;
    }

    // Find best match by center proximity
    const lx = lockedBox.x + lockedBox.w / 2;
    const ly = lockedBox.y + lockedBox.h / 2;
    let best = null, bestDist = Infinity;
    for (const d of dets) {
      const dist = Math.hypot((d.x + d.w / 2) - lx, (d.y + d.h / 2) - ly);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }

    if (!best || bestDist > 0.6) {
      postMessage({ type: "result", detections: dets, trackingState: "lost", lockedBox, pan: 0, tilt: 0, zoom: 0 });
      return;
    }

    lockedBox = best;

    // Pan: keep body horizontally centered
    const cx = best.x + best.w / 2;
    const pan = trackAxis(cx - 0.5, speed, deadZone);

    // Tilt: always anchor on the head, target Y depends on preset
    const tiltTarget = TILT_TARGETS[shotPreset] ?? TILT_TARGETS.none;
    const headY = best.y + best.h * HEAD_OFFSET;
    const tilt = trackAxis(headY - tiltTarget.targetY, speed, deadZone);

    let zoom = 0;
    const targetH = SHOT_PRESETS[shotPreset] ?? null;
    if (targetH !== null) {
      const err = best.h - targetH;
      if (Math.abs(err) > zoomDeadZone) {
        zoom = Math.max(-1, Math.min(1, -err * speed * 2));
      }
    }

    postMessage({ type: "result", detections: dets, trackingState: "tracking", lockedBox: best, pan, tilt, zoom });
  } catch (e) {
    postMessage({ type: "error", message: e.message });
  } finally {
    inferring = false;
  }
}

self.onmessage = async (e) => {
  const { type } = e.data;
  if (type === "init") {
    await loadModel();
  } else if (type === "frame") {
    const { imageData, width, height, speed, shotPreset, deadZone } = e.data;
    await processFrame(imageData, width, height, speed, shotPreset, deadZone);
  } else if (type === "lock") {
    lockedBox = e.data.box;
  } else if (type === "unlock") {
    lockedBox = null;
  }
};
