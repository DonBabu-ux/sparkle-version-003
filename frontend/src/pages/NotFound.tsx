import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8e7ed',
      padding: '40px 20px',
      textAlign: 'center',
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* Animated 404 */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <div style={{
          fontSize: '9rem',
          fontWeight: 900,
          color: '#ff1493',
          letterSpacing: '-8px',
          lineHeight: 1,
          userSelect: 'none',
        }}>404</div>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 180,
          height: 180,
          background: 'radial-gradient(circle, rgba(255,107,139,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
      </div>

      <div style={{
        fontSize: '3rem',
        marginBottom: 16,
      }}>✦</div>

      <h1 style={{
        fontSize: '1.8rem',
        fontWeight: 900,
        color: '#0f172a',
        margin: '0 0 12px',
        letterSpacing: '-0.5px',
      }}>
        This spark has gone out
      </h1>
      <p style={{
        fontSize: '1rem',
        color: '#64748b',
        maxWidth: 380,
        margin: '0 0 40px',
        lineHeight: 1.65,
        fontWeight: 500,
      }}>
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/dashboard" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#ff1493',
          color: 'white',
          textDecoration: 'none',
          padding: '14px 28px',
          borderRadius: 16,
          fontWeight: 800,
          fontSize: '0.95rem',
          boxShadow: '0 8px 24px rgba(255,20,147,0.25)',
          transition: 'all 0.2s',
        }}>
          <Home size={18} /> Go Home
        </Link>
        <Link to="/search" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'white',
          color: '#334155',
          textDecoration: 'none',
          padding: '14px 28px',
          borderRadius: 16,
          fontWeight: 700,
          fontSize: '0.95rem',
          border: '1px solid #e6d8e1',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}>
          <Search size={18} /> Search
        </Link>
        <button onClick={() => window.history.back()} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          color: '#64748b',
          border: 'none',
          padding: '14px 20px',
          borderRadius: 16,
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
        }}>
          <ArrowLeft size={18} /> Go Back
        </button>
      </div>
    </div>
  );
}



