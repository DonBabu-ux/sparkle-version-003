import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from '../store/userStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const { user } = useUserStore();

    useEffect(() => {
        if (!user) return;

        socketRef.current = io(SOCKET_URL, {
            query: { userId: user.id || user.user_id },
            withCredentials: true
        });

        socketRef.current.on('connect', () => {
            console.log('📡 Connected to Sparkle Matrix');
        });

        socketRef.current.on('disconnect', () => {
            console.log('📡 Disconnected from Sparkle Matrix');
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [user]);

    return socketRef.current;
};
