# Invitation onboarding and photo cleanup: local review record

Date: 2026-09-13. Branch: `codex/fix-invite-onboarding-photo-cleanup`.
Base/HEAD: `1f7c37282277523f32f7245d39089b7deefe6d95`, current rewritten master/production.
Status: implemented locally; owner review and browser validation pending. No commit, push, PR, deployment, merge, Stripe mutation, billing emulator reset, or production configuration change.

## Invitation findings and flows

The page checked email mismatch only after Accept, always sent signed-out invitees to Login, and offered no account-switch continuation. Email/password and Google helpers unconditionally navigated to Dashboard; Login/Signup links discarded invitation context.

`createInvitation` already writes `inviteeUid`; `onUserCreated` links matching pending invitations. Both previously relied on editable profile emails. Creation now uses Firebase Admin Auth identity lookup only after owner/manager authorization for that specific tree. Linking reads that UID's actual Firebase Auth email. No arbitrary browser email query, unauthenticated lookup, or account-discovery endpoint was added. Unrelated user-profile read policy was not expanded.

The page subscribes to its specific invitation so trusted linking appears without a resend:

| State | Behavior |
| --- | --- |
| Signed out, linked UID | Tree/inviter/role summary; **Sign In to Accept**, Login with the invitation redirect |
| Signed out, no linked UID | New-user explanation; **Create Account to Accept**, Signup with the invitation redirect |
| Matching authenticated email | Accept and confirmed Decline; trusted acceptance then tree navigation |
| Wrong authenticated email | Invited/current email shown immediately; no Accept/Decline; confirmed **Sign Out & Continue** returns to the same invitation, or **Go to Dashboard** |
| Registered after invitation | Normal profile initialization and trusted pending-invitation linking; return to the invitation and explicitly Accept; no resend |

Email/password and existing/new Google auth use the same validated redirect. Wrong signup/Google email returns to mismatch and grants no access. Login ↔ Signup links retain the validated redirect; Signup has invitation-aware copy. No redirect defaults to `/dashboard`.

`sanitizeAuthRedirect` accepts local routes beginning with one slash. It checks repeated percent decoding and URL normalization; external schemes, protocol-relative paths, backslashes, controls/whitespace, malformed/excessive encoding, and normalized protocol-relative paths fall back to Dashboard. Redirect is a navigation hint, never identity evidence. No email query parameter is introduced or trusted.

Signup/Google initialization creates the ordinary non-privileged profile. A transaction prevents the Auth observer/signup race from overwriting an already initialized profile. Signup does not invoke acceptance, create membership, or grant paid billing/AI/storage entitlement.

Only trusted `acceptInvitation` creates collaborator membership. Existing email, inviter-authority, role and cap checks remain. Acceptance re-reads the pending invitation inside its membership transaction; cancellation/decline/status changes conflict with acceptance rather than granting access through a stale read.

Decline remains a confirmed client delete enforced by Rules, using normalized authenticated email rather than a stale/spoofed linked UID. Anonymous/unrelated accounts cannot decline. Inviter cancellation and platform-admin authority remain. A wrong-account inviter sees no Decline action but can still cancel their own invitation through ShareDialog. Emailed invitation-ID document reads remain available; public/unscoped listing is denied. Existing inviter-scoped listing/resend/cancel is preserved.

## Photos, failures and undo

Account **Remove Photo** is conditional and confirmed. It stages removal/default preview; **Apply Changes** clears Auth `photoURL` and Firestore `photoURL` (empty string), then deletes owned old objects. Cancel keeps the original. Replacement uploads a unique new object, resolves its URL, saves Auth and Firestore, then cleans different owned previous references. Successful saves immediately refresh the displayed profile. The hook captures the user/UID and rejects a changed session or another in-flight profile update.

Auth and Firestore cannot share an atomic transaction. If the second save fails, Auth is compensated to the previous name/photo and the new object is deleted best-effort; the previous Firestore reference/old object remains. If Auth compensation fails, the new object is deliberately retained because Auth may reference it; the operation reports failure with only a static safe log. Cleanup failure after successful persistence never rolls back new state. Download-URL failure cleans the just-created known object best-effort. External Google/OAuth images are cleared from references but never passed to Storage deletion.

Person image selection validates/compresses locally and keeps a pending File and revocable object-URL preview, with no upload. Reselection replaces pending state. Cancel/close discards pending data and revokes previews; late preparation completion is ignored. Original Firestore/Storage state remains.

