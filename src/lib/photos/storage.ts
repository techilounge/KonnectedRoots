import { deleteObject, getStorage, ref } from 'firebase/storage';
import { app } from '@/lib/firebase/clients';
import { ownedPhotoPath, type PhotoOwner } from './ownership';

export async function deleteOwnedPhoto(url: string | null | undefined, owner: PhotoOwner): Promise<boolean> {
  if (!url) return true;
  const storage = getStorage(app);
  const path = ownedPhotoPath(url, ref(storage).bucket, owner);
  if (!path) {
    console.info('Photo cleanup skipped: object ownership could not be verified.');
    return false;
  }
  try {
    await deleteObject(ref(storage, path));
    return true;
  } catch (error) {
    if ((error as {code?: string}).code === 'storage/object-not-found') return true;
    console.warn('Photo cleanup could not complete.');
    return false;
  }
}
