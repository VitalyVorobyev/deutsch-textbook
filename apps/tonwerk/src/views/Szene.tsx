/**
 * Szene — the editor. One scene document, in three modes.
 *
 * **The stored document is the truth; this page edits a copy of it.** Loading parses the engine's
 * bytes strictly against Scene v1 and puts the result in state; every control replaces that state;
 * Save sends it back with `PUT`. Nothing is written until Save is pressed and nothing autosaves —
 * an editorial tool that saves behind its author's back is a tool whose author stops trying
 * things.
 *
 * **Saving retires QA and approval, and the page says so before it is pressed.** A revision is
 * immutable and a new one returns the project to `draft`: the previous report and the previous
 * signature describe audio of the previous text, and they do not follow it forward. That is the
 * stage machine's rule, not a bug, and a reviewer who learns it from a disappearing green tick
 * learns it as one.
 *
 * **A document that does not parse is not editable.** The read-only view falls back to a lenient
 * parse so the script is still readable when the engine has moved ahead of the committed contract
 * — but a lenient read has already lost whatever it did not recognise, and writing it back would
 * make this page the thing that deleted the field. So drift is shown, and the editor is closed.
 *
 * The three modes are the three questions in the order they are answered: what is said (Skript),
 * how it is heard (Szene), what came out (Mischung).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Marke, Platte, Zustand } from '../components/Platte';
import { kurzSha, zahl, zeitpunkt } from '../format';
import { href, navigate, sperreNavigation, useQueryState } from '../router';
import { istGeaendert } from '../scene-draft';
import { useApi, useEngineRead } from '../useEngine';
import { AufbauModus } from './szene/AufbauModus';
import { MischungModus } from './szene/MischungModus';
import { SkriptModus } from './szene/SkriptModus';
import { fehlerText } from './fehler';
import type { Api, SceneDocument } from '../api';
import type { SceneDetail } from '../contracts';
import type { Scene } from '@da/schema/audio-scene';

const STUFE: Record<string, string> = {
  draft: 'Entwurf',
  automatically_checked: 'automatisch geprüft',
  human_approved: 'freigegeben',
  exported: 'veröffentlicht',
  declined: 'abgelehnt',
};

const MODI = [
  { id: 'skript', name: 'Skript' },
  { id: 'szene', name: 'Szene' },
  { id: 'mischung', name: 'Mischung' },
] as const;

export function Szene({ slug }: { slug: string }): React.JSX.Element {
  const api = useApi();
  // A counter rather than a refetch API: `useEngineRead` takes its dependencies spelled out, so
  // bumping this is the whole reload story — and it forces the loading state, which is right,
  // because after a save or a render the page is about different bytes.
  const [stand, setStand] = useState(0);
  // The save notice lives above the reload, because the reload is what remounts the editor: a
  // message owned by the thing that disappears when it succeeds is a message nobody ever reads.
  const [notiz, setNotiz] = useState<string | null>(null);
  const { data, error, laedt } = useEngineRead(
    (signal) => api.scene(slug, signal),
    [api, slug, stand],
  );

  if (laedt) return <Zustand art="laedt" text={`Szene ${slug} wird gelesen …`} />;
  if (error) {
    return (
      <>
        <header className="kopf">
          <span className="tafel kopf-eyebrow">Szene</span>
          <h1>{slug}</h1>
        </header>
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(error)}
        </p>
        <div>
          <a className="knopf" href={href('szenen')}>
            Zurück zur Liste
          </a>
        </div>
      </>
    );
  }
  if (!data) return <Zustand art="leer" text="Diese Szene gibt es nicht." />;

  return (
    <Editor
      key={`${slug}-${data.revision}-${stand}`}
      api={api}
      data={data}
      notiz={notiz}
      setNotiz={setNotiz}
      neuLaden={() => setStand((wert) => wert + 1)}
    />
  );
}

function Editor({
  api,
  data,
  notiz,
  setNotiz,
  neuLaden,
}: {
  api: Api;
  data: SceneDetail & { document: SceneDocument };
  notiz: string | null;
  setNotiz(next: string | null): void;
  neuLaden(): void;
}): React.JSX.Element {
  const original = data.document.scene;
  const [entwurf, setEntwurf] = useState<Scene>(original);
  const [modus, setModus] = useQueryState('modus', 'skript');
  const [variante, setVariante] = useQueryState(
    'variante',
    data.renders[0]?.variant ?? original.variants[0]?.id ?? 'natural',
  );
  const [speichert, setSpeichert] = useState(false);
  const [problem, setProblem] = useState<Error | null>(null);

  const bearbeitbar = data.document.valid;
  const geaendert = bearbeitbar && istGeaendert(original, entwurf);

  const figuren = useEngineRead((signal) => api.characters(signal), [api]);
  const akustik = useEngineRead((signal) => api.acoustics(signal), [api]);
  const klaenge = useEngineRead((signal) => api.sounds(signal), [api]);

  const speichern = useCallback(() => {
    if (!geaendert || speichert) return;
    setSpeichert(true);
    setProblem(null);
    api.reviseScene(data.slug, entwurf, data.exercise).then(
      (antwort) => {
        setSpeichert(false);
        setNotiz(
          `Gespeichert als Revision ${antwort.revision} · Sha ${kurzSha(antwort.scene_sha256)}. ` +
            'Die Szene steht wieder auf Entwurf.',
        );
        neuLaden();
      },
      (grund: unknown) => {
        setSpeichert(false);
        setProblem(grund instanceof Error ? grund : new Error(String(grund)));
      },
    );
  }, [api, data.exercise, data.slug, entwurf, geaendert, neuLaden, setNotiz, speichert]);

  // The dirty guard, in both directions a draft can be lost: leaving the page, and leaving the
  // app. Neither is a confirm this app can style, and neither should be — a native prompt is the
  // one dialog a browser will not let a page suppress.
  useEffect(() => {
    if (!geaendert) return;
    const warnen = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [geaendert]);

  useEffect(() => {
    if (!geaendert) return;
    return sperreNavigation(() =>
      window.confirm('Ungespeicherte Änderungen an dieser Szene verwerfen?'),
    );
  }, [geaendert]);

  // Cmd/Ctrl+S. Prevented by default, always — a browser's own Save on an app page produces an
  // HTML file of a React tree, which is never what the person pressing it wanted.
  useEffect(() => {
    const taste = (event: KeyboardEvent) => {
      if (event.key !== 's' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      speichern();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [speichern]);

  const stufe = STUFE[data.stage] ?? data.stage;
  const kopfMarke = useMemo(() => {
    if (geaendert) return <Marke ton="signal">ungespeichert</Marke>;
    if (data.stage === 'human_approved' || data.stage === 'exported')
      return <Marke ton="signal">{stufe}</Marke>;
    if (data.stage === 'automatically_checked') return <Marke ton="messung">{stufe}</Marke>;
    return <Marke>{stufe}</Marke>;
  }, [data.stage, geaendert, stufe]);

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">
          <a href={href('szenen')} style={{ color: 'inherit' }}>
            Szenen
          </a>{' '}
          · {data.kind === 'narration' ? 'Narration' : 'Dialog'}
        </span>
        <h1>{data.slug}</h1>
        <p className="skript" style={{ marginTop: 'var(--ton-mass-2)' }}>
          {original.title.en}
        </p>
      </header>

      <div className="werkbank">
        <div className="modi" role="group" aria-label="Ansicht">
          {MODI.map((eintrag) => (
            <button
              key={eintrag.id}
              type="button"
              className="modus"
              aria-pressed={modus === eintrag.id}
              onClick={() => setModus(eintrag.id)}
            >
              {eintrag.name}
            </button>
          ))}
        </div>

        <div className="werkbank-stand">
          {kopfMarke}
          <span className="zahl entfernt">
            Rev {zahl(data.revision)} · {kurzSha(data.scene_sha256)}
          </span>
        </div>

        <div className="werkbank-knoepfe">
          <button
            type="button"
            className="knopf"
            disabled={!geaendert || speichert}
            onClick={() => {
              setEntwurf(original);
              setProblem(null);
            }}
          >
            Verwerfen
          </button>
          <button
            type="button"
            className="knopf knopf-signal"
            disabled={!geaendert || speichert}
            title={bearbeitbar ? 'Cmd/Strg + S' : undefined}
            onClick={speichern}
          >
            {speichert ? 'Speichert …' : 'Als neue Revision speichern'}
          </button>
        </div>
      </div>

      {bearbeitbar ? null : (
        <p className="hinweis hinweis-alarm" role="alert">
          Dieses Dokument entspricht nicht dem Vertrag Scene v1, wird unten nachsichtig gelesen und
          lässt sich hier nicht bearbeiten — ein nachsichtiger Lesevorgang hat schon verloren, was
          er nicht erkannt hat, und Zurückschreiben würde es löschen. {data.document.problem}
        </p>
      )}

      {geaendert ? (
        <p className="hinweis" role="status">
          Speichern legt eine neue Revision an und setzt die Szene zurück auf Entwurf. Prüfbericht
          und Freigabe gelten dann für die vorigen Bytes und wandern nicht mit — das ist die Regel
          der Stufenmaschine, kein Fehler.
        </p>
      ) : null}

      {notiz && !geaendert ? (
        <p className="hinweis" role="status">
          {notiz}
        </p>
      ) : null}

      {problem ? (
        // Inline and persistent, never a toast: a validation refusal names a field, and a message
        // that disappears after four seconds is a message nobody can act on.
        <p className="hinweis hinweis-alarm" role="alert">
          Nicht gespeichert. {fehlerText(problem)}
        </p>
      ) : null}

      {figuren.error || akustik.error || klaenge.error ? (
        <p className="hinweis" role="status">
          Ein Katalog konnte nicht gelesen werden, die zugehörige Auswahl bleibt leer:{' '}
          {[figuren.error, akustik.error, klaenge.error]
            .filter((fehler): fehler is Error => Boolean(fehler))
            .map((fehler) => fehlerText(fehler))
            .join(' · ')}
        </p>
      ) : null}

      {modus === 'skript' ? (
        <SkriptModus
          entwurf={entwurf}
          original={original}
          setEntwurf={bearbeitbar ? setEntwurf : () => undefined}
          figuren={figuren.data?.characters ?? []}
        />
      ) : null}

      {modus === 'szene' ? (
        <AufbauModus
          entwurf={entwurf}
          original={original}
          setEntwurf={bearbeitbar ? setEntwurf : () => undefined}
          akustik={akustik.data}
          klaenge={klaenge.data ?? []}
        />
      ) : null}

      {modus === 'mischung' ? (
        <MischungModus
          scene={original}
          slug={data.slug}
          renders={data.renders}
          qa={data.qa ?? null}
          approval={data.approval ?? null}
          sceneSha={data.scene_sha256}
          variante={variante}
          setVariante={setVariante}
          geaendert={geaendert}
          api={api}
          nachLauf={neuLaden}
        />
      ) : null}

      <Verlauf data={data} />
    </>
  );
}

function Verlauf({ data }: { data: SceneDetail }): React.JSX.Element {
  return (
    <Platte
      titel="Revisionen"
      zaehler={`${zahl(data.history.length)}`}
      erklaerung="Jede Revision ist unveränderlich und trägt ihre eigenen Bytes. Was an einer Revision hängt — Prüfung, Freigabe — gehört genau dieser."
      randlos
    >
      {data.history.length === 0 ? (
        <Zustand art="leer" text="Noch keine gespeicherte Revision." />
      ) : (
        <div className="tabelle-rahmen">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col" className="zahl-rechts">
                  Nr.
                </th>
                <th scope="col">Szenen-Sha</th>
                <th scope="col">Angelegt</th>
                <th scope="col">Prüfung</th>
                <th scope="col">Freigabe</th>
                <th scope="col">Aufgabe</th>
              </tr>
            </thead>
            <tbody>
              {[...data.history]
                .sort((a, b) => b.number - a.number)
                .map((row) => (
                  <tr key={row.number}>
                    <td className="zahl-rechts zahl">{row.number}</td>
                    <td className="zahl entfernt" title={row.scene_sha256}>
                      {kurzSha(row.scene_sha256)}
                    </td>
                    <td className="zahl entfernt">{zeitpunkt(row.created_at)}</td>
                    <td>{row.has_qa ? <Marke ton="messung">geprüft</Marke> : <span className="leer" />}</td>
                    <td>
                      {row.has_approval ? <Marke ton="signal">freigegeben</Marke> : <span className="leer" />}
                    </td>
                    <td>{row.has_exercise ? <Marke>vorhanden</Marke> : <span className="leer" />}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="platte-leib" style={{ borderTop: '1px solid var(--ton-kante)' }}>
        <button type="button" className="knopf" onClick={() => navigate(href('szenen'))}>
          Zurück zur Liste
        </button>
      </div>
    </Platte>
  );
}
