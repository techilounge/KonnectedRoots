/**
 * One-time script to sync memberCount for all family trees.
 * 
 * This script counts the actual people in each tree's subcollection
 * and updates the memberCount field in the tree document.
 * 
 * Usage: npx tsx scripts/sync-member-counts.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin
// Try to load service account from common locations
const serviceAccountPaths = [
    './service-account.json',
    './serviceAccountKey.json',
    '../service-account.json',
];

let serviceAccountPath: string | null = null;
for (const p of serviceAccountPaths) {
    const fullPath = path.resolve(__dirname, p);
    if (fs.existsSync(fullPath)) {
        serviceAccountPath = fullPath;
        break;
    }
}

if (!getApps().length) {
    if (serviceAccountPath) {
        const serviceAccount = require(serviceAccountPath);
        initializeApp({
            credential: cert(serviceAccount),
        });
        console.log('✅ Initialized with service account');
    } else {
        // Fallback to application default credentials (for Cloud Run, etc.)
        initializeApp();
        console.log('✅ Initialized with default credentials');
    }
}

const db = getFirestore();

async function syncMemberCounts() {
    console.log('\n🔄 Starting member count sync...\n');

    try {
        // Get all trees
        const treesSnapshot = await db.collection('trees').get();

        if (treesSnapshot.empty) {
            console.log('No trees found.');
            return;
        }

        console.log(`Found ${treesSnapshot.size} tree(s) to process.\n`);

        let updated = 0;
        let skipped = 0;

        for (const treeDoc of treesSnapshot.docs) {
            const treeId = treeDoc.id;
            const treeData = treeDoc.data();
            const treeName = treeData.title || 'Unnamed Tree';

            // Count people in the subcollection
            const peopleSnapshot = await db
                .collection('trees')
                .doc(treeId)
                .collection('people')
                .get();

            const actualCount = peopleSnapshot.size;
            const storedCount = treeData.memberCount ?? 0;

            if (actualCount !== storedCount) {
                // Update the tree document
                await db.collection('trees').doc(treeId).update({
                    memberCount: actualCount,
                });
                console.log(`✅ "${treeName}": ${storedCount} → ${actualCount} members`);
                updated++;
            } else {
                console.log(`⏭️  "${treeName}": Already correct (${actualCount} members)`);
                skipped++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`🎉 Sync complete!`);
        console.log(`   Updated: ${updated} tree(s)`);
        console.log(`   Skipped: ${skipped} tree(s) (already correct)`);
        console.log('='.repeat(50) + '\n');

    } catch (error) {
        console.error('❌ Error syncing member counts:', error);
        process.exit(1);
    }
}

// Run the sync
syncMemberCounts().then(() => process.exit(0));
