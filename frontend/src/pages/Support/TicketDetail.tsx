import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, Send, ShieldCheck, MessageCircle } from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';
import { showError, showSuccess } from '../../utils/toast';

interface SupportMessage {
    id?: string | number;
    message_id?: string;
    sender_id: string | null;
    sender_name?: string;
    sender_type?: 'user' | 'staff' | 'bot';
    is_admin?: number | boolean;
    content: string;
    created_at: string;
}

interface SupportTicket {
    ticket_id: string;
    subject: string;
    category: string;
    status: string;
    description: string;
    created_at: string;
}

export default function TicketDetail() {
    const { ticketId } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTicket();
    }, [ticketId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchTicket = async () => {
        try {
            const res = await api.get(`/support/tickets/${ticketId}`);
            if (res.data.success) {
                setTicket(res.data.ticket);
                setMessages(res.data.messages || []);
            }
        } catch (err) {
            logger.error('Failed to fetch ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || sending) return;

        setSending(true);
        try {
            const res = await api.post(`/support/tickets/${ticketId}/messages`, {
                message: replyText.trim()
            });
            if (res.data.success) {
                setReplyText('');
                fetchTicket();
                showSuccess('Reply posted.');
            } else {
                showError(res.data.error || 'Failed to send reply.');
            }
        } catch (err: any) {
            showError(err?.response?.data?.error || 'Could not post reply.');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 text-xs font-bold text-[#ff1493] animate-pulse">
                Loading ticket details...
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 p-6 text-center">
                <p className="font-bold text-base text-[#18181b] dark:text-zinc-100 mb-2">Ticket not found</p>
                <button onClick={() => navigate('/support')} className="px-4 py-2 rounded-xl bg-[#ff1493] text-white text-xs font-bold">
                    Return to Support
                </button>
            </div>
        );
    }

    const isClosed = ticket.status === 'closed';

    return (
        <div className="page-wrapper font-sans">
            <div className="ticket-content">
                <main className="ticket-container">
                    <header className="ticket-header">
                        <button onClick={() => navigate('/support')} className="back-btn" aria-label="Back">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="header-info min-w-0">
                            <h1 className="truncate">{ticket.subject}</h1>
                            <div className="header-meta">
                                <span className="category-tag">{ticket.category}</span>
                                <span className="date-tag">{ticket.ticket_id} • {new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className={`status-badge ${ticket.status}`}>
                            {ticket.status === 'resolved' ? <CheckCircle size={14} /> : <Clock size={14} />}
                            {ticket.status.replace('_', ' ')}
                        </div>
                    </header>

                    <div className="chat-window" ref={scrollRef}>
                        <div className="messages-list">
                            {messages.map((msg, idx) => {
                                const isAdmin = Boolean(msg.is_admin || msg.sender_type === 'staff');
                                return (
                                    <div key={msg.id || msg.message_id || idx} className={`message-row ${isAdmin ? 'staff' : 'user'}`}>
                                        <div className="message-avatar">
                                            {isAdmin ? <ShieldCheck size={20} /> : <MessageCircle size={20} />}
                                        </div>
                                        <div className="message-bubble">
                                            <div className="sender-name">
                                                {isAdmin ? 'Sparkle Support Team' : (msg.sender_name || 'You')}
                                            </div>
                                            <div className="message-text">{msg.content}</div>
                                            <div className="message-time">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <footer className="ticket-footer">
                        {isClosed ? (
                            <div className="closed-info">
                                This ticket has been resolved and closed. If you require further assistance, please submit a new ticket.
                            </div>
                        ) : (
                            <form onSubmit={handleSendReply} className="reply-form">
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    placeholder="Type a response or add more information..."
                                    disabled={sending}
                                />
                                <button type="submit" disabled={!replyText.trim() || sending}>
                                    <Send size={18} />
                                </button>
                            </form>
                        )}
                    </footer>
                </main>
            </div>

            <style>{`
                .page-wrapper { display: flex; background: #f8e7ed; min-height: 100dvh; }
                .ticket-content { flex: 1; display: flex; flex-direction: column; height: 100dvh; padding-top: max(1rem, var(--safe-area-inset-top, 0px)); }
                .ticket-container { max-width: 800px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; background: white; height: 100%; box-shadow: 0 0 40px rgba(0,0,0,0.05); }

                .ticket-header { padding: 18px 24px; border-bottom: 1px solid #f8e7ed; display: flex; align-items: center; gap: 16px; }
                .back-btn { padding: 10px; border-radius: 12px; background: #f6eef3; border: none; cursor: pointer; transition: 0.2s; color: #18181b; }
                .back-btn:hover { background: #e6d8e1; }
                .header-info { flex: 1; }
                .header-info h1 { margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; }
                .header-meta { display: flex; gap: 8px; margin-top: 4px; align-items: center; }
                .category-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #ff1493; background: rgba(255, 20, 147, 0.1); padding: 2px 8px; border-radius: 6px; }
                .date-tag { font-size: 11px; color: #64748b; }

                .status-badge { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .status-badge.open { background: #dcfce7; color: #166534; }
                .status-badge.in_progress { background: #fef9c3; color: #854d0e; }
                .status-badge.resolved { background: #dcfce7; color: #166534; }
                .status-badge.closed { background: #ede3e9; color: #475569; }

                .chat-window { flex: 1; overflow-y: auto; padding: 20px; background: #fdf8fa; }
                .messages-list { display: flex; flex-direction: column; gap: 16px; }
                .message-row { display: flex; gap: 10px; max-width: 82%; }
                .message-row.user { align-self: flex-end; flex-direction: row-reverse; }
                .message-row.staff { align-self: flex-start; }

                .message-avatar { width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .user .message-avatar { background: #ff1493; color: white; }
                .staff .message-avatar { background: #1e293b; color: white; }

                .message-bubble { padding: 12px 16px; border-radius: 18px; position: relative; }
                .user .message-bubble { background: #ff1493; color: white; border-top-right-radius: 4px; }
                .staff .message-bubble { background: white; color: #1e293b; border-top-left-radius: 4px; border: 1px solid #e6d8e1; }

                .sender-name { font-size: 10px; font-weight: 800; opacity: 0.8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
                .message-text { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
                .message-time { font-size: 10px; margin-top: 4px; opacity: 0.6; text-align: right; }

                .ticket-footer { padding: 16px 20px; border-top: 1px solid #f8e7ed; background: white; }
                .reply-form { display: flex; gap: 10px; }
                .reply-form input { flex: 1; padding: 12px 18px; border-radius: 16px; border: 1.5px solid #ede3e9; background: #f6eef3; outline: none; font-size: 14px; color: #18181b; transition: 0.2s; }
                .reply-form input:focus { border-color: #ff1493; background: white; }
                .reply-form button { width: 46px; height: 46px; border-radius: 16px; background: #ff1493; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
                .reply-form button:hover { background: #ff2d87; }
                .reply-form button:disabled { opacity: 0.5; cursor: not-allowed; }

                .closed-info { display: flex; align-items: center; justify-content: center; padding: 14px; background: #ede3e9; border-radius: 14px; color: #64748b; font-weight: 600; font-size: 13px; text-align: center; }

                /* Dark mode */
                .dark .page-wrapper { background: #121118; }
                .dark .ticket-container { background: #18181f; box-shadow: 0 0 40px rgba(0,0,0,0.4); }
                .dark .ticket-header, .dark .ticket-footer { border-bottom-color: #272730; background: #18181f; }
                .dark .ticket-footer { border-top-color: #272730; }
                .dark .back-btn { background: #272730; color: #f4f4f5; }
                .dark .header-info h1 { color: #f4f4f5; }
                .dark .date-tag { color: #a1a1aa; }
                .dark .chat-window { background: #121118; }
                .dark .staff .message-bubble { background: #272730; color: #f4f4f5; border-color: #3f3f46; }
                .dark .reply-form input { background: #272730; border-color: #3f3f46; color: #f4f4f5; }
                .dark .reply-form input:focus { background: #18181f; }
                .dark .closed-info { background: #272730; color: #a1a1aa; }
            `}</style>
        </div>
    );
}
