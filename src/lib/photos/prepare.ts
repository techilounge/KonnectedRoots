import { validatePhoto } from './ownership';

export async function preparePersonPhoto(file: File): Promise<File> {
  validatePhoto(file);
  const source = URL.createObjectURL(file);
  try {
    const image = document.createElement('img');
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This image could not be opened.'));
      image.src = source;
    });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 400 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This image could not be prepared.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob) throw new Error('This image could not be prepared.');
    const prepared = new File([blob], 'photo.jpg', {type: 'image/jpeg'});
    validatePhoto(prepared);
    return prepared;
  } finally { URL.revokeObjectURL(source); }
}

export function enhancedPhotoFile(dataUrl: string): File {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[2].length > 7 * 1024 * 1024) throw new Error('Invalid enhanced image.');
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
  const file = new File([bytes], 'enhanced-photo', {type: match[1]});
  validatePhoto(file);
  return file;
}
