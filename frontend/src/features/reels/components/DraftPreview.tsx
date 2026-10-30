import { useEffect, useState, type ReactNode } from 'react';
import { getDraftPreview, type DraftListItem } from '../services/draftService';

/**
 * Renders a draft's stored preview — the real first clip, as an image or a
 * video depending on what the user uploaded. Falls back to `fallback` when
 * the media is missing. Owns the object URL lifecycle (revoked on change/unmount).
 */
export default function DraftPreview({
  draft,
  className = '',
  fallback = null,
}: {
  draft: DraftListItem | null;
  className?: string;
  fallback?: ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [kind, setKind] = useState<'image' | 'video'>('image');

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    if (!draft) {
      setSrc(null);
      return;
    }
    void (async () => {
      try {
        const preview = await getDraftPreview(draft);
        if (!alive || !preview) return;
        url = preview.url;
        setKind(preview.kind);
        setSrc(preview.url);
      } catch (_) {
        if (alive) setSrc(null);
      }
    })();
    return () => {
      alive = false;
      if (url) {
        try { URL.revokeObjectURL(url); } catch (_) { /* already gone */ }
      }
    };
  }, [draft]);

  if (!src) return <>{fallback}</>;
  if (kind === 'video') {
    // preload="auto" so the first frame decodes and renders as the preview.
    return <video src={src} className={className} muted playsInline preload="auto" />;
  }
  return <img src={src} alt="" className={className} />;
}
