import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, Bell, Users, Image as ImageIcon, Pin, Volume2, 
  Download, Share2, Clock, Eye, MoreHorizontal, Shield, Lock, 
  MinusCircle, ShieldAlert, AlertTriangle, Trash2, ChevronLeft,
  Palette, MessageCircle, Smile, ImagePlus, User, Edit3, Check
} from 'lucide-react';
import { getAvatarUrl } from '../../utils/imageUtils';

interface ChatSettingsModalProps {
  chat: any;
  onClose: () => void;
  onNavigateProfile?: () => void;
}

const THEMES = [
  { id: 'mandalorian', name: 'The Mandalorian', img: 'https://i.pravatar.cc/150?u=mando' },
  { id: 'mothers_day', name: 'Mother\'s Day', img: 'https://i.pravatar.cc/150?u=mom' },
  { id: 'prada', name: 'The Devil Wears Prada', img: 'https://i.pravatar.cc/150?u=prada' },
  { id: 'pixel', name: 'Pixel Dreamscape', img: 'https://i.pravatar.cc/150?u=pixel' },
  { id: 'coachella', name: 'Coachella 2026', img: 'https://i.pravatar.cc/150?u=coach' },
  { id: 'cats', name: 'Cats (Animated)', img: 'https://i.pravatar.cc/150?u=cats' },
  { id: 'dogs', name: 'Dogs (Animated)', img: 'https://i.pravatar.cc/150?u=dogs' },
  { id: 'bts', name: 'BTS', img: 'https://i.pravatar.cc/150?u=bts' },
  { id: 'sky', name: 'Sky Garden', img: 'https://i.pravatar.cc/150?u=sky' }
];

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

export default function ChatSettingsModal({ chat, onClose, onNavigateProfile }: ChatSettingsModalProps) {
  const [view, setView] = useState<'main' | 'customize'>('main');
  const [customizeTab, setCustomizeTab] = useState<'themes' | 'reaction' | 'words'>('reaction');
  const [selectedReaction, setSelectedReaction] = useState('👍');
  const [wordInput, setWordInput] = useState('');

  return (
    <div className="fixed inset-0 bg-[#000000] z-[200] flex justify-center animate-fade-in">
      <div 
        className="w-full max-w-3xl h-full flex flex-col overflow-hidden bg-[#000000]" 
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
                    <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors"><Palette size={20} className="text-white" /></div>
                    <span className="text-xs font-medium text-white/70 group-hover:text-white">Customize</span>
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
          ) : (
            <motion.div key="customize" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col h-full bg-[#000000]">
              <div className="p-4 flex items-center gap-4 sticky top-0 bg-[#000000] z-10 border-b border-white/5">
                <button onClick={() => setView('main')} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold text-white">Customize</h2>
              </div>

              <div className="flex justify-center gap-2 p-4">
                <TabButton active={customizeTab === 'themes'} onClick={() => setCustomizeTab('themes')}>Themes</TabButton>
                <TabButton active={customizeTab === 'reaction'} onClick={() => setCustomizeTab('reaction')}>Quick reaction</TabButton>
                <TabButton active={customizeTab === 'words'} onClick={() => setCustomizeTab('words')}>Word effects</TabButton>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                {customizeTab === 'themes' && (
                  <div className="p-4">
                    <div className="flex gap-3 mb-6">
                      <button className="flex-1 bg-white/10 hover:bg-white/20 rounded-xl py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-white/90 text-[13px] font-medium transition-colors">
                        <Palette size={18} className="text-white" /> AI themes
                      </button>
                      <button className="flex-1 bg-white/10 hover:bg-white/20 rounded-xl py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-white/90 text-[13px] font-medium transition-colors">
                        <ImagePlus size={18} className="text-white" /> Upload an image
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {THEMES.map((theme, i) => (
                        <div key={theme.id} className="flex flex-col gap-2 cursor-pointer group">
                          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-white/40 transition-colors">
                            <img src={theme.img} className="w-full h-full object-cover" />
                            {i === 0 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white"><Check size={16} strokeWidth={3} /></div></div>}
                          </div>
                          <span className="text-xs font-medium text-white/80 line-clamp-2">{theme.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {customizeTab === 'reaction' && (
                  <div className="p-4">
                    <div className="bg-white/10 rounded-full flex items-center px-4 h-12 mb-6 border border-white/5 focus-within:bg-white/15 focus-within:border-white/30 transition-all">
                      <Search size={20} className="text-white/40" />
                      <input type="text" placeholder="Search quick reaction" className="bg-transparent w-full ml-3 text-white placeholder:text-white/40 outline-none text-sm font-medium" />
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-6 mb-8">
                      {MEMOJIS.map((img, i) => (
                        <div key={i} className="aspect-square bg-transparent rounded-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                          <img src={img} className="w-16 h-16 object-contain" />
                        </div>
                      ))}
                    </div>

                    <h3 className="text-sm font-medium text-white/50 mb-4 px-2">Smileys & people</h3>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-4 px-2">
                      {EMOJIS.map((emoji, i) => (
                        <button key={i} onClick={() => setSelectedReaction(emoji)} className={`text-3xl hover:scale-125 transition-transform ${selectedReaction === emoji ? 'bg-white/20 rounded-xl' : ''}`}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {customizeTab === 'words' && (
                  <div className="p-8 flex flex-col items-center h-full">
                    <div className="flex-1 flex flex-col items-center justify-center max-w-xs text-center">
                      <h3 className="text-xl font-bold text-white mb-4">Add effects to your chat</h3>
                      <p className="text-sm text-white/60 mb-8 leading-relaxed">
                        Pair words that have special meaning with fun effects. Everyone will see an animation whenever these words are used. <span className="text-blue-400 font-bold cursor-pointer hover:underline">Learn more</span>
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Chip text="☕ spill the tea" />
                        <Chip text="💯 facts" />
                        <Chip text="🐐 goat" />
                        <Chip text="👑 queen" />
                        <Chip text="✨ fancy" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {customizeTab === 'words' && (
                <div className="p-4 bg-[#000000] border-t border-white/5">
                  <div className="bg-white/10 rounded-full flex items-center px-4 h-14 border border-white/5 focus-within:bg-white/15 focus-within:border-white/30 transition-all">
                    <Smile size={24} className="text-white" />
                    <input 
                      type="text" 
                      value={wordInput}
                      onChange={e => setWordInput(e.target.value)}
                      placeholder="Add a word or phrase" 
                      className="bg-transparent w-full ml-3 text-white placeholder:text-white/40 outline-none text-base font-medium" 
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

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
