import { useNavigate, useLocation } from 'react-router-dom';

export default function FloatingAction() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname !== '/dashboard') return null;

  return (
    <div className="fixed bottom-8 right-8 z-(--z-fab) hidden md:flex">
      <button 
        type="button"
        aria-label="Open messages"
        title="Messages"
        onClick={() => navigate('/messages')}
        className="w-16 h-16 rounded-full flex items-center justify-center bg-[#FF3D6D] text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
        style={{ boxShadow: '0 10px 40px rgba(255, 61, 109, 0.4)' }}
      >
        <i className="fas fa-paper-plane text-2xl" aria-hidden="true"></i>
      </button>
    </div>
  );
}
