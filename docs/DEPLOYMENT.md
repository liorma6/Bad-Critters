# Cloudflare Workers Static Assets

Live game: https://zoobluff.com

The original https://bad-critters.board-experience-engine.workers.dev address remains available.

The domain remains registered at Hostinger; its authoritative nameservers are `addyson.ns.cloudflare.com` and `stanley.ns.cloudflare.com`. Cloudflare uses the Free zone plan. The apex is a Worker Custom Domain for `bad-critters`; `www` is a proxied CNAME to `zoobluff.com`. The Cloudflare zone Redirect Rule `Zoobluff canonical HTTPS` redirects `www` and apex HTTP requests to `https://zoobluff.com`, retaining the path and query string. This gives players one primary browser-storage origin. The redirect is managed in the Cloudflare zone dashboard, separately from Wrangler.

Published to the `bad-critters` Worker on 2026-09-30, with all 133 approved creator recordings. Source: https://github.com/liorma6/Bad-Critters. Update the site from this project with `npm run deploy`; pushing to GitHub alone does not deploy it.

The paid-dubbing update was deployed on 2026-10-01 as Worker version `2728167a-84d9-4e5a-9aed-f24811ba66bc`, game release `0d0ecfb0028baee9`. All 133 approved creator audio files and the published audio catalog remain unchanged. Verification covered 84 logic/storage/API tests and 62 browser scenarios across the full and focused correction runs. The API's positive purchase response was tested with fixtures; no real charge was made. Use `node scripts/verify-purchase-api.mjs https://zoobluff.com` for live negative-activation and private-file checks.

Live production and purchase API checks passed on workers.dev. Production, SEO and purchase API checks also passed on the actual `zoobluff.com` hostname using a process-only resolver override to its public Cloudflare DNS address, with TLS certificate validation enabled. The local network resolver still returned the former Hostinger parking IP during this check; no system DNS settings or authoritative records were changed.

This release deploys only to the `bad-critters` Worker. Static game assets are served directly, and `worker/index.js` handles `/api/dubbing/*` for Paid and legacy Gumroad purchase verification. Email accounts add the dedicated D1 database described below; there are no R2 buckets or recording upload endpoints. Cloudflare manages the custom-domain DNS record and HTTPS certificate. The old `.openai/hosting.json` is preserved as historical Sites metadata and is not used by these commands.

Run from the project root with Node 24+ (the account tests use built-in SQLite):

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

### Email accounts and recording resume (2026-10-01)

Published as Worker version `e444f185-fb47-4618-8966-ddc34820b781`, game release `7350c126a206a009`. All 133 published creator recordings remain unchanged. Production, SEO, authenticated-feature configuration, anonymous purchase denial and static-information-page checks passed on the real zoobluff.com hostname using a process-only public DNS override with TLS checks enabled. The in-app browser's local resolver still displayed the old Hostinger parking page; no system DNS change was made.

The independent cancellation navigation link was removed and the provisions were moved inside the terms in live release `cf851ee0a3b58c4f`, Worker version `23c30516-5ffc-48a0-8231-87134a3cf3c9`, commit `01c7d2c`. Business address, business type and phone remain absent at the operator's request.

The email-account implementation is enabled with `ACCOUNTS_ENABLED=true`. The operator explicitly approved creating the restricted Resend credential after reviewing its scope. The `Zoobluff login` key has Sending access only, scoped to the already verified boardexperienceengine.com domain; it is saved as the encrypted `RESEND_API_KEY` Worker secret. The sender is `זובלוף <login@boardexperienceengine.com>`. No Resend upgrade was purchased; the existing free account's three domain slots remain unchanged. Never put this key in Git, client assets, logs or public Wrangler vars. Existing Paid and session encryption secrets were preserved.

Dedicated D1 database: `zoobluff-accounts`, ID `f1e5adc4-3b9a-4f03-9978-96d72b15bb57`, binding `ACCOUNTS_DB`. The six tables and indexes in `migrations/0001_accounts.sql` were initialized through its Cloudflare dashboard Console on 2026-10-01. Do not rerun that initial SQL on an initialized database. The unrelated board-engine-db was not changed. Existing Wrangler OAuth lacks D1 administration scope; the dashboard was used without expanding that grant.

