/**
 * One-off generator: fills `ipa` (Lautschrift) on vocab entries using espeak-ng,
 * normalized to the house style documented in CLAUDE.md.
 *
 *   bun run gen:ipa                    fill entries that have no ipa yet
 *   bun run gen:ipa -- --calibrate     print raw vs normalized vs target, no writes
 *   bun run gen:ipa -- --check         dry run over the corpus, no writes
 *   bun run gen:ipa -- --force         regenerate everything (discards manual fixes!)
 *   bun run gen:ipa -- --only essen-trinken
 *
 * Needs the espeak-ng binary (`brew install espeak-ng` / `apt install espeak-ng`).
 * Nothing about it ships: the IPA is committed to YAML and read as plain content.
 *
 * ALWAYS REVIEW THE OUTPUT. espeak-ng's German is a decent phoneme skeleton but
 * it gets three things wrong that no rule here can fix, because they need
 * morphology it does not have:
 *   - compounds and separable verbs (it flattens `Wochenende`, and secondary
 *     stress is dropped below rather than trusted — re-add `ˌ` by hand);
 *   - loanword stress (`Büro` → it stresses the first syllable);
 *   - vowel quality in unstressed syllables of loanwords.
 * `bun run validate` enforces the notation; only a human/agent pass can enforce
 * the phonology.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

const VOCAB = join(import.meta.dirname, '..', 'content', 'vocab');

// --- character classes ------------------------------------------------------

const NSY = '̯'; // ̯  non-syllabic (diphthong offglide, vocalized r)
const SYL = '̩'; // ̩  syllabic consonant
const NAS = '̃'; // ̃  nasal (French loans)

const VOWEL = 'aɐɑeəɛioøœɔuʊyʏɪ';
const CONSONANT = 'bçdfghjklmnŋpʁsʃtvxzʒʔ';
/** Obstruents only — the schwa of -en/-el collapses to a syllabic consonant
    after these (ˈmaxn̩, ˈapfl̩) but not after a sonorant (telefoˈniːʁən). */
const OBSTRUENT = 'pbtdkgfvszʃʒçx';

const isVowel = (c: string | undefined) => !!c && VOWEL.includes(c);
const isConsonant = (c: string | undefined) => !!c && CONSONANT.includes(c);

/**
 * Consonant clusters that may open a German syllable, longest first. Used to
 * walk the primary-stress mark left from espeak's pre-vocalic position to the
 * syllable onset (`fˈaːtɐ` → `ˈfaːtɐ`, `kɔlˈeːgə` → `kɔˈleːgə`).
 *
 * `tʃ` is deliberately absent: it is a legal onset (Tschüss) but as a *word-internal*
 * one it is nearly always a false split — `ɛntʃˈʊldɪgʊŋ` must become
 * `ɛntˈʃʊldɪgʊŋ` (ent-schuldigen), never `ɛnˈtʃʊldɪgʊŋ`.
 */
const ONSETS = [
  'ʃtʁ',
  'ʃpʁ',
  'pfl',
  'pfʁ',
  'ʃt',
  'ʃp',
  'ʃl',
  'ʃm',
  'ʃn',
  'ʃʁ',
  'ʃv',
  'pʁ',
  'bʁ',
  'tʁ',
  'dʁ',
  'kʁ',
  'gʁ',
  'fʁ',
  'pl',
  'bl',
  'kl',
  'gl',
  'fl',
  'kn',
  'gn',
  'kv',
  'ts',
  'pf',
  'b',
  'ç',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  'm',
  'n',
  'ŋ',
  'p',
  'ʁ',
  's',
  'ʃ',
  't',
  'v',
  'x',
  'z',
  'ʒ',
];

// --- normalization ----------------------------------------------------------

/** espeak-ng German → house style. Calibrated against the espeak-ng 1.52 output
    in CALIBRATION below; re-run `--calibrate` after upgrading espeak-ng. */
