/**
 * Hörprobe — the published dialogues, one after another, judged by ear.
 *
 * Whether two voices can be told apart, or a pause is too long, is a judgement no figure in the
 * studio makes. So this screen plays a batch in a row and takes one key per verdict. A problem
 * verdict, with an optional note, is filed into the shared queue (`data/redaktion-queue.yaml`) on
 * the recording's published record, through the engine and the queue's one writer; *gut* is
 * remembered in this browser only (`../hoerprobe.ts` says why).
 *
 * **One region owns the keys.** The digits, Space, `R` and `N` are read on the whole screen and
 * left alone inside a text field; `J`/`K` and `Enter` are the queue table's own, as on Prüfung and
 * Lesetexte, with `Enter` meaning *eintragen und weiter* here. Every key has a button beside it,
 * labelled for a screen reader, with the key printed on it.
 *
 * **The pass resumes from the queue.** A row already carrying a Hörprobe entry, or a *gut* on the
 * same bytes, is judged; after a verdict the next unjudged row is selected and starts playing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Kbd } from '@vitavision/ui';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { hoerprobePfad } from '../api';
import { Marke, Platte, Zustand } from '../components/Platte';
import { Warteschlange, Zeile } from '../components/Warteschlange';
import { SKRIPT_FELD, WAHL } from '../components/steuerung';
import type { HoerprobeEntry, HoerprobeRow } from '../contracts';
import { zahl } from '../format';
import {
  GUT,
  URTEIL_TASTEN,
  gemerktesGut,
  merkeGut,
  naechsteOffene,
  umschalten,
  urteilFuerTaste,
  urteileVon,
  type GutGedaechtnis,
} from '../hoerprobe';
import { useQueryState } from '../router';
import { useApi, useEngineBlob, useEngineRead } from '../useEngine';
import { gewaehlt as auswahlAus, naechste } from '../warteschlange';
import { fehlerText } from './fehler';

/** Text fields keep every key; a button keeps Space and Enter, which it means by itself. */
const FELDER = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const EIGENE_LEERTASTE = new Set(['BUTTON', 'A', 'AUDIO', 'SUMMARY']);

const QUELLEN = [
  { wert: 'alle', name: 'alle Stimmen' },
  { wert: 'preset', name: 'nur Preset-Stimmen' },
  { wert: 'figur', name: 'mit Figuren' },
] as const;

/** A roster character speaks at least one role, or only preset voices do. */
function quelle(row: HoerprobeRow): 'figur' | 'preset' {
  return row.voices.some((voice) => voice.character) ? 'figur' : 'preset';
}

