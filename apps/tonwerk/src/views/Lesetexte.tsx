/**
 * Lesetexte — 85 texts, one pass, driven from the keyboard.
 *
 * This is the surface PR 12's narration wave runs on, so it is built for the fiftieth row rather
 * than the first. Three decisions follow from that and nothing else on this screen matters as
 * much:
 *
 * **The position is in the address.** `?zeile=` holds the row somebody stopped at, alongside the
 * two filters, so closing the tab is not losing your place and "where I am in B1" is a link.
 *
 * **`Enter` never creates.** It opens what a row points at — the scene, or its Freigabe when one
 * is waiting. A Lesetext with no scene yet has nothing to open, so `Enter` moves focus to that
 * row's *Szene anlegen* button and stops: the engine has no way to delete a scene project, so an
 * accidental repeat in a queue this long would be irreversible work.
 *
 * **The profile is the engine's answer unless somebody overrules it.** `default_profile_id` reads
 * a Lesetext's id, level and kind; the picker's first option sends nothing and lets that rule
 * apply. A frontend that computed its own default would be a second copy of a rule that lives in
 * one place, and the copy is the one nobody updates.
 *
 * There is no per-profile preview here, and that is a real difference from the legacy reading
 * flow. `POST /api/readings/{id}/previews` synthesised one paragraph in every profile so a
 * reviewer could choose by ear — but it is keyed to a *reading project*, the pre-scene model this
 * queue does not create, and it renders the whole catalogue through the local model before the
 * first choice is made. What replaces it is cheaper and already exists: a narration profile is a
 * character plus an instruction, Figuren plays every character's demo takes, and the profile a
 * scene was made with can be heard by rendering it. The panel says so rather than leaving the
 * picker looking like a guess.
 */
import { useCallback, useMemo, useState } from 'react';
import { Marke, Platte, Zustand } from '../components/Platte';
import { Statuslampe } from '../components/Statuslampe';
import { Warteschlange, Zeile } from '../components/Warteschlange';
import { zahl } from '../format';
import { ALLE, ebenen, filtern, lesetextZeilen, ziel, type LesetextZeile } from '../lesetexte';
import { href, navigate, useQueryState } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import { gewaehlt as auswahlAus } from '../warteschlange';
import { fehlerText } from './fehler';
import type { NarrationProfile } from '../contracts';

