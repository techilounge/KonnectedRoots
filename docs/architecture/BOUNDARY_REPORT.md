# Phase 1 boundary review

| Area | Evidence / correction | Remaining limitation |
| --- | --- | --- |
| Firebase Admin | Existing server-only guard preserved; canonical private env import guarded; production build validates module graph | Runtime privileged operations still require real server credentials |
| Public config | Public-only config barrel, explicit NEXT_PUBLIC reads; browser missing-config errors name fields only | Public values require rebuild when changed |
| Server billing | Added explicit server-only guard to serverUsage | Public billing barrel still includes browser IO; use explicit server imports |
| AI secrets/providers | Existing guards preserved; private env getters centralized; no secrets exported by client config | Legacy Google environment fallback retained; accepted OTel graph remains disabled |
| Stripe/Resend | Functions-only dependencies/imports; standalone typed Functions config; safe email failure messages; seven tests pass under Node 20 | No deployed Functions or secret binding changes |
| Logging | Removed GEDCOM family/person debug dumps; Next AI/upload/contact failures log allowlisted classifications and return generic messages | Legacy admin/trigger logs need further personal-data/error-shape review |
| Upload exception | Current browser uploader enforces image type/size and Storage rules | Uncalled legacy server upload action uses browser SDK; retained pending endpoint review |
| Client components | Interactive client boundaries retained; metadata/static layout modules remain server components | No speculative conversion of hook/Radix/Firebase components |
| Domain types | Duplicate Invitation interfaces consolidated; RelationshipType aliases Relationship | User/billing timestamp, team-plan and entitlement schema drift deferred; no persisted-data migration |

Build compilation and typechecking succeeded with `server-only` guards in place. Regression tests verify private metadata redaction, public config projection and sanitized logs. This is not a substitute for deployed IAM/Firestore rules testing or a full third-party security audit.
