import React from 'react';
import { ChatItem } from '../../types'; // assume a type definition

interface ForwardListItemProps {
  index: number;
  style: React.CSSProperties;
  data: { chats: ChatItem[]; selected: Set<string>; toggleSelect: (id: string) => void };
}

export const ForwardListItem: React.FC<ForwardListItemProps> = ({ index, style, data }) => {
  const chat = data.chats[index];
  const isSelected = data.selected.has(chat.id);

  return (
    <button
      style={style}
      onClick={() => data.toggleSelect(chat.id)}
      className="flex items-center w-full p-3 hover:bg-white/5 transition-colors"
    >
      <img src={chat.avatar} alt={chat.name} className="w-10 h-10 rounded-full mr-3 flex-shrink-0" />
      <span className="flex-1 text-left text-white truncate">{chat.name}</span>
      {isSelected && (
        <svg
          className="w-5 h-5 text-[#ff1493]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
};
