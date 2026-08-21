/**
 * Geklonte Stimmen und der Klon-Assistent.
 *
 * Lives under Figuren because it answers the same question the roster does — *who can speak in this
 * course* — and a separate section would have hidden the one comparison that matters: a cloned
 * voice is cast beside the twelve, so it is auditioned on the same three phrases, in the same
 * place, in the same face.
 *
 * It is nevertheless a **different kind of thing** from a roster row, and the design says so rather
 * than blending them. A character is a catalogue entry; a voice reference is a *permission*, and
 * everything on these panels is about that: the consent digest is printed beside the recording's,
 * a scope badge is on every row, and a withdrawal is struck through with its date instead of
 * disappearing.
 *
 * **The assistant is a Kette, not a form with sections.** `AUFNAHME → TEXT → EINWILLIGUNG →
 * HÖRPROBE` is the Freigabe page's device and it is here for the identical reason: the order is the
 * discipline, and nobody may choose to be at the end of it. You cannot audition a voice before the
 * consent that permits it exists.
 *
 * **The rules are printed and not evaluated.** `GET /api/voices` serves the consent rules; this
 * page renders the ones that apply and lets the engine give the verdict. A green tick this form
 * computed itself would be a check that could not run looking like a check that passed — and the
 * rule it was checking would then have two implementations to disagree with each other.
 *
 * **Upload, no in-browser recording.** MediaRecorder was considered and declined: it yields
 * WebM/Opus, the clone path wants PCM, and a consent document is bound to the SHA-256 of *exact*
 * bytes — a re-encode on the way in would break that binding silently, which is the one thing this
 * whole surface exists to prevent.
 */
import { useCallback, useMemo, useState } from 'react';
import { Marke, Platte, Zustand } from '../components/Platte';
import { Feld, Feldreihe, SkriptFeld, WahlFeld } from '../components/Feld';
import { kurzSha, zahl } from '../format';
import { useApi, useEngineBlob } from '../useEngine';
import type { ConsentRule, Voice } from '../contracts';
import {
  STUFEN,
  STUFE_NAME,
  absendbar,
  dateiSha256,
  istKennung,
  konsentText,
  leererEntwurf,
  regelText,
  regelnFuer,
  stufe,
  verletzteRegel,
  type KlonEntwurf,
  type Stufe,
} from '../klon';
import { fehlerText } from './fehler';

const SCOPE_NAME: Record<string, string> = {
  evaluation: 'Evaluation',
  publication: 'Veröffentlichung',
};

export function Stimmen({
  voices,
  regeln,
  engines,
  phrasen,
  neuLesen,
}: {
  voices: readonly Voice[];
  regeln: readonly ConsentRule[];
  engines: readonly string[];
  phrasen: readonly string[];
  neuLesen(): void;
}): React.JSX.Element {
  return (
    <>
      <Platte
        titel="Geklonte Stimmen"
        zaehler={`${zahl(voices.length)}`}
        erklaerung="Eine geklonte Stimme ist eine Einwilligung, kein Katalogeintrag: sie ist an die SHA-256 genau einer Aufnahme und an genau ein Einwilligungsdokument gebunden. Die Aufnahme liegt außerhalb des Repositorys und reist nicht mit einem Checkout."
        randlos
      >
        {voices.length === 0 ? (
          <Zustand
            art="leer"
            text="Noch keine geklonte Stimme. Der Assistent darunter führt von der Aufnahme über den Text zur Einwilligung."
          />
        ) : (
          voices.map((voice) => (
            <Stimme key={voice.id} voice={voice} phrasen={phrasen} neuLesen={neuLesen} />
          ))
        )}
      </Platte>

      <KlonAssistent regeln={regeln} engines={engines} neuLesen={neuLesen} />
    </>
  );
}

