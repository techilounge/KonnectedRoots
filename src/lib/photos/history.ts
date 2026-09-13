import { getBlob, getStorage, ref } from 'firebase/storage';
import { app } from '@/lib/firebase/clients';
import { uploadPersonPhoto } from '@/lib/uploadPersonPhoto';
import { deleteOwnedPhoto } from './storage';
import { ownedPhotoPath, type PhotoOwner } from './ownership';

/** Session-only image copies let commands restore a retired photo to a NEW object. */
export function createPhotoHistory() {
  const retired = new Map<string, File>();
  return {
    async retain(url: string, owner: PhotoOwner): Promise<boolean> {
      if (retired.has(url)) return true;
      const storage = getStorage(app);
      const path = ownedPhotoPath(url, ref(storage).bucket, owner);
      if (!path) {
        console.info('Photo cleanup skipped: object ownership could not be verified.');
        return false;
      }
      try {
        const blob = await getBlob(ref(storage, path), 5 * 1024 * 1024);
        retired.set(url, new File([blob], 'undo-photo', {type: blob.type}));
        return true;
      } catch {
        console.info('Photo cleanup deferred: undo image could not be retained.');
        return false;
      }
    },
    async restore<T extends {profilePictureUrl?: string}>(person: T, treeId: string, personId: string, persist: (person: T) => Promise<void>, currentUrl?: string): Promise<T> {
      const next = {...person};
      const file = next.profilePictureUrl ? retired.get(next.profilePictureUrl) : null;
      let uploaded: string | undefined;
      if (file) next.profilePictureUrl = uploaded = await uploadPersonPhoto(file, treeId, personId);
      try { await persist(next); }
      catch (error) { if (uploaded) await deleteOwnedPhoto(uploaded, {treeId, personId}); throw error; }
      try {
        if (currentUrl && currentUrl !== next.profilePictureUrl && await this.retain(currentUrl, {treeId, personId})) {
          await deleteOwnedPhoto(currentUrl, {treeId, personId});
        }
      } catch { console.warn('Old undo photo cleanup could not complete.'); }
      return next;
    },
    prune(referenced: Set<string>) {
      for (const url of retired.keys()) if (!referenced.has(url)) retired.delete(url);
    },
    clear() { retired.clear(); },
  };
}
