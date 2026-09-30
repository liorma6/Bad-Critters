# Cloudflare Workers Static Assets

Live game: https://bad-critters.board-experience-engine.workers.dev

Published to the `bad-critters` Worker on 2026-09-30, with all 133 approved creator recordings. Source: https://github.com/liorma6/Bad-Critters. Update the site from this project with `npm run deploy`; pushing to GitHub alone does not deploy it.

This release deploys only to the `bad-critters` Worker. `wrangler.jsonc` contains an assets directory and no Worker script, routes, custom domains, databases, R2 or upload endpoints. Assets are served directly. The standard `workers.dev` URL supplies HTTPS; no DNS changes are needed. The old `.openai/hosting.json` is preserved as historical Sites metadata and is not used by these commands.

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

The availability index is small; audio is lazy-loaded per spoken line, including case-specific dialogue. No service worker, precache, R2 or paid media service is enabled. Personal recordings remain in browser IndexedDB and cannot be included by this build process. A localhost take will not appear on another origin, such as workers.dev.

Checked against current official documentation on 2026-09-27:

- [Configuration](https://developers.cloudflare.com/workers/static-assets/): assets-only serving without invoking server code for each request.
- [Platform limits](https://developers.cloudflare.com/workers/platform/limits/#static-assets): 20,000 files on Free, 100,000 on Paid, 25 MiB per file. The build fails above the Free file count or per-file size limits; see `build-report.json` for this build's measured footprint.
- [Headers](https://developers.cloudflare.com/workers/static-assets/headers/): MIME types inferred from extensions, ETags and revalidation by default, `_headers` overrides.
- [Static asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/): this game uses `not_found_handling: none`; it has no client-side path routes requiring SPA fallback.
- [Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): static asset requests are free and unlimited. This project has no billable application Worker logic or paid storage setup.

After deployment, run `node scripts/verify-production.mjs https://ACTUAL-URL` to verify the actual page, 404 handling, asset content types and cache headers, no audio prefetch and immediate play. Also check a microphone take on HTTPS and reload. No public URL should be reported until deployment succeeds.

## Repository and recordings

The source repository is `https://github.com/liorma6/Bad-Critters`. The public `assets/voices/published.json` snapshot and its approved playback files allow the same game to be rebuilt from a clean checkout. Original recordings, the private studio library, history, backups, local credentials and generated build folders are excluded by `.gitignore`. On the recording computer, the local studio remains authoritative. Keep the legacy browser storage keys so the rename does not reset local progress or personal dubbing.