function Stimme({
  voice,
  phrasen,
  neuLesen,
}: {
  voice: Voice;
  phrasen: readonly string[];
  neuLesen(): void;
}): React.JSX.Element {
  const api = useApi();
  const [laeuft, setLaeuft] = useState<'demo' | 'widerruf' | null>(null);
  const [fehler, setFehler] = useState<Error | null>(null);
  const widerrufen = voice.revoked_at !== null;

  const demo = useCallback(async () => {
    setLaeuft('demo');
    setFehler(null);
    try {
      await api.renderVoiceDemo(voice.id);
      neuLesen();
    } catch (error) {
      setFehler(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLaeuft(null);
    }
  }, [api, neuLesen, voice.id]);

  const widerruf = useCallback(async () => {
    setLaeuft('widerruf');
    setFehler(null);
    try {
      await api.revokeVoice(voice.id);
      neuLesen();
    } catch (error) {
      setFehler(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLaeuft(null);
    }
  }, [api, neuLesen, voice.id]);

  return (
    <div className="stimme" data-widerrufen={widerrufen ? 'ja' : undefined}>
      <div className="reihe stimme-kopf">
        <span className="skript stimme-name">{voice.subject_display_name}</span>
        <Marke
          ton={widerrufen ? 'alarm' : voice.scope === 'publication' ? 'signal' : 'messung'}
          titel={
            voice.scope === 'publication'
              ? 'Die Einwilligung erlaubt die Veröffentlichung im Kurs.'
              : 'Die Einwilligung erlaubt nur lokale Bewertung.'
          }
        >
          {SCOPE_NAME[voice.scope] ?? voice.scope}
        </Marke>
        {voice.guardian_consent ? (
          <Marke titel="Erziehungsberechtigte Person hat eingewilligt.">Sorgeberechtigt</Marke>
        ) : null}
        {voice.x_vector_only ? (
          <Marke titel="Nur Sprecher-Embedding, ohne Referenztext.">x-Vektor</Marke>
        ) : null}
      </div>

      <dl className="werte stimme-werte">
        <div className="wert">
          <dt>Kennung</dt>
          <dd className="zahl">{voice.id}</dd>
        </div>
        <div className="wert">
          <dt>Aufnahme</dt>
          <dd className="zahl">
            {kurzSha(voice.reference_sha256)}
            {voice.reference_present ? '' : ' · nicht auf diesem Rechner'}
          </dd>
        </div>
        <div className="wert">
          <dt>Einwilligung</dt>
          <dd className="zahl">{kurzSha(voice.consent_sha256)}</dd>
        </div>
        <div className="wert">
          <dt>Engine</dt>
          <dd className="zahl">{voice.engine}</dd>
        </div>
      </dl>

      {voice.retention ? (
        <p className="feld-hinweis stimme-aufbewahrung">{voice.retention}</p>
      ) : null}

      {widerrufen ? (
        <p className="hinweis hinweis-alarm" role="status">
          Widerrufen am {voice.revoked_at?.slice(0, 10)}. Die Aufnahme ist gelöscht und es wird
          nichts mehr damit erzeugt. Bereits veröffentlichte Aufnahmen behalten ihre Provenienz und
          werden über den Rückzugs- und Neuveröffentlichungspfad zurückgezogen.
        </p>
      ) : null}

      {fehler ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(fehler)}
        </p>
      ) : null}

      {voice.demo_urls.length === 0 ? (
        <p className="demo entfernt" style={{ fontSize: 'var(--ton-grad-12)' }}>
          Noch keine Hörprobe erzeugt.
        </p>
      ) : (
        voice.demo_urls.map((url, index) => (
          <Hoerprobe key={url} url={url} phrase={phrasen[index]} nummer={index + 1} />
        ))
      )}

      <div className="reihe stimme-knoepfe">
        <button type="button" className="knopf" disabled={widerrufen || laeuft !== null} onClick={demo}>
          {laeuft === 'demo' ? 'Hörprobe läuft …' : 'Hörprobe erzeugen'}
        </button>
        <button
          type="button"
          className="knopf"
          disabled={widerrufen || laeuft !== null}
          onClick={widerruf}
          title="Löscht die Aufnahme und die Hörproben und verweigert jede weitere Synthese."
        >
          {laeuft === 'widerruf' ? 'Widerruf läuft …' : 'Einwilligung widerrufen'}
        </button>
      </div>
    </div>
  );
}

export function Hoerprobe({
  url,
  phrase,
  nummer,
}: {
  url: string;
  phrase?: string;
  nummer: number;
}): React.JSX.Element {
  const blob = useEngineBlob(url);
  return (
    <div className="demo">
      <p className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
        {phrase ?? `Hörprobe ${nummer}`}
      </p>
      {blob ? (
        <audio controls preload="none" src={blob} aria-label={`Hörprobe ${nummer}`} />
      ) : (
        <p className="entfernt" style={{ fontSize: 'var(--ton-grad-11)' }}>wird geladen …</p>
      )}
    </div>
  );
}

