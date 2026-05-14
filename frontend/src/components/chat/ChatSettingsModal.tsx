import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, Bell, Users, Image as ImageIcon, Pin, Volume2, 
  Download, Share2, Clock, Eye, MoreHorizontal, Shield, Lock, 
  MinusCircle, ShieldAlert, AlertTriangle, Trash2, ChevronLeft,
  Palette, MessageCircle, Smile, ImagePlus, User, Edit3, Check, Sparkles, Send, Settings, Wand2
} from 'lucide-react';
import { getAvatarUrl } from '../../utils/imageUtils';
import { useThemeStore, PRESET_THEMES, type SparkleTheme } from '../../store/themeStore';
import { clsx } from 'clsx';

interface ChatSettingsModalProps {
  chat: any;
  onClose: () => void;
  onNavigateProfile?: () => void;
}

const EMOJIS = ['👍','😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🫣','🤭','🫢','🫡','🤫','🫠','🤥','😶','🫥','😐','🫤','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😮‍💨','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'];

const MEMOJIS = [
  'https://i.pravatar.cc/100?img=1',
  'https://i.pravatar.cc/100?img=2',
  'https://i.pravatar.cc/100?img=3',
  'https://i.pravatar.cc/100?img=4',
  'https://i.pravatar.cc/100?img=5',
  'https://i.pravatar.cc/100?img=6',
  'https://i.pravatar.cc/100?img=7',
  'https://i.pravatar.cc/100?img=8',
  'https://i.pravatar.cc/100?img=9',
];

const PREVIEW_MESSAGES = [
  { text: "Hey! Did you see the new themes?", isMe: false },
  { text: "Yes! They look absolutely incredible ✨", isMe: true },
  { text: "I'm testing out the animations right now.", isMe: false },
  { text: "Everything feels so smooth!", isMe: true }
];

