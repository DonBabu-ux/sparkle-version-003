import React, { useState, useEffect, useRef } from 'react';
import api from '../api/api';

interface User {
  user_id: string;
  username: string;
  avatar_url: string;
  name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const MentionInput: React.FC<MentionInputProps> = ({ value, onChange, onBlur, placeholder, className, autoFocus }) => {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleMentionSearch = async () => {
      // If it's just '@', show people you follow
      if (mentionQuery === '@') {
        try {
          const res = await api.get('/users/following?q=');
          setSuggestions(res.data || []);
          setShowSuggestions(true);
        } catch (err) {
          console.error('Failed to fetch following for mentions:', err);
        }
        return;
      }

      if (!mentionQuery || mentionQuery.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await api.get(`/users/search?q=${mentionQuery.replace('@', '')}`);
        setSuggestions(Array.isArray(res.data) ? res.data : (res.data.users || []));
        setShowSuggestions(true);
      } catch (err) {
        console.error('Mention search failed:', err);
      }
    };
    const timer = setTimeout(handleMentionSearch, 300);
    return () => clearTimeout(timer);
  }, [mentionQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(val);
    setCursorPos(pos);

    const beforeCursor = val.slice(0, pos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[0]);
    } else {
      setMentionQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectMention = (username: string) => {
    const beforeMention = value.slice(0, cursorPos - mentionQuery.length);
    const afterMention = value.slice(cursorPos);
    const newValue = `${beforeMention}@${username} ${afterMention}`;
    onChange(newValue);
    setMentionQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onBlur={() => setTimeout(onBlur || (() => {}), 200)}
        autoFocus={autoFocus}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-white/95 backdrop-blur-xl border border-black/5 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-2">
          {suggestions.map((u) => (
            <button
              key={u.user_id}
              className="w-full px-4 py-3 flex items-center gap-4 hover:bg-black/5 transition-all border-b border-black/[0.02] last:border-none group"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); selectMention(u.username); }}
            >
              <img src={u.avatar_url || '/uploads/avatars/default.png'} className="w-8 h-8 rounded-full border border-black/5 group-hover:scale-105 transition-transform" alt="" />
              <div className="text-left">
                <p className="font-black text-black text-[13px] tracking-tight uppercase italic">@{u.username}</p>
                <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{u.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