// -- der Assistent ------------------------------------------------------------

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function KlonAssistent({
  regeln,
  engines,
  neuLesen,
}: {
  regeln: readonly ConsentRule[];
  engines: readonly string[];
  neuLesen(): void;
}): React.JSX.Element {
  const api = useApi();
  const [entwurf, setEntwurf] = useState<KlonEntwurf>(() => leererEntwurf(heute(), engines[0]));
  const [datei, setDatei] = useState<File | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Error | null>(null);
  const [angelegt, setAngelegt] = useState<Voice | null>(null);

  const jetzt = stufe(entwurf, angelegt !== null);
  const geltend = useMemo(() => regelnFuer(regeln, entwurf), [regeln, entwurf]);
  const verletzt = fehler ? verletzteRegel(fehler.message, geltend) : null;

  const dateiWaehlen = useCallback(async (gewaehlt: File | null) => {
    setDatei(gewaehlt);
    setFehler(null);
    if (!gewaehlt) {
      setEntwurf((alt) => ({ ...alt, referenz: null }));
      return;
    }
    const sha256 = await dateiSha256(gewaehlt);
    setEntwurf((alt) => ({
      ...alt,
      referenz: { name: gewaehlt.name, bytes: gewaehlt.size, sha256, sekunden: null },
    }));
  }, []);

  const anlegen = useCallback(async () => {
    if (!datei) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const voice = await api.createVoice({
        voice_id: entwurf.voiceId,
        consent: konsentText(entwurf),
        reference: datei,
        ref_text: entwurf.textQuelle === 'eingeben' ? entwurf.refText : undefined,
        x_vector_only: entwurf.xVectorOnly,
        engine: entwurf.engine,
      });
      setAngelegt(voice);
      neuLesen();
    } catch (error) {
      setFehler(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLaeuft(false);
    }
  }, [api, datei, entwurf, neuLesen]);

  const zuruecksetzen = useCallback(() => {
    setEntwurf(leererEntwurf(heute(), engines[0]));
    setDatei(null);
    setAngelegt(null);
    setFehler(null);
  }, [engines]);

  return (
    <Platte
      titel="Der Klon-Assistent"
      zaehler={STUFE_NAME[jetzt]}
      erklaerung="Eine eingewilligte Stimme entsteht in dieser Reihenfolge und in keiner anderen. Was die Einwilligung erfüllen muss, steht unten — geprüft wird es von der Engine, nicht von diesem Formular."
    >
      <Kette jetzt={jetzt} />

      {angelegt ? (
        <Fertig voice={angelegt} zuruecksetzen={zuruecksetzen} />
      ) : (
        <>
          <Aufnahme entwurf={entwurf} waehlen={dateiWaehlen} />
          <Text entwurf={entwurf} setEntwurf={setEntwurf} />
          <Einwilligung
            entwurf={entwurf}
            setEntwurf={setEntwurf}
            engines={engines}
            regeln={geltend}
            verletzt={verletzt}
          />

          {fehler ? (
            <p className="hinweis hinweis-alarm" role="alert">
              {fehlerText(fehler)}
            </p>
          ) : null}

          <div className="reihe" style={{ marginTop: 'var(--ton-mass-4)' }}>
            <button
              type="button"
              className="knopf knopf-signal"
              disabled={!absendbar(entwurf) || laeuft}
              onClick={anlegen}
            >
              {laeuft ? 'Stimme wird angelegt …' : 'Stimme anlegen'}
            </button>
            <span className="feld-hinweis">
              Die Aufnahme wird in die App-Daten kopiert, niemals ins Repository.
            </span>
          </div>
        </>
      )}
    </Platte>
  );
}

/** The chain. Not a selector: consent comes before an audition, and that is not a preference. */
function Kette({ jetzt }: { jetzt: Stufe }): React.JSX.Element {
  const index = STUFEN.indexOf(jetzt);
  return (
    <ol className="kette" aria-label="Ablauf des Klon-Assistenten">
      {STUFEN.map((eintrag, stelle) => (
        <li
          key={eintrag}
          className="kette-glied"
          data-lage={stelle < index ? 'vorbei' : stelle === index ? 'jetzt' : 'kommt'}
          aria-current={stelle === index ? 'step' : undefined}
        >
          {STUFE_NAME[eintrag]}
        </li>
      ))}
    </ol>
  );
}

