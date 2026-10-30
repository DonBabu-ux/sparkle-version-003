import type { CaptionCue, ReelClip, StickerOverlay, TextOverlay } from '../types';

/**
 * Reel compositor.
 *
 * Renders the final reel (clip sequence + trims + text/stickers + captions)
 * into a single video file using canvas.captureStream + MediaRecorder —
 * a real client-side compositing path available in Chromium/Android WebView.
 *
 * Multi-clip reels are concatenated sequentially in timeline order.
 * Images render for a fixed 3s segment (or their trimEnd if set).
 *
 * If the runtime cannot record (no MediaRecorder/captureStream), the caller
 * receives a clear error and the single-source path (no edits requiring
 * re-encode) can fall back to uploading the original file.
 */

export interface RenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  /** 0–1, audio mix of the music track when selectedMusicUrl present. */
  keepOriginalSound: boolean;
  musicUrl?: string | null;
  musicVolume?: number;
  /** Burn the Sparkle watermark badge into every frame (default off). */
  watermark?: boolean;
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
}

export interface RenderResult {
  blob: Blob;
  durationSec: number;
  width: number;
  height: number;
  mimeType: string;
  /** Best-effort probe: true/false when the runtime can detect an audio track, undefined when undetectable. */
  hasAudio?: boolean;
}

const pickRecorderMime = (): string | null => {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch (_) { /* continue */ }
  }
  return '';
};

/**
 * Best-effort detection of an audio track in a recorded blob.
 * Chromium exposes webkitAudioDecodedByteCount, Firefox mozHasAudio,
 * Safari/others audioTracks — returns undefined when none are available.
 */
export async function probeBlobHasAudio(blob: Blob): Promise<boolean | undefined> {
  if (typeof document === 'undefined') return undefined;
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.preload = 'auto';
  v.muted = true;
  v.src = url;
  try {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      v.onloadeddata = done;
      v.onerror = done;
      setTimeout(done, 1500);
    });
    const anyV = v as HTMLVideoElement & {
      mozHasAudio?: boolean;
      webkitAudioDecodedByteCount?: number;
      audioTracks?: { length: number };
    };
    if (typeof anyV.mozHasAudio === 'boolean') return anyV.mozHasAudio;
    if (typeof anyV.webkitAudioDecodedByteCount === 'number') {
      try { await v.play(); await new Promise((r) => setTimeout(r, 400)); v.pause(); } catch (_) { /* ignore */ }
      return anyV.webkitAudioDecodedByteCount > 0;
    }
    if (anyV.audioTracks && typeof anyV.audioTracks.length === 'number') {
      return anyV.audioTracks.length > 0;
    }
    return undefined;
  } catch (_) {
    return undefined;
  } finally {
    try { v.removeAttribute('src'); v.load(); } catch (_) { /* ignore */ }
    URL.revokeObjectURL(url);
  }
}

export function canComposite(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('video load timeout')), 15000);
    v.onloadeddata = () => { clearTimeout(timer); resolve(v); };
    v.onerror = () => { clearTimeout(timer); reject(new Error('video load failed')); };
    v.src = url;
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/** Seconds from the trimmed source timeline of a clip. */
export function clipEffectiveDuration(clip: ReelClip): number {
  const end = clip.trimEnd ?? clip.durationSec;
  return Math.max(clip.kind === 'image' ? 3 : 0.2, end - (clip.trimStart || 0));
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): void {
  const scale = Math.max(dw / sw, dh / sh);
  const rw = sw * scale;
  const rh = sh * scale;
  const ox = (dw - rw) / 2;
  const oy = (dh - rh) / 2;
  ctx.drawImage(source, ox, oy, rw, rh);
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  textOverlays: TextOverlay[],
  stickerOverlays: StickerOverlay[],
  cues: CaptionCue[],
  tSec: number,
): void {
  // Text overlays
  for (const o of textOverlays) {
    ctx.save();
    ctx.font = `${o.fontSize}px ${o.font || "'Varela Round', sans-serif"}`;
    ctx.fillStyle = o.color || '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.max(2, o.fontSize / 8);
    const x = o.x * w;
    const y = o.y * h;
    const lines = String(o.text || '').split('\n');
    const lineH = o.fontSize * 1.25;
    const startY = y - ((lines.length - 1) * lineH) / 2;
    ctx.textAlign = o.align === 'left' ? 'left' : o.align === 'right' ? 'right' : 'center';
    lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineH);
    });
    ctx.restore();
  }

  // Stickers (emoji rendered as text; GIFs drawn as images are handled by caller via imgCache)
  for (const s of stickerOverlays) {
    ctx.save();
    ctx.translate(s.x * w, s.y * h);
    ctx.rotate(((s.rotation || 0) * Math.PI) / 180);
    const size = Math.round(64 * (s.scale || 1) * (h / 1080 + 0.7));
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (s.type === 'emoji') {
      ctx.fillText(s.content, 0, 0);
    }
    ctx.restore();
  }

  // Captions — centered lower third while active
  const active = cues.find(c => tSec >= c.start && tSec < c.end);
  if (active) {
    ctx.save();
    const fontSize = Math.round(h * 0.036);
    ctx.font = `700 ${fontSize}px 'Nunito Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 6;
    const maxW = w * 0.86;
    const words = active.text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    const baseY = h * 0.84;
    const lineH = fontSize * 1.3;
    const startY = baseY - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, startY + i * lineH);
    });
    ctx.restore();
  }
}

/** Small persistent "Sparkle" badge burned into the bottom-right of every frame. */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  const fontSize = Math.max(11, Math.round(h * 0.022));
  ctx.font = `800 ${fontSize}px 'Varela Round', sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Sparkle', w - Math.round(w * 0.03), h - Math.round(h * 0.025));
  ctx.restore();
}

