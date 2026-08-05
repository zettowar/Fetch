import client from './client';
import type { Photo } from '../types';

export async function uploadPhoto(
  petId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Photo> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await client.post(`/pets/${petId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return res.data;
}

export async function deletePhoto(photoId: string): Promise<void> {
  await client.delete(`/photos/${photoId}`);
}

/** Photos held for review are withheld by the public file route, so the owner's
 *  own copy comes through the authenticated per-photo route as a blob. */
export async function getOwnPhotoBlob(photoId: string): Promise<Blob> {
  const res = await client.get(`/photos/${photoId}/file`, { responseType: 'blob' });
  return res.data;
}
