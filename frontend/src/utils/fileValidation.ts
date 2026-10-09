export type FileKind = 'image' | 'video' | 'any';

export interface FileValidationOptions {
    kind?: FileKind;
    maxSizeMB?: number;
}

export interface FileValidationResult {
    ok: boolean;
    error?: string;
}

const IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
];

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp'];

const DEFAULT_MAX_MB = 10;

function fmtMB(bytes: number): number {
    const mb = bytes / (1024 * 1024);
    return Number.isInteger(mb) ? mb : Math.round(mb * 10) / 10;
}

/**
 * Client-side upload gate mirroring the server's multer limits
 * (10MB generic, configurable per call site) so users get a readable
 * error immediately instead of a confusing server/network failure.
 */
export function validateFile(file: File, opts: FileValidationOptions = {}): FileValidationResult {
    const kind: FileKind = opts.kind ?? 'any';
    const maxSizeMB = opts.maxSizeMB ?? DEFAULT_MAX_MB;

    if (file.size > maxSizeMB * 1024 * 1024) {
        return {
            ok: false,
            error: `File is too large (${fmtMB(file.size)} MB). Maximum allowed is ${maxSizeMB} MB.`,
        };
    }

    const type = (file.type || '').toLowerCase();
    if (kind === 'image' && !IMAGE_TYPES.includes(type)) {
        return { ok: false, error: 'Only image files are allowed (JPG, PNG, GIF, WEBP).' };
    }
    if (kind === 'video' && !VIDEO_TYPES.includes(type)) {
        return { ok: false, error: 'Only video files are allowed (MP4, MOV, WEBM).' };
    }

    return { ok: true };
}

/** Validates a batch; returns the first failure (files upload together). */
export function validateFiles(files: FileList | File[], opts: FileValidationOptions = {}): FileValidationResult {
    const list = Array.from(files as ArrayLike<File>);
    for (const f of list) {
        const r = validateFile(f, opts);
        if (!r.ok) return r;
    }
    return { ok: true };
}
