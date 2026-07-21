/**
 * The focus-tag allowlist: every confusion the course can name, and the topic that
 * introduces it. A tag cannot silently teach a structure whose owning topic is later in the
 * spine; an intentional forward reference says `preview: true`.
 *
 * It lives in its own side-effect-free module, not inside `scripts/validate.ts`, because
 * `tests/focus-tags.test.ts` holds it against the table in `docs/focus-tags.md` — and
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
  genus: 'artikel-genus',
  'plural-artikel': 'artikel-genus',
  'artikel-pflicht': 'artikel-genus',
  'kein-nicht': 'artikel-genus',
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
  'trennbar-wortstellung': 'trennbare-verben',
  'trennbar-modal': 'trennbare-verben',
  'trennbar-untrennbar': 'trennbare-verben',
  'modal-satzklammer': 'freizeit-koennen',
  'modal-konjugation': 'freizeit-koennen',
  'gern-moegen': 'freizeit-koennen',
  'duerfen-muessen': 'modalverben',
  'will-moechte': 'modalverben',
  'haben-sein': 'perfekt-haben-sein',
  'partizip2-form': 'perfekt-haben-sein',
  'perfekt-satzklammer': 'perfekt-haben-sein',
  'um-am-zeit': 'alltag-zeit',
  'du-sie': 'termine-vereinbaren',
  // --- A2 units ---
  'wo-wohin': 'wohnen-umzug',
  'stellen-stehen': 'wohnen-umzug',
  'komparativ-als': 'einkaufen-reklamation',
  'superlativ-am': 'einkaufen-reklamation',
  'adjektiv-praedikativ': 'adjektive-deklination',
  'adjektiv-bestimmt': 'adjektive-deklination',
  'adjektiv-unbestimmt': 'adjektive-deklination',
  'imperativ-form': 'gesundheit-arzttermin',
  'seit-vor-zeit': 'gesundheit-arzttermin',
  'reflexiv-akkusativ': 'gesundheit-arzttermin',
  'verb-praeposition': 'verben-mit-praepositionen',
  'da-wo-woerter': 'verben-mit-praepositionen',
  'nebensatz-verbende': 'nebensaetze-plaene',
  'weil-denn': 'nebensaetze-plaene',
  'nebensatz-vorfeld': 'nebensaetze-plaene',
  'zu-infinitiv': 'infinitiv-mit-zu',
  'um-zu-zweck': 'infinitiv-mit-zu',
  'relativpronomen-kasus': 'relativsaetze',
  'konjunktionaladverb-inversion': 'verbindungen-folgen',
  'als-wenn-vergangenheit': 'verbindungen-folgen',
  'futur-werden': 'infinitiv-mit-zu',
  'reflexiv-dativ': 'gesundheit-arzttermin',
  'indefinitpronomen': 'man-und-besitz',
  'genitiv-eigenname': 'man-und-besitz',
  'passiv-rezeptiv': 'man-und-besitz',
  'aber-sondern': 'freunde-feste',
  'praeteritum-sein-haben': 'biografie-erfahrungen',
  'indirekte-frage': 'lernen-verstehen',
  'hoeflich-konjunktiv': 'aemter-dienstleistungen',
  // was escaping the spine check entirely while the table was a lookup, not an allowlist
  'haben-wendungen': 'essen-trinken',
};
