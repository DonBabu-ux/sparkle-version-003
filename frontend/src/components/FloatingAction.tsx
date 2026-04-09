import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';

export default function FloatingAction() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setActiveModal } = useModalStore();

  const isMessagesPage = location.pathname === '/messages';
  const isChatOpen = isMessagesPage && (searchParams.get('chat') || searchParams.get('user'));

  // Hide the FAB completely if we are actively chatting to keep the window clear
  if (isChatOpen) return null;

  const actions = [
    { icon: <i className="fas fa-sign-language text-lg"></i>, label: 'Confession', color: 'bg-rose-500', onClick: () => setActiveModal('confession') },
    { icon: <i className="fas fa-store text-lg"></i>, label: 'Sell Item', color: 'bg-emerald-500', onClick: () => setActiveModal('listing') },
    { icon: <i className="fas fa-pen-nib text-lg"></i>, label: 'New Post', color: 'bg-indigo-500', onClick: () => setActiveModal('post') },
    { icon: <i className="fas fa-play-circle text-lg"></i>, label: 'Moment', color: 'bg-orange-500', onClick: () => navigate('/moments/create') },
    { icon: <i className="fas fa-shield-halved text-lg"></i>, label: 'Urgent', color: 'bg-amber-500', onClick: () => navigate('/support') },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-[9999] hidden md:flex flex-col items-end gap-3 translate-x-0 translate-y-0">
      {/* Action Menu (Only show if NOT in messages page or if trigger is clicked) */}
      <div className={`flex flex-col items-end gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        {actions.map((action, i) => (
          <div 
            key={i}
            className="flex items-center gap-3 group cursor-pointer"
            onClick={() => {
              action.onClick();
              setIsOpen(false);
            }}
          >
            <span className="bg-slate-900/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
              {action.label}
            </span>
            <div className={`w-12 h-12 ${action.color} text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-90`}>
              {action.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Main Trigger */}
      <button 
        onClick={() => {
            if (!isMessagesPage) {
                navigate('/messages');
            } else {
                setIsOpen(!isOpen);
            }
        }}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-500 ${
            isOpen ? 'bg-slate-800' : 'bg-[#FF3D6D] hover:scale-110'
        }`}
        style={{ 
            boxShadow: isOpen 
                ? '0 10px 40px rgba(0,0,0,0.2)' 
                : '0 10px 40px rgba(255, 61, 109, 0.4)' 
        }}
      >
        {isOpen ? (
            <i className="fas fa-times text-2xl"></i>
        ) : (
            isMessagesPage ? <i className="fas fa-plus text-2xl"></i> : <i className="fas fa-paper-plane text-2xl"></i>
        )}
      </button>

      {/* Backdrop for closing */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
