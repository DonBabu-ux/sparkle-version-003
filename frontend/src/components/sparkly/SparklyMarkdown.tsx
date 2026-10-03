// components/sparkly/SparklyMarkdown.tsx
// Lightweight, secure markdown renderer for Sparkly Bot assistant messages.
// Supports: paragraphs, headings, bold, italic, code, lists, links.
// Does NOT use dangerouslySetInnerHTML; all rendering is React elements.
import React from 'react';

interface Props {
  content: string;
  streaming?: boolean;
  className?: string;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Parse inline markdown: **bold**, *italic*, `code`, [link](url)
 */
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex for **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`} className="text-white" style={{ color: '#ffffff' }}>{text.slice(lastIndex, match.index)}</span>);
    }

    if (match[2]) {
      parts.push(<strong key={match.index} className="font-extrabold text-white" style={{ color: '#ffffff' }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic text-white font-medium" style={{ color: '#ffffff' }}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="bg-[#0d0d14] text-purple-200 px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-white/20">
          {match[4]}
        </code>
      );
    } else if (match[5] && match[6]) {
      parts.push(
        <a
          key={match.index}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-300 font-bold underline underline-offset-2 hover:text-purple-200"
        >
          {match[5]}
        </a>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`} className="text-white" style={{ color: '#ffffff' }}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key="full-text" className="text-white" style={{ color: '#ffffff' }}>{text}</span>];
}

export const SparklyMarkdown: React.FC<Props> = ({ content, streaming = false, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  const k = () => keyIdx++;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={k()} className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0d0d14]">
          {lang && (
            <div className="px-4 py-1.5 text-[10px] font-mono font-bold text-purple-400 bg-black/30 border-b border-white/10 uppercase tracking-widest">
              {lang}
            </div>
          )}
          <pre className="p-4 text-[13px] leading-relaxed font-mono text-white overflow-x-auto whitespace-pre">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Headings
    const h3Match = line.match(/^###\s+(.*)/);
    const h2Match = line.match(/^##\s+(.*)/);
    const h1Match = line.match(/^#\s+(.*)/);
    if (h1Match) {
      elements.push(<h1 key={k()} className="text-base font-extrabold text-white mt-4 mb-2" style={{ color: '#ffffff' }}>{parseInline(h1Match[1])}</h1>);
      i++; continue;
    }
    if (h2Match) {
      elements.push(<h2 key={k()} className="text-sm font-extrabold text-white mt-3 mb-1.5" style={{ color: '#ffffff' }}>{parseInline(h2Match[1])}</h2>);
      i++; continue;
    }
    if (h3Match) {
      elements.push(<h3 key={k()} className="text-sm font-bold text-white mt-2 mb-1" style={{ color: '#ffffff' }}>{parseInline(h3Match[1])}</h3>);
      i++; continue;
    }

    // Unordered list
    if (/^[-*•]\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[-*•]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={k()} className="my-2.5 space-y-1.5 pl-1 text-white" style={{ color: '#ffffff' }}>
          {listItems.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2.5 text-white font-medium leading-relaxed" style={{ color: '#ffffff' }}>
              <span className="text-purple-400 font-bold text-base leading-none mt-0.5 shrink-0">•</span>
              <span className="text-white" style={{ color: '#ffffff' }}>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      const startNum = parseInt(line.match(/^(\d+)\./)?.[1] || '1');
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={k()} className="my-2.5 space-y-1.5 pl-1 list-none text-white" style={{ color: '#ffffff' }}>
          {listItems.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2.5 text-white font-medium leading-relaxed" style={{ color: '#ffffff' }}>
              <span className="text-purple-400 font-bold shrink-0 text-xs mt-0.5">{startNum + ii}.</span>
              <span className="text-white" style={{ color: '#ffffff' }}>{parseInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={k()} className="my-3 border-white/10" />);
      i++; continue;
    }

    // Blank line → spacer
    if (line.trim() === '') {
      // Skip multiple blank lines
      if (elements.length > 0) {
        elements.push(<div key={k()} className="h-2" />);
      }
      i++; continue;
    }

    // Regular paragraph
    elements.push(
      <p key={k()} className="text-white font-medium leading-[1.7] mb-0" style={{ color: '#ffffff' }}>
        {parseInline(line)}
      </p>
    );
    i++;
  }

  return (
    <div className={`sparkly-md text-sm text-white font-medium ${className}`} style={{ color: '#ffffff' }}>
      {elements}
      {streaming && (
        <span className="inline-block w-0.5 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-full align-middle" />
      )}
    </div>
  );
};

export default SparklyMarkdown;
