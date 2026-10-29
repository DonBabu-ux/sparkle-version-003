import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Send, Type, ImageOff } from 'lucide-react';
import api from '../../../api/api';
import { StageShell, InlineSpinner, PINK } from './shell';
import { generateVideoThumbnail } from '../../../utils/thumbnailGenerator';
import { showError, showSuccess } from '../../../utils/toast';
import { getMediaUrl } from '../../../utils/imageUtils';
import { logger } from '../../../utils/logger';
import { persistNewSticker, patchStickerServerId } from '../services/stickerLibraryService';

interface Person {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
}

const TEXT_COLORS = ['#FFFFFF', '#FF1F6D', '#FFD600', '#7CFF6B', '#00D4FF', '#000000'];

/**
 * Create-sticker flow from a published reel: extract a real frame, burn in
 * optional text, save to the account's sticker library (POST /moments/stickers),
 * and optionally send it to a friend via the chat API.
 */
export default function CreateStickerPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const frameFileRef = useRef<File | null>(null);
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedStickerId, setSavedStickerId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [friends, setFriends] = useState<Person[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameUrlRef = useRef<string | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  // Load the reel + extract a real frame.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data } = await api.get(`/moments/${id}`);
        if (!alive) return;
        const mediaUrl = getMediaUrl(data?.moment?.media_url || data?.moment?.video_url);
        if (!mediaUrl) throw new Error('This reel has no video to extract a frame from.');
        const res = await fetch(mediaUrl);
        if (!res.ok) throw new Error('Could not fetch the reel video.');
        const blob = await res.blob();
        if (!alive) return;
        const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `reel-frame.${ext}`, { type: blob.type || `video/${ext}` });
        frameFileRef.current = file;
        const thumb = await generateVideoThumbnail(file, 0.5);
        if (!alive) return;
        const url = URL.createObjectURL(thumb);
        createdUrlsRef.current.push(url);
        frameUrlRef.current = url;
        setFrameUrl(url);
        setLoading(false);
      } catch (err) {
        logger.warn('[CreateSticker] frame extraction failed:', err);
        if (alive) {
          showError((err as Error).message || 'Could not prepare a frame from this reel.');
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      createdUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* gone */ } });
      createdUrlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Redraw the preview canvas whenever the frame or text changes.
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const url = frameUrlRef.current;
    if (!canvas || !url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      canvas.width = img.naturalWidth || 480;
      canvas.height = img.naturalHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (text.trim()) {
        const fontSize = Math.max(18, Math.round(canvas.width / 12));
        ctx.font = `800 ${fontSize}px 'Varela Round', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = Math.max(2, fontSize / 10);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.fillStyle = textColor;
        const x = canvas.width / 2;
        const y = canvas.height - Math.round(canvas.height * 0.08);
        ctx.strokeText(text, x, y, canvas.width * 0.9);
        ctx.fillText(text, x, y, canvas.width * 0.9);
      }
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [frameUrl, text, textColor]);

  const renderStickerDataUrl = useCallback((): Promise<string> => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return Promise.reject(new Error('No preview available.'));
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Could not render the sticker.')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the rendered sticker.'));
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
  }, []);

  // Chat messages must carry a real http(s) media URL — the backend rejects
  // data: URLs at the sendMessage write funnel (stored-XSS guard).
  const renderStickerBlob = useCallback((): Promise<Blob> => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return Promise.reject(new Error('No preview available.'));
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not render the sticker.'));
      }, 'image/png');
    });
  }, []);

  const save = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      // 1. Persist blob to local IndexedDB FIRST so sticker survives offline
      const blob = await renderStickerBlob();
      const localId = await persistNewSticker(blob, text.trim() || 'Sticker', { momentId: id }).catch(() => null);

      // 2. Upload to server
      const imageData = await renderStickerDataUrl();
      const { data } = await api.post('/moments/stickers', {
        moment_id: id,
        image_data: imageData,
        caption: text.trim() || null,
      });
      const serverId = data?.sticker?.sticker_id || null;
      setSavedStickerId(serverId);

      // 3. Patch local record with server ID so it dedupes on next sync
      if (localId && serverId) {
        await patchStickerServerId(localId, serverId).catch(() => {});
      }

      showSuccess('Sticker saved to your library.');
    } catch (err) {
      logger.warn('[CreateSticker] save failed:', err);
      showError('Could not save the sticker. Try again.');
    } finally {
      setSaving(false);
    }
  }, [id, renderStickerBlob, renderStickerDataUrl, text]);

  const openSend = useCallback(async () => {
    setSendOpen(true);
    try {
      const { data } = await api.get('/reels/people/friends');
      setFriends(Array.isArray(data?.people) ? data.people : []);
    } catch {
      setFriends([]);
    }
  }, []);

  const send = useCallback(async () => {
    if (!selectedFriend) return;
    setSending(true);
    try {
      // Upload the rendered PNG to get a hosted URL — /messages/send rejects
      // data: URLs, so the sticker can never be sent as base64 inline.
      const blob = await renderStickerBlob();
      const formData = new FormData();
      formData.append('file', new File([blob], 'sticker.png', { type: 'image/png' }));
      const uploadRes = await api.post('/upload/message', formData);
      const stickerUrl: string =
        uploadRes.data?.url || uploadRes.data?.data?.url || uploadRes.data?.secure_url || '';
      if (!stickerUrl) throw new Error('Sticker upload returned no URL');

      await api.post('/messages/send', {
        partnerId: selectedFriend,
        media_url: stickerUrl,
        type: 'sticker',
        attachment: {
          type: 'sticker',
          stickerId: savedStickerId || undefined,
          mediaUrl: stickerUrl,
          momentId: id,
        },
      });
      showSuccess('Sticker sent.');
      navigate('/messages');
    } catch (err) {
      logger.warn('[CreateSticker] send failed:', err);
      showError('Could not send the sticker. Try again.');
    } finally {
      setSending(false);
    }
  }, [selectedFriend, renderStickerBlob, savedStickerId, id, navigate]);

  return (
    <StageShell title="Create sticker" leftIcon="back" onLeft={() => navigate(-1)}>
      <div className="px-4 pt-4 flex flex-col gap-4 pb-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/60 text-sm">
            <InlineSpinner size={18} /> Extracting a frame from your reel…
          </div>
        ) : !frameUrl ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/50 text-sm">
            <ImageOff size={28} />
            <p>No frame available for this reel.</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl overflow-hidden bg-black/30 flex items-center justify-center">
              <canvas ref={previewCanvasRef} className="w-full max-h-[50dvh] object-contain" aria-label="Sticker preview" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-white/70 text-[12px] font-bold uppercase tracking-wide">
                <Type size={13} /> Text (optional)
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={40}
                placeholder="Add a short caption…"
                className="w-full rounded-2xl px-3.5 h-11 bg-white/8 outline-none text-white text-[14px] placeholder:text-white/35"
                aria-label="Sticker text"
              />
              <div className="flex items-center gap-2 pt-1">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTextColor(c)}
                    aria-label={`Text color ${c}`}
                    className="w-7 h-7 rounded-full border-2 transition-transform active:scale-90"
                    style={{ background: c, borderColor: textColor === c ? PINK : 'transparent' }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <><InlineSpinner size={15} /> Saving…</> : <><Check size={16} /> Save sticker</>}
              </button>
              <button
                type="button"
                onClick={() => void openSend()}
                disabled={!savedStickerId || sending}
                className="w-full py-3.5 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2"
                style={{
                  background: savedStickerId && !sending ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                  opacity: !savedStickerId || sending ? 0.6 : 1,
                }}
                title={savedStickerId ? 'Send to a friend' : 'Save the sticker first'}
              >
                <Send size={15} /> Send to a friend
              </button>
              {!savedStickerId && (
                <p className="text-white/40 text-[11px] text-center">Save the sticker to enable sending.</p>
              )}
            </div>
          </>
        )}
      </div>

      {sendOpen && (
        <div className="fixed inset-0 z-[var(--z-modal,60)] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSendOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white dark:bg-[#0B070C] rounded-t-3xl sm:rounded-3xl max-h-[70dvh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-black/5 dark:border-white/10">
              <h2 className="text-[15px] font-extrabold text-[#18181b] dark:text-white">Send sticker to</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {friends.length === 0 && (
                <p className="py-6 text-center text-black/45 dark:text-white/45 text-[13px]">No friends to send to yet.</p>
              )}
              <ul className="flex flex-col gap-1">
                {friends.map((f) => (
                  <li key={f.user_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedFriend(f.user_id)}
                      className="w-full flex items-center gap-3 rounded-2xl px-2 py-2 text-left"
                      aria-pressed={selectedFriend === f.user_id}
                      style={{ background: selectedFriend === f.user_id ? 'rgba(255,0,110,0.12)' : 'transparent' }}
                    >
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: 'rgba(255,0,110,0.35)' }}>
                          {(f.username || '?')[0].toUpperCase()}
                        </span>
                      )}
                      <span className="text-[13px] font-bold text-[#18181b] dark:text-white">@{f.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-5 pb-6 pt-2 border-t border-black/5 dark:border-white/10 flex gap-2">
              <button
                type="button"
                onClick={() => setSendOpen(false)}
                className="flex-1 py-3 rounded-2xl font-bold bg-black/5 dark:bg-white/10 text-[#18181b] dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setSendOpen(false); void send(); }}
                disabled={!selectedFriend || sending}
                className="flex-1 py-3 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2"
                style={{ background: selectedFriend && !sending ? 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' : 'rgba(120,120,120,0.3)' }}
              >
                {sending ? <InlineSpinner size={14} /> : <Send size={14} />} Send
              </button>
            </div>
          </div>
        </div>
      )}
    </StageShell>
  );
}