export function Lesetexte(): React.JSX.Element {
  const api = useApi();
  const [stand, setStand] = useState(0);
  const register = useEngineRead((signal) => api.registry(signal), [api, stand]);
  const szenen = useEngineRead((signal) => api.scenes(signal), [api, stand]);
  const profile = useEngineRead((signal) => api.narrationProfiles(signal), [api]);

  const [ebene, setEbene] = useQueryState('ebene', ALLE);
  const [status, setStatus] = useQueryState('status', ALLE);
  const [zeile, setZeile] = useQueryState('zeile', '');

  const [profilWahl, setProfilWahl] = useState<Record<string, string>>({});
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ id: string; fehler: Error } | null>(null);

  const alle = useMemo(
    () => lesetextZeilen(register.data?.rows ?? [], szenen.data ?? []),
    [register.data, szenen.data],
  );
  const zeilen = useMemo(() => filtern(alle, { ebene, status }), [alle, ebene, status]);
  const ids = useMemo(() => zeilen.map((row) => row.id), [zeilen]);
  const auswahl = auswahlAus(ids, zeile);

  const anlegen = useCallback(
    (row: LesetextZeile) => {
      if (laeuft) return;
      setLaeuft(row.id);
      setProblem(null);
      const wahl = profilWahl[row.id];
      api.sceneFromReading(row.id, wahl || undefined).then(
        () => {
          setLaeuft(null);
          setStand((wert) => wert + 1);
        },
        (grund: unknown) => {
          setLaeuft(null);
          setProblem({
            id: row.id,
            fehler: grund instanceof Error ? grund : new Error(String(grund)),
          });
        },
      );
    },
    [api, laeuft, profilWahl],
  );

  const loeschen = useCallback(
    (row: LesetextZeile) => {
      if (laeuft) return;
      setLaeuft(row.id);
      setProblem(null);
      api.deleteScene(row.slug).then(
        () => {
          setLaeuft(null);
          setStand((wert) => wert + 1);
        },
        (grund: unknown) => {
          setLaeuft(null);
          // A 409 here means this row was stale — the engine's three refusals are all about state
          // this list is a snapshot of. Reload either way, and print what the engine said.
          setStand((wert) => wert + 1);
          setProblem({
            id: row.id,
            fehler: grund instanceof Error ? grund : new Error(String(grund)),
          });
        },
      );
    },
    [api, laeuft],
  );

  const oeffnen = useCallback(
    (id: string) => {
      const row = zeilen.find((eintrag) => eintrag.id === id);
      if (!row) return;
      const wohin = ziel(row);
      if (wohin.art === 'anlegen') {
        // Point at the button; do not press it. `CSS.escape` because a reading id carries a slash.
        const knopf = document.querySelector<HTMLButtonElement>(
          `[data-zeile="${CSS.escape(id)}"] button[data-anlegen]`,
        );
        knopf?.focus();
        return;
      }
      navigate(href(wohin.art === 'freigabe' ? 'pruefung' : 'szene', wohin.slug));
    },
    [zeilen],
  );

  const fehler = register.error ?? szenen.error;

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Korpus</span>
        <h1>Lesetexte</h1>
        <p>
          Jeder Lesetext des Kurses und die Narrationsszene daneben, sofern es eine gibt. Eine
          Reihe, von oben nach unten: J/K wählt, Enter öffnet, Leertaste spielt in der Freigabe.
        </p>
      </header>

      {register.laedt || szenen.laedt ? (
        <Zustand art="laedt" text="Lesetexte und Szenen werden gelesen …" />
      ) : null}
      {fehler ? (
        <p className="hinweis hinweis-alarm" role="alert">
          {fehlerText(fehler)}
        </p>
      ) : null}
      {profile.error ? (
        <p className="hinweis" role="status">
          Der Katalog der Narrationsprofile ließ sich nicht lesen; angelegt wird dann mit dem
          Vorschlag der Engine. {fehlerText(profile.error)}
        </p>
      ) : null}

      {register.data && szenen.data ? (
        <Platte
          titel="Lesetexte"
          zaehler={`${zahl(zeilen.length)} von ${zahl(alle.length)}`}
          erklaerung="„Status“ ist die Sicht des Kurses, „Szene“ die des Studios — nur die erste kennt „veröffentlicht“, nur die zweite den Unterschied zwischen Entwurf und gerendert. Wie ein Profil klingt, steht unter Figuren: ein Narrationsprofil ist eine Figur mit einer Anweisung, und die Hörproben der Figur sind dort."
          randlos
        >
          <div className="platte-leib reihe" style={{ paddingBottom: 0 }}>
            <label className="tafel wahl-feld">
              Ebene
              <select
                className="wahl"
                value={ebene}
                onChange={(event) => setEbene(event.target.value)}
              >
                <option value={ALLE}>alle</option>
                {ebenen(alle).map((wert) => (
                  <option key={wert} value={wert}>
                    {wert}
                  </option>
                ))}
              </select>
            </label>
            <label className="tafel wahl-feld">
              Status
              <select
                className="wahl"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value={ALLE}>alle</option>
                {[...new Set(alle.map((row) => row.status))].sort().map((wert) => (
                  <option key={wert} value={wert}>
                    {wert}
                  </option>
                ))}
              </select>
            </label>
            <span className="entfernt" style={{ fontSize: 'var(--ton-grad-11)' }}>
              Filter und Zeile stehen in der Adresse.
            </span>
          </div>

          {zeilen.length === 0 ? (
            <Zustand art="leer" text="Kein Lesetext passt zu diesem Filter." />
          ) : (
            <Warteschlange
              ids={ids}
              gewaehlt={auswahl}
              onWahl={setZeile}
              onOeffnen={oeffnen}
              beschriftung="Lesetexte des Kurses"
            >
              <thead>
                <tr>
                  <th scope="col">Ebene</th>
                  <th scope="col">Lesetext</th>
                  <th scope="col" className="zahl-rechts">
                    Umfang
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Szene</th>
                  <th scope="col">Profil</th>
                  <th scope="col">Nächster Schritt</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((row) => (
                  <Zeile
                    key={row.id}
                    id={row.id}
                    gewaehlt={row.id === auswahl}
                    onWahl={() => setZeile(row.id)}
                  >
                    <td className="zahl">{row.level}</td>
                    <td>
                      {/* Two lines, not three: at 85 rows a third line is a third of the queue
                          spent on scrolling. The kind and any warning sit beside the id. */}
                      <div className="reihe" style={{ gap: 'var(--ton-mass-2)' }}>
                        <span className="zahl leise">{row.id}</span>
                        {row.art ? <Marke>{row.art}</Marke> : null}
                        {row.quelleAbgewichen ? (
                          <Marke ton="alarm" titel="Die Szene vertont eine ältere Fassung des Lesetexts, als das Repository jetzt hält.">
                            Quelle abgewichen
                          </Marke>
                        ) : null}
                      </div>
                      {row.titel ? (
                        <div className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
                          {row.titel}
                        </div>
                      ) : null}
                    </td>
                    <td className="zahl-rechts zahl leise">
                      {row.woerter ? `${zahl(row.woerter)} W` : <span className="leer" />}
                    </td>
                    <td>
                      <Statuslampe status={row.status} />
                    </td>
                    <td className="leise">{row.stufe ?? <span className="leer" />}</td>
                    <td>
                      <Profil row={row} profile={profile.data?.profiles ?? []} />
                    </td>
                    <td>
                      <Schritt
                        row={row}
                        profile={profile.data?.profiles ?? []}
                        wahl={profilWahl[row.id] ?? ''}
                        setWahl={(wert) =>
                          setProfilWahl((vorher) => ({ ...vorher, [row.id]: wert }))
                        }
                        laeuft={laeuft === row.id}
                        gesperrt={laeuft !== null}
                        anlegen={() => anlegen(row)}
                        loeschen={() => loeschen(row)}
                      />
                      {problem?.id === row.id ? (
                        <div className="zeile-neben" role="alert">
                          {fehlerText(problem.fehler)}
                        </div>
                      ) : null}
                    </td>
                  </Zeile>
                ))}
              </tbody>
            </Warteschlange>
          )}
        </Platte>
      ) : null}
    </>
  );
}

