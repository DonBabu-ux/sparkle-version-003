import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Search, Smile, Sparkles, ArrowLeft, Clock, Zap, X, Send, Mic, Paperclip, Ban } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { useUserStore } from '../../store/userStore';
import { showError, showInfo } from '../../utils/toast';
import { logger } from '../../utils/logger';
import api from '../../api/api';
import EMOJIS from './emojis';
import { ReplyPreview } from './ReplyPreview';
import LiveRecordingBar from './LiveRecordingBar';
import { ChatInputDock } from '../SafeLayout';
import { OfficialComposerFooter } from './OfficialComposerFooter';
import { fetchGiphyItems } from '../../utils/giphyClient';
import Spinner from '../ui/Spinner';
import { voiceRecordingService } from '../../services/VoiceRecordingService';

/**
 * The composer: text entry, the emoji/GIF/sticker picker, voice-note capture,
 * and the blocked / system-account variants of the dock.
 *
 * Extracted from pages/Messages.tsx. Its state lives in the chat store (draft,
 * edit target, reply target) rather than here, so it can be unmounted and
 * remounted without losing what the user typed.
 */
export interface ChatInputProps {
  onTyping: (value: string) => void;
  onSend: (...args: any[]) => void;
  selectedChat: any;
  sending: boolean;
  setShowAttachmentMenu: (open: boolean) => void;
  onVoiceSend?: (file: File, durationSeconds: number, source: 'recorded_voice_note' | 'device_audio_attachment') => void;
  theme: any;
  replyToMessage: any;
  onOpenDisappearingSettings: () => void;
  // Accepted by the call site but not read — kept optional so narrowing the
  // props does not surface as a new type error at the call site.
  initialMessage?: string;
  isMenuCollapsed?: boolean;
  setIsMenuCollapsed?: (collapsed: boolean) => void;
  showAttachmentMenu?: boolean;
}

