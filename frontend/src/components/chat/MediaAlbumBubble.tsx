import { getMediaUrl } from '../../utils/imageUtils';

/**
 * A grid of up to nine images from one message, with a "+N" overlay
 * when the message carried more. Extracted from pages/Messages.tsx.
 */

const MediaAlbumBubble = ({ items, isMe, onOpen }: { items: any[]; isMe: boolean; onOpen: (msg: any) => void }) => {
  const visible = items.slice(0, 9);
  const overflow = items.length - visible.length;
  const cols = items.length === 2 ? 2 : 3;

  return (
    <div className={`flex animate-fade-in mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className="grid gap-[2px] rounded-[18px] overflow-hidden border border-white/10 bg-black/20 max-w-[300px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {visible.map((m, idx) => (
          <button
            key={m.message_id || idx}
            type="button"
            onClick={() => onOpen(m)}
            className="relative aspect-square overflow-hidden bg-black/30 active:opacity-80 transition-opacity"
            aria-label={`Open image ${idx + 1} of ${items.length}`}
          >
            <img
              src={getMediaUrl(m.media_url || m.mediaUrl) || undefined}
              className="w-full h-full object-cover"
              alt=""
              loading="lazy"
            />
            {overflow > 0 && idx === visible.length - 1 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-lg">
                +{overflow}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MediaAlbumBubble;
