/**
 * Exercise sets renamed to the one naming convention: `<topic>`, `<topic>-produktion`,
 * `<topic>-<point>[-transfer]`, `<topic>-hoeren`, `<topic>-diktat`, `drill-<focus>`
 * (ADR 0014). A set id is half of every attempt's identity, so this map is permanent: an
 * attempt logged under an old id, by an older client or in an older snapshot, must keep
 * counting for the set it was answered in.
 *
 * It is applied wherever attempts enter, are compared or are read:
 * - `parseProgressSnapshot` on import and sync merge;
 * - `attemptKey`, so an old-id and a new-id copy of one attempt dedupe as one;
 * - `getAttempts`, so every reader sees the current id, whatever the stored blob holds;
 * - `progress:audit`, which reads snapshot files directly.
 *
 * Never remove an entry, and never give a new set an id that appears on the left:
 * its attempts would be filed under the set this map points to. `tests/set-id-migration.test.ts`
 * holds both rules against the corpus.
 */
export const SET_ID_MIGRATION: Readonly<Record<string, string>> = {
  'a1/akkusativ-anwenden': 'a1/akkusativ-produktion',
  'a1/alltag-zeit-trennbar': 'a1/alltag-zeit-produktion',
  'a1/artikel-demonstrativ': 'a1/artikel-genus-demonstrativ',
  'a1/artikel-demonstrativ-anwenden': 'a1/artikel-genus-demonstrativ-transfer',
  'a1/artikel-plural-kein': 'a1/artikel-genus-produktion',
  'a1/erste-schritte-sprechen': 'a1/erste-schritte-produktion',
  'a1/essen-einkaufen-service': 'a1/essen-trinken-produktion',
  'a1/freizeit-perfekt-a1': 'a1/freizeit-koennen-produktion',
  'a1/hoeren-alltag-zeit': 'a1/alltag-zeit-diktat',
  'a1/hoeren-essen-trinken': 'a1/essen-trinken-diktat',
  'a1/hoeren-freizeit': 'a1/freizeit-koennen-diktat',
  'a1/hoeren-stadt-wege': 'a1/stadt-wege-diktat',
  'a1/ls-akkusativ-01-hoeren': 'a1/akkusativ-hoeren',
  'a1/ls-alltag-zeit-01-hoeren': 'a1/alltag-zeit-hoeren',
  'a1/ls-artikel-genus-01-hoeren': 'a1/artikel-genus-hoeren',
  'a1/ls-erste-schritte-01-hoeren': 'a1/erste-schritte-hoeren',
  'a1/ls-essen-einkaufen-01-hoeren': 'a1/essen-trinken-hoeren',
  'a1/ls-freizeit-koennen-01-hoeren': 'a1/freizeit-koennen-hoeren',
  'a1/ls-menschen-familie-01-hoeren': 'a1/menschen-familie-hoeren',
  'a1/ls-praesens-wortstellung-01-hoeren': 'a1/praesens-wortstellung-hoeren',
  'a1/ls-stadt-wege-01-hoeren': 'a1/stadt-wege-hoeren',
  'a1/ls-wohnen-01-hoeren': 'a1/wohnen-hoeren',
  'a1/ort-richtung-praepositionen-anwenden': 'a1/ort-richtung-praepositionen-produktion',
  'a1/praesens-fragen-verneinung': 'a1/praesens-wortstellung-produktion',
  'a1/praesens-koordination': 'a1/praesens-wortstellung-koordination',
  'a1/praesens-koordination-anwenden': 'a1/praesens-wortstellung-koordination-transfer',
  'a1/praesens-koordination-ausblenden': 'a1/praesens-wortstellung-koordination-ausblenden',
  'a1/praesens-koordination-remediation': 'a1/praesens-wortstellung-koordination-remediation',
  'a1/stadt-wege-a1-grammatik': 'a1/stadt-wege-produktion',
  'a1/wortbildung-anwenden': 'a1/wortbildung-produktion',
  'a1/wortbildung-nomen': 'a1/wortbildung',
  'a2/adjektive-derselbe': 'a2/adjektive-deklination-derselbe',
  'a2/adjektive-derselbe-transfer': 'a2/adjektive-deklination-derselbe-transfer',
  'a2/alltag-produktion': 'a2/alltag-tagesablauf-produktion',
  'a2/alltag-ueber-dauer': 'a2/alltag-tagesablauf-ueber-dauer',
  'a2/einkaufen-interrogativartikel': 'a2/einkaufen-reklamation-interrogativartikel',
  'a2/einkaufen-interrogativartikel-anwenden':
    'a2/einkaufen-reklamation-interrogativartikel-transfer',
  'a2/einkaufen-kleine-mengen': 'a2/einkaufen-reklamation-kleine-mengen',
  'a2/einkaufen-kleine-mengen-transfer': 'a2/einkaufen-reklamation-kleine-mengen-transfer',
  'a2/freunde-feste-reziprok-anwenden': 'a2/freunde-feste-reziprok-transfer',
  'a2/hoeren-alltag': 'a2/alltag-tagesablauf-diktat',
  'a2/hoeren-dativ': 'a2/dativ-diktat',
  'a2/infinitiv-nicht-brauchen': 'a2/infinitiv-mit-zu-nicht-brauchen',
  'a2/infinitiv-nicht-brauchen-transfer': 'a2/infinitiv-mit-zu-nicht-brauchen-transfer',
  'a2/lernen-meinung-nach': 'a2/lernen-verstehen-meinung-nach',
  'a2/lernen-meinung-nach-transfer': 'a2/lernen-verstehen-meinung-nach-transfer',
  'a2/ls-adjektive-deklination-01-hoeren': 'a2/adjektive-deklination-hoeren',
  'a2/ls-aemter-dienstleistungen-01-hoeren': 'a2/aemter-dienstleistungen-hoeren',
  'a2/ls-alltag-tagesablauf-01-hoeren': 'a2/alltag-tagesablauf-hoeren',
  'a2/ls-arbeit-beruf-01-hoeren': 'a2/arbeit-beruf-hoeren',
  'a2/ls-biografie-erfahrungen-01-hoeren': 'a2/biografie-erfahrungen-hoeren',
  'a2/ls-dativ-01-hoeren': 'a2/dativ-hoeren',
  'a2/ls-einkaufen-reklamation-01-hoeren': 'a2/einkaufen-reklamation-hoeren',
  'a2/ls-freunde-feste-01-hoeren': 'a2/freunde-feste-hoeren',
  'a2/ls-gesundheit-arzttermin-01-hoeren': 'a2/gesundheit-arzttermin-hoeren',
  'a2/ls-infinitiv-mit-zu-01-hoeren': 'a2/infinitiv-mit-zu-hoeren',
  'a2/ls-lernen-verstehen-01-hoeren': 'a2/lernen-verstehen-hoeren',
  'a2/ls-man-und-besitz-01-hoeren': 'a2/man-und-besitz-hoeren',
  'a2/ls-modalverben-01-hoeren': 'a2/modalverben-hoeren',
  'a2/ls-nebensaetze-plaene-01-hoeren': 'a2/nebensaetze-plaene-hoeren',
  'a2/ls-perfekt-haben-sein-01-hoeren': 'a2/perfekt-haben-sein-hoeren',
  'a2/ls-reisen-verkehr-01-hoeren': 'a2/reisen-verkehr-hoeren',
  'a2/ls-relativsaetze-01-hoeren': 'a2/relativsaetze-hoeren',
  'a2/ls-termine-vereinbaren-01-hoeren': 'a2/termine-vereinbaren-hoeren',
  'a2/ls-trennbare-verben-01-hoeren': 'a2/trennbare-verben-hoeren',
  'a2/ls-verben-mit-praepositionen-01-hoeren': 'a2/verben-mit-praepositionen-hoeren',
  'a2/ls-verbindungen-folgen-01-hoeren': 'a2/verbindungen-folgen-hoeren',
  'a2/ls-wohnen-umzug-01-hoeren': 'a2/wohnen-umzug-hoeren',
  'a2/perfekt-produktion': 'a2/perfekt-haben-sein-produktion',
  'a2/termine-produktion': 'a2/termine-vereinbaren-produktion',
  'a2/verben-mit-kasus-anwenden': 'a2/verben-mit-kasus-produktion',
  'a2/verbindungen-darum-daher': 'a2/verbindungen-folgen-darum-daher',
  'a2/verbindungen-darum-daher-transfer': 'a2/verbindungen-folgen-darum-daher-transfer',
  'a2/wohnen-raumgrenzen': 'a2/wohnen-umzug-raumgrenzen',
  'a2/wohnen-raumgrenzen-transfer': 'a2/wohnen-umzug-raumgrenzen-transfer',
  'a2/wohnen-richtungsadverbien': 'a2/wohnen-umzug-richtungsadverbien',
  'a2/wohnen-richtungsadverbien-transfer': 'a2/wohnen-umzug-richtungsadverbien-transfer',
  'a2/zeit-praepositionen-anwenden': 'a2/zeit-praepositionen-produktion',
  'b1/ls-arbeit-bewerbung-01-hoeren': 'b1/arbeit-bewerbung-hoeren',
  'b1/ls-erfahrungen-erzaehlen-01-hoeren': 'b1/erfahrungen-erzaehlen-hoeren',
  'b1/ls-gesundheit-wohlbefinden-01-hoeren': 'b1/gesundheit-wohlbefinden-hoeren',
  'b1/ls-konsum-umwelt-01-hoeren': 'b1/konsum-umwelt-hoeren',
  'b1/ls-leben-veraendern-01-hoeren': 'b1/leben-veraendern-hoeren',
  'b1/ls-lernen-zukunft-01-hoeren': 'b1/lernen-zukunft-hoeren',
  'b1/ls-meinung-medien-01-hoeren': 'b1/meinung-medien-hoeren',
  'b1/ls-regeln-verantwortung-01-hoeren': 'b1/regeln-verantwortung-hoeren',
  'b1/ls-reisen-probleme-01-hoeren': 'b1/reisen-probleme-hoeren',
};

/** The current id of a set, for an id that may predate a rename. */
export function currentSetId(setId: string): string {
  return Object.hasOwn(SET_ID_MIGRATION, setId) ? SET_ID_MIGRATION[setId]! : setId;
}

/**
 * Attempts with every set id current. Returns the input array itself when nothing needed
 * renaming, so the common case allocates nothing and an unchanged blob is not rewritten.
 */
export function migrateAttemptSetIds<T extends { setId: string }>(attempts: T[]): T[] {
  if (!attempts.some((attempt) => Object.hasOwn(SET_ID_MIGRATION, attempt.setId))) return attempts;
  return attempts.map((attempt) =>
    Object.hasOwn(SET_ID_MIGRATION, attempt.setId)
      ? { ...attempt, setId: currentSetId(attempt.setId) }
      : attempt,
  );
}
