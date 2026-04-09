import { Sparkles, Users, Shield, Zap, Globe, Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const TEAM = [
  { name: 'Don Babu', role: 'Founder & CEO', emoji: '🚀' },
  { name: 'Naty Leila', role: 'Head of Design', emoji: '🎨' },
  { name: 'Alex Mwangi', role: 'Lead Engineer', emoji: '⚡' },
];

const STATS = [
  { value: '10+', label: 'Partner Universities' },
  { value: '50k+', label: 'Active Students' },
  { value: '1M+', label: 'Moments Shared' },
  { value: '99.9%', label: 'Uptime' },
];

const VALUES = [
  { icon: <Users size={22} />, title: 'Community First', desc: 'Every feature we build starts with a question: does this bring students closer together?' },
  { icon: <Shield size={22} />, title: 'Privacy by Design', desc: 'Your data belongs to you. We never sell it, never share it without consent, period.' },
  { icon: <Zap size={22} />, title: 'Speed & Reliability', desc: 'A social platform that lags is no platform at all. We obsess over performance.' },
  { icon: <Globe size={22} />, title: 'Built for Africa', desc: 'From Nairobi to Lagos — Sparkle is designed for the realities of campus life in Africa.' },
];

export default function About() {
  return (
    <div style={{ minHeight: '100vh', background: 'white', fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        .about-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; text-decoration: none; padding: 14px 28px; border-radius: 16px; font-weight: 800; font-size: 0.95rem; box-shadow: 0 8px 24px rgba(255,61,109,0.25); transition: 0.2s; }
        .about-btn:hover { opacity: 0.9; transform: translateY(-2px); }
        .about-section { max-width: 900px; margin: 0 auto; padding: 80px 24px; }
        @media (max-width: 600px) { .about-section { padding: 50px 20px; } }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)', zIndex: 100, padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} color="white" />
          </div>
          <span style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#0f172a' }}>Sparkle</span>
        </Link>
        <Link to="/signup" className="about-btn" style={{ padding: '10px 22px', fontSize: '0.88rem' }}>Join Sparkle</Link>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #fff 0%, #f5f3ff 100%)', padding: '100px 24px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 16px', borderRadius: 20, color: '#16a34a', fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
            ✦ Built for students, by students
          </div>
          <h1 style={{ fontSize: 'clamp(3rem, 7vw, 5rem)', fontWeight: 900, color: '#0f172a', margin: '0 0 20px', letterSpacing: '-2px', lineHeight: 1.05 }}>
            Connecting campus,<br />
            <span style={{ backgroundImage: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              one spark at a time.
            </span>
          </h1>
          <p style={{ fontSize: '1.15rem', color: '#64748b', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7, fontWeight: 500 }}>
            Sparkle is the premier social ecosystem built exclusively for African university students. We're reimagining how campus communities connect, learn, and thrive together.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" className="about-btn">Get Started <ChevronRight size={18} /></Link>
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 16, fontWeight: 700, fontSize: '0.95rem', border: '1px solid #e2e8f0', textDecoration: 'none', color: '#334155', transition: '0.2s' }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: '#0f172a', padding: '60px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, textAlign: 'center' }}>
          {STATS.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '3rem', fontWeight: 900, background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>{s.value}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="about-section">
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', margin: '0 0 12px', letterSpacing: '-1px' }}>What we stand for</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Our core values guide every decision we make.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {VALUES.map((v, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: 24, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', transition: '0.3s' }}>
              <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, rgba(255,107,139,0.12), rgba(255,61,109,0.08))', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3D6D', marginBottom: 20 }}>
                {v.icon}
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>{v.title}</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.65, margin: 0 }}>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section style={{ background: '#f8fafc', padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', margin: '0 0 12px', letterSpacing: '-1px' }}>The team</h2>
          <p style={{ color: '#64748b', margin: '0 0 48px' }}>Passionate people building the future of campus life.</p>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {TEAM.map(t => (
              <div key={t.name} style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: 24, padding: '32px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', minWidth: 180, textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>{t.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginBottom: 6 }}>{t.name}</div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="about-section" style={{ textAlign: 'center' }}>
        <Star size={44} style={{ color: '#FF3D6D', marginBottom: 20 }} />
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', margin: '0 0 14px', letterSpacing: '-1px' }}>Ready to Sparkle?</h2>
        <p style={{ color: '#64748b', fontSize: '1.05rem', margin: '0 0 36px' }}>Join thousands of students already making memories on the platform.</p>
        <Link to="/signup" className="about-btn" style={{ fontSize: '1rem', padding: '16px 36px' }}>
          Create Free Account <ChevronRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0f172a', padding: '40px 32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        <p style={{ margin: 0 }}>© 2026 Sparkle Platform · <Link to="/support" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Support</Link> · <Link to="/login" style={{ color: '#FF6B8B', textDecoration: 'none' }}>Login</Link></p>
      </footer>
    </div>
  );
}
