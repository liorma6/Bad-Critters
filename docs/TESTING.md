# Verification report — September 25, 2026

For the current quick-dubbing release, see [QUICK_DUBBING_TESTING.md](QUICK_DUBBING_TESTING.md). This older report is retained for the previous revision.

This report applies to the dark-comedy revision. Older screenshots and design reports in this project describe earlier versions.

## Automated checks

`node --test tests/*.test.mjs`: **52 passing tests**, no failures or skipped checks. Coverage includes all three supported solutions, exhaustive four-clue combinations and all six suspects, evidence recovery after missed events, optional interventions spent early, manual night, idempotent incidents, pause/restart, tutorial progression, fresh case state, and canonical replay consequences.

Rendering/simulation checks cover six poses for all six residents, distance-driven gait, pause, bounded effects, obstacle-free routes, generous phone hitboxes and foreground occlusion. Reconstruction tests check destination, witnesses, notebook acquisition after the courtyard incident, preserved evidence and permanent damage. Slow-frame tests compare 1, 15 and 60 updates per second. Two audio tests verify exact Hebrew fallback for missing recordings and playback rejection.

## Actual browser walkthrough

Used the running game in Chromium with an isolated `?test-profile=dark-benchmark` save. The user's older saved progress was not erased.

- Completed the goat and burned-house benchmark before producing the rest of the cast: tutorial, lens reaction, preliminary fact, notebook, manual night, visible fire damage, testimony, four-fact accusation, reconstruction and result.
- Inspected all six replacement residents in the actual world, species poses and their matching dialogue portraits. Verified Amos and Rina can be met as living adults before their incidents.
- Played the courtyard case through the covered-body discovery, physical evidence, witness questioning, an incorrect accusation of the goat, retained selections, the supported pigeon accusation, reconstruction and final result. Repeated the supported solution after the slow-frame timing fix.
- Completed the balcony case through the incident, the damaged facade and injured adult receiving care, four document findings, phone-sized accusation/review, reconstruction and result. Confirmed prior fire damage and Amos's memorial remain visible.
- Used Next Case from the murder result to the balcony case. All three solved badges persisted after reload. Replay of case three restored its pre-collapse facade and living Rina while retaining the earlier fire damage and memorial. Canonical restoration of earlier cases is also covered by simulation checks.
- Tested desktop at 1280 × 1100, phone at 390 × 844 and narrow phone at 320 × 740. The phone evidence dialog, accusation/review, notebook, objective and bottom action bar remained usable. No horizontal document overflow: content widths were 375px and 305px respectively (the scrollbar occupies the remaining width).
- Observed average Canvas CPU draw samples of 2.32ms on desktop and 3.02ms at 320px. These are local draw-time samples, not end-to-end FPS or device benchmarks.
- Browser warning/error logs were empty in the checked run.
- Opened the packaged `dist/index.html` in a separate profile and completed the courtyard incident, evidence, review, corrected witness staging, reconstruction and result. Then replayed the first case, verified the intact home and absent later crime scenes, and triggered its fire.

## Assets and recordings

The runtime loads **17 production WebP files**: five original architecture assets and twelve new generated assets (six resident sheets, two damaged building variants, the courtyard scene, and three supporting-character states). Total runtime art is approximately 6.83MB. Every new asset has true transparency; its alpha channel matches the original generated PNG exactly after compression. Validation details are in `art-validation.json`, prompts in `DARK_ART_PROMPTS.json`, and source copies in `visual-reference/`.

The build generates **99 unique voice lines**: 69 essential and 30 optional. IDs, exact Hebrew, character, English performance direction, English trigger, filename and priority share one source with the subtitles and JSON manifest. **Zero voice recordings are installed.** Missing-file text/subtitle fallback is the working release path.

## Actual screenshots

Unretouched running-browser captures in `docs/screenshots/`:

- `dark-desktop-day.png`: daytime cast and preserved architecture.
- `dark-fire-desktop.png`: burned-house aftermath.
- `dark-courtyard-desktop.png`: adult victim, belongings and cordon.
- `dark-balcony-desktop.png`: collapsed facade, rubble, memorial and emergency care.
- `dark-mobile-evidence.png`: phone-sized RTL evidence inspection.

The browser capture service returns images slightly smaller than the configured CSS viewport. These are gameplay screenshots, not generated mockups.

The ZIP integrity check passed. It contains all 17 production art files, all five current screenshots and the 99-line manifest; packaged HTML and runtime JavaScript match the workspace byte for byte. A dependency-free Node server and `npm start` command are included for local play.

## Remaining limitations

- No human MP3 performances have been supplied. Actual recorded-voice mixing and playback need verification after recording; the script and installation instructions are ready.
- Resized desktop Chromium is not a physical phone. iOS Safari, Android touch hardware, speaker output, battery use and device FPS have not been tested.
- Animation uses six painted poses per resident with species-specific timing and transforms, not a full skeletal or multi-directional animation library.
- Case ratings and settings persist; the current investigation and personal notes reset on reload/restart. Consequences are authored across three cases, not an open-ended procedural world.
- No backend, account, telemetry, police simulation or public deployment is included.
