/**
 * Skript — the cast and the words, which are the two halves of what gets synthesised.
 *
 * The cast comes first because a line cannot be written before there is a voice to give it: a
 * `role` on an utterance is a join key into `cast`, and nothing else relates them. That is also
 * why renaming a role is one operation over both (`rolleUmbenennen`) rather than a field edit —
 * a half-done rename leaves lines cast on a voice the render refuses, twenty minutes later.
 *
 * The words are set in the script face, at the size they will be read at. This is the one screen
 * in Tonwerk where the German *is* the work rather than something the apparatus reports on.
 *
 * **What this view will not do:** an utterance's `id` is editable only while it is new. The id is
 * what the render manifest's timing table, the QA report and an attached exercise all name a line
 * by; renaming a shipped one would silently detach three records that have no other way to point
 * at it.
 */
import { useState } from 'react';
import { Marke, Platte } from '../../components/Platte';
import { Feld, Feldreihe, SkriptFeld, WahlFeld, ZahlFeld } from '../../components/Feld';
import { dauer, zahl } from '../../format';
import {
  aeusserungAendern,
  aeusserungEntfernen,
  aeusserungHinzufuegen,
  aeusserungVerschieben,
  besetzungAendern,
  besetzungEntfernen,
  besetzungHinzufuegen,
  istSequentiell,
  istSprache,
  rolleIstFrei,
  rolleUmbenennen,
} from '../../scene-draft';
import type { Character } from '../../contracts';
import type { Scene, Utterance } from '@da/schema/audio-scene';

export function SkriptModus({
  entwurf,
  original,
  setEntwurf,
  figuren,
}: {
  entwurf: Scene;
  original: Scene;
  setEntwurf(next: Scene): void;
  figuren: Character[];
}): React.JSX.Element {
  const sequentiell = istSequentiell(entwurf);
  const bekannt = new Set(original.script.map((utterance) => utterance.id));
  const zeiten = new Map(
    entwurf.timeline
      .filter(istSprache)
      .map((entry) => [entry.utterance_id, entry.at_ms] as const),
  );

  return (
    <>
      <Besetzung entwurf={entwurf} setEntwurf={setEntwurf} figuren={figuren} />

      <Platte
        titel="Skript"
        zaehler={`${zahl(entwurf.script.length)} ${entwurf.script.length === 1 ? 'Äußerung' : 'Äußerungen'}`}
        erklaerung={
          sequentiell
            ? 'Jede Äußerung folgt auf die vorige. Beim Umstellen wandert der Zeitleisten-Eintrag mit, damit jede Äußerung genau einmal platziert bleibt. Die Kennung ist fest: Prüfbericht, Zeitmessung und Aufgabe nennen die Zeile so.'
            : 'Diese Szene setzt Sprechzeiten ausdrücklich. Reihenfolge und Anzahl sind hier gesperrt — die Überlappungen gehören in die Mischung.'
        }
        randlos
      >
        {sequentiell ? null : (
          <p className="hinweis platte-leib" style={{ margin: 'var(--ton-mass-4)' }}>
            Mindestens eine Sprechzeile hat ein eigenes <code className="pfad">at_ms</code>. Das ist
            eine bewusst gesetzte Überlappung, und Umstellen würde sie verwerfen. Die Zeiten stehen
            unten bei jeder Zeile — bearbeiten lassen sie sich erst mit der Mischung.
          </p>
        )}

        {entwurf.script.map((utterance, index) => (
          <Aeusserung
            key={utterance.id}
            utterance={utterance}
            index={index}
            letzte={index === entwurf.script.length - 1}
            rollen={entwurf.cast.map((member) => member.role)}
            idFrei={!bekannt.has(utterance.id)}
            atMs={zeiten.get(utterance.id) ?? null}
            sequentiell={sequentiell}
            aendern={(patch) => setEntwurf(aeusserungAendern(entwurf, utterance.id, patch))}
            verschieben={(richtung) =>
              setEntwurf(aeusserungVerschieben(entwurf, utterance.id, richtung))
            }
            entfernen={() => setEntwurf(aeusserungEntfernen(entwurf, utterance.id))}
            einfuegen={() => setEntwurf(aeusserungHinzufuegen(entwurf, index))}
          />
        ))}

        <div className="platte-leib" style={{ borderTop: '1px solid var(--ton-kante)' }}>
          <button
            type="button"
            className="knopf"
            disabled={!sequentiell || entwurf.cast.length === 0}
            onClick={() => setEntwurf(aeusserungHinzufuegen(entwurf))}
          >
            Äußerung anhängen
          </button>
        </div>
      </Platte>
    </>
  );
}