export function normalize(raw: string): string {
  let s = raw.normalize('NFC').replace(/\s+/g, ' ').trim();

  // 1. notation junk: tie bars, phoneme/syllable separators
  s = s.replace(/[͡_\-‿.]/g, '');

  // 2. espeak's secondary stress is unreliable in both directions (it invents
  //    ˌʊŋ on -ung and misses real compound stress), so drop it wholesale. The
  //    review pass re-adds ˌ where the morphology actually calls for it.
  s = s.replace(/ˌ/g, '');

  // 3. look-alike glyphs → house style
  s = s.replace(/ɡ/g, 'g'); // ɡ → ASCII g
  s = s.replace(/ɜ/g, 'ɐ'); // espeak's final -er
  s = s.replace(/ɔ[øɪ]/g, 'ɔʏ'); // espeak's eu/äu diphthong

  // 4. ɑ is espeak's long a; keep it only for the nasal of French loans (Restaurant)
  s = s.replace(new RegExp(`ɑ(?!${NAS})ː?`, 'g'), (m) => (m.endsWith('ː') ? 'aː' : 'a'));

  // 5. /r/: vocalized to ɐ̯ after a long vowel in the syllable coda, else uvular ʁ.
  //    The lookahead skips stress marks — in `stoːrˈɑ̃` the r opens the next
  //    syllable, so it stays ʁ.
  s = s.replace(/[rɾʀ]/g, (_m, i: number, str: string) => {
    const next = str[i + 1] === 'ˈ' || str[i + 1] === 'ˌ' ? str[i + 2] : str[i + 1];
    return str[i - 1] === 'ː' && !isVowel(next) ? `ɐ${NSY}` : 'ʁ';
  });

  // 6. espeak lengthens pre-tonic vowels that German reduces (teːleːfoː… → telefo…)
  const tonic = s.indexOf('ˈ');
  if (tonic > 0) s = s.slice(0, tonic).replace(/ː/g, '') + s.slice(tonic);

  // 7. stress mark → syllable onset, and a glottal stop before a word-internal
  //    stressed vowel (bəˈantvɔʁtən → bəˈʔantvɔʁtən)
  s = moveStressToOnset(s);

  // 8. diphthong offglides
  s = s
    .replace(new RegExp(`a[ɪʊ](?!${NSY})`, 'g'), (m) => m + NSY)
    .replace(new RegExp(`ɔʏ(?!${NSY})`, 'g'), (m) => m + NSY);

  // 9. syllabic consonants: ə + n/l collapses only after an obstruent — ˈmaxn̩,
  //    ˈapfl̩, but never after a sonorant (telefoˈniːʁən, not …ʁn̩)
  s = s.replace(
    new RegExp(`([${OBSTRUENT}])ə([nl])(?=$| |[${CONSONANT}])`, 'g'),
    (_m, c: string, n: string) => `${c}${n}${SYL}`,
  );

  return s.normalize('NFC');
}

/** Walk each ˈ left over the longest legal onset cluster, then insert ʔ if the
    stressed syllable starts with a vowel word-internally. */
function moveStressToOnset(s: string): string {
  const marks: number[] = [];
  for (let i = 0; i < s.length; i++) if (s[i] === 'ˈ') marks.push(i);
  if (marks.length === 0) return ensureStress(s);

  // right to left, so a rewrite never invalidates the index of a mark still to come
  let out = s;
  for (const at of marks.reverse()) {
    const rest = out.slice(at + 1);
    if (!isVowel(rest[0])) continue; // already at an onset

    // consonants immediately before the mark, back to the previous vowel/space
    let start = at;
    while (start > 0 && isConsonant(out[start - 1])) start--;
    const cluster = out.slice(start, at);
    const onset = ONSETS.find((o) => cluster.endsWith(o)) ?? '';
    const cut = at - onset.length;

    // word-internal vowel-initial stressed syllable takes a glottal stop
    const glottal = onset === '' && cut > 0 && out[cut - 1] !== ' ' ? 'ʔ' : '';
    out = out.slice(0, cut) + 'ˈ' + glottal + onset + out.slice(at + 1);
  }
  return out;
}

/** espeak omits stress on some monosyllables; the mark belongs before the onset. */
function ensureStress(s: string): string {
  if (s.includes('ˈ') || s.includes(' ')) return s;
  const v = [...s].findIndex((c) => isVowel(c));
  if (v < 0) return s;
  let start = v;
  while (start > 0 && isConsonant(s[start - 1])) start--;
  return s.slice(0, start) + 'ˈ' + s.slice(start);
}

// --- espeak -----------------------------------------------------------------

function espeak(word: string): string {
  try {
    const out = execFileSync('espeak-ng', ['-v', 'de', '-q', '--ipa', word], { encoding: 'utf8' });
    return out.replace(/\n/g, ' ').trim();
  } catch {
    console.error('espeak-ng failed — install it:  brew install espeak-ng');
    process.exit(1);
  }
}

export function ipaFor(word: string): string {
  return normalize(espeak(word));
}

// --- calibration ------------------------------------------------------------

/** Words whose correct Duden/Wiktionary transcription is known. Any mismatch is
    either a normalizer bug or a documented espeak blind spot (marked ✗). */
const CALIBRATION: Array<[string, string]> = [
  ['Apfel', 'ˈapfl̩'],
  ['Äpfel', 'ˈɛpfl̩'],
  ['Vater', 'ˈfaːtɐ'],
  ['Uhr', 'ˈuːɐ̯'],
  ['machen', 'ˈmaxn̩'],
  ['Zeit', 'ˈtsaɪ̯t'],
  ['Häuser', 'ˈhɔʏ̯zɐ'],
  ['schön', 'ˈʃøːn'],
  ['Buch', 'ˈbuːx'],
  ['ich', 'ˈɪç'],
  ['Milch', 'ˈmɪlç'],
  ['Fuß', 'ˈfuːs'],
  ['beantworten', 'bəˈʔantvɔʁtn̩'],
  ['Entschuldigung', 'ɛntˈʃʊldɪgʊŋ'],
  ['Kollege', 'kɔˈleːgə'],
  ['Salat', 'zaˈlaːt'],
  ['telefonieren', 'telefoˈniːʁən'],
  // known espeak blind spots — the review pass owns these
  ['aufstehen', 'ˈaʊ̯fˌʃteːən'], // ✗ compound stress
  ['Wochenende', 'ˈvɔxn̩ˌʔɛndə'], // ✗ compound
  ['Restaurant', 'ʁɛstoˈʁɑ̃ː'], // ✗ final length
  ['Büro', 'byˈʁoː'], // ✗ loanword stress
];

