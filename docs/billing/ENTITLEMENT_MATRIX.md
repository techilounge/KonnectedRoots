# Entitlement matrix

These are the capabilities resolved by the server entitlement engine. A UI
indicator is never the authorization boundary for an operation that uses server
resources.

| Capability | Free | Pro | Family | Pro + AI Pack | Family + AI Pack |
| --- | --- | --- | --- | --- | --- |
| Trees | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| People/tree | 500 | Unlimited | Unlimited | Unlimited | Unlimited |
| Tree collaborators | 2, viewer role | 10, viewer/editor/manager | 20, viewer/editor/manager | 10, viewer/editor/manager | 20, viewer/editor/manager |
| Family billing seats | 0 | 0 | 6 (owner + 5) | 0 | 6 (owner + 5) |
| Visual exports | 2/month, watermark | Unlimited, no watermark | Unlimited, no watermark | Unlimited, no watermark | Unlimited, no watermark |
| GEDCOM import/export | No | Yes | Yes | Yes | Yes |
| Storage quota | 1 GB | 50 GB | 100 GB shared | 50 GB | 100 GB shared |
| Base AI actions/month | 10 | 200 | 600 pooled | 200 | 600 pooled |
| AI Pack allowance | N/A | N/A | N/A | +1,000 | +1,000 |
| Relationship Finder | Deterministic/local, free | Deterministic/local, free | Deterministic/local, free | Deterministic/local, free | Deterministic/local, free |

Family seats are account/workspace seats. Tree members and collaborators are
separate concepts; an editor does not automatically consume a Family seat.
Every collaboration decision still requires both the tree role and the
resolved account/workspace entitlement.

The server preserves existing trees, people and files after downgrade. It
blocks new paid-capability usage when the new limits are exceeded. It does not
delete data to enforce a quota.
