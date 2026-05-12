import React, { useState, useEffect } from 'react';
import {
  X, Star, ShieldCheck, MessageCircle, Calendar,
  Clock, ArrowRight, Check, MapPin, Tag
} from 'lucide-react';
import api from '../../api/api';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface SkillOfferDetail {
  offer_id: string;
  title: string;
  description: string;
  category: string;
  skill_type?: string;
  price: number;
  is_free: boolean;
  username: string;
  name: string;
  avatar_url: string;
  average_rating: number | null;
  review_count: number;
  user_id?: string;
  partner_id?: string;
}

interface Review {
  username?: string;
  rating?: number;
  comment?: string;
  created_at?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  tutoring: 'Tutoring', coding: 'Coding', design: 'Design',
  writing: 'Writing', music: 'Music', tech: 'Tech Support', other: 'Other',
};

export default function SkillDetailModal({ offerId, onClose }: { offerId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [offer, setOffer] = useState<SkillOfferDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'book' | 'reviews'>('book');
  const [isBooking, setIsBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingData, setBookingData] = useState({
    booking_date: new Date().toISOString().split('T')[0],
    duration_minutes: 60,
    notes: '',
  });

  useEffect(() => {
    Promise.all([
      api.get(`/skill-market/offers/${offerId}`)
        .then(r => setOffer(r.data.offer || r.data.data || r.data))
        .catch(console.error),
      api.get(`/skill-market/offers/${offerId}/reviews`)
        .then(r => setReviews(r.data.reviews || r.data || []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [offerId]);

  const handleBook = async () => {
    setIsBooking(true);
    try {
      await api.post(`/skill-market/offers/${offerId}/book`, bookingData);
      setBooked(true);
    } catch (err) {
      console.error('Booking failed:', err);
      alert('Booking failed — please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const handleChat = async () => {
    if (!offer) return;
    try {
      const partnerId = offer.user_id || offer.partner_id;
      const res = await api.post('/messages/start', { partnerId, listingId: offerId });
      if (res.data?.data?.conversationId) {
        navigate(`/messages?chat=${res.data.data.conversationId}`);
      } else {
        navigate('/messages');
      }
      onClose();
    } catch {
      navigate('/messages');
      onClose();
    }
  };

  /* ── Render states ─────────────────────────────── */
  if (loading) return null;
  if (!offer) return null;

  const ratingNum = typeof offer.average_rating === 'number' ? offer.average_rating.toFixed(1) : '5.0';

  return (
    <div className="sdm-overlay">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="sdm-backdrop"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
        className="sdm-sheet"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Close button ───────────────────────── */}
        <button className="sdm-close" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2.5} />
        </button>

        {/* ── Scrollable body ────────────────────── */}
        <div className="sdm-body">

          {/* Hero info */}
          <div className="sdm-hero">
            <div className="sdm-hero__avatar-wrap">
              <img
                src={offer.avatar_url || '/uploads/avatars/default.png'}
                className="sdm-hero__avatar"
                alt={offer.name}
              />
            </div>
            <div className="sdm-hero__meta">
              <div className="sdm-hero__badges">
                <span className="sdm-badge sdm-badge--cat">
                  {CATEGORY_LABELS[offer.category] || offer.category}
                </span>
                <span className="sdm-badge sdm-badge--verified">
                  <ShieldCheck size={10} strokeWidth={2.5} />
                  Verified
                </span>
              </div>
              <h1 className="sdm-hero__title">{offer.title}</h1>
              <div className="sdm-hero__author">
                <span className="sdm-hero__name">{offer.name}</span>
                <span className="sdm-hero__sep">·</span>
                <div className="sdm-hero__rating">
                  <Star size={12} fill="currentColor" className="sdm-star" />
                  <span>{ratingNum}</span>
                  <span className="sdm-hero__count">({offer.review_count})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="sdm-desc">{offer.description}</p>

          {/* Price pill */}
          <div className="sdm-price-row">
            <div className="sdm-price">
              <span className="sdm-price__label">Price</span>
              <span className="sdm-price__val">
                {offer.is_free ? 'Free' : `KSH ${offer.price}`}
              </span>
            </div>
            <button className="sdm-chat-btn" onClick={handleChat}>
              <MessageCircle size={16} strokeWidth={2} />
              Message
            </button>
          </div>

          {/* Tabs */}
          <div className="sdm-tabs">
            {(['book', 'reviews'] as const).map(t => (
              <button
                key={t}
                className={`sdm-tab ${tab === t ? 'sdm-tab--active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'book' ? 'Book a session' : `Reviews (${reviews.length})`}
              </button>
            ))}
          </div>

          {/* ── Tab: Book ─────────────────────────── */}
          {tab === 'book' && (
            booked ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="sdm-booked"
              >
                <div className="sdm-booked__icon">
                  <Check size={32} strokeWidth={2.5} />
                </div>
                <h3 className="sdm-booked__title">Request sent!</h3>
                <p className="sdm-booked__sub">
                  {offer.name} has been notified. Check your inbox for their response.
                </p>
                <button className="sdm-booked__cta" onClick={onClose}>Close</button>
              </motion.div>
            ) : (
              <div className="sdm-book">
                <div className="sdm-book__row">
                  <div className="sdm-field">
                    <label className="sdm-label">
                      <Calendar size={13} strokeWidth={2} />
                      Preferred date
                    </label>
                    <input
                      type="date"
                      value={bookingData.booking_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setBookingData(p => ({ ...p, booking_date: e.target.value }))}
                      className="sdm-input"
                    />
                  </div>
                  <div className="sdm-field">
                    <label className="sdm-label">
                      <Clock size={13} strokeWidth={2} />
                      Duration (min)
                    </label>
                    <select
                      value={bookingData.duration_minutes}
                      onChange={e => setBookingData(p => ({ ...p, duration_minutes: +e.target.value }))}
                      className="sdm-input sdm-select"
                    >
                      {[30, 45, 60, 90, 120].map(d => (
                        <option key={d} value={d}>{d} min</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sdm-field">
                  <label className="sdm-label">Notes (optional)</label>
                  <textarea
                    placeholder="Tell them what you need help with, your current level, goals…"
                    rows={3}
                    value={bookingData.notes}
                    onChange={e => setBookingData(p => ({ ...p, notes: e.target.value }))}
                    className="sdm-textarea"
                  />
                </div>
                <button
                  className="sdm-book-btn"
                  onClick={handleBook}
                  disabled={isBooking}
                >
                  {isBooking ? (
                    <span className="sdm-spinner" />
                  ) : (
                    <>
                      Book — {offer.is_free ? 'Free' : `KSH ${offer.price}`}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            )
          )}

          {/* ── Tab: Reviews ──────────────────────── */}
          {tab === 'reviews' && (
            <div className="sdm-reviews">
              {reviews.length === 0 ? (
                <div className="sdm-reviews__empty">
                  <Star size={28} className="sdm-reviews__empty-icon" strokeWidth={1.5} />
                  <p>No reviews yet — be the first!</p>
                </div>
              ) : (
                reviews.map((rev, i) => (
                  <div key={i} className="sdm-review">
                    <div className="sdm-review__header">
                      <div className="sdm-review__avatar">
                        {(rev.username?.[0] || 'S').toUpperCase()}
                      </div>
                      <div>
                        <p className="sdm-review__name">{rev.username || 'Anonymous'}</p>
                        <div className="sdm-review__stars">
                          {[...Array(5)].map((_, j) => (
                            <Star
                              key={j}
                              size={11}
                              fill={j < (rev.rating ?? 5) ? 'currentColor' : 'none'}
                              strokeWidth={2}
                            />
                          ))}
                        </div>
                      </div>
                      {rev.created_at && (
                        <span className="sdm-review__date">
                          {new Date(rev.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="sdm-review__comment">
                      {rev.comment || 'Great session — very helpful and professional.'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .sdm-overlay {
          position: fixed; inset: 0; z-index: 10000;
          display: flex; align-items: flex-end; justify-content: center;
          font-family: 'Inter', system-ui, sans-serif;
        }
        @media (min-width: 640px) {
          .sdm-overlay { align-items: center; padding: 24px; }
        }
        .sdm-backdrop {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        /* Sheet */
        .sdm-sheet {
          position: relative;
          width: 100%; max-width: 580px;
          background: #fff;
          border-radius: 28px 28px 0 0;
          max-height: 92vh;
          display: flex; flex-direction: column;
          box-shadow: 0 -20px 60px rgba(0,0,0,0.2);
          overflow: hidden;
        }
        .dark .sdm-sheet { background: #000; border: 1px solid rgba(255,255,255,0.1); border-bottom: none; }
        @media (min-width: 640px) {
          .sdm-sheet {
            border-radius: 28px;
            box-shadow: 0 40px 120px rgba(0,0,0,0.28);
            max-height: 88vh;
          }
          .dark .sdm-sheet { border-bottom: 1px solid rgba(255,255,255,0.1); }
        }

        /* Close */
        .sdm-close {
          position: absolute; top: 16px; right: 16px;
          z-index: 10;
          width: 36px; height: 36px;
          background: #f3f4f6; border: none; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #6b7280; cursor: pointer;
          transition: background 0.18s, color 0.18s;
        }
        .dark .sdm-close { background: rgba(255,255,255,0.1); color: #fff; }
        .sdm-close:hover { background: #e5e7eb; color: #111827; }
        .dark .sdm-close:hover { background: rgba(255,255,255,0.15); }

        /* Body scroll */
        .sdm-body {
          flex: 1; overflow-y: auto;
          padding: 28px 24px 32px;
          scrollbar-width: none;
        }
        .sdm-body::-webkit-scrollbar { display: none; }

        /* Hero */
        .sdm-hero { display: flex; gap: 16px; margin-bottom: 18px; }
        .sdm-hero__avatar-wrap { flex-shrink: 0; }
        .sdm-hero__avatar {
          width: 68px; height: 68px;
          border-radius: 20px; object-fit: cover;
          border: 3px solid #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        .dark .sdm-hero__avatar { border-color: rgba(255,255,255,0.1); }
        .sdm-hero__meta { flex: 1; min-width: 0; padding-top: 2px; }
        .sdm-hero__badges { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
        .sdm-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 99px;
          font-size: 11px; font-weight: 600;
        }
        .sdm-badge--cat { background: rgba(225,29,72,0.08); color: #e11d48; }
        .sdm-badge--verified { background: #ecfdf5; color: #10b981; }
        .dark .sdm-badge--verified { background: rgba(16,185,129,0.1); }
        .sdm-hero__title {
          font-size: 20px; font-weight: 800; color: #111827;
          line-height: 1.25; margin-bottom: 8px;
        }
        .dark .sdm-hero__title { color: #fff; }
        @media (min-width: 480px) { .sdm-hero__title { font-size: 24px; } }
        .sdm-hero__author { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .sdm-hero__name { font-size: 13px; font-weight: 600; color: #374151; }
        .dark .sdm-hero__name { color: #9ca3af; }
        .sdm-hero__sep { color: #d1d5db; }
        .sdm-hero__rating { display: flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 600; color: #374151; }
        .dark .sdm-hero__rating { color: #9ca3af; }
        .sdm-star { color: #f59e0b; }
        .sdm-hero__count { font-size: 12px; font-weight: 500; color: #9ca3af; }

        /* Description */
        .sdm-desc {
          font-size: 14px; font-weight: 500; color: #6b7280;
          line-height: 1.7; margin-bottom: 20px;
          padding-left: 14px; border-left: 3px solid #f3f4f6;
        }
        .dark .sdm-desc { color: #9ca3af; border-color: rgba(255,255,255,0.05); }

        /* Price row */
        .sdm-price-row {
          display: flex; align-items: center; justify-content: space-between;
          background: #f9fafb; border-radius: 18px; padding: 14px 18px;
          margin-bottom: 20px;
        }
        .dark .sdm-price-row { background: rgba(255,255,255,0.05); }
        .sdm-price { display: flex; flex-direction: column; gap: 2px; }
        .sdm-price__label { font-size: 11px; font-weight: 500; color: #9ca3af; }
        .sdm-price__val { font-size: 22px; font-weight: 800; color: #10b981; }
        .sdm-chat-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 10px 18px; border-radius: 14px;
          background: #111827; color: #fff; border: none;
          font-family: inherit; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.18s, box-shadow 0.18s;
        }
        .dark .sdm-chat-btn { background: #fff; color: #000; }
        .sdm-chat-btn:hover { background: #e11d48; box-shadow: 0 6px 18px rgba(225,29,72,0.25); }
        .dark .sdm-chat-btn:hover { color: #fff; }

        /* Tabs */
        .sdm-tabs {
          display: flex; gap: 4px;
          background: #f3f4f6; border-radius: 14px; padding: 4px;
          margin-bottom: 20px;
        }
        .dark .sdm-tabs { background: rgba(255,255,255,0.05); }
        .sdm-tab {
          flex: 1; padding: 9px 0;
          border: none; border-radius: 11px; background: transparent;
          font-family: inherit; font-size: 13px; font-weight: 600; color: #9ca3af;
          cursor: pointer; transition: all 0.18s;
        }
        .sdm-tab--active { background: #fff; color: #111827; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .dark .sdm-tab--active { background: #222; color: #fff; }

        /* Booking */
        .sdm-book { display: flex; flex-direction: column; gap: 14px; }
        .sdm-book__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .sdm-field { display: flex; flex-direction: column; gap: 6px; }
        .sdm-label {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; color: #374151;
        }
        .dark .sdm-label { color: #9ca3af; }
        .sdm-input, .sdm-textarea {
          width: 100%; padding: 11px 14px;
          background: #f9fafb; border: 1.5px solid #f3f4f6;
          border-radius: 13px;
          font-family: inherit; font-size: 14px; font-weight: 500; color: #111827;
          outline: none; transition: border-color 0.18s, box-shadow 0.18s;
          resize: none;
        }
        .dark .sdm-input, .dark .sdm-textarea {
          background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.05); color: #fff;
        }
        .sdm-input:focus, .sdm-textarea:focus {
          border-color: rgba(225,29,72,0.3);
          box-shadow: 0 0 0 3px rgba(225,29,72,0.07);
          background: #fff;
        }
        .dark .sdm-input:focus, .dark .sdm-textarea:focus { background: #000; border-color: #e11d48; }
        .sdm-select { cursor: pointer; }
        .sdm-textarea::placeholder { color: #9ca3af; }
        .sdm-book-btn {
          width: 100%; height: 52px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #111827; color: #fff; border: none; border-radius: 15px;
          font-family: inherit; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: background 0.18s, box-shadow 0.2s, transform 0.12s;
          margin-top: 4px;
        }
        .dark .sdm-book-btn { background: #fff; color: #000; }
        .sdm-book-btn:hover:not(:disabled) { background: #e11d48; box-shadow: 0 8px 24px rgba(225,29,72,0.3); }
        .dark .sdm-book-btn:hover:not(:disabled) { color: #fff; }
        .sdm-book-btn:active:not(:disabled) { transform: scale(0.98); }
        .sdm-book-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sdm-spinner {
          width: 20px; height: 20px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: sdm-spin 0.65s linear infinite;
        }
        @keyframes sdm-spin { to { transform: rotate(360deg); } }

        /* Booked success */
        .sdm-booked {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 32px 16px;
        }
        .sdm-booked__icon {
          width: 72px; height: 72px;
          background: #ecfdf5; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #10b981; margin-bottom: 16px;
          box-shadow: 0 6px 24px rgba(16,185,129,0.2);
        }
        .dark .sdm-booked__icon { background: rgba(16,185,129,0.1); }
        .sdm-booked__title { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 8px; }
        .dark .sdm-booked__title { color: #fff; }
        .sdm-booked__sub { font-size: 14px; font-weight: 500; color: #6b7280; max-width: 280px; margin-bottom: 24px; line-height: 1.6; }
        .dark .sdm-booked__sub { color: #9ca3af; }
        .sdm-booked__cta {
          padding: 11px 28px; background: #111827; color: #fff; border: none;
          border-radius: 13px; font-family: inherit; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: background 0.18s;
        }
        .dark .sdm-booked__cta { background: #fff; color: #000; }
        .sdm-booked__cta:hover { background: #e11d48; }
        .dark .sdm-booked__cta:hover { color: #fff; }

        /* Reviews */
        .sdm-reviews { display: flex; flex-direction: column; gap: 14px; }
        .sdm-reviews__empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 40px 20px; text-align: center;
          background: #f9fafb; border-radius: 18px;
          font-size: 14px; font-weight: 500; color: #9ca3af;
        }
        .dark .sdm-reviews__empty { background: rgba(255,255,255,0.05); }
        .sdm-reviews__empty-icon { color: #d1d5db; }
        .sdm-review {
          background: #f9fafb; border-radius: 18px; padding: 16px;
        }
        .dark .sdm-review { background: rgba(255,255,255,0.05); }
        .sdm-review__header {
          display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
        }
        .sdm-review__avatar {
          width: 36px; height: 36px; border-radius: 12px;
          background: rgba(225,29,72,0.1); color: #e11d48;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; flex-shrink: 0;
        }
        .sdm-review__name { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 3px; }
        .dark .sdm-review__name { color: #fff; }
        .sdm-review__stars { display: flex; gap: 2px; color: #f59e0b; }
        .sdm-review__date { font-size: 11px; font-weight: 500; color: #9ca3af; margin-left: auto; }
        .sdm-review__comment {
          font-size: 13px; font-weight: 500; color: #6b7280;
          line-height: 1.65;
          padding-left: 10px; border-left: 2px solid #e5e7eb;
        }
        .dark .sdm-review__comment { color: #9ca3af; border-color: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
}