export function Hoerprobe(): React.JSX.Element {
  const api = useApi();
  const { data, error, laedt } = useEngineRead((signal) => api.hoerprobe(signal), [api]);
  const [zeile, setZeile] = useQueryState('zeile', '');
  const [filter, setFilter] = useQueryState('stimmen', 'alle');
  const [gut, setGut] = useState<GutGedaechtnis>(gemerktesGut);
  const [eingetragen, setEingetragen] = useState<Record<string, HoerprobeEntry[]>>({});
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [notiz, setNotiz] = useState('');
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const bereich = useRef<HTMLDivElement | null>(null);
  const notizFeld = useRef<HTMLTextAreaElement | null>(null);

  const zeilen = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((row) => filter === 'alle' || quelle(row) === filter)
        .map((row) => ({ ...row, entries: [...row.entries, ...(eingetragen[row.id] ?? [])] })),
    [data, filter, eingetragen],
  );
  const ids = useMemo(() => zeilen.map((row) => row.id), [zeilen]);
  const offen = useMemo(
    () => new Set(zeilen.filter((row) => urteileVon(row, gut).length === 0).map((row) => row.id)),
    [zeilen, gut],
  );
  // A fresh pass starts at the first recording nobody has judged, not at the top of the list.
  const auswahlId = auswahlAus(ids, zeile || (naechsteOffene(ids, offen, undefined) ?? ''));
  const row = zeilen.find((kandidat) => kandidat.id === auswahlId);

  // The toggles and the note belong to the recording on screen; another one starts empty.
  const [fuer, setFuer] = useState(auswahlId);
  if (fuer !== auswahlId) {
    setFuer(auswahlId);
    setAuswahl([]);
    setNotiz('');
    setFehler(null);
  }

  const { element: probe, ...spieler } = useProbe(row ? `${hoerprobePfad(row.file)}/audio` : null);

  const tabelle = (): void => {
    bereich.current?.querySelector<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });
  };

  const waehle = (id: string | undefined, spielen: boolean): void => {
    if (!id) return;
    spieler.vormerken(spielen);
    setZeile(id);
  };

  async function eintragen(): Promise<void> {
    if (!row || sendet) return;
    if (auswahl.length === 0) {
      setMeldung('Erst ein Urteil wählen: 1 für gut, 2 bis 6 für ein Problem.');
      return;
    }
    let naechsteGut = gut;
    if (auswahl[0] === GUT) {
      naechsteGut = { ...gut, [row.id]: row.audio_sha256 ?? '' };
      setMeldung(`${row.id}: gut.`);
    } else {
      setSendet(true);
      setFehler(null);
      try {
        const { entry } = await api.hoerprobeVerdict(row.file, auswahl, notiz);
        setEingetragen((alt) => ({ ...alt, [row.id]: [...(alt[row.id] ?? []), entry] }));
        setMeldung(`${row.id}: ${auswahl.join(', ')} eingetragen als ${entry.id}.`);
        naechsteGut = Object.fromEntries(Object.entries(gut).filter(([id]) => id !== row.id));
      } catch (grund) {
        setFehler(fehlerText(grund instanceof Error ? grund : new Error(String(grund))));
        return;
      } finally {
        setSendet(false);
      }
    }
    setGut(naechsteGut);
    merkeGut(naechsteGut);
    const nochOffen = new Set(offen);
    nochOffen.delete(row.id);
    const weiter = naechsteOffene(ids, nochOffen, row.id);
    if (weiter) waehle(weiter, true);
    else setMeldung((alt) => `${alt} Durchgang fertig: jede Aufnahme hat ein Urteil.`);
    tabelle();
  }

  function taste(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const ziel = event.target as HTMLElement;
    if (FELDER.has(ziel.tagName)) {
      if (event.key === 'Escape' && ziel === notizFeld.current) {
        event.preventDefault();
        tabelle();
      }
      return;
    }
    const urteil = urteilFuerTaste(event.key);
    if (urteil) {
      event.preventDefault();
      setAuswahl((alt) => umschalten(alt, urteil));
    } else if (event.key === ' ' && !EIGENE_LEERTASTE.has(ziel.tagName)) {
      event.preventDefault();
      spieler.umschalten();
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      spieler.nochmal();
    } else if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      notizFeld.current?.focus();
    }
  }

  const beurteilt = zeilen.length - offen.size;

  return (
    <div ref={bereich} className="stapel" onKeyDown={taste}>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Abhören</span>
        <h1>Hörprobe</h1>
        <p>
          Die veröffentlichten Dialoge, einer nach dem anderen. Ob zwei Stimmen auseinanderzuhalten
          sind oder eine Pause zu lang ist, entscheidet das Ohr. Ein Problem landet als Anliegen in
          der gemeinsamen Warteschlange, „gut“ merkt sich nur dieser Browser.
        </p>
      </header>

      <p className="sr-only" aria-live="polite">
        {meldung}
      </p>
      {laedt ? <Zustand art="laedt" text="Aufnahmen und Warteschlange werden gelesen …" /> : null}
      {error ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(error)}
        </p>
      ) : null}
      {data?.queue_error ? (
        <p className="hinweis hinweis-alarm" role="alert">
          Die Warteschlange ist nicht lesbar, Urteile können nicht eingetragen werden:{' '}
          {data.queue_error}
        </p>
      ) : null}

      {data && row ? (
        <Platte
          titel="Jetzt"
          zaehler={`${zahl(beurteilt)} von ${zahl(zeilen.length)} beurteilt`}
          erklaerung="Leertaste spielt und hält an, R von vorn, J/K weiter und zurück. 1 bis 6 schalten die Urteile, N schreibt eine Notiz, Enter trägt ein und spielt die nächste offene Aufnahme."
        >
          <div className="stapel">
            <div>
              <span className="zahl" style={{ color: 'var(--ton-messung)' }}>
                {row.id}
              </span>{' '}
              <span className="zahl entfernt">{row.level}</span>
              <div className="skript">{row.scenario ?? row.title}</div>
            </div>

            <ul className="reihe" aria-label="Stimmen">
              {row.voices.length === 0
                ? row.speakers.map((sprecher) => <li key={sprecher}>{sprecher}</li>)
                : row.voices.map((stimme) => (
                    <li key={stimme.role}>
                      {stimme.role}{' '}
                      <Marke ton={stimme.character ? 'signal' : 'ruhig'}>
                        {stimme.character ?? `Preset ${stimme.preset ?? '?'}`}
                      </Marke>
                    </li>
                  ))}
            </ul>

            <div className="reihe">
              <Button
                size="sm"
                variant="secondary"
                aria-label="Vorige Aufnahme"
                onClick={() => waehle(naechste(ids, auswahlId, -1), false)}
              >
                <SkipBack aria-hidden /> <Kbd>K</Kbd>
              </Button>
              <Button
                size="sm"
                aria-label={spieler.laeuft ? 'Anhalten' : 'Abspielen'}
                onClick={spieler.umschalten}
              >
                {spieler.laeuft ? <Pause aria-hidden /> : <Play aria-hidden />} <Kbd>Leertaste</Kbd>
              </Button>
              <Button size="sm" variant="secondary" aria-label="Von vorn" onClick={spieler.nochmal}>
                <RotateCcw aria-hidden /> <Kbd>R</Kbd>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Nächste Aufnahme"
                onClick={() => waehle(naechste(ids, auswahlId, 1), false)}
              >
                <SkipForward aria-hidden /> <Kbd>J</Kbd>
              </Button>
              {spieler.blob ? (
                <audio
                  ref={probe}
                  controls
                  src={spieler.blob}
                  aria-label={`Aufnahme ${row.id}`}
                  onPlay={() => spieler.setLaeuft(true)}
                  onPause={() => spieler.setLaeuft(false)}
                  onEnded={() => spieler.setLaeuft(false)}
                />
              ) : (
                <span className="entfernt">wird geladen …</span>
              )}
            </div>

            <ul className="urteile" aria-label="Urteil">
              {URTEIL_TASTEN.map(({ taste: zeichen, urteil }) => (
                <li key={urteil}>
                  <button
                    type="button"
                    className="punkt-schalter"
                    role="switch"
                    aria-checked={auswahl.includes(urteil)}
                    aria-keyshortcuts={zeichen}
                    onClick={() => setAuswahl((alt) => umschalten(alt, urteil))}
                  >
                    <span className="punkt-lampe" aria-hidden="true" />
                    <span className="punkt-text">
                      <span>{urteil}</span>
                    </span>
                    <Kbd>{zeichen}</Kbd>
                  </button>
                </li>
              ))}
            </ul>

            <label className="feld-block">
              <span className="feld-legende tafel">
                Notiz <Kbd>N</Kbd>
              </span>
              <textarea
                ref={notizFeld}
                className={SKRIPT_FELD}
                rows={2}
                value={notiz}
                aria-keyshortcuts="N"
                placeholder="optional: was genau, an welcher Stelle (Esc zurück)"
                onChange={(event) => setNotiz(event.target.value)}
              />
            </label>

            {fehler ? (
              <p className="hinweis hinweis-alarm" role="alert">
                {fehler}
              </p>
            ) : null}

            <div className="reihe">
              <Button
                disabled={
                  sendet || auswahl.length === 0 || Boolean(data.queue_error && auswahl[0] !== GUT)
                }
                aria-keyshortcuts="Enter"
                onClick={() => void eintragen()}
              >
                {auswahl[0] === GUT || auswahl.length === 0 ? 'Weiter' : 'Eintragen und weiter'}{' '}
                <Kbd>Enter</Kbd>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGut({});
                  merkeGut({});
                  setMeldung('Neuer Durchgang: jedes „gut“ ist vergessen.');
                }}
              >
                Neuer Durchgang
              </Button>
            </div>
          </div>
        </Platte>
      ) : null}

      {data ? (
        <Platte
          titel="Aufnahmen"
          zaehler={`${zahl(zeilen.length)}`}
          erklaerung="Jede veröffentlichte Aufnahme mit zwei oder mehr Sprechern. Ein Urteil aus der Warteschlange bleibt stehen, bis das Anliegen geschlossen ist."
          randlos
        >
          <div className="platte-leib reihe">
            <label className="reihe">
              <span className="tafel">Stimmen</span>
              <select
                className={WAHL}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                {QUELLEN.map((option) => (
                  <option key={option.wert} value={option.wert}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {zeilen.length === 0 ? (
            <Zustand art="leer" text="Keine veröffentlichte Aufnahme mit zwei Sprechern." />
          ) : (
            <Warteschlange
              ids={ids}
              gewaehlt={auswahlId}
              onWahl={(id) => waehle(id, false)}
              onOeffnen={() => void eintragen()}
              beschriftung="Aufnahmen der Hörprobe"
            >
              <thead>
                <tr>
                  <th scope="col">Kennung</th>
                  <th scope="col">Ebene</th>
                  <th scope="col">Stimmen</th>
                  <th scope="col">Länge</th>
                  <th scope="col">Urteil</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((eintrag) => {
                  const urteile = urteileVon(eintrag, gut);
                  return (
                    <Zeile
                      key={eintrag.id}
                      id={eintrag.id}
                      gewaehlt={eintrag.id === auswahlId}
                      onWahl={() => waehle(eintrag.id, false)}
                    >
                      <td>
                        <span className="zahl">{eintrag.id}</span>
                        <div className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
                          {eintrag.title}
                        </div>
                      </td>
                      <td className="zahl">{eintrag.level}</td>
                      <td style={{ fontSize: 'var(--ton-grad-12)' }}>
                        {eintrag.voices
                          .map(
                            (stimme) =>
                              `${stimme.role}: ${stimme.character ?? stimme.preset ?? '?'}`,
                          )
                          .join(' · ')}
                      </td>
                      <td className="zahl">
                        {eintrag.duration_seconds === null ? '–' : `${eintrag.duration_seconds} s`}
                      </td>
                      <td>
                        <span className="reihe">
                          {urteile.map((urteil) => (
                            <Marke key={urteil} ton={urteil === GUT ? 'signal' : 'alarm'}>
                              {urteil}
                            </Marke>
                          ))}
                          {eintrag.entries.map((anliegen) => (
                            <Marke key={anliegen.id} titel={anliegen.text}>
                              {anliegen.id}
                            </Marke>
                          ))}
                        </span>
                      </td>
                    </Zeile>
                  );
                })}
              </tbody>
            </Warteschlange>
          )}
        </Platte>
      ) : null}
    </div>
  );
}

