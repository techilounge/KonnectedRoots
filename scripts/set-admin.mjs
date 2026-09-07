#!/usr/bin/env node
/**
 * KonnectedRoots Platform Admin Provisioning Script
 * 
 * Usage:
 *   node scripts/set-admin.mjs <user_email> [role: admin|super_admin]
 *   npm run set-admin <user_email> [role: admin|super_admin]
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const email = process.argv[2];
const role = process.argv[3] || 'super_admin';

if (!email) {
  console.error('\x1b[31mError: Please provide a user email address.\x1b[0m');
  console.log('\nUsage:');
  console.log('  node scripts/set-admin.mjs <user_email> [admin|super_admin]');
  console.log('  npm run set-admin <user_email>\n');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
let credential;

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  credential = admin.credential.cert(serviceAccount);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
} else {
  credential = admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'konnectedroots-u5xtb',
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function setPlatformAdmin() {
  try {
    console.log(`\x1b[36mLooking up user by email: ${email}...\x1b[0m`);
    const user = await auth.getUserByEmail(email);

    console.log(`Found user: ${user.displayName || 'No Name'} (UID: ${user.uid})`);

    // 1. Set Custom Claims in Firebase Auth
    const customClaims = {
      admin: true,
      role: role,
    };
    await auth.setCustomUserClaims(user.uid, customClaims);
    console.log(`\x1b[32m✔ Firebase Auth custom claims set: admin=true, role=${role}\x1b[0m`);

    // 2. Update Firestore User Document
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();

    const updates = {
      role: role,
      isPlatformAdmin: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (userDoc.exists) {
      await userRef.update(updates);
    } else {
      await userRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        plan: 'family',
        entitlements: {
          maxTrees: 100,
          maxPeoplePerTree: 10000,
          aiCreditsMonthly: 1000,
          exports: { pdf: true, png: true, gedcom: true },
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...updates,
      });
    }
    console.log(`\x1b[32m✔ Firestore users/${user.uid} document updated: role=${role}, isPlatformAdmin=true\x1b[0m`);

    // 3. Record in audit_logs
    await db.collection('audit_logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminUid: 'SYSTEM_CLI',
      adminEmail: 'cli-provisioning@konnectedroots.internal',
      action: 'PLATFORM_ADMIN_PROMOTED',
      category: 'security',
      targetId: user.uid,
      targetType: 'user',
      details: `User ${user.email} promoted to Platform Admin with role: ${role}`,
      metadata: {
        targetEmail: user.email,
        assignedRole: role,
        method: 'CLI_SCRIPT',
      },
    });
    console.log(`\x1b[32m✔ Audit log entry recorded in audit_logs collection\x1b[0m`);

    console.log('\n======================================================');
    console.log(`\x1b[32mSUCCESS: ${user.email} is now a Platform Admin (${role})!\x1b[0m`);
    console.log('The user may access the Admin Portal at /admin upon signing in.');
    console.log('If the user is currently signed in, ask them to sign out and back in to refresh token claims.');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\x1b[31mFailed to provision platform admin:\x1b[0m', error);
    process.exit(1);
  }
}

setPlatformAdmin();