export default function ChatSettingsModal({ chat, onClose, onNavigateProfile }: ChatSettingsModalProps) {
  const [view, setView] = useState<'main' | 'customize' | 'preview_theme' | 'ai_generator' | 'custom_photo'>('main');
  const [customizeTab, setCustomizeTab] = useState<'themes' | 'reaction' | 'words'>('themes');
  const [wordInput, setWordInput] = useState('');
  const [wordEmoji, setWordEmoji] = useState('✨');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [blurValue, setBlurValue] = useState(20);
  const [darknessValue, setDarknessValue] = useState(40);
  const [transparencyValue, setTransparencyValue] = useState(80);

  // Theming state
  const { setThemeForChat, getThemeForChat, getQuickReaction, setQuickReaction, addWordEffect, removeWordEffect, getWordEffects } = useThemeStore();
  const currentTheme = getThemeForChat(chat.chat_id || chat.id);
  const quickReaction = getQuickReaction(chat.chat_id || chat.id);
  const wordEffects = getWordEffects(chat.chat_id || chat.id);
  
  const [previewTheme, setPreviewTheme] = useState<SparkleTheme | null>(null);

  // Group themes by category
  const categories = useMemo(() => {
    const cats = new Set(PRESET_THEMES.map(t => t.category));
    return Array.from(cats).map(cat => ({
      name: cat,
      themes: PRESET_THEMES.filter(t => t.category === cat)
    }));
  }, []);

  const handleApplyTheme = () => {
    if (previewTheme) {
      setThemeForChat(chat.chat_id || chat.id, previewTheme);
      setView('main');
    }
  };

  const handleSaveWordEffect = () => {
    if (wordInput.trim()) {
      addWordEffect(chat.chat_id || chat.id, wordInput.trim(), wordEmoji);
      setWordInput('');
    }
  };

  const handleDeleteWordEffect = (effectId: string) => {
    removeWordEffect(chat.chat_id || chat.id, effectId);
  };

  const handleApplyReaction = (emoji: string) => {
    setQuickReaction(chat.chat_id || chat.id, emoji);
    setView('main');
  };

  return (
    <div className="fixed inset-0 bg-[#000000] z-[200] flex justify-center animate-fade-in">
      <div 
        className="w-full max-w-3xl h-full flex flex-col overflow-hidden bg-[#000000] relative" 
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {view === 'main' ? (
            <motion.div key="main" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full overflow-y-auto no-scrollbar pb-10">
              <div className="p-4 flex items-center justify-between sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={onClose} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><MoreHorizontal size={24} /></button>
              </div>

              <div className="flex flex-col items-center mt-2 px-6">
                <div className="relative mb-4">
                  <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-lg" alt="" />
                  {chat.partner_online && <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-[3px] border-black rounded-full flex items-center justify-center"><span className="text-[8px] font-bold text-black">9m</span></div>}
                </div>
                <h2 className="text-2xl font-bold text-white mb-6">{chat.partner_name}</h2>

                <div className="flex gap-6 mb-8 w-full justify-center">
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={onNavigateProfile}>
                    <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors"><User size={20} className="text-white" /></div>
                    <span className="text-xs font-medium text-white/70 group-hover:text-white">Profile</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors"><Edit3 size={20} className="text-white" /></div>
                    <span className="text-xs font-medium text-white/70 group-hover:text-white">Nicknames</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors"><Search size={20} className="text-white" /></div>
                    <span className="text-xs font-medium text-white/70 group-hover:text-white">Search</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setView('customize')}>
                    <div className="w-12 h-12 rounded-lg bg-[#ff1493]/20 group-hover:bg-[#ff1493]/30 flex items-center justify-center transition-all border border-[#ff1493]/30 group-hover:scale-110 active:scale-95 shadow-[0_0_15px_rgba(255,20,147,0.2)]"><Palette size={20} className="text-[#ff1493]" /></div>
                    <span className="text-xs font-bold text-[#ff1493] group-hover:text-[#ff1493]/80">Customize</span>
                  </div>
                </div>
              </div>

              <div className="px-4">
                <Section title="Chat info">
                  <ActionItem icon={ImageIcon} label="View media, files & links" />
                  <ActionItem icon={Pin} label="Pinned messages" />
                </Section>

                <Section title="Actions">
                  <ActionItem icon={Bell} label={`Mute ${chat.partner_name.split(' ')[0]}`} />
                  <ActionItem icon={Volume2} label="Notifications & sounds" subtext="On" />
                  <ActionItem icon={Users} label={`Create group chat with ${chat.partner_name.split(' ')[0]}`} />
                  <ActionItem icon={Download} label="Auto-save photos" />
                  <ActionItem icon={Share2} label="Share contact" />
                </Section>

                <Section title="Privacy & support">
                  <ActionItem icon={Clock} label="Disappearing messages" subtext="Off" />
                  <ActionItem icon={Eye} label="Read receipts" subtext="On" />
                  <ActionItem icon={MoreHorizontal} label="Typing indicator" subtext="On" />
                  <ActionItem icon={Shield} label="Message permissions" />
                  <ActionItem icon={Lock} label="End-to-end encryption" subtext="This chat is end-to-end encrypted" />
                  <ActionItem icon={MinusCircle} label="Block" />
                  <ActionItem icon={ShieldAlert} label="Restrict" />
                  <ActionItem icon={AlertTriangle} label="Report" subtext="Give feedback and report conversation" />
                  <ActionItem icon={Trash2} label="Delete chat" danger />
                </Section>
              </div>
            </motion.div>
          ) : view === 'customize' ? (
            <motion.div key="customize" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('main')} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Customize</h2>
              </div>

              <div className="flex justify-center gap-2 p-4 border-b border-white/5">
                <TabButton active={customizeTab === 'themes'} onClick={() => setCustomizeTab('themes')}>Themes</TabButton>
                <TabButton active={customizeTab === 'reaction'} onClick={() => setCustomizeTab('reaction')}>Quick reaction</TabButton>
                <TabButton active={customizeTab === 'words'} onClick={() => setCustomizeTab('words')}>Word effects</TabButton>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                {customizeTab === 'themes' && (
                  <div className="p-4">
                    <div className="flex gap-3 mb-6">
                      <button onClick={() => setView('ai_generator')} className="flex-1 bg-white/10 hover:bg-white/20 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-white/90 text-[13px] font-bold transition-all border border-purple-500/30 active:scale-95">
                        <Wand2 size={18} className="text-purple-400" /> AI Themes
                      </button>
                      <button onClick={() => setView('custom_photo')} className="flex-1 bg-white/10 hover:bg-white/20 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-white/90 text-[13px] font-bold transition-all border border-blue-500/30 active:scale-95">
                        <ImagePlus size={18} className="text-blue-400" /> Upload Image
                      </button>
                    </div>
                    
                    {categories.map((cat) => (
                      <div key={cat.name} className="mb-8">
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 px-1">{cat.name}</h3>
                        <div className="grid grid-cols-3 gap-3">
                          {cat.themes.map((theme) => (
                            <div 
                              key={theme.id} 
                              className="flex flex-col gap-2 cursor-pointer group"
                              onClick={() => {
                                setPreviewTheme(theme);
                                setView('preview_theme');
                              }}
                            >
                              <div className={clsx(
                                "relative aspect-[2/3] rounded-2xl overflow-hidden transition-all group-hover:scale-105 group-active:scale-95 border-2",
                                currentTheme?.id === theme.id ? "border-[#ff1493] shadow-[0_0_15px_rgba(255,20,147,0.3)]" : "border-white/10 group-hover:border-white/30"
                              )}>
                                {theme.wallpaperUrl ? (
                                  <img src={theme.wallpaperUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${theme.colors.backgroundDark}, ${theme.colors.backgroundLight})` }} />
                                )}
                                <div className="absolute inset-x-0 bottom-0 p-2 flex justify-end">
                                  <div className="w-6 h-6 rounded-full border-2 border-white/20" style={{ background: theme.colors.chatBubbleSent }} />
                                </div>
                                {currentTheme?.id === theme.id && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                    <div className="w-8 h-8 bg-[#ff1493] rounded-full flex items-center justify-center text-white shadow-lg">
                                      <Check size={16} strokeWidth={3} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className={clsx("text-[11px] font-semibold text-center line-clamp-1 px-1", currentTheme?.id === theme.id ? "text-[#ff1493]" : "text-white/80")}>{theme.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customizeTab === 'reaction' && (
                  <div className="flex flex-col h-full bg-[#000000]">
                    {/* Top Half: Preview Area */}
                    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white/5 to-transparent border-b border-white/5 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                      
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="text-7xl mb-8 animate-bounce drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                          {quickReaction}
                        </div>
                        
                        <div className="flex -space-x-4 mb-4">
                          {MEMOJIS.slice(0, 6).map((img, i) => (
                            <motion.div 
                              key={i}
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: i * 0.1 }}
                              className="relative"
                            >
                              <img src={img} className="w-14 h-14 rounded-full border-4 border-[#000000] object-cover" alt="" />
                              <div className="absolute -bottom-1 -right-1 text-lg bg-[#121212] rounded-full p-0.5 shadow-lg border border-white/10">
                                {quickReaction}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        <p className="text-sm font-bold text-white/50">Friends will react with {quickReaction}</p>
                      </div>
                    </div>

                    {/* Bottom Half: Emoji Grid */}
                    <div className="flex-[1.5] p-4 overflow-y-auto no-scrollbar bg-[#0a0a0a]">
                      <div className="bg-white/10 rounded-2xl flex items-center px-4 h-12 mb-6 border border-white/5 focus-within:bg-white/15 focus-within:border-white/30 transition-all">
                        <Search size={20} className="text-white/40" />
                        <input type="text" placeholder="Search emojis" className="bg-transparent w-full ml-3 text-white placeholder:text-white/40 outline-none text-sm font-medium" />
                      </div>

                      <div className="grid grid-cols-6 sm:grid-cols-9 gap-4 px-2">
                        {EMOJIS.map((emoji, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleApplyReaction(emoji)} 
                            className={clsx(
                              "text-3xl hover:scale-125 transition-all flex items-center justify-center h-14 rounded-2xl",
                              quickReaction === emoji ? "bg-white/20 scale-110 shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20" : "hover:bg-white/5"
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {customizeTab === 'words' && (
                  <div className="flex flex-col h-full relative">
                    <div className="p-8 flex-1 flex flex-col items-center">
                      <div className="w-16 h-16 bg-[#ff1493]/20 text-[#ff1493] rounded-full flex items-center justify-center mb-6 border border-[#ff1493]/30">
                        <Sparkles size={28} />
                      </div>
                      <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Add effects to your chat</h3>
                      <p className="text-sm text-white/60 mb-8 leading-relaxed text-center max-w-sm">
                        Pair words that have special meaning with fun effects. Everyone will see an animation whenever these words are used. <span className="text-blue-400 font-bold cursor-pointer hover:underline" onClick={() => alert('Word effects are synced across all your devices. Add up to 5 triggers per chat.')}>Learn more</span>
                      </p>
                      
                      <div className="w-full max-w-sm flex flex-col gap-3">
                        <AnimatePresence>
                          {wordEffects.map((effect) => (
                            <motion.div 
                              key={effect.id}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-2xl">{effect.emoji}</span>
                                <span className="text-white font-bold text-lg">{effect.word}</span>
                              </div>
                              <button onClick={() => handleDeleteWordEffect(effect.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-full">
                                <Trash2 size={18} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {customizeTab === 'words' && (
                <div className="p-4 bg-[#000000] border-t border-white/5 relative z-20">
                  <div className="bg-white/10 rounded-3xl flex items-center px-2 py-2 border border-white/5 focus-within:bg-white/15 focus-within:border-white/30 transition-all">
                    <button 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                      className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl hover:bg-white/20 transition-colors shrink-0"
                    >
                      {wordEmoji}
                    </button>
                    <input 
                      type="text" 
                      value={wordInput}
                      onChange={e => setWordInput(e.target.value)}
                      placeholder="Add a word or phrase" 
                      className="bg-transparent w-full ml-3 text-white placeholder:text-white/40 outline-none text-base font-medium" 
                      maxLength={30}
                    />
                    <button 
                      onClick={handleSaveWordEffect}
                      disabled={!wordInput.trim()}
                      className="w-12 h-12 bg-[#ff1493] text-white rounded-2xl flex items-center justify-center disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30 transition-all shrink-0 hover:scale-105 active:scale-95"
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                  </div>

                  {/* Inline Emoji Picker for Word Effects */}
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-4 right-4 mb-2 bg-[#1c1c1e] border border-white/10 rounded-3xl p-4 shadow-2xl z-30 h-64 overflow-y-auto no-scrollbar"
                      >
                        <div className="grid grid-cols-6 gap-2">
                          {EMOJIS.map((emoji) => (
                            <button 
                              key={emoji} 
                              onClick={() => { setWordEmoji(emoji); setShowEmojiPicker(false); }}
                              className="text-2xl p-2 hover:bg-white/10 rounded-xl transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ) : view === 'preview_theme' && previewTheme ? (
            <motion.div key="preview_theme" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full relative overflow-hidden bg-[#000000]">
              {/* Fake Live Background for Preview */}
              <div className="absolute inset-0 z-0">
                {!previewTheme.wallpaperUrl ? (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${previewTheme.colors.backgroundDark}, ${previewTheme.colors.backgroundLight})` }} />
                ) : (
                  <>
                    <div className="absolute inset-0" style={{ 
                      backgroundImage: `url(${previewTheme.wallpaperUrl})`, 
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      filter: `blur(${previewTheme.blurIntensity || 2}px)`, transform: 'scale(1.05)'
                    }} />
                    <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${(previewTheme.darknessOverlay ?? 40) / 100})` }} />
                  </>
                )}
                <LiveAnimations type={previewTheme.animationType} />
              </div>

              {/* Fake Chat Header */}
              <header className="h-[60px] bg-black/40 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('customize')} className="text-white p-2"><ChevronLeft size={24} /></button>
                  <img src={getAvatarUrl(chat.partner_avatar, chat.partner_name)} className="w-[36px] h-[36px] rounded-full object-cover" />
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">{chat.partner_name}</h3>
                    <p className="text-[10px] text-emerald-400 font-bold">Previewing Theme</p>
                  </div>
                </div>
              </header>

              {/* Fake Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10 flex flex-col justify-end pb-8">
                {PREVIEW_MESSAGES.map((msg, idx) => (
                  <div key={idx} className={clsx("flex", msg.isMe ? "justify-end" : "justify-start")}>
                    <div 
                      className={clsx("px-4 py-2.5 rounded-2xl max-w-[75%] text-[15px] font-medium leading-relaxed shadow-sm", msg.isMe ? "rounded-br-sm" : "rounded-bl-sm")}
                      style={{ 
                        background: msg.isMe ? previewTheme.colors.chatBubbleSent : previewTheme.colors.chatBubbleReceived,
                        color: msg.isMe ? previewTheme.colors.chatBubbleSentText : previewTheme.colors.chatBubbleReceivedText,
                        border: msg.isMe ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fake Input */}
              <div className="p-4 z-10 bg-black/40 backdrop-blur-xl border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 rounded-full bg-white/10 border border-white/10 px-4 flex items-center">
                    <span className="text-white/40 text-sm">Message...</span>
                  </div>
                  <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: previewTheme.colors.primary }}>
                    <Send size={20} />
                  </button>
                </div>
              </div>

              {/* Apply Bar */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-[#000000] z-20 flex gap-4 pb-safe">
                <button onClick={() => setView('customize')} className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-bold text-sm">Cancel</button>
                <button onClick={handleApplyTheme} className="flex-[2] py-4 rounded-2xl bg-[#ff1493] text-white font-bold text-sm shadow-[0_0_20px_rgba(255,20,147,0.4)]">Apply Theme</button>
              </div>
            </motion.div>
          ) : view === 'ai_generator' ? (
            <motion.div key="ai_generator" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('customize')} className="p-2 text-white"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Generate Theme with AI</h2>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                <Wand2 size={48} className="text-purple-500 mb-6" />
                <h3 className="text-2xl font-black text-white mb-2">Describe your vibe</h3>
                <p className="text-sm text-white/50 mb-8 max-w-sm">Type any concept, color, or mood, and AI will generate a complete theme.</p>
                
                <div className="w-full max-w-sm mb-6 relative">
                  <input 
                    type="text" 
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g., pink neon cyberpunk"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-5 text-white text-center font-bold focus:border-purple-500/50 transition-colors outline-none"
                  />
                </div>
                
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {['romantic roses', 'galaxy purple', 'sunset beach', 'dark minimalist'].map(p => (
                    <button key={p} onClick={() => setAiPrompt(p)} className="px-4 py-2 rounded-full bg-white/5 text-xs font-bold text-white/70 hover:bg-white/10 transition-colors">{p}</button>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    // Fake generation logic - creates a theme and shows preview
                    const mockGenerated: SparkleTheme = {
                      id: 'ai_' + Date.now(),
                      name: `AI: ${aiPrompt || 'Magic'}`,
                      category: 'AI Generated',
                      isDarkDefault: true,
                      animationType: 'particles',
                      wallpaperUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
                      colors: {
                        primary: '#a855f7', primary600: '#9333ea', primary400: '#c084fc',
                        backgroundDark: '#120024', backgroundLight: '#2a004a',
                        chatBubbleSent: '#9333ea', chatBubbleReceived: '#ffffff10',
                        chatBubbleSentText: '#ffffff', chatBubbleReceivedText: '#ffffff'
                      }
                    };
                    setPreviewTheme(mockGenerated);
                    setView('preview_theme');
                  }}
                  disabled={!aiPrompt.trim()}
                  className="w-full max-w-sm py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl text-white font-bold disabled:opacity-50"
                >
                  Generate Magic
                </button>
              </div>
            </motion.div>
          ) : view === 'custom_photo' ? (
            <motion.div key="custom_photo" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('customize')} className="p-2 text-white"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Custom Photo Editor</h2>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center overflow-y-auto no-scrollbar pb-24">
                <label className="w-full aspect-[2/3] max-w-[240px] bg-white/5 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-white/20 cursor-pointer hover:bg-white/10 transition-all overflow-hidden relative group mb-8">
                  {customPhoto ? (
                    <>
                      <img src={customPhoto} className="w-full h-full object-cover transition-all" style={{ filter: `blur(${blurValue/5}px)` }} alt="" />
                      <div className="absolute inset-0 transition-all" style={{ backgroundColor: `rgba(0,0,0,${darknessValue/100})` }} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 size={32} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <ImagePlus size={48} className="text-white/20 mb-4 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-bold text-white/40">Select from Gallery</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setCustomPhoto(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
                
                <div className="w-full max-w-sm space-y-8 px-2">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-bold text-white/60 tracking-wider">BLUR INTENSITY</span>
                      <span className="text-xs font-black text-[#ff1493]">{blurValue}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={blurValue} onChange={(e) => setBlurValue(Number(e.target.value))} className="w-full accent-[#ff1493] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-bold text-white/60 tracking-wider">DARKNESS OVERLAY</span>
                      <span className="text-xs font-black text-[#ff1493]">{darknessValue}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={darknessValue} onChange={(e) => setDarknessValue(Number(e.target.value))} className="w-full accent-[#ff1493] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-bold text-white/60 tracking-wider">BUBBLE TRANSPARENCY</span>
                      <span className="text-xs font-black text-[#ff1493]">{transparencyValue}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={transparencyValue} onChange={(e) => setTransparencyValue(Number(e.target.value))} className="w-full accent-[#ff1493] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                </div>

                {customPhoto && (
                  <button 
                    onClick={() => {
                      const customTheme: SparkleTheme = {
                        id: 'custom_' + Date.now(),
                        name: 'Custom Photo',
                        category: 'User Custom',
                        isDarkDefault: true,
                        wallpaperUrl: customPhoto,
                        blurIntensity: blurValue / 5,
                        darknessOverlay: darknessValue,
                        colors: {
                          primary: '#ff1493', primary600: '#d0107a', primary400: '#ff4da6',
                          backgroundDark: '#000000', backgroundLight: '#121212',
                          chatBubbleSent: `rgba(255, 20, 147, ${transparencyValue/100})`,
                          chatBubbleReceived: `rgba(255, 255, 255, 0.1)`,
                          chatBubbleSentText: '#ffffff',
                          chatBubbleReceivedText: '#ffffff'
                        }
                      };
                      setPreviewTheme(customTheme);
                      setView('preview_theme');
                    }}
                    className="w-full max-w-sm mt-12 py-4 bg-[#ff1493] text-white font-bold rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    Preview Theme
                  </button>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

const LiveAnimations = ({ type }: { type: any }) => {
  if (!type || type === 'none') return null;
  if (type === 'snow') return <div className="absolute inset-0 pointer-events-none opacity-60"><div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-[snow_10s_linear_infinite]" /></div>;
  if (type === 'rain') return <div className="absolute inset-0 pointer-events-none opacity-40"><div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] animate-[rain_0.5s_linear_infinite]" /></div>;
  return <div className="absolute inset-0 pointer-events-none bg-white/5 animate-pulse" />;
};

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[13px] font-bold text-white/50 uppercase tracking-wider px-4 mb-2">{title}</h3>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ActionItem({ icon: Icon, label, subtext, danger }: { icon: any, label: string, subtext?: string, danger?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors group ${danger ? 'text-red-500' : 'text-white'}`}>
      <Icon size={24} className={danger ? 'text-red-500' : 'text-white/80 group-hover:text-white'} />
      <div className="flex flex-col items-start flex-1 text-left">
        <span className="text-base font-medium leading-tight">{label}</span>
        {subtext && <span className={`text-[11px] mt-0.5 ${danger ? 'text-red-500/70' : 'text-white/50'}`}>{subtext}</span>}
      </div>
    </button>
  );
}

function TabButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${active ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
    >
      {children}
    </button>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <div className="px-4 py-2 bg-white/10 border border-white/10 rounded-full text-sm font-bold text-white/90 hover:bg-white/20 cursor-pointer transition-colors">
      {text}
    </div>
  );
}
