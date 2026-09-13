const PROJECT_ID = 'demo-konnectedroots-phase2';

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (projectId !== PROJECT_ID ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
  throw new Error(`Refusing to reset: set the exact local emulator hosts and GCLOUD_PROJECT=${PROJECT_ID}.`);
}

const endpoints = [
  `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`,
  `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
];

for (const endpoint of endpoints) {
  const response = await fetch(endpoint, {method: 'DELETE'});
  if (!response.ok) throw new Error(`Local emulator reset failed with HTTP ${response.status}.`);
}

console.log(`Cleared Auth and Firestore emulator state for ${PROJECT_ID}.`);
