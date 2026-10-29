import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Zap, ZapOff, RefreshCw, Music, Images, Circle,
  ChevronRight, Lock, Play, RotateCcw,
} from "lucide-react";
import { useReelCreatorStore, cycleDuration } from "../reelCreatorStore";
import { cameraRecorder, type RecordingResult } from "../services/cameraRecorder";
import { BottomSheet, InlineSpinner, PINK } from "./shell";
import { showSuccess, showError } from "../../../utils/toast";
import { logger } from "../../../utils/logger";

/**
 * Full-screen camera with explicit state machine:
 * checking → rationale → requesting → ready → recording → finalizing → preview → (error | nocam | denied)
 *
 * "Stop means stop": after recording finishes the user sees the captured clip
 * with Retake / Use-clip controls. Only tapping "Use clip" / "Next" advances
 * to the reel composer.
 */

type CameraPhase =
  | "checking"
  | "rationale"
  | "requesting"
  | "ready"
  | "recording"
  | "finalizing"
  | "preview"
  | "denied"
  | "nocam"
  | "error";

export default function CameraStage({
  onClose,
  onRecorded,
  onOpenPicker,
  onOpenMusic,
  onNext,
}: {
  onClose: () => void;
  onRecorded: (result: RecordingResult) => void;
  onOpenPicker: () => void;
  onOpenMusic: () => void;
  onNext: () => void;
}) {
  const selectedMusic = useReelCreatorStore(s => s.selectedMusic);
  const clips = useReelCreatorStore(s => s.clips);
  const setMusic = useReelCreatorStore(s => s.setMusic);
  const durationLimit = useReelCreatorStore(s => s.recordingDurationLimit);
  const setDurationLimit = useReelCreatorStore(s => s.setRecordingDurationLimit);
  const keepOriginalSound = useReelCreatorStore(s => s.keepOriginalSound);
  const setKeepOriginalSound = useReelCreatorStore(s => s.setKeepOriginalSound);
  const setFacingMode = useReelCreatorStore(s => s.setFacingMode);
  const facingMode = useReelCreatorStore(s => s.facingMode);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const capturedResultRef = useRef<RecordingResult | null>(null);
  const closedRef = useRef(false);
  const recordingActiveRef = useRef(false);

  const [phase, setPhase] = useState<CameraPhase>("checking");
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(durationLimit);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [audioSheet, setAudioSheet] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (alive) setPhase("nocam");
        return;
      }
      try {
        const existing = await navigator.permissions?.query({ name: "camera" as PermissionName }).catch(() => null);
        if (existing?.state === "granted") {
          if (alive) setPhase("requesting");
          await startCamera();
          return;
        }
      } catch (_) { /* fall through */ }
      if (alive) setPhase("rationale");
    };
    void boot();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    closedRef.current = true;
    void cameraRecorder.stop();
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await cameraRecorder.start(facingMode);
      if (closedRef.current) { await cameraRecorder.stop(); return; }
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }
      setTorchAvailable(cameraRecorder.isTorchSupported());
      setPhase("ready");
      if (selectedMusic) {
        await cameraRecorder.playMusic(selectedMusic.audioUrl, keepOriginalSound);
        cameraRecorder.pauseMusic();
      }
    } catch (err) {
      const name = (err as DOMException)?.name || "";
      logger.warn("[Camera] start failed:", name, err);
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPhase("denied");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setPhase("nocam");
      } else {
        setError("Could not start the camera on this device.");
        setPhase("error");
      }
    }
  }, [facingMode, keepOriginalSound, selectedMusic]);

  const requestPermission = async () => {
    setPhase("requesting");
    await startCamera();
  };

  const startRecording = async () => {
    if (phase !== "ready" || recordingActiveRef.current) return;
    recordingActiveRef.current = true;
    setPhase("recording");
    setElapsed(0);
    setRemaining(durationLimit);
    cameraRecorder.onElapsed = (e, r) => { setElapsed(e); setRemaining(r); };
    cameraRecorder.onAutoStop = () => {};
    try {
      const result = await cameraRecorder.record(durationLimit, selectedMusic?.audioUrl || null, keepOriginalSound);
      cameraRecorder.onElapsed = null;
      recordingActiveRef.current = false;
      if (closedRef.current) return;
      setPhase("finalizing");
      capturedResultRef.current = result;
      if (liveVideoRef.current) liveVideoRef.current.pause();
      if (previewVideoRef.current) {
        const previewUrl = URL.createObjectURL(result.blob);
        previewVideoRef.current.src = previewUrl;
        previewVideoRef.current.loop = true;
        previewVideoRef.current.muted = false;
        try { await previewVideoRef.current.play(); setPreviewPlaying(true); }
        catch (_) { setPreviewPlaying(false); }
      }
      setPhase("preview");
      showSuccess("Clip captured");
    } catch (err) {
      cameraRecorder.onElapsed = null;
      recordingActiveRef.current = false;
      logger.warn("[Camera] recording failed:", err);
      setPhase("ready");
      showError("Recording failed. Check camera and microphone permission.");
    }
  };

  const stopRecording = () => cameraRecorder.forceStop();

  const handleRetake = async () => {
    const prev = previewVideoRef.current;
    if (prev) {
      const oldSrc = prev.src;
      prev.pause();
      prev.removeAttribute("src");
      prev.load();
      if (oldSrc?.startsWith("blob:")) { try { URL.revokeObjectURL(oldSrc); } catch (_) {} }
    }
    capturedResultRef.current = null;
    setElapsed(0);
    setRemaining(durationLimit);
    setPhase("requesting");
    await startCamera();
  };

  const handleNext = () => {
    const result = capturedResultRef.current;
    if (!result) return;
    onRecorded(result);
  };

  const switchCamera = async () => {
    if (switching || phase === "recording" || phase === "finalizing") return;
    setSwitching(true);
    setTorchOn(false);
    try {
      const stream = await cameraRecorder.switchCamera();
      setFacingMode(cameraRecorder.currentFacing);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }
      setTorchAvailable(cameraRecorder.isTorchSupported());
    } catch (err) {
      logger.warn("[Camera] switch failed:", err);
      showError("Could not switch camera.");
    } finally { setSwitching(false); }
  };

  const toggleTorch = async () => {
    const next = !torchOn;
    const ok = await cameraRecorder.setTorch(next);
    setTorchOn(ok ? next : false);
    if (!ok && next) showError("Flash is not available on this camera.");
  };

  const cycleDurations = () => {
    if (phase === "recording") return;
    const next = cycleDuration(durationLimit);
    setDurationLimit(next);
    setRemaining(next - elapsed);
  };

  const togglePreviewPlayback = () => {
    const el = previewVideoRef.current;
    if (!el) return;
    if (el.paused) { void el.play(); setPreviewPlaying(true); }
    else { el.pause(); setPreviewPlaying(false); }
  };

  const progressPct = durationLimit > 0 ? Math.min(100, (elapsed / durationLimit) * 100) : 0;
  const isRecording = phase === "recording";

  if (phase === "checking" || phase === "requesting") {
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col items-center justify-center gap-4" style={{ background: "#000" }}>
        <InlineSpinner size={30} />
        <p className="text-white/70 text-sm">Starting camera...</p>
      </div>
    );
  }

  if (phase === "finalizing") {
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col items-center justify-center gap-4" style={{ background: "#000" }}>
        <InlineSpinner size={30} />
        <p className="text-white/70 text-sm">Finalizing clip...</p>
      </div>
    );
  }

  if (phase === "rationale") {
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col items-center justify-center px-8 gap-5 text-center" style={{ background: "#0B070C" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,0,110,0.18)" }}>
          <Circle size={26} color={PINK} />
        </div>
        <h2 className="text-white font-extrabold text-lg" style={{ fontFamily: "'Varela Round', sans-serif" }}>Camera access</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          Sparkle needs camera and microphone access so you can record videos with sound.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button type="button" onClick={requestPermission} className="py-3 rounded-2xl font-bold text-white" style={{ background: "#ff1493" }}>Continue</button>
          <button type="button" onClick={onClose} className="py-3 rounded-2xl font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>Not now</button>
        </div>
        <p className="text-white/35 text-[11px] max-w-xs">Your device will show its own permission dialog next. You can change this anytime in Settings.</p>
      </div>
    );
  }

  if (phase === "denied") {
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col items-center justify-center px-8 gap-5 text-center" style={{ background: "#0B070C" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,80,80,0.15)" }}>
          <Lock size={26} color="#FF8A8A" />
        </div>
        <h2 className="text-white font-extrabold text-lg" style={{ fontFamily: "'Varela Round', sans-serif" }}>Camera access is off</h2>
        <p className="text-white/70 text-sm leading-relaxed">Allow camera and microphone access in your device settings to record, or pick a video from your gallery instead.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button type="button" onClick={() => { void startCamera(); }} className="py-3 rounded-2xl font-bold text-white" style={{ background: "#ff1493" }}>Try again</button>
          <button type="button" onClick={onOpenPicker} className="py-3 rounded-2xl font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}>Choose from gallery</button>
        </div>
      </div>
    );
  }

  if (phase === "nocam") {
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col items-center justify-center px-8 gap-5 text-center" style={{ background: "#0B070C" }}>
        <h2 className="text-white font-extrabold text-lg" style={{ fontFamily: "'Varela Round', sans-serif" }}>No camera found</h2>
        <p className="text-white/70 text-sm">This device does not expose a usable camera to Sparkle. You can still create a reel from your gallery.</p>
        <button type="button" onClick={onOpenPicker} className="py-3 rounded-2xl font-bold text-white w-full max-w-xs" style={{ background: "#ff1493" }}>Choose from gallery</button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col items-center justify-center px-8 gap-5 text-center" style={{ background: "#0B070C" }}>
        <h2 className="text-white font-extrabold text-lg">Camera error</h2>
        <p className="text-white/70 text-sm">{error || "Unknown camera error."}</p>
        <button type="button" onClick={onClose} className="py-3 px-8 rounded-2xl font-bold text-white" style={{ background: PINK }}>Go back</button>
      </div>
    );
  }

  if (phase === "preview") {
    return (
      <div className="fixed inset-0 z-[var(--z-modal,60)] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Clip preview">
        <div style={{ paddingTop: "env(safe-area-inset-top)" }} />
        <div className="flex items-center justify-between px-4 py-3">
          <button type="button" onClick={handleRetake} aria-label="Retake clip" className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
            <RotateCcw size={18} />
          </button>
          <span className="text-white text-sm font-bold opacity-70">Preview</span>
          <button type="button" onClick={handleNext} aria-label="Use clip" className="px-5 h-9 rounded-full text-[13px] font-extrabold text-white flex items-center gap-1" style={{ background: PINK }}>
            Next <ChevronRight size={15} />
          </button>
        </div>
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <video ref={liveVideoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ display: "none" }} aria-hidden="true" />
          <video
            ref={previewVideoRef}
            playsInline
            loop
            className="w-full h-full"
            style={{ objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            aria-label="Recorded clip preview"
            onPlay={() => setPreviewPlaying(true)}
            onPause={() => setPreviewPlaying(false)}
          />
          <button type="button" onClick={togglePreviewPlayback} aria-label={previewPlaying ? "Pause preview" : "Play preview"} className="absolute inset-0 flex items-center justify-center" style={{ background: "transparent" }}>
            {!previewPlaying && (
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                <Play size={28} color="#fff" fill="#fff" />
              </div>
            )}
          </button>
        </div>
        <div className="flex items-center justify-center gap-4 px-6 py-5" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
          <button type="button" onClick={handleRetake} className="flex-1 py-3 rounded-2xl font-bold" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)" }}>Retake</button>
          <button type="button" onClick={handleNext} className="flex-1 py-3 rounded-2xl font-extrabold text-white" style={{ background: PINK }}>Use clip</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal,60)] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Camera">
      <div style={{ paddingTop: "env(safe-area-inset-top)" }} />
      <div className="h-1.5 w-full" style={{ background: "rgba(255,255,255,0.15)" }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPct)} aria-label="Recording progress">
        <div className="h-full" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${PINK}, #FF6B8B)`, transition: "width 0.12s linear" }} />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={() => { if (!isRecording) onClose(); }} disabled={isRecording} aria-label="Close camera" className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", color: "#fff", opacity: isRecording ? 0.4 : 1 }}>
          <X size={20} />
        </button>
        <div className="flex items-center gap-2">
          {clips.length > 0 && !isRecording && (
            <button type="button" onClick={onNext} className="px-4 h-9 rounded-full text-[13px] font-extrabold text-white" style={{ background: PINK }}>Next</button>
          )}
          {isRecording && (
            <span className="text-white text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.5)" }}>
              {formatClock(elapsed)} - {Math.ceil(remaining)}s left
            </span>
          )}
          <button type="button" onClick={toggleTorch} disabled={!torchAvailable || isRecording} aria-label={torchOn ? "Turn flash off" : "Turn flash on"} aria-pressed={torchOn} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: torchOn ? PINK : "rgba(0,0,0,0.5)", color: "#fff", opacity: torchAvailable ? 1 : 0.35, cursor: torchAvailable && !isRecording ? "pointer" : "not-allowed" }} title={torchAvailable ? "Flash" : "Flash unavailable on this camera"}>
            {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
          </button>
        </div>
      </div>
      {error && (
        <div className="mx-4 mb-2 rounded-xl px-3 py-2 text-[13px]" style={{ background: "rgba(255,80,80,0.18)", color: "#FFD9D9" }}>{error}</div>
      )}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video ref={liveVideoRef} playsInline muted autoPlay className="max-w-full max-h-full" style={{ width: "100%", height: "100%", objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : "none" }} aria-label="Camera preview" />
        <video ref={previewVideoRef} playsInline loop className="absolute inset-0 w-full h-full object-cover" style={{ display: "none" }} aria-hidden="true" />
        {selectedMusic && !isRecording && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "rgba(0,0,0,0.55)" }}>
            <Music size={13} color="#FFB3C6" />
            <span className="text-white text-[11px] font-bold max-w-[160px] truncate">{selectedMusic.title}</span>
          </div>
        )}
        {switching && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
            <InlineSpinner size={26} />
          </div>
        )}
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10" style={{ marginTop: "-2rem" }}>
        <button type="button" onClick={() => { if (!isRecording) setAudioSheet(true); }} aria-label={selectedMusic ? "Music options" : "Add music"} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", color: "#fff", opacity: isRecording ? 0.4 : 1 }}>
          <Music size={18} />
        </button>
        <button type="button" onClick={cycleDurations} disabled={isRecording} aria-label={`Recording duration ${durationLimit} seconds. Tap to change.`} className="w-11 rounded-full flex flex-col items-center justify-center py-1.5" style={{ background: "rgba(0,0,0,0.55)", color: "#fff", minHeight: 44, opacity: isRecording ? 0.5 : 1 }}>
          <span className="text-[13px] font-black leading-none">{durationLimit}</span>
          <span className="text-[9px] font-bold opacity-70">sec</span>
        </button>
      </div>
      <div className="flex items-center justify-around px-6 py-5" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
        <button type="button" onClick={() => { if (!isRecording) onOpenPicker(); }} aria-label="Open gallery" className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", opacity: isRecording ? 0.4 : 1 }}>
          <Images size={21} />
        </button>
        <button type="button" onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? "Stop recording" : `Record video, limit ${durationLimit} seconds`} className="relative w-[76px] h-[76px] rounded-full flex items-center justify-center" style={{ background: "transparent", border: "4px solid #fff" }}>
          <span style={{ display: "block", width: isRecording ? 30 : 56, height: isRecording ? 30 : 56, borderRadius: isRecording ? 8 : "50%", background: "#FF2D55", transition: "all 0.18s ease" }} />
        </button>
        <button type="button" onClick={switchCamera} disabled={isRecording || switching} aria-label="Switch camera" className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", opacity: isRecording || switching ? 0.4 : 1 }}>
          <RefreshCw size={20} />
        </button>
      </div>
      <BottomSheet open={audioSheet} onClose={() => setAudioSheet(false)} title="Sound">
        {selectedMusic ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.06)" }}>
              {selectedMusic.thumbnailUrl ? (
                <img src={selectedMusic.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Music size={16} color="#FFB3C6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-bold truncate">{selectedMusic.title}</p>
                <p className="text-white/55 text-xs truncate">{selectedMusic.artist}</p>
              </div>
            </div>
            <button type="button" onClick={() => { setAudioSheet(false); onOpenMusic(); }} className="w-full py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2" style={{ background: "#ff1493" }}>
              Change audio <ChevronRight size={16} />
            </button>
            <label className="flex items-center justify-between rounded-2xl px-4 py-3 cursor-pointer" style={{ background: "rgba(255,255,255,0.06)" }}>
              <span className="text-white text-sm font-bold">Keep original sound</span>
              <input type="checkbox" checked={keepOriginalSound} onChange={(e) => setKeepOriginalSound(e.target.checked)} className="w-5 h-5 accent-pink-500" />
            </label>
            <p className="text-white/45 text-[11px] leading-snug">
              {keepOriginalSound ? "Your recording sound and the music will be mixed together." : "The music replaces your recording sound in the final reel."}
            </p>
            <button type="button" onClick={() => { setMusic(null); setAudioSheet(false); }} className="w-full py-3 rounded-2xl font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}>Remove music</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-white/60 text-sm">Add a soundtrack to your reel.</p>
            <button type="button" onClick={() => { setAudioSheet(false); onOpenMusic(); }} className="w-full py-3 rounded-2xl font-bold text-white" style={{ background: "#ff1493" }}>Choose music</button>
          </div>
        )}
      </BottomSheet>
    </div>
  );

  function formatClock(sec: number): string {
    const s = Math.max(0, sec);
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
  }
}
