# A1 linguistic QA ledger

Status: **12/22 manifest points linguistically signed off (batch 1: cases, word order,
negation); 10 points pending (batch 2)**. Structural coverage, corpus correctness and
learner mastery remain three separate claims.

This ledger is the linguistic sign-off that structural coverage cannot provide. `22/22`
on the grammar-coverage report means every A1 point has teaching evidence; it does not
mean that explanations are exception-safe, examples are natural, or answer keys accept
all correct German. A row becomes `verified`, `corrected`, or `intentionally simplified`
only after its owning articles, practice/drill prompts, accepted answers, `explain`
feedback and linked readings have been checked in EN/RU/UK.

| Manifest point | QA result | Ruling |
| --- | --- | --- |
| `praesens-regelmaessig` | verified | Endings table, drills and feedback are consistent; the er/ihr shared `-t` and the wir `-en` claims are correct. |
| `praesens-unregelmaessig` | verified | Stem change is consistently scoped to du and er/sie/es (sprechen, lesen, fahren, essen, helfen); no form errors found. |
| `sein-haben` | verified | Both paradigms are correct everywhere they appear; haben-Wendungen (Hunger/Durst) are taught as chunks, never as copula alternatives. |
| `verbzweit` | verified | V2 is scoped to statements (subordinate clauses are an A2 matter), position 1 is described non-exclusively, and inversion models match the rule; one probe variant gained a dann-clause constraint so a valid *und lese dann* rendering is no longer graded against the target. |
| `genus-artikel` | corrected | The false surface rule "every noun ending in -chen is neuter" (cf. *der Kuchen*, taught in this course's own readings) is scoped to the diminutive suffix; the article-obligation claim is scoped to countable nouns, since *Ich trinke Kaffee* and *Er ist Lehrer* are course models; `-ung` claims now name the suffix. |
| `plural` | verified | The five plural patterns and the invariant plural *die* are correct; the pattern list now acknowledges zero-plural nouns (das Zimmer → die Zimmer) instead of implying every noun takes an ending. |
| `akkusativ-artikel` | corrected | den/einen/keinen forms and the *es gibt* + Akkusativ frame are correct throughout; mass-noun order prompts (a coffee, an orange juice, a wine) gained an explicit ein- constraint so bare-noun renderings — correct German — are no longer logged as case failures. |
| `akkusativ-pronomen` | corrected | The EN claim "only *ihn* is a truly new form" contradicted the full mich/dich/uns/euch table above it; all three halves now make the third-person-masculine point the RU/UK halves intended. |
| `akkusativ-praepositionen` | verified | für/ohne/um are correctly presented as fixed accusative governors, incl. spatial *um die Ecke*; feminine non-change is drilled against over-application. |
| `negation-nicht` | verified | Position rules (after the finite verb and time phrase, before a predicative adjective) are correct and consistent across practice, cloze and translate keys. |
| `negation-kein` | corrected | The false universal "nouns are negated with kein, nicht cannot negate a noun" (cf. *Das ist nicht das Buch*) is scoped everywhere to nouns with *ein* or no article — article, practice explains, checkpoint. |
| `possessivartikel` | corrected | Paradigm (incl. euer → eure, Ihr vs ihr) is correct; an EN half that framed the copula rule through Russian now stands on English; reading feedback no longer infers "different cities" from *wohnen nicht zusammen*; equally correct renderings (*Er ist dreißig Jahre alt*, *Sie lebt in Hamburg*) are accepted. |
| `fragen` | pending (batch 2) | — |
| `imperativ` | pending (batch 2) | — |
| `modalverben` | pending (batch 2) | — |
| `duerfen-muessen` | pending (batch 2) | — |
| `trennbare-verben` | pending (batch 2) | — |
| `zeitangaben` | pending (batch 2) | — |
| `gern` | pending (batch 2) | — |
| `anrede-du-sie` | pending (batch 2) | — |
| `zahlen-uhrzeit` | pending (batch 2) | — |
| `perfekt` | pending (batch 2) | — |

## Corpus inventory

The sign-off surface is larger than the 22-row manifest: 10 A1 topics, 44 exercise sets
with 295 items, and 15 A1 readings. The exercise roles are 20 practice sets, 10 probe
families, 10 pretests, 3 drills and 1 checkpoint. Verification proceeds in bounded
topic/point batches and records the files checked, so a green validator cannot
substitute for a linguistic read.

## Corpus pass log

### 2026-07-19 — case, verb-position and negation cluster (batch 1, complete)

Checked the owning articles, pretests, practice/drill/production sets, probe families
and readings for `praesens-wortstellung` (praesens-regelmaessig, praesens-unregelmaessig,
sein-haben, verbzweit, negation-nicht), `artikel-genus` (genus-artikel, plural,
negation-kein), `akkusativ` (all three accusative points) and `menschen-familie`
(possessivartikel), plus every cross-topic item carrying these focus tags in the
wohnen, essen-trinken, stadt-wege, alltag-zeit, essen-einkaufen-service and Hören sets
and the A1 checkpoint.

Corrections:

- scoped the neuter rule to the diminutive suffix **-chen** — the bare "ends in -chen"
  version is falsified by *der Kuchen*, which this course's own A1 readings use — in the
  article, the practice explain, and a dictation explain;
- scoped "a singular noun never stands without an article" to countable nouns: the
  course itself teaches *Ich trinke Kaffee*, *Ich spreche Deutsch* and *Er ist Lehrer*,
  all article-free singulars;
- scoped "a noun is negated with *kein*, never with *nicht*" to nouns with *ein* or no
  article, and added the definite-article counterexample (*Das ist nicht das Buch*), in
  the article, two practice explains and the checkpoint;
- aligned the EN accusative-pronoun claim with the paradigm it sits under: *ihn* is the
  third-person form to watch, not "the only new form" (mich/dich/uns/euch are new too);
- repaired the RU/UK animacy contrast in the accusative article's Häufige Fehler: as
  written it claimed only animate masculine nouns change in the Russian/Ukrainian
  accusative, which is false of feminine nouns (книга → книгу); the claim is now scoped
  to masculine nouns;
- reframed an EN explanation half that reasoned through Russian ("as Russian often
  does"), which the authoring contract forbids;
- fixed reading feedback that inferred "they live in different cities" from *Wir wohnen
  nicht zusammen*;
- constrained mass-noun order prompts (*einen Kaffee*, *einen Orangensaft*, *ein
  Wasser*, *einen Wein*) with an explicit ein- instruction: RU/UK «пьёт кофе»-style
  prompts admit bare-noun German that is correct but bypasses the graded article, and a
  pinned `key_tokens` miss would have logged it as a false `akkusativ-artikel` weakness;
- disambiguated an EN probe prompt ("the (male) teacher") whose *die Lehrerin* rendering
  would have been logged as a case failure, and constrained a V2 probe to the
  dann-fronted clause it grades;
- accepted equally correct, target-preserving renderings that the keys rejected:
  *schwierig* beside *schwer*, *der Name* beside *der Vorname*, *Er ist dreißig Jahre
  alt*, *Sie lebt/Er lebt* beside *wohnt*, and an *und*-less *dann* clause;
- acknowledged zero-plural nouns (das Zimmer → die Zimmer) beside the five plural
  patterns.

Every scoring-contract change (prompt, instruction constraint or accept list) bumped the
item's `revision`; explanation-only fixes did not. Item ids and headwords are untouched.

Deliberately left as-is (`intentionally simplified`, noted inside their rows): the
plain-negation rule "never *nicht ein*" stays without the contrastive *nicht ein …,
sondern …* exception (an A2/B1 nuance); `-ung`-suffix gender guidance ignores
non-suffix words like *der Sprung* (not A1 vocabulary); V2 is stated for statements
without naming subordinate clauses, which A1 does not teach.

Future findings append a dated note and update the row; the ledger is not replaced by
the grammar coverage percentage.
