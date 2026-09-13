import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/clients';

// Initialize/refresh only the selected tree owner's server-owned projection.
// Quota and tree-role enforcement still happen in Storage Rules on every write.
export async function prepareStorageUpload(treeId?: string): Promise<void> {
  const prepare = httpsCallable(functions, 'prepareStorageUpload');
  await prepare(treeId === undefined ? {} : { treeId });
}