/**
 * The one thing to do with this row next — never a row of five buttons.
 *
 * A queue whose every row offers create, render, check and approve is a queue that asks the
 * reviewer to work out the order. There is only ever one next step, and the row shows it.
 */
function Profil({
  row,
  profile,
}: {
  row: LesetextZeile;
  profile: readonly NarrationProfile[];
}): React.JSX.Element {
  if (!row.profil) return <span className="leer" />;
  const bekannt = profile.find((eintrag) => eintrag.id === row.profil?.id);
  return (
    <span className="leise" title={bekannt?.description ?? undefined}>
      {/* The catalog's label when this build knows the id, and the **id itself** when it does not
          — the Klon-Assistent's rule for an unknown consent rule, applied here: a profile the
          catalogue has since renamed must still appear, not vanish from the column that exists to
          say which one was used. The version is printed beside it because a profile pinned at
          version 1 and a catalogue now at 2 are two different directions. */}
      <span className="skript">{bekannt?.label ?? row.profil.id}</span>{' '}
      <span className="zahl">v{row.profil.version}</span>
    </span>
  );
}

function Schritt({
  row,
  profile,
  wahl,
  setWahl,
  laeuft,
  gesperrt,
  anlegen,
  loeschen,
}: {
  row: LesetextZeile;
  profile: readonly NarrationProfile[];
  wahl: string;
  setWahl(next: string): void;
  laeuft: boolean;
  gesperrt: boolean;
  anlegen(): void;
  loeschen(): void;
}): React.JSX.Element {
  if (!row.szene) {
    // Only profiles this Lesetext's kind is allowed to use. Offering the others would mean
    // learning the rule from a 409 after choosing.
    const erlaubt = profile.filter(
      (eintrag) =>
        eintrag.allowed_kinds.length === 0 ||
        row.art === null ||
        eintrag.allowed_kinds.includes(row.art),
    );
    return (
      <div className="schritt">
        <select
          className="wahl"
          value={wahl}
          aria-label={`Narrationsprofil für ${row.id}`}
          onChange={(event) => setWahl(event.target.value)}
        >
          <option value="">Vorschlag der Engine</option>
          {erlaubt.map((eintrag) => (
            <option key={eintrag.id} value={eintrag.id}>
              {eintrag.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="knopf knopf-signal"
          data-anlegen=""
          disabled={gesperrt}
          onClick={anlegen}
        >
          {laeuft ? 'Legt an …' : 'Szene anlegen'}
        </button>
      </div>
    );
  }

  if (row.szene.stage === 'automatically_checked') {
    return (
      <a className="knopf knopf-signal" href={href('pruefung', row.slug)}>
        Freigabe öffnen
      </a>
    );
  }

  return (
    <div className="schritt">
      <a className="knopf" href={href('szene', row.slug)}>
        {row.szene.stage === 'draft' ? 'Rendern' : 'Szene öffnen'}
      </a>
      {row.loeschbar ? <Loeschen row={row} gesperrt={gesperrt} laeuft={laeuft} loeschen={loeschen} /> : null}
    </div>
  );
}

/**
 * Die stille Rücknahme — the undo for a scene created by mistake.
 *
 * **Quiet, and never a fourth meaning for the alarm hue.** Red in this app is a *verdict*: a check
 * that failed, or an approval that no longer covers its bytes. An offer is not a verdict, so the
 * resting state of this control is the plainest thing on the row — a text button in the apparatus
 * face, no border, dimmed — and it wears `--ton-alarm` only in the **armed** state, where the
 * sentence on it has stopped being an offer and become the consequence. That is the same move the
 * Statuslampe makes with its ring and its core: the hue arrives when there is something to say.
 *
 * **Two presses, no dialogue.** The first press replaces the label with what will happen and what
 * will not; the second does it. A `confirm()` would be a modal in a queue that is driven from the
 * keyboard, and a dialogue you dismiss without reading is the checkbox nobody ticks honestly.
 * Anywhere else in the row — including moving to another row — disarms it.
 *
 * It appears **only where the engine says it would accept one** (`row.loeschbar`, from the row's
 * own `deletable`). A control that is offered and then refused teaches that the offers are
 * decoration.
 */
function Loeschen({
  row,
  gesperrt,
  laeuft,
  loeschen,
}: {
  row: LesetextZeile;
  gesperrt: boolean;
  laeuft: boolean;
  loeschen(): void;
}): React.JSX.Element {
  const [scharf, setScharf] = useState(false);
  if (!scharf) {
    return (
      <button
        type="button"
        className="ruecknahme"
        data-loeschen=""
        disabled={gesperrt}
        onClick={() => setScharf(true)}
      >
        Löschen
      </button>
    );
  }
  return (
    <span className="ruecknahme-scharf" role="group" aria-label={`Szene ${row.slug} löschen`}>
      <button
        type="button"
        className="ruecknahme ruecknahme-ja"
        data-loeschen-bestaetigt=""
        disabled={gesperrt}
        onClick={loeschen}
      >
        {laeuft ? 'Löscht …' : 'Szene wirklich löschen'}
      </button>
      <button type="button" className="ruecknahme" onClick={() => setScharf(false)}>
        Abbrechen
      </button>
    </span>
  );
}
