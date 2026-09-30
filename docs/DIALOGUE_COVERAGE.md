# Complete case dialogue audit

Counts are unique recording requirements, not playback occurrences. The source of truth is `src/dialogue-manifest.js`; `assets/voices/recording-cases.json` is generated from it. Every gameplay speech event resolves through this manifest and `AudioManager`. Sound effects, music, written notebook entries, written scene captions, and the written results page are not spoken lines.

## Before this revision

| Character | Fire | Courtyard | Balcony |
|---|---:|---:|---:|
| ירחמיאל / goat | 13 | 13 | 13 |
| נבו / pigeon | 13 | 13 | 13 |
| זלמן / snake | 13 | 13 | 13 |
| מרגלית / cat | 13 | 13 | 13 |
| בני / boar | 13 | 13 | 13 |
| צביקה / turtle | 13 | 13 | 13 |
| עמוס / badger | 0 | 1 | 0 |
| רינה / hedgehog | 0 | 0 | 1 |
| משמרת השכונה / guide | 5 | 2 | 2 |
| **Total** | **83** | **81** | **81** |

Each principal part was already 13 lines: 10 reusable lines plus three case-specific lines. The six signature recordings were only a subset. The arrival line was reachable through the former early-personal-recording encounter; it now also has an explicit optional conversation branch. All three case scripts and all branches were traced through `main.js`, `simulation.js`, `voices.js`, and the actual runtime call sites before rewriting.

## Implemented counts

| Character | Case 1: בית בלי פנקס | Case 2: מקום שמור לעמוס | Case 3: כשיר, עד שנפל |
|---|---:|---:|---:|
| ירחמיאל | 13 | 13 | 13 |
| נבו | 13 | 13 | 13 |
| זלמן | 13 | 13 | 13 |
| מרגלית | 13 | 13 | 13 |
| בני | 13 | 13 | 13 |
| צביקה | 13 | 13 | 13 |
| עמוס | **5 — quick role** | **5 — quick role** | 0 |
| רינה | 0 | 0 | **5 — quick role** |
| משמרת השכונה (creator only) | 5 | 2 | 2 |
| **Total requirements** | **88** | **85** | **85** |

There are 133 distinct authored line IDs across the game, of which 126 are eligible personal lines. Per-case totals deliberately count reusable lines again because each selected role must cover them. An already recorded full principal part contributes 10 reusable recordings to another case, leaving three new recordings. Amos reuses three lines between cases 1 and 2, leaving two new recordings. Compatibility also requires matching version, text fingerprint, performance context, valid decoded audio, and completed review; counts do not imply that an incompatible old recording is reusable.

## Event coverage

- **Each principal, every case:** introduction; observed reaction; bell and sprinkler reactions; private conversation; unsupported accusation response; complaint, boast, question and encounter branches; aftermath comment; alibi/testimony; follow-up detail. The last category is spoken during reconstruction for the responsible character and during follow-up conversation for the other principals. The responsible character's earlier follow-up reuses the private-conversation line, so it does not expose the reconstruction admission early or add a recording requirement.
- **Case 1 Amos:** introduction/early encounter; receipt joke; advice about comparing copies; observation of the posted notice; neighbor-care response after the incident. He is present in the garden, accessible through both the world and location dialogue, before and after the incident. The five-line script contains no cause, suspect, admission, or future outcome.
- **Case 2 Amos:** introduction/early encounter; receipt joke; comparing copies; his notice on the community board; chair interaction. All five are reachable before night. His established fate is preserved; the game does not make him talk after death. His notice naturally directs attention to the existing preliminary information without altering evidence or proof rules.
- **Case 3 Rina:** introduction/early encounter; committee queue joke; notice-reading advice; asking for a pause; asking for space and water. These cover the pre-incident branches and the later care conversation. No recording names a responsible character, describes the incident, or reveals a future outcome.
- **Guide:** three optional tutorial lines in case 1, plus the shared night transition and the relevant discovery line in every case. Results and reconstruction captions remain written, as before; no invented or runtime-generated spoken sentence bypasses the finite script.

All evidence, proof groups, suspect eligibility, incident ordering, consequences and solutions remain unchanged. No principal's important scene was muted to make a role artificially small. Two existing supporting characters received complete compact parts.

## Spoiler policy

Internally, every line is marked `safe`, `investigation`, or `solution`. The quick parts contain only `safe` lines. Every full principal role in every case contains investigation information; some full scripts contain explicit admissions. Therefore **all six full roles receive the same Hebrew spoiler warning** and explicit acknowledgment before any full script is displayed. Warning style, availability and labels do not vary with culpability. The player can choose the quick part instead or have a friend record separately. Internal classification and event labels are never shown on casting cards or recording section labels.

The Hebrew recording script is generated in `PERSONAL_LINES.md`, grouped by case and role. That creator-facing document deliberately carries a spoiler warning. The player UI exposes only the selected current-case script after consent, in numbered sections.
