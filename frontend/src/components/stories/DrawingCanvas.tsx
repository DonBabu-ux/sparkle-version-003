import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Undo2, Trash2, Check, X } from 'lucide-react';

/** One freehand stroke: sampled pointer positions plus its paint settings. */
export interface DrawingStroke {
  color: string;
  width: number;
  points: number[];
}

export interface DrawingResult {
  /** PNG data-URL of the composited canvas (transparent background). */
  dataUrl: string;
  strokes: DrawingStroke[];
}

interface DrawingCanvasProps {
  onSave: (result: DrawingResult) => void;
  onClose: () => void;
}

const STROKE_COLORS = ['#FFFFFF', '#FF007F', '#00F2FF', '#FFD700'];
const STROKE_WIDTHS = [4, 10, 22];

/**
 * Full-screen freehand drawing surface. Strokes are kept as point arrays (so
 * undo/clear is a re-render, not an image restore) and only rasterised to a PNG
 * data-URL on save — that data-URL is what the `drawing` sticker carries.
 */
const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [color, setColor] = useState(STROKE_COLORS[0]);
  const [width, setWidth] = useState(STROKE_WIDTHS[1]);
  // The stroke being drawn right now; committed to `strokes` on pointer up.
  const activeRef = useRef<DrawingStroke | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const paint = (stroke: DrawingStroke) => {
      const pts = stroke.points;
      if (pts.length < 2) {
        if (pts.length === 1) {
          ctx.fillStyle = stroke.color;
          ctx.beginPath();
          ctx.arc(pts[0], pts[1], stroke.width / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    };
    strokes.forEach(paint);
    if (activeRef.current) paint(activeRef.current);
  }, [strokes]);

  // Match the backing store to the device pixel ratio so strokes stay crisp;
  // logical coordinates stay CSS pixels for storage.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }, [redraw]);

  useEffect(() => { redraw(); }, [redraw, strokes]);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const [x, y] = toLocal(e);
    activeRef.current = { color, width, points: [x, y] };
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active) return;
    const [x, y] = toLocal(e);
    const len = active.points.length;
    // Skip samples that barely moved — keeps the stored payload small.
    const lastX = active.points[len - 2];
    const lastY = active.points[len - 1];
    if (Math.hypot(x - lastX, y - lastY) < 2.5) return;
    active.points.push(x, y);
    redraw();
  };

  const endStroke = () => {
    const active = activeRef.current;
    activeRef.current = null;
    if (active && active.points.length > 0) setStrokes((prev) => [...prev, active]);
    else redraw();
  };

  const handleClear = useCallback(() => {
    activeRef.current = null;
    setStrokes([]);
  }, []);

  const handleUndo = useCallback(() => {
    activeRef.current = null;
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;
    // Draw onto a clean canvas at device resolution (not the CSS-pixel
    // transform) so the exported PNG is not blurry.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext('2d');
    if (!octx) return;
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    strokes.forEach((stroke) => {
      const pts = stroke.points;
      if (pts.length < 2) return;
      octx.strokeStyle = stroke.color;
      octx.lineWidth = stroke.width;
      octx.beginPath();
      octx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) octx.lineTo(pts[i], pts[i + 1]);
      octx.stroke();
    });
    onSave({ dataUrl: out.toDataURL('image/png'), strokes });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[700] flex flex-col bg-black"
      role="dialog"
      aria-label="Draw"
    >
      <div className="p-6 pt-14 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          aria-label="Cancel drawing"
          className="w-12 h-12 bg-black/20 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90"
        >
          <X size={24} strokeWidth={3} />
        </button>
        <h2 className="text-[13px] font-black italic uppercase tracking-[0.2em] text-white">Draw</h2>
        <button
          onClick={handleUndo}
          disabled={strokes.length === 0}
          aria-label="Undo last stroke"
          className="w-12 h-12 bg-black/20 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 disabled:opacity-30"
        >
          <Undo2 size={22} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 px-4 pb-2 min-h-0">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
          className="w-full h-full rounded-[28px] bg-white/5 border border-white/10 touch-none"
        />
      </div>

      <div className="px-6 pb-12 pt-4 flex flex-col gap-5 shrink-0">
        <div className="flex items-center justify-center gap-4">
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Stroke color ${c}`}
              className={`w-10 h-10 rounded-full border-2 transition-all active:scale-90 ${
                color === c ? 'border-white scale-110 shadow-lg' : 'border-white/20'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              aria-label={`Stroke width ${w}`}
              className={`h-11 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
                width === w ? 'border-white bg-white/10' : 'border-white/10 bg-transparent'
              }`}
              style={{ width: 44 + w * 1.6 }}
            >
              <span className="rounded-full bg-white" style={{ width: w, height: w }} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="h-14 px-6 bg-white/10 border border-white/10 rounded-full text-white font-black uppercase italic text-[11px] tracking-widest flex items-center gap-2 active:scale-95 transition-all disabled:opacity-30"
          >
            <Trash2 size={16} /> Clear
          </button>
          <button
            onClick={handleSave}
            disabled={strokes.length === 0}
            className="h-14 flex-1 bg-primary text-white rounded-full font-black uppercase italic tracking-tight flex items-center justify-center gap-2 active:scale-95 transition-all shadow-2xl disabled:opacity-40"
          >
            <Check size={18} strokeWidth={3} /> Add Drawing
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DrawingCanvas;