`/api/dubbing/auth/request` sends a random six-digit code through Resend. Codes expire in ten minutes, allow five verification attempts and are consumed atomically once. Same-origin POST checks, a per-IP limiter, D1 counters (20 sends/hour/IP, 5/hour/email, 60-second email cooldown) and a 90-message/day application budget constrain abuse. The Resend free quota is shared with other projects, so delivery may be unavailable before this application's own ceiling. No automatic paid upgrade or overage is enabled by this integration.

`auth/verify` sets a random 30-day HttpOnly, Secure, SameSite=Lax cookie scoped to `/api/dubbing`; only its hash is stored. `auth/logout` deletes that session and expires both new and legacy cookies. D1 keeps encrypted email, HMAC-derived account IDs, dates, encrypted purchase credentials, ownership and cached verification status. Expired challenges, sessions and counters are pruned in bounded batches during code sends. Keep `DUBBING_SESSION_SECRET` unchanged: it encrypts purchase/email records as well as existing recovery tickets. Rotation without migration would make those records unreadable.

When enabled, checkout requires a verified email session. The server persists an order's account ownership before showing its URL; parallel checkout requests expose the same stored pending order. A completed order unlocks only its owner, even if somebody else pays. Cookie/localStorage deletion is recoverable by signing in to the same mailbox; the pending or completed order remains in D1. Older unbound Paid purchases are queried by verified buyer_email and must match the buyer, merchant, exact product, 990 ILS, one installment and completed sale status. Older Gumroad keys require a verified account matching the provider's purchaser email before attaching. A credential already owned by another account cannot be claimed.

Entitlements are reverified after six hours, plus up to five minutes of client cache. Refunds revoke access; provider errors fail closed and offer retry. Browser flags, success redirect parameters and an email typed without its code cannot grant server entitlement. The app remains a locally running open-source client, not DRM against deliberate client rewriting. Mailbox access is the account identity; no absolute anti-sharing or fraud guarantee is claimed.

The recording-first flow is unchanged. Authentication/payment appear only when starting with complete personal recordings or explicitly restoring a purchase. Account restoration does not restore deleted local voices or sync them between devices. Privacy copy describes Resend, D1 and the actual account retention/session behavior. Keep it paired with activation of the feature.

Validation: 99 Node tests and 18 focused browser scenarios pass, including real SQLite constraints, single-use/expired/exhausted codes, failed delivery, rate limits, encrypted storage, cookie deletion/relogin, ownership, refunds, parallel checkouts, free recording before authentication, mobile layout and preserved recordings. One real transactional login email to the operator's authorized service address was accepted by Resend and subsequently displayed Delivered. Its actual code was verified through the production workers.dev game, and the authenticated session survived a reload. A live 990 ILS pending checkout was prepared, but no card was entered or charge made. Successful paid purchase/refund/recovery scenarios remain fixture-based.

The reported intermittent 4-of-5 recording count did not reproduce with five fresh microphone captures, including delayed storage commits, saving while preview was playing and reloading. A related reproducible resume defect was fixed: when the stored cursor points to an already approved final line but an earlier line is unapproved, resume now opens the first missing line instead of repeatedly returning to the final one. The incomplete summary names the line numbers requiring review/save. Existing audio bytes, approval records and storage keys are preserved; no recordings were deleted or automatically approved.

### Recording and site information update (2026-10-01)

Published as Worker version `6ac036be-e8c8-41d1-87a3-a7756401cc95`, game release `95876815d448fa36`. Production, SEO, purchase-API and static-information-page verification passed on `zoobluff.com` using the current public Cloudflare DNS address with TLS validation enabled; the process-only resolver workaround did not alter system settings. Normal production and API checks also passed on workers.dev.

The recording screen has one explicit Save and Continue action, optional stoppable playback, and collapsed microphone/manual-navigation settings. Explicit approval only succeeds after the IndexedDB transaction commits; a storage failure keeps the take on the current screen for retry and does not mark an in-memory-only draft approved. Existing recording identities, storage keys and all 133 official creator files remain unchanged. Current verification: 89 logic/storage/API tests and 29 relevant browser scenarios, including recording before payment, reload persistence, failed writes, payment return/cancellation, legacy activation, full-cast recording and mobile layout. The network-failure fixture was corrected to reload its seeded recordings and then passed its targeted rerun.

