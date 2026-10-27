import { useRef, useState } from 'react';
import { Check, Trash2, AlignLeft, AlignCenter, AlignRight, Plus } from 'lucide-react';
import { useReelCreatorStore } from '../reelCreatorStore';
import { PINK } from './shell';
import { showSuccess } from '../../../utils/toast';

const TEXT_COLORS = ['#FFFFFF', '#FF006E', '#FFD600', '#00E5FF', '#7CFF6B', '#000000'];
const TEXT_FONTS = ['Varela Round', 'Nunito Sans', 'Impact', 'Georgia', 'Courier New'];

/**
 * Transparent text-overlay editor drawn over the live preview: type text,
 * pick color/font/alignment, drag to position, then Done → Preview.
 */
export default function TextOverlayEditor({ onDone }: { onDone: () => void }) {
  const clips = useReelCreatorStore(s => s.clips);
  const textOverlays = useReelCreatorStore(s => s.textOverlays);
  const addTextOverlay = useReelCreatorStore(s => s.addTextOverlay);
  const updateTextOverlay = useReelCreatorStore(s => s.updateTextOverlay);
  const removeTextOverlay = useReelCreatorStore(s => s.removeTextOverlay);

  const [text, setText] = useState('');
  const [color, setColor] = useState(TEXT_COLORS[0]);
  const [font, setFont] = useState(TEXT_FONTS[0]);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [fontSize, setFontSize] = useState(28);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  const previewBg = clips[0]?.previewUrl || '';

  const onPointerDown = (e: React.PointerEvent) => {
    if (!text.trim() && !editingId) return;
    dragRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) move(e);
  };
  const onPointerUp = () => { dragRef.current = false; };

  const move = (e: React.PointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPos({ x, y });
  };

  const save = () => {
    const clean = text.trim();
    if (!clean) {
      if (editingId) {
        removeTextOverlay(editingId);
        showSuccess('Text removed');
      }
      onDone();
      return;
    }
    if (editingId) {
      updateTextOverlay(editingId, { text: clean, color, font, align, fontSize, x: pos.x, y: pos.y });
      showSuccess('Text updated');
    } else {
      addTextOverlay({
        id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: clean,
        color,
        font,
        align,
        fontSize,
        x: pos.x,
        y: pos.y,
      });
      showSuccess('Text added');
    }
    onDone();
  };

  const startEdit = (id: string) => {
    const o = textOverlays.find(t => t.id === id);
    if (!o) return;
    setEditingId(id);
    setText(o.text);
    setColor(o.color);
    setFont(o.font);
    setAlign(o.align);
    setFontSize(o.fontSize);
    setPos({ x: o.x, y: o.y });
    setExisting(true);
  };

  const clearEditing = () => {
    setEditingId(null);
    setText('');
    setColor(TEXT_COLORS[0]);
    setFont(TEXT_FONTS[0]);
    setAlign('center');
    setFontSize(28);
    setPos({ x: 0.5, y: 0.5 });
    setExisting(false);
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal,60)] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }} role="dialog" aria-modal="true" aria-label="Add text">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button
          type="button"
          onClick={clearEditing}
          className="text-white/70 text-sm font-bold px-2 py-1.5"
          aria-label="Cancel text editing"
        >
          Cancel
        </button>
        <div className="flex gap-1">
          {textOverlays.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => startEdit(o.id)}
              onDoubleClick={() => { removeTextOverlay(o.id); clearEditing(); showSuccess('Text removed'); }}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold max-w-[90px] truncate"
              style={{
                background: editingId === o.id ? PINK : 'rgba(255,255,255,0.14)',
                color: '#fff',
              }}
              title="Tap to edit, double-tap to delete"
            >
              {o.text}
            </button>
          ))}
          {textOverlays.length < 10 && (
            <button
              type="button"
              onClick={() => { clearEditing(); }}
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
              aria-label="New text layer"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          className="px-4 h-9 rounded-full text-[13px] font-extrabold text-white flex items-center gap-1.5"
          style={{ background: PINK }}
        >
          <Check size={15} /> Done
        </button>
      </div>

      {/* Live canvas */}
      <div
        ref={stageRef}
        className="flex-1 relative touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label="Text position canvas — drag to move"
      >
        {previewBg && (
          <img src={previewBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        )}

        {/* Saved overlays */}
        {textOverlays.map(o => (
          <div
            key={o.id}
            className="absolute pointer-events-none"
            style={{
              left: `${o.x * 100}%`,
              top: `${o.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              color: o.color,
              fontFamily: `'${o.font}', sans-serif`,
              fontSize: `${o.fontSize}px`,
              fontWeight: 800,
              textAlign: o.align,
              textShadow: '0 2px 10px rgba(0,0,0,0.55)',
              maxWidth: '86%',
              opacity: editingId === o.id ? 0.35 : 1,
            }}
          >
            {o.text}
          </div>
        ))}

        {/* Live layer */}
        {(text.trim() || existing) && (
          <div
            className="absolute"
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              color,
              fontFamily: `'${font}', sans-serif`,
              fontSize: `${fontSize}px`,
              fontWeight: 800,
              textAlign: align,
              textShadow: '0 2px 10px rgba(0,0,0,0.55)',
              maxWidth: '86%',
              border: dragRef.current ? `1px dashed ${PINK}` : 'none',
              padding: '4px 6px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {text || ''}
            {!text.trim() && <span className="opacity-40">Type something…</span>}
          </div>
        )}
      </div>

      {/* Composer controls */}
      <div className="shrink-0 px-4 pt-3 pb-6 space-y-3" style={{ background: 'rgba(0,0,0,0.6)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={120}
          placeholder="Type your text…"
          className="w-full rounded-2xl px-3.5 py-2.5 bg-white/10 text-white text-[15px] outline-none resize-none placeholder:text-white/40"
          aria-label="Overlay text"
          autoFocus
        />

        <div className="flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TEXT_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full shrink-0"
              style={{ background: c, border: color === c ? `2.5px solid ${PINK}` : '2px solid rgba(255,255,255,0.35)' }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            />
          ))}
          <span className="w-px h-6 shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }} />
          {(['left', 'center', 'right'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAlign(a)}
              className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
              style={{ background: align === a ? 'rgba(255,0,110,0.3)' : 'rgba(255,255,255,0.08)', color: '#fff' }}
              aria-label={`Align ${a}`}
              aria-pressed={align === a}
            >
              {a === 'left' ? <AlignLeft size={15} /> : a === 'center' ? <AlignCenter size={15} /> : <AlignRight size={15} />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TEXT_FONTS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFont(f)}
              className="px-3 py-1.5 rounded-full text-[13px] shrink-0"
              style={{
                fontFamily: `'${f}', sans-serif`,
                background: font === f ? PINK : 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}
              aria-pressed={font === f}
            >
              Aa
            </button>
          ))}
          <span className="w-px h-6 shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="flex items-center gap-2 shrink-0 pl-1">
            <button
              type="button"
              onClick={() => setFontSize(s => Math.max(14, s - 4))}
              className="w-8 h-8 rounded-lg font-bold text-white"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              aria-label="Decrease text size"
            >A−</button>
            <span className="text-white/70 text-xs w-7 text-center">{fontSize}</span>
            <button
              type="button"
              onClick={() => setFontSize(s => Math.min(72, s + 4))}
              className="w-8 h-8 rounded-lg font-bold text-white"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              aria-label="Increase text size"
            >A+</button>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={() => { removeTextOverlay(editingId); clearEditing(); showSuccess('Text removed'); }}
              className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ml-auto"
              style={{ background: 'rgba(255,60,60,0.2)', color: '#FF9C9C' }}
              aria-label="Delete this text layer"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        <p className="text-white/40 text-[11px]">Drag anywhere on the preview to position the text.</p>
      </div>
    </div>
  );
}
