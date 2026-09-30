# Dark neighborhood revision

The new direction replaces the earlier cute residents and petty thefts. The first production benchmark was completed and played before extending the art: elderly goat plus burned-house case, including tutorial, evidence, correct accusation, reconstruction and persistent damage.

## Cast and movement

Six production sheets contain six distinct painted poses each: idle, two movement poses, watched reaction, interaction and defensive recoil. Their silhouettes are deliberately different: wiry cardigan goat, lanky feathered pigeon, low coiling snake, severe upright cat, heavy sweating contractor, worn crawling turtle. Portraits and world actors use exactly the same sheets.

Movement is distance-based. The goat shuffles with short intermittent steps; the pigeon flutters and lands with a separate ground shadow; the snake changes S-curves without bouncing and coils at its bench; the cat bends at the drain; the boar strides then wipes his face or examines his folder; the turtle crawls slowly with a quick extended-neck pose. Post-incident residents gather outside the scene and stop visiting the damaged locations. Building footprints and actor hit bounds account for the new art.

## Case logic (spoilers)

1. **בית בלי פנקס:** Margalit deliberately burns the empty building to destroy the rental ledger before an audit. Arson finding + exclusive entry testimony + pre-fire belongings or overheard advance knowledge + audit notice or false denial. Benny's abandoned tools are explained by earlier work and a witness placing him elsewhere. No practical ignition details are provided.
2. **מקום שמור לעמוס:** Nevo murders adult auditor Amos to suppress exposure of paid fabricated reports. A physically matching torn satchel strap, witnessed meeting/opportunity, recovered notebook or complaint, and Nevo's false denial establish the solution. Yerachmiel's threat is a plausible red herring, countered by Tzvika and the bakery record. No killing method or graphic injury is shown.
3. **כשיר, עד שנפל:** Benny knowingly opens an unsafe balcony after concealing an urgent warning and deferring repair. The old danger report, signed receipt, false clearance and examination of the rubble distinguish concealed negligence from accident or new sabotage. Zalman's earlier visit is misleading; dated damage predates it. Adult Rina survives and receives emergency care. No practical sabotage detail is included.

Each case requires four complementary facts. Selecting arbitrary clues, duplicating one clue, choosing an innocent resident, or passing invented/uncollected IDs cannot solve it. Every required fact can be recovered after the incident, including when observation or interventions were missed.

## Consequences and chronology

`sceneState()` derives the canonical visual state from case index, incident phase and reconstruction clock. Fire damage remains through later cases; the murder scene becomes Amos's memorial; the collapsed facade remains after the conclusion. Reconstruction temporarily presents the historical scene and does not erase evidence or change saved consequences. Replaying the first case restores the intact house and removes later incidents.

The 12-second night sequence is independent of player movement speed and cannot be blocked by the observation lens. The opening veil lasts only 2.5 seconds; fire, smoke, collapse dust and the discovery are visible on the actual map. The murder uses a non-graphic before/after cut, followed by the covered body, overturned chair, glasses, receipts, disturbed ground and cordon. Inspecting a scene also opens its production artwork at a readable scale beside the facts.

## Art provenance

All revised bitmap artwork was created with the built-in image-generation tool. No fallback API or external stock art was used. `DARK_ART_PROMPTS.json` records the exact prompts. `dark-sources.json` records original tool output paths; those PNGs were also copied into this workspace's `docs/visual-reference/`. `scripts/prepare-dark-art.py` compresses unchanged RGBA images to WebP and measures alpha bounds; it does not paint, remove backgrounds or alter the generated artwork. Fire/smoke, tape, simple paper props, lighting and dust are code-native Canvas elements layered separately.

The original architecture remains, with the same footprints and anchors for intact/burned/collapsed variants. Warm daylight is preserved; evening uses uneven pools of light. Older cute sheets remain only as historical source material and are not loaded by the new game.

## Known limits

No human voice recordings have been supplied; the 99-line recording package and exact text fallback are ready. Character animation uses painted pose switching plus presentation transforms, not skeletal interpolation. There is no backend, procedural case generator or police AI. Scene consequences are authored across the three cases; current-case progress is reset by reload/restart, while completion ratings and settings persist.
