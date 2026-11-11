import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { logger } from '../../utils/logger';

/**
 * Renders a message attachment from its stored JSON metadata.
 *
 * Extracted from pages/Messages.tsx, where it satinline among fourteen other
 * top-level components. It had no dependency on anything else in that file —
 * only useNavigate, logger and an icon — so it moves without modification.
 *
 * Unlike the rest of the attachments this one carries, `metadata` arrives as a
 * JSON string rather than an object: the socket handler stores it as
 * `JSON.stringify({ attachment })`, and the JS never re-parses it. That is why
 * this component parses at render and returns null on malformed JSON.
 */
const AttachmentCard = ({ metadata }: { metadata: string }) => {
  const navigate = useNavigate();
  let parsed: any = null;
  try {
    parsed = JSON.parse(metadata);
  } catch (e) {
    logger.error("Failed to parse metadata", e);
    return null;
  }
  const att = parsed?.attachment;
  if (!att) return null;

  if (att.type === 'story') {
    return (
      <div
        onClick={() => navigate(`/stories/${att.owner}`)}
        className="rounded-[20px] overflow-hidden border border-white/10 cursor-pointer max-w-[240px] bg-white/5 backdrop-blur-md relative group select-none shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] mt-1"
      >
        {att.thumbnail ? (
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/20">
            <img src={att.thumbnail} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Story preview" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_#a855f7]" />
              <span className="text-white text-[11px] font-black uppercase tracking-wider">Story Reply</span>
            </div>
          </div>
        ) : (
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-bold text-white leading-tight">Story Reply</span>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Click to view</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default AttachmentCard;
