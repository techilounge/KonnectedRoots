# Firebase browser configuration

`src/lib/firebase/clients.ts` reads `NEXT_PUBLIC_FIREBASE_API_KEY`. Current tracked source contains no literal production browser key. A Firebase browser API key identifies an application/project and is public configuration, not an Admin credential. Access to user data must still be enforced by Firebase Auth and security rules.

The owner reports these restrictions and a successful Google sign-in after applying them. This task did not independently inspect Google Cloud restrictions.

1. In Google Cloud Console choose project `konnectedroots-u5xtb`, then **APIs & Services → Credentials**.
2. Open the Firebase browser key that matches the web app configuration; do not edit the Gemini/server key.
3. Under application restrictions select **Websites**, preserving:
   - `https://konnectedroots.app/*`
   - `https://www.konnectedroots.app/*`
   - `https://konnectedroots-u5xtb.firebaseapp.com/*`
   - `https://konnectedroots-u5xtb.web.app/*`
4. Under API restrictions permit only required Firebase-related APIs. **Never include Generative Language API** on this browser key.
5. Keep Firebase Auth handler domains. Preview testing requires the specific trusted preview host in both website restrictions and Firebase Auth authorized domains; avoid allowing every unrelated Vercel tenant.
6. Save, wait for propagation, and test Google sign-in and normal Firebase reads/writes. Do not remove restrictions to resolve a failure without finding its cause.

There is no global Firebase-key Gitleaks exemption. Historical browser-key alerts require narrow, documented classification; they must not hide a Gemini key with the same prefix.
