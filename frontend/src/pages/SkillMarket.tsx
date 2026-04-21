import { useState, useEffect } from 'react';
import { Hammer, Zap, Star, ShieldCheck, ChevronRight } from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';

interface SkillOffer {
  title: string;
  description: string;
  provider_name?: string;
  provider_avatar?: string;
  price_display?: string;
}

export default function SkillMarket() {
  const [skills, setSkills] = useState<SkillOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await api.get('/marketplace/skills');
        const data = response.data.skillOffers || response.data.data || (Array.isArray(response.data) ? response.data : []);
        setSkills(data);
      } catch (err) {
        console.error('Failed to fetch skills:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSkills();
  }, []);

  return (
    <div className="skill-market-page">
      <Navbar />
      
      <main className="skill-layout">
        <header className="skill-hero animate-fade-in">
           <div className="hero-badge">
              <Zap size={14} fill="currentColor" />
              <span>SKILL RESONANCE</span>
           </div>
           <h1>Campus Skill Exchange</h1>
           <p>Monetize your expertise or find specialized talent right within your student community.</p>
        </header>

        {loading ? (
          <div className="loader-box">
             <div className="spinner"></div>
             <p>Scanning for talent...</p>
          </div>
        ) : (
          <div className="skill-grid">
             {/* Offer Service Card */}
             <div className="skill-card create-card glass-card animate-scale-in">
                <div className="icon-wrap">
                   <Hammer size={32} />
                </div>
                <h3>Offer Your Service</h3>
                <p>Coding, Design, Tutoring or anything in between. Turn your skills into cash.</p>
                <button className="primary-btn-premium mt-auto">List a Service</button>
             </div>

             {skills.map((skill, idx) => (
                <div key={idx} className="skill-card glass-card animate-scale-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                   <div className="card-header">
                      <div className="provider-info">
                         <img src={skill.provider_avatar || '/uploads/avatars/default.png'} alt="" />
                         <div className="provider-meta">
                            <span className="provider-name">{skill.provider_name || 'Expert'}</span>
                            <div className="rating">
                               <Star size={10} fill="currentColor" />
                               <span>4.9 (12 reviews)</span>
                            </div>
                         </div>
                      </div>
                      <ShieldCheck size={18} className="verified-icon" />
                   </div>

                   <div className="card-body">
                      <h3>{skill.title}</h3>
                      <p>{skill.description}</p>
                   </div>

                   <div className="card-footer">
                      <div className="price-info">
                         <span className="label">Starting at</span>
                         <span className="price">KSh {skill.price_display || '800'}</span>
                      </div>
                      <button className="engage-btn">
                         Engage <ChevronRight size={14} />
                      </button>
                   </div>
                </div>
             ))}
          </div>
        )}
      </main>

      <style>{`
        .skill-market-page { min-height: 100vh; background: #f8fafc; display: flex; flex-direction: row; }
        .skill-layout { flex: 1; padding: 40px; overflow-y: auto; }

        .skill-hero { max-width: 800px; margin-bottom: 60px; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,107,139,0.1); color: var(--primary); padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; letter-spacing: 1px; margin-bottom: 20px; }
        .skill-hero h1 { font-size: 3.5rem; font-weight: 900; color: #0f172a; letter-spacing: -2px; line-height: 1; margin: 0 0 10px; }
        .skill-hero p { color: #64748b; font-size: 1.2rem; line-height: 1.6; }

        .skill-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; }
        
        .skill-card { display: flex; flex-direction: column; padding: 24px; min-height: 380px; border-radius: 24px; }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .provider-info { display: flex; align-items: center; gap: 12px; }
        .provider-info img { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; }
        .provider-meta { display: flex; flex-direction: column; }
        .provider-name { font-weight: 800; font-size: 0.9rem; color: #1e293b; }
        .rating { display: flex; align-items: center; gap: 4px; color: #f59e0b; font-size: 0.7rem; font-weight: 800; }
        .verified-icon { color: var(--primary); opacity: 0.8; }

        .card-body { flex: 1; }
        .card-body h3 { font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0 0 12px; line-height: 1.3; }
        .card-body p { color: #64748b; font-size: 0.95rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

        .card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.05); }
        .price-info { display: flex; flex-direction: column; }
        .price-info .label { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .price-info .price { font-size: 1.25rem; font-weight: 900; color: #059669; }

        .engage-btn { display: flex; align-items: center; gap: 6px; background: #0f172a; color: white; padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 0.85rem; transition: 0.2s; }
        .engage-btn:hover { background: var(--primary); transform: scale(1.05); }

        .create-card { background: var(--primary-gradient); color: white; border: none; align-items: center; text-align: center; justify-content: center; }
        .create-card .icon-wrap { width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; }
        .create-card h3 { color: white; margin-bottom: 12px; font-size: 1.4rem; }
        .create-card p { color: rgba(255,255,255,0.8); font-size: 0.9rem; margin-bottom: 30px; }
        .primary-btn-premium { width: 100%; background: white; color: var(--primary); padding: 14px; border-radius: 14px; font-weight: 900; font-size: 0.85rem; border: none; cursor: pointer; transition: 0.2s; }
        .primary-btn-premium:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }

        .loader-box { height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; gap: 16px; }

        @media (max-width: 1024px) {
          .skill-market-page { flex-direction: column; }
          .skill-layout { padding: 80px 20px 100px; }
          .skill-hero h1 { font-size: 2.5rem; }
        }
      `}</style>
    </div>
  );
}
