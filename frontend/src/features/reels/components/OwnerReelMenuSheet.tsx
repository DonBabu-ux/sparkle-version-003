import { X, Send, ShieldCheck, Eye, Download, Pin, Sticker, Cast } from 'lucide-react';
import { showSuccess, showError } from '../../../utils/toast';
import api from '../../../api/api';
import { logger } from '../../../utils/logger';

/**
 * Owner-only reel menu (three-dot): send/share entry, privacy settings,
 * viewer analytics, download, pin, create-sticker, and cast. Every action
 * either opens a real surface or calls a real endpoint — no dead controls.
 */
export default function OwnerReelMenuSheet({
  momentId,
  isPinned,
  castAvailable,
  onClose,
  onSend,
  onPrivacy,
  onViewers,
  onDownload,
  onCreateSticker,
  onCast,
  onPinToggled,
}: {
  momentId: string;
  isPinned: boolean;
  castAvailable: boolean;
  onClose: () => void;
  onSend: () => void;
  onPrivacy: () => void;
  onViewers: () => void;
  onDownload: () => void;
  onCreateSticker: () => void;
  onCast: () => void;
  onPinToggled: (pinned: boolean) => void;
}) {
  const togglePin = async () => {
    try {
      const { data } = await api.post(`/moments/${momentId}/pin`);
      const pinned = Number(data?.is_pinned) === 1;
      onPinToggled(pinned);
      showSuccess(pinned ? 'Reel pinned to the top of your grid.' : 'Reel unpinned.');
      onClose();
    } catch (err) {
      logger.warn('[OwnerReelMenu] pin failed:', err);
      showError('Could not update pin. Try again.');
    }
  };

  const items: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    hint?: string;
    onClick: () => void;
  }> = [
    { key: 'send', icon: <Send size={17} />, label: 'Send to friends', hint: 'Share privately in a message', onClick: onSend },
    { key: 'privacy', icon: <ShieldCheck size={17} />, label: 'Privacy settings', hint: 'Audience, hide-from, only-show-to', onClick: onPrivacy },
    { key: 'viewers', icon: <Eye size={17} />, label: 'Who viewed this', hint: 'Last 30 days', onClick: onViewers },
    { key: 'download', icon: <Download size={17} />, label: 'Download', hint: 'Save the video to this device', onClick: onDownload },
    { key: 'pin', icon: <Pin size={17} />, label: isPinned ? 'Unpin from grid' : 'Pin to grid', onClick: () => { void togglePin(); } },
    { key: 'sticker', icon: <Sticker size={17} />, label: 'Create sticker', hint: 'Turn this frame into a chat sticker', onClick: onCreateSticker },
    ...(castAvailable
      ? [{ key: 'cast', icon: <Cast size={17} />, label: 'Cast', hint: 'Play on a nearby screen', onClick: onCast }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-[var(--z-modal,60)] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Reel options">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#0B070C] rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10">
          <h2 className="text-[15px] font-extrabold text-[#18181b] dark:text-white">Reel options</h2>
          <button type="button" onClick={onClose} aria-label="Close menu" className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X size={17} className="text-black/50 dark:text-white/50" />
          </button>
        </div>
        <ul className="py-2">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.onClick}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-[#18181b] dark:text-white">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-[#18181b] dark:text-white">{item.label}</span>
                  {item.hint ? <span className="block text-[11px] text-black/45 dark:text-white/45">{item.hint}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
