export const CameraService = {
  /**
   * Check and request permissions for camera and microphone
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Stop track immediately after checking permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.warn('Media devices permission denied or unavailable:', err);
      // Try video-only fallback
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoStream.getTracks().forEach(track => track.stop());
        return true;
      } catch (e) {
        console.error('Camera permission request failed entirely:', e);
        return false;
      }
    }
  },

  /**
   * Converts any web URL or Blob/Data URI to a file Blob
   */
  async convertUriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  },

  /**
   * High-performance client-side media compressor
   * Scales down oversized captures and applies lossy JPEG quality controls
   */
  async compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Maintain aspect ratio while scaling
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file); // fallback if context not available
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Video compression placeholder - browsers compress directly using codec bitrates in MediaRecorder
   */
  async compressVideo(file: File): Promise<File> {
    console.log('📽️ Video compression handled natively by MediaRecorder bitrate caps:', file.name, file.size);
    return file;
  }
};