const ChatInput = memo(({ onTyping, onSend, selectedChat, sending, setShowAttachmentMenu, onVoiceSend, theme, replyToMessage, onOpenDisappearingSettings }: ChatInputProps) => {
  const drafts = useChatStore(state => state.drafts);
  const setDraft = useChatStore(state => state.setDraft);
  const localMessage = selectedChat ? (drafts[selectedChat.chat_id] || '') : '';
  const isTyping = Boolean(localMessage.length > 0);

  const setLocalMessage = useCallback((updater: string | ((prev: string) => string)) => {
    if (!selectedChat) return;
    const current = drafts[selectedChat.chat_id] || '';
    const nextVal = typeof updater === 'function' ? updater(current) : updater;
    setDraft(selectedChat.chat_id, nextVal);
    onTyping(nextVal);
  }, [selectedChat, drafts, setDraft, onTyping]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers' | 'gifs' | 'avatars'>('emojis');
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [loadingGiphy, setLoadingGiphy] = useState(false);

  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editing = useChatStore(state => state.editing);

  useEffect(() => {
    if (editing.messageId && editing.chatId === selectedChat?.chat_id) {
      inputRef.current?.focus();
    }
  }, [editing.messageId, editing.chatId, selectedChat?.chat_id]);

  // Editing window: the server allows edits only within 15 minutes of send.
  // Show the remaining time and auto-close the composer when it runs out.
  const editingSentAt = useChatStore(state => {
    if (!editing.messageId || !editing.chatId) return null;
    const m = state.messagesByConversation[editing.chatId]?.find(
      (x: any) => (x.message_id || x.id) === editing.messageId
    );
    return m?.sent_at || null;
  });
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!editing.messageId) return;
    const t = setInterval(() => setNowTick(Date.now()), 20000);
    return () => clearInterval(t);
  }, [editing.messageId]);
  const editMinutesLeft = editingSentAt
    ? Math.max(0, 15 - Math.floor((nowTick - new Date(editingSentAt).getTime()) / 60000))
    : null;
  useEffect(() => {
    if (!editing.messageId || editMinutesLeft === null || editMinutesLeft > 0) return;
    const chatId = editing.chatId;
    useChatStore.getState().finishEdit(chatId);
    showInfo('Editing window expired — messages can only be edited within 15 minutes');
  }, [editMinutesLeft, editing.messageId, editing.chatId]);

  const startMicRecording = useCallback(() => {
    if (recordingSessionId) return;

    const sessionId = crypto.randomUUID();
    setRecordingSessionId(sessionId);

    voiceRecordingService.start(sessionId).catch((err: any) => {
      logger.error('[ChatInput] Microphone access failed:', err);
      if (voiceRecordingService.getCurrentSessionId() === sessionId) {
        setRecordingSessionId(null);
        showError('Microphone access is required to record voice notes.');
      }
    });
  }, [recordingSessionId]);

  const handleDiscardRecording = useCallback(() => {
    const currentId = recordingSessionId;
    setRecordingSessionId(null);

    if (currentId) {
      voiceRecordingService.cancel(currentId);
    }
  }, [recordingSessionId]);

  const handleFinishAndSendRecording = useCallback(async () => {
    const currentId = recordingSessionId;
    if (!currentId) return;

    setRecordingSessionId(null);

    const result = await voiceRecordingService.stop(currentId);
    if (!result || !result.file) return;

    if (result.duration < 0.8) {
      logger.log('[ChatInput] Voice note too short (<0.8s), discarded');
      return;
    }

    if (onVoiceSend) {
      onVoiceSend(result.file, result.duration, 'recorded_voice_note');
    }
  }, [recordingSessionId, onVoiceSend]);

  const fetchGiphy = useCallback(async (type: 'gifs' | 'stickers', query?: string) => {
    setLoadingGiphy(true);
    try {
      const items = await fetchGiphyItems({
        type,
        endpoint: query ? 'search' : 'trending',
        q: query || undefined,
        limit: 20,
      });
      setGiphyResults(items);
    } catch (err) {
      logger.error('Giphy error', err);
    } finally {
      setLoadingGiphy(false);
    }
  }, []);

  useEffect(() => {
    if (showEmojiPicker && (pickerTab === 'gifs' || pickerTab === 'stickers')) {
      fetchGiphy(pickerTab === 'gifs' ? 'gifs' : 'stickers', giphySearch);
    }
  }, [showEmojiPicker, pickerTab, giphySearch, fetchGiphy]);

  const themePrimary = theme?.colors?.primary || '#ff1493';
  // Mode-aware: the dock must follow the app's light/dark state, not paint the
  // theme's dark background in light mode (that produced a black bar with
  // invisible icons). Falls back to the app shell tokens per mode.
  const themeMode = useUserStore(s => s.theme);
  const themeBg = (themeMode === 'dark'
    ? theme?.colors?.backgroundDark
    : theme?.colors?.backgroundLight) || (themeMode === 'dark' ? '#18181b' : '#f8e7ed');

  const isBlocked = Boolean(selectedChat?.is_blocked || selectedChat?.conversation_status === 'blocked' || selectedChat?.can_send_messages === false);
  const isBlockedByMe = Boolean(selectedChat?.is_blocked_by_me);

  if (isBlocked) {
    return (
      <ChatInputDock className="z-30 shrink-0 border-t border-[#e6d8e1] dark:border-white/10 transition-all duration-300" backgroundColor={themeBg}>
        <div className="w-full max-w-[1200px] mx-auto py-5 px-6 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-red-500/10 text-red-500 mb-2 shadow-sm border border-red-500/20">
            <Ban size={22} strokeWidth={2.5} />
          </div>
        <h3 className="text-sm font-semibold text-[#18181b] dark:text-white mb-1 tracking-tight">
          {isBlockedByMe ? 'You blocked this user' : 'Messaging is blocked'}
        </h3>
        <p className="text-xs font-medium text-slate-600 dark:text-zinc-300 max-w-sm mx-auto mb-3 leading-relaxed">
            {isBlockedByMe
              ? 'Messaging is unavailable while this user is blocked.'
              : 'Messages cannot be sent in this conversation.'}
          </p>
          {isBlockedByMe && selectedChat?.partner_id && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.delete(`/users/block/${selectedChat.partner_id}`);
                  useChatStore.getState().setConversationBlockState(selectedChat.chat_id, {
                    is_blocked: false,
                    is_blocked_by_me: false,
                    am_i_blocked: false,
                    conversation_status: 'active',
                    can_send_messages: true
                  });
                } catch (err) {
                  logger.error('Failed to unblock user:', err);
                }
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs transition-all active:scale-95 border border-red-500/30 shadow-md"
            >
              Unblock User
            </button>
          )}
        </div>
      </ChatInputDock>
    );
  }

  if (selectedChat?.account_type === 'system' || selectedChat?.conversation_type === 'system' || selectedChat?.is_system_account || selectedChat?.is_system || selectedChat?.partner_id === 'd75fe3b5-7a45-4581-ab13-91934d8b54de') {
    return (
      <ChatInputDock className="z-30 shrink-0 border-t border-[#e6d8e1] dark:border-slate-800 transition-all duration-300" backgroundColor={themeBg}>
        <OfficialComposerFooter />
      </ChatInputDock>
    );
  }

  

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (selectedChat) {
      setDraft(selectedChat.chat_id, val);
    }
    // Auto-grow the composer up to ~5 lines
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    onTyping(val);
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME composition guard — never send half-composed CJK text
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!localMessage.trim() || sending) return;
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localMessage.trim() && !sending) return;
    onSend(e, localMessage);
  };

  return (
    <ChatInputDock className="z-30 shrink-0 border-t border-[#ede3e9] dark:border-white/5 transition-all duration-300" backgroundColor={themeBg}>
      <div className="w-full max-w-[1200px] mx-auto">
        {editing.messageId && editing.chatId === selectedChat?.chat_id && (
          <div className="flex items-center justify-between gap-2 p-2 bg-white/5 border-b border-white/5 px-4 text-xs text-white/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-[#ff1493] shrink-0">
                Editing message{editMinutesLeft !== null ? ` · ${editMinutesLeft}m left` : ''}…
              </span>
              <span className="truncate">"{editing.originalContent}"</span>
            </div>
            <button
              onClick={() => useChatStore.getState().finishEdit(selectedChat.chat_id)}
              className="p-1 hover:text-white shrink-0"
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {replyToMessage && (
          <ReplyPreview
            onClear={() => {
              if (selectedChat) {
                useChatStore.getState().setReplyTarget(selectedChat.chat_id, undefined);
              }
            }}
            messageId={replyToMessage.message_id}
            message={replyToMessage}
            chatId={selectedChat?.chat_id}
            onNavigateToMessage={(id) => {
              const el = document.getElementById(`msg-${id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-purple-400', 'bg-purple-500/20');
                setTimeout(() => el.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-500/20'), 1500);
              }
            }}
          />
        )}
        {recordingSessionId ? (
          <LiveRecordingBar
            sessionId={recordingSessionId}
            onDiscard={handleDiscardRecording}
            onSend={handleFinishAndSendRecording}
          />
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center w-full max-w-[1200px] mx-auto px-1 py-2 relative gap-1.5">
            {/* Native @ / Sparkle Mention Suggestion Popup */}
            <AnimatePresence>
              {(() => {
                const isAtTrigger = /@(?:s|sp|spar|spark|sparkle|sparkly)?$/i.test(localMessage);
                const isKeywordTrigger = /(^|\s)sparkl(?:y|e)\b/i.test(localMessage) && !/@sparkl(?:y|e)\b/i.test(localMessage);
                const showPopup = isAtTrigger || isKeywordTrigger;

                if (!showPopup) return null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute bottom-full left-4 mb-2 z-50 bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-2.5 shadow-2xl shadow-purple-950/50 flex items-center gap-3 cursor-pointer hover:border-purple-400/70 transition-all group"
                    onClick={() => {
                      let updated = localMessage;
                      if (isAtTrigger) {
                        updated = localMessage.replace(/@(?:s|sp|spar|spark|sparkle|sparkly)?$/i, '@sparkle ');
                      } else if (isKeywordTrigger) {
                        if (/^\s*sparkl(?:y|e)\b/i.test(localMessage)) {
                          updated = localMessage.replace(/^\s*sparkl(?:y|e)\b\s*/i, '@sparkle ');
                        } else {
                          updated = '@sparkle ' + localMessage.replace(/(^|\s)sparkl(?:y|e)\b/i, '$1').trim();
                        }
                      }
                      if (selectedChat) {
                        setDraft(selectedChat.chat_id, updated);
                      }
                      onTyping(updated);
                      inputRef.current?.focus();
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white leading-tight">Sparkly AI</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Ask Sparkly</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium leading-tight">
                        {isKeywordTrigger ? 'Tap to authorize Sparkly AI request' : 'Tap to ask questions or search Marketplace'}
                      </span>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Left Action Icons: Plus (+), Camera (📷), Files (📎) — Visible ONLY when NOT typing */}
            <AnimatePresence initial={false}>
              {!isTyping && (
                <motion.div
                  key="composer-left-actions"
                  initial={{ opacity: 0, width: 0, scale: 0.8 }}
                  animate={{ opacity: 1, width: 'auto', scale: 1 }}
                  exit={{ opacity: 0, width: 0, scale: 0.8 }}
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  className="flex items-center gap-0.5 shrink-0 overflow-hidden"
                >
                  {/* Attach — single WhatsApp-style paperclip. The attachment
                      sheet (gallery / camera / document / audio / location)
                      lives behind this one control. */}
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu(true)}
                    className="w-9 h-9 flex items-center justify-center text-white/75 hover:text-white active:scale-90 transition-all shrink-0"
                    title="Attach"
                    aria-label="Attach"
                  >
                    <Paperclip size={20} strokeWidth={2.2} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area — Naturally expands as left icons collapse */}
            {/* Dotted border signals disappearing messages are active */}
            <div className={clsx(
              "flex-1 flex items-end bg-[#f6eef3] dark:bg-white/5 rounded-3xl px-4 py-2 mx-1 transition-all duration-300 min-w-0 relative",
              selectedChat?.disappearing_duration > 0
                ? "border-2 border-dashed border-[#ff1493]/70 shadow-[0_0_10px_rgba(255,20,147,0.18)]"
                : "border border-[#e6d8e1] dark:border-white/10"
            )}>
              {selectedChat?.disappearing_duration > 0 && (
                <button
                  type="button"
                  onClick={onOpenDisappearingSettings}
                  className="mr-2 mb-1 shrink-0 flex items-center justify-center cursor-pointer text-[#ff1493] hover:opacity-80 transition-transform active:scale-95"
                  title="Disappearing messages active — tap to change"
                >
                  <Clock size={16} className="text-[#ff1493] animate-pulse" />
                </button>
              )}
              <textarea
                ref={inputRef}
                rows={1}
                value={localMessage}
                onChange={handleChange}
                onKeyDown={handleComposerKeyDown}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder={editing.messageId && editing.chatId === selectedChat?.chat_id ? "Editing message…" : "Type a message..."}
                className="flex-1 bg-transparent text-[15px] font-medium chat-input-text placeholder:text-slate-600 dark:placeholder:text-white/20 outline-none border-none focus:ring-0 p-0 m-0 shadow-none caret-[#18181b] dark:caret-white resize-none max-h-[120px] overflow-y-auto no-scrollbar leading-snug"
                autoComplete="off"
                aria-label="Message text"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                aria-label={showEmojiPicker ? 'Close emoji picker' : 'Open emoji picker'}
                className={clsx(
                  "transition-all ml-2 shrink-0 mb-0.5",
                  showEmojiPicker ? "text-[#ff1493] scale-110" : "text-white/20 hover:text-white"
                )}
              >
                <Smile size={20} strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex items-center shrink-0 mr-1 gap-1">
              {localMessage.trim() ? (
                <button
                  type="submit"
                  disabled={sending}
                  aria-label="Send message"
                  className="p-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: themePrimary, color: '#ffffff' }}
                >
                  <Send size={18} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startMicRecording}
                  style={{ backgroundColor: themePrimary }}
                  className="p-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center text-white"
                  title="Record Voice Note"
                  aria-label="Record voice note"
                >
                  <Mic size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </form>
        )}

        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 360, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full overflow-hidden flex flex-col rounded-none"
              style={{ backgroundColor: themeBg }}
            >
              {/* Reference Header */}
              <div className="flex items-center px-4 py-2 gap-3 shrink-0 border-b border-[#e6d8e1] dark:border-white/5">
                <button type="button" onClick={() => setShowEmojiPicker(false)} className="text-slate-600 dark:text-white/60 hover:text-[#18181b] dark:hover:text-white p-1"><ArrowLeft size={20} /></button>
                <div className="flex-1 h-9 bg-[#e6d8e1] dark:bg-white/10 rounded-full flex items-center px-4 border border-[#e6d8e1] dark:border-white/5 focus-within:border-[#e6d8e1] dark:border-white/20 transition-all">
                  <Search size={14} className="text-slate-600 dark:text-white/40 mr-2" />
                  <input
                    placeholder="Search"
                    value={giphySearch}
                    onChange={e => setGiphySearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full text-[#18181b] dark:text-white/90 placeholder:text-slate-500 dark:placeholder:text-slate-600 dark:text-white/20"
                  />
                </div>
                <div className="flex items-center gap-4 text-slate-600 dark:text-white/40 ml-1">
                  <button type="button" onClick={() => setPickerTab('emojis')} className={clsx("hover:text-[#18181b] dark:hover:text-white transition-colors", pickerTab === 'emojis' ? 'text-white' : '')}><Clock size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('emojis')} className={clsx("hover:text-[#18181b] dark:hover:text-white transition-colors", pickerTab === 'emojis' ? 'text-white' : '')}><Smile size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('gifs')} className={clsx("hover:text-[#18181b] dark:hover:text-white transition-colors", pickerTab === 'gifs' ? 'text-white' : '')}><Zap size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('stickers')} className={clsx("hover:text-[#18181b] dark:hover:text-white transition-colors", pickerTab === 'stickers' ? 'text-white' : '')}><Sparkles size={20} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {pickerTab === 'emojis' ? (
                  <div className="h-full overflow-y-auto no-scrollbar px-3 py-4 space-y-6">
                    {Object.entries(EMOJIS).map(([category, list]) => (
                      <div key={category} className="space-y-3">
                        <h5 className="text-[11px] min-h-[30px] flex items-center font-semibold text-slate-600 dark:text-white/30 uppercase tracking-[2px] px-1">{category}</h5>
                        <div className="grid grid-cols-8 sm:grid-cols-9 gap-y-4 max-w-[640px] mx-auto w-full">
                          {Array.from(new Set(list)).map((emoji, idx) => (
                            <button
                              key={`${category}-${emoji}-${idx}`}
                              type="button"
                              onClick={() => setLocalMessage(prev => prev + emoji)}
                              className="text-[26px] flex items-center justify-center hover:scale-120 active:scale-90 transition-all"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : pickerTab === 'gifs' ? (
                  <div className="h-full overflow-y-auto no-scrollbar grid grid-cols-2 gap-x-3 gap-y-4 p-3 content-start">
                    {loadingGiphy ? (
                      <div className="col-span-2 h-full flex flex-col items-center justify-center py-20 gap-3">
                        <Spinner size="large" color="#ff1493" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-white/20 uppercase tracking-widest">Loading GIFs...</span>
                      </div>
                    ) : giphyResults.map((item: any) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative h-[110px] bg-[#f6eef3] dark:bg-white/5 border border-[#e6d8e1] dark:border-white/5 overflow-hidden cursor-pointer shadow-md"
                        onClick={() => {
                          onSend(null, 'GIF', 'gif', item.images.fixed_height.url);
                          setShowEmojiPicker(false);
                        }}
                      >
                        <img src={item.images.fixed_height.url} className="w-full h-full object-cover" alt="" />
                      </motion.div>
                    ))}
                  </div>
                ) : pickerTab === 'stickers' ? (
                  <div className="h-full overflow-y-auto no-scrollbar grid grid-cols-3 gap-x-3 gap-y-4 p-3 content-start">
                    {loadingGiphy ? (
                      <div className="col-span-3 h-full flex flex-col items-center justify-center py-20 gap-3">
                        <Spinner size="large" color="#ff1493" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-white/20 uppercase tracking-widest">Loading Stickers...</span>
                      </div>
                    ) : giphyResults.map((item: any) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="relative h-[100px] flex items-center justify-center bg-[#f6eef3] dark:bg-white/5 border border-[#e6d8e1] dark:border-white/5 overflow-hidden cursor-pointer p-1"
                        onClick={() => {
                          onSend(null, 'Sticker', 'sticker', item.images.fixed_height.url);
                          setShowEmojiPicker(false);
                        }}
                      >
                        <img src={item.images.fixed_height.url} className="w-full h-full object-contain" alt="" />
                      </motion.div>
                    ))}
                  </div>
                ) : null
                }
              </div>

              {/* Reference Bottom Bar */}
              <div className="h-14 border-t border-[#e6d8e1] dark:border-white/5 flex items-center justify-between px-6 shrink-0" style={{ backgroundColor: 'rgba(24,24,27,0.04)' }}>
                <button type="button" onClick={() => setShowEmojiPicker(false)} className="text-xs font-semibold text-slate-600 dark:text-white/40 hover:text-[#18181b] dark:hover:text-white transition-colors">ABC</button>
                <div className="flex items-center gap-8">
                  <button type="button" onClick={() => setPickerTab('emojis')} className={clsx("p-2 rounded-xl transition-all", pickerTab === 'emojis' ? "bg-[#e6d8e1] dark:bg-white/20 text-[#18181b] dark:text-white scale-110 shadow-lg" : "text-slate-600 dark:text-white/40 hover:text-[#18181b] dark:hover:text-white")}><Smile size={20} /></button>
                  <button type="button" onClick={() => setPickerTab('gifs')} className={clsx("text-[11px] font-semibold px-2.5 py-1 border-2 rounded-lg transition-all", pickerTab === 'gifs' ? "border-[#ff1493] text-[#18181b] dark:text-white scale-110 shadow-lg" : "border-[#e6d8e1] dark:border-white/20 text-slate-600 dark:text-white/40 hover:border-[#ff1493]/60 dark:border-white/40")}>GIF</button>
                  <button type="button" onClick={() => setPickerTab('stickers')} className={clsx("p-2 rounded-xl transition-all", pickerTab === 'stickers' ? "bg-[#e6d8e1] dark:bg-white/20 text-[#18181b] dark:text-white scale-110 shadow-lg" : "text-slate-600 dark:text-white/40 hover:text-[#18181b] dark:hover:text-white")}><Sparkles size={20} /></button>
                  <button type="button" onClick={() => setLocalMessage(prev => prev + ':-)')} className="text-xs font-semibold text-slate-600 dark:text-white/40 hover:text-[#18181b] dark:hover:text-white transition-colors">:-)</button>
                </div>
                <button type="button" onClick={() => setLocalMessage(prev => Array.from(prev).slice(0, -1).join(''))} className="text-slate-600 dark:text-white/30 hover:text-[#18181b] dark:hover:text-white p-3 active:scale-90"><X size={20} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </ChatInputDock>
  );
});

export default ChatInput;