/**
 * Render the reel to a video Blob.
 * Throws with a descriptive message when the runtime lacks the capability.
 */
export async function renderReel(
  clips: ReelClip[],
  options: RenderOptions,
): Promise<RenderResult> {
  if (!clips.length) throw new Error('NO_CLIPS');
  if (!canComposite()) throw new Error('COMPOSITE_UNSUPPORTED');

  const mime = pickRecorderMime();
  if (mime === null) throw new Error('MEDIA_RECORDER_UNSUPPORTED');

  const fps = options.fps ?? 30;
  const targetW = options.width ?? 720;
  const targetH = options.height ?? 1280;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('CANVAS_UNSUPPORTED');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, targetW, targetH);

  // Preload sources in parallel
  const sources = await Promise.all(
    clips.map(async (clip) => {
      if (clip.kind === 'image') {
        const img = await loadImage(clip.previewUrl);
        return { clip, img, video: null as HTMLVideoElement | null };
      }
      const video = await loadVideo(clip.previewUrl);
      return { clip, img: null as HTMLImageElement | null, video };
    }),
  );

  const stream = canvas.captureStream(fps);
  const audioCtx = new AudioContext();
  // Autoplay policy: a fresh AudioContext can start 'suspended' — without an
  // explicit resume() no data flows through the graph and the whole reel
  // (music included) records silent. Resume now and again on first play.
  if (audioCtx.state !== 'running') {
    try { await audioCtx.resume(); } catch (_) { /* retried in the draw loop */ }
  }
  const dest = audioCtx.createMediaStreamDestination();
  let musicEl: HTMLAudioElement | null = null;
  const micStream: MediaStream | null = null;
  let musicSource: MediaElementAudioSourceNode | null = null;

  // Mix: original source audio (when kept) + music track.
  const originalGain = audioCtx.createGain();
  originalGain.gain.value = options.keepOriginalSound ? 1 : 0;
  originalGain.connect(dest);

  for (const s of sources) {
    if (s.video && options.keepOriginalSound) {
      try {
        const el = audioCtx.createMediaElementSource(s.video);
        el.connect(originalGain);
        // A MediaElementAudioSourceNode samples the element's OUTPUT, and a
        // muted element outputs silence — un-mute only after the graph
        // connection succeeds. Rerouted audio does NOT leak to the speakers
        // because nothing is connected to audioCtx.destination.
        s.video.muted = false;
        s.video.volume = 1;
      } catch (_) {
        // Already wired or unsupported — keep this clip muted (no speaker leak).
        s.video.muted = true;
      }
    }
  }

  if (options.musicUrl) {
    try {
      musicEl = new Audio(options.musicUrl);
      musicEl.loop = true;
      musicEl.crossOrigin = 'anonymous';
      musicEl.volume = 1;
      musicSource = audioCtx.createMediaElementSource(musicEl);
      const musicGain = audioCtx.createGain();
      musicGain.gain.value = options.musicVolume ?? 0.9;
      musicSource.connect(musicGain);
      musicGain.connect(dest);
      await musicEl.play().catch(() => { /* autoplay policy — render continues, retried below */ });
    } catch (_) {
      musicEl = null;
    }
  }

  for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);

  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopAll = () => {
    try { musicEl?.pause(); } catch (_) { /* ignore */ }
    try { musicSource?.disconnect(); } catch (_) { /* ignore */ }
    try { micStream?.getTracks().forEach(t => t.stop()); } catch (_) { /* ignore */ }
    for (const s of sources) {
      try {
        s.video?.pause();
        s.video?.removeAttribute('src');
        s.video?.load();
      } catch (_) { /* ignore */ }
    }
    void audioCtx.close().catch(() => { /* ignore */ });
  };

  const totalDuration = clips.reduce((sum, c) => sum + clipEffectiveDuration(c), 0);
  const startedAt = performance.now();

  return new Promise<RenderResult>((resolve, reject) => {
    let cancelled = false;
    let frameHandle = 0;

    const fail = (err: Error) => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
      if (recorder.state !== 'inactive') recorder.stop();
      stopAll();
      reject(err);
    };

    recorder.onstop = () => {
      stopAll();
      if (cancelled) return;
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      if (!blob.size) {
        reject(new Error('RENDER_EMPTY'));
        return;
      }
      options.onProgress?.(1);
      void probeBlobHasAudio(blob).then((hasAudio) => {
        resolve({
          blob,
          durationSec: totalDuration,
          width: targetW,
          height: targetH,
          mimeType: blob.type,
          hasAudio,
        });
      });
    };

    recorder.start(250);

    let sourceIndex = 0;

    const drawFrame = async () => {
      if (cancelled) return;
      if (options.signal?.cancelled) {
        fail(new Error('CANCELLED'));
        return;
      }
      const elapsed = (performance.now() - startedAt) / 1000;

      // Walk the timeline
      let acc = 0;
      let activeIndex = -1;
      let activeOffset = 0;
      for (let i = 0; i < clips.length; i++) {
        const d = clipEffectiveDuration(clips[i]);
        if (elapsed < acc + d) {
          activeIndex = i;
          activeOffset = elapsed - acc;
          break;
        }
        acc += d;
      }

      if (activeIndex === -1) {
        // Timeline complete
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }

      sourceIndex = activeIndex;
      const s = sources[sourceIndex];
      const trimStart = s.clip.trimStart || 0;

      ctx!.fillStyle = '#000000';
      ctx!.fillRect(0, 0, targetW, targetH);

      if (s.img) {
        drawCover(ctx!, s.img, s.img.naturalWidth, s.img.naturalHeight, targetW, targetH);
      } else if (s.video) {
        const v = s.video;
        const targetTime = trimStart + activeOffset;
        if (Math.abs(v.currentTime - targetTime) > 0.12) {
          try { v.currentTime = targetTime; } catch (_) { /* seek while playing is fine */ }
        }
        if (v.paused) {
          try {
            await v.play();
            // The AudioContext can also be suspended by autoplay policy at
            // the moment media first plays — resume lazily here.
            if (audioCtx.state !== 'running') {
              try { await audioCtx.resume(); } catch (_) { /* ignore */ }
            }
          } catch (_) { /* ignore */ }
        }
        if (v.readyState >= 2) {
          drawCover(ctx!, v, v.videoWidth || targetW, v.videoHeight || targetH, targetW, targetH);
        }
      }

      // Pause other sources to save CPU/bandwidth
      for (let i = 0; i < sources.length; i++) {
        if (i !== sourceIndex && sources[i].video && !sources[i].video!.paused) {
          sources[i].video!.pause();
        }
      }

      drawOverlays(ctx!, targetW, targetH, overlayState.textOverlays, overlayState.stickerOverlays, overlayState.cues, elapsed);
      if (options.watermark) {
        drawWatermark(ctx!, targetW, targetH);
      }

      options.onProgress?.(Math.min(0.99, elapsed / Math.max(totalDuration, 0.1)));
      frameHandle = requestAnimationFrame(drawFrame);
    };

    void drawFrame();

    // Hard stop guard at totalDuration + 1.5s (in case of clock drift)
    const guard = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, (totalDuration + 1.5) * 1000);
    guard.unref?.();
  }).finally(() => {
    stopAll();
  });
}

/**
 * Mutable overlay state bridge: renderReel reads the latest overlays from
 * here each frame without needing them in its options signature (avoids
 * re-render loops when overlays change mid-render).
 */
export const overlayState: {
  textOverlays: TextOverlay[];
  stickerOverlays: StickerOverlay[];
  cues: CaptionCue[];
} = { textOverlays: [], stickerOverlays: [], cues: [] };

export function setOverlayState(patch: Partial<typeof overlayState>): void {
  Object.assign(overlayState, patch);
}

/** Trim a single video clip by re-encoding the selected range. */
export async function renderTrimmedClip(
  clip: ReelClip,
  options?: { onProgress?: (f: number) => void; signal?: { cancelled: boolean } },
): Promise<{ blob: Blob; mimeType: string }> {
  const savedOverlays = { ...overlayState };
  setOverlayState({ textOverlays: [], stickerOverlays: [], cues: [] });
  try {
    const result = await renderReel([clip], {
      keepOriginalSound: true,
      musicUrl: null,
      onProgress: options?.onProgress,
      signal: options?.signal,
      width: 720,
      height: 1280,
    });
    return { blob: result.blob, mimeType: result.mimeType };
  } finally {
    setOverlayState(savedOverlays);
  }
}