Save uploads the pending File, awaits the parent's `Promise<boolean>` persistence result, then cleans the different owned old image. Person data and tree `lastUpdated` are batched atomically. Missing `profilePictureUrl` uses explicit `deleteField`, so merge does not retain it. Other fields, relationships, member data and adding people are preserved. Failure keeps the editor open with edits/preview and a useful error; a newly uploaded object is cleaned best-effort and old persisted references remain.

Person **Remove** is confirmed and staged: discard pending image, show placeholder, disable Enhance. Remove + Cancel keeps the original; Remove + Save persists absence before cleanup. Enhance cannot act on a placeholder. Pending local images can be enhanced; returned image data is staged as a File for the same save path. AI routing/credentials were not changed.

Undo/redo retains session-only local image copies before retiring old objects. Restoring a retired photo uploads a unique new object before persisting its URL. Failed undo persistence cleans the new object and keeps the command available. Copies are pruned against bounded command references; partial position undo leaves photos untouched. If old-image download fails, including CORS/network failure, old-object cleanup is deferred and logged safely to preserve valid undo. Undo uploads remain subject to current permissions/quota. No exact orphan reconciliation is implemented.

Real Rules testing exposed an existing Editor save failure: the person/tree timestamp batch was denied. Editors now have exactly timestamp-only `lastUpdated` permission using the current server timestamp; arbitrary timestamps, tree metadata, ownership and collaborators remain protected. Owner/Manager permissions remain; Viewer/anonymous writes remain denied by Firestore/Storage.

## Safe ownership and legacy URLs

Deletion accepts only unambiguous HTTPS Firebase download URLs on `firebasestorage.googleapis.com` in the configured Storage instance's exact bucket. Raw and parsed paths must agree; decoded paths must match precisely:

- Account: `users/{authenticatedUid}/profile/{singleFileName}`
- Person: `trees/{treeId}/people/{personId}/{singleFileName}`

Other owners/trees/people/buckets, providers, URL credentials, extra ports/fragments, malformed paths, traversal/dot segments, nested filenames, backslashes/controls, double encoding and ambiguous encoding are rejected. Standard Firebase percent-encoded separators and valid legacy filenames, including spaces, remain supported without migration. Unsafe URLs log a static skip and are never deleted; reference removal can still succeed. Deletion constructs an SDK reference from the validated object path, never arbitrary URL text.

New uploads use `crypto.randomUUID()` plus allowlisted JPEG/PNG/GIF/WebP MIME extension, strictly below 5 MiB. Old objects/URLs and public reads are not migrated.

A unique replacement is a new object until old-object cleanup, so it must fit the existing upload quota. Quota denial preserves the old photo. The unchanged Rules still support equal/shrinking in-place replacements; this task does not fabricate a quota exemption for separately named objects.

## Local validation

| Check | Before | Final |
| --- | --- | --- |
| Root tests | 274/274 | 373/373 |
| Functions tests, existing Node 20 | 263/263 | 273/273 |
| Isolated real Firestore/Storage Rules | 85/85 | 100/100 |
| Root typecheck | Accepted baseline | Passed |
| Root lint | 0 errors / 50 warnings | 0 errors / 50 warnings |
| Local Next.js production build | Accepted baseline | Passed; no deployment |
| Functions build, Node 20 | Accepted baseline | Passed |
| `git diff --check` | Clean | Passed |

Existing node:test/component mocks were used, with no new dependency/framework. Added: 99 root tests for invitation states/redirects/forms/Google/profile/editor/ownership/failures/preparation/undo; 10 Functions lifecycle/identity/cancellation-race tests; 15 Rules tests for persisted membership, authorized client profile creation/linking, decline/cancel/list boundaries, and person/tree writes. Rules tests use only dedicated demo ports/project; Auth/Resend adapters are mocked. This proves actual Firestore persistence/rule evaluation, not provider login or production email.

Gitleaks 8.30.1 scanned all 25 publishable changed files with redaction and decode depth 3: zero findings. The two protected untracked scratch scripts and ignored local secret/generated artifacts are not publishable candidates. Scanner configuration/ignores/suppressions are unchanged.

| Audit scope | Before total / high / critical | After total / high / critical |
| --- | --- | --- |
| Root | 67 / 12 / 0 | 67 / 12 / 0 |
| Root production | 62 / 7 / 0 | 62 / 7 / 0 |
| Functions live | 8 / 0 / 0 | 8 / 0 / 0, all moderate |

