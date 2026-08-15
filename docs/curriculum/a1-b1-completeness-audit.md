# A1–B1 completeness audit

This is the work ledger for the source-led completeness program. It records what a denominator row
means, where it belongs pedagogically and what evidence must exist before its claim is added. A row
leaves this table only in the same change that ships its article, practice, transfer and probe
evidence. The governing distinction is [ADR 0015](../adrs/0015-provable-course-completeness.md).

## DTZ structure tail

The first full run found 23 unclaimed DTZ entries. `mod-wie` is an exact existing match: the
`einkaufen-reklamation` article contrasts `so … wie`, `-er als` and `am …-sten`, and its core
practice makes the learner choose and explain the equality frame. It is now claimed by
`komparativ`. The remaining 22 are grouped by one learnable decision, not by source-table row.

| Slice | DTZ entries | Owner | Required teaching decision | State |
| --- | --- | --- | --- | --- |
| Directional adverbs | `vorsilbe-herauf`, `heraus`, `herein`, `herunter`, `hin`, `hinauf`, `hinaus`, `hinüber`, `hinunter` | `ort-richtung-praepositionen` | choose speaker-centred `her-` vs away-from-speaker `hin-`, then recognise colloquial `rauf/raus/rein/runter/rüber` | open |
| Diminutive nouns | `nachsilbe-chen` | new A1 `wortbildung` | derive meaning, guaranteed neuter gender and unchanged plural without treating every final `-chen` as productive | open |
| Identity determiner | `derselbe` | `adjektive-deklination` | distinguish `derselbe` from merely similar `gleich` and inflect its article half plus weak adjective half | open |
| Small quantities | `ein-paar`, `wenige` | `einkaufen-reklamation` | contrast countable `ein paar`, low-quantity `wenige` and singular `wenig`; agreement must remain visible | open |
| Time boundaries | `temp-mit`, `temp-zwischen` | `zeit-praepositionen` | read `mit 18` as a time threshold and `zwischen Montag und Mittwoch` as a bounded interval, including case | open |
| Spatial boundary and path | `lok-ausserhalb`, `lok-gegen`, `lok-um-herum` | `ort-richtung-praepositionen` | separate outside boundary, endpoint/contact and path around an object; produce the governed case | open |
| Norm/source with `nach` | `weit-nach` | `lernen-verstehen` | use postposed `meiner Meinung nach` and distinguish it from directional/temporal `nach + Dativ` | open |
| Consequence variants | `darum`, `daher` | `verbindungen-folgen` | retain consequence direction and V2 inversion while choosing neutral spoken `darum` or more written `daher` | open |
| Lifted obligation | `infinitiv-brauchen-zu` | `infinitiv-mit-zu` | distinguish `nicht brauchen zu` (no necessity) from `nicht dürfen` (prohibition) and preserve the infinitive frame | open |

## Seven internal slices already exposed by the inventory

These are not part of the 22-row DTZ tail. They already exist as inventory points and deliberately
lower internal coverage until learner-facing evidence pays for them.

| Point | Owner | Delivery |
| --- | --- | --- |
| `koordination` | `praesens-wortstellung` | position-zero `und/oder/aber/denn`, contrasted with V2 adverbs and verb-final conjunctions |
| `demonstrativartikel` | `artikel-genus` | A1 `dieser/diese/dieses` with definite-article endings |
| `wortbildung-nomen`, `wortbildung-adjektiv` | new A1 `wortbildung` | a full article, reading, core, application and delayed probes; also owns DTZ `-chen` |
| `reziprokpronomen` | `freunde-feste` | reciprocal `uns/sich`, explicitly contrasted with reflexive meaning |
| `interrogativartikel` | `einkaufen-reklamation` | case-bearing `welch-` and `alle` before a noun |
| `ueber-dauer` | `alltag-tagesablauf` and transfer in `zeit-praepositionen` | duration `über + Akkusativ`, never inferred from the spatial use |

## Exit evidence per productive point

- exact external claim or explicit `beyond` status;
- owning topic and named `###` section;
- at least one scaffolded production item;
- a fade or transfer item in a distinct context;
- three delayed probe variants with fresh facts and correct arming;
- diagnostics at zero for the point and its owning topic.

The ledger records delivery, not learning. Learner retention and transfer remain separate evidence.
