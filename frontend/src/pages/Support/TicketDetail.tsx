import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, Clock, AlertCircle, ShieldCheck, MessageCircle, Bot } from 'lucide-react';
import Navbar from '../../components/Navbar';
import api from '../../api/api';

interface SupportMessage {
    message_id: string;
    sender_id: string | null;
    sender_type: 'user' | 'staff' | 'bot';
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
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTicket();
        const interval = setInterval(fetchTicket, 10000); // Polling for bot response
        return () => clearInterval(interval);
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
                setMessages(res.data.messages);
            }
        } catch (err) {
            console.error('Failed to fetch ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim() || sending) return;

        setSending(true);
        try {
            const res = await api.post(`/support/tickets/${ticketId}/messages`, { content: reply });
            if (res.data.success) {
                setReply('');
                fetchTicket();
            }
        } catch (err) {
            alert('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    if (!ticket) return <div className="flex items-center justify-center min-h-screen">Ticket not found</div>;

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="ticket-content">
                <main className="ticket-container">
                    <header className="ticket-header">
                        <button onClick={() => navigate('/support')} className="back-btn">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="header-info">
                            <h1>{ticket.subject}</h1>
                            <div className="header-meta">
                                <span className="category-tag">{ticket.category}</span>
                                <span className="date-tag">{new Date(ticket.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className={`status-badge ${ticket.status}`}>
                            {ticket.status === 'resolved' ? <CheckCircle size={14} /> : <Clock size={14} />}
                            {ticket.status.replace('_', ' ')}
                        </div>
                    </header>

                    <div className="chat-window" ref={scrollRef}>
                        <div className="messages-list">
                            {messages.map((msg) => (
                                <div key={msg.message_id} className={`message-row ${msg.sender_type}`}>
                                    <div className="message-avatar">
                                        {msg.sender_type === 'bot' ? <Bot size={20} /> : msg.sender_type === 'staff' ? <ShieldCheck size={20} /> : <MessageCircle size={20} />}
                                    </div>
                                    <div className="message-bubble">
                                        <div className="sender-name">
                                            {msg.sender_type === 'user' ? 'You' : msg.sender_type === 'bot' ? 'Sparkle Bot' : 'Support Team'}
                                        </div>
                                        <div className="message-text">{msg.content}</div>
                                        <div className="message-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <footer className="ticket-footer">
                        {ticket.status === 'closed' || ticket.status === 'resolved' ? (
                            <div className="closed-info">
                                <AlertCircle size={20} />
                                This ticket is {ticket.status}. You cannot send more messages.
                            </div>
                        ) : (
                            <form className="reply-form" onSubmit={handleSend}>
                                <input 
                                    type="text" 
                                    placeholder="Type your message..." 
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    disabled={sending}
                                />
                                <button type="submit" disabled={!reply.trim() || sending}>
                                    <Send size={20} />
                                </button>
                            </form>
                        )}
                    </footer>
                </main>
            </div>

            <style>{`
                .page-wrapper { display: flex; background: #f0f2f5; min-h-screen; }
                .ticket-content { flex: 1; display: flex; flex-direction: column; height: 100vh; pt: 70px; }
                .ticket-container { max-width: 800px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; background: white; height: 100%; box-shadow: 0 0 40px rgba(0,0,0,0.05); }

                .ticket-header { padding: 24px; border-bottom: 1px solid #f0f2f5; display: flex; align-items: center; gap: 16px; }
                .back-btn { padding: 10px; border-radius: 12px; background: #f8fafc; border: none; cursor: pointer; transition: 0.2s; }
                .back-btn:hover { background: #e2e8f0; }
                .header-info { flex: 1; }
                .header-info h1 { margin: 0; font-size: 1.25rem; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
                .header-meta { display: flex; gap: 8px; margin-top: 4px; }
                .category-tag { font-size: 11px; font-bold; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }
                .date-tag { font-size: 11px; color: #94a3b8; }

                .status-badge { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .status-badge.open { background: #dcfce7; color: #166534; }
                .status-badge.in_progress { background: #fef9c3; color: #854d0e; }
                .status-badge.resolved { background: #dcfce7; color: #166534; }
                .status-badge.closed { background: #f1f5f9; color: #475569; }

                .chat-window { flex: 1; overflow-y: auto; padding: 24px; background: #f8fafc; }
                .messages-list { display: flex; flex-direction: column; gap: 20px; }
                .message-row { display: flex; gap: 12px; max-width: 80%; }
                .message-row.user { align-self: flex-end; flex-direction: row-reverse; }
                .message-row.bot, .message-row.staff { align-self: flex-start; }

                .message-avatar { width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .user .message-avatar { background: #FF3D6D; color: white; }
                .bot .message-avatar { background: #1e293b; color: white; }
                .staff .message-avatar { background: #6366f1; color: white; }

                .message-bubble { padding: 12px 16px; border-radius: 18px; position: relative; }
                .user .message-bubble { background: #FF3D6D; color: white; border-top-right-radius: 4px; }
                .bot .message-bubble { background: white; color: #1e293b; border-top-left-radius: 4px; border: 1px solid #e2e8f0; }
                .staff .message-bubble { background: #6366f1; color: white; border-top-left-radius: 4px; }

                .sender-name { font-size: 11px; font-weight: 800; opacity: 0.7; margin-bottom: 4px; text-transform: uppercase; }
                .message-text { font-size: 15px; line-height: 1.5; }
                .message-time { font-size: 10px; margin-top: 6px; opacity: 0.6; text-align: right; }

                .ticket-footer { padding: 20px 24px; border-top: 1px solid #f0f2f5; background: white; }
                .reply-form { display: flex; gap: 12px; }
                .reply-form input { flex: 1; padding: 14px 20px; border-radius: 16px; border: 2px solid #f1f5f9; background: #f8fafc; outline: none; transition: 0.2s; }
                .reply-form input:focus { border-color: #FF3D6D; background: white; }
                .reply-form button { width: 50px; height: 50px; border-radius: 16px; background: #FF3D6D; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(255,61,109,0.2); }
                .reply-form button:hover { transform: scale(1.05); }
                .reply-form button:disabled { opacity: 0.5; transform: none; }

                .closed-info { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: #f1f5f9; border-radius: 16px; color: #64748b; font-weight: 600; font-size: 14px; }
            `}</style>
        </div>
    );
}