Audits used `--offline=false` for those read-only commands only: host offline mode otherwise misleadingly reports zero. npm configuration was not changed. Audit is not clean. Historical accepted Functions checkpoint 9 remains historical. Accepted residual Genkit/OpenTelemetry findings/controls remain; no audit fixes, dependency overrides, ignores or suppressions were added.

## Pending manual QA checklist

All items remain **unexecuted for this local candidate**. Perform after owner review and an owner-authorized deployment; this task does not deploy. Use only disposable QA identities/synthetic trees. Do not delete established successful test accounts or family content.

### Invitation: existing account and switch

1. QA Owner invites an existing QA identity with a known role; confirm invitation email.
2. Keep Owner signed in, open invite, confirm invited/current emails and immediate mismatch; no Accept/Decline.
3. Cancel signout confirmation and confirm session unchanged; then confirm **Sign Out & Continue**.
4. Confirm same invite offers **Sign In to Accept**. Log in using invited email/password; return to same pending invite.
5. Explicitly Accept; verify tree opens, exact persisted role and access after refresh.
6. Separate pending invite: matching invitee confirms Decline; invite is deleted, no membership.
7. Verify ShareDialog inviter cancellation/resend. Wrong unrelated/anonymous clients cannot delete invites or list them.

### Invitation: new account and continuation

1. Invite a never-registered disposable email; sign out and open link.
2. Verify summary/new-user copy and **Create Account to Accept**, with same invitation redirect on Signup.
3. Switch Signup → Login → Signup; retain redirect each time. Repeat starting from existing-account Login.
4. Register with invited email; confirm ordinary profile initialization, no paid entitlement, and return to same invite.
5. Confirm pending invitation and no collaborators entry before explicit Accept. Linking can arrive asynchronously; no resend.
6. Explicitly Accept; verify exact role/tree/persistent access after refresh.
7. Separate invite: register/sign in with wrong email; mismatch, invite still pending, no membership. Recover with confirmed account switch.
8. Verify generic auth without redirect and malicious redirect hints land on Dashboard.

### Google

1. Matching existing Google QA identity: return to invite; explicitly Accept.
2. New matching Google QA identity: normal profile, pending invitation, explicit Accept, exact persisted role.
3. Wrong Google identity: mismatch, no membership/decline; recover with account switch.
4. Popup cancellation must not mutate/accept. Provider/referrer configuration is unchanged.

### Roles and photos

1. QA Viewer: tree opens; Add/Edit/Photo/Remove unavailable/denied, including direct Firestore/Storage attempts.
2. QA Editor: save edit/photo and verify tree timestamp/persistence. Repeat relevant photo actions as Owner/Manager.
3. Profile replacement: small QA image → Apply Changes → refresh; confirm new image/reference and owned old cleanup after persistence.
4. Profile removal: confirm → default preview → Apply Changes → refresh; cleared Auth/Firestore/default avatar. Remove + Cancel retains original.
5. External Google avatar removal clears reference and makes no provider-URL Storage deletion.
6. Person with photo: select/reselect then Cancel/close; reopen/refresh; original unchanged and no new object. Remove + Cancel likewise.
7. Person replacement + Save → refresh; new photo, owned old cleanup. Remove + Save → refresh; initials/no reference.
8. No-photo Enhance disabled. Enhance pending QA image if configured; Cancel/Save respects staging.
9. Photo/field undo/redo preserves valid images/details. Check CORS allows retaining old images; failure safely defers cleanup.
10. Controlled local faults: upload/save failure preserves old reference, editor/edits stay open, new object cleaned best-effort; old cleanup failure keeps successful save.
11. Confirm no unauthorized/Storage errors on legitimate actions. Clean only disposable QA tree/invitations created by this checklist using existing confirmations.

## Scope, status and follow-ups

Phase 2 billing/Stripe, paid entitlement amounts, storageAuthority, `prepareStorageUpload`, storage.rules, quota precedence/amounts, growth accounting, public reads, image size rule, server-owned counters, conservative floors and delete-above-quota are unchanged. PR #4 exports, secrets/Resend bindings, Node runtime, production configuration/history/P0 closure are untouched. No general account enumeration was introduced.

The unrelated `startTime` console error was not investigated/fixed and remains a separate follow-up defect. Browser auth/Google/image/CORS validation is pending. Protected scratch scripts remain SHA-256 identical and untracked; dependency manifests/locks and storage.rules remain byte-identical. Candidate files are unstaged/uncommitted and HEAD remains the base.

Proposed commit message, not executed: `fix(ux): improve invite onboarding and photo cleanup`
