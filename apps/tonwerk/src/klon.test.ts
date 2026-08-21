import { describe, expect, test } from 'vitest';
import {
  absendbar,
  istKennung,
  konsentDokument,
  leererEntwurf,
  regelText,
  regelnFuer,
  stufe,
  textEntschieden,
  verletzteRegel,
  zeilen,
  type KlonEntwurf,
} from './klon';
import { voicesFixture } from './test/fixtures';

/**
 * The wizard's rules, tested where they live rather than through a rendered form.
 *
 * The one property worth stating up front, because two specs below are about it and nothing else
 * would catch it: **this module never decides whether a consent is valid.** It prints the engine's
 * rules and filters them by the engine's own `applies`/`minors_only`. A test that asserted "a
 * consent without a course permission is rejected here" would be asserting the existence of a
 * second implementation, which is exactly what must not exist.
 */

const REGELN = voicesFixture.rules;

function entwurf(overrides: Partial<KlonEntwurf> = {}): KlonEntwurf {
  return {
    ...leererEntwurf('2026-08-21'),
    voiceId: 'mara-h',
    subjectName: 'Mara H.',
    referenz: { name: 'mara.wav', bytes: 480_000, sha256: 'a'.repeat(64), sekunden: 15 },
    refText: 'Guten Tag, ich lese diesen Satz als Referenz.',
    zweck: 'Sprechrolle in den Hörtexten des Kurses.',
    erlaubt: 'Veröffentlichung im Deutsch-Atlas-Kurs',
    verboten: 'Weitergabe außerhalb des Kurses\nWerbung',
    aufbewahrung: 'Bleibt bis zum Widerruf und wird dann gelöscht.',
    ...overrides,
  };
}

describe('die Kette', () => {
  test('walks forward as the inputs arrive, and never backwards from a created voice', () => {
    expect(stufe(entwurf({ referenz: null }), false)).toBe('aufnahme');
    expect(stufe(entwurf({ refText: '' }), false)).toBe('text');
    expect(stufe(entwurf(), false)).toBe('einwilligung');
    expect(stufe(entwurf(), true)).toBe('hoerprobe');
    // A created voice is at the end even when the form beside it was cleared.
    expect(stufe(entwurf({ referenz: null }), true)).toBe('hoerprobe');
  });

  test('the transcript question is answered by a decision, not only by text', () => {
    expect(textEntschieden(entwurf({ refText: '' }))).toBe(false);
    // Handing the job to the engine is an answer …
    expect(textEntschieden(entwurf({ refText: '', textQuelle: 'engine' }))).toBe(true);
    // … and so is x-vector-only mode, which reads no transcript at all.
    expect(textEntschieden(entwurf({ refText: '', xVectorOnly: true }))).toBe(true);
  });
});

describe('what makes a request at all', () => {
  test('only the bytes, the id and the person — every other requirement is the engine’s', () => {
    expect(absendbar(entwurf())).toBe(true);
    expect(absendbar(entwurf({ referenz: null }))).toBe(false);
    expect(absendbar(entwurf({ subjectName: '  ' }))).toBe(false);
    expect(absendbar(entwurf({ voiceId: 'Mara H' }))).toBe(false);
    // A purpose too short for the engine's rule does **not** disable the button: that verdict
    // belongs to the engine, and pre-judging it here would be the second implementation.
    expect(absendbar(entwurf({ zweck: 'kurz' }))).toBe(true);
  });

  test('the id shape is the engine’s kebab pattern', () => {
    expect(istKennung('mara-h')).toBe(true);
    expect(istKennung('mara2')).toBe(true);
    expect(istKennung('Mara')).toBe(false);
    expect(istKennung('mara--h')).toBe(false);
    expect(istKennung('-mara')).toBe(false);
  });
});

