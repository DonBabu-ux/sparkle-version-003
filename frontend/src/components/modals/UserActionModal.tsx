import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, ChevronRight } from 'lucide-react';
import type { User } from '../../types/user';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import api from '../../api/api';

const MessengerIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-black">
    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.464 5.482 3.753 7.158V22l3.418-1.875c.905.251 1.861.391 2.829.391 5.523 0 10-4.145 10-9.258S17.523 2 12 2zm1.096 12.63l-2.585-2.756-5.045 2.756 5.545-5.886 2.585 2.756 5.045-2.756-5.545 5.886z"/>
  </svg>
);

const PointingFingerIcon = () => (
  <span className="text-[28px] grayscale contrast-125 brightness-0">👉</span>
);

interface Props {
    user: User;
    onClose: () => void;
}

export default function UserActionModal({ user, onClose }: Props) {
    const navigate = useNavigate();
    const [poking, setPoking] = useState(false);

    const handlePoke = async () => {
        if (poking) return;
        setPoking(true);
        try {
            await api.post(`/users/${user.user_id || user.id}/poke`);
            alert(`You poked ${user.name || user.username}! 👋`);
            onClose();
        } catch (err) {
            console.error('Poke failed:', err);
            alert('Failed to send poke. Try again later.');
        } finally {
            setPoking(false);
        }
    };

    if (!user) return null;

    return (
        <AnimatePresence>
            <>
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[5000] flex items-end sm:items-center justify-center p-0 sm:p-4"
                />
                <motion.div 
                    initial={{ y: "100%", scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: "100%", scale: 0.95 }}
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                    className="fixed bottom-0 sm:bottom-auto sm:relative bg-white w-full sm:max-w-[400px] rounded-t-[40px] sm:rounded-[40px] shadow-2xl z-[5001] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="h-1.5 w-16 bg-slate-200 rounded-full mx-auto mt-4 mb-2 sm:hidden" />
                    <div className="p-10">
                        <div className="flex flex-col items-center mb-10 text-center">
                            <div className="relative mb-6">
                                <img src={user.avatar_url || user.avatar || user.profile_picture || '/uploads/avatars/default.png'} className="w-24 h-24 rounded-[32px] object-cover ring-8 ring-black/5" alt="" />
                                <div className="absolute -bottom-2 -right-2 bg-black p-2 rounded-2xl text-white shadow-xl">
                                    <UserIcon size={20} strokeWidth={2.5} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-black leading-tight tracking-tight uppercase italic">{user.name || user.username}</h3>
                            <p className="text-black/30 font-black text-[13px] tracking-[0.1em] uppercase mt-2">@{user.username}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button onClick={() => { navigate(`/messages?u=${user.username}`); onClose(); }} className="w-full flex items-center justify-between p-6 bg-pink-500 hover:bg-pink-600 rounded-[28px] group transition-all shadow-xl shadow-pink-500/10">
                                <div className="flex items-center gap-5">
                                    <div className="p-3.5 bg-white rounded-2xl shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all">
                                        <MessengerIcon />
                                    </div>
                                    <span className="text-[18px] font-black text-white tracking-tight uppercase italic">Message</span>
                                </div>
                                <ChevronRight size={22} className="text-white/50 group-hover:text-white transition-colors" />
                            </button>
                            <button onClick={handlePoke} disabled={poking} className="w-full flex items-center justify-between p-6 bg-black/[0.03] hover:bg-black/[0.05] rounded-[28px] group transition-all disabled:opacity-50">
                                <div className="flex items-center gap-5">
                                    <div className="p-3.5 bg-white border border-black/5 rounded-2xl shadow-sm group-hover:scale-110 group-hover:-rotate-6 transition-all flex items-center justify-center">
                                        <PointingFingerIcon />
                                    </div>
                                    <span className="text-[18px] font-black text-black/60 tracking-tight uppercase italic">{poking ? 'Sent!' : 'Send Poke'}</span>
                                </div>
                                <ChevronRight size={22} className="text-black/10 group-hover:text-black transition-colors" />
                            </button>
                            <button onClick={onClose} className="w-full flex items-center justify-center p-6 text-black/30 font-black text-[11px] uppercase tracking-widest hover:text-black transition-all">
                                Close Menu
                            </button>
                        </div>
                    </div>
                </motion.div>
            </>
        </AnimatePresence>
    );
}
