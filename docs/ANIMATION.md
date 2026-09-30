# Painted residents and animation

The moving residents and dialogue portraits use the same five transparent WebP sheets in `assets/art/*-poses.webp`. These replace the former geometric body drawings. Each sheet contains six independently painted poses: idle, walk A, walk B, watched, carrying/interacting and caught. The bakery served as the visual reference for warm light, textured materials and three-quarter perspective.

`src/character-frames.js` holds measured source rectangles and ground anchors. Torso centers are projected onto the ground so the body does not jump horizontally when the leading foot changes. Vertical placement uses each pose's lowest foot. The original image alpha remains unchanged; shadows are drawn as separate soft canvas ellipses.

`Animator` in `src/animation.js` smooths positions and advances gait by distance travelled, with species-specific stride lengths. The sprite sequence uses the two walk drawings with an intermediate idle/contact drawing. Stopped residents stop stepping. Idle residents breathe gently and occasionally use the alternate glance pose; observation switches to the full watched drawing, with a brief surprise effect. The culprit uses the slumped drawing at the end of reconstruction.

Carrying uses a dedicated extended-limb pose with small lower-leg articulation. Hand attachment offsets are per species. The trolley handle, wheels and cargo are separate pieces; wheel height is calculated from ground level, so the cargo does not move independently of the grip. The three case objects remain readable during reconstruction. Selection rings, nameplates and phone hit areas fit the larger silhouettes; foreground building occlusion is respected.

The animator remains independent of routes, evidence, tutorial steps and case outcomes. Case/reconstruction teleports snap rather than sliding across the map. Pause, dialogue and notebook review freeze the presentation clock and simulation. Particles are bounded to 100; sprites are loaded once. Canvas drawing uses at most 2x device pixel ratio. There are no animation dependencies.

Environmental animation retains moving foliage, dust, water droplets, a swinging bell and cached night building variants. The explicit night transition hides moving residents until aftermath discovery; it does not reveal the culprit. Reconstruction uses the same navigable paths as ordinary movement.

This is a compact six-pose sprite system, not a full multi-directional frame-by-frame animation set. Additional in-between frames and directional views can be added to the same renderer. Source PNGs and exact generation prompts are preserved for future work.
