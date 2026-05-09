import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '../store/userStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user } = useUserStore();

    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem('sparkleToken');
        const s = io(SOCKET_URL, {
            query: { userId: user.id || user.user_id },
            auth: { token },
            withCredentials: true,
            transports: ['websocket'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        s.on('connect', () => {
            console.log('📡 Connected to Sparkle Matrix');
        });

        s.on('connect_error', (err) => {
            console.warn('📡 Sparkle Matrix connection error:', err.message);
        });

        setSocket(s);

        return () => {
            if (s) {
                s.off('connect');
                s.off('connect_error');
                s.off('disconnect');
                s.disconnect();
            }
        };
    }, [user?.id, user?.user_id]); // Depend on specific IDs instead of the whole user object

    return socket;
};
