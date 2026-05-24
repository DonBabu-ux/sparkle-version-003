import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowLeft, Check, X, Forward } from 'lucide-react';

interface ForwardContact {
  id: string;
  name: string;
  username?: string;
  avatar_url?: string;
  type?: 'user' | 'group';
}

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: ForwardContact[];
  onForward: (selectedIds: string[]) => void;
}

const MAX_SELECT = 5;

export const ForwardModal: React.FC<ForwardModalProps> = ({ isOpen, onClose, contacts, onForward }) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'groups'>('all');

  const filteredContacts = useMemo(() => {
    const term = search.toLowerCase();
    return contacts.filter(c => {
      const matchesSearch = (c.name || c.username || '').toLowerCase().includes(term);
      if (activeTab === 'groups') return matchesSearch && c.type === 'group';
      return matchesSearch;
    });
  }, [contacts, search, activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, id];
    });
  };

  const handleForward = () => {
    if (selectedIds.length > 0) {
      onForward(selectedIds);
      setSelectedIds([]);
      setSearch('');
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedIds([]);
    setSearch('');
    onClose();
  };

  const getAvatar = (c: ForwardContact) =>
    c.avatar_url && c.avatar_url.startsWith('http')
      ? c.avatar_url
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username || c.name}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[190]"
            onClick={handleClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed bottom-0 left-0 right-0 z-[200] flex flex-col bg-[#0b141a] rounded-t-[24px] overflow-hidden"
            style={{ maxHeight: '90vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center px-4 py-3 border-b border-white/10 shrink-0">
              <button onClick={handleClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
                <ArrowLeft size={22} className="text-white" />
              </button>
              <h2 className="text-[17px] font-semibold text-white ml-3 flex-1">Forward to...</h2>
              {selectedIds.length > 0 && (
                <span className="text-[12px] font-bold text-[#ff1493]">
                  {selectedIds.length}/{MAX_SELECT}
                </span>
              )}
            </div>

            {/* Search */}
            <div className="px-4 py-3 shrink-0">
              <div className="flex items-center bg-white/[0.08] border border-white/10 rounded-2xl px-4 h-11 gap-3 focus-within:border-[#ff1493]/40 transition-all">
                <Search size={16} className="text-white/40 shrink-0" />
                <input
                  type="text"
                  placeholder="Search people and groups..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent flex-1 text-[14px] text-white placeholder:text-white/30 outline-none"
                  autoComplete="off"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-white/40 hover:text-white">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex px-4 gap-3 mb-2 shrink-0">
              {(['all', 'groups'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                    activeTab === tab
                      ? 'bg-[#ff1493] text-white shadow-lg shadow-[#ff1493]/25'
                      : 'bg-white/10 text-white/50 hover:bg-white/15'
                  }`}
                >
                  {tab === 'all' ? 'All' : 'Groups'}
                </button>
              ))}
            </div>

            {/* Selected chips */}
            <AnimatePresence>
              {selectedIds.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-3 flex flex-wrap gap-2 overflow-hidden shrink-0"
                >
                  {selectedIds.map(id => {
                    const c = contacts.find(x => x.id === id);
                    return c ? (
                      <span key={id} className="inline-flex items-center gap-1.5 bg-[#ff1493]/20 border border-[#ff1493]/30 text-[#ff1493] rounded-full px-3 py-1 text-[12px] font-semibold">
                        {c.name || c.username}
                        <button onClick={() => toggleSelect(id)} className="hover:text-white transition-colors">
                          <X size={12} strokeWidth={3} />
                        </button>
                      </span>
                    ) : null;
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Search size={36} className="text-white/10" />
                  <p className="text-[13px] text-white/30 font-medium">No results found</p>
                </div>
              ) : (
                filteredContacts.map(contact => {
                  const isSelected = selectedIds.includes(contact.id);
                  return (
                    <motion.div
                      key={contact.id}
                      onClick={() => toggleSelect(contact.id)}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors active:bg-white/10"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={getAvatar(contact)}
                          className="w-12 h-12 rounded-full object-cover bg-gray-700"
                          alt=""
                        />
                        {contact.type === 'group' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-500 rounded-full border-2 border-[#0b141a] flex items-center justify-center">
                            <span className="text-[7px] font-black text-white">G</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-white truncate">{contact.name}</p>
                        {contact.username && (
                          <p className="text-[12px] text-white/40 truncate">@{contact.username}</p>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                        isSelected
                          ? 'bg-[#ff1493] border-[#ff1493]'
                          : 'border-white/30'
                      }`}>
                        {isSelected && <Check size={13} strokeWidth={3} className="text-white" />}
                      </div>
                    </motion.div>
                  );
                })
              )}
              {/* Bottom padding */}
              <div className="h-24" />
            </div>

            {/* Send button */}
            <AnimatePresence>
              {selectedIds.length > 0 && (
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="absolute bottom-0 left-0 right-0 p-5 flex justify-between items-center"
                  style={{ background: 'linear-gradient(to top, #0b141a 60%, transparent)' }}
                >
                  <span className="text-[13px] font-semibold text-white/60">
                    {selectedIds.length} selected
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleForward}
                    className="w-14 h-14 rounded-full bg-[#ff1493] flex items-center justify-center shadow-xl shadow-[#ff1493]/35"
                  >
                    <Forward size={22} strokeWidth={2.5} className="text-white -ml-0.5" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ForwardModal;
