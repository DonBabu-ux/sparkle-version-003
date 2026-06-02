import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function FloatingAIButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/ai')}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-[#ff1493] to-[#fb7185] text-white shadow-lg hover:scale-110 active:scale-95 transition-transform"
    >
      <Sparkles size={24} strokeWidth={2.5} />
    </button>
  );
}
