# Manual Git-history remediation plan

Status: **PREPARED, NOT EXECUTED**. Do not run against the active working repository. Do not force-push, delete branches or change visibility as part of this code task. Rewriting history cannot revoke a key or remove independent forks/clones.

Scope: the rotated/deleted Firebase Admin private-key credential (including encoded JSON), the owner-confirmed rotated Stripe webhook signing secret, any additional true GitHub Secret Scanning findings, and any historical AI/Gemini credential **only if actually identified**. No AI credential was identified by the local audit. Restricted Firebase browser configuration is not a private credential. Do not redact all `AIza` strings or suppress all Google API-key alerts.

## Preparation and maintenance window

1. Owner confirms revocation/rotation and replacement deployment health. Privately reconcile all GitHub secret alerts with the incident record, including the Stripe alert not reproduced by local Gitleaks.
2. Freeze pushes, merges, bots and releases. Notify collaborators; record active PR numbers, base/head commits, branches/tags, release targets, Vercel deployment commits and integration settings. PR commit references may break after rewriting.
3. In a private directory outside any repository, record `git ls-remote --heads --tags https://github.com/techilounge/KonnectedRoots.git` to a restricted file. Make a separate fresh mirror backup and a bundle; treat both as sensitive because they preserve leaked material. Never upload them as public artifacts.
4. Install current git-filter-repo from its official release and verify the installation. Use a separate fresh mirror for the rewrite. The following commands are a **manual runbook**, not commands executed by this task:

```bash
git clone --mirror https://github.com/techilounge/KonnectedRoots.git protected-backup.git
git -C protected-backup.git bundle create ../protected-backup.bundle --all
git clone --mirror https://github.com/techilounge/KonnectedRoots.git cleanup.git
cd cleanup.git
git for-each-ref --format='%(refname) %(objectname)' > ../refs-before.txt
```

## Operator-supplied replacements

5. Create a restricted temporary replacement file **outside every repository**. Insert actual values privately from approved incident evidence, never from this document and never into a tracked script. Include the complete old encoded fallback blob, full old JSON if needed, and the old signing secret. Avoid broad patterns deleting safe variable references. Template syntax only:

```text
literal:OPERATOR_SUPPLIED_OLD_ENCODED_CREDENTIAL==>REMOVED_REVOKED_CREDENTIAL
literal:OPERATOR_SUPPLIED_OLD_SIGNING_SECRET==>REMOVED_REVOKED_CREDENTIAL
```

Do not run these placeholder rules as if they contain real evidence. A multiline PEM requires correct git-filter-repo escaped regex syntax or removal of a dedicated historical credential file; verify every actual representation including JSON-escaped newlines and Base64. For a dedicated secret-only file, use `git filter-repo --path path/to/historical-secret.json --invert-paths`. Do not remove all of `src/lib/firebase/admin.ts`: preserve the current secure loader and other history where possible.

6. Apply the private file in the disposable mirror:

```bash
git filter-repo --replace-text /ABSOLUTE/PRIVATE/replacements.txt
git for-each-ref --format='%(refname) %(objectname)' > ../refs-after.txt
```

7. Review filter-repo's commit mapping, branch/tag names and release targets. Compare names against refs-before; changed commit IDs are expected, lost branches/tags are not. Tags/signatures may require re-signing. Do not push if any required ref is missing.
8. Scan rewritten refs: `gitleaks git . --log-opts="--all" --redact=100 --max-decode-depth=3 --config=/ABSOLUTE/PATH/TO/REVIEWED/.gitleaks.toml`. Independently verify exact incident strings are absent using a private scanner that prints only counts/locations, including blobs and commit messages. No full secret output or command-line history containing secrets. Review any public Firebase-key findings individually. Do not count a browser-key alert as a leaked private credential, but reconcile it before declaring the scan clean; any suppression must be narrowly scoped and documented.
9. Clone the rewritten mirror into a disposable normal worktree and run typecheck, lint, tests, build and dependency audit. Compare the current tree with the approved sanitized version, excluding the intended redactions. Verify the Stripe incident target was actually removed; local Gitleaks non-detection alone is insufficient evidence.

## Owner-only publication, not authorized for automation

10. Owner rechecks the remote refs against the freeze snapshot; stop if collaborators pushed. Arrange the smallest temporary ruleset bypass for the maintenance window. git-filter-repo may remove origin; if absent, owner adds the verified URL below.

```bash
git remote add origin https://github.com/techilounge/KonnectedRoots.git
# DESTRUCTIVE: owner manually runs only after all verification and coordination.
git push --force --mirror origin
```

`--mirror` can remove remote refs absent locally, including branches/tags. This is why exact ref inventory and owner review are mandatory. GitHub-managed PR refs may reject updates and require GitHub Support cleanup. Do not treat a partial push as complete. This task does not execute any push or branch deletion.

11. Restore protections immediately. Require everyone to re-clone; do not merge or push from stale clones. Recreate/rebase active PR work onto clean history without bringing old objects back.
12. Ask GitHub Support about cached views/PR refs containing sensitive data. Re-run Secret Scanning, CodeQL and Gitleaks. Verify GitHub Apps, Vercel production/preview deploys, deployment hooks, authentication, webhook processing and AI vault connectivity. Keep incident CONTAINED until these checks and evidence reconciliation finish.
13. Securely dispose of replacement files and stale clones per owner retention policy. Keep any required forensic backup encrypted and access-restricted.

## Recovery

If verification fails before publication, discard only the disposable mirror after confirming its absolute path; create another fresh mirror and correct rules. Never rewrite the protected backup. If publication partially fails, stop writes, preserve refs/logs, and use the backup/ref inventory with the owner and GitHub Support to recover missing branches. Restoring old refs reintroduces revoked secret material: prefer restoring sanitized equivalents using the commit map, not blindly pushing the old mirror. Document any exceptional restoration and repeat cleanup and scans before reopening collaboration.

Reference: [GitHub sensitive-data removal guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
