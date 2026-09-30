# Adding an authored case

Add a case in `src/cases.js`: stable ID, Hebrew title/brief/consequence, preLocation/preFact, culprit, source/destination, reconstruction item, clues, four complementary proof groups, three escalating hints, three reconstruction beats and closing consequence. IDs must be unique within the case, every clue location must resolve to a resident or place, and each proof group must have recoverable evidence. The UI currently supports exactly four selected facts.

Add three spoken lines per principal resident in `src/voices.js`, plus a guide discovery line. Culprit detail is restricted to reconstruction. Facts must agree with exact spoken testimony and distinguish a witness claim from a verified finding. Include an alternative suspect and an explicit way to explain misleading evidence.

Define persistent before/after state in `src/incidents.js`, incident captions, safe aftermath positions and reconstruction stops. Extend `src/crime-scenes.js` with actual persistent assets, not just a toast or effect. Preserve earlier consequences and restore canonical state when replaying. Add supporting adult sprites/dialogue if needed; do not remove the six principal residents from questioning.

Keep artwork, collisions and hitboxes aligned with `src/scene-layout.js`. Use separate transparent assets and build-time measured bounds. Add runtime IDs to `src/art-assets.js`. `npm run build` regenerates script/manifest. Extend the simulation, scene chronology, evidence, navigation and replay checks, then manually play both correct and incorrect accusations on desktop and mobile.
