/**
 * C2.4 + C2.5 — embed/object-URL hygiene:
 * - the TikTok iframe must be sandboxed (no top-navigation, no downloads)
 * - every module that creates blob URLs must revoke them (no leaks)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../', import.meta.url)); // frontend/src

function walk(dir: string): string[] {
    return (readdirSync(dir, { recursive: true }) as string[])
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
        .filter((f) => !f.split(/[/\\]/).includes('__tests__'))
        .map((f) => join(dir, f));
}

function read(abs: string): string {
    return readFileSync(abs, 'utf8');
}

describe('C2.5 — every createObjectURL site revokes its blob URLs', () => {
    /**
     * Files whose blob URLs are revoked by a different module that owns the
     * lifecycle (justified exceptions — keep this list short and documented).
     */
    const REVOKED_ELSEWHERE: Record<string, string> = {
        // thumbnailUri/localUri are revoked in UploadManager.cleanupJobAssets
        // when the job completes/fails (services/UploadManager.ts:239-257).
        'services/workers/StoryUploadWorker.ts': 'UploadManager.cleanupJobAssets',
        // resumeDraft object URLs live on ReelClip.previewUrl and are revoked
        // by CreateReelFlow on session teardown/discard/publish; getDraftPreview
        // URLs are revoked by DraftPreview on change/unmount.
        'features/reels/services/draftService.ts': 'CreateReelFlow session teardown + DraftPreview unmount (revokeObjectURL)',
    };

    const creators = walk(SRC).filter((f) => read(f).includes('createObjectURL'));

    it('finds object-URL usage (guard against a broken walker)', () => {
        expect(creators.length).toBeGreaterThanOrEqual(10);
    });

    it('every creator also revokes (or has a documented owner that does)', () => {
        const offenders = creators.filter((f) => {
            const rel = f.replace(SRC, '').split(/[/\\]/).join('/');
            if (REVOKED_ELSEWHERE[rel]) return false;
            return !read(f).includes('revokeObjectURL');
        });
        expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
    });
});
