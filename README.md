# Landing Optimizer — Snippet SDK

Privacy-preserving analytics + safe DOM experiment overlay, delivered as a tiny
async bundle. **No PII is ever collected.** See
[../landing-optimizer-infra/docs/EVENT_SCHEMA.md](../landing-optimizer-infra/docs/EVENT_SCHEMA.md).

## Install

Paste the generated snippet (see [install/snippet.template.html](install/snippet.template.html))
just before `</head>`. It loads asynchronously and fails silently.

### Public API
```js
window.LandingOptimizer.track("cta_click", { section: "hero" });        // custom event
window.LandingOptimizer.identifyCompanyContext({ plan: "pro" });        // non-PII B2B only
window.LandingOptimizer.conversion("signup", { value: 1 });             // conversion goal
```
Calls made before the SDK finishes loading are queued and replayed.

### Google Tag Manager
Use a **Custom HTML** tag with the snippet from `install/snippet.template.html`,
firing on *All Pages*. No `document.write`.

### CSP-safe deployment
Add to your Content-Security-Policy:
```
script-src  'self' https://cdn.landingoptimizer.io;
connect-src 'self' https://ingest.landingoptimizer.io https://cdn.landingoptimizer.io;
```
The inline stub is small; if you enforce `script-src` without `'unsafe-inline'`,
add a nonce/hash to the inline `<script>` (the dashboard shows the hash), or host
the loader from the CDN and reference it with `src` only.

## Privacy guarantees
- Never reads form values, `input[type=password]`, or `[data-lo-ignore]` subtrees.
- Session id is random, per-tab (`sessionStorage`), short-lived, non-cross-site.
- Referrer host only, path only (query stripped), coarse device/browser buckets.
- Props are PII-scrubbed and size-capped before leaving the page.

## Development
```bash
npm install
npm run build      # emits dist/lo.js (bundle) and dist/loader.js
npm test           # vitest (jsdom)
npm run typecheck
```

### Docker watch mode
Requires Docker Compose 2.23 or newer:

```bash
docker compose -f docker-compose.yml -f docker-compose.watch.yml up --build --watch
```

`src/` edits rebuild `dist/lo.js` and `dist/loader.js` through `tsup --watch`;
the SDK remains available at http://localhost:4000. Demo-page edits synchronize
to http://localhost:3005 (refresh the page to reload the latest SDK). Changes to
package manifests or Dockerfiles rebuild the development image.

## Architecture
| Module | Responsibility |
| --- | --- |
| `config.ts` | Read runtime config from script tag / `__LO_CONFIG`. |
| `session.ts` | Short-lived, opaque session id. |
| `detect.ts` | Coarse device/browser/bot/language detection. |
| `sanitize.ts` | PII scrubbing, selector allowlist, HTML sanitizer. |
| `transport.ts` | Batching + `sendBeacon`/`fetch` flush. |
| `pagemap.ts` | Sanitized structural page map. |
| `tracker.ts` | Behavioral listeners + public `track`/`conversion`. |
| `hover.ts` | Element-anchored hover attention (1 Hz sampling, aggregated `hover` events; coordinates never leave the browser). |
| `experiments.ts` | Signed config fetch/verify + variant allocation + DOM apply. |
| `capture.ts` | Operator-only page snapshot (`lo-capture.js`, separate bundle) — lazy-loaded via `?lo_capture=1`, never for real visitors. |
| `index.ts` | Bootstrap + queue drain + capture trigger. |
| `loader.ts` | Tiny async loader source. |
