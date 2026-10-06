export function getTiktokEmbedUrl(mediaUrl?: string | null): string | null {
    if (!mediaUrl || typeof mediaUrl !== 'string') return null;
    if (!/tiktok\.com/i.test(mediaUrl)) return null;
    const match = mediaUrl.match(/\/(?:video|v)\/(\d{6,25})/);
    if (!match) return null;
    return `https://www.tiktok.com/embed/v2/${match[1]}`;
}
