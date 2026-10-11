/**
 * The focus-tag allowlist: every confusion the course can name, and the topic that
 * introduces it. A tag cannot silently teach a structure whose owning topic is later in the
 * spine; an intentional forward reference says `preview: true`.
 *
 * It lives in its own side-effect-free module, not inside `scripts/validate.ts`, because
 * `tests/focus-tags.test.ts` holds it against the table in `docs/authoring/focus-tags.md` — and
 * importing the validator to reach it would *run* the validator, so an unrelated content
 * error anywhere in the repo would fail the taxonomy test for reasons that have nothing to
 * do with the taxonomy. Same reason `coverage.ts` and `grammar-coverage.ts` sit here.
 *
 * The doc table and this record are the same list written twice, kept in step by a rule in
 * prose. That is fine at 62 tags maintained a few at a time, and is exactly the arrangement
 * that drifts when B1 adds roughly forty in one level. The test makes the pair mechanical.
 * Note the asymmetry it closes: a tag in the doc but not here is rejected loudly the first
 * time it is used, while a tag here but not in the doc is **invisible** — an author never
 * learns the confusion exists and reaches for a near-miss tag instead, and a false tag is
 * worse than no tag.
 */
export const focusIntroducedBy: Record<string, string> = {
  verbzweit: 'praesens-wortstellung',
  'verb-endungen': 'praesens-wortstellung',
  'kopula-sein': 'praesens-wortstellung',
  'nicht-position': 'praesens-wortstellung',
  'koordination-position-null': 'praesens-wortstellung',
  genus: 'artikel-genus',
  'plural-artikel': 'artikel-genus',
  'artikel-pflicht': 'artikel-genus',
  'kein-nicht': 'artikel-genus',
  demonstrativartikel: 'artikel-genus',
  'wortbildung-nomen': 'wortbildung',
  'wortbildung-adjektiv': 'wortbildung',
  possessivartikel: 'menschen-familie',
  'akkusativ-artikel': 'akkusativ',
  'akkusativ-pronomen': 'akkusativ',
  'akkusativ-praepositionen': 'akkusativ',
  'dativ-artikel': 'dativ',
  'dativ-pronomen': 'dativ',
  'dativ-praepositionen': 'dativ',
  'verben-mit-dativ': 'dativ',
  'passen-dativ': 'dativ',
  'wechsel-akk-dat': 'dativ',
  'trennbar-wortstellung': 'alltag-zeit',
  'trennbar-modal': 'alltag-zeit',
  'trennbar-untrennbar': 'trennbare-verben',
  'modal-satzklammer': 'freizeit-koennen',
  'modal-konjugation': 'freizeit-koennen',
  'gern-moegen': 'freizeit-koennen',
  'duerfen-muessen': 'stadt-wege',
  'will-moechte': 'modalverben',
  'haben-sein': 'freizeit-koennen',
  'partizip2-a1': 'freizeit-koennen',
  'partizip2-form': 'perfekt-haben-sein',
  'perfekt-satzklammer': 'freizeit-koennen',
  'um-am-zeit': 'alltag-zeit',
  'von-bis-in-zeit': 'alltag-zeit',
  'du-sie': 'stadt-wege',
  // --- A2 units ---
  'wo-wohin': 'wohnen-umzug',
  'stellen-stehen': 'wohnen-umzug',
  'richtungsadverb-her-hin': 'wohnen-umzug',
  'raumgrenze-pfad': 'wohnen-umzug',
  'komparativ-als': 'einkaufen-reklamation',
  'superlativ-am': 'einkaufen-reklamation',
  'wenig-ein-paar': 'einkaufen-reklamation',
  'adjektiv-praedikativ': 'adjektive-deklination',
  'adjektiv-bestimmt': 'adjektive-deklination',
  'adjektiv-unbestimmt': 'adjektive-deklination',
  'derselbe-identitaet': 'adjektive-deklination',
  'es-unpersoenlich': 'natur-wetter',
  'imperativ-form': 'stadt-wege',
  'seit-vor-zeit': 'gesundheit-arzttermin',
  'reflexiv-akkusativ': 'gesundheit-arzttermin',
  reziprokpronomen: 'freunde-feste',
  'verb-praeposition': 'verben-mit-praepositionen',
  'verb-kasus': 'verben-mit-kasus',
  'zeitangaben-system': 'zeit-praepositionen',
  'zeitgrenzen-mit-zwischen': 'zeit-praepositionen',
  'ueber-dauer': 'alltag-tagesablauf',
  'da-wo-woerter': 'verben-mit-praepositionen',
  'nebensatz-verbende': 'nebensaetze-plaene',
  'weil-denn': 'nebensaetze-plaene',
  'nebensatz-vorfeld': 'nebensaetze-plaene',
  'zu-infinitiv': 'infinitiv-mit-zu',
  'nicht-brauchen-zu': 'infinitiv-mit-zu',
  'um-zu-zweck': 'infinitiv-mit-zu',
  'relativpronomen-kasus': 'relativsaetze',
  'konjunktionaladverb-inversion': 'verbindungen-folgen',
  'darum-daher': 'verbindungen-folgen',
  'als-wenn-vergangenheit': 'verbindungen-folgen',
  'futur-werden': 'infinitiv-mit-zu',
  'reflexiv-dativ': 'gesundheit-arzttermin',
  'indefinitpronomen': 'man-und-besitz',
  'genitiv-eigenname': 'man-und-besitz',
  'passiv-rezeptiv': 'man-und-besitz',
  interrogativartikel: 'einkaufen-reklamation',
  'aber-sondern': 'freunde-feste',
  'praeteritum-sein-haben': 'biografie-erfahrungen',
  'indirekte-frage': 'lernen-verstehen',
  'meinung-nachgestellt': 'lernen-verstehen',
  'hoeflich-konjunktiv': 'aemter-dienstleistungen',
  'wohin-wo-woher': 'ort-richtung-praepositionen',
  // was escaping the spine check entirely while the table was a lookup, not an allowlist
  'haben-wendungen': 'essen-trinken',
  // --- B1 (contract: docs/curriculum/a2-b1.md) ---
  'praeteritum-vollverben': 'erfahrungen-erzaehlen',
  'plusquamperfekt-nachdem': 'erfahrungen-erzaehlen',
  'temporal-nebensatz': 'erfahrungen-erzaehlen',
  'relativpronomen-dativ': 'leben-veraendern',
  'relativ-praeposition': 'leben-veraendern',
  'komparativ-attributiv': 'leben-veraendern',
  'genitiv-form': 'leben-veraendern',
  'reflexiv-praeposition': 'gesundheit-wohlbefinden',
  'konjunktiv2-ratschlag': 'gesundheit-wohlbefinden',
  'lassen-verwendung': 'gesundheit-wohlbefinden',
  'adjektiv-nullartikel': 'gesundheit-wohlbefinden',
  'n-deklination': 'arbeit-bewerbung',
  'adjektiv-nomen': 'arbeit-bewerbung',
  'nomen-verb-verbindung': 'arbeit-bewerbung',
  'verb-praeposition-b1': 'meinung-medien',
  'da-weil': 'meinung-medien',
  'zweiteilige-konnektoren': 'meinung-medien',
  'passiv-bildung': 'konsum-umwelt',
  'passiv-vergangenheit': 'konsum-umwelt',
  'je-desto': 'konsum-umwelt',
  'passiv-modal': 'regeln-verantwortung',
  'sodass-folge': 'regeln-verantwortung',
  'konjunktiv2-form': 'reisen-probleme',
  'irreale-bedingung': 'reisen-probleme',
  'praeposition-genitiv': 'reisen-probleme',
  'damit-um-zu': 'lernen-zukunft',
  'falls-wenn': 'lernen-zukunft',
  'ohne-statt-zu': 'lernen-zukunft',
  'obwohl-trotzdem': 'gesellschaft-zusammenleben',
  'indefinitpronomen-erweitert': 'gesellschaft-zusammenleben',
  'relativ-was-wo': 'gesellschaft-zusammenleben',
  'indirekte-rede': 'informationen-vermitteln',
  'angaben-reihenfolge': 'informationen-vermitteln',
  'pronomen-stellung': 'informationen-vermitteln',
  'partizip-adjektiv': 'informationen-vermitteln',
};

