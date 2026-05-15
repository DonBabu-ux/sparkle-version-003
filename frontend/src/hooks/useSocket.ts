import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '../store/userStore';

const SOCKET_URL = 'https://sparkle-version-003-1-f4v3.onrender.com';

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user, token } = useUserStore();

    useEffect(() => {
        if (!user || !token) return;

        const s = io(SOCKET_URL, {
            query: { userId: user.id || user.user_id },
            auth: { token },
            withCredentials: true,
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
    }, [user?.id, user?.user_id, token]); // Re-init socket if token refreshes

    return socket;
};
