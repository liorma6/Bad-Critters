# Cloudflare Workers Static Assets

Live game: https://zoobluff.com

The original https://bad-critters.board-experience-engine.workers.dev address remains available.

The domain remains registered at Hostinger; its authoritative nameservers are `addyson.ns.cloudflare.com` and `stanley.ns.cloudflare.com`. Cloudflare uses the Free zone plan. The apex is a Worker Custom Domain for `bad-critters`; `www` is a proxied CNAME to `zoobluff.com`. The Cloudflare zone Redirect Rule `Zoobluff canonical HTTPS` redirects `www` and apex HTTP requests to `https://zoobluff.com`, retaining the path and query string. This gives players one primary browser-storage origin. The redirect is managed in the Cloudflare zone dashboard, separately from Wrangler.

Published to the `bad-critters` Worker on 2026-09-30, with all 133 approved creator recordings. Source: https://github.com/liorma6/Bad-Critters. Update the site from this project with `npm run deploy`; pushing to GitHub alone does not deploy it.

The paid-dubbing update was deployed on 2026-10-01 as Worker version `2728167a-84d9-4e5a-9aed-f24811ba66bc`, game release `0d0ecfb0028baee9`. All 133 approved creator audio files and the published audio catalog remain unchanged. Verification covered 84 logic/storage/API tests and 62 browser scenarios across the full and focused correction runs. The API's positive purchase response was tested with fixtures; no real charge was made. Use `node scripts/verify-purchase-api.mjs https://zoobluff.com` for live negative-activation and private-file checks.

Live production and purchase API checks passed on workers.dev. Production, SEO and purchase API checks also passed on the actual `zoobluff.com` hostname using a process-only resolver override to its public Cloudflare DNS address, with TLS certificate validation enabled. The local network resolver still returned the former Hostinger parking IP during this check; no system DNS settings or authoritative records were changed.

This release deploys only to the `bad-critters` Worker. Static game assets are served directly, and `worker/index.js` handles `/api/dubbing/*` for Gumroad purchase verification. There are no databases, R2 buckets or recording upload endpoints. Cloudflare manages the custom-domain DNS record and HTTPS certificate. The old `.openai/hosting.json` is preserved as historical Sites metadata and is not used by these commands.

Run from the project root with Node 20+:

```sh
npm ci
npm test
npm run test:browser
npm run deploy:check
npm run cf:whoami
# Only if unauthenticated: finish the browser OAuth flow.
npm run cf:login
npm run deploy
```

Never paste account passwords or API tokens into chat. Wrangler prints the actual deployment URL after a successful publish. If several accounts are available, select the intended account; do not change unrelated projects. `npm run preview` runs the built assets through Wrangler locally on port 4174. `npm start` is the unbuilt development server on port 4173.

The build fingerprints the exact JS, CSS, artwork, manifest and audio bytes into `/releases/<hash>/`. Root HTML points at that directory with an absolute base. The game uses the root document and in-page state, with no path-based client router. Unknown routes and missing assets therefore return 404; they are never replaced by an HTML document under an immutable asset URL. `_headers` gives release files a one-year immutable browser cache; root HTML revalidates. The home link returns to `/`. Content types come from Wrangler's extension mapping. Build scripts, creator documents, credentials, development dependencies and the local server are not copied into the public build.

The availability index is small; audio is lazy-loaded per spoken line, including case-specific dialogue. All 133 approved creator recordings are deployed static assets and are available on both public hostnames. No service worker, precache, R2 or paid media service is enabled. Personal recordings remain in browser IndexedDB and cannot be included by this build process. They survive ordinary closing and reopening in the same browser, device and origin, but clearing site data or using private browsing can remove them. Recordings made on localhost or workers.dev do not automatically transfer to zoobluff.com.

Checked against current official documentation on 2026-09-27:

