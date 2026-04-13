import client from './client';
import type { Photo } from '../types';

export async function uploadPhoto(
  dogId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Photo> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await client.post(`/dogs/${dogId}/photos`, formData, {
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