/**
 * The one player of the screen: the selected recording, fetched when it is selected, and played
 * when it lands if the step that selected it asked for that.
 */
function useProbe(pfad: string | null) {
  const blob = useEngineBlob(pfad);
  const element = useRef<HTMLAudioElement | null>(null);
  const spielen = useRef(false);
  const [laeuft, setLaeuft] = useState(false);

  const start = (audio: HTMLAudioElement): void => {
    try {
      void Promise.resolve(audio.play()).catch(() => undefined);
    } catch {
      /* a browser that refuses to play without a gesture; the button still works */
    }
  };

  // Another recording is not playing yet, whatever the last one was doing.
  const [fuer, setFuer] = useState(blob);
  if (fuer !== blob) {
    setFuer(blob);
    setLaeuft(false);
  }

  useEffect(() => {
    if (!blob || !element.current || !spielen.current) return;
    spielen.current = false;
    start(element.current);
  }, [blob]);

  return {
    blob,
    element,
    laeuft,
    setLaeuft,
    vormerken(an: boolean): void {
      spielen.current = an;
    },
    umschalten(): void {
      const audio = element.current;
      if (!audio) {
        spielen.current = true;
        return;
      }
      if (audio.paused) start(audio);
      else audio.pause();
    },
    nochmal(): void {
      const audio = element.current;
      if (!audio) {
        spielen.current = true;
        return;
      }
      audio.currentTime = 0;
      start(audio);
    },
  };
}