function Abschnitt({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="assistent-stufe">
      <p className="tafel">{titel}</p>
      {hinweis ? <p className="feld-hinweis">{hinweis}</p> : null}
      {children}
    </section>
  );
}

function Aufnahme({
  entwurf,
  waehlen,
}: {
  entwurf: KlonEntwurf;
  waehlen(datei: File | null): void;
}): React.JSX.Element {
  return (
    <Abschnitt
      titel="1 · Aufnahme"
      hinweis="Eine Datei, keine Aufnahme im Browser: der Browser nimmt WebM/Opus auf, der Klonpfad will PCM, und die Einwilligung hängt an der SHA-256 genau dieser Bytes. Eine Umkodierung dazwischen würde diese Bindung lösen, ohne dass es jemand sieht."
    >
      <label className="feld-block">
        <span className="tafel feld-legende">Referenzaufnahme</span>
        <input
          className="feld"
          type="file"
          accept="audio/*"
          onChange={(event) => waehlen(event.target.files?.[0] ?? null)}
        />
        <span className="feld-hinweis">
          Eine ruhige, zusammenhängende Aufnahme derselben Person, ohne zweite Stimme im Raum.
        </span>
      </label>

      {entwurf.referenz ? (
        <dl className="werte">
          <div className="wert">
            <dt>Datei</dt>
            <dd className="zahl">{entwurf.referenz.name}</dd>
          </div>
          <div className="wert">
            <dt>Größe</dt>
            <dd className="zahl">{zahl(Math.round(entwurf.referenz.bytes / 1024))} kB</dd>
          </div>
          <div className="wert">
            <dt>SHA-256</dt>
            <dd className="zahl" title={entwurf.referenz.sha256}>
              {kurzSha(entwurf.referenz.sha256)}
            </dd>
          </div>
        </dl>
      ) : null}
    </Abschnitt>
  );
}

