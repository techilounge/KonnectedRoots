# High and critical dependency inventory — 2026-09-09

Network-backed npm audit baseline; package counts include inherited findings, not distinct CVEs. GHSA links are the advisory identifiers. Versions and dev flags come from the original post-rewrite lockfiles. No historical source or credentials are included.

Minimum versions below are the first published stable version at or above the installed version outside all directly reported advisory ranges for that package. This is audit-specific, not a guarantee against unknown vulnerabilities. Parent-only findings require the child fixes listed under “Via”; no independent safe parent version can be inferred from npm’s `*` range. Breaking means a major change (or a 0.x minor change); parent migrations may impose additional changes.

## root

### @genkit-ai/core — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@genkit-ai/core` | 1.27.0 | production | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: @genkit-ai/firebase, @opentelemetry/core, @opentelemetry/exporter-jaeger, @opentelemetry/sdk-metrics, @opentelemetry/sdk-node, @opentelemetry/sdk-trace-base, express.


### @genkit-ai/firebase — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@genkit-ai/firebase` | 1.27.0 | production | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: @genkit-ai/google-cloud, @google-cloud/firestore, genkit.


### @genkit-ai/google-cloud — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@genkit-ai/google-cloud` | 1.27.0 | production | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: @google-cloud/opentelemetry-cloud-monitoring-exporter, @google-cloud/opentelemetry-cloud-trace-exporter, @google-cloud/opentelemetry-resource-util, @opentelemetry/auto-instrumentations-node, @opentelemetry/core, @opentelemetry/instrumentation-pino, @opentelemetry/resources, @opentelemetry/sdk-metrics, @opentelemetry/sdk-node, @opentelemetry/sdk-trace-base, genkit.


### @genkit-ai/telemetry-server — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@genkit-ai/telemetry-server` | 1.27.0 | dev-only | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: @genkit-ai/tools-common, @google-cloud/firestore, @opentelemetry/core, @opentelemetry/sdk-metrics, @opentelemetry/sdk-node, @opentelemetry/sdk-trace-base, express.


### @genkit-ai/tools-common — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@genkit-ai/tools-common` | 1.27.0 | dev-only | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: adm-zip, express, uuid.


### @grpc/grpc-js — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@firebase/firestore/node_modules/@grpc/grpc-js` | 1.9.15 | production | 1.9.16 | No |
| `node_modules/@grpc/grpc-js` | 1.13.3 | production | 1.13.5 | No |

Via: direct advisories below.

