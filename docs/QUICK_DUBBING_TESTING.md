# Quick dubbing verification — 2026-09-27

**Historical baseline before the microphone fix.** The simulated-device tests below did not establish physical microphone capture or non-silent recorded output. See [MICROPHONE_FIX.md](MICROPHONE_FIX.md) for the later signal-validation tests, real Chrome capture probe, and unresolved in-app browser acquisition limit.

The signature-only casting and personal-to-creator substitution described below are superseded by [COMPLETE_ROLE_DUBBING.md](COMPLETE_ROLE_DUBBING.md). This document preserves the earlier test record; it does not describe current behavior.

## Passed locally

- **58 Node tests**: all previous case solutions, alternative suspects, clue combinations, tutorial, navigation, pause/restart and timing; six signature sets and substantive dialogue in every case; IndexedDB save/reload/replace/delete and memory fallback; script/character compatibility; format-selection branches and four mouth thresholds.
- **19 browser tests**, Chrome on Windows with simulated microphone/audio: record, stop, listen-before-accept, accept preview, reuse after reload, replacement, deletion, partial-set early playback, one active character, creator-only entry, denied and unsupported microphones, enhancement metadata, device-ended and navigation interruption, mobile RTL layout and a visible Start button. All three cases were completed through the actual UI, including proof submission, reconstruction and result. Machine-readable summary: `browser-test-summary.json`.
- Each of the six selected residents played an early saved line, with one of the six signature categories represented by each test. Real generated WAV audio drove the analyser; tests observed mouth opening, closure during an embedded silence, and reset on pause. Personal-to-creator-to-subtitle fallback, actual clip completion, creator load error, no music-driven mouth movement, overlap prevention and cooldown were checked.
- Visual captures of selection, recording at 390 × 844, and four mouth states for all eight illustrated speakers were inspected. Flat replacement patches were rejected during review and replaced with textured jaw motion. The revised rig and interruption cleanup passed focused repeat checks.
- Production build and `wrangler deploy --dry-run` passed. Wrangler local production serving passed `scripts/verify-production.mjs`: correct HTML/JS/CSS/WebP/JSON content types, root HTML revalidation, immutable fingerprinted files, real 404s for unknown routes/missing audio, six-character selection and immediate play, no page errors or asset failures, no audio prefetch.

## Limits and remaining requirements

- Microphone tests used Chrome's simulated device. No claim is made about real-room noise removal, performance quality, or physical device capture. iOS Safari and Android Chrome hardware have not been tested. MP4/AAC and Ogg selection branches were unit-tested; actual mobile encoder/playback behavior still needs a device pass.
- There are **zero installed creator recordings**. Creator fallback was exercised with a generated test-only WAV response, not invented performances. Supply versioned files from `RECORDING_SCRIPT.md` / `assets/voices/manifest.json`, then rebuild and redeploy.
- Cloudflare `whoami` reported **not authenticated**. Local build/deployment configuration is verified; no public deployment or production URL has been claimed. Complete `npm run cf:login` in the normal browser flow, then `npm run deploy`; validate the returned URL with `node scripts/verify-production.mjs URL`.
- Browser recordings are origin-specific. Recordings made on localhost do not migrate to workers.dev; clearing site data removes them. Import/export is deliberately outside this release.

## Reproduce

```sh
npm test
npm run test:browser
npm run deploy:check
npm run preview
# In another terminal:
node scripts/verify-production.mjs
```

The sandbox used for this work blocked Node's subprocess-based test runner; `node --test --test-isolation=none tests/*.test.mjs` ran all 58 tests successfully in-process. Ordinary `npm test` remains the standard command outside that restricted sandbox. Browser tests use named isolated profiles and never clear a player's normal save.
