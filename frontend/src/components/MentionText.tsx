import React from 'react';
import { Link } from 'react-router-dom';

interface MentionTextProps {
  content: string;
  className?: string;
  onClick?: () => void;
}

const MentionText: React.FC<MentionTextProps> = ({ content, className, onClick }) => {
  if (!content) return null;

  // Regex to find mentions like @username (word characters)
  const parts = content.split(/(@\w+)/g);

  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const username = part.slice(1);
          const isSpecial = ['everyone', 'followers', 'recent', 'highlight'].includes(username.toLowerCase());
          
          return (
            <Link
              key={index}
              to={isSpecial ? '#' : `/profile/${username}`}
              onClick={(e) => {
                if (isSpecial) e.preventDefault();
                onClick?.();
              }}
              className={isSpecial 
                ? "bg-pink-100 text-pink-600 px-1 py-0.5 rounded font-black text-[0.95em]" 
                : "text-primary font-bold hover:underline"
              }
            >
              {part}
            </Link>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

export default MentionText;
