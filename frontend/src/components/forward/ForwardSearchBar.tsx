import React from 'react';
import { Search } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

interface ForwardSearchBarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export const ForwardSearchBar: React.FC<ForwardSearchBarProps> = ({ searchTerm, setSearchTerm }) => {
  const debounced = useDebounce(searchTerm, 300);

  // In a real app you would use debounced to trigger API calls.
  // Here we just forward the raw value.
  return (
    <div className="p-3 bg-[#111111] border-b border-white/10">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
        <input
          type="text"
          placeholder="Search chats, groups, users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-3 py-2 bg-[#222222] rounded-full text-sm text-white placeholder-white/40 focus:outline-none"
        />
      </div>
    </div>
  );
};
