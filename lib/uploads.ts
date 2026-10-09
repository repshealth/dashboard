'use client';

import { isLive } from './live';

/** Shrinks a photo in the browser so uploads stay quick. Logos keep transparency as PNG. */
async function shrink(file: File, maxSide: number): Promise<{ blob: Blob; dataUrl: string; type: string }> {
  const keepPng = file.type === 'image/png' || file.type === 'image/svg+xml';
  const type = keepPng ? 'image/png' : 'image/jpeg';
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file could not be read as an image.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL(type, 0.85);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), type, 0.85));
    return { blob, dataUrl, type };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Prepares an image from the onboarding form and returns the address to store.
 * Live: uploads to the R2 bucket and returns its address.
 * Preview: returns the shrunk image as a data URL, kept in memory.
 */
export async function uploadImage(file: File, opts: { maxSide?: number } = {}): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG or PNG).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is over 25MB. Please choose a smaller one.');
  const { blob, dataUrl, type } = await shrink(file, opts.maxSide ?? 1800);
  if (!isLive) return dataUrl;

  const form = new FormData();
  form.append('file', new File([blob], file.name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg'), { type }));
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Upload failed. Please try again.');
  return body.url as string;
}
