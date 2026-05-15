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
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            transports: ['polling', 'websocket']
        });

        s.on('connect', () => {
            console.log('📡 Connected to Sparkle Matrix (Persistent)');
            // Re-join active chat rooms or sync presence on reconnect
            s.emit('sparkle-ping'); 
        });

        s.on('sparkle-pong', () => {
            // Heartbeat received
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
