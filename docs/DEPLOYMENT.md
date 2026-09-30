# Cloudflare Workers Static Assets

Live game: https://zoobluff.com

The original https://bad-critters.board-experience-engine.workers.dev address remains available.

The domain remains registered at Hostinger; its authoritative nameservers are `addyson.ns.cloudflare.com` and `stanley.ns.cloudflare.com`. Cloudflare uses the Free zone plan. The apex is a Worker Custom Domain for `bad-critters`; `www` is a proxied CNAME to `zoobluff.com`. The Cloudflare zone Redirect Rule `Zoobluff canonical HTTPS` redirects `www` and apex HTTP requests to `https://zoobluff.com`, retaining the path and query string. This gives players one primary browser-storage origin. The redirect is managed in the Cloudflare zone dashboard, separately from Wrangler.

Published to the `bad-critters` Worker on 2026-09-30, with all 133 approved creator recordings. Source: https://github.com/liorma6/Bad-Critters. Update the site from this project with `npm run deploy`; pushing to GitHub alone does not deploy it.

This release deploys only to the `bad-critters` Worker. `wrangler.jsonc` contains an assets directory and the `zoobluff.com` custom domain, with no Worker script, databases, R2 or upload endpoints. Assets are served directly. Cloudflare manages the custom-domain DNS record and HTTPS certificate. The old `.openai/hosting.json` is preserved as historical Sites metadata and is not used by these commands.

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
- [Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): static asset requests are free and unlimited. This project has no billable application Worker logic or paid storage setup.

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
