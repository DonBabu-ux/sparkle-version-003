import { motion, AnimatePresence } from 'framer-motion';
import { User, ChevronRight, X } from 'lucide-react';
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
    user: any;
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
                                <img src={user.avatar_url || user.avatar || user.profile_picture || '/uploads/avatars/default.png'} className="w-24 h-24 rounded-[32px] object-cover ring-8 ring-slate-50" alt="" />
                                <div className="absolute -bottom-2 -right-2 bg-black p-2 rounded-2xl text-white shadow-xl">
                                    <User size={20} strokeWidth={2.5} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{user.name || user.username}</h3>
                            <p className="text-slate-400 font-bold text-[13px] tracking-[0.1em] uppercase mt-2">@{user.username}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button onClick={() => { navigate(`/messages?u=${user.username}`); onClose(); }} className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 rounded-[24px] group transition-all">
                                <div className="flex items-center gap-5">
                                    <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-xl shadow-slate-100 group-hover:scale-110 group-hover:rotate-6 transition-all">
                                        <MessengerIcon />
                                    </div>
                                    <span className="text-[18px] font-black text-slate-800 tracking-tight">Message</span>
                                </div>
                                <ChevronRight size={22} className="text-slate-300 group-hover:text-black transition-colors" />
                            </button>
                            <button onClick={handlePoke} disabled={poking} className="w-full flex items-center justify-between p-6 bg-slate-50/50 hover:bg-slate-100/50 rounded-[24px] group transition-all disabled:opacity-50">
                                <div className="flex items-center gap-5">
                                    <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-xl shadow-slate-50 group-hover:scale-110 group-hover:-rotate-6 transition-all flex items-center justify-center">
                                        <PointingFingerIcon />
                                    </div>
                                    <span className="text-[18px] font-black text-slate-800 tracking-tight">{poking ? 'Sending Poke...' : 'Send Poke'}</span>
                                </div>
                                <ChevronRight size={22} className="text-slate-200 group-hover:text-black transition-colors" />
                            </button>
                            <button onClick={onClose} className="w-full flex items-center justify-between p-6 bg-slate-50/30 hover:bg-slate-100/50 rounded-[24px] group transition-all">
                                <div className="flex items-center gap-5">
                                    <div className="p-3.5 bg-white border-2 border-slate-200 rounded-2xl group-hover:scale-110 transition-all">
                                        <X size={20} strokeWidth={3} className="text-slate-400" />
                                    </div>
                                    <span className="text-[18px] font-black text-slate-400 tracking-tight">Dismiss</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </>
        </AnimatePresence>
    );
}
