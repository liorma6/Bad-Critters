# זובלוף

**[למשחק זובלוף](https://zoobluff.com)**

A playable Hebrew neighborhood mystery: six principal animal caricatures, two supporting neighbors, three serious cases, an illustrated living street and an RTL investigation notebook. Each case offers creator voices, a complete five-line spoiler-free supporting role, or a complete 13-line principal role after a spoiler warning. One personally cast character keeps the same voice throughout the case. Vanilla JavaScript and Canvas; no runtime dependencies, backend or accounts.

## Run

Requires Node.js 20 or newer. Run `npm start`, then open http://127.0.0.1:4173/. Keep the server running. Browser modules need HTTP; opening the HTML as a local file will not work.

- `npm ci`: install the pinned build, deployment and test tools.
- `npm test`: simulation, evidence, tutorial, animation, storage, compatibility and audio checks.
- `npm run test:browser`: Chrome browser tests with a simulated microphone (requires Chrome).
- `npm run build`: fingerprinted static `dist/`, creator script and manifest.
- `npm run preview`: Cloudflare local production preview at http://localhost:4174.
- `npm run deploy:check`: production build and Cloudflare dry run.
- `npm run cf:login`: normal Cloudflare browser login, when needed.
- `npm run deploy`: publish to the `bad-critters` Worker using Static Assets.

Source repository: [liorma6/Bad-Critters](https://github.com/liorma6/Bad-Critters). Use a fresh build for publication. Deployment instructions are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md); feature notes and limits are in [docs/QUICK_DUBBING.md](docs/QUICK_DUBBING.md).

## Play

Meet a neighbor, watch their behavior with the lens, inspect a notice, and use the explicit night button when ready. The first case teaches each step. The night sequence lasts 12 seconds; the incident remains visible afterward. There is no investigation countdown. Dialogues and the notebook pause the world. Space pauses; arrow keys move the focused lens; mouse or touch selects actors and places. The quick-access buttons below the map provide equivalent keyboard access.

Collect four supporting facts, select a suspect and submit an explanation. Testimony is marked as a claim; documents and physical findings are separate. Incorrect guesses preserve the evidence and allow another attempt. Hints are optional. Each supported solution plays a 20-second reconstruction and leaves the consequences in place. The bell gathers residents away from the scene; the sprinkler changes their behavior, without revealing essential evidence or contaminating the scene. Each has two uses.

Cases proceed from a burned house, to the murder of adult accountant Amos, to a balcony collapse injuring adult tenant Rina. The damaged house persists; Amos's empty place becomes a memorial in the third case. Selecting or replaying a case restores its canonical starting scene. The principal six residents stay available for questioning while the findings are referred for further investigation.

Completed case ratings, settings and the confirmed current-case casting save under `neighborhood-animals-dark-v2`. Reload/restart resets the current investigation and handwritten notes and asks for casting again. Personal takes, automatic drafts and recording-session positions live separately in IndexedDB and survive case changes. A complete principal role contributes 10 compatible lines to another case, leaving three new recordings. A partial role cannot be activated. Failed personal clips use subtitles without substituting creator audio. Approved creator recordings are included; all 133 exact Hebrew lines also work as text and subtitles. The 126 personal lines include investigation information in full roles; only the designated five-line quick parts are safe to record before playing.

## Current production files

- `src/residents.js`: six identities, relationships, secrets, obsessions and routines.
- `src/voices.js`, `src/signature-lines.js`, `src/small-roles.js`: 133 exact Hebrew lines, including the complete compact supporting parts.
- `src/dialogue-manifest.js`, `src/recording-identity.js`: finite case/character speech events, complete recording requirements and compatibility fingerprints.
- `src/quick-dubbing.js`, `src/recorder.js`, `src/voice-store.js`: optional recording, browser audio processing and local persistence.
- `src/mouth-rigs.js`, `src/speech-animation.js`: four amplitude-driven textured jaw states shared by world sprites and portraits.
- `src/cases.js`: authored facts, false accounts, alternative suspects, proof groups and reconstructions.
- `src/simulation.js`, `src/incidents.js`: progression and persistent scene state.
- `src/characters.js`, `src/dark-frames.js`, `src/animation.js`: six painted poses per resident, species-specific timing, measured alpha framing.
- `src/crime-scenes.js`, `src/render.js`, `src/environment.js`: separate scene assets, incident effects, layered world and interactions.
- `assets/art/*-dark.webp`: actual world/portrait sprites, not concept art.
- `assets/art/home-burned.webp`, `home-collapsed.webp`, `courtyard-evidence.webp`: permanent aftermath variants.
- `docs/RECORDING_SCRIPT.md`, `docs/recording-script.html`: grouped recording documents.
- `assets/voices/manifest.json`: source-matched subtitle/audio manifest.
- `assets/voices/recording-cases.json`, `docs/PERSONAL_LINES.md`: complete per-case recording manifests and Hebrew scripts (full scripts contain spoilers).
- `docs/DIALOGUE_COVERAGE.md`, `docs/COMPLETE_ROLE_DUBBING.md`: before/after line audit, casting rules and current verification.
- `docs/AUDIO.md`: how to install your recordings.
- `docs/DARK_REVISION.md`, `docs/TESTING.md`: implementation and verification notes.
- `docs/DARK_ART_PROMPTS.json`, `docs/dark-sources.json`: exact built-in image-generation prompts and source provenance.
- `docs/screenshots/dark-*.png`: actual running-browser captures.

Original artwork and earlier design documents remain in the local project archive; the repository includes the artwork used by the game. No external runtime requests, analytics or paid speech services.

## Recording preservation

`assets/voices/published.json` indexes the approved playback files included in the repository. A clean checkout builds those voices without access to private studio files. When the local creator library exists, it takes precedence and each build refreshes the public snapshot. Only the active files in this index should be committed. Raw sources, previous takes, studio progress and review backups remain local and are excluded from Git. The existing browser storage keys stay unchanged to preserve saved progress and personal recordings after the rename.
