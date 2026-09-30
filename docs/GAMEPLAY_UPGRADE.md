# Resident artwork and playable onboarding

## Implemented

- Five painted residents replace the old vector bodies in the moving world and portraits. Thirty painted poses, genuine alpha, separate contact shadows, fitted anchors/hit areas and attached carried objects.
- Every case uses the same explicit observation -> night -> discovery -> investigation -> accusation -> reconstruction/result progression. Observation cannot time out. The lens and interventions cannot block the concealed night sequence. Crime events are recorded once.
- The first case has a playable tutorial: meet the highlighted goat, watch the changed pose, inspect a preliminary fact, open the notebook, choose night, inspect the aftermath, question the witness and compare the notebook. Guidance then becomes ordinary next-action help. Early actions can be revisited without deadlocks. Skip and replay are available.
- A five-stage phase strip, current objective and matching primary action explain progression. A fixed action bar keeps the notebook, next step and help visible on phones.
- Five notebook sections separate observed facts, testimony, timeline and personal suspicions. New findings show a named confirmation, unread count and optional entry link. Review pauses the world and returns to the same case.
- Accusations require a suspect and three to four clues, with a review screen before submission. Wrong attempts preserve choices. Successful attempts show the route, explanation, result and a functioning next-case button.
- Seven narrator/tutorial/announcement lines were added to the original 75 resident lines. The regenerated Markdown/HTML recording scripts and JSON manifest contain stable IDs, exact Hebrew, English direction/trigger and filenames. No recordings are needed to play.

## Root cause fixed

Previously, night depended on an automatic simulation timer, dialogue stopped that timer, and watching the culprit could postpone the crime indefinitely. The interface did not explain those conditions. Now only the explicit advance action starts night. Night runs a controlled sequence with the lens disabled and then waits for the player's acknowledgement of the visible aftermath. Dialogue, tab visibility and pause no longer create an unexplained permanent stop.

## Artwork and provenance

Generated with the built-in image generation tool, one call per resident, using the painted bakery as reference. Runtime files: `assets/art/pigeon-poses.webp`, `cat-poses.webp`, `boar-poses.webp`, `turtle-poses.webp`, `goat-poses.webp`. Six poses per 1536 x 1024 sheet. See [CHARACTER_PROMPTS.md](CHARACTER_PROMPTS.md) for the exact prompts and [ASSETS.md](ASSETS.md) for originals and sizes. No raster background was fabricated or removed with code.

## Actual running screenshots

Desktop:

![Desktop game](screenshots/painted-residents-desktop.png)

Phone viewport:

![Mobile game](screenshots/painted-residents-mobile.png)

Mobile investigation notebook:

![Mobile notebook](screenshots/notebook-mobile.png)

All screenshots are captures of the running game, not generated mockups. See [TESTING.md](TESTING.md) for the verification performed and device/audio limitations.

The packaged reconstruction and carrying attachment were also captured in [reconstruction-carry.png](screenshots/reconstruction-carry.png).
