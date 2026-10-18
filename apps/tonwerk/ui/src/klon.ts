/**
 * Der Klon-Assistent, without the pixels: the draft, the chain it walks, and the document it makes.
 *
 * Everything here is a pure function of a draft object, for the reason `scene-draft.ts` exists in
 * the same shape — a wizard whose rules live inside a component can only be tested by rendering it,
 * and the rules are the part that matters.
 *
 * **One thing is deliberately not here: whether a consent is valid.** The engine owns that
 * (`generative/voices.py`), it publishes the rule vocabulary through `GET /api/voices`, and this
 * module prints the rules and never evaluates them. A second implementation of "does this document
 * permit publication" would be a second answer to that question, and the first time the two
 * disagreed the form would show a green tick over a rejected document. What the app does with a
 * rule is *filter* it — a requirement that cannot apply to this scope is not a requirement.
 */
import type { ConsentRule } from './contracts';

/** The chain, in order. It is a sequence, not a selector: you cannot audition before you consent. */
export const STUFEN = ['aufnahme', 'text', 'einwilligung', 'hoerprobe'] as const;
export type Stufe = (typeof STUFEN)[number];

export const STUFE_NAME: Record<Stufe, string> = {
  aufnahme: 'Aufnahme',
  text: 'Text',
  einwilligung: 'Einwilligung',
  hoerprobe: 'Hörprobe',
};

/** The recording, as the browser can describe it before anything is uploaded. */
export interface Referenz {
  name: string;
  bytes: number;
  /** Computed in the browser, so the consent document can name the digest it is bound to. */
  sha256: string;
  sekunden: number | null;
}

export interface KlonEntwurf {
  voiceId: string;
  referenz: Referenz | null;
  /** Who writes the reference transcript: the editor, or the engine's local ASR. */
  textQuelle: 'eingeben' | 'engine';
  refText: string;
  xVectorOnly: boolean;
  scope: 'evaluation' | 'publication';
  subjectName: string;
  minderjaehrig: boolean;
  guardianName: string;
  guardianAttest: string;
  assentAttest: string;
  zweck: string;
  erlaubt: string;
  verboten: string;
  aufbewahrung: string;
  automatischLoeschen: boolean;
  aufgenommenAm: string;
  engine: string;
}

export function leererEntwurf(heute: string, engine = 'qwen_tts_base'): KlonEntwurf {
  return {
    voiceId: '',
    referenz: null,
    textQuelle: 'eingeben',
    refText: '',
    xVectorOnly: false,
    scope: 'publication',
    subjectName: '',
    minderjaehrig: false,
    guardianName: '',
    guardianAttest: '',
    assentAttest: '',
    zweck: '',
    erlaubt: '',
    verboten: '',
    aufbewahrung: '',
    automatischLoeschen: false,
    aufgenommenAm: heute,
    engine,
  };
}

/**
 * Where the assistant stands.
 *
 * The furthest step whose own input is still missing — never a step the editor "is on" because
 * they clicked it. The chain is the discipline; there is nothing to click.
 */
export function stufe(entwurf: KlonEntwurf, angelegt: boolean): Stufe {
  if (angelegt) return 'hoerprobe';
  if (!entwurf.referenz) return 'aufnahme';
  if (!textEntschieden(entwurf)) return 'text';
  return 'einwilligung';
}

/**
 * Whether the transcript question has been answered — which is not the same as *answered with
 * text*. Handing the job to the engine is an answer, and so is x-vector-only mode, which conditions
 * on the speaker embedding alone and reads no transcript at all.
 */
export function textEntschieden(entwurf: KlonEntwurf): boolean {
  if (entwurf.xVectorOnly) return true;
  return entwurf.textQuelle === 'engine' || entwurf.refText.trim().length > 0;
}

/** `^[a-z0-9]+(?:-[a-z0-9]+)*$` — the engine's id shape, refused there and previewed here. */
export function istKennung(wert: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(wert);
}

/**
 * Whether there is a request to send at all.
 *
 * Deliberately only the three things without which no request exists: the bytes, the id they are
 * filed under, and the person they belong to. Everything else about the document is a **rule**, and
 * a rule is the engine's to apply — a button that pre-judged the purpose text would be the second
 * implementation this module exists to avoid.
 */
export function absendbar(entwurf: KlonEntwurf): boolean {
  return (
    entwurf.referenz !== null &&
    istKennung(entwurf.voiceId) &&
    entwurf.subjectName.trim().length > 0
  );
}

/** One free-text field, as a list: one entry per line, blanks dropped. */
export function zeilen(wert: string): string[] {
  return wert
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);
}

