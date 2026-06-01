/**
 * Handles file uploads for both generic media and message attachments.
 * Expects a multipart/form-data request with a single file field named 'file'.
 * The multer‑cloudinary storage uploads directly to Cloudinary and attaches
 * the resulting file metadata to `req.file`.
 */
async function uploadMedia(req, res) {
  try {
    const uploaded = req.file;
    if (!uploaded) {
      return res.status(400).json({ error: 'No file provided' });
    }
    // CloudinaryStorage provides `path` as the CDN URL and `filename` as public ID
    const fileUrl = uploaded.path || uploaded.url || '';
    const publicId = uploaded.filename || uploaded.public_id || '';
    return res.status(200).json({ url: fileUrl, publicId });
  } catch (err) {
    console.error('[ERROR] uploadMedia controller error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { uploadMedia };