- [GHSA-5375-pq7m-f5r2](https://github.com/advisories/GHSA-5375-pq7m-f5r2) — **high**: @grpc/grpc-js: A malformed request can cause a server crash. Affected: `>=1.13.0 <1.13.5`.
- [GHSA-5375-pq7m-f5r2](https://github.com/advisories/GHSA-5375-pq7m-f5r2) — **high**: @grpc/grpc-js: A malformed request can cause a server crash. Affected: `<1.9.16`.
- [GHSA-99f4-grh7-6pcq](https://github.com/advisories/GHSA-99f4-grh7-6pcq) — **high**: @grpc/grpc-js: An incoming malformed compressed message can cause a client or server crash. Affected: `>=1.13.0 <1.13.5`.
- [GHSA-99f4-grh7-6pcq](https://github.com/advisories/GHSA-99f4-grh7-6pcq) — **high**: @grpc/grpc-js: An incoming malformed compressed message can cause a client or server crash. Affected: `<1.9.16`.

### @hono/node-server — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@hono/node-server` | 1.19.7 | dev-only | 1.19.15 | No |

Via: direct advisories below.

- [GHSA-wc8c-qw6v-h7f6](https://github.com/advisories/GHSA-wc8c-qw6v-h7f6) — **high**: @hono/node-server has authorization bypass for protected static paths via encoded slashes in Serve Static Middleware. Affected: `<1.19.10`.
- [GHSA-92pp-h63x-v22m](https://github.com/advisories/GHSA-92pp-h63x-v22m) — **moderate**: @hono/node-server: Middleware bypass via repeated slashes in serveStatic. Affected: `<1.19.13`.
- [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9) — **moderate**: Node.js Adapter for Hono: Path traversal in `serve-static` on Windows via encoded backslash (`%5C`). Affected: `<1.19.15`.

### @modelcontextprotocol/sdk — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@modelcontextprotocol/sdk` | 1.25.2 | dev-only | 1.26.0 | No |

Via: direct advisories below.

- [GHSA-345p-7cg4-v4c7](https://github.com/advisories/GHSA-345p-7cg4-v4c7) — **high**: @modelcontextprotocol/sdk has cross-client data leak via shared server/transport instance reuse. Affected: `>=1.10.0 <=1.25.3`.

### @opentelemetry/auto-instrumentations-node — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@opentelemetry/auto-instrumentations-node` | 0.49.2 | production | 0.75.0 | Yes |

Via: @opentelemetry/instrumentation-amqplib, @opentelemetry/instrumentation-aws-lambda, @opentelemetry/instrumentation-aws-sdk, @opentelemetry/instrumentation-connect, @opentelemetry/instrumentation-express, @opentelemetry/instrumentation-fastify, @opentelemetry/instrumentation-fs, @opentelemetry/instrumentation-hapi, @opentelemetry/instrumentation-http, @opentelemetry/instrumentation-koa, @opentelemetry/instrumentation-mongodb, @opentelemetry/instrumentation-mongoose, @opentelemetry/instrumentation-mysql2, @opentelemetry/instrumentation-pg, @opentelemetry/instrumentation-pino, @opentelemetry/instrumentation-restify, @opentelemetry/instrumentation-undici, @opentelemetry/resource-detector-aws, @opentelemetry/resource-detector-azure, @opentelemetry/resource-detector-gcp, @opentelemetry/resources, @opentelemetry/sdk-node.

- [GHSA-q7rr-3cgh-j5r3](https://github.com/advisories/GHSA-q7rr-3cgh-j5r3) — **high**: Prometheus exporter process crash via malformed HTTP request. Affected: `<0.75.0`.

### @opentelemetry/propagator-jaeger — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@opentelemetry/propagator-jaeger` | 1.25.1 | production | 2.9.0 | Yes |

Via: @opentelemetry/core.

- [GHSA-45rx-2jwx-cxfr](https://github.com/advisories/GHSA-45rx-2jwx-cxfr) — **high**: OpenTelemetry JavaScript: Denial of service in `JaegerPropagator` via unhandled exception on a malformed header. Affected: `<2.9.0`.

### @opentelemetry/sdk-node — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@opentelemetry/sdk-node` | 0.52.1 | production | 0.217.0 | Yes |

Via: @opentelemetry/core, @opentelemetry/exporter-trace-otlp-grpc, @opentelemetry/exporter-trace-otlp-http, @opentelemetry/exporter-trace-otlp-proto, @opentelemetry/exporter-zipkin, @opentelemetry/resources, @opentelemetry/sdk-logs, @opentelemetry/sdk-metrics, @opentelemetry/sdk-trace-base, @opentelemetry/sdk-trace-node.

- [GHSA-q7rr-3cgh-j5r3](https://github.com/advisories/GHSA-q7rr-3cgh-j5r3) — **high**: Prometheus exporter process crash via malformed HTTP request. Affected: `<0.217.0`.

### @opentelemetry/sdk-trace-node — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@opentelemetry/sdk-trace-node` | 1.25.1 | production | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: @opentelemetry/core, @opentelemetry/propagator-b3, @opentelemetry/propagator-jaeger, @opentelemetry/sdk-trace-base.


### adm-zip — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/adm-zip` | 0.5.16 | dev-only | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: direct advisories below.

- [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) — **high**: adm-zip: Crafted ZIP file triggers 4GB memory allocation. Affected: `<0.6.0`.
- [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9) — **moderate**: adm-zip extraction follows destination symlinks, allowing arbitrary file overwrite. Affected: `>=0.5.9 <=0.6.0`.

### axios — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/axios` | 1.13.2 | dev-only | 1.18.0 | No |

Via: direct advisories below.

- [GHSA-3p68-rc4w-qgx5](https://github.com/advisories/GHSA-3p68-rc4w-qgx5) — **moderate**: Axios has a NO_PROXY Hostname Normalization Bypass that Leads to SSRF. Affected: `>=1.0.0 <1.15.0`.
- [GHSA-w9j2-pvgh-6h63](https://github.com/advisories/GHSA-w9j2-pvgh-6h63) — **moderate**: Axios: Authentication Bypass via Prototype Pollution Gadget in `validateStatus` Merge Strategy. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-pmwg-cvhr-8vh7](https://github.com/advisories/GHSA-pmwg-cvhr-8vh7) — **high**: Axios: Incomplete Fix for CVE-2025-62718 — NO_PROXY Protection Bypassed via RFC 1122 Loopback Subnet (127.0.0.0/8) in Axios 1.15.0. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-3w6x-2g7m-8v23](https://github.com/advisories/GHSA-3w6x-2g7m-8v23) — **moderate**: Axios: Invisible JSON Response Tampering via Prototype Pollution Gadget in `parseReviver`. Affected: `>=1.0.0 <1.15.2`.
- [GHSA-xhjh-pmcv-23jw](https://github.com/advisories/GHSA-xhjh-pmcv-23jw) — **low**: Axios: Null Byte Injection via Reverse-Encoding in AxiosURLSearchParams. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-445q-vr5w-6q77](https://github.com/advisories/GHSA-445q-vr5w-6q77) — **moderate**: Axios: CRLF Injection in multipart/form-data body via unsanitized blob.type in formDataToStream. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-m7pr-hjqh-92cm](https://github.com/advisories/GHSA-m7pr-hjqh-92cm) — **moderate**: Axios: no_proxy bypass via IP alias allows SSRF. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-5c9x-8gcm-mpgx](https://github.com/advisories/GHSA-5c9x-8gcm-mpgx) — **moderate**: Axios' HTTP adapter-streamed uploads bypass maxBodyLength when maxRedirects: 0. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-vf2m-468p-8v99](https://github.com/advisories/GHSA-vf2m-468p-8v99) — **moderate**: Axios: HTTP adapter streamed responses bypass maxContentLength. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-pf86-5x62-jrwf](https://github.com/advisories/GHSA-pf86-5x62-jrwf) — **high**: Axios: Prototype Pollution Gadgets - Response Tampering, Data Exfiltration, and Request Hijacking. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-6chq-wfr3-2hj9](https://github.com/advisories/GHSA-6chq-wfr3-2hj9) — **high**: Axios: Header Injection via Prototype Pollution. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-xx6v-rp6x-q39c](https://github.com/advisories/GHSA-xx6v-rp6x-q39c) — **moderate**: Axios: XSRF Token Cross-Origin Leakage via Prototype Pollution Gadget in `withXSRFToken` Boolean Coercion. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-43fc-jf86-j433](https://github.com/advisories/GHSA-43fc-jf86-j433) — **high**: Axios is Vulnerable to Denial of Service via __proto__ Key in mergeConfig. Affected: `>=1.0.0 <=1.13.4`.
- [GHSA-q8qp-cvcw-x6jj](https://github.com/advisories/GHSA-q8qp-cvcw-x6jj) — **high**: Axios has prototype pollution read-side gadgets in HTTP adapter that allow credential injection and request hijacking. Affected: `>=1.0.0 <1.15.2`.
- [GHSA-fvcv-3m26-pcqx](https://github.com/advisories/GHSA-fvcv-3m26-pcqx) — **moderate**: Axios has Unrestricted Cloud Metadata Exfiltration via Header Injection Chain. Affected: `>=1.0.0 <1.15.0`.
- [GHSA-62hf-57xw-28j9](https://github.com/advisories/GHSA-62hf-57xw-28j9) — **moderate**: Axios: unbounded recursion in toFormData causes DoS via deeply nested request data. Affected: `>=1.0.0 <1.15.1`.
- [GHSA-hfxv-24rg-xrqf](https://github.com/advisories/GHSA-hfxv-24rg-xrqf) — **high**: Axios: Regular Expression Denial of Service (ReDoS) via Cookie Name Injection. Affected: `>=1.0.0 <1.16.0`.
- [GHSA-777c-7fjr-54vf](https://github.com/advisories/GHSA-777c-7fjr-54vf) — **high**: Allocation of Resources Without Limits or Throttling in Axios. Affected: `>=1.7.0 <1.16.0`.
- [GHSA-p92q-9vqr-4j8v](https://github.com/advisories/GHSA-p92q-9vqr-4j8v) — **high**: Axios: Proxy-Authorization Credential Leak to Origin Server Across HTTP-to-HTTPS Redirect in Axios Node.js HTTP Adapter. Affected: `>=1.0.0 <1.16.0`.
- [GHSA-j5f8-grm9-p9fc](https://github.com/advisories/GHSA-j5f8-grm9-p9fc) — **high**: Axios: Proxy-Authorization header leaks to redirect target when proxy is re-evaluated to direct connection. Affected: `>=1.0.0 <1.16.0`.
- [GHSA-3g43-6gmg-66jw](https://github.com/advisories/GHSA-3g43-6gmg-66jw) — **high**: axios Vulnerable to Credential Theft and Response Hijacking via Prototype Pollution Gadget in Config Merge. Affected: `>=1.0.0 <1.15.2`.
- [GHSA-35jp-ww65-95wh](https://github.com/advisories/GHSA-35jp-ww65-95wh) — **high**: axios Vulnerable to Full Man-in-the-Middle via Prototype Pollution Gadget in `config.proxy`. Affected: `>=1.0.0 <1.16.0`.
- [GHSA-898c-q2cr-xwhg](https://github.com/advisories/GHSA-898c-q2cr-xwhg) — **moderate**: axios has DoS & Header Injection via Prototype Pollution Read-Side Gadgets in axios merge functions. Affected: `>=1.0.0 <1.16.0`.
- [GHSA-mmx7-hfxf-jppx](https://github.com/advisories/GHSA-mmx7-hfxf-jppx) — **moderate**: Axios: Prototype pollution gadgets can alter axios request construction. Affected: `>=1.0.0 <1.18.0`.
- [GHSA-pmv8-rq9r-6j72](https://github.com/advisories/GHSA-pmv8-rq9r-6j72) — **moderate**: Axios: Deep formToJSON Key Recursion Can Cause Denial of Service. Affected: `>=1.0.0 <1.18.0`.
- [GHSA-mwf2-3pr3-8698](https://github.com/advisories/GHSA-mwf2-3pr3-8698) — **moderate**: Axios: HTTP/2 streamed uploads bypass `maxBodyLength`. Affected: `>=1.13.0 <1.18.0`.
- [GHSA-7q8q-rj6j-mhjq](https://github.com/advisories/GHSA-7q8q-rj6j-mhjq) — **moderate**: Axios: Nested axios option objects can consume polluted prototype values. Affected: `>=1.0.0 <1.18.0`.
- [GHSA-jqh4-m9w3-8hp9](https://github.com/advisories/GHSA-jqh4-m9w3-8hp9) — **moderate**: Axios: Fetch adapter `ReadableStream` uploads bypass `maxBodyLength`. Affected: `>=1.7.0 <1.18.0`.
- [GHSA-42h9-826w-cgv3](https://github.com/advisories/GHSA-42h9-826w-cgv3) — **moderate**: Axios: Excessive recursion in formDataToJSON can cause denial of service. Affected: `>=1.0.0 <1.18.0`.

### brace-expansion — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@eslint/config-array/node_modules/brace-expansion` | 1.1.12 | dev-only | 1.1.18 | No |
| `node_modules/@eslint/eslintrc/node_modules/brace-expansion` | 1.1.12 | dev-only | 1.1.18 | No |
| `node_modules/brace-expansion` | 2.0.2 | production | 2.1.4 | No |
| `node_modules/eslint-plugin-import/node_modules/brace-expansion` | 1.1.12 | dev-only | 1.1.18 | No |
| `node_modules/eslint-plugin-jsx-a11y/node_modules/brace-expansion` | 1.1.12 | dev-only | 1.1.18 | No |
| `node_modules/eslint-plugin-react/node_modules/brace-expansion` | 1.1.12 | dev-only | 1.1.18 | No |
| `node_modules/eslint/node_modules/brace-expansion` | 1.1.12 | dev-only | 1.1.18 | No |

Via: direct advisories below.

- [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) — **moderate**: brace-expansion: Zero-step sequence causes process hang and memory exhaustion. Affected: `<1.1.13`.
- [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) — **moderate**: brace-expansion: Zero-step sequence causes process hang and memory exhaustion. Affected: `>=2.0.0 <2.0.3`.
- [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — **high**: brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups. Affected: `>=2.0.0 <2.1.2`.
- [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — **high**: brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups. Affected: `<1.1.16`.
- [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — **high**: brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash. Affected: `<1.1.17`.
- [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — **high**: brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash. Affected: `>=2.0.0 <2.1.3`.
- [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — **high**: brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation. Affected: `>=2.0.0 <2.1.4`.
- [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — **high**: brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation. Affected: `<1.1.18`.

### browserslist — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/browserslist` | 4.28.1 | dev-only | 4.28.7 | No |

Via: direct advisories below.

- [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) — **high**: Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM. Affected: `<=4.28.6`.
- [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) — **high**: Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats). Affected: `<=4.28.6`.

### extract-zip — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/extract-zip` | 2.0.1 | dev-only | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: direct advisories below.

- [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) — **high**: extract-zip unvalidated symlink path traversal. Affected: `<=2.0.1`.
- [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) — **high**: extract-zip allows arbitrary file writes through symlink archive entries. Affected: `<=2.0.1`.

### fast-uri — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/fast-uri` | 3.1.0 | production | 3.1.6 | No |

Via: direct advisories below.

- [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) — **high**: fast-uri vulnerable to host confusion via literal backslash authority delimiter. Affected: `>=3.0.0 <=3.1.3`.
- [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) — **high**: fast-uri vulnerable to host confusion via backslash authority introducer. Affected: `>=3.0.0 <3.1.5`.
- [GHSA-q3j6-qgpj-74h6](https://github.com/advisories/GHSA-q3j6-qgpj-74h6) — **high**: fast-uri vulnerable to path traversal via percent-encoded dot segments. Affected: `>=3.0.0 <=3.1.0`.
- [GHSA-v39h-62p7-jpjc](https://github.com/advisories/GHSA-v39h-62p7-jpjc) — **high**: fast-uri vulnerable to host confusion via percent-encoded authority delimiters. Affected: `>=3.0.0 <=3.1.1`.
- [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) — **high**: fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization. Affected: `>=3.0.0 <3.1.6`.
- [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) — **high**: fast-uri vulnerable to host confusion via percent-encoded scheme normalization. Affected: `>=3.0.0 <3.1.6`.
- [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) — **high**: fast-uri vulnerable to host confusion via failed IDN canonicalization. Affected: `>=3.0.0 <3.1.3`.

### fast-xml-parser — critical; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/fast-xml-parser` | 4.5.3 | production | 5.7.0 | Yes |

Via: direct advisories below.

- [GHSA-m7jm-9gc2-mpf2](https://github.com/advisories/GHSA-m7jm-9gc2-mpf2) — **critical**: fast-xml-parser has an entity encoding bypass via regex injection in DOCTYPE entity names. Affected: `>=4.1.3 <4.5.4`.
- [GHSA-jmr7-xgp7-cmfj](https://github.com/advisories/GHSA-jmr7-xgp7-cmfj) — **high**: fast-xml-parser affected by DoS through entity expansion in DOCTYPE (no expansion limit). Affected: `>=4.1.3 <4.5.4`.
- [GHSA-fj3w-jwp8-x2g3](https://github.com/advisories/GHSA-fj3w-jwp8-x2g3) — **low**: fast-xml-parser has stack overflow in XMLBuilder with preserveOrder. Affected: `>=4.0.0-beta.0 <4.5.4`.
- [GHSA-8gc5-j5rx-235r](https://github.com/advisories/GHSA-8gc5-j5rx-235r) — **high**: fast-xml-parser affected by numeric entity expansion bypassing all entity expansion limits (incomplete fix for CVE-2026-26278). Affected: `>=4.0.0-beta.3 <4.5.5`.
- [GHSA-jp2q-39xq-3w4g](https://github.com/advisories/GHSA-jp2q-39xq-3w4g) — **moderate**: Entity Expansion Limits Bypassed When Set to Zero Due to JavaScript Falsy Evaluation in fast-xml-parser. Affected: `>=4.0.0-beta.3 <4.5.5`.
- [GHSA-gh4j-gqv2-49f6](https://github.com/advisories/GHSA-gh4j-gqv2-49f6) — **moderate**: fast-xml-parser XMLBuilder: XML Comment and CDATA Injection via Unescaped Delimiters. Affected: `<5.7.0`.

### flatted — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/flatted` | 3.3.3 | dev-only | 3.4.2 | No |

Via: direct advisories below.

- [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f) — **high**: flatted vulnerable to unbounded recursion DoS in parse() revive phase. Affected: `<3.4.0`.
- [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) — **high**: Prototype Pollution via parse() in NodeJS flatted. Affected: `<=3.4.1`.

### form-data — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@types/request/node_modules/form-data` | 2.5.5 | production | 2.5.6 | No |
| `node_modules/form-data` | 4.0.5 | dev-only | 4.0.6 | No |

Via: direct advisories below.

- [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) — **high**: form-data: CRLF injection in form-data via unescaped multipart field names and filenames. Affected: `>=4.0.0 <4.0.6`.
- [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) — **high**: form-data: CRLF injection in form-data via unescaped multipart field names and filenames. Affected: `<2.5.6`.

### genkit-cli — high; direct

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/genkit-cli` | 1.27.0 | dev-only | No standalone safe version established; resolve children | Parent upgrade assessment required |

Via: @genkit-ai/telemetry-server, @genkit-ai/tools-common, extract-zip.


### handlebars — critical; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/handlebars` | 4.7.8 | production | 4.7.9 | No |

Via: direct advisories below.

- [GHSA-3mfm-83xf-c92r](https://github.com/advisories/GHSA-3mfm-83xf-c92r) — **high**: Handlebars.js has JavaScript Injection via AST Type Confusion by tampering @partial-block. Affected: `>=4.0.0 <=4.7.8`.
- [GHSA-2w6w-674q-4c4q](https://github.com/advisories/GHSA-2w6w-674q-4c4q) — **critical**: Handlebars.js has JavaScript Injection via AST Type Confusion. Affected: `>=4.0.0 <=4.7.8`.
- [GHSA-2qvq-rjwj-gvw9](https://github.com/advisories/GHSA-2qvq-rjwj-gvw9) — **moderate**: Handlebars.js has Prototype Pollution Leading to XSS through Partial Template Injection. Affected: `>=4.0.0 <4.7.9`.
- [GHSA-7rx3-28cr-v5wh](https://github.com/advisories/GHSA-7rx3-28cr-v5wh) — **moderate**: Handlebars.js has a Prototype Method Access Control Gap via Missing __lookupSetter__ Blocklist Entry. Affected: `>=4.6.0 <=4.7.8`.
- [GHSA-442j-39wm-28r2](https://github.com/advisories/GHSA-442j-39wm-28r2) — **low**: Handlebars.js has a Property Access Validation Bypass in container.lookup. Affected: `>=4.0.0 <=4.7.8`.
- [GHSA-xhpv-hc6g-r9c6](https://github.com/advisories/GHSA-xhpv-hc6g-r9c6) — **high**: Handlebars.js has JavaScript Injection via AST Type Confusion when passing an object as dynamic partial. Affected: `>=4.0.0 <=4.7.8`.
- [GHSA-9cx6-37pm-9jff](https://github.com/advisories/GHSA-9cx6-37pm-9jff) — **high**: Handlebars.js has Denial of Service via Malformed Decorator Syntax in Template Compilation. Affected: `>=4.0.0 <=4.7.8`.
- [GHSA-xjpj-3mr7-gcpf](https://github.com/advisories/GHSA-xjpj-3mr7-gcpf) — **high**: Handlebars.js has JavaScript Injection in CLI Precompiler via Unescaped Names and Options. Affected: `>=4.0.0 <=4.7.8`.

### hono — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/hono` | 4.11.4 | dev-only | 4.13.5 | No |

Via: direct advisories below.

- [GHSA-9r54-q6cx-xmh5](https://github.com/advisories/GHSA-9r54-q6cx-xmh5) — **moderate**: Hono vulnerable to XSS through ErrorBoundary component . Affected: `<4.11.7`.
- [GHSA-6wqw-2p9w-4vw4](https://github.com/advisories/GHSA-6wqw-2p9w-4vw4) — **moderate**: Hono cache middleware ignores "Cache-Control: private" leading to Web Cache Deception. Affected: `<4.11.7`.
- [GHSA-r354-f388-2fhh](https://github.com/advisories/GHSA-r354-f388-2fhh) — **moderate**: Hono IPv4 address validation bypass in IP Restriction Middleware allows IP spoofing. Affected: `<4.11.7`.
- [GHSA-w332-q679-j88p](https://github.com/advisories/GHSA-w332-q679-j88p) — **moderate**: Hono has an Arbitrary Key Read in Serve static Middleware (Cloudflare Workers Adapter). Affected: `<4.11.7`.
- [GHSA-gq3j-xvxp-8hrf](https://github.com/advisories/GHSA-gq3j-xvxp-8hrf) — **low**: Hono added timing comparison hardening in basicAuth and bearerAuth. Affected: `<4.11.10`.
- [GHSA-5pq2-9x2x-5p6w](https://github.com/advisories/GHSA-5pq2-9x2x-5p6w) — **moderate**: Hono Vulnerable to Cookie Attribute Injection via Unsanitized domain and path in setCookie(). Affected: `<4.12.4`.
- [GHSA-p6xx-57qc-3wxr](https://github.com/advisories/GHSA-p6xx-57qc-3wxr) — **moderate**: Hono Vulnerable to SSE Control Field Injection via CR/LF in writeSSE(). Affected: `<4.12.4`.
- [GHSA-q5qw-h33p-qvwr](https://github.com/advisories/GHSA-q5qw-h33p-qvwr) — **high**: Hono vulnerable to arbitrary file access via serveStatic vulnerability . Affected: `<4.12.4`.
- [GHSA-v8w9-8mx6-g223](https://github.com/advisories/GHSA-v8w9-8mx6-g223) — **moderate**: Hono vulnerable to Prototype Pollution possible through __proto__ key allowed in parseBody({ dot: true }). Affected: `<4.12.7`.
- [GHSA-26pp-8wgv-hjvm](https://github.com/advisories/GHSA-26pp-8wgv-hjvm) — **moderate**: Hono missing validation of cookie name on write path in setCookie(). Affected: `<4.12.12`.
- [GHSA-r5rp-j6wh-rvv4](https://github.com/advisories/GHSA-r5rp-j6wh-rvv4) — **moderate**: Hono: Non-breaking space prefix bypass in cookie name handling in getCookie(). Affected: `<4.12.12`.
- [GHSA-xf4j-xp2r-rqqx](https://github.com/advisories/GHSA-xf4j-xp2r-rqqx) — **moderate**: Hono: Path traversal in toSSG() allows writing files outside the output directory. Affected: `>=4.0.0 <=4.12.11`.
- [GHSA-wmmm-f939-6g9c](https://github.com/advisories/GHSA-wmmm-f939-6g9c) — **moderate**: Hono: Middleware bypass via repeated slashes in serveStatic. Affected: `<4.12.12`.
- [GHSA-xpcf-pg52-r92g](https://github.com/advisories/GHSA-xpcf-pg52-r92g) — **moderate**: Hono has incorrect IP matching in ipRestriction() for IPv4-mapped IPv6 addresses. Affected: `<4.12.12`.
- [GHSA-qp7p-654g-cw7p](https://github.com/advisories/GHSA-qp7p-654g-cw7p) — **moderate**: Hono has CSS Declaration Injection via Style Object Values in JSX SSR. Affected: `<4.12.18`.
- [GHSA-hm8q-7f3q-5f36](https://github.com/advisories/GHSA-hm8q-7f3q-5f36) — **low**: Hono has improper validation of NumericDate claims (exp, nbf, iat) in JWT verify(). Affected: `<4.12.18`.
- [GHSA-p77w-8qqv-26rm](https://github.com/advisories/GHSA-p77w-8qqv-26rm) — **moderate**: Hono's Cache Middleware ignores Vary: Authorization / Vary: Cookie leading to cross-user cache leakage. Affected: `<4.12.18`.
- [GHSA-9vqf-7f2p-gf9v](https://github.com/advisories/GHSA-9vqf-7f2p-gf9v) — **moderate**: Hono: bodyLimit() can be bypassed for chunked / unknown-length requests. Affected: `<4.12.16`.
- [GHSA-69xw-7hcm-h432](https://github.com/advisories/GHSA-69xw-7hcm-h432) — **moderate**: hono/jsx has Unvalidated JSX Tag Names that May Allow HTML Injection. Affected: `<4.12.16`.
- [GHSA-xrhx-7g5j-rcj5](https://github.com/advisories/GHSA-xrhx-7g5j-rcj5) — **moderate**: Hono: IP Restriction bypasses static deny rules for non-canonical IPv6 . Affected: `<4.12.21`.
- [GHSA-3hrh-pfw6-9m5x](https://github.com/advisories/GHSA-3hrh-pfw6-9m5x) — **moderate**: Hono: Cookie helper does not sanitize sameSite and priority, allowing Set-Cookie injection. Affected: `<4.12.21`.
- [GHSA-f577-qrjj-4474](https://github.com/advisories/GHSA-f577-qrjj-4474) — **moderate**: Hono: JWT middleware accepts any Authorization scheme, not only Bearer. Affected: `<4.12.21`.
- [GHSA-2gcr-mfcq-wcc3](https://github.com/advisories/GHSA-2gcr-mfcq-wcc3) — **moderate**: Hono: app.mount() strips mount prefix using undecoded path, causing incorrect routing for percent-encoded paths. Affected: `<4.12.21`.
- [GHSA-458j-xx4x-4375](https://github.com/advisories/GHSA-458j-xx4x-4375) — **moderate**: hono Improperly Handles JSX Attribute Names Allows HTML Injection in hono/jsx SSR. Affected: `<4.12.14`.
- [GHSA-rv63-4mwf-qqc2](https://github.com/advisories/GHSA-rv63-4mwf-qqc2) — **moderate**: hono: Body Limit Middleware can be bypassed on AWS Lambda by understating `Content-Length`. Affected: `<4.12.25`.
- [GHSA-wgpf-jwqj-8h8p](https://github.com/advisories/GHSA-wgpf-jwqj-8h8p) — **moderate**: hono: Lambda@Edge adapter keeps only the last value of a repeated request header, dropping the rest. Affected: `<4.12.25`.
- [GHSA-88fw-hqm2-52qc](https://github.com/advisories/GHSA-88fw-hqm2-52qc) — **high**: hono: CORS Middleware reflects any Origin with credentials when `origin` defaults to the wildcard. Affected: `<4.12.25`.
- [GHSA-wwfh-h76j-fc44](https://github.com/advisories/GHSA-wwfh-h76j-fc44) — **moderate**: hono: Path traversal in `serve-static` on Windows via encoded backslash (`%5C`). Affected: `<4.12.25`.
- [GHSA-j6c9-x7qj-28xf](https://github.com/advisories/GHSA-j6c9-x7qj-28xf) — **moderate**: hono: AWS Lambda adapter merges multiple `Set-Cookie` headers into one value, dropping cookies on ALB single-header and Lattice. Affected: `<4.12.25`.
- [GHSA-xgm2-5f3f-mvvc](https://github.com/advisories/GHSA-xgm2-5f3f-mvvc) — **moderate**: Hono: API Gateway v1 adapter can drop a distinct repeated request header value during de-duplication. Affected: `>=4.3.3 <4.12.27`.
- [GHSA-w62v-xxxg-mg59](https://github.com/advisories/GHSA-w62v-xxxg-mg59) — **moderate**: Hono: Server-Side XSS via JSX Escaping Bypass in cx() Utility. Affected: `>=4.0.0 <4.12.27`.
- [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239) — **moderate**: Hono: ReDoS in CORS middleware via Access-Control-Request-Headers. Affected: `<4.12.34`.
- [GHSA-f23p-vx2j-j53r](https://github.com/advisories/GHSA-f23p-vx2j-j53r) — **moderate**: Hono: `memo()` retains SSR output across requests, leading to cross-user data disclosure. Affected: `>=3.8.0 <4.12.34`.
- [GHSA-79qm-7rj5-m7r9](https://github.com/advisories/GHSA-79qm-7rj5-m7r9) — **low**: Hono: Proxy Helper does not remove response headers listed in the `Connection` header. Affected: `>=4.7.0 <4.12.34`.
- [GHSA-gqvv-2mrq-wpjv](https://github.com/advisories/GHSA-gqvv-2mrq-wpjv) — **moderate**: Hono: Incomplete fix for CVE-2026-39408: `toSSG()` still writes files outside the output directory. Affected: `<4.13.5`.
- [GHSA-g6gw-c38x-mqfc](https://github.com/advisories/GHSA-g6gw-c38x-mqfc) — **moderate**: Hono: Unbounded dot-notation nesting in `parseBody()` can cause memory exhaustion. Affected: `<4.13.5`.
- [GHSA-crvj-82cr-hjcx](https://github.com/advisories/GHSA-crvj-82cr-hjcx) — **moderate**: Hono: Query parser reads parameters after the URL fragment, causing cache-key and proxy interpretation differentials. Affected: `<4.13.5`.

### js-yaml — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/js-yaml` | 4.1.1 | dev-only | 4.3.2 | No |

Via: direct advisories below.

- [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) — **moderate**: JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases. Affected: `>=4.0.0 <=4.1.1`.
- [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) — **high**: js-yaml: YAML merge-key chains can force quadratic CPU consumption. Affected: `>=4.0.0 <4.3.0`.
- [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) — **high**: JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported. Affected: `>=4.0.0 <4.3.1`.
- [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — **high**: js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources. Affected: `>=4.0.0 <4.3.2`.

### jspdf — critical; direct

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/jspdf` | 4.0.0 | production | 4.2.1 | No |

Via: direct advisories below.

- [GHSA-pqxr-3g65-p328](https://github.com/advisories/GHSA-pqxr-3g65-p328) — **high**: jsPDF has PDF Injection in AcroFormChoiceField that allows Arbitrary JavaScript Execution. Affected: `<=4.0.0`.
- [GHSA-95fx-jjr5-f39c](https://github.com/advisories/GHSA-95fx-jjr5-f39c) — **high**: jsPDF Vulnerable to Denial of Service (DoS) via Unvalidated BMP Dimensions in BMPDecoder. Affected: `<=4.0.0`.
- [GHSA-vm32-vv63-w422](https://github.com/advisories/GHSA-vm32-vv63-w422) — **moderate**: jsPDF Vulnerable to Stored XMP Metadata Injection (Spoofing & Integrity Violation). Affected: `<=4.0.0`.
- [GHSA-cjw8-79x6-5cj4](https://github.com/advisories/GHSA-cjw8-79x6-5cj4) — **moderate**: jsPDF has Shared State Race Condition in addJS Plugin. Affected: `<=4.0.0`.
- [GHSA-9vjf-qc39-jprp](https://github.com/advisories/GHSA-9vjf-qc39-jprp) — **high**: jsPDF has a PDF Object Injection via Unsanitized Input in addJS Method. Affected: `<4.2.0`.
- [GHSA-67pg-wm7f-q7fj](https://github.com/advisories/GHSA-67pg-wm7f-q7fj) — **high**: jsPDF Affected by Client-Side/Server-Side Denial of Service via Malicious GIF Dimensions. Affected: `<4.2.0`.
- [GHSA-p5xg-68wr-hm3m](https://github.com/advisories/GHSA-p5xg-68wr-hm3m) — **high**: jsPDF has a PDF Injection in AcroForm module allows Arbitrary JavaScript Execution (RadioButton.createOption and "AS" property). Affected: `<4.2.0`.
- [GHSA-7x6v-j9x4-qf24](https://github.com/advisories/GHSA-7x6v-j9x4-qf24) — **high**: jsPDF has a PDF Object Injection via FreeText color. Affected: `<=4.2.0`.
- [GHSA-wfv2-pwc8-crg5](https://github.com/advisories/GHSA-wfv2-pwc8-crg5) — **critical**: jsPDF has HTML Injection in New Window paths. Affected: `<=4.2.0`.

### lodash — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/lodash` | 4.17.21 | production | 4.18.0 | No |

Via: direct advisories below.

- [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) — **high**: lodash vulnerable to Code Injection via `_.template` imports key names. Affected: `>=4.0.0 <=4.17.23`.
- [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) — **moderate**: lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit`. Affected: `<=4.17.23`.
- [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) — **moderate**: Lodash has Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions. Affected: `>=4.0.0 <=4.17.22`.

### minimatch — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@eslint/config-array/node_modules/minimatch` | 3.1.2 | dev-only | 3.1.4 | No |
| `node_modules/@eslint/eslintrc/node_modules/minimatch` | 3.1.2 | dev-only | 3.1.4 | No |
| `node_modules/eslint-plugin-import/node_modules/minimatch` | 3.1.2 | dev-only | 3.1.4 | No |
| `node_modules/eslint-plugin-jsx-a11y/node_modules/minimatch` | 3.1.2 | dev-only | 3.1.4 | No |
| `node_modules/eslint-plugin-react/node_modules/minimatch` | 3.1.2 | dev-only | 3.1.4 | No |
| `node_modules/eslint/node_modules/minimatch` | 3.1.2 | dev-only | 3.1.4 | No |
| `node_modules/minimatch` | 9.0.5 | production | 9.0.7 | No |

Via: direct advisories below.

- [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) — **high**: minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern. Affected: `<3.1.3`.
- [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) — **high**: minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern. Affected: `>=9.0.0 <9.0.6`.
- [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) — **high**: minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments. Affected: `<3.1.3`.
- [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) — **high**: minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments. Affected: `>=9.0.0 <9.0.7`.
- [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) — **high**: minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions. Affected: `<3.1.4`.
- [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) — **high**: minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions. Affected: `>=9.0.0 <9.0.7`.

### nanoid — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/nanoid` | 3.3.8 | production | 3.3.18 | No |

Via: direct advisories below.

- [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) — **high**: nanoid: non-secure generators can loop indefinitely with negative size. Affected: `<3.3.16`.
- [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) — **high**: nanoid: custom generators can loop indefinitely when size is zero. Affected: `<3.3.18`.
- [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) — **high**: nanoid: Integer Overflow or Wraparound. Affected: `<3.3.12`.

### next — critical; direct

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/next` | 16.1.1 | production | 16.3.3 | No |

Via: postcss, sharp.

- [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) — **moderate**: Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration. Affected: `>=15.6.0-canary.0 <16.1.5`.
- [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) — **high**: Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components. Affected: `>=16.1.0-canary.0 <16.1.5`.
- [GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) — **moderate**: Next.js: HTTP request smuggling in rewrites. Affected: `>=16.0.0-beta.0 <16.1.7`.
- [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) — **moderate**: Next.js: Unbounded next/image disk cache growth can exhaust storage. Affected: `>=16.0.0-beta.0 <16.1.7`.
- [GHSA-h27x-g6w4-24gq](https://github.com/advisories/GHSA-h27x-g6w4-24gq) — **moderate**: Next.js: Unbounded postponed resume buffering can lead to DoS. Affected: `>=16.0.1 <16.1.7`.
- [GHSA-mq59-m269-xvcx](https://github.com/advisories/GHSA-mq59-m269-xvcx) — **moderate**: Next.js: null origin can bypass Server Actions CSRF checks. Affected: `>=16.0.1 <16.1.7`.
- [GHSA-jcc7-9wpm-mj36](https://github.com/advisories/GHSA-jcc7-9wpm-mj36) — **low**: Next.js: null origin can bypass dev HMR websocket CSRF checks. Affected: `>=16.0.1 <16.1.7`.
- [GHSA-5f7q-jpqc-wp7h](https://github.com/advisories/GHSA-5f7q-jpqc-wp7h) — **moderate**: Next.js has Unbounded Memory Consumption via PPR Resume Endpoint . Affected: `>=16.0.0-beta.0 <16.1.5`.
- [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) — **high**: Next.js has a Denial of Service with Server Components. Affected: `>=16.0.0-beta.0 <16.2.3`.
- [GHSA-8h8q-6873-q5fj](https://github.com/advisories/GHSA-8h8q-6873-q5fj) — **high**: Next.js Vulnerable to Denial of Service with Server Components. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-26hh-7cqf-hhc6](https://github.com/advisories/GHSA-26hh-7cqf-hhc6) — **high**: Next.js has a Middleware / Proxy bypass in App Router applications via segment-prefetch routes - Incomplete Fix Follow-Up. Affected: `>=16.0.0 <16.2.6`.
- [GHSA-3g8h-86w9-wvmq](https://github.com/advisories/GHSA-3g8h-86w9-wvmq) — **low**: Next.js's Middleware / Proxy redirects can be cache-poisoned. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-ffhc-5mcf-pf4q](https://github.com/advisories/GHSA-ffhc-5mcf-pf4q) — **moderate**: Next.js vulnerable to cross-site scripting in App Router applications using CSP nonces. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-vfv6-92ff-j949](https://github.com/advisories/GHSA-vfv6-92ff-j949) — **low**: Next.js vulnerable to cache poisoning via collisions in React Server Component cache-busting. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-gx5p-jg67-6x7h](https://github.com/advisories/GHSA-gx5p-jg67-6x7h) — **moderate**: Next.js has cross-site scripting in beforeInteractive scripts with untrusted input. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-mg66-mrh9-m8jx](https://github.com/advisories/GHSA-mg66-mrh9-m8jx) — **high**: Next.js vulnerable to Denial of Service via connection exhaustion in applications using Cache Components. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-h64f-5h5j-jqjh](https://github.com/advisories/GHSA-h64f-5h5j-jqjh) — **moderate**: Next.js has a Denial of Service in the Image Optimization API. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-c4j6-fc7j-m34r](https://github.com/advisories/GHSA-c4j6-fc7j-m34r) — **high**: Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-492v-c6pp-mqqv](https://github.com/advisories/GHSA-492v-c6pp-mqqv) — **high**: Next.js has a Middleware / Proxy bypass through dynamic route parameter injection. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-wfc6-r584-vfw7](https://github.com/advisories/GHSA-wfc6-r584-vfw7) — **moderate**: Next.js vulnerable to cache poisoning in React Server Component responses. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-267c-6grr-h53f](https://github.com/advisories/GHSA-267c-6grr-h53f) — **high**: Next.js has a Middleware / Proxy bypass in App Router applications via segment-prefetch routes. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-36qx-fr4f-26g5](https://github.com/advisories/GHSA-36qx-fr4f-26g5) — **high**: Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n. Affected: `>=16.0.0 <16.2.5`.
- [GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) — **high**: Next.js: Middleware / Proxy bypass in App Router applications using Turbopack and single locale. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) — **high**: Next.js: Denial of Service in App Router using Server Actions. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x) — **high**: Next.js: Server-Side Request Forgery in Server Actions on custom servers. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-68g3-v927-f742](https://github.com/advisories/GHSA-68g3-v927-f742) — **moderate**: Next.js: Cache confusion of response bodies for requests with bodies. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-4633-3j49-mh5q](https://github.com/advisories/GHSA-4633-3j49-mh5q) — **moderate**: Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-4c39-4ccg-62r3](https://github.com/advisories/GHSA-4c39-4ccg-62r3) — **moderate**: Next.js: Unbounded Server Action payload in Edge runtime. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) — **high**: Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-q8wf-6r8g-63ch](https://github.com/advisories/GHSA-q8wf-6r8g-63ch) — **moderate**: Next.js: Denial of Service in the Image Optimization API using SVGs. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-955p-x3mx-jcvp](https://github.com/advisories/GHSA-955p-x3mx-jcvp) — **moderate**: Next.js: Unauthenticated disclosure of internal Server Function endpoints. Affected: `>=16.0.0 <16.2.11`.
- [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) — **critical**: Next.js: Unauthenticated Remote Code Execution on windows-hosted servers. Affected: `>=16.0.0 <16.3.3`.
- [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) — **critical**: Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used. Affected: `>=16.0.0 <16.3.3`.

### node-forge — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/node-forge` | 1.3.3 | production | 1.4.0 | No |

Via: direct advisories below.

- [GHSA-2328-f5f3-gj25](https://github.com/advisories/GHSA-2328-f5f3-gj25) — **high**: Forge has a basicConstraints bypass in its certificate chain verification (RFC 5280 violation). Affected: `<=1.3.3`.
- [GHSA-q67f-28xg-22rw](https://github.com/advisories/GHSA-q67f-28xg-22rw) — **high**: Forge has signature forgery in Ed25519 due to missing S > L check. Affected: `<1.4.0`.
- [GHSA-5m6q-g25r-mvwx](https://github.com/advisories/GHSA-5m6q-g25r-mvwx) — **high**: Forge has Denial of Service via Infinite Loop in BigInteger.modInverse() with Zero Input. Affected: `<1.4.0`.
- [GHSA-ppp5-5v6c-4jwp](https://github.com/advisories/GHSA-ppp5-5v6c-4jwp) — **high**: Forge has signature forgery in RSA-PKCS due to ASN.1 extra field  . Affected: `<1.4.0`.

### path-to-regexp — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/path-to-regexp` | 0.1.12 | production | 0.1.13 | No |
| `node_modules/router/node_modules/path-to-regexp` | 8.3.0 | dev-only | 8.4.0 | No |

Via: direct advisories below.

- [GHSA-37ch-88jc-xwx2](https://github.com/advisories/GHSA-37ch-88jc-xwx2) — **high**: path-to-regexp vulnerable to Regular Expression Denial of Service via multiple route parameters. Affected: `<0.1.13`.
- [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f) — **high**: path-to-regexp vulnerable to Denial of Service via sequential optional groups. Affected: `>=8.0.0 <8.4.0`.
- [GHSA-27v5-c462-wpq7](https://github.com/advisories/GHSA-27v5-c462-wpq7) — **moderate**: path-to-regexp vulnerable to Regular Expression Denial of Service via multiple wildcards. Affected: `>=8.0.0 <8.4.0`.

### picomatch — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/picomatch` | 2.3.1 | production | 2.3.2 | No |
| `node_modules/tinyglobby/node_modules/picomatch` | 4.0.3 | dev-only | 4.0.4 | No |

Via: direct advisories below.

- [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) — **moderate**: Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching. Affected: `<2.3.2`.
- [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) — **moderate**: Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching. Affected: `>=4.0.0 <4.0.4`.
- [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) — **high**: Picomatch has a ReDoS vulnerability via extglob quantifiers. Affected: `<2.3.2`.
- [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) — **high**: Picomatch has a ReDoS vulnerability via extglob quantifiers. Affected: `>=4.0.0 <4.0.4`.

### postcss — high; direct

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/next/node_modules/postcss` | 8.4.31 | production | 8.5.23 | No |
| `node_modules/postcss` | 8.5.2 | production | 8.5.23 | No |

Via: direct advisories below.

- [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — **moderate**: PostCSS has XSS via Unescaped </style> in its CSS Stringify Output. Affected: `<8.5.10`.
- [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) — **high**: PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments. Affected: `<=8.5.11`.
- [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) — **moderate**: PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset. Affected: `<=8.5.22`.
- [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — **high**: PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure. Affected: `<=8.5.17`.

### protobufjs — critical; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/protobufjs` | 7.5.4 | production | 7.6.5 | No |

Via: direct advisories below.

- [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) — **critical**: Arbitrary code execution in protobufjs. Affected: `<7.5.5`.
- [GHSA-66ff-xgx4-vchm](https://github.com/advisories/GHSA-66ff-xgx4-vchm) — **high**: protobuf.js: Code injection through bytes field defaults in generated toObject code. Affected: `<=7.5.5`.
- [GHSA-2pr8-phx7-x9h3](https://github.com/advisories/GHSA-2pr8-phx7-x9h3) — **moderate**: protobuf.js: Denial of service from crafted field names in generated code. Affected: `<=7.5.5`.
- [GHSA-fx83-v9x8-x52w](https://github.com/advisories/GHSA-fx83-v9x8-x52w) — **moderate**: protobuf.js: Prototype injection in generated message constructors. Affected: `<=7.5.5`.
- [GHSA-75px-5xx7-5xc7](https://github.com/advisories/GHSA-75px-5xx7-5xc7) — **high**: protobuf.js: Code generation gadget after prototype pollution. Affected: `<=7.5.5`.
- [GHSA-jvwf-75h9-cwgg](https://github.com/advisories/GHSA-jvwf-75h9-cwgg) — **high**: protobuf.js: Process-wide denial of service through unsafe option paths. Affected: `<=7.5.5`.
- [GHSA-685m-2w69-288q](https://github.com/advisories/GHSA-685m-2w69-288q) — **high**: protobuf.js: Denial of service through unbounded protobuf recursion. Affected: `<=7.5.5`.
- [GHSA-q6x5-8v7m-xcrf](https://github.com/advisories/GHSA-q6x5-8v7m-xcrf) — **moderate**: protobufjs has overlong UTF-8 decoding. Affected: `<=7.5.5`.
- [GHSA-jggg-4jg4-v7c6](https://github.com/advisories/GHSA-jggg-4jg4-v7c6) — **moderate**: protobufjs: Denial of Service via unbounded recursive JSON descriptor expansion. Affected: `<=7.5.7`.
- [GHSA-wcpc-wj8m-hjx6](https://github.com/advisories/GHSA-wcpc-wj8m-hjx6) — **high**: protobufjs: Denial of service through unbounded Any expansion during JSON conversion. Affected: `<=7.6.0`.
- [GHSA-f38q-mgvj-vph7](https://github.com/advisories/GHSA-f38q-mgvj-vph7) — **moderate**: protobufjs : Schema-derived names can shadow runtime-significant properties. Affected: `<=7.6.2`.
- [GHSA-j3f2-48v5-ccww](https://github.com/advisories/GHSA-j3f2-48v5-ccww) — **moderate**: protobufjs: Denial of Service via infinite loop in .proto option parsing. Affected: `>=7.5.0 <=7.6.4`.

### sharp — high; direct

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/sharp` | 0.34.5 | production | 0.35.4 | Yes |

Via: direct advisories below.

- [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — **high**: sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591. Affected: `<0.35.0`.
- [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) — **high**: sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545. Affected: `<0.35.4`.

### tmp — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/tmp` | 0.2.5 | production | 0.2.6 | No |

Via: direct advisories below.

- [GHSA-ph9p-34f9-6g65](https://github.com/advisories/GHSA-ph9p-34f9-6g65) — **high**: tmp has Path Traversal via unsanitized prefix/postfix that enables directory escape. Affected: `<0.2.6`.

### websocket-driver — critical; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/websocket-driver` | 0.7.4 | production | 0.7.5 | No |

Via: direct advisories below.

- [GHSA-mp7j-qc5w-4988](https://github.com/advisories/GHSA-mp7j-qc5w-4988) — **moderate**: websocket-driver: Resource limit bypass via message compression. Affected: `<0.7.5`.
- [GHSA-xv26-6w52-cph6](https://github.com/advisories/GHSA-xv26-6w52-cph6) — **critical**: websocket-driver: Message corruption via abuse of protocol length headers. Affected: `<0.7.5`.

## functions

### @grpc/grpc-js — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/@grpc/grpc-js` | 1.14.3 | production | 1.14.4 | No |

Via: direct advisories below.

- [GHSA-5375-pq7m-f5r2](https://github.com/advisories/GHSA-5375-pq7m-f5r2) — **high**: @grpc/grpc-js: A malformed request can cause a server crash. Affected: `>=1.14.0 <1.14.4`.
- [GHSA-99f4-grh7-6pcq](https://github.com/advisories/GHSA-99f4-grh7-6pcq) — **high**: @grpc/grpc-js: An incoming malformed compressed message can cause a client or server crash. Affected: `>=1.14.0 <1.14.4`.

### brace-expansion — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/brace-expansion` | 1.1.12 | dev-only | 1.1.18 | No |

Via: direct advisories below.

- [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) — **moderate**: brace-expansion: Zero-step sequence causes process hang and memory exhaustion. Affected: `<1.1.13`.
- [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — **high**: brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups. Affected: `<1.1.16`.
- [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — **high**: brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash. Affected: `<1.1.17`.
- [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — **high**: brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation. Affected: `<1.1.18`.

### fast-xml-parser — critical; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/fast-xml-parser` | 4.5.3 | production | 5.7.0 | Yes |

Via: direct advisories below.

- [GHSA-m7jm-9gc2-mpf2](https://github.com/advisories/GHSA-m7jm-9gc2-mpf2) — **critical**: fast-xml-parser has an entity encoding bypass via regex injection in DOCTYPE entity names. Affected: `>=4.1.3 <4.5.4`.
- [GHSA-jmr7-xgp7-cmfj](https://github.com/advisories/GHSA-jmr7-xgp7-cmfj) — **high**: fast-xml-parser affected by DoS through entity expansion in DOCTYPE (no expansion limit). Affected: `>=4.1.3 <4.5.4`.
- [GHSA-fj3w-jwp8-x2g3](https://github.com/advisories/GHSA-fj3w-jwp8-x2g3) — **low**: fast-xml-parser has stack overflow in XMLBuilder with preserveOrder. Affected: `>=4.0.0-beta.0 <4.5.4`.
- [GHSA-8gc5-j5rx-235r](https://github.com/advisories/GHSA-8gc5-j5rx-235r) — **high**: fast-xml-parser affected by numeric entity expansion bypassing all entity expansion limits (incomplete fix for CVE-2026-26278). Affected: `>=4.0.0-beta.3 <4.5.5`.
- [GHSA-jp2q-39xq-3w4g](https://github.com/advisories/GHSA-jp2q-39xq-3w4g) — **moderate**: Entity Expansion Limits Bypassed When Set to Zero Due to JavaScript Falsy Evaluation in fast-xml-parser. Affected: `>=4.0.0-beta.3 <4.5.5`.
- [GHSA-gh4j-gqv2-49f6](https://github.com/advisories/GHSA-gh4j-gqv2-49f6) — **moderate**: fast-xml-parser XMLBuilder: XML Comment and CDATA Injection via Unescaped Delimiters. Affected: `<5.7.0`.

### flatted — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/flatted` | 3.3.3 | dev-only | 3.4.2 | No |

Via: direct advisories below.

- [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f) — **high**: flatted vulnerable to unbounded recursion DoS in parse() revive phase. Affected: `<3.4.0`.
- [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) — **high**: Prototype Pollution via parse() in NodeJS flatted. Affected: `<=3.4.1`.

### form-data — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/form-data` | 2.5.5 | production | 2.5.6 | No |

Via: direct advisories below.

- [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) — **high**: form-data: CRLF injection in form-data via unescaped multipart field names and filenames. Affected: `<2.5.6`.

### js-yaml — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/js-yaml` | 4.1.1 | dev-only | 4.3.2 | No |

Via: direct advisories below.

- [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) — **moderate**: JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases. Affected: `>=4.0.0 <=4.1.1`.
- [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) — **high**: js-yaml: YAML merge-key chains can force quadratic CPU consumption. Affected: `>=4.0.0 <4.3.0`.
- [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) — **high**: JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported. Affected: `>=4.0.0 <4.3.1`.
- [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — **high**: js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources. Affected: `>=4.0.0 <4.3.2`.

### minimatch — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/minimatch` | 3.1.2 | dev-only | 3.1.4 | No |

Via: direct advisories below.

- [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) — **high**: minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern. Affected: `<3.1.3`.
- [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) — **high**: minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments. Affected: `<3.1.3`.
- [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) — **high**: minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions. Affected: `<3.1.4`.

### node-forge — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/node-forge` | 1.3.3 | production | 1.4.0 | No |

Via: direct advisories below.

- [GHSA-2328-f5f3-gj25](https://github.com/advisories/GHSA-2328-f5f3-gj25) — **high**: Forge has a basicConstraints bypass in its certificate chain verification (RFC 5280 violation). Affected: `<=1.3.3`.
- [GHSA-q67f-28xg-22rw](https://github.com/advisories/GHSA-q67f-28xg-22rw) — **high**: Forge has signature forgery in Ed25519 due to missing S > L check. Affected: `<1.4.0`.
- [GHSA-5m6q-g25r-mvwx](https://github.com/advisories/GHSA-5m6q-g25r-mvwx) — **high**: Forge has Denial of Service via Infinite Loop in BigInteger.modInverse() with Zero Input. Affected: `<1.4.0`.
- [GHSA-ppp5-5v6c-4jwp](https://github.com/advisories/GHSA-ppp5-5v6c-4jwp) — **high**: Forge has signature forgery in RSA-PKCS due to ASN.1 extra field  . Affected: `<1.4.0`.

### path-to-regexp — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/path-to-regexp` | 0.1.12 | production | 0.1.13 | No |

Via: direct advisories below.

- [GHSA-37ch-88jc-xwx2](https://github.com/advisories/GHSA-37ch-88jc-xwx2) — **high**: path-to-regexp vulnerable to Regular Expression Denial of Service via multiple route parameters. Affected: `<0.1.13`.

### picomatch — high; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/picomatch` | 2.3.1 | dev-only | 2.3.2 | No |

Via: direct advisories below.

- [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) — **moderate**: Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching. Affected: `<2.3.2`.
- [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) — **high**: Picomatch has a ReDoS vulnerability via extglob quantifiers. Affected: `<2.3.2`.

### protobufjs — critical; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/protobufjs` | 7.5.4 | production | 7.6.5 | No |

Via: direct advisories below.

- [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) — **critical**: Arbitrary code execution in protobufjs. Affected: `<7.5.5`.
- [GHSA-66ff-xgx4-vchm](https://github.com/advisories/GHSA-66ff-xgx4-vchm) — **high**: protobuf.js: Code injection through bytes field defaults in generated toObject code. Affected: `<=7.5.5`.
- [GHSA-2pr8-phx7-x9h3](https://github.com/advisories/GHSA-2pr8-phx7-x9h3) — **moderate**: protobuf.js: Denial of service from crafted field names in generated code. Affected: `<=7.5.5`.
- [GHSA-fx83-v9x8-x52w](https://github.com/advisories/GHSA-fx83-v9x8-x52w) — **moderate**: protobuf.js: Prototype injection in generated message constructors. Affected: `<=7.5.5`.
- [GHSA-75px-5xx7-5xc7](https://github.com/advisories/GHSA-75px-5xx7-5xc7) — **high**: protobuf.js: Code generation gadget after prototype pollution. Affected: `<=7.5.5`.
- [GHSA-jvwf-75h9-cwgg](https://github.com/advisories/GHSA-jvwf-75h9-cwgg) — **high**: protobuf.js: Process-wide denial of service through unsafe option paths. Affected: `<=7.5.5`.
- [GHSA-685m-2w69-288q](https://github.com/advisories/GHSA-685m-2w69-288q) — **high**: protobuf.js: Denial of service through unbounded protobuf recursion. Affected: `<=7.5.5`.
- [GHSA-q6x5-8v7m-xcrf](https://github.com/advisories/GHSA-q6x5-8v7m-xcrf) — **moderate**: protobufjs has overlong UTF-8 decoding. Affected: `<=7.5.5`.
- [GHSA-jggg-4jg4-v7c6](https://github.com/advisories/GHSA-jggg-4jg4-v7c6) — **moderate**: protobufjs: Denial of Service via unbounded recursive JSON descriptor expansion. Affected: `<=7.5.7`.
- [GHSA-wcpc-wj8m-hjx6](https://github.com/advisories/GHSA-wcpc-wj8m-hjx6) — **high**: protobufjs: Denial of service through unbounded Any expansion during JSON conversion. Affected: `<=7.6.0`.
- [GHSA-f38q-mgvj-vph7](https://github.com/advisories/GHSA-f38q-mgvj-vph7) — **moderate**: protobufjs : Schema-derived names can shadow runtime-significant properties. Affected: `<=7.6.2`.
- [GHSA-j3f2-48v5-ccww](https://github.com/advisories/GHSA-j3f2-48v5-ccww) — **moderate**: protobufjs: Denial of Service via infinite loop in .proto option parsing. Affected: `>=7.5.0 <=7.6.4`.

### websocket-driver — critical; transitive

| Affected installed path | Installed | Scope | Minimum audit-safe version | Breaking to minimum |
| --- | --- | --- | --- | --- |
| `node_modules/websocket-driver` | 0.7.4 | production | 0.7.5 | No |

Via: direct advisories below.

- [GHSA-mp7j-qc5w-4988](https://github.com/advisories/GHSA-mp7j-qc5w-4988) — **moderate**: websocket-driver: Resource limit bypass via message compression. Affected: `<0.7.5`.
- [GHSA-xv26-6w52-cph6](https://github.com/advisories/GHSA-xv26-6w52-cph6) — **critical**: websocket-driver: Message corruption via abuse of protocol length headers. Affected: `<0.7.5`.

## Resolved versions and remaining findings

### root

| Baseline package | Final locked version(s) | Final audit status |
| --- | --- | --- |
| @genkit-ai/core | 1.42.0 | high |
| @genkit-ai/firebase | 1.42.0 | high |
| @genkit-ai/google-cloud | 1.42.0 | high |
| @genkit-ai/telemetry-server | 1.42.0 | high |
| @genkit-ai/tools-common | 1.42.0 | high |
| @grpc/grpc-js | 1.14.4, 1.9.16 | No reported finding |
| @hono/node-server | 2.1.1 | No reported finding |
| @modelcontextprotocol/sdk | 1.30.0 | No reported finding |
| @opentelemetry/auto-instrumentations-node | 0.49.2 | high |
| @opentelemetry/propagator-jaeger | 1.25.1 | high |
| @opentelemetry/sdk-node | 0.52.1 | high |
| @opentelemetry/sdk-trace-node | 1.25.1 | high |
| adm-zip | 0.5.18 | high |
| axios | 1.20.0 | No reported finding |
| brace-expansion | 5.0.9, 1.1.18, 2.1.4 | No reported finding |
| browserslist | 4.28.9 | No reported finding |
| extract-zip | 2.0.1 | high |
| fast-uri | 3.1.7 | No reported finding |
| fast-xml-parser | 5.11.1 | No reported finding |
| flatted | 3.4.4 | No reported finding |
| form-data | 2.5.6, 4.0.6 | No reported finding |
| genkit-cli | 1.42.0 | high |
| handlebars | 4.7.9 | No reported finding |
| hono | 4.13.7 | No reported finding |
| js-yaml | 4.3.2 | No reported finding |
| jspdf | 4.2.1 | No reported finding |
| lodash | 4.18.1 | No reported finding |
| minimatch | 10.2.6, 9.0.9, 3.1.5 | No reported finding |
| nanoid | 3.3.18 | No reported finding |
| next | 16.3.4 | No reported finding |
| node-forge | No longer in supported parent graph | No reported finding |
| path-to-regexp | 0.1.13, 8.4.2 | No reported finding |
| picomatch | 2.3.2, 4.0.7 | No reported finding |
| postcss | 8.5.23, 8.5.28 | No reported finding |
| protobufjs | 7.6.6 | No reported finding |
| sharp | 0.35.4 | No reported finding |
| tmp | 0.2.7 | No reported finding |
| websocket-driver | 0.7.5 | No reported finding |

### functions

| Baseline package | Final locked version(s) | Final audit status |
| --- | --- | --- |
| @grpc/grpc-js | 1.14.4 | No reported finding |
| brace-expansion | 1.1.18 | No reported finding |
| fast-xml-parser | 5.11.1 | No reported finding |
| flatted | 3.4.4 | No reported finding |
| form-data | 2.5.6 | No reported finding |
| js-yaml | 4.3.2 | No reported finding |
| minimatch | 3.1.5 | No reported finding |
| node-forge | No longer in supported parent graph | No reported finding |
| path-to-regexp | 8.4.2 | No reported finding |
| picomatch | 2.3.2 | No reported finding |
| protobufjs | 7.6.6 | No reported finding |
| websocket-driver | 0.7.5 | No reported finding |
