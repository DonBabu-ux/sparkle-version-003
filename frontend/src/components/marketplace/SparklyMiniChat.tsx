import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import api from "../../api/api";
import { useUserStore } from "../../store/userStore";
import { useNavigate } from "react-router-dom";

interface MiniMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: any[];
  isStreaming?: boolean;
}

const QUICK_CHIPS = [
  { icon: "💻", label: "Cheap laptops", prompt: "Find me cheap laptops under KES 40,000 on Sparkle" },
  { icon: "📱", label: "Phones", prompt: "Show me affordable smartphones on Sparkle Marketplace" },
  { icon: "🛋️", label: "Furniture", prompt: "Find cheap furniture and campus room items" },
  { icon: "📚", label: "Books", prompt: "Looking for second-hand textbooks near my campus" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
}

export default function SparklyMiniChat({ isOpen, onClose, initialMessage }: Props) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MiniMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setMessages([]);
      setConvId(null);
      setInputText("");
      sentInitial.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 0 && !sentInitial.current) {
      sentInitial.current = true;
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = (text || inputText).trim();
    if (!content || isThinking) return;
    setInputText("");

    const userMsg: MiniMessage = { id: "u-" + Date.now(), role: "user", content };
    const asstId = "a-" + Date.now();
    const asstMsg: MiniMessage = { id: asstId, role: "assistant", content: "", isStreaming: true };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setIsThinking(true);
    abortRef.current = new AbortController();

    try {
      const token = useUserStore.getState().token || localStorage.getItem("accessToken");
      const baseUrl = api.defaults.baseURL || "/api";
      const response = await fetch(`${baseUrl}/ai/sparkly/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: content,
          conversationId: convId,
          persona: "deal_hunter",
          responseStyle: "concise",
          webSearchEnabled: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let buffer = "";
      let accumulated = "";
      let cards: any[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          if (!evt.trim()) continue;
          let eventType = "message";
          let dataStr = "";
          for (const line of evt.split("\n")) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
          }
          if (!dataStr) continue;
          try {
            const parsed = JSON.parse(dataStr);

            // Token streaming — orchestrator sends event:'chunk' with {text, token}
            const incomingToken = parsed.text || parsed.token;
            if (incomingToken && (eventType === "chunk" || eventType === "token" || !parsed.type)) {
              accumulated += incomingToken;
              setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: accumulated } : m)));
            }

            // Conversation ID from meta or done events
            if (parsed.conversationId) setConvId(parsed.conversationId);

            // Listing cards
            const incomingCards = parsed.cards || parsed.structuredCards;
            if (Array.isArray(incomingCards) && incomingCards.length > 0) {
              cards = incomingCards;
              setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, cards } : m)));
            }

            // Done signal — also capture answer if stream missed
            if (eventType === "done" || parsed.type === "done") {
              if (parsed.answer && !accumulated) {
                accumulated = parsed.answer;
                setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: accumulated } : m)));
              }
            }
          } catch (_) {}

        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId ? { ...m, content: "Sorry, I couldn't connect to Sparkly right now. Try again or open the full chat.", isStreaming: false } : m
          )
        );
      }
    } finally {
      setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, isStreaming: false } : m)));
      setIsThinking(false);
    }
  };

  const openFullChat = () => {
    onClose();
    navigate("/sparkly-bot", { state: { source: "marketplace", conversationId: convId } });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl overflow-hidden shadow-2xl"
            style={{ maxHeight: "80vh", background: "linear-gradient(180deg,#0f0f1a 0%,#0c0c18 100%)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f0f1a]" />
                </div>
                <div>
                  <p className="text-white font-bold text-[15px] leading-tight">Sparkly AI</p>
                  <p className="text-purple-300/70 text-[11px]">Marketplace Shopping Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openFullChat}
                  className="flex items-center gap-1.5 text-[12px] text-purple-300/80 hover:text-purple-200 px-2.5 py-1.5 rounded-full border border-purple-500/30 hover:border-purple-400/50 transition-colors"
                >
                  <ExternalLink size={12} /> Full chat
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.length === 0 ? (
                <div className="py-4">
                  <p className="text-white/40 text-center text-[13px] mb-4">Ask me anything about items on Sparkle</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        onClick={() => sendMessage(chip.prompt)}
                        className="flex items-center gap-2 bg-white/8 hover:bg-white/14 border border-white/10 hover:border-purple-500/40 rounded-xl px-3 py-2.5 text-left transition-all"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        <span className="text-lg leading-none">{chip.icon}</span>
                        <span className="text-[12px] text-white/70 font-medium leading-snug">{chip.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                        <Sparkles size={12} className="text-white" />
                      </div>
                    )}
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-purple-600 text-white rounded-tr-sm"
                            : "bg-white/10 text-white/90 rounded-tl-sm"
                        }`}
                      >
                        {msg.isStreaming && !msg.content ? (
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                      </div>
                      {msg.cards && msg.cards.length > 0 && (
                        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                          {msg.cards.slice(0, 4).map((card: any, i: number) => (
                            <div
                              key={i}
                              className="flex-shrink-0 w-32 rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-purple-500/40 transition-colors"
                              style={{ background: "rgba(255,255,255,0.06)" }}
                              onClick={() => navigate(`/marketplace/listings/${card.listing_id || card.id}`)}
                            >
                              {card.image_url && <img src={card.image_url} alt={card.title} className="w-full h-20 object-cover" />}
                              <div className="p-2">
                                <p className="text-white text-[11px] font-bold leading-tight line-clamp-2">{card.title}</p>
                                <p className="text-purple-300 text-[11px] font-bold mt-1">KES {Number(card.price).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="flex-shrink-0 px-4 py-3 border-t border-white/10"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-center gap-2 rounded-2xl border border-white/15 focus-within:border-purple-500/50 transition-colors px-4 py-2.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask Sparkly anything..."
                  className="flex-1 bg-transparent text-white placeholder-white/30 text-[14px] outline-none"
                  disabled={isThinking}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputText.trim() || isThinking}
                  className="w-8 h-8 rounded-full bg-purple-600 disabled:opacity-40 flex items-center justify-center hover:bg-purple-500 active:scale-95 transition-all disabled:cursor-not-allowed flex-shrink-0"
                >
                  {isThinking ? <Loader2 size={14} className="text-white animate-spin" /> : <Send size={14} className="text-white" />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
