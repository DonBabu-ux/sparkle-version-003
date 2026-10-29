import { showError, showInfo } from '../../utils/toast';
import { useState } from 'react';
import { X, Zap, GraduationCap, Code, Palette, PenTool, Music, Cpu, Hammer, Check, ArrowRight } from 'lucide-react';
import api from '../../api/api';
import { motion } from 'framer-motion';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';

const CATEGORIES = [
  { id: 'tutoring',  name: 'Tutoring',     icon: GraduationCap },
  { id: 'coding',    name: 'Coding',        icon: Code },
  { id: 'design',    name: 'Design',        icon: Palette },
  { id: 'writing',   name: 'Writing',       icon: PenTool },
  { id: 'music',     name: 'Music',         icon: Music },
  { id: 'tech',      name: 'Tech Support',  icon: Cpu },
  { id: 'other',     name: 'Other',         icon: Hammer },
];

const SKILL_TYPES = [
  { id: 'teaching',    name: 'Teaching / Tutoring', desc: 'Share your knowledge one-on-one' },
  { id: 'doing',       name: 'Service / Work',       desc: 'Complete tasks or projects for others' },
  { id: 'consulting',  name: 'Consulting',            desc: 'Provide expert advice & strategy' },
];

interface FormData {
  title: string;
  description: string;
  category: string;
  skill_type: string;
  price: string;
  is_free: boolean;
}