function calibrate(): void {
  let ok = 0;
  console.log('word'.padEnd(16), 'espeak'.padEnd(22), 'normalized'.padEnd(18), 'target');
  for (const [word, target] of CALIBRATION) {
    const raw = espeak(word);
    const got = normalize(raw);
    const hit = got === target.normalize('NFC');
    if (hit) ok++;
    console.log(
      `${hit ? '✓' : '✗'} ${word.padEnd(14)}`,
      raw.padEnd(22),
      got.padEnd(18),
      hit ? '' : target,
    );
  }
  console.log(`\n${ok}/${CALIBRATION.length} match — the ✗ rows must be fixed by review.`);
}

// --- YAML write-back --------------------------------------------------------

/** Sentence-length phrases get no transcription (useless in a table, hostile to author). */
function skip(de: string, pos: string): boolean {
  return pos === 'phrase' && de.split(/\s+/).length > 3;
}

/**
 * Insert `ipa:` line-by-line rather than re-serializing the document: a YAML
 * round-trip re-wraps every long example_ru and buries the real change in churn.
 */
function fill(file: string, opts: { force: boolean; check: boolean }): void {
  const text = readFileSync(file, 'utf8');
  const document: unknown = YAML.parse(text);
  const entries =
    document && typeof document === 'object' && Array.isArray((document as { entries?: unknown }).entries)
      ? (document as { entries: Array<{ de?: unknown; pos?: unknown }> }).entries
      : null;
  if (
    !entries ||
    entries.some((entry) => typeof entry.de !== 'string' || typeof entry.pos !== 'string')
  ) {
    console.error(`${file}: does not parse as a vocab file — fix it first`);
    process.exit(1);
  }

  const lines = text.split('\n');
  const out: string[] = [];
  let n = 0; // index into entries, in document order
  let added = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const block = /^(\s*)- de:\s/.exec(line);
    const inline = /^(\s*)- \{\s*de:\s*(?:"[^"]*"|'[^']*'|[^,}]+),/.exec(line);
    if (!block && !inline) {
      out.push(line);
      continue;
    }
    const e = entries[n++];
    if (!e || typeof e.de !== 'string' || typeof e.pos !== 'string') continue;
    if (skip(e.de, e.pos)) {
      out.push(line);
      continue;
    }

    const ipa = ipaFor(e.de);

    if (inline) {
      const existing = /\bipa:\s*"[^"]*",?\s*/.test(line);
      if (existing && !opts.force) {
        out.push(line);
        continue;
      }
      const withoutOld = existing ? line.replace(/\bipa:\s*"[^"]*",?\s*/, '') : line;
      out.push(withoutOld.replace(/(de:\s*(?:"[^"]*"|'[^']*'|[^,}]+),)/, `$1 ipa: "${ipa}",`));
      added++;
      if (opts.check) console.log(`  ${e.de.padEnd(24)} ${ipa}`);
      continue;
    }

    out.push(line);

    // an existing ipa always sits on the line right after `de` (we put it there)
    const existing = /^\s*ipa:\s/.test(lines[i + 1] ?? '');
    if (existing && !opts.force) continue;
    if (existing) i++; // --force: drop the old line instead of stacking a duplicate key

    const indent = block![1]!.length + 2; // align under `- `
    out.push(`${' '.repeat(indent)}ipa: "${ipa}"`);
    added++;
    if (opts.check) console.log(`  ${e.de.padEnd(24)} ${ipa}`);
  }

  if (n !== entries.length) {
    console.error(`${file}: matched ${n} "- de:" lines but the file has ${entries.length} entries`);
    process.exit(1);
  }
  if (!opts.check && added > 0) writeFileSync(file, out.join('\n'));
  console.log(`${opts.check ? 'would fill' : 'filled'} ${added} entr${added === 1 ? 'y' : 'ies'} — ${file.split('/').pop()}`);
}

// --- main -------------------------------------------------------------------

const args = import.meta.main ? process.argv.slice(2) : null;
if (args === null) {
  // imported for normalize()/ipaFor() — don't touch the corpus
} else if (args.includes('--calibrate')) {
  calibrate();
} else {
  const only = args[args.indexOf('--only') + 1];
  const files = readdirSync(VOCAB)
    .filter((f) => f.endsWith('.yaml'))
    .filter((f) => !args.includes('--only') || f === `${only}.yaml`)
    .map((f) => join(VOCAB, f));
  if (files.length === 0) {
    console.error('no vocab files matched');
    process.exit(1);
  }
  for (const f of files) fill(f, { force: args.includes('--force'), check: args.includes('--check') });
}
