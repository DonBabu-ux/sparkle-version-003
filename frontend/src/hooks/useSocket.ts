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
            transports: ['websocket']
        });

        s.on('connect', () => {
            console.log('📡 Connected to Sparkle Matrix');
        });

        s.on('disconnect', () => {
            console.log('📡 Disconnected from Sparkle Matrix');
        });

        setSocket(s);

        return () => {
            s.disconnect();
        };
    }, [user]);

    return socket;
};