export default function SkillOfferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: 'tutoring',
    skill_type: 'teaching',
    price: '',
    is_free: false,
  });
  // Conditionally mounted by its parent: open whenever rendered.
  const a11yRef = useModalA11y(true, onClose);

  const update = (patch: Partial<FormData>) => setFormData(p => ({ ...p, ...patch }));

  const DESC_MIN_WORDS = 5;
  const DESC_MAX_WORDS = 150;
  const words = formData.description.match(/\S+/g) || [];
  const wordCount = words.length;
  const descOk   = wordCount >= DESC_MIN_WORDS;
  const descOver = wordCount > DESC_MAX_WORDS;
  const canNext  = descOk && !descOver;

 const handleSubmit = async () => {
    if (formData.title.trim().length < 2) {
      setStep(1);
      showInfo('Please provide a service title (at least 2 characters) before publishing.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/skill-market/offers', formData);
      setDone(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1800);
    } catch (err) {
      logger.error('Failed to create skill offer:', err);
      showError('Could not create listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="sof-overlay">
      <div className="sof-backdrop" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
        className="sof-sheet"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          /* ── Success state ─────────────────────────────── */
          <div className="sof-success">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 14, delay: 0.1 }}
              className="sof-success__circle"
            >
              <Check size={40} strokeWidth={3} />
            </motion.div>
            <h3 className="sof-success__title">Listing created!</h3>
            <p className="sof-success__sub">Your skill is now live on the marketplace.</p>
          </div>
        ) : (
          <>
            {/* ── Header ───────────────────────────────────── */}
            <div className="sof-header">
              <div>
                <h2 className="sof-header__title">List a skill</h2>
                <div className="sof-steps">
                  {[1, 2].map(n => (
                    <div key={n} className={`sof-step ${n === step ? 'sof-step--active' : n < step ? 'sof-step--done' : ''}`} />
                  ))}
                  <span className="sof-steps__label">Step {step} of 2</span>
                </div>
              </div>
              <button className="sof-close" onClick={onClose} aria-label="Close">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* ── Body ─────────────────────────────────────── */}
            <div className="sof-body">
              {step === 1 ? (
                <div className="sof-step-content">
                  {/* Category grid */}
                  <div className="sof-field">
                    <label className="sof-label">Category</label>
                    <div className="sof-cat-grid">
                      {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const active = formData.category === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => update({ category: cat.id })}
                            className={`sof-cat ${active ? 'sof-cat--active' : ''}`}
                          >
                            <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="sof-field">
                    <label className="sof-label" htmlFor="sof-title">Service title</label>
                    <input
                      id="sof-title"
                      type="text"
                      placeholder="e.g. Python tutoring for beginners"
                      value={formData.title}
                      onChange={e => update({ title: e.target.value })}
                      className="sof-input"
                      maxLength={80}
                    />
                    <span className="sof-char">{formData.title.length}/80</span>
                  </div>

                  {/* Description */}
                  <div className="sof-field">
                    <label className="sof-label" htmlFor="sof-desc">Description</label>
                    <textarea
                      id="sof-desc"
                      placeholder="Describe what you offer, your experience, and what students can expect…"
                      rows={4}
                      value={formData.description}
                      onChange={e => {
                        const val = e.target.value;
                        const wc = (val.match(/\S+/g) || []).length;
                        if (wc <= DESC_MAX_WORDS + 20) update({ description: val });
                      }}
                      className={`sof-textarea ${descOver ? 'sof-textarea--over' : ''}`}
                    />
                    {/* Live word counter */}
                    <div className="sof-wc-bar">
                      <div className="sof-wc-track">
                        <div
                          className={`sof-wc-fill ${
                            descOver ? 'sof-wc-fill--over'
                            : descOk  ? 'sof-wc-fill--ok'
                            : 'sof-wc-fill--low'
                          }`}
                          style={{ width: `${Math.min((wordCount / DESC_MAX_WORDS) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="sof-wc-info">
                        <span className={`sof-wc-msg ${
                          descOver ? 'sof-wc-msg--over'
                          : descOk  ? 'sof-wc-msg--ok'
                          : 'sof-wc-msg--low'
                        }`}>
                          {descOver
                            ? `Too long — remove ${wordCount - DESC_MAX_WORDS} word${wordCount - DESC_MAX_WORDS !== 1 ? 's' : ''}`
                            : descOk
                            ? `✓ Minimum met — ${DESC_MAX_WORDS - wordCount} word${DESC_MAX_WORDS - wordCount !== 1 ? 's' : ''} left`
                            : `${DESC_MIN_WORDS - wordCount} more word${DESC_MIN_WORDS - wordCount !== 1 ? 's' : ''} needed`
                          }
                        </span>
                        <span className={`sof-wc-count ${
                          descOver ? 'sof-wc-count--over' : descOk ? 'sof-wc-count--ok' : ''
                        }`}>
                          {wordCount} / {DESC_MAX_WORDS}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sof-step-content">
                  {/* Skill type */}
                  <div className="sof-field">
                    <label className="sof-label">Type of service</label>
                    <div className="sof-types">
                      {SKILL_TYPES.map(t => {
                        const active = formData.skill_type === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => update({ skill_type: t.id })}
                            className={`sof-type ${active ? 'sof-type--active' : ''}`}
                          >
                            <div>
                              <p className="sof-type__name">{t.name}</p>
                              <p className="sof-type__desc">{t.desc}</p>
                            </div>
                            {active && <Check size={18} strokeWidth={2.5} className="sof-type__check" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="sof-field">
                    <label className="sof-label">Pricing</label>
                    <div className="sof-pricing">
                      <div className={`sof-price-wrap ${formData.is_free ? 'sof-price-wrap--disabled' : ''}`}>
                        <span className="sof-price-prefix">KSH</span>
                        <input
                          type="number"
                          placeholder="0"
                          min={0}
                          value={formData.price}
                          onChange={e => update({ price: e.target.value })}
                          disabled={formData.is_free}
                          className="sof-price-input"
                        />
                      </div>
                      <button
                        onClick={() => update({ is_free: !formData.is_free })}
                        className={`sof-free-btn ${formData.is_free ? 'sof-free-btn--active' : ''}`}
                      >
                        <Zap size={18} fill={formData.is_free ? 'currentColor' : 'none'} strokeWidth={2} />
                        Free
                      </button>
                    </div>
                    {!formData.is_free && (
                      <p className="sof-hint">Set to 0 if you want to negotiate price with each student.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ───────────────────────────────────── */}
            <div className="sof-footer">
              {step === 2 && (
                <button className="sof-back" onClick={() => setStep(1)}>
                  Back
                </button>
              )}
              <button
                className="sof-next"
                disabled={step === 1 ? !canNext : loading}
                onClick={() => (step === 1 ? setStep(2) : handleSubmit())}
              >
                {loading ? (
                  <span className="sof-spinner" />
                ) : step === 1 ? (
                  <>Continue <ArrowRight size={16} /></>
                ) : (
                  <>Publish listing <Check size={16} /></>
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>

      <style>{`

        /* Overlay */
        .sof-overlay {
          position: fixed; inset: 0;
          z-index: 10000;
          display: flex; align-items: flex-end; justify-content: center;
          font-family: 'Inter', system-ui, sans-serif;
        }
        @media (min-width: 640px) {
          .sof-overlay { align-items: center; padding: 24px; }
        }
        .sof-backdrop {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(12px);
        }

        /* Sheet */
        .sof-sheet {
          position: relative;
          width: 100%;
          max-width: 520px;
          background: #fdf8fa;
          border-radius: 28px 28px 0 0;
          overflow: hidden;
          display: flex; flex-direction: column;
          max-height: 92vh;
          box-shadow: 0 -20px 60px rgba(0,0,0,0.2);
        }
        .dark .sof-sheet { background: #27272a; border: 1px solid #3f3f46; border-bottom: none; }
        @media (min-width: 640px) {
          .sof-sheet { border-radius: 28px; box-shadow: 0 40px 120px rgba(0,0,0,0.25); }
          .dark .sof-sheet { border-bottom: 1px solid #3f3f46; }
        }

        /* Header */
        .sof-header {
          padding: 24px 24px 16px;
          display: flex; align-items: flex-start; justify-content: space-between;
          border-bottom: 1px solid #ede3e9;
        }
        .dark .sof-header { border-color: #18181b; }
        .sof-header__title { font-size: 20px; font-weight: 800; color: #18181b; margin-bottom: 8px; }
        .dark .sof-header__title { color: #f4f4f5; }
        .sof-steps { display: flex; align-items: center; gap: 6px; }
        .sof-step {
          height: 4px; width: 28px; border-radius: 99px;
          background: #ede3e9; transition: background 0.2s, width 0.2s;
        }
        .dark .sof-step { background: #3f3f46; }
        .sof-step--active { background: #ff1493; width: 40px; }
        .sof-step--done { background: #10b981; }
        .dark .sof-step--done { background: #10b981; }
        .sof-steps__label { font-size: 12px; font-weight: 500; color: #475569; margin-left: 4px; }
        .dark .sof-steps__label { color: #d4d4d8; }
        .sof-close {
          width: 36px; height: 36px;
          background: #f6eef3; border: 1px solid #ede3e9; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: #475569; cursor: pointer;
          transition: background 0.18s, color 0.18s;
        }
        .dark .sof-close { background: #27272a; border-color: #3f3f46; color: #d4d4d8; }
        .sof-close:hover { background: #e7dae3; color: #18181b; border-color: #e6d8e1; }
        .dark .sof-close:hover { background: #3f3f46; color: #f4f4f5; border-color: #52525b; }

        /* Body */
        .sof-body { flex: 1; overflow-y: auto; padding: 20px 24px; scrollbar-width: none; }
        .sof-body::-webkit-scrollbar { display: none; }
        .sof-step-content { display: flex; flex-direction: column; gap: 20px; }

        /* Field */
        .sof-field { display: flex; flex-direction: column; gap: 8px; }
        .sof-label { font-size: 12px; font-weight: 600; color: #334155; letter-spacing: 0.01em; }
        .dark .sof-label { color: #d4d4d8; }
        .sof-char { font-size: 11px; color: #475569; text-align: right; margin-top: -4px; }
        .dark .sof-char { color: #d4d4d8; }

        /* Category grid */
        .sof-cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        @media (min-width: 400px) { .sof-cat-grid { grid-template-columns: repeat(3, 1fr); } }
        .sof-cat {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px;
          background: #f6eef3; border: 1.5px solid #ede3e9;
          border-radius: 14px;
          font-size: 13px; font-weight: 600; color: #475569;
          cursor: pointer; transition: all 0.18s;
        }
        .dark .sof-cat { background: #18181b; border-color: #3f3f46; color: #d4d4d8; }
        .sof-cat:hover { background: #f0e5ec; color: #334155; border-color: #e6d8e1; }
        .dark .sof-cat:hover { background: #3f3f46; color: #f4f4f5; border-color: #52525b; }
        .sof-cat--active { background: #ff1493; color: #fff; border-color: #ff1493; box-shadow: 0 4px 12px rgba(255,20,147,0.25); }
        .dark .sof-cat--active { background: #ff1493; color: #ffffff; border-color: #ff1493; box-shadow: 0 4px 12px rgba(255,20,147,0.25); }

        /* Text inputs */
        .sof-input, .sof-textarea {
          width: 100%; padding: 12px 16px;
          background: #f6eef3; border: 1.5px solid #ede3e9;
          border-radius: 14px;
          font-family: inherit; font-size: 14px; font-weight: 500; color: #18181b;
          outline: none; transition: border-color 0.18s, box-shadow 0.18s;
          resize: none;
        }
        .dark .sof-input, .dark .sof-textarea { background: #18181b; border-color: #3f3f46; color: #f4f4f5; }
        .sof-input::placeholder, .sof-textarea::placeholder { color: #475569; }
        .dark .sof-input::placeholder, .dark .sof-textarea::placeholder { color: #d4d4d8; }
        .sof-input:focus, .sof-textarea:focus {
          border-color: rgba(255,20,147,0.35);
          box-shadow: 0 0 0 3px rgba(255,20,147,0.08);
          background: #fdf8fa;
        }
        .dark .sof-input:focus, .dark .sof-textarea:focus { background: #27272a; border-color: #ff1493; }
        .sof-textarea--over {
          border-color: rgba(239,68,68,0.4) !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.08) !important;
        }

        /* Word counter */
        .sof-wc-bar { display: flex; flex-direction: column; gap: 6px; }
        .sof-wc-track {
          height: 4px; border-radius: 99px;
          background: #ede3e9; overflow: hidden;
        }
        .dark .sof-wc-track { background: #3f3f46; }
        .sof-wc-fill {
          height: 100%; border-radius: 99px;
          transition: width 0.25s ease, background 0.25s ease;
        }
        .sof-wc-fill--low  { background: #ef4444; }
        .dark .sof-wc-fill--low { background: #ef4444; }
        .sof-wc-fill--ok   { background: #10b981; }
        .dark .sof-wc-fill--ok { background: #10b981; }
        .sof-wc-fill--over { background: #f97316; }
        .dark .sof-wc-fill--over { background: #f97316; }
        .sof-wc-info {
          display: flex; align-items: center; justify-content: space-between;
        }
        .sof-wc-msg {
          font-size: 12px; font-weight: 600;
          transition: color 0.2s;
        }
        .sof-wc-msg--low  { color: #dc2626; }
        .dark .sof-wc-msg--low { color: #f87171; }
        .sof-wc-msg--ok   { color: #059669; }
        .dark .sof-wc-msg--ok { color: #34d399; }
        .sof-wc-msg--over { color: #ea580c; }
        .dark .sof-wc-msg--over { color: #fb923c; }
        .sof-wc-count {
          font-size: 12px; font-weight: 600; color: #475569;
          transition: color 0.2s;
        }
        .dark .sof-wc-count { color: #d4d4d8; }
        .sof-wc-count--ok   { color: #059669; }
        .dark .sof-wc-count--ok { color: #34d399; }
        .sof-wc-count--over { color: #ea580c; }
        .dark .sof-wc-count--over { color: #fb923c; }

        .sof-types { display: flex; flex-direction: column; gap: 8px; }
        .sof-type {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          background: #f6eef3; border: 1.5px solid #ede3e9;
          border-radius: 16px;
          cursor: pointer; transition: all 0.18s; text-align: left;
        }
        .dark .sof-type { background: #18181b; border-color: #3f3f46; }
        .sof-type:hover { background: #f0e5ec; border-color: #e6d8e1; }
        .dark .sof-type:hover { background: #3f3f46; border-color: #52525b; }
        .sof-type--active { background: #ff1493; border-color: #ff1493; box-shadow: 0 4px 16px rgba(255,20,147,0.25); }
        .dark .sof-type--active { background: #ff1493; border-color: #ff1493; }
        .sof-type__name { font-size: 14px; font-weight: 700; color: #18181b; margin-bottom: 2px; }
        .dark .sof-type__name { color: #f4f4f5; }
        .sof-type--active .sof-type__name { color: #ffffff; }
        .dark .sof-type--active .sof-type__name { color: #ffffff; }
        .sof-type__desc { font-size: 12px; font-weight: 500; color: #475569; }
        .dark .sof-type__desc { color: #d4d4d8; }
        .sof-type--active .sof-type__desc { color: rgba(255,255,255,0.85); }
        .dark .sof-type--active .sof-type__desc { color: rgba(255,255,255,0.85); }
        .sof-type__check { color: #ff1493; flex-shrink: 0; }

        /* Pricing */
        .sof-pricing { display: flex; gap: 10px; align-items: stretch; }
        .sof-price-wrap {
          flex: 1; position: relative;
          display: flex; align-items: center;
          background: #f6eef3; border: 1.5px solid #ede3e9; border-radius: 14px;
          padding: 0 16px; transition: opacity 0.2s;
        }
        .dark .sof-price-wrap { background: #18181b; border-color: #3f3f46; }
        .sof-price-wrap:focus-within {
          border-color: rgba(255,20,147,0.35);
          box-shadow: 0 0 0 3px rgba(255,20,147,0.08);
          background: #fdf8fa;
        }
        .dark .sof-price-wrap:focus-within { background: #27272a; border-color: #ff1493; }
        .sof-price-wrap--disabled { opacity: 0.35; pointer-events: none; }
        .sof-price-prefix { font-size: 13px; font-weight: 700; color: #475569; margin-right: 8px; }
        .dark .sof-price-prefix { color: #d4d4d8; }
        .sof-price-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-family: inherit; font-size: 20px; font-weight: 700; color: #18181b;
          padding: 14px 0;
        }
        .dark .sof-price-input { color: #f4f4f5; }
        .sof-free-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 4px; padding: 0 20px;
          background: #f6eef3; border: 1.5px solid #ede3e9; border-radius: 14px;
          font-size: 12px; font-weight: 700; color: #475569;
          cursor: pointer; transition: all 0.18s; min-height: 56px;
        }
        .dark .sof-free-btn { background: #18181b; border-color: #3f3f46; color: #d4d4d8; }
        .sof-free-btn:hover { background: #f0e5ec; color: #334155; border-color: #e6d8e1; }
        .dark .sof-free-btn:hover { background: #3f3f46; color: #f4f4f5; border-color: #52525b; }
        .sof-free-btn--active { background: #ecfdf5; border-color: #10b981; color: #059669; }
        .dark .sof-free-btn--active { background: rgba(16,185,129,0.15); border-color: #10b981; color: #34d399; }
        .sof-hint { font-size: 11px; font-weight: 500; color: #475569; margin-top: -4px; }
        .dark .sof-hint { color: #d4d4d8; }

        /* Footer */
        .sof-footer {
          display: flex; gap: 10px;
          padding: 16px 24px 28px;
          border-top: 1px solid #ede3e9;
        }
        .dark .sof-footer { border-color: #18181b; }
        @media (min-width: 640px) { .sof-footer { padding-bottom: 20px; } }
        .sof-back {
          padding: 0 20px; height: 52px;
          background: #f6eef3; border: 1px solid #ede3e9; border-radius: 14px;
          font-family: inherit; font-size: 14px; font-weight: 600; color: #334155;
          cursor: pointer; transition: background 0.18s;
        }
        .dark .sof-back { background: #18181b; border-color: #3f3f46; color: #d4d4d8; }
        .sof-back:hover { background: #e7dae3; color: #18181b; border-color: #e6d8e1; }
        .dark .sof-back:hover { background: #3f3f46; color: #f4f4f5; border-color: #52525b; }
        .sof-next {
          flex: 1; height: 52px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #ff1493; border: none; border-radius: 14px;
          font-family: inherit; font-size: 14px; font-weight: 700; color: #ffffff;
          cursor: pointer; transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
        }
        .dark .sof-next { background: #ff1493; color: #ffffff; }
        .sof-next:hover:not(:disabled) { background: #e0117f; box-shadow: 0 8px 24px rgba(255,20,147,0.3); }
        .dark .sof-next:hover:not(:disabled) { background: #ff2d87; box-shadow: 0 8px 24px rgba(255,20,147,0.3); }
        .sof-next:active:not(:disabled) { transform: scale(0.98); }
        .sof-next:disabled { opacity: 0.35; cursor: not-allowed; }
        .sof-spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: sof-spin 0.65s linear infinite;
        }

        /* Success */
        .sof-success {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; text-align: center;
          padding: 60px 32px;
        }
        .sof-success__circle {
          width: 80px; height: 80px;
          background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #059669; margin-bottom: 20px;
          box-shadow: 0 8px 32px rgba(16,185,129,0.2);
        }
        .dark .sof-success__circle { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #34d399; box-shadow: none; }
        .sof-success__title { font-size: 22px; font-weight: 800; color: #18181b; margin-bottom: 8px; }
        .dark .sof-success__title { color: #f4f4f5; }
        .sof-success__sub { font-size: 14px; font-weight: 500; color: #475569; }
        .dark .sof-success__sub { color: #d4d4d8; }
      `}</style>
    </div>
  );
}
