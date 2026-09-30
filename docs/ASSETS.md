# Current asset inventory

The runtime uses 17 transparent WebP files: five original buildings, six new six-pose resident sheets, two damaged-building variants and four supporting-character/crime-scene images. The twelve new images total 4,327,242 bytes. All original alpha pixels are preserved exactly in compression; see `art-validation.json`.

## Revised production assets

- `assets/art/goat-dark.webp`: Yerachmiel, elderly pavement-policing goat.
- `assets/art/pigeon-dark.webp`: Nevo, lanky would-be investigator.
- `assets/art/snake-dark.webp`: Zalman, coiling furniture obsessive.
- `assets/art/cat-dark.webp`: Margalit, severe landlady with keyring.
- `assets/art/boar-dark.webp`: Benny, sweating contractor with folder.
- `assets/art/turtle-dark.webp`: Tzvika, scratched-shell courier with extended neck.
- `assets/art/home-burned.webp`: blackened plaster, broken windows, charred entry, displaced belongings.
- `assets/art/home-collapsed.webp`: prior fire damage plus lost right balcony, debris and broken chair.
- `assets/art/badger-alive.webp`: adult Amos before the murder.
- `assets/art/courtyard-evidence.webp`: covered adult badger, overturned chair, glasses, strap, receipts and disturbed ground.
- `assets/art/hedgehog-alive.webp`: adult Rina seated before the collapse.
- `assets/art/hedgehog-injured.webp`: Rina alive on a stretcher with an adult medic and medical bag.

These are generated production sprites integrated into the Canvas renderer. `src/dark-frames.js` contains measured per-pose alpha bounds. Runtime source crops do not change the original sheets. The same sheets supply portraits and world characters. `src/art-assets.js` is the authoritative runtime inventory.

## Sources and method

Built-in image generation was used, not the fallback CLI/API. The goat established the adult editorial caricature benchmark. Other residents used its sheet as a style reference, not as an identity reference. The burned building was edited from the original home; the collapse was edited from the burned variant. Supporting sprites used the same style reference. Exact prompts: `DARK_ART_PROMPTS.json`. Original output paths: `dark-sources.json`. Workspace copies: `docs/visual-reference/<asset>-source.png`.

`scripts/prepare-dark-art.py` copies original PNGs, converts unchanged RGBA to quality-88 WebP, and measures connected components for sprite framing. It does not synthesize imagery, paint pixels, erase backgrounds or alter silhouettes. `art-validation.json` records dimensions, byte sizes, transparency and exact alpha preservation.

The architecture source prompts remain in `ART_PROMPTS.md`. Earlier cute sheets and old visual documents remain historical source material; the build removes their obsolete copies from `dist/assets/art`. It never removes the archived source assets.

All procedural flames, smoke, light pools, dust, cordons, paper props, ground and plants are authored Canvas artwork. No third-party stock assets, fonts or music are required. Short ambient tones and incident sounds use Web Audio. Human voice recordings are pending.