- [Configuration](https://developers.cloudflare.com/workers/static-assets/): assets-only serving without invoking server code for each request.
- [Platform limits](https://developers.cloudflare.com/workers/platform/limits/#static-assets): 20,000 files on Free, 100,000 on Paid, 25 MiB per file. The build fails above the Free file count or per-file size limits; see `build-report.json` for this build's measured footprint.
- [Headers](https://developers.cloudflare.com/workers/static-assets/headers/): MIME types inferred from extensions, ETags and revalidation by default, `_headers` overrides.
- [Static asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/): this game uses `not_found_handling: none`; it has no client-side path routes requiring SPA fallback.
- [Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): static asset requests remain free and unlimited. The purchase API uses ordinary Worker request allowances; no paid storage is configured.

## Paid personal dubbing

### Recording and site information update (2026-10-01)

Published as Worker version `6ac036be-e8c8-41d1-87a3-a7756401cc95`, game release `95876815d448fa36`. Production, SEO, purchase-API and static-information-page verification passed on `zoobluff.com` using the current public Cloudflare DNS address with TLS validation enabled; the process-only resolver workaround did not alter system settings. Normal production and API checks also passed on workers.dev.

The recording screen now has one explicit Save and Continue action, optional stoppable playback, and collapsed microphone/manual-navigation settings. Explicit approval only succeeds after the IndexedDB transaction commits; a storage failure keeps the take on the current screen for retry and does not mark an in-memory-only draft approved. Existing recording identities, storage keys and all 133 official creator files remain unchanged. Verification: 85 logic/storage/API tests and 46 browser scenarios, including reload persistence, failed writes, playback interruption, full-cast recording and mobile layout.

`/information/` contains Hebrew terms, privacy, accessibility, cancellation and contact information. It is static HTML readable without JavaScript, with links in the page footer, welcome dialog and purchase dialog. The operator supplied Lior Mashiach, business number 206173072 and liorma6@gmail.com for publication. Business type, postal address and phone have been requested but not supplied yet. This is a factual baseline, not a completed legal or accessibility certification; professional legal/accessibility review remains appropriate. The cancellation page preserves the existing 30-day Gumroad refund offer and statutory rights.

Fixed-ILS replacement checkout is not connected yet. The user asked for an Israeli provider paid per sale; [Paid](https://paid.co.il/) advertises 1 ILS + 1.2% per local-card transaction, 99 ILS setup, API access and a 14.90 ILS withdrawal fee up to 5,000 ILS. All are before VAT; its 49 ILS monthly minimum applies when monthly volume exceeds 500 ILS. Other card types have different fees. Provider selection, onboarding and final contractual terms remain pending. No provider account or financial commitment has been created. Gumroad unpublishing was blocked by automatic approval review pending explicit user authorization to stop new sales; the existing checkout remains active. Do not describe the currently live checkout as fixed at 9.90 ILS.

Creator-voiced gameplay stays free. The one-time Gumroad product is [זובלוף — דיבוב אישי ללא הגבלה](https://liorma.gumroad.com/l/zoobluff-dubbing), product ID `igraNwrit43FLzFkjlV2bw==`, priced at ILS 9.90. Gumroad may settle the charge in USD and add applicable tax; the product and in-game checkout disclose this before payment. The product's Content tab contains a License key block, activation instructions and a link to `https://zoobluff.com/?dubbing=activate`. The Receipt tab includes Hebrew instructions. Keep the license block enabled.

The product is published. A checkout inspection showed ILS 10.04 despite the configured ILS 9.90 product price, so Gumroad's currency conversion prevents promising an exact final ILS charge. No real payment was made during setup; unrelated existing cart items were preserved and the added test item was removed.

`POST /api/dubbing/activate` sends only the supplied license key and the configured product ID to Gumroad's public license verification API, with `increment_uses_count=false`. It requires a positive-price purchase for this exact product, rejects refunded, disputed, revoked and test purchases, and stores no customer email or payment details. No seller API token is required. A server-only AES-GCM secret encrypts the verified license into a Secure, HttpOnly, SameSite=Lax cookie, scoped to this origin and `/api/dubbing`. The cookie lasts 90 days and verification is repeated after six hours; revoked purchases can retain access for that interval plus the five-minute in-page cache. A provider outage leaves the cookie intact for retry but does not newly unlock recording. Browser storage flags, query parameters and test profiles never grant access.

Set up the secret once with `node scripts/setup-dubbing-secret.mjs` after Wrangler sign-in. The script checks existing secret names and preserves an existing `DUBBING_SESSION_SECRET`; a new random value is passed over stdin and never written to source or printed. Do not rotate it on routine deployment, since rotation signs existing browser sessions out. `GUMROAD_PRODUCT_ID` is a public identifier in Wrangler configuration. The activation API uses a 20-per-minute per-IP provider-verification limit. `/api/dubbing/access` checks the encrypted cookie. All game assets and recordings remain local/browser functionality; this is a purchase gate, not DRM against a user rewriting a locally running open-source client.

Paid players can record one complete role or every role in a case, including the narrator. Each case is explicitly cast; all-role play is enabled only after every required line is approved and decoded. Existing compatible takes are reused across cases. Failed personal playback stays in subtitles without switching to the creator. Neither licensing nor deployment modifies the creator's original takes or player IndexedDB records.

Validation: `node --test --test-isolation=none tests/*.test.mjs`; `npx playwright test -c playwright.paid.config.mjs`; the normal production and SEO verifiers. Purchase browser fixtures intercept the API only in test code and do not claim a real charged sale. The local Node preview uses the same verification handler and an ephemeral session secret; its cookie resets when that preview server restarts.

After deployment, run `node scripts/verify-production.mjs https://ACTUAL-URL` to verify the actual page, 404 handling, asset content types and cache headers, no audio prefetch and immediate play. Also check a microphone take on HTTPS and reload. No public URL should be reported until deployment succeeds.

## Repository and recordings

The source repository is `https://github.com/liorma6/Bad-Critters`. The public `assets/voices/published.json` snapshot and its approved playback files allow the same game to be rebuilt from a clean checkout. Original recordings, the private studio library, history, backups, local credentials and generated build folders are excluded by `.gitignore`. On the recording computer, the local studio remains authoritative. Keep the legacy browser storage keys so the rename does not reset local progress or personal dubbing.

## Search discovery

The homepage provides a descriptive Hebrew title, a meta description, a canonical URL pointing to `https://zoobluff.com/`, Open Graph metadata and `WebSite` JSON-LD naming the game זובלוף. The short description below the game is in the original HTML and remains readable without JavaScript. These same canonical signals are served on the legacy workers.dev address; that address remains accessible for players with existing local recordings.

`robots.txt`, `sitemap.xml` and `/favicon.svg` are copied to stable root URLs during the build. The sitemap contains only the public homepage; cases are in-page game state and have no separate indexable URLs. Assets stay crawlable for rendering. Private creator materials remain excluded from the build and return 404, rather than relying on robots.txt for privacy. No analytics, cookies or external runtime dependency is added by these SEO changes.

The `sc-domain:zoobluff.com` property is verified in the owner's [Google Search Console](https://search.google.com/search-console?resource_id=sc-domain%3Azoobluff.com). Keep the `google-site-verification` TXT record in Cloudflare DNS to retain ownership verification. On 2026-09-30 Google successfully processed the sitemap and discovered its one page; the homepage indexing request was also accepted into the priority crawl queue. Use the Sitemaps report and URL Inspection for subsequent status checks; submission does not guarantee indexing or a search position.

Run `node scripts/verify-seo.mjs https://zoobluff.com` after publication. It checks the served discovery files and content types, XML and JSON-LD, canonical metadata, readable text without JavaScript, mobile layout, game startup and the unchanged published voice catalog. Run `node scripts/verify-production.mjs https://zoobluff.com` for the normal routing and private-file checks. A new domain may temporarily resolve to its previous parking server through stale ISP DNS caches; compare authoritative DNS before changing correct site metadata in response to such a failure.

Cloudflare may inject its optional RUM analytics beacon. The existing `script-src 'self'` policy blocks that third-party script; the SEO verifier reports this provider warning separately from game or crawlability failures. The RUM setting and CSP remain unchanged.

Google references: [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [site names](https://developers.google.com/search/docs/appearance/site-names), [sitemap submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
