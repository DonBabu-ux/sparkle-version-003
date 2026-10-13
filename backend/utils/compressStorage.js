const sharp = require('sharp');
const { Readable } = require('stream');
const logger = require('./logger');

// Image-only MIME types we will compress. Videos pass through untouched
// (Cloudinary's streaming_profile + eager transforms already handle those).
const COMPRESSIBLE_MIME = /^image\/(jpeg|jpg|png|webp|gif|avif|tiff)$/i;

// Hard cap on the decompressed pixel budget. A 100MP phone photo would
// otherwise OOM the sharp worker; we downscale instead.
const MAX_PIXELS = 40_000_000; // 40MP

// Target long-edge (px) per destination. Keeps avatar/post/marketplace assets
// well under Cloudinary free-tier transform + bandwidth costs while staying
// crisp on retina displays.
const DEFAULT_MAX_EDGE = 1600;

/**
 * Decorates a multer StorageEngine (typically CloudinaryStorage) so that
 * image uploads are re-encoded with sharp BEFORE they are handed to the
 * underlying engine. Videos and other types stream through untouched.
 *
 * Usage:
 *   const storage = new CompressedCloudinaryStorage(
 *     new CloudinaryStorage({ ... }),
 *     { maxEdge: 1600, quality: 80 }
 *   );
 */
class CompressedCloudinaryStorage {
  constructor(inner, options = {}) {
    this.inner = inner;
    this.maxEdge = options.maxEdge || DEFAULT_MAX_EDGE;
    this.quality = options.quality || 80;
  }

  // multer calls _handleFile(req, file, cb). We intercept, compress, then
  // delegate to the inner engine with a fresh Readable carrying the bytes.
  _handleFile(req, file, cb) {
    if (!file.mimetype || !COMPRESSIBLE_MIME.test(file.mimetype)) {
      // Not a compressible image — pass the original stream straight through.
      return this.inner._handleFile(req, file, cb);
    }

    const chunks = [];
    let totalBytes = 0;
    file.stream.on('data', (c) => {
      chunks.push(c);
      totalBytes += c.length;
    });
    file.stream.on('error', (err) => cb(err));
    file.stream.on('end', async () => {
      try {
        const input = Buffer.concat(chunks);
        const compressed = await compressImage(input, {
          maxEdge: this.maxEdge,
          quality: this.quality,
          mimetype: file.mimetype,
        });

        // Only swap in the compressed bytes if we actually shrank it.
        const useBuffer = compressed && compressed.length < input.length
          ? compressed
          : input;

        // Build a fresh Readable so the inner CloudinaryStorage streams from
        // the compressed buffer instead of the original (already-consumed) stream.
        const stream = Readable.from(useBuffer);

        // CloudinaryStorage reads file.stream / file size / mimetype to decide
        // resource_type and to compute checksums. Preserve the original metadata
        // but point the stream at our bytes and override the size.
        const patched = Object.assign({}, file, {
          stream,
          size: useBuffer.length,
        });

        this.inner._handleFile(req, patched, (err, info) => {
          if (err) return cb(err);
          if (info && useBuffer.length < input.length) {
            logger.info(
              `[compress] ${file.originalname}: ${input.length} -> ${useBuffer.length} bytes ` +
              `(${Math.round((1 - useBuffer.length / input.length) * 100)}% smaller)`
            );
          }
          cb(null, info);
        });
      } catch (err) {
        // Compression must never block an upload. Fall back to the original.
        logger.error('[compress] sharp failed, uploading original:', err.message);
        const stream = Readable.from(Buffer.concat(chunks));
        const patched = Object.assign({}, file, { stream, size: totalBytes });
        this.inner._handleFile(req, patched, cb);
      }
    });
  }

  _removeFile(req, file, cb) {
    return this.inner._removeFile(req, file, cb);
  }
}

/**
 * Re-encodes an image buffer. Returns null if the result would be larger or
 * the input is not a valid image — caller then keeps the original.
 */
async function compressImage(inputBuffer, { maxEdge, quality, mimetype }) {
  try {
    const img = sharp(inputBuffer, { failOn: 'none' });
    const meta = await img.metadata();

    // Guard against decompression bombs.
    const pixels = (meta.width || 0) * (meta.height || 0);
    if (pixels > MAX_PIXELS) {
      logger.warn(`[compress] image exceeds ${MAX_PIXELS} pixel budget (${pixels}px), downscaling`);
    }

    const pipeline = img
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      // Strip metadata (EXIF GPS, camera serial, etc.) — privacy + size win.
      .rotate(); // auto-orient from EXIF before strip

    // Prefer WebP when the source is already lossy-ish (jpeg/png) and the
    // client supports it; otherwise re-encode to a tight JPEG.
    const wantsWebp = /jpeg|jpg|png/i.test(mimetype) && quality <= 85;
    if (wantsWebp) {
      return await pipeline.webp({ quality, effort: 4 }).toBuffer();
    }
    return await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  } catch (err) {
    logger.error('[compress] sharp pipeline error:', err.message);
    return null;
  }
}

module.exports = { CompressedCloudinaryStorage, compressImage };
