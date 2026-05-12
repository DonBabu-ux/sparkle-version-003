import { useState, useEffect } from 'react';
import {
  Hammer, Zap, Star, ShieldCheck, ChevronRight,
  Search, Plus, Briefcase, GraduationCap,
  Code, Palette, PenTool, Music, Cpu, LayoutDashboard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalStore } from '../store/modalStore';
import clsx from 'clsx';

interface SkillOffer {
  offer_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  is_free: boolean;
  username: string;
  name: string;
  avatar_url: string;
  average_rating: number | null;
  review_count: number;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all', name: 'All Skills', icon: Briefcase },
  { id: 'tutoring', name: 'Tutoring', icon: GraduationCap },
  { id: 'coding', name: 'Coding', icon: Code },
  { id: 'design', name: 'Design', icon: Palette },
  { id: 'writing', name: 'Writing', icon: PenTool },
  { id: 'music', name: 'Music', icon: Music },
  { id: 'tech', name: 'Tech Support', icon: Cpu },
];

export default function SkillMarket() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { setActiveModal, refreshCounter } = useModalStore();

  useEffect(() => {
    fetchSkills();
  }, [activeCategory, refreshCounter]);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      const response = await api.get('/skill-market/offers', { params });
      const data = response.data.offers || response.data;
      setSkills(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = skills.filter(skill =>
    skill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="skm-page">
      <Navbar />

      {/* Soft background blobs */}
      <div className="skm-blob skm-blob--tr" />
      <div className="skm-blob skm-blob--bl" />

      <main className="skm-main">
        <div className="skm-container">

          {/* ── Header ─────────────────────────────────── */}
          <header className="skm-header">
            <div className="skm-header__inner">
              {/* Left: copy */}
              <div className="skm-hero">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="skm-badge"
                >
                  <Zap size={12} fill="currentColor" />
                  Skills Marketplace
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="skm-heading"
                >
                  Student{' '}
                  <span className="skm-heading__accent">Power Hub</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="skm-tagline"
                >
                  Monetize your expertise or find specialized talent right within
                  your student community. Turn knowledge into value.
                </motion.p>
              </div>

              {/* Right: search + CTA */}
              <div className="skm-actions">
                <div className="skm-search-wrap">
                  <div className="skm-search">
                    <Search className="skm-search__icon" size={17} strokeWidth={2.5} />
                    <input
                      type="text"
                      placeholder="Search skills…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="skm-search__input"
                    />
                  </div>
                </div>
                <button
                  onClick={() => navigate('/skill-market/hub')}
                  className="skm-btn--hub"
                >
                  <LayoutDashboard size={17} strokeWidth={2.5} />
                  Skill Hub
                </button>
                <button
                  onClick={() => setActiveModal('skill_offer')}
                  className="skm-cta"
                >
                  <Plus size={17} strokeWidth={2.5} />
                  List a service
                </button>
              </div>
            </div>
          </header>

          {/* ── Category bar ───────────────────────────── */}
          <div className="skm-cats-wrap">
            <div className="skm-cats">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={clsx('skm-cat', active && 'skm-cat--active')}
                  >
                    <Icon size={14} strokeWidth={active ? 2.5 : 2} className={active ? 'skm-cat__icon--active' : ''} />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Grid ───────────────────────────────────── */}
          <div className="skm-grid-wrap">
            {loading ? (
              <div className="skm-loading">
                <div className="skm-spinner">
                  <div className="skm-spinner__track" />
                  <div className="skm-spinner__bar" />
                </div>
                <p className="skm-loading__text">Loading skills…</p>
              </div>
            ) : filteredSkills.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="skm-empty">
                <div className="skm-empty__icon">
                  <Hammer size={32} />
                </div>
                <h3 className="skm-empty__title">No skills found</h3>
                <p className="skm-empty__sub">Be the first to offer this service in your community.</p>
              </motion.div>
            ) : (
              <div className="skm-grid">
                <AnimatePresence>
                  {filteredSkills.map((skill, idx) => (
                    <motion.div
                      key={skill.offer_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => setActiveModal('skill_detail', null, { offerId: skill.offer_id })}
                      className="skm-card"
                    >
                      {/* Watermark */}
                      <div className="skm-card__watermark" aria-hidden>
                        <Hammer size={140} strokeWidth={0.75} />
                      </div>

                      {/* Author */}
                      <div className="skm-card__author">
                        <div className="skm-card__avatar-wrap">
                          <img
                            src={skill.avatar_url || '/uploads/avatars/default.png'}
                            className="skm-card__avatar"
                            alt=""
                          />
                        </div>
                        <div>
                          <h4 className="skm-card__name">{skill.name}</h4>
                          <div className="skm-card__rating">
                            <Star size={10} fill="currentColor" className="skm-card__star" />
                            <span className="skm-card__rating-val">{skill.average_rating || '5.0'}</span>
                            <span className="skm-card__review-count">({skill.review_count} reviews)</span>
                          </div>
                        </div>
                        <div className="skm-card__verified">
                          <ShieldCheck size={18} strokeWidth={2} />
                        </div>
                      </div>

                      {/* Body */}
                      <div className="skm-card__body">
                        <span className="skm-card__category">
                          {CATEGORIES.find(c => c.id === skill.category)?.name || skill.category}
                        </span>
                        <h3 className="skm-card__title">{skill.title}</h3>
                        <p className="skm-card__desc">{skill.description}</p>
                      </div>

                      {/* Footer */}
                      <div className="skm-card__footer">
                        <div>
                          <span className="skm-card__price-label">Starts at</span>
                          <span className="skm-card__price">
                            {skill.is_free ? 'Free' : `KSH ${skill.price}`}
                          </span>
                        </div>
                        <button className="skm-card__btn" aria-label="View skill">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

        </div>
      </main>

      <style>{`
        /* ─── Font ─────────────────────────────────────────── */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        /* ─── Page shell ───────────────────────────────────── */
        .skm-page {
          display: flex;
          min-height: 100vh;
          background: #f7f8ff;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          overflow-x: hidden;
          position: relative;
        }
        .dark .skm-page {
          background: #000000;
        }
        .skm-blob {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }
        .skm-blob--tr {
          width: 45%; height: 45%;
          top: -10%; right: -8%;
          background: radial-gradient(circle, rgba(225,29,72,0.06), transparent 70%);
          filter: blur(80px);
        }
        .skm-blob--bl {
          width: 38%; height: 38%;
          bottom: -8%; left: -6%;
          background: radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%);
          filter: blur(80px);
        }

        /* ─── Main content ─────────────────────────────────── */
        .skm-main {
          flex: 1;
          z-index: 1;
          min-width: 0;
          padding-bottom: 32px;
        }
        @media (min-width: 1024px) {
          .skm-main { padding-left: 96px; }
        }
        @media (max-width: 1023px) {
          .skm-main { padding-bottom: 88px; }
        }
        .skm-container {
          max-width: 1360px;
          margin: 0 auto;
          padding: 80px 16px 0;
        }
        @media (min-width: 640px) {
          .skm-container { padding: 40px 32px 0; }
        }
        @media (min-width: 1024px) {
          .skm-container { padding: 32px 48px 0; }
        }

        /* ─── Header ───────────────────────────────────────── */
        .skm-header { margin-bottom: 28px; }
        .skm-header__inner {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (min-width: 1024px) {
          .skm-header__inner {
            flex-direction: row;
            align-items: flex-end;
            justify-content: space-between;
            gap: 40px;
          }
        }

        /* Badge */
        .skm-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: rgba(225,29,72,0.08);
          color: #e11d48;
          border: 1px solid rgba(225,29,72,0.12);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          margin-bottom: 14px;
        }

        /* Heading */
        .skm-heading {
          font-size: clamp(2rem, 7vw, 4.5rem);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: #111827;
          margin-bottom: 14px;
        }
        .dark .skm-heading {
          color: #fff;
        }
        .skm-heading__accent {
          background: linear-gradient(135deg, #e11d48 0%, #6366f1 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Tagline */
        .skm-tagline {
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          line-height: 1.65;
          max-width: 420px;
        }
        .dark .skm-tagline {
          color: #9ca3af;
        }
        @media (min-width: 640px) {
          .skm-tagline { font-size: 15px; }
        }

        /* ─── Actions (search + CTA) ───────────────────────── */
        .skm-actions { display: flex; gap: 12px; align-items: stretch; flex-wrap: wrap; }
        @media (min-width: 1024px) {
          .skm-actions { max-width: 400px; }
        }

        .skm-search-wrap { flex: 1; min-width: 200px; }
        .skm-search {
          position: relative; display: flex; align-items: center;
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 14px;
          padding: 0 16px; height: 48px; transition: all 0.2s;
        }
        .dark .skm-search {
          background: #121212; border-color: rgba(255,255,255,0.1);
        }
        .skm-search:focus-within { border-color: #111827; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .dark .skm-search:focus-within { border-color: #e11d48; }
        .skm-search__icon { color: #9ca3af; margin-right: 10px; flex-shrink: 0; }
        .skm-search__input {
          flex: 1; border: none; background: transparent; outline: none;
          font-family: inherit; font-size: 14px; font-weight: 500; color: #111827;
          width: 100%;
        }
        .dark .skm-search__input {
          color: #fff;
        }
        .skm-search__input::placeholder { color: #9ca3af; }

        .skm-btn--hub {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: #f3f4f6; color: #111827;
          border: none; border-radius: 14px; padding: 0 20px; height: 48px;
          font-family: inherit; font-size: 14px; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease;
        }
        .dark .skm-btn--hub {
          background: rgba(255,255,255,0.1); color: #fff;
        }
        .skm-btn--hub:hover { background: #e5e7eb; transform: translateY(-1px); }
        .dark .skm-btn--hub:hover { background: rgba(255,255,255,0.15); }

        .skm-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          height: 48px; padding: 0 24px;
          background: linear-gradient(135deg, #e11d48, #be123c);
          color: #fff; border: none; border-radius: 14px;
          font-family: inherit; font-size: 14px; font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
          transition: all 0.2s ease;
        }
        .skm-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(225, 29, 72, 0.5); }
        .skm-cta:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(225, 29, 72, 0.4); }

        /* ─── Category bar ─────────────────────────────────── */
        .skm-cats-wrap {
          position: sticky;
          top: 8px;
          z-index: 30;
          margin: 0 -16px 24px;
          padding: 0 16px;
        }
        @media (min-width: 640px) {
          .skm-cats-wrap { margin: 0 0 28px; padding: 0; }
        }
        .skm-cats {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          padding: 6px;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.7);
          border-radius: 24px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          scrollbar-width: none;
        }
        .dark .skm-cats {
          background: rgba(0,0,0,0.8);
          border-color: rgba(255,255,255,0.1);
        }
        .skm-cats::-webkit-scrollbar { display: none; }
        .skm-cat {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border: none;
          border-radius: 18px;
          background: transparent;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: #9ca3af;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.18s, color 0.18s;
          flex-shrink: 0;
        }
        .skm-cat:hover { background: #f3f4f6; color: #374151; }
        .dark .skm-cat:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .skm-cat--active { background: #111827; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
        .dark .skm-cat--active { background: #fff; color: #000; }
        .skm-cat__icon--active { color: #e11d48; }

        /* ─── Loading ──────────────────────────────────────── */
        .skm-loading {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 120px 0; gap: 16px;
        }
        .skm-spinner { position: relative; width: 48px; height: 48px; }
        .skm-spinner__track {
          position: absolute; inset: 0;
          border: 3px solid rgba(225,29,72,0.1);
          border-radius: 50%;
        }
        .skm-spinner__bar {
          position: absolute; inset: 0;
          border: 3px solid transparent;
          border-top-color: #e11d48;
          border-radius: 50%;
          animation: skm-spin 0.75s linear infinite;
        }
        @keyframes skm-spin { to { transform: rotate(360deg); } }
        .skm-loading__text {
          font-size: 12px;
          font-weight: 500;
          color: #9ca3af;
          letter-spacing: 0.08em;
        }

        /* ─── Empty ────────────────────────────────────────── */
        .skm-empty {
          display: flex; flex-direction: column;
          align-items: center; text-align: center;
          padding: 100px 20px;
        }
        .skm-empty__icon {
          width: 72px; height: 72px;
          background: #f3f4f6;
          border-radius: 24px;
          display: flex; align-items: center; justify-content: center;
          color: #d1d5db;
          margin-bottom: 20px;
        }
        .skm-empty__title { font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 8px; }
        .dark .skm-empty__title { color: #fff; }
        .skm-empty__sub { font-size: 14px; font-weight: 500; color: #9ca3af; max-width: 280px; }

        /* ─── Grid ─────────────────────────────────────────── */
        .skm-grid-wrap { min-height: 360px; }
        .skm-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 580px) {
          .skm-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
        }
        @media (min-width: 1200px) {
          .skm-grid { grid-template-columns: repeat(3, 1fr); }
        }

        /* ─── Card ─────────────────────────────────────────── */
        .skm-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: #fff;
          border: 1px solid #f0f0f4;
          border-radius: 24px;
          padding: 22px;
          cursor: pointer;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.25s, transform 0.15s;
        }
        .dark .skm-card {
          background: #000; border-color: rgba(255,255,255,0.05);
        }
        .skm-card:hover {
          border-color: rgba(225,29,72,0.18);
          box-shadow: 0 16px 48px rgba(0,0,0,0.07);
          transform: translateY(-2px);
        }
        .skm-card:active { transform: translateY(0) scale(0.99); }

        .skm-card__watermark {
          position: absolute;
          top: 0; right: 0;
          padding: 16px;
          opacity: 0.05;
          pointer-events: none;
          transition: opacity 0.4s, transform 0.5s;
          color: #111827;
        }
        .dark .skm-card__watermark { color: #fff; }
        .skm-card:hover .skm-card__watermark { opacity: 0.1; transform: scale(1.08); }

        /* Author row */
        .skm-card__author {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          position: relative;
          z-index: 1;
        }
        .skm-card__avatar-wrap { flex-shrink: 0; }
        .skm-card__avatar {
          width: 44px; height: 44px;
          border-radius: 14px;
          object-fit: cover;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .dark .skm-card__avatar { border-color: rgba(255,255,255,0.1); }
        .skm-card__name {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 3px;
          transition: color 0.18s;
        }
        .dark .skm-card__name { color: #fff; }
        .skm-card:hover .skm-card__name { color: #e11d48; }
        .skm-card__rating { display: flex; align-items: center; gap: 4px; }
        .skm-card__star { color: #f59e0b; }
        .skm-card__rating-val { font-size: 11px; font-weight: 600; color: #374151; }
        .dark .skm-card__rating-val { color: #9ca3af; }
        .skm-card__review-count { font-size: 11px; font-weight: 500; color: #9ca3af; }
        .skm-card__verified {
          margin-left: auto;
          width: 36px; height: 36px;
          background: #f9fafb;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: #d1d5db;
          transition: background 0.18s, color 0.18s;
        }
        .dark .skm-card__verified { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.2); }
        .skm-card:hover .skm-card__verified { background: rgba(225,29,72,0.08); color: #e11d48; }

        /* Body */
        .skm-card__body { flex: 1; margin-bottom: 18px; position: relative; z-index: 1; }
        .skm-card__category {
          display: inline-block;
          padding: 3px 10px;
          background: #f3f4f6;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 10px;
        }
        .dark .skm-card__category { background: rgba(255,255,255,0.05); color: #9ca3af; }
        .skm-card__title {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          line-height: 1.35;
          margin-bottom: 8px;
          transition: color 0.18s;
        }
        .dark .skm-card__title { color: #fff; }
        .skm-card:hover .skm-card__title { color: #e11d48; }
        .skm-card__desc {
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .dark .skm-card__desc { color: #9ca3af; }

        /* Footer */
        .skm-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;
          position: relative;
          z-index: 1;
        }
        .dark .skm-card__footer { border-color: rgba(255,255,255,0.05); }
        .skm-card__price-label { display: block; font-size: 11px; font-weight: 500; color: #9ca3af; margin-bottom: 2px; }
        .skm-card__price { font-size: 19px; font-weight: 700; color: #10b981; }
        .skm-card__btn {
          width: 42px; height: 42px;
          background: #111827;
          color: #fff;
          border: none;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
        }
        .dark .skm-card__btn { background: #fff; color: #000; }
        .skm-card__btn:hover { background: #e11d48; box-shadow: 0 6px 18px rgba(225,29,72,0.28); }
        .dark .skm-card__btn:hover { background: #e11d48; color: #fff; }
        .skm-card__btn:active { transform: scale(0.9); }
      `}</style>
    </div>
  );
}
