# Entitlement matrix

These are the capabilities resolved by the server entitlement engine. A UI
indicator is never the authorization boundary for an operation that uses server
resources.

| Capability | Free | Pro | Family | Pro + AI Pack | Family + AI Pack |
| --- | --- | --- | --- | --- | --- |
| Trees | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| People/tree | 500 | Unlimited | Unlimited | Unlimited | Unlimited |
| Tree collaborators | 2, up to 1 Editor and remaining Viewers | 10, viewer/editor/manager | 20, viewer/editor/manager | 10, viewer/editor/manager | 20, viewer/editor/manager |
| Family billing seats | 0 | 0 | 6 (owner + 5) | 0 | 6 (owner + 5) |
| Visual exports | 2/month, watermark | Unlimited, no watermark | Unlimited, no watermark | Unlimited, no watermark | Unlimited, no watermark |
| GEDCOM import/export | Yes, no visual quota | Yes, no visual quota | Yes, no visual quota | Yes, no visual quota | Yes, no visual quota |
| Storage quota target | 1 GB (counter reconciliation pending) | 50 GB (counter reconciliation pending) | 100 GB shared (Family enforcement deferred) | 50 GB (counter reconciliation pending) | 100 GB shared (Family enforcement deferred) |
| Base AI actions/month | 10 | 200 | 600 pooled | 200 | 600 pooled |
| AI Pack allowance | N/A | N/A | N/A | +1,000 | +1,000 |
| Relationship Finder | Deterministic/local, free | Deterministic/local, free | Deterministic/local, free | Deterministic/local, free | Deterministic/local, free |

Family seats are account/workspace seats. Tree members and collaborators are
separate concepts; an editor does not automatically consume a Family seat.
Every collaboration decision still requires both the tree role and the
resolved account/workspace entitlement.

The storage values above are product targets. Storage Rules select the
server-owned user or Family counter and handle replacement deltas, but current
upload/delete paths do not maintain those counters atomically. Full quota
enforcement and reconciliation therefore remain Phase 3/4 work.

GEDCOM is data portability on every plan. It does not consume the monthly
PNG/PDF allowance, require a paid plan, or add premium formatting. Free trees
allow two non-owner collaborators, with at most one Editor and the remaining
collaborator(s) as Viewers. Pro and Family collaboration roles and limits are
unchanged. Invitation creation and acceptance enforce these limits server-side;
Family account seats remain a separate concept.

The server preserves existing trees, people and files after downgrade. It
blocks new paid-capability usage when the new limits are exceeded; exact
storage blocking remains deferred until counters are maintained atomically. It
does not delete data to enforce a quota.
