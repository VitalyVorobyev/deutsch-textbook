# Topic-quality pass

The bounded, topic-by-topic content pass of P27-3g, run under the
[content-quality contract](../authoring/content-quality-audit.md). One pass reads the whole topic
profile together: manifest and outcomes, article, pretest, every teaching set, probe families,
readings, audio and documents, and the owned vocabulary.

`Pass complete` means those surfaces were read together and every material defect found was
corrected. It is **not** human editorial approval and not a claim about learning; the manifest's
`status` and the provenance records stay the approval source of truth, so a pass never sets
`reviewed`.

| Level | Topics | Pass |
| --- | ---: | --- |
| A1 | 12 | complete |
| A2 | 25 | complete, except `natur-wetter` — added after the pass, owed |
| B1 | 20 | in progress — rows below |

An empty derived findings queue is never the stop condition: the A1 and the A2 waves each found
material defects that no instrument could see.

**Dense profiles.** Five or more sets on one topic is a review trigger, not a defect. Each set must
name its own learning activity, stage and decision or medium; a set that cannot is merged or
removed, even when the topic's item count then falls.

## B1

Unit order from `content/atlas.yaml`. Beyond the common contract, a B1.4+ topic also has its
provenance record in `data/authorship-provenance.yaml` checked, and the human creative and
editorial sign-off is kept distinct from agent assistance. Units still owed the RU/UK calque review
(backlog C6-1) receive it in the same pass.

| Topic | Result | Status |
| --- | --- | --- |
| `erfahrungen-erzaehlen` | corrected — 11 items (3 primary practice, 1 production, 5 drill, 2 probe) rejected correct German or blamed a correct rendering on the tag: accepts widened, instructions ask for the Präteritum where a Perfekt rendering is also correct German, two clozes now name their verbs; a listening explain contradicted its transcript; *Ereignis* IPA [ɡ]→[k]; the article gained L1 contrast in three halves and the conjunction/adverb pairs (adverbial *seitdem*, verb second, was modelled but never taught), and no longer marks a correct past-narrative *seitdem* sentence ❌. One finding rejected: the *schon … als* Plusquamperfekt cloze matches the article. | `draft` |
