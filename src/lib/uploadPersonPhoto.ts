import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from '@/lib/firebase/clients';

const storage = getStorage(app);

export async function uploadPersonPhoto(file: File, treeId: string, personId: string) {
  if (!file) throw new Error("No file selected");
  if (!file.type.startsWith("image/")) throw new Error("Only images are allowed");
  if (file.size > 5 * 1024 * 1024) throw new Error("Max file size is 5MB");

  // (Optionally sanitize the filename)
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `trees/${treeId}/people/${personId}/${safeName}`;
  const objectRef = ref(storage, path);

  // CRITICAL: send proper metadata so the Storage rule's image check passes
  const metadata = { contentType: file.type, cacheControl: "public,max-age=3600" };

  await uploadBytes(objectRef, file, metadata);
  return await getDownloadURL(objectRef);
}
