import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const CameraService = {
  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera, // Force camera
      });
      
      // image.webPath will contain a path that can be set as an image src.
      // You can access the original file using image.path, which can be
      // passed to the Filesystem API to read the raw data of the image,
      // if desired (or pass to Multer as a blob).
      return image;
    } catch (error) {
      console.error('Camera Error:', error);
      return null;
    }
  },

  async pickFromGallery() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });
      return image;
    } catch (error) {
      console.error('Gallery Error:', error);
      return null;
    }
  },

  async convertUriToBlob(uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  }
};