`/information/` contains Hebrew terms, privacy, accessibility, cancellation and contact information. It is static HTML readable without JavaScript, with links in the page footer, welcome dialog and purchase dialog. The operator supplied Lior Mashiach, business number 206173072 and liorma6@gmail.com for publication. At the operator’s explicit request, business type, postal address and phone are not published. Do not add them or claim that omitting them establishes legal compliance. This is a factual baseline, not a completed legal or accessibility certification; professional legal/accessibility review remains appropriate. The cancellation page preserves the existing 30-day Gumroad refund offer and statutory rights.

The operator registered with Paid and authorized connecting it. The catalog item is **זובלוף — דיבוב אישי ללא הגבלה**, SKU ZOOBLUFF-DUBBING, catalog ID a836622a-f810-4b37-a26a-402b51a6ffbe. Its final price is **9.90 ILS**. The hosted Hebrew checkout was inspected and displays 9.90 ILS; no card was entered and no real charge was made.

Recording, editing and durable saving are free, including the all-character option. Only starting a new case with complete, decoded personal roles checks paid access. Creator-voiced play remains free. Recording IDs, IndexedDB and all creator audio are unchanged.

Paid checkout uses the official PayMe [Generate Payment](https://docs.payme.io/docs/payments/d7da26bb42da8-generate-payment) and [List Sales](https://docs.payme.io/docs/payments/13919edc16077-list-sales) APIs. POST /api/dubbing/checkout creates a single hosted credit-card sale with a server-fixed price of 990 agorot, ILS, one installment and no stored card token. No charge is performed by the Worker. The existing merchant API credential is stored only in the Cloudflare PAID_SELLER_ID secret, set over stdin with scripts/setup-paid-secret.mjs. Never put it in client assets, Wrangler vars, logs or Git.

An AES-GCM recovery ticket binds the server-created sale ID to a random merchant transaction reference and merchant account. The client persists the ticket and selected roles before exposing the checkout link. Repeat clicks reuse the same sale; an existing active purchase returns unlocked instead of creating another sale. Paid redirects to https://zoobluff.com/?dubbing=paid-return; the server ignores redirect success/amount parameters and verifies the exact sale through PayMe. Activation requires completed status, matching merchant, sale ID, transaction reference, product description, exact 990 ILS, sale type and one installment. Refunded or disputed statuses cannot activate. The original Paid release had no database; the subsequent account implementation adds D1 without recording uploads.

Before email-account activation, the browser keeps a copyable Paid recovery code in localStorage (zoobluff-paid-purchase-v1). Users can retain that code to restore on another device; it is not an audio backup. The legacy session cookie is Secure, HttpOnly, SameSite=Lax, encrypted, scoped to /api/dubbing, expires after 90 days, and is reverified after six hours (plus a five-minute client cache). Provider outages keep the existing cookie for retry but fail closed for gameplay access. Query parameters, client flags and test profiles cannot create an entitlement. Once accounts are enabled, verified email and server-side ownership replace this bearer-code-only flow as described above.

Gumroad's old product remains published but is no longer linked for new purchases by the game. Existing license keys and cookies remain supported through the previous public license verification API (increment_uses_count=false). Do not delete or unpublish that product without explicit authorization. The original checkout's currency conversion is why Paid replaced it.

Set up the secret once with `node scripts/setup-dubbing-secret.mjs` after Wrangler sign-in. The script checks existing secret names and preserves an existing `DUBBING_SESSION_SECRET`; a new random value is passed over stdin and never written to source or printed. Do not rotate it on routine deployment, since rotation signs existing browser sessions out. `GUMROAD_PRODUCT_ID` is a public identifier in Wrangler configuration. The activation API uses a 20-per-minute per-IP provider-verification limit. `/api/dubbing/access` checks the encrypted cookie. All game assets and recordings remain local/browser functionality; this is a purchase gate, not DRM against a user rewriting a locally running open-source client.

All players can record one complete role or every role in a case, including the narrator. Each case is explicitly cast; all-role play is enabled only after every required line is approved and decoded. Existing compatible takes are reused across cases. Failed personal playback stays in subtitles without switching to the creator. Neither licensing nor deployment modifies the creator's original takes or player IndexedDB records.

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
