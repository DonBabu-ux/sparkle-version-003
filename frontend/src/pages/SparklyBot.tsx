import { showInfo } from '../utils/toast';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Send, Mic, Square, RefreshCw, Trash2, Brain, Sparkles, X, ChevronRight, MessageSquare,
  Search, Copy, Check, PanelLeft, ThumbsUp, ThumbsDown, GitFork, Settings, User, Shield, Info, Sliders,
  MessageCircle, AlertCircle, Palette, Zap, Globe, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import Spinner from '../components/ui/Spinner';
import { SparklyListingCard, type SparklyListingItem } from '../components/marketplace/SparklyListingCard';
import { SparklyAvatar, SparklyTypingDots } from '../components/sparkly/SparklyAvatar';
import { SparklyMarkdown } from '../components/sparkly/SparklyMarkdown';
import { logger } from '../utils/logger';

export interface WebSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structured_data?: { cards?: SparklyListingItem[] };
  sources?: WebSource[];
  created_at?: string;
  feedback?: 'like' | 'dislike' | null;
  dislike_category?: string | null;
  dislike_reason?: string | null;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  last_message?: string;
}

interface UserMemory {
  id: string;
  memory_type: string;
  memory_key: string;
  memory_value: string;
  created_at: string;
}

// Personas for Sparkly Identity
const PERSONAS = [
  {
    id: 'friendly',
    name: 'Friendly Sparkle',
    tagline: 'Warm, helpful & intuitive campus guide',
    icon: '✨',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  {
    id: 'tech_genius',
    name: 'Tech Genius',
    tagline: 'Analytical, structured & tech-savvy',
    icon: '💻',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  {
    id: 'deal_hunter',
    name: 'Deal Hunter',
    tagline: 'Bargain-focused, price & value-oriented',
    icon: '🛍️',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  {
    id: 'campus_buddy',
    name: 'Campus Buddy',
    tagline: 'Casual, student-friendly & relatable',
    icon: '🎓',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
  {
    id: 'concise',
    name: 'Concise Assistant',
    tagline: 'Direct, clear & bulleted responses',
    icon: '⚡',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  }
];

// Dislike categories for structured feedback
const DISLIKE_CATEGORIES = [
  { id: 'hallucination', label: 'Factual Error / Hallucination', icon: '❌' },
  { id: 'wrong_marketplace_info', label: 'Inaccurate Marketplace Info', icon: '🛍️' },
  { id: 'unhelpful', label: 'Unhelpful or Off-Topic', icon: '🤔' },
  { id: 'formatting', label: 'Formatting or Code Error', icon: '📝' },
  { id: 'other', label: 'Other Issue', icon: '💬' }
];

const QUICK_ACTIONS = [
  {
    icon: '💻',
    category: 'Laptops & Tech',
    title: 'Find laptops under KES 50k',
    prompt: 'Find laptops under KES 50,000 available on Sparkle Marketplace'
  },
  {
    icon: '📱',
    category: 'Smartphones',
    title: 'Top iPhone & Android deals',
    prompt: 'Search smartphones and tech deals near me on campus'
  },
  {
    icon: '🛋️',
    category: 'Campus Living',
    title: 'Subleases & cheap furniture',
    prompt: 'Recommend cheap furniture and sublease items on campus'
  },
  {
    icon: '🌐',
    category: 'Web Research',
    title: 'Search latest Kenya tech news',
    prompt: 'search the internet for the latest technology news in Kenya'
  }
];

export default function SparklyBot() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  // Primary State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);

  // Identity & Persona Customization State
  const [activePersona, setActivePersona] = useState<string>(() => localStorage.getItem('sparkly_persona') || 'friendly');

  // Message Actions & Feedback State
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, { type: 'like' | 'dislike'; category?: string; reason?: string }>>({});
  const [feedbackModalMsgId, setFeedbackModalMsgId] = useState<string | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<string>('unhelpful');
  const [feedbackReason, setFeedbackReason] = useState<string>('');

  // Sidebar & Search State
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings & Personalization Full-Screen Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'settings' | 'personalization' | 'persona' | 'profile'>('settings');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [responseStyle, setResponseStyle] = useState<'conversational' | 'concise' | 'detailed'>('conversational');
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryValue, setEditingMemoryValue] = useState<string>('');

  // Voice Input State
  const [isListening, setIsListening] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, currentStreamingId]);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/ai/sparkly/conversations/${activeConvId}/messages`);
        if (res.data.success) {
          const fetchedMsgs: Message[] = res.data.messages || [];
          setMessages(fetchedMsgs);

          const fbMap: Record<string, { type: 'like' | 'dislike'; category?: string; reason?: string }> = {};
          fetchedMsgs.forEach(m => {
            if (m.feedback) {
              fbMap[m.id] = { type: m.feedback, category: m.dislike_category || undefined, reason: m.dislike_reason || undefined };
            }
          });
          setMessageFeedback(fbMap);
        }
      } catch (err) {
        logger.error('Failed to fetch conversation messages:', err);
      }
    };
    fetchMessages();
  }, [activeConvId]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/ai/sparkly/conversations');
      if (res.data.success) {
        setConversations(res.data.conversations || []);
      }
    } catch (err) {
      logger.error('Failed to fetch Sparkly conversations:', err);
    }
  };

  const fetchMemories = async () => {
    setLoadingMemories(true);
    try {
      const res = await api.get('/ai/sparkly/memories');
      if (res.data.success) {
        setMemories(res.data.memories || []);
      }
    } catch (err) {
      logger.error('Failed to fetch memories:', err);
    } finally {
      setLoadingMemories(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await api.delete(`/ai/sparkly/memories/${memoryId}`);
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      logger.error('Failed to delete memory:', err);
    }
  };

  const handleClearAllMemories = async () => {
    try {
      await api.delete('/ai/sparkly/memories');
      setMemories([]);
      setShowClearConfirm(false);
    } catch (err) {
      logger.error('Failed to clear memories:', err);
    }
  };

  const handleStartNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setErrorMessage(null);
    setShowSidebar(false);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai/sparkly/conversations/${convId}`);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) {
        handleStartNewChat();
      }
    } catch (err) {
      logger.error('Failed to delete conversation:', err);
    }
  };

  // Message Copy
  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Feedback Handling (Like / Dislike)
  const handleLike = async (msgId: string) => {
    const current = messageFeedback[msgId];
    if (current?.type === 'like') {
      try {
        await api.delete(`/ai/sparkly/messages/${msgId}/feedback`);
        setMessageFeedback(prev => {
          const copy = { ...prev };
          delete copy[msgId];
          return copy;
        });
      } catch (err) {
        logger.error('Failed to remove feedback:', err);
      }
    } else {
      try {
        await api.post(`/ai/sparkly/messages/${msgId}/feedback`, { feedbackType: 'like' });
        setMessageFeedback(prev => ({
          ...prev,
          [msgId]: { type: 'like' }
        }));
      } catch (err) {
        logger.error('Failed to submit like feedback:', err);
      }
    }
  };

  const openDislikeModal = (msgId: string) => {
    setFeedbackModalMsgId(msgId);
    setFeedbackCategory('unhelpful');
    setFeedbackReason('');
  };

  const submitDislikeFeedback = async () => {
    if (!feedbackModalMsgId) return;
    const msgId = feedbackModalMsgId;
    try {
      await api.post(`/ai/sparkly/messages/${msgId}/feedback`, {
        feedbackType: 'dislike',
        category: feedbackCategory,
        reason: feedbackReason.trim()
      });
      setMessageFeedback(prev => ({
        ...prev,
        [msgId]: { type: 'dislike', category: feedbackCategory, reason: feedbackReason.trim() }
      }));
    } catch (err) {
      logger.error('Failed to submit dislike feedback:', err);
    } finally {
      setFeedbackModalMsgId(null);
    }
  };

  const handleBranchInNewChat = async (msgId: string) => {
    if (!activeConvId) return;
    try {
      const res = await api.post(`/ai/sparkly/conversations/${activeConvId}/branch`, { messageId: msgId });
      if (res.data.success && res.data.conversation) {
        const newConv = res.data.conversation;
        setConversations(prev => [newConv, ...prev]);
        setActiveConvId(newConv.id);
      }
    } catch (err) {
      logger.error('Failed to branch conversation:', err);
    }
  };

  const handleTryAgain = (msgIndex: number) => {
    let lastUserPrompt = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserPrompt = messages[i].content;
        break;
      }
    }
    if (lastUserPrompt) {
      handleSendMessage(lastUserPrompt);
    } else if (lastUserMessage) {
      handleSendMessage(lastUserMessage);
    }
  };

  // Voice Input Toggle
  const toggleVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showInfo('Voice input is not supported in this browser. Please type your message.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => setIsListening(false);

      recognition.start();
    } catch (err) {
      logger.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsThinking(false);
    setCurrentStreamingId(null);
  };

  // Send Message with SSE Token & Web Source Streaming
  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || inputText.trim();
    if (!content || isThinking) return;

    setInputText('');
    setErrorMessage(null);
    setLastUserMessage(content);

    const tempUserMsg: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: content,
      created_at: new Date().toISOString()
    };

    const streamMsgId = 'assistant-' + Date.now();
    const tempAssistantMsg: Message = {
      id: streamMsgId,
      role: 'assistant',
      content: '',
      structured_data: { cards: [] },
      sources: [],
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempUserMsg, tempAssistantMsg]);
    setIsThinking(true);
    setCurrentStreamingId(streamMsgId);

    abortControllerRef.current = new AbortController();

    try {
      const token = useUserStore.getState().token;
      const baseUrl = api.defaults.baseURL || '/api';

      let response = await fetch(`${baseUrl}/ai/sparkly/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: content,
          conversationId: activeConvId,
          persona: activePersona,
          responseStyle,
          webSearchEnabled
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream available');

      let buffer = '';
      let accumulatedText = '';
      let hasCards = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          if (!evt.trim()) continue;

          let eventType = 'message';
          let dataStr = '';

          const lines = evt.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr = line.slice(5).trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            // 1. Meta / Conversation Init
            const targetConvId = data.conversationId;
            if (targetConvId && !activeConvId) {
              setActiveConvId(targetConvId);
              fetchConversations();
            }

            // 2. Text Chunks / Tokens
            const incomingToken = data.text || data.token;
            if (incomingToken && (data.type === 'chunk' || data.type === 'token' || !data.type)) {
              accumulatedText += incomingToken;
              setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: accumulatedText } : m));
            }

            // 3. Structured Marketplace Cards
            const incomingCards = data.cards || data.structuredCards;
            if (Array.isArray(incomingCards) && incomingCards.length > 0) {
              hasCards = true;
              setMessages(prev => prev.map(m => m.id === streamMsgId ? {
                ...m,
                structured_data: { cards: incomingCards }
              } : m));
            }

            // 4. Web Search Sources
            const incomingSources = data.sources;
            if (Array.isArray(incomingSources) && incomingSources.length > 0) {
              setMessages(prev => prev.map(m => m.id === streamMsgId ? {
                ...m,
                sources: incomingSources
              } : m));
            }

            // 5. Completion Signal
            if (data.type === 'done' || data.type === 'message') {
              if (data.savedMessage?.id) {
                const finalId = data.savedMessage.id;
                setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, id: finalId } : m));
              }
            }

            // 6. Error Signal
            if (data.type === 'error') {
              throw new Error(data.message || 'Stream generation error');
            }
          } catch (e) {
            logger.warn('Failed to parse SSE event chunk:', e);
          }
        }
      }

      if (!accumulatedText.trim() && !hasCards) {
        setMessages(prev => prev.map(m => m.id === streamMsgId && !m.content ? {
          ...m,
          content: "I'm ready to help you on Sparkle Marketplace! What items, news, or deals are you looking for today?"
        } : m));
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        logger.log('Sparkly stream stopped by user');
      } else {
        logger.warn('SSE Stream failed, attempting fallback to POST /ai/sparkly/chat...', err);
        try {
          const res = await api.post('/ai/sparkly/chat', {
            message: content,
            conversationId: activeConvId,
            persona: activePersona,
            responseStyle
          });

          if (res.data.success) {
            if (!activeConvId && res.data.conversationId) {
              setActiveConvId(res.data.conversationId);
              fetchConversations();
            }

            setMessages(prev => prev.map(m => m.id === streamMsgId ? {
              id: res.data.savedMessage?.id || streamMsgId,
              role: 'assistant',
              content: res.data.answer || 'I am ready to help you on Sparkle!',
              structured_data: { cards: res.data.structuredCards || [] },
              created_at: new Date().toISOString()
            } : m));
          } else {
            throw new Error(res.data.message || 'Failed to process response');
          }
        } catch (fallbackErr: any) {
          logger.error('Sparkly AI Fallback Error:', fallbackErr);
          setErrorMessage(fallbackErr.response?.data?.message || fallbackErr.message || 'Sparkly is having trouble connecting right now. Try again in a moment.');
          setMessages(prev => prev.filter(m => m.id !== streamMsgId));
        }
      }
    } finally {
      setIsThinking(false);
      setCurrentStreamingId(null);
      abortControllerRef.current = null;
    }
  };

  const filteredConversations = conversations.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || (c.last_message && c.last_message.toLowerCase().includes(q));
  });

  const currentPersonaObj = PERSONAS.find(p => p.id === activePersona) || PERSONAS[0];

  return (
    <div className="flex h-[100dvh] w-screen bg-[#111116] text-slate-100 font-sans overflow-hidden select-none">
      
      {/* ── Left Sidebar Drawer (Chat History) ──────────────────────────────── */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-72 bg-[#17171e] border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <SparklyAvatar size={28} />
              <span className="font-extrabold text-white text-sm">Sparkly AI</span>
            </div>
          </div>
          <button
            onClick={() => setShowSidebar(false)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleStartNewChat}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversation Search Bar */}
        <div className="px-3 mb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#111116] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Conversation History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map(c => {
              const isActive = activeConvId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveConvId(c.id);
                    setShowSidebar(false);
                  }}
                  className={`group p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-purple-600/20 border border-purple-500/40 text-white'
                      : 'hover:bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <MessageSquare size={14} className={isActive ? 'text-purple-400' : 'text-slate-500'} />
                    <span className="text-xs font-bold truncate">{c.title || 'Marketplace Inquiry'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all"
                    title="Delete chat"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer: Settings Entry */}
        <div className="p-3 border-t border-white/10 bg-[#14141a]">
          <button
            onClick={() => {
              setShowProfileModal(true);
              setActiveModalTab('settings');
              fetchMemories();
            }}
            className="w-full p-2.5 rounded-xl bg-[#111116] border border-white/10 hover:border-purple-500/30 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-purple-400" />
              <span>Settings & Personalization</span>
            </div>
            <ChevronRight size={14} className="text-slate-500" />
          </button>
        </div>
      </aside>

      {/* ── Main Chat Area ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full bg-[#111116] relative min-w-0 overflow-hidden">
        
        {/* Header Bar */}
        <header className="h-16 border-b border-white/10 bg-[#17171e] px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 md:hidden"
            >
              <PanelLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <SparklyAvatar size={34} pulse={isThinking} />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-white text-sm leading-tight">Sparkly AI</h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentPersonaObj.badgeColor}`}>
                    {currentPersonaObj.name}
                  </span>
                </div>
                <p className="text-[11px] text-purple-400 font-medium">Native Sparkle Assistant & Web Intelligence</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowProfileModal(true);
                setActiveModalTab('settings');
                fetchMemories();
              }}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Open Settings"
            >
              <Settings size={18} />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </header>

        {/* Message Thread Container */}
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar pb-36">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="flex justify-center">
                <SparklyAvatar size={64} pulse={isThinking} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Hello! I'm Sparkly ✨</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
                  Your intelligent Sparkle assistant. Ask me to search Marketplace deals, check live web news, compare prices, or guide you through campus selling rules!
                </p>
              </div>

              {/* Quick Action Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                {QUICK_ACTIONS.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(action.prompt)}
                    className="p-4 bg-[#17171e] hover:bg-[#1f1f2a] border border-white/10 hover:border-purple-500/40 rounded-2xl text-left transition-all shadow-md group flex flex-col justify-between h-28 active:scale-98"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{action.icon}</span>
                      <ChevronRight size={16} className="text-slate-500 group-hover:text-purple-400 transition-colors" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-0.5">
                        {action.category}
                      </span>
                      <p className="text-xs font-bold text-slate-200 group-hover:text-white line-clamp-1">
                        {action.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const fb = messageFeedback[msg.id];
              const isLiked = fb?.type === 'like';
              const isDisliked = fb?.type === 'dislike';
              const isCurrentlyStreaming = isThinking && msg.id === currentStreamingId;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id || index}
                  className={`flex gap-3 max-w-3xl mx-auto group mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="shrink-0 mt-0.5">
                      <SparklyAvatar size={32} pulse={isCurrentlyStreaming} />
                    </div>
                  )}

                  <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-purple-600 text-white font-medium shadow-md rounded-tr-xs'
                          : 'bg-[#17171e] border border-white/10 text-slate-100 rounded-tl-xs font-normal'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words select-text">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          {msg.content ? (
                            <SparklyMarkdown content={msg.content} streaming={isCurrentlyStreaming} />
                          ) : isCurrentlyStreaming ? (
                            <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                              <SparklyTypingDots />
                              <span>Sparkly is thinking & processing...</span>
                            </div>
                          ) : null}

                          {/* Embedded Marketplace Cards */}
                          {msg.structured_data?.cards && msg.structured_data.cards.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.structured_data.cards.map((cardItem) => (
                                <SparklyListingCard key={cardItem.listing_id} listing={cardItem} />
                              ))}
                            </div>
                          )}

                          {/* Embedded Web Sources */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 space-y-2 border-t border-white/10 pt-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                                <Globe size={12} /> Web Sources
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {msg.sources.map((src, idx) => (
                                  <a
                                    key={idx}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2.5 bg-[#111116] border border-white/10 hover:border-purple-500/40 rounded-xl block transition-all hover:bg-[#181822]"
                                  >
                                    <span className="text-[10px] text-purple-300 font-mono block truncate">{src.domain}</span>
                                    <h6 className="text-xs font-bold text-white truncate">{src.title}</h6>
                                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{src.snippet}</p>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Action Bar under assistant messages */}
                    {!isUser && !isCurrentlyStreaming && msg.content && (
                      <div className="flex items-center gap-1 mt-1 opacity-90 transition-opacity px-1 text-slate-400">
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="p-1.5 hover:bg-white/10 rounded-lg hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                          title="Copy response"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check size={13} className="text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copied</span>
                            </>
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>

                        <button
                          onClick={() => handleLike(msg.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isLiked ? 'text-emerald-400 bg-emerald-500/10' : 'hover:bg-white/10 hover:text-white'
                          }`}
                          title="Good response"
                        >
                          <ThumbsUp size={13} />
                        </button>

                        <button
                          onClick={() => openDislikeModal(msg.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDisliked ? 'text-rose-400 bg-rose-500/10' : 'hover:bg-white/10 hover:text-white'
                          }`}
                          title="Poor response feedback"
                        >
                          <ThumbsDown size={13} />
                        </button>

                        <button
                          onClick={() => handleTryAgain(index)}
                          className="p-1.5 hover:bg-white/10 rounded-lg hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                          title="Try again"
                        >
                          <RefreshCw size={13} />
                        </button>

                        <button
                          onClick={() => handleBranchInNewChat(msg.id)}
                          className="p-1.5 hover:bg-white/10 rounded-lg hover:text-purple-400 transition-colors flex items-center gap-1 text-[11px]"
                          title="Branch in new chat"
                        >
                          <GitFork size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-950/70 border border-rose-800/80 p-4 rounded-2xl text-center max-w-md mx-auto my-4 shadow-xl">
              <p className="text-xs font-bold text-rose-300 mb-3">{errorMessage}</p>
              <button
                onClick={() => lastUserMessage && handleSendMessage(lastUserMessage)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 mx-auto transition-all shadow-md active:scale-95"
              >
                <RefreshCw size={14} />
                <span>Retry Last Request</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Fixed Composer Bottom Floating Bar */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#111116] via-[#111116]/95 to-transparent z-20">
          <div className="max-w-3xl mx-auto relative">
            <div className="bg-[#17171e] border border-white/15 focus-within:border-purple-500/60 rounded-3xl shadow-2xl p-2 transition-all flex items-end gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask Sparkly anything..."
                rows={1}
                className="flex-1 bg-transparent border-0 text-white placeholder-slate-500 text-sm p-3 focus:outline-none resize-none max-h-32 min-h-[44px]"
              />

              <div className="flex items-center gap-1.5 pb-1 pr-1">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`p-2.5 rounded-2xl transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Voice input"
                >
                  <Mic size={18} />
                </button>

                {isThinking ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl transition-all shadow-md active:scale-95"
                    title="Stop generating"
                  >
                    <Square size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim()}
                    className={`p-2.5 rounded-2xl transition-all shadow-md ${
                      inputText.trim()
                        ? 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                        : 'bg-white/10 text-slate-500 cursor-not-allowed'
                    }`}
                    title="Send message"
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Dislike Feedback Modal ────────────────────────────────────────── */}
        <AnimatePresence>
          {feedbackModalMsgId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setFeedbackModalMsgId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#17171e] border border-white/15 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertCircle size={18} />
                    <span>Improve Sparkly AI</span>
                  </div>
                  <button onClick={() => setFeedbackModalMsgId(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={18} />
                  </button>
                </div>

                <p className="text-xs text-slate-300">
                  What was wrong with this response? Your feedback helps Sparkly learn.
                </p>

                <div className="space-y-2">
                  {DISLIKE_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFeedbackCategory(cat.id)}
                      className={`w-full p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center gap-3 ${
                        feedbackCategory === cat.id
                          ? 'bg-rose-500/20 border-rose-500 text-white'
                          : 'bg-[#111116] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  value={feedbackReason}
                  onChange={(e) => setFeedbackReason(e.target.value)}
                  placeholder="Optional details (e.g. what answer did you expect?)"
                  rows={2}
                  className="w-full p-3 bg-[#111116] border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 resize-none"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setFeedbackModalMsgId(null)}
                    className="px-4 py-2 bg-white/10 text-slate-300 rounded-xl text-xs font-bold hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDislikeFeedback}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    Submit Feedback
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── True Full-Page Settings & Personalization Screen ──────────────────── */}
        <AnimatePresence>
          {showProfileModal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-0 z-50 bg-[#111116] flex flex-col h-dvh w-screen font-sans text-slate-100 overflow-hidden"
            >
              {/* Full-Page Screen Navigation Header */}
              <div className="h-16 border-b border-white/10 bg-[#17171e] px-4 sm:px-8 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowProfileModal(false)}
                    className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-2xl transition-all flex items-center gap-2 text-xs font-bold"
                  >
                    <ArrowLeft size={18} />
                    <span>Back to Chat</span>
                  </button>
                  <div className="h-6 w-px bg-white/10 hidden sm:block" />
                  <div className="flex items-center gap-3">
                    <SparklyAvatar size={32} />
                    <div>
                      <h2 className="font-extrabold text-white text-base leading-tight">Settings & Intelligence</h2>
                      <p className="text-[11px] text-purple-400 font-medium">Sparkly AI Personalization & Web Controls</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowProfileModal(false)} 
                  className="p-2.5 text-slate-400 hover:text-white rounded-2xl hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Tabs Bar */}
              <div className="bg-[#14141a] border-b border-white/10 px-4 sm:px-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveModalTab('settings')}
                  className={`py-3.5 px-5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                    activeModalTab === 'settings'
                      ? 'border-purple-500 text-white bg-purple-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings size={15} />
                  <span>AI & System Settings</span>
                </button>

                <button
                  onClick={() => { setActiveModalTab('personalization'); fetchMemories(); }}
                  className={`py-3.5 px-5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                    activeModalTab === 'personalization'
                      ? 'border-purple-500 text-white bg-purple-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Brain size={15} />
                  <span>Personalization & Memory</span>
                </button>

                <button
                  onClick={() => setActiveModalTab('persona')}
                  className={`py-3.5 px-5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                    activeModalTab === 'persona'
                      ? 'border-purple-500 text-white bg-purple-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Palette size={15} />
                  <span>Persona & Tone</span>
                </button>

                <button
                  onClick={() => setActiveModalTab('profile')}
                  className={`py-3.5 px-5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                    activeModalTab === 'profile'
                      ? 'border-purple-500 text-white bg-purple-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User size={15} />
                  <span>Capabilities & About</span>
                </button>
              </div>

              {/* Scrollable Screen Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 pb-28 custom-scrollbar">
                
                {/* TAB 1: AI & System Settings */}
                {activeModalTab === 'settings' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-extrabold text-white mb-1">AI Capabilities & Toggles</h3>
                      <p className="text-xs text-slate-400">Configure how Sparkly responds and researches queries.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Web Search Toggle */}
                      <div className="bg-[#17171e] p-5 rounded-3xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Globe size={18} className="text-purple-400" />
                            <h4 className="font-extrabold text-white text-xs">Real-Time Web Search</h4>
                          </div>
                          <button
                            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                              webSearchEnabled
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-white/10 text-slate-400'
                            }`}
                          >
                            {webSearchEnabled ? 'ENABLED' : 'DISABLED'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Allows Sparkly to search the live web for breaking news, current football scores, weather, and tech updates.
                        </p>
                      </div>

                      {/* Personalization Toggle */}
                      <div className="bg-[#17171e] p-5 rounded-3xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Brain size={18} className="text-purple-400" />
                            <h4 className="font-extrabold text-white text-xs">AI Personalization</h4>
                          </div>
                          <button
                            onClick={() => setPersonalizationEnabled(!personalizationEnabled)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                              personalizationEnabled
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-white/10 text-slate-400'
                            }`}
                          >
                            {personalizationEnabled ? 'ENABLED' : 'DISABLED'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Tailor marketplace recommendations and responses based on your stored budget, campus, and category interests.
                        </p>
                      </div>

                      {/* Memory Toggle */}
                      <div className="bg-[#17171e] p-5 rounded-3xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Zap size={18} className="text-purple-400" />
                            <h4 className="font-extrabold text-white text-xs">Automatic Memory</h4>
                          </div>
                          <button
                            onClick={() => setMemoryEnabled(!memoryEnabled)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                              memoryEnabled
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-white/10 text-slate-400'
                            }`}
                          >
                            {memoryEnabled ? 'ENABLED' : 'DISABLED'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Automatically extract relevant non-sensitive marketplace preferences from your natural conversations.
                        </p>
                      </div>

                      {/* Response Style Selector */}
                      <div className="bg-[#17171e] p-5 rounded-3xl border border-white/10 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <Sliders size={18} className="text-purple-400" />
                          <h4 className="font-extrabold text-white text-xs">Response Style</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {(['conversational', 'concise', 'detailed'] as const).map(style => (
                            <button
                              key={style}
                              onClick={() => setResponseStyle(style)}
                              className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold capitalize transition-all ${
                                responseStyle === style
                                  ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                                  : 'bg-[#111116] border-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Account & Context Info */}
                    <div className="bg-[#17171e] p-5 rounded-3xl border border-white/10 space-y-3">
                      <h4 className="font-extrabold text-white text-xs uppercase tracking-wider text-purple-400">User Context</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="flex justify-between p-3 bg-[#111116] rounded-2xl border border-white/10">
                          <span className="text-slate-400">Campus Location</span>
                          <span className="font-bold text-white">{user?.campus || 'Main Campus'}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-[#111116] rounded-2xl border border-white/10">
                          <span className="text-slate-400">Account Profile</span>
                          <span className="font-bold text-white">{user?.username || 'Authenticated Member'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Personalization & Learned Memory */}
                {activeModalTab === 'personalization' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-white">Learned Preferences & Memory</h3>
                        <p className="text-xs text-slate-400">Sparkly remembers key facts to serve you better. You have full control.</p>
                      </div>
                      {memories.length > 0 && (
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="px-3.5 py-2 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs font-bold transition-all"
                        >
                          Clear All Memories
                        </button>
                      )}
                    </div>

                    {showClearConfirm && (
                      <div className="bg-rose-950/80 border border-rose-800 p-5 rounded-3xl space-y-3">
                        <p className="text-xs font-bold text-rose-200">
                          Are you sure you want to permanently delete all stored Sparkly AI preferences?
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleClearAllMemories}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md"
                          >
                            Confirm Clear All
                          </button>
                        </div>
                      </div>
                    )}

                    {loadingMemories ? (
                      <div className="flex justify-center py-12">
                        <Spinner size="large" color="text-purple-400" />
                      </div>
                    ) : memories.length === 0 ? (
                      <div className="bg-[#17171e] p-8 rounded-3xl border border-white/10 text-center space-y-2">
                        <Brain size={36} className="text-purple-400/50 mx-auto" />
                        <h4 className="font-bold text-white text-sm">No Stored Preferences Yet</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          As you chat with Sparkly (e.g., "my budget is 50k", "looking for laptops"), your preferences will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {memories.map(mem => (
                          <div
                            key={mem.id}
                            className="p-4 bg-[#17171e] border border-white/10 rounded-2xl flex items-center justify-between gap-4 text-xs hover:border-purple-500/40 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider block mb-1">
                                {mem.memory_key.replace(/_/g, ' ')}
                              </span>
                              {editingMemoryId === mem.id ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <input
                                    type="text"
                                    value={editingMemoryValue}
                                    onChange={(e) => setEditingMemoryValue(e.target.value)}
                                    className="px-3 py-1 bg-[#111116] border border-purple-500 rounded-xl text-xs text-white flex-1 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => {
                                      setMemories(prev => prev.map(m => m.id === mem.id ? { ...m, memory_value: editingMemoryValue } : m));
                                      setEditingMemoryId(null);
                                    }}
                                    className="px-3 py-1 bg-purple-600 text-white rounded-xl font-bold text-[11px]"
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <p className="font-bold text-white text-sm truncate">{mem.memory_value}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingMemoryId(mem.id);
                                  setEditingMemoryValue(mem.memory_value);
                                }}
                                className="p-2 bg-white/5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                                title="Edit preference"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteMemory(mem.id)}
                                className="p-2 bg-white/5 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/20 transition-colors"
                                title="Delete preference"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Persona Selection */}
                {activeModalTab === 'persona' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-extrabold text-white">Sparkly Assistant Persona</h3>
                      <p className="text-xs text-slate-400">Select how Sparkly should communicate with you.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PERSONAS.map(p => {
                        const isSelected = activePersona === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setActivePersona(p.id);
                              localStorage.setItem('sparkly_persona', p.id);
                            }}
                            className={`p-4 rounded-3xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-purple-600/20 border-purple-500 shadow-xl'
                                : 'bg-[#17171e] border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">{p.icon}</span>
                              <div>
                                <h4 className="font-extrabold text-white text-xs">{p.name}</h4>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{p.tagline}</p>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="w-3 h-3 rounded-full bg-purple-400 animate-pulse shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 4: Capabilities & About */}
                {activeModalTab === 'profile' && (
                  <div className="space-y-6 text-xs leading-relaxed text-slate-300">
                    <div className="bg-[#17171e] p-5 rounded-3xl border border-white/10 space-y-3">
                      <div className="flex items-center justify-between text-white font-bold">
                        <span>Engine Status</span>
                        <span className="text-emerald-400 flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Online & Ready (SSE Active)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Version</span>
                        <span className="font-mono text-purple-300 font-bold">Sparkly v4.5 Enterprise</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Platform Engine</span>
                        <span>Sparkle Marketplace AI Router</span>
                      </div>
                    </div>

                    <div className="bg-[#17171e] p-5 rounded-3xl border border-white/10 space-y-3">
                      <h4 className="font-bold text-white text-xs uppercase tracking-wider text-purple-400">Sparkly AI Features</h4>
                      <ul className="space-y-2 list-disc pl-4 text-slate-300">
                        <li>Real-time SSE token streaming for instantaneous response loading</li>
                        <li>Live Web Search for Kenya news, current events, tech, and sports</li>
                        <li>Native Sparkle Marketplace database search and structured card rendering</li>
                        <li>Campus guidelines, buying & selling policy search</li>
                        <li>Personalized preference management with explicit user controls</li>
                        <li>Global timezone and clock lookup</li>
                      </ul>
                    </div>

                    <div className="bg-purple-950/20 border border-purple-800/30 p-4 rounded-3xl text-xs text-purple-300 flex items-start gap-3">
                      <Shield size={18} className="text-purple-400 shrink-0 mt-0.5" />
                      <p>
                        Sparkly runs zero-hallucination deterministic routing server-side. Your chat history and memories are private to your Sparkle account and never shared with external advertisers.
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Screen Footer Toolbar */}
              <div className="h-16 border-t border-white/10 bg-[#14141a] px-4 sm:px-8 flex items-center justify-end shrink-0">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-extrabold transition-all shadow-lg active:scale-95"
                >
                  Save & Return to Chat
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