function Besetzung({
  entwurf,
  setEntwurf,
  figuren,
}: {
  entwurf: Scene;
  setEntwurf(next: Scene): void;
  figuren: Character[];
}): React.JSX.Element {
  const katalog = new Map(figuren.map((figur) => [figur.id, figur]));
  return (
    <Platte
      titel="Besetzung"
      zaehler={`${zahl(entwurf.cast.length)} ${entwurf.cast.length === 1 ? 'Stimme' : 'Stimmen'}`}
      erklaerung="Eine Figur wird samt Katalogversion gebunden, damit sie nicht leise die Stimme wechselt, wenn der Katalog weiterzieht. Der Seed gehört zur Rolle: er ist es, was zwei Aufnahmen derselben Figur gleich klingen lässt. Ein Rollenname wird in jeder Äußerung mitgeführt; die Anweisung setzt nicht jede Engine um, bleibt aber die redaktionelle Notiz."
      randlos
    >
      {entwurf.cast.map((member) => {
        const figur = member.character ? katalog.get(member.character.id) : undefined;
        return (
          <div className="besetzung-zeile" key={member.role}>
            <Feldreihe spalten="12rem">
              <Rollenfeld
                rolle={member.role}
                umbenennen={(neu) => setEntwurf(rolleUmbenennen(entwurf, member.role, neu))}
              />
              <WahlFeld
                legende="Figur"
                hinweis={
                  member.character
                    ? `gebunden an Version ${member.character.version}`
                    : 'frei besetzt, ohne Katalogeintrag'
                }
                wert={member.character?.id ?? ''}
                optionen={[
                  { wert: '', name: '– keine Figur –' },
                  ...figuren.map((row) => ({ wert: row.id, name: `${row.display_name} · ${row.id}` })),
                ]}
                onWert={(id) => {
                  const gewaehlt = katalog.get(id);
                  setEntwurf(
                    besetzungAendern(entwurf, member.role, {
                      character: gewaehlt
                        ? { id: gewaehlt.id, version: gewaehlt.version ?? 1 }
                        : null,
                    }),
                  );
                }}
              />
              <Feld
                legende="Engine"
                wert={member.voice.engine}
                onWert={(engine) =>
                  setEntwurf(
                    besetzungAendern(entwurf, member.role, {
                      voice: { ...member.voice, engine },
                    }),
                  )
                }
              />
              <Feld
                legende="Stimme"
                wert={member.voice.voice}
                onWert={(voice) =>
                  setEntwurf(
                    besetzungAendern(entwurf, member.role, { voice: { ...member.voice, voice } }),
                  )
                }
              />
              <ZahlFeld
                legende="Seed"
                wert={member.voice.seed}
                min={0}
                onWert={(seed) =>
                  setEntwurf(
                    besetzungAendern(entwurf, member.role, {
                      voice: { ...member.voice, seed: seed ?? 0 },
                    }),
                  )
                }
              />
            </Feldreihe>

            <SkriptFeld
              legende="Anweisung"
              wert={member.voice.style ?? ''}
              zeilen={1}
              platzhalter="z. B. Sprich freundlich und etwas langsamer."
              onWert={(style) =>
                setEntwurf(
                  besetzungAendern(entwurf, member.role, {
                    voice: { ...member.voice, style: style.trim() ? style : null },
                  }),
                )
              }
            />

            <div className="reihe" style={{ marginTop: 'var(--ton-mass-3)' }}>
              {figur ? (
                <button
                  type="button"
                  className="knopf"
                  onClick={() =>
                    setEntwurf(
                      besetzungAendern(entwurf, member.role, {
                        voice: {
                          ...member.voice,
                          voice: figur.voice_profile?.voice ?? member.voice.voice,
                          seed: figur.voice_profile?.seed ?? member.voice.seed,
                          style: figur.voice_profile?.style ?? member.voice.style,
                        },
                      }),
                    )
                  }
                >
                  Stimme aus dem Katalog übernehmen
                </button>
              ) : null}
              <button
                type="button"
                className="knopf"
                disabled={!rolleIstFrei(entwurf, member.role) || entwurf.cast.length <= 1}
                title={
                  rolleIstFrei(entwurf, member.role)
                    ? undefined
                    : 'Diese Rolle spricht noch. Erst die Äußerungen umbesetzen.'
                }
                onClick={() => setEntwurf(besetzungEntfernen(entwurf, member.role))}
              >
                Rolle entfernen
              </button>
              {rolleIstFrei(entwurf, member.role) ? (
                <Marke titel="Diese Rolle hat keine Äußerung.">spricht nicht</Marke>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className="platte-leib" style={{ borderTop: '1px solid var(--ton-kante)' }}>
        <button type="button" className="knopf" onClick={() => setEntwurf(besetzungHinzufuegen(entwurf))}>
          Rolle hinzufügen
        </button>
      </div>
    </Platte>
  );
}

/**
 * A role name, committed on blur rather than on every keystroke.
 *
 * Renaming rewrites every line that speaks the role, and a half-typed name is a name: committing
 * per keystroke would walk the script through `M`, `Ma`, `Mak`… and an intermediate that collides
 * with another role is refused, which would make the field look stuck.
 */
function Rollenfeld({
  rolle,
  umbenennen,
}: {
  rolle: string;
  umbenennen(neu: string): void;
}): React.JSX.Element {
  const [text, setText] = useState(rolle);
  const [fuer, setFuer] = useState(rolle);
  if (fuer !== rolle) {
    setFuer(rolle);
    setText(rolle);
  }
  return (
    <label className="feld-block">
      <span className="tafel feld-legende">Rolle</span>
      <input
        className="feld"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => umbenennen(text)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setText(rolle);
        }}
      />
    </label>
  );
}

function Aeusserung({
  utterance,
  index,
  letzte,
  rollen,
  idFrei,
  atMs,
  sequentiell,
  aendern,
  verschieben,
  entfernen,
  einfuegen,
}: {
  utterance: Utterance;
  index: number;
  letzte: boolean;
  rollen: string[];
  idFrei: boolean;
  atMs: number | null;
  sequentiell: boolean;
  aendern(patch: Partial<Utterance>): void;
  verschieben(richtung: -1 | 1): void;
  entfernen(): void;
  einfuegen(): void;
}): React.JSX.Element {
  const [aussprache, setAussprache] = useState(utterance.synthesis_text !== null);
  const overrides = utterance.pronunciation_overrides;

  return (
    <div className="aeusserung">
      <div className="aeusserung-kopf">
        <span className="zahl entfernt aeusserung-nummer">{String(index + 1).padStart(2, '0')}</span>
        <WahlFeld
          legende="Rolle"
          wert={utterance.role}
          optionen={rollen.map((rolle) => ({ wert: rolle, name: rolle }))}
          onWert={(role) => aendern({ role })}
        />
        {idFrei ? (
          <Feld
            legende="Kennung"
            hinweis="Neu, also noch frei. Nach dem Speichern nennt der Prüfbericht die Zeile so."
            wert={utterance.id}
            onWert={(id) => aendern({ id })}
          />
        ) : (
          <div className="feld-block">
            <span className="tafel feld-legende">Kennung</span>
            <span className="zahl aeusserung-id">{utterance.id}</span>
          </div>
        )}
        <div className="aeusserung-knoepfe">
          <button
            type="button"
            className="knopf"
            aria-label={`Äußerung ${index + 1} nach oben`}
            disabled={!sequentiell || index === 0}
            onClick={() => verschieben(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="knopf"
            aria-label={`Äußerung ${index + 1} nach unten`}
            disabled={!sequentiell || letzte}
            onClick={() => verschieben(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="knopf"
            aria-label={`Äußerung nach ${index + 1} einfügen`}
            disabled={!sequentiell}
            onClick={einfuegen}
          >
            +
          </button>
          <button
            type="button"
            className="knopf"
            aria-label={`Äußerung ${index + 1} entfernen`}
            disabled={!sequentiell}
            onClick={entfernen}
          >
            ×
          </button>
        </div>
      </div>

      <SkriptFeld
        legende="Text"
        wert={utterance.display_text}
        zeilen={2}
        platzhalter="Was gesagt wird — und was der Lernende liest."
        onWert={(display_text) => aendern({ display_text })}
      />

      {aussprache || utterance.synthesis_text !== null ? (
        <SkriptFeld
          legende="Gesprochen"
          hinweis="Was die Engine bekommt, wenn das nicht der angezeigte Text ist — Zahlen, Abkürzungen, ein Eigenname. Leer lassen heißt: angezeigter Text."
          wert={utterance.synthesis_text ?? ''}
          zeilen={1}
          onWert={(text) => aendern({ synthesis_text: text.trim() ? text : null })}
        />
      ) : (
        <button
          type="button"
          className="knopf aeusserung-mehr"
          onClick={() => setAussprache(true)}
        >
          Abweichenden Sprechtext setzen
        </button>
      )}

      <Feldreihe spalten="9rem">
        <ZahlFeld
          legende="Tempo"
          einheit="×"
          hinweis="0,7 bis 1,3"
          wert={utterance.pace}
          min={0.7}
          max={1.3}
          schritt={0.05}
          onWert={(pace) => aendern({ pace: pace ?? 1 })}
        />
        <ZahlFeld
          legende="Pause danach"
          einheit="ms"
          wert={utterance.pause_after_ms}
          min={0}
          max={5000}
          schritt={50}
          onWert={(pause_after_ms) => aendern({ pause_after_ms: pause_after_ms ?? 0 })}
        />
        <ZahlFeld
          legende="Seed für diese Zeile"
          hinweis="Leer: der Seed der Rolle."
          wert={utterance.seed_override}
          min={0}
          leerErlaubt
          onWert={(seed_override) => aendern({ seed_override })}
        />
        {atMs === null ? null : (
          <div className="feld-block">
            <span className="tafel feld-legende">Beginnt bei</span>
            <span className="zahl aeusserung-id">{dauer(atMs)}</span>
            <span className="feld-hinweis">Ausdrücklich gesetzt. Gehört in die Mischung.</span>
          </div>
        )}
      </Feldreihe>

      <div className="aussprache">
        {overrides.length === 0 ? null : (
          <>
            <span className="tafel">Aussprache</span>
            {overrides.map((paar, position) => (
            <div className="aussprache-paar" key={position}>
              <Feld
                legende="Geschrieben"
                wert={paar.display}
                onWert={(display) =>
                  aendern({
                    pronunciation_overrides: overrides.map((row, other) =>
                      other === position ? { ...row, display } : row,
                    ),
                  })
                }
              />
              <Feld
                legende="Gesprochen"
                wert={paar.synthesis}
                onWert={(synthesis) =>
                  aendern({
                    pronunciation_overrides: overrides.map((row, other) =>
                      other === position ? { ...row, synthesis } : row,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="knopf"
                aria-label={`Aussprache ${position + 1} entfernen`}
                onClick={() =>
                  aendern({
                    pronunciation_overrides: overrides.filter((_, other) => other !== position),
                  })
                }
              >
                ×
              </button>
            </div>
            ))}
          </>
        )}
        <button
          type="button"
          className="knopf"
          onClick={() =>
            aendern({
              pronunciation_overrides: [...overrides, { display: '', synthesis: '' }],
            })
          }
        >
          {overrides.length === 0 ? 'Aussprache überschreiben' : 'Aussprache hinzufügen'}
        </button>
      </div>
    </div>
  );
}
