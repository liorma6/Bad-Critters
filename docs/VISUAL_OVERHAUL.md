# Neighborhood Animals — earlier building overhaul

This document records the earlier building pass and its before/after screenshots. The character artwork, tutorial and progression have since been replaced by the [gameplay upgrade](GAMEPLAY_UPGRADE.md). Current validation is in [TESTING.md](TESTING.md).

The playable game now uses five individually generated, transparent illustrated buildings; a recomposed neighborhood; larger articulated residents; material-specific lighting; and a warm investigator's notebook interface. Hebrew dialogue, all three mysteries, observation, interventions, audio integration and local completion/settings saves remain intact.

## What changed

- Bakery: tiled terracotta roof, projecting striped awning, bread window, flour sacks and recessed entrance.
- Community center: stepped civic roof, solar heater, weathered plaster, noticeboard and exposed wiring. Its removable compressor and chairs remain independent case props.
- Landlord's home: a tall coral silhouette, balconies, shutters, laundry, plants, roof hardware and a grand entry.
- Delivery station: open canopy, cardboard parcels, trolley, workstation and loading ramp.
- Shed: crooked metal roof, mismatched timber, loose padlock, weeds and a warm door crack.
- Residents: a puffed phone-checking pigeon, heavy contractor with work vest, tailored landlord with keys, tired courier with a large blue bag, and asymmetrical chewing goat. Limbs, faces, heads, tails, clothing and carried objects move separately. A caught culprit lowers its head and slumps.
- World: connected paths, stone paving, dusty ground, herb beds, varied trees, foreground wall fragments, sparse leaf motion and dust. Day uses warm stone; dusk warms the earth; night uses teal material colors and localized lantern/door light. No uniform full-scene haze is used.
- Interface: actual Hebrew sign text, restrained evidence glints, contextual labels, selected-character floor ring, a leather-edged paper notebook and shared rig-based portraits. Narrow-screen labels and evidence glints have an independent readable scale.

The bakery, pigeon and cat were first integrated as a pilot in the running game, inspected at gameplay size, then extended across the map. The pilot capture is `screenshots/style-pilot.png`. Buildings retain their native aspect ratios. Ground footprints, entrance anchors, hit areas and sorted scene layers were updated together. Paths go around padded building footprints; foreground buildings also block clicking a hidden resident.

## Actual-game screenshots

[Open the before/after comparison](visual-comparison.html).

The before capture uses the preserved pre-overhaul playable build in `visual-reference/before/`. Both desktop captures show case 1 at 17:00, paused, with a 1280 × 1100 viewport. Browser chrome/scrollbars can make the returned image dimensions slightly different. Portrait captures use a 390 × 844 viewport.

![Before — running original game](screenshots/before-desktop.png)

![After — running packaged game](screenshots/after-desktop.png)

![Portrait mobile](screenshots/after-mobile.png)

Additional captures: [selected resident](screenshots/after-mobile-selected.png), [dialogue](screenshots/mobile-dialogue.png), [night](screenshots/after-mobile-night.png).

## Validation

- 35 automated tests pass: all original simulation/animation checks plus routes between all six locations, movement and bell interruption in every case, reconstruction collision, occluded input and phone tap targets.
- All three mysteries were solved through the actual browser UI and reached their result screen. The second and third were completed at portrait mobile size.
- Checked bell/sprinkler reactions, physical inspection, dialogue portraits, preserved completion badges after reload, RTL layout, no horizontal mobile overflow, and a direct canvas tap selecting the visible cat.
- Built `dist/`, opened that build in the browser, and checked assets and interactions with no console errors/warnings. Updated `Neighborhood-Animals-build.zip` contains the ready-to-host game.
- Five WebPs total 2,501,184 bytes, about 82% below the original PNG total. True alpha is preserved. Night variants are cached once per building. Sampled local desktop drawing time was about 2.85–3.15 ms per frame; this is CPU drawing time, not a device FPS claim.

At this stage, characters were procedural illustrations and simpler than the painted buildings. They have since been replaced by five painted six-pose sheets. The current manifest contains 82 lines; recorded performances and physical-device testing remain pending.

Production assets and provenance: [ASSETS.md](ASSETS.md). Exact built-in image-generation prompts: [ART_PROMPTS.md](ART_PROMPTS.md). Detailed checks and limitations: [TESTING.md](TESTING.md).
