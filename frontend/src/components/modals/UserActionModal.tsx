import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, ChevronRight } from 'lucide-react';
import type { User } from '../../types/user';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import api from '../../api/api';

const MessengerIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.464 5.482 3.753 7.158V22l3.418-1.875c.905.251 1.861.391 2.829.391 5.523 0 10-4.145 10-9.258S17.523 2 12 2zm1.096 12.63l-2.585-2.756-5.045 2.756 5.545-5.886 2.585 2.756 5.045-2.756-5.545 5.886z"/>
    </svg>
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
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[5000]"
                />
                <div className="fixed inset-0 z-[5001] flex items-center justify-center p-4 pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="bg-white/95 dark:bg-[#121212]/95 backdrop-blur-2xl w-full max-w-[150px] rounded-[20px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/10 overflow-hidden pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center pt-4 pb-2 px-3">
                            <div className="relative mb-2">
                                <img src={user.avatar_url || user.avatar || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-[#121212] shadow-sm" alt="" />
                                <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 p-0.5 rounded-full text-white border-2 border-white dark:border-[#121212] shadow-sm">
                                    <UserIcon size={8} strokeWidth={3} />
                                </div>
                            </div>
                            <h3 className="text-[12px] font-black text-gray-900 dark:text-white leading-tight tracking-tight truncate w-full">{user.name || user.username}</h3>
                            <p className="text-gray-400 font-bold text-[8px] uppercase tracking-widest mt-0.5 truncate w-full">@{user.username}</p>
                        </div>

                        <div className="px-3 pb-3 space-y-1.5">
                            <button 
                                onClick={() => { navigate(`/messages?u=${user.username}`); onClose(); }} 
                                className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl transition-all font-bold text-[11px]"
                            >
                                <MessengerIcon size={12} />
                                Message
                            </button>

                            <button 
                                onClick={handlePoke} 
                                disabled={poking} 
                                className="w-full flex items-center justify-center gap-1.5 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-800 dark:text-white rounded-xl transition-all font-bold text-[11px] disabled:opacity-50"
                            >
                               <span className="text-[12px]" style={{ filter: 'grayscale(1)' }}>👉</span>
                               {poking ? 'Sent!' : 'Poke'}
                            </button>

                            <button 
                                onClick={onClose} 
                                className="w-full py-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-black text-[9px] uppercase tracking-widest transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </div>
            </>
        </AnimatePresence>
    );
}
