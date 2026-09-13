import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from '@/lib/firebase/clients';
import { prepareStorageUpload } from '@/lib/billing/storage';
import { photoPrefix, uniquePhotoName, validatePhoto } from '@/lib/photos/ownership';

const storage = getStorage(app);

export async function uploadPersonPhoto(file: File, treeId: string, personId: string) {
  validatePhoto(file);

  // (Optionally sanitize the filename)
  const path = photoPrefix({treeId, personId}) + uniquePhotoName(file.type);
  const objectRef = ref(storage, path);

  // CRITICAL: send proper metadata so the Storage rule's image check passes
  const metadata = { contentType: file.type, cacheControl: "public,max-age=3600" };

  await prepareStorageUpload(treeId);
  await uploadBytes(objectRef, file, metadata);
  try { return await getDownloadURL(objectRef); }
  catch (error) {
    await deleteObject(objectRef).catch(() => console.warn('New photo cleanup could not complete.'));
    throw error;
  }
}
