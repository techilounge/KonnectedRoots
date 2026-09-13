async function cleanupSafely(cleanup: (url: string) => Promise<unknown>, url: string) {
  try { await cleanup(url); }
  catch { console.warn('Photo cleanup could not complete.'); }
}

/** Upload and persist first. Cleanup failure must never undo a successful save. */
export async function savePersonPhoto<T extends {profilePictureUrl?: string}>(options: {
  person: T;
  pending: File | null;
  oldUrl?: string;
  upload: (file: File) => Promise<string>;
  persist: (person: T) => Promise<boolean>;
  cleanup: (url: string) => Promise<unknown>;
  retainForUndo: (url: string) => Promise<boolean>;
}): Promise<boolean> {
  let uploaded: string | undefined;
  const person = {...options.person};
  try {
    if (options.pending) person.profilePictureUrl = uploaded = await options.upload(options.pending);
    if (!await options.persist(person)) throw new Error('Changes were not saved. Please try again.');
  } catch (error) {
    if (uploaded) await cleanupSafely(options.cleanup, uploaded);
    throw error;
  }
  if (options.oldUrl && options.oldUrl !== person.profilePictureUrl) {
    // Keep a local copy for photo undo/redo before retiring the original object.
    try {
      if (await options.retainForUndo(options.oldUrl)) await options.cleanup(options.oldUrl);
    } catch { console.warn('Old person photo cleanup could not complete.'); }
  }
  return true;
}

/** Auth and Firestore cannot share a transaction. Compensate a failed second save. */
export async function saveAccountPhoto(options: {
  oldUrl: string | null;
  oldName: string | null;
  name: string;
  pending: File | null;
  remove: boolean;
  upload: (file: File) => Promise<string>;
  saveAuth: (name: string | null, url: string | null) => Promise<void>;
  saveDocument: (url: string | null) => Promise<void>;
  cleanup: (url: string) => Promise<unknown>;
}): Promise<string | null> {
  let uploaded: string | undefined;
  let authSaved = false;
  const url = options.remove ? null : options.pending ? uploaded = await options.upload(options.pending) : options.oldUrl;
  try {
    await options.saveAuth(options.name, url);
    authSaved = true;
    await options.saveDocument(url);
  } catch (error) {
    let reverted = !authSaved;
    if (authSaved) {
      try { await options.saveAuth(options.oldName, options.oldUrl); reverted = true; }
      catch { console.warn('Profile rollback could not complete; uploaded photo retained to protect its Auth reference.'); }
    }
    if (uploaded && reverted) await cleanupSafely(options.cleanup, uploaded);
    throw error;
  }
  if (options.oldUrl && options.oldUrl !== url) await cleanupSafely(options.cleanup, options.oldUrl);
  return url;
}