function Text({
  entwurf,
  setEntwurf,
}: {
  entwurf: KlonEntwurf;
  setEntwurf(next: (alt: KlonEntwurf) => KlonEntwurf): void;
}): React.JSX.Element {
  const eingeben = entwurf.textQuelle === 'eingeben';
  return (
    <Abschnitt
      titel="2 · Text"
      hinweis="Der Referenztext entscheidet mit, wie der Klon klingt: das Modell konditioniert darauf. Er wird beim Anlegen festgeschrieben und lässt sich später nicht ändern — sonst klänge die Stimme anders, ohne dass sich ein Hash bewegt."
    >
      <div className="reihe">
        <button
          type="button"
          className={eingeben ? 'knopf knopf-signal' : 'knopf'}
          aria-pressed={eingeben}
          onClick={() => setEntwurf((alt) => ({ ...alt, textQuelle: 'eingeben' }))}
        >
          Text eingeben
        </button>
        <button
          type="button"
          className={eingeben ? 'knopf' : 'knopf knopf-signal'}
          aria-pressed={!eingeben}
          onClick={() => setEntwurf((alt) => ({ ...alt, textQuelle: 'engine' }))}
        >
          Von der Engine transkribieren
        </button>
      </div>

      {eingeben ? (
        <SkriptFeld
          legende="Referenztext"
          hinweis="Wort für Wort das, was in der Aufnahme gesagt wird."
          wert={entwurf.refText}
          zeilen={2}
          disabled={entwurf.xVectorOnly}
          onWert={(refText) => setEntwurf((alt) => ({ ...alt, refText }))}
        />
      ) : (
        <p className="feld-hinweis">
          Die Engine versucht es mit dem lokalen ASR. Gelingt das nicht, bleibt die Stimme ohne
          Text: sie lässt sich dann nicht sprechen und muss neu angelegt werden.
        </p>
      )}

      <label className="reihe" style={{ marginTop: 'var(--ton-mass-3)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={entwurf.xVectorOnly}
          onChange={(event) =>
            setEntwurf((alt) => ({ ...alt, xVectorOnly: event.target.checked }))
          }
        />
        <span className="feld-hinweis">
          Nur Sprecher-Embedding (x-Vektor): ohne Referenztext, andere Klangfarbe. Gehört zur
          Identität der Stimme — zwei Stimmen aus einer Aufnahme, die sich hier unterscheiden, sind
          zwei Stimmen.
        </span>
      </label>
    </Abschnitt>
  );
}

function Einwilligung({
  entwurf,
  setEntwurf,
  engines,
  regeln,
  verletzt,
}: {
  entwurf: KlonEntwurf;
  setEntwurf(next: (alt: KlonEntwurf) => KlonEntwurf): void;
  engines: readonly string[];
  regeln: readonly ConsentRule[];
  verletzt: string | null;
}): React.JSX.Element {
  const publikation = entwurf.scope === 'publication';
  return (
    <Abschnitt
      titel="3 · Einwilligung"
      hinweis="Dieses Formular schreibt das Einwilligungsdokument. Es muss wiedergeben, was der Person tatsächlich gesagt wurde — lies es unten, bevor du es abschickst."
    >
      <Feldreihe spalten="12rem">
        <Feld
          legende="Kennung"
          hinweis={
            entwurf.voiceId && !istKennung(entwurf.voiceId)
              ? 'Kleinbuchstaben, Ziffern und Bindestriche.'
              : 'Der Name, unter dem die Szene besetzt.'
          }
          wert={entwurf.voiceId}
          platzhalter="z. B. mara-h"
          onWert={(voiceId) => setEntwurf((alt) => ({ ...alt, voiceId }))}
        />
        <Feld
          legende="Person"
          hinweis="Wie sie in der Besetzung erscheint."
          wert={entwurf.subjectName}
          onWert={(subjectName) => setEntwurf((alt) => ({ ...alt, subjectName }))}
        />
        <Feld
          legende="Aufgenommen am"
          wert={entwurf.aufgenommenAm}
          onWert={(aufgenommenAm) => setEntwurf((alt) => ({ ...alt, aufgenommenAm }))}
        />
        <WahlFeld
          legende="Engine"
          hinweis="Die Identität gilt für genau diesen Checkpoint."
          wert={entwurf.engine}
          optionen={engines.map((name) => ({ wert: name, name }))}
          onWert={(engine) => setEntwurf((alt) => ({ ...alt, engine }))}
        />
      </Feldreihe>

      <div className="reihe" style={{ marginTop: 'var(--ton-mass-3)' }}>
        <button
          type="button"
          className={publikation ? 'knopf' : 'knopf knopf-signal'}
          aria-pressed={!publikation}
          onClick={() => setEntwurf((alt) => ({ ...alt, scope: 'evaluation' }))}
        >
          Evaluation
        </button>
        <button
          type="button"
          className={publikation ? 'knopf knopf-signal' : 'knopf'}
          aria-pressed={publikation}
          onClick={() => setEntwurf((alt) => ({ ...alt, scope: 'publication' }))}
        >
          Veröffentlichung
        </button>
        <span className="feld-hinweis">
          {publikation
            ? 'Diese Stimme darf in veröffentlichten Kursaufnahmen sprechen.'
            : 'Nur lokale Bewertung. Nichts, was damit erzeugt wird, darf den Kurs verlassen.'}
        </span>
      </div>

      <label className="reihe" style={{ marginTop: 'var(--ton-mass-3)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={entwurf.minderjaehrig}
          onChange={(event) =>
            setEntwurf((alt) => ({ ...alt, minderjaehrig: event.target.checked }))
          }
        />
        <span className="feld-hinweis">Die Person ist minderjährig.</span>
      </label>

      {entwurf.minderjaehrig ? (
        <Feldreihe spalten="14rem">
          <Feld
            legende="Erziehungsberechtigt"
            wert={entwurf.guardianName}
            onWert={(guardianName) => setEntwurf((alt) => ({ ...alt, guardianName }))}
          />
          <SkriptFeld
            legende="Bestätigung der erziehungsberechtigten Person"
            wert={entwurf.guardianAttest}
            zeilen={2}
            onWert={(guardianAttest) => setEntwurf((alt) => ({ ...alt, guardianAttest }))}
          />
          <SkriptFeld
            legende="Zustimmung des Kindes, bezeugt"
            wert={entwurf.assentAttest}
            zeilen={2}
            onWert={(assentAttest) => setEntwurf((alt) => ({ ...alt, assentAttest }))}
          />
        </Feldreihe>
      ) : null}

      <SkriptFeld
        legende="Zweck"
        hinweis="Wofür die Stimme benutzt werden darf, ausgeschrieben."
        wert={entwurf.zweck}
        zeilen={2}
        onWert={(zweck) => setEntwurf((alt) => ({ ...alt, zweck }))}
      />
      <Feldreihe spalten="16rem">
        <SkriptFeld
          legende="Erlaubte Nutzungen"
          hinweis="Eine pro Zeile."
          wert={entwurf.erlaubt}
          zeilen={3}
          onWert={(erlaubt) => setEntwurf((alt) => ({ ...alt, erlaubt }))}
        />
        <SkriptFeld
          legende="Verbotene Nutzungen"
          hinweis="Eine pro Zeile."
          wert={entwurf.verboten}
          zeilen={3}
          onWert={(verboten) => setEntwurf((alt) => ({ ...alt, verboten }))}
        />
      </Feldreihe>
      <SkriptFeld
        legende="Aufbewahrung"
        hinweis="Wie lange die Aufnahme bleibt und wann sie gelöscht wird."
        wert={entwurf.aufbewahrung}
        zeilen={2}
        onWert={(aufbewahrung) => setEntwurf((alt) => ({ ...alt, aufbewahrung }))}
      />
      <label className="reihe" style={{ cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={entwurf.automatischLoeschen}
          onChange={(event) =>
            setEntwurf((alt) => ({ ...alt, automatischLoeschen: event.target.checked }))
          }
        />
        <span className="feld-hinweis">Die Aufnahme wird automatisch gelöscht.</span>
      </label>

      <Regeln regeln={regeln} verletzt={verletzt} />

      <details className="assistent-dokument">
        <summary>
          Dokument ansehen — das ist genau der Text, der abgeschickt wird
        </summary>
        <pre className="zahl">{konsentText(entwurf)}</pre>
      </details>
    </Abschnitt>
  );
}

/**
 * The rules, printed. **Not evaluated here** — the engine gives the verdict, and a row turns red
 * only because the engine named it.
 */
function Regeln({
  regeln,
  verletzt,
}: {
  regeln: readonly ConsentRule[];
  verletzt: string | null;
}): React.JSX.Element {
  return (
    <div className="regeln">
      <p className="tafel">Was diese Einwilligung erfüllen muss</p>
      <p className="feld-hinweis">
        {zahl(regeln.length)} Regeln gelten für diesen Umfang. Geprüft werden sie von der Engine
        beim Anlegen; dieses Formular zeigt sie nur an.
      </p>
      <ul className="regel-liste">
        {regeln.map((regel) => (
          <li
            key={regel.id}
            className="regel"
            data-verletzt={regel.id === verletzt ? 'ja' : undefined}
          >
            <span className="regel-text">{regelText(regel)}</span>
            <span className="zahl regel-id">{regel.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fertig({
  voice,
  zuruecksetzen,
}: {
  voice: Voice;
  zuruecksetzen(): void;
}): React.JSX.Element {
  return (
    <Abschnitt
      titel="4 · Hörprobe"
      hinweis="Die Stimme steht. Erzeuge die drei Hörproben oben in der Liste und hör sie an, bevor du sie besetzt — die drei Sätze sind die des Katalogs, damit sich die Stimme mit den zwölf vergleichen lässt."
    >
      <dl className="werte">
        <div className="wert">
          <dt>Kennung</dt>
          <dd className="zahl">{voice.id}</dd>
        </div>
        <div className="wert">
          <dt>Person</dt>
          <dd className="skript">{voice.subject_display_name}</dd>
        </div>
        <div className="wert">
          <dt>Umfang</dt>
          <dd className="zahl">{SCOPE_NAME[voice.scope] ?? voice.scope}</dd>
        </div>
        <div className="wert">
          <dt>Einwilligung</dt>
          <dd className="zahl" title={voice.consent_sha256}>
            {kurzSha(voice.consent_sha256)}
          </dd>
        </div>
      </dl>
      <button type="button" className="knopf" onClick={zuruecksetzen}>
        Nächste Stimme
      </button>
    </Abschnitt>
  );
}
