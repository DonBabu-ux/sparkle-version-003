/**
 * Helper to capture a frame from a local video File or Blob and generate a JPEG image thumbnail.
 * @param videoFile - The video File/Blob
 * @param timeInSeconds - The timestamp to capture (default 0.5s)
 * @returns Promise resolving to a File object representing the JPEG thumbnail
 */
export function generateVideoThumbnail(videoFile: File, timeInSeconds = 0.5): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // Fast-path object URL creation
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    video.onloadedmetadata = () => {
      // Seek to specified position
      video.currentTime = Math.min(timeInSeconds, video.duration / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(videoUrl);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(videoUrl);
          if (blob) {
            const thumbnailFile = new File(
              [blob], 
              `thumb-${Date.now()}-${videoFile.name.replace(/\.[^/.]+$/, "")}.jpg`, 
              { type: 'image/jpeg' }
            );
            resolve(thumbnailFile);
          } else {
            reject(new Error('Canvas conversion to blob failed'));
          }
        }, 'image/jpeg', 0.85);

      } catch (err) {
        URL.revokeObjectURL(videoUrl);
        reject(err);
      }
    };

    video.onerror = (_e) => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Video loading failed for thumbnail capture'));
    };
  });
}