/**
 * The consent document, exactly as it will be sent.
 *
 * Built here and **shown to the editor before it goes**, which is the same argument the Freigabe
 * page makes about listening before signing: this document is the record of what a person agreed
 * to, and a form that assembled it out of sight would be asking someone to vouch for text they
 * never read.
 */
export function konsentDokument(entwurf: KlonEntwurf): Record<string, unknown> {
  const dokument: Record<string, unknown> = {
    version: 1,
    recorded_at: entwurf.aufgenommenAm,
    scope: entwurf.scope,
    subject: {
      display_name: entwurf.subjectName.trim(),
      is_minor: entwurf.minderjaehrig,
    },
    authorized_purpose: entwurf.zweck.trim(),
    permitted_uses: zeilen(entwurf.erlaubt),
    prohibited_uses: zeilen(entwurf.verboten),
    retention: {
      policy: entwurf.aufbewahrung.trim(),
      automatic_deletion: entwurf.automatischLoeschen,
    },
    reference: { sha256: entwurf.referenz?.sha256 ?? '' },
  };
  if (entwurf.minderjaehrig) {
    dokument.guardian_consent = {
      confirmed: true,
      attestation: entwurf.guardianAttest.trim(),
      guardian: entwurf.guardianName.trim(),
    };
    dokument.child_assent = {
      confirmed: true,
      attestation: entwurf.assentAttest.trim(),
      attested_by_guardian: true,
    };
  }
  if (entwurf.referenz?.sekunden != null) {
    (dokument.reference as Record<string, unknown>).duration_seconds = entwurf.referenz.sekunden;
  }
  return dokument;
}

export function konsentText(entwurf: KlonEntwurf): string {
  return JSON.stringify(konsentDokument(entwurf), null, 2);
}

/** The rules this draft will actually be held to, from the engine's own `applies`/`minors_only`. */
export function regelnFuer(regeln: readonly ConsentRule[], entwurf: KlonEntwurf): ConsentRule[] {
  return regeln.filter(
    (regel) =>
      (regel.applies === 'always' || regel.applies === entwurf.scope) &&
      (entwurf.minderjaehrig || !regel.minors_only),
  );
}

/**
 * The German for each rule the engine publishes.
 *
 * A map and not a translation layer: the engine's ids are its vocabulary, and this is the reader's.
 * A rule id with no entry here falls back to the engine's own English sentence, which is what makes
 * a rule added on the Python side **appear** in this form instead of vanishing from it.
 */
export const REGEL_TEXT: Record<string, string> = {
  'subject-named': 'Die Einwilligung nennt die Person, deren Stimme aufgenommen wurde.',
  'purpose-stated': 'Der Zweck steht ausgeschrieben da — mindestens ein ganzer Satz.',
  'retention-stated':
    'Die Einwilligung sagt, wie lange die Aufnahme bleibt und wann sie gelöscht wird.',
  'reference-sha-binding': 'Die Einwilligung nennt die SHA-256 genau dieser Aufnahme.',
  'minor-guardian':
    'Bei Minderjährigen willigt die erziehungsberechtigte Person ein und bestätigt das schriftlich.',
  'minor-assent':
    'Bei Minderjährigen ist die Zustimmung des Kindes bestätigt und von der erziehungsberechtigten Person bezeugt.',
  'evaluation-bars-publication':
    'Umfang Evaluation: die Einwilligung schließt Upload, Veröffentlichung und Git ausdrücklich aus.',
  'publication-permits-course':
    'Umfang Veröffentlichung: eine erlaubte Nutzung erlaubt ausdrücklich die Veröffentlichung in diesem Kurs.',
  'publication-bars-redistribution':
    'Umfang Veröffentlichung: die Weitergabe außerhalb des Kurses bleibt verboten.',
};

export function regelText(regel: ConsentRule): string {
  return REGEL_TEXT[regel.id] ?? regel.requirement ?? regel.id;
}

/**
 * The rule id inside an engine refusal, or null.
 *
 * The engine answers `publication-permits-course: a publication consent must …`, so the id is the
 * text before the first colon — and it is matched against the rules the form printed rather than
 * trusted, because a message that merely *contains* a colon is not a rule id. When it does not
 * match, the sentence is still shown; it is simply not attached to a row.
 */
export function verletzteRegel(meldung: string, regeln: readonly ConsentRule[]): string | null {
  const kopf = meldung.split(':', 1)[0]?.trim() ?? '';
  return regeln.some((regel) => regel.id === kopf) ? kopf : null;
}

/** SHA-256 of a file, hex, computed in the browser so the consent can name it before it is sent. */
export async function dateiSha256(datei: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await datei.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