describe('the consent document', () => {
  test('is exactly what the form typed, with the recording’s own digest bound into it', () => {
    expect(konsentDokument(entwurf())).toEqual({
      version: 1,
      recorded_at: '2026-08-21',
      scope: 'publication',
      subject: { display_name: 'Mara H.', is_minor: false },
      authorized_purpose: 'Sprechrolle in den Hörtexten des Kurses.',
      permitted_uses: ['Veröffentlichung im Deutsch-Atlas-Kurs'],
      prohibited_uses: ['Weitergabe außerhalb des Kurses', 'Werbung'],
      retention: {
        policy: 'Bleibt bis zum Widerruf und wird dann gelöscht.',
        automatic_deletion: false,
      },
      reference: { sha256: 'a'.repeat(64), duration_seconds: 15 },
    });
  });

  test('carries the two guardian records only for a minor', () => {
    const erwachsen = konsentDokument(entwurf());
    expect('guardian_consent' in erwachsen).toBe(false);
    expect('child_assent' in erwachsen).toBe(false);

    const kind = konsentDokument(
      entwurf({
        minderjaehrig: true,
        guardianName: 'A. H.',
        guardianAttest: 'Ich bin erziehungsberechtigt und willige ein.',
        assentAttest: 'Das Kind ist einverstanden.',
      }),
    );
    expect(kind.guardian_consent).toEqual({
      confirmed: true,
      attestation: 'Ich bin erziehungsberechtigt und willige ein.',
      guardian: 'A. H.',
    });
    expect(kind.child_assent).toEqual({
      confirmed: true,
      attestation: 'Das Kind ist einverstanden.',
      attested_by_guardian: true,
    });
  });

  test('a use list is one entry per line, and a blank line is not an entry', () => {
    expect(zeilen('  eins  \n\n zwei \n')).toEqual(['eins', 'zwei']);
    expect(zeilen('')).toEqual([]);
  });
});

describe('the rules the form prints', () => {
  test('a rule that cannot apply is not printed as a requirement', () => {
    const veroeffentlichung = regelnFuer(REGELN, entwurf()).map((regel) => regel.id);
    expect(veroeffentlichung).toContain('publication-permits-course');
    expect(veroeffentlichung).toContain('publication-bars-redistribution');
    expect(veroeffentlichung).not.toContain('evaluation-bars-publication');
    // An adult is not held to the two rules that exist because of a minor.
    expect(veroeffentlichung).not.toContain('minor-guardian');
    expect(veroeffentlichung).not.toContain('minor-assent');
  });

  test('the scope switch changes the list, not a hidden flag', () => {
    const bewertung = regelnFuer(REGELN, entwurf({ scope: 'evaluation' })).map((r) => r.id);
    expect(bewertung).toContain('evaluation-bars-publication');
    expect(bewertung).not.toContain('publication-permits-course');
  });

  test('the minor toggle adds the two rules it is about', () => {
    const kind = regelnFuer(REGELN, entwurf({ minderjaehrig: true })).map((regel) => regel.id);
    expect(kind).toContain('minor-guardian');
    expect(kind).toContain('minor-assent');
  });

  test('a rule this build has no German for still appears, in the engine’s own words', () => {
    expect(regelText({ id: 'purpose-stated', applies: 'always', minors_only: false, requirement: 'x' }))
      .toBe('Der Zweck steht ausgeschrieben da — mindestens ein ganzer Satz.');
    expect(
      regelText({
        id: 'eine-neue-regel',
        applies: 'always',
        minors_only: false,
        requirement: 'Something the engine started requiring.',
      }),
    ).toBe('Something the engine started requiring.');
  });
});

describe('reading a refusal', () => {
  test('the engine’s rule id is attached to the row that printed it', () => {
    const geltend = regelnFuer(REGELN, entwurf());
    expect(
      verletzteRegel('publication-permits-course: a publication consent must …', geltend),
    ).toBe('publication-permits-course');
  });

  test('a message that merely contains a colon is not a rule', () => {
    const geltend = regelnFuer(REGELN, entwurf());
    expect(verletzteRegel('Die Engine hat abgelehnt: 500', geltend)).toBeNull();
    // A real rule id that does not apply at this scope is not attached either — the row it would
    // mark is not on the page.
    expect(verletzteRegel('evaluation-bars-publication: …', geltend)).toBeNull();
  });
});