/**
 * A confusion whose signature error ADDS a word, and where in the sentence it lands.
 *
 * `key_tokens` attribute a miss when a graded token is absent or displaced — never when a token is
 * added, because an inserted word changes the token count and the scorer then sees neither a
 * missing nor a misplaced pin. On an ordinary item that is an honest gap. On a delayed probe it is
 * a false pass: `classifyProbe` (`scripts/progress-audit.ts`) reads an unattributed miss as the
 * competence surviving, so `ich lasse meine Wohnung zu putzen` scored as retention of the very
 * rule it breaks.
 *
 * Only an authored `focus_evidence.failed` predicate can see the insertion, so `bun run validate`
 * (`focusEvidenceProblems`, packages/content/src/focus-evidence.ts) builds the error from every
 * accepted rendering of a `translate` probe item carrying one of these tags — `word` put in front
 * of the last pinned token that matches `before` — and requires a `failed` predicate that catches
 * it. A rendering with no such pin has no insertion site and needs nothing: the seit/vor and
 * am/um variants of the `zeitangaben-system` family carry no bare-accusative time phrase.
 *
 * `word` is one representative; the item's predicate should catch the siblings too (any
 * preposition before *jeden Tag*, any article before *Mareks*). The table in
 * `docs/authoring/focus-tags.md` ("Errors that add a word") is the same list, held equal by
 * `tests/focus-tags.test.ts`.
 */
export interface InsertionError {
  /** the word the learner adds */
  word: string;
  /** the pinned token it lands in front of: the last `key_tokens` entry of the rendering that matches */
  before: RegExp;
}

/** Any pinned token — the last one of a bracket rule is its clause-final infinitive. */
const CLOSING_PIN = /./u;

export const insertionErrors: Record<string, InsertionError> = {
  // ❌ Ich kann zu schwimmen — the modal's infinitive is bare (focus-tags.md: "bare infinitive").
  'modal-satzklammer': { word: 'zu', before: CLOSING_PIN },
  // ❌ Ich lasse mein Fahrrad zu reparieren — "no zu".
  'lassen-verwendung': { word: 'zu', before: CLOSING_PIN },
  // ❌ Ich werde morgen zu kommen — "werden + bare infinitive".
  'futur-werden': { word: 'zu', before: CLOSING_PIN },
  // ❌ am jeden Tag — the bare-accusative family takes no preposition at all.
  'zeitangaben-system': {
    word: 'am',
    before: /^(jeden|jede|jedes|nächste|nächsten|nächstes|letzte|letzten|letztes)$/iu,
  },
  // ❌ die Mareks Wohnung — the -s name takes the article's place (logged 2026-07-26).
  'genitiv-eigenname': { word: 'das', before: /^\p{Lu}\p{Ll}*s$/u },
};
