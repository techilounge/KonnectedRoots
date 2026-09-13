export type PhotoOwner = {uid: string} | {treeId: string; personId: string};

const identifier = /^[A-Za-z0-9_-]+$/;
export function photoPrefix(owner: PhotoOwner): string {
  const ids = 'uid' in owner ? [owner.uid] : [owner.treeId, owner.personId];
  if (ids.some(id => !identifier.test(id))) throw new Error('Invalid photo owner');
  return 'uid' in owner ? `users/${owner.uid}/profile/` : `trees/${owner.treeId}/people/${owner.personId}/`;
}

/** Accept only unambiguous Firebase download URLs in our configured bucket. */
export function ownedPhotoPath(value: string | null | undefined, bucket: string | undefined, owner: PhotoOwner): string | null {
  if (!value || !bucket || !/^[a-z0-9][a-z0-9.-]*$/.test(bucket) || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || url.port || url.username || url.password || url.hash) return null;
    // Inspect the raw path too: URL normalizes dot segments before exposing pathname.
    const raw = value.match(/^https:\/\/firebasestorage\.googleapis\.com(\/[^?#]*)/);
    if (!raw || raw[1] !== url.pathname) return null;
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
    if (!match || match[1] !== bucket) return null;
    const path = decodeURIComponent(match[2]);
    if (encodeURIComponent(path).toLowerCase() !== match[2].toLowerCase()) return null;
    const prefix = photoPrefix(owner);
    if (!path.startsWith(prefix)) return null;
    const name = path.slice(prefix.length);
    // Legacy sanitized file names, including spaces, are supported; no nested paths,
    // second decoding, dot segments, or ambiguous platform separators.
    if (!name || name === '.' || name === '..' || /[%/\\\u0000-\u001f\u007f]/.test(name)) return null;
    return path;
  } catch { return null; }
}

export function uniquePhotoName(type: string): string {
  const extension = ({'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp'} as Record<string, string>)[type];
  if (!extension) throw new Error('Choose a JPEG, PNG, GIF, or WebP image.');
  return `${crypto.randomUUID()}.${extension}`;
}

export function validatePhoto(file: Blob) {
  if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, GIF, or WebP image.');
  if (!file.size || file.size >= 5 * 1024 * 1024) throw new Error('Image must be smaller than 5 MiB.');
}
