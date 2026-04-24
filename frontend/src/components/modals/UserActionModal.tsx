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
                    onClick={onClose}
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[5000] flex items-end sm:items-center justify-center p-0 sm:p-4"
                />
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-0 sm:bottom-auto sm:relative bg-white w-full sm:max-w-[360px] rounded-t-2xl sm:rounded-2xl shadow-2xl z-[5001] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="h-1.5 w-12 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
                    <div className="p-4 sm:p-6">
                        <div className="flex flex-col items-center mb-6 text-center">
                            <div className="relative mb-3">
                                <img src={user.avatar_url || user.avatar || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-full object-cover border border-gray-100 shadow-sm" alt="" />
                                <div className="absolute -bottom-1 -right-1 bg-blue-500 p-1 rounded-full text-white border-2 border-white shadow-md">
                                    <UserIcon size={12} />
                                </div>
                            </div>
                            <h3 className="text-[17px] font-bold text-gray-900 leading-tight">{user.name || user.username}</h3>
                            <p className="text-gray-500 font-medium text-[13px] mt-0.5">@{user.username}</p>
                        </div>

                        <div className="space-y-2">
                            <button 
                                onClick={() => { navigate(`/messages?u=${user.username}`); onClose(); }} 
                                className="w-full flex items-center justify-between p-3 bg-blue-500 hover:bg-blue-600 rounded-lg group transition-colors shadow-sm"
                            >
                                <div className="flex items-center gap-3 text-white">
                                    <MessengerIcon size={18} />
                                    <span className="text-[15px] font-bold">Message</span>
                                </div>
                                <ChevronRight size={18} className="text-white/50" />
                            </button>

                            <button 
                                onClick={handlePoke} 
                                disabled={poking} 
                                className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 rounded-lg group transition-colors disabled:opacity-50"
                            >
                                <div className="flex items-center gap-3 text-gray-700">
                                   <span className="text-xl" style={{ filter: 'grayscale(1) brightness(0)' }}>👉</span>
                                   <span className="text-[15px] font-bold">{poking ? 'Sent!' : 'Poke'}</span>
                                </div>
                                <ChevronRight size={18} className="text-gray-400" />
                            </button>

                            <button 
                                onClick={onClose} 
                                className="w-full py-3 text-gray-500 font-bold text-[14px] hover:text-gray-900 transition-colors mt-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </motion.div>
            </>
        </AnimatePresence>
    );
}
