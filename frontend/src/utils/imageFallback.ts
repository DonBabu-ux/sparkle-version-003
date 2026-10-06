const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90">'
    + '<rect width="120" height="90" rx="8" fill="#e8eaf0"/>'
    + '<path d="M18 64l20-24 15 17 11-11 26 18z" fill="#b7bdcf"/>'
    + '<circle cx="84" cy="30" r="8" fill="#cdd3e3"/>'
    + '</svg>';

export const IMAGE_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(svg)}`;
export const FALLBACK_ATTR = 'data-no-fallback';

export interface ImgLike {
    tagName?: string;
    src?: string;
    getAttribute?(name: string): string | null | undefined;
}

export function shouldSwapForFallback(el: ImgLike | null | undefined): boolean {
    if (!el || !el.tagName) return false;
    if (el.tagName.toUpperCase() !== 'IMG') return false;
    if (el.getAttribute?.(FALLBACK_ATTR)) return false;
    const src = el.src || '';
    if (!src || src === IMAGE_PLACEHOLDER) return false;
    return true;
}

export function applyImageFallback(el: ImgLike | null | undefined): boolean {
    if (!shouldSwapForFallback(el)) return false;
    (el as { src: string }).src = IMAGE_PLACEHOLDER;
    return true;
}

type ErrorTarget = EventTarget | null;

/**
 * Capture-phase window listener: any <img> whose load fails (broken CDN link,
 * offline, dead upload) is swapped to the bundled no-image placeholder instead
 * of the browser's broken-image icon. Returns an uninstall function.
 */
export function installGlobalImageFallback(
    win?: { addEventListener?: unknown; removeEventListener?: unknown } | null
): () => void {
    const w = win !== undefined ? win : typeof window !== 'undefined' ? window : undefined;
    if (!w || typeof (w as Window).addEventListener !== 'function') return () => {};
    const target = w as Window;
    const onError = (event: Event) => {
        applyImageFallback(event.target as ErrorTarget as ImgLike);
    };
    target.addEventListener('error', onError, true);
    return () => target.removeEventListener('error', onError, true);
}
