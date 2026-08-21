/**
 * Szene — everything about the scene that is not the words: what it is, where it is heard, how
 * hard it is to hear, and what is going on in the background.
 *
 * **No id in this file is written down.** Rooms, devices and difficulty presets are free strings
 * in the Scene contract and closed vocabularies at render time, and the vocabulary lives in the
 * repository's two data files. So every picker here is filled from `GET /api/acoustics`. A
 * hardcoded list would keep offering a room after it was renamed, and the render that refuses
 * would be the first anybody heard about it.
 *
 * **A sound is either a reference or a description, never half of each.** `AssetRef` names bytes
 * that exist, by digest, with an excerpt; `SoundSpec` names a prompt and a seed for bytes that do
 * not exist yet. Switching between them replaces the value rather than merging, because a
 * `{ref, prompt}` is not a thing the contract has a meaning for.
 */
import { isAssetRef } from '@da/schema/audio-scene';
import type { AmbienceEntry, Scene, SfxEntry, Sound } from '@da/schema/audio-scene';
import { Marke, Platte, Zustand } from '../../components/Platte';
import { Feld, Feldreihe, Regler, SkriptFeld, WahlFeld, ZahlFeld } from '../../components/Feld';
import { Welle } from '../../components/Welle';
import { kurzSha, sekunden, zahl } from '../../format';
import {
  eintragAendern,
  eintragEntfernen,
  eintragHinzufuegen,
  istBett,
  istEreignis,
} from '../../scene-draft';
import { klangSha, type Acoustics, type SoundRow } from '../../contracts';

const KIND: readonly { wert: string; name: string }[] = [
  { wert: 'dialogue', name: 'Dialog' },
  { wert: 'narration', name: 'Narration' },
  { wert: 'custom', name: 'frei' },
];

export function AufbauModus({
  entwurf,
  original,
  setEntwurf,
  akustik,
  klaenge,
}: {
  entwurf: Scene;
  original: Scene;
  setEntwurf(next: Scene): void;
  akustik: Acoustics | null;
  klaenge: SoundRow[];
}): React.JSX.Element {
  const importe = klaenge.filter((row) => row.origin === 'freesound');
  const bekannteVarianten = new Set(original.variants.map((variant) => variant.id));

  return (
    <>
      <Platte titel="Was ist das" randlos>
        <div className="platte-leib">
          <Feldreihe spalten="12rem">
            <div className="feld-block">
              <span className="tafel feld-legende">Kennung</span>
              <span className="zahl aeusserung-id">{entwurf.slug}</span>
              <span className="feld-hinweis">
                Die Identität des Projekts. Eine Revision kann sie nicht ändern.
              </span>
            </div>
            <WahlFeld
              legende="Art"
              wert={entwurf.kind}
              optionen={KIND}
              onWert={(kind) => setEntwurf({ ...entwurf, kind: kind as Scene['kind'] })}
            />
            <div className="feld-block">
              <span className="tafel feld-legende">Autorschaft</span>
              <span className="zahl aeusserung-id">
                {entwurf.authoring === 'generated' ? 'generiert' : 'von Hand'}
              </span>
              <span className="feld-hinweis">
                Provenienz, kein Schalter. Sie sagt, wie diese Szene entstanden ist.
              </span>
            </div>
          </Feldreihe>
          <Feldreihe spalten="16rem">
            <SkriptFeld
              legende="Titel (englisch)"
              wert={entwurf.title.en}
              zeilen={1}
              onWert={(en) => setEntwurf({ ...entwurf, title: { ...entwurf.title, en } })}
            />
            <SkriptFeld
              legende="Titel (russisch)"
              wert={entwurf.title.ru}
              zeilen={1}
              onWert={(ru) => setEntwurf({ ...entwurf, title: { ...entwurf.title, ru } })}
            />
            <SkriptFeld
              legende="Titel (ukrainisch)"
              hinweis="Darf leer bleiben."
              wert={entwurf.title.uk ?? ''}
              zeilen={1}
              onWert={(uk) =>
                setEntwurf({ ...entwurf, title: { ...entwurf.title, uk: uk.trim() ? uk : null } })
              }
            />
          </Feldreihe>
        </div>

        {entwurf.brief ? (
          <div className="platte-leib" style={{ borderTop: '1px solid var(--ton-kante)' }}>
            <p className="tafel">Auftrag</p>
            <p className="skript" style={{ marginTop: 'var(--ton-mass-2)' }}>
              {entwurf.brief.scenario}
            </p>
            <div className="reihe" style={{ marginTop: 'var(--ton-mass-3)' }}>
              <Marke>Ebene {entwurf.brief.level}</Marke>
              {entwurf.brief.topic ? <Marke>Thema {entwurf.brief.topic}</Marke> : null}
              {entwurf.brief.grammar_target ? (
                <Marke ton="messung">{entwurf.brief.grammar_target}</Marke>
              ) : null}
              {entwurf.brief.outcomes.map((outcome) => (
                <Marke key={outcome} ton="signal">
                  {outcome}
                </Marke>
              ))}
            </div>
            <p className="feld-hinweis" style={{ marginTop: 'var(--ton-mass-3)' }}>
              Der Auftrag ist die Bestellung, nicht das Werk. Er wird hier gelesen und anderswo
              geändert.
            </p>
          </div>
        ) : null}
      </Platte>

      <Platte
        titel="Akustik"
        zaehler={akustik ? `${zahl(akustik.rooms.length)} Räume` : undefined}
        erklaerung="Der Raum ist eine Faltung auf einem Send aus Sprache und Ereignissen; das Bett bleibt trocken, weil eine aufgenommene Umgebung schon ein Raum ist."
      >
        {akustik === null ? (
          <Zustand
            art="leer"
            text="Die Engine konnte die Akustik-Kataloge nicht lesen. Raum und Preset lassen sich hier nicht wählen."
          />
        ) : (
          <Feldreihe spalten="14rem">
            <WahlFeld
              legende="Raum"
              hinweis={
                akustik.rooms.find((row) => row.id === entwurf.acoustics.room)?.note || undefined
              }
              wert={entwurf.acoustics.room ?? ''}
              optionen={[
                { wert: '', name: '– kein Raum –' },
                ...akustik.rooms.map((row) => ({
                  wert: row.id,
                  name: `${row.label} · v${row.version}`,
                })),
              ]}
              onWert={(room) =>
                setEntwurf({
                  ...entwurf,
                  acoustics: { ...entwurf.acoustics, room: room || null },
                })
              }
            />
            <ZahlFeld
              legende="Vorlauf"
              einheit="ms"
              hinweis="Stille vor dem ersten Wort."
              wert={entwurf.acoustics.lead_in_ms}
              min={0}
              max={5000}
              schritt={50}
              onWert={(lead_in_ms) =>
                setEntwurf({
                  ...entwurf,
                  acoustics: { ...entwurf.acoustics, lead_in_ms: lead_in_ms ?? 0 },
                })
              }
            />
          </Feldreihe>
        )}
      </Platte>

      <Platte
        titel="Schwierigkeitsvarianten"
        zaehler={`${zahl(entwurf.variants.length)}`}
        erklaerung="Dasselbe Skript, schwerer zu hören, ohne ein Wort zu ändern. Jeder Wert ist ein Delta auf das, was in dieser Szene steht — „natürlich“ ist die Identität."
        randlos
      >
        {entwurf.variants.length === 0 ? (
          <Zustand art="leer" text="Diese Szene erklärt keine Variante. Gerendert wird dann nichts." />
        ) : (
          entwurf.variants.map((variant, index) => (
            <div className="variante" key={`${variant.id}-${index}`}>
              <Feldreihe spalten="12rem">
                {bekannteVarianten.has(variant.id) ? (
                  <div className="feld-block">
                    <span className="tafel feld-legende">Kennung</span>
                    <span className="zahl aeusserung-id">{variant.id}</span>
                    <span className="feld-hinweis">
                      Der Renderpfad heißt so. Umbenennen verwirft die vorhandene Aufnahme.
                    </span>
                  </div>
                ) : (
                  <Feld
                    legende="Kennung"
                    hinweis="Kleinbuchstaben mit Bindestrich."
                    wert={variant.id}
                    onWert={(id) =>
                      setEntwurf({
                        ...entwurf,
                        variants: entwurf.variants.map((row, other) =>
                          other === index ? { ...row, id } : row,
                        ),
                      })
                    }
                  />
                )}
                <WahlFeld
                  legende="Preset"
                  hinweis={
                    akustik?.presets.find((row) => row.id === variant.preset)?.note || undefined
                  }
                  disabled={akustik === null}
                  wert={variant.preset ?? ''}
                  optionen={[
                    { wert: '', name: '– kein Preset –' },
                    ...(akustik?.presets ?? []).map((row) => ({
                      wert: row.id,
                      name: `${row.label} · v${row.version}`,
                    })),
                  ]}
                  onWert={(preset) =>
                    setEntwurf({
                      ...entwurf,
                      variants: entwurf.variants.map((row, other) =>
                        other === index ? { ...row, preset: preset || null } : row,
                      ),
                    })
                  }
                />
              </Feldreihe>

              <Abweichungen
                overrides={variant.overrides}
                schluessel={akustik?.override_keys ?? []}
                basis={akustik?.presets.find((row) => row.id === variant.preset)?.deltas ?? {}}
                setOverrides={(overrides) =>
                  setEntwurf({
                    ...entwurf,
                    variants: entwurf.variants.map((row, other) =>
                      other === index ? { ...row, overrides } : row,
                    ),
                  })
                }
              />

              <button
                type="button"
                className="knopf"
                style={{ marginTop: 'var(--ton-mass-3)' }}
                onClick={() =>
                  setEntwurf({
                    ...entwurf,
                    variants: entwurf.variants.filter((_, other) => other !== index),
                  })
                }
              >
                Variante entfernen
              </button>
            </div>
          ))
        )}
        <div className="platte-leib" style={{ borderTop: '1px solid var(--ton-kante)' }}>
          <button
            type="button"
            className="knopf"
            onClick={() =>
              setEntwurf({
                ...entwurf,
                variants: [
                  ...entwurf.variants,
                  { id: `variante-${entwurf.variants.length + 1}`, preset: null, overrides: {} },
                ],
              })
            }
          >
            Variante hinzufügen
          </button>
        </div>
      </Platte>

      <Zeitleiste
        entwurf={entwurf}
        setEntwurf={setEntwurf}
        akustik={akustik}
        importe={importe}
      />
    </>
  );
}

/**
 * Per-key departures from a preset's deltas.
 *
 * **A row exists only where a departure was decided.** The five keys are a closed vocabulary
 * (`override_keys`, and the renderer refuses anything else), but drawing all five as controls
 * makes four decisions that were never made look like four settings. So an override is added from
 * a picker and removed by putting it back on the preset, and the preset's own value is printed
 * beside it — a departure from an unnamed number is not a decision anybody can review.
 */
function Abweichungen({
  overrides,
  schluessel,
  basis,
  setOverrides,
}: {
  overrides: Record<string, number | string>;
  schluessel: readonly string[];
  basis: Record<string, number>;
  setOverrides(next: Record<string, number | string>): void;
}): React.JSX.Element {
  if (schluessel.length === 0) {
    return (
      <p className="feld-hinweis">
        Ohne die Akustik-Kataloge ist nicht bekannt, welche Abweichungen die Engine annimmt.
      </p>
    );
  }
  const gesetzt = schluessel.filter((key) => key in overrides);
  const offen = schluessel.filter((key) => !(key in overrides));

  return (
    <div className="abweichungen">
      <span className="tafel">Abweichungen</span>
      {gesetzt.length === 0 ? (
        <p className="feld-hinweis">Diese Variante nimmt das Preset, wie es ist.</p>
      ) : (
        <Feldreihe spalten="10rem">
          {gesetzt.map((key) => {
            const wert = Number(overrides[key]);
            return (
              <div className="abweichung" key={key}>
                <ZahlFeld
                  legende={key}
                  hinweis={`Preset: ${basis[key] ?? 0}`}
                  wert={Number.isFinite(wert) ? wert : 0}
                  schritt={0.05}
                  onWert={(next) => setOverrides({ ...overrides, [key]: next ?? 0 })}
                />
                <button
                  type="button"
                  className="knopf"
                  onClick={() => {
                    const rest = { ...overrides };
                    delete rest[key];
                    setOverrides(rest);
                  }}
                >
                  zurück aufs Preset
                </button>
              </div>
            );
          })}
        </Feldreihe>
      )}
      {offen.length > 0 ? (
        <WahlFeld
          legende="Abweichung hinzufügen"
          wert=""
          optionen={[
            { wert: '', name: '– wählen –' },
            ...offen.map((key) => ({ wert: key, name: key })),
          ]}
          onWert={(key) => {
            if (key) setOverrides({ ...overrides, [key]: basis[key] ?? 0 });
          }}
        />
      ) : null}
    </div>
  );
}

function Zeitleiste({
  entwurf,
  setEntwurf,
  akustik,
  importe,
}: {
  entwurf: Scene;
  setEntwurf(next: Scene): void;
  akustik: Acoustics | null;
  importe: SoundRow[];
}): React.JSX.Element {
  const klaenge = entwurf.timeline
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => istBett(entry) || istEreignis(entry));

  return (
    <Platte
      titel="Zeitleiste"
      zaehler={`${zahl(klaenge.filter(({ entry }) => istBett(entry)).length)} Betten · ${zahl(
        klaenge.filter(({ entry }) => istEreignis(entry)).length,
      )} Ereignisse`}
      erklaerung="Ein Bett ist eine durchgehende Umgebung und darf nie auf Sprechlautstärke; ein Ereignis darf das Lauteste im Raum sein."
      randlos
    >
      {klaenge.length === 0 ? (
        <Zustand art="leer" text="Nur Sprache — kein Bett, kein Ereignis." />
      ) : (
        klaenge.map(({ entry, index }) => (
          <Eintrag
            key={index}
            entry={entry as AmbienceEntry | SfxEntry}
            akustik={akustik}
            importe={importe}
            aendern={(patch) => setEntwurf(eintragAendern(entwurf, index, patch))}
            entfernen={() => setEntwurf(eintragEntfernen(entwurf, index))}
          />
        ))
      )}
      <div className="platte-leib reihe" style={{ borderTop: '1px solid var(--ton-kante)' }}>
        <button
          type="button"
          className="knopf"
          onClick={() => setEntwurf(eintragHinzufuegen(entwurf, 'ambience'))}
        >
          Bett hinzufügen
        </button>
        <button
          type="button"
          className="knopf"
          onClick={() => setEntwurf(eintragHinzufuegen(entwurf, 'sfx'))}
        >
          Ereignis hinzufügen
        </button>
      </div>
    </Platte>
  );
}

function Eintrag({
  entry,
  akustik,
  importe,
  aendern,
  entfernen,
}: {
  entry: AmbienceEntry | SfxEntry;
  akustik: Acoustics | null;
  importe: SoundRow[];
  aendern(patch: Partial<AmbienceEntry> | Partial<SfxEntry>): void;
  entfernen(): void;
}): React.JSX.Element {
  const bett = entry.type === 'ambience';
  return (
    <div className="klang-eintrag">
      <div className="reihe klang-kopf">
        <Marke ton={bett ? 'ruhig' : 'messung'}>{bett ? 'Bett' : 'Ereignis'}</Marke>
        <button type="button" className="knopf" onClick={entfernen}>
          Eintrag entfernen
        </button>
      </div>

      <Klangquelle
        sound={entry.sound}
        importe={importe}
        setSound={(sound) => aendern({ sound } as Partial<AmbienceEntry>)}
      />

      {bett ? (
        <Feldreihe spalten="9rem">
          <ZahlFeld
            legende="Pegel"
            einheit="dB"
            hinweis="−40 bis −6"
            wert={(entry as AmbienceEntry).gain_db}
            min={-40}
            max={-6}
            schritt={0.5}
            onWert={(gain_db) => aendern({ gain_db: gain_db ?? -24 })}
          />
          <ZahlFeld
            legende="Ab"
            einheit="ms"
            wert={(entry as AmbienceEntry).start_ms}
            min={0}
            schritt={100}
            onWert={(start_ms) => aendern({ start_ms: start_ms ?? 0 })}
          />
          <ZahlFeld
            legende="Bis"
            einheit="ms"
            hinweis="Leer: bis zum Ende."
            wert={(entry as AmbienceEntry).end_ms}
            min={0}
            schritt={100}
            leerErlaubt
            onWert={(end_ms) => aendern({ end_ms })}
          />
          <ZahlFeld
            legende="Einblende"
            einheit="ms"
            wert={(entry as AmbienceEntry).fade_in_ms}
            min={0}
            max={10000}
            schritt={50}
            onWert={(fade_in_ms) => aendern({ fade_in_ms: fade_in_ms ?? 0 })}
          />
          <ZahlFeld
            legende="Ausblende"
            einheit="ms"
            wert={(entry as AmbienceEntry).fade_out_ms}
            min={0}
            max={10000}
            schritt={50}
            onWert={(fade_out_ms) => aendern({ fade_out_ms: fade_out_ms ?? 0 })}
          />
        </Feldreihe>
      ) : (
        <>
          <Feldreihe spalten="9rem">
            <ZahlFeld
              legende="Pegel"
              einheit="dB"
              hinweis="−40 bis 0"
              wert={(entry as SfxEntry).gain_db}
              min={-40}
              max={0}
              schritt={0.5}
              onWert={(gain_db) => aendern({ gain_db: gain_db ?? -18 })}
            />
            <ZahlFeld
              legende="Bei"
              einheit="ms"
              wert={(entry as SfxEntry).at_ms}
              min={0}
              schritt={100}
              onWert={(at_ms) => aendern({ at_ms: at_ms ?? 0 })}
            />
          </Feldreihe>
          <Ort
            placement={(entry as SfxEntry).placement}
            akustik={akustik}
            setPlacement={(placement) => aendern({ placement } as Partial<SfxEntry>)}
          />
        </>
      )}
      {bett ? (
        <p className="feld-hinweis">
          Ein Bett hat keine Position: Scene v1 kennt <code className="pfad">placement</code> nur
          für Sprache und Ereignisse. Eine Umgebung ist überall.
        </p>
      ) : null}
    </div>
  );
}

function Klangquelle({
  sound,
  importe,
  setSound,
}: {
  sound: Sound;
  importe: SoundRow[];
  setSound(next: Sound): void;
}): React.JSX.Element {
  const referenz = isAssetRef(sound);
  const gewaehlt = referenz ? importe.find((row) => klangSha(row) === sound.ref) : undefined;

  return (
    <div className="klangquelle">
      <div className="reihe">
        <button
          type="button"
          className={referenz ? 'knopf knopf-signal' : 'knopf'}
          aria-pressed={referenz}
          onClick={() => {
            if (referenz) return;
            const erster = importe[0];
            setSound({
              ref: erster ? klangSha(erster) : '',
              source_start_ms: 0,
              source_duration_ms: null,
            });
          }}
        >
          Aus der Klangbibliothek
        </button>
        <button
          type="button"
          className={referenz ? 'knopf' : 'knopf knopf-signal'}
          aria-pressed={!referenz}
          onClick={() => {
            if (!referenz) return;
            setSound({
              prompt: '',
              negative_prompt: null,
              seed: 0,
              duration_seconds: null,
              params: {},
            });
          }}
        >
          Als Beschreibung
        </button>
      </div>

      {referenz ? (
        <>
          <Feldreihe spalten="14rem">
            <WahlFeld
              legende="Aufnahme"
              hinweis={
                gewaehlt
                  ? `${gewaehlt.uploader ?? '–'} · ${gewaehlt.license ?? '–'}`
                  : 'Diese Kennung ist in der Bibliothek nicht zu finden.'
              }
              wert={sound.ref}
              optionen={[
                ...(gewaehlt ? [] : [{ wert: sound.ref, name: `${kurzSha(sound.ref)} (unbekannt)` }]),
                ...importe.map((row) => ({
                  wert: klangSha(row),
                  name: `${row.title ?? klangSha(row)} · ${sekunden((row.duration_seconds ?? 0) * 1000)}`,
                })),
              ]}
              onWert={(ref) => setSound({ ...sound, ref })}
            />
            <ZahlFeld
              legende="Ausschnitt ab"
              einheit="ms"
              wert={sound.source_start_ms}
              min={0}
              schritt={100}
              onWert={(source_start_ms) => setSound({ ...sound, source_start_ms: source_start_ms ?? 0 })}
            />
            <ZahlFeld
              legende="Ausschnittlänge"
              einheit="ms"
              hinweis="Leer: bis zum Ende der Aufnahme."
              wert={sound.source_duration_ms}
              min={1}
              schritt={100}
              leerErlaubt
              onWert={(source_duration_ms) => setSound({ ...sound, source_duration_ms })}
            />
          </Feldreihe>
          {gewaehlt ? <Welle peaks={gewaehlt.peaks} titel={gewaehlt.title ?? 'Aufnahme'} /> : null}
        </>
      ) : (
        <>
          <SkriptFeld
            legende="Beschreibung"
            hinweis="Was zu hören sein soll. Der Generator bekommt genau diesen Text."
            wert={sound.prompt}
            zeilen={2}
            platzhalter="z. B. ruhiges Café, Geschirr in der Ferne, keine Stimmen"
            onWert={(prompt) => setSound({ ...sound, prompt })}
          />
          <Feldreihe spalten="10rem">
            <Feld
              legende="Ausschluss"
              hinweis="Was nicht drin sein darf."
              wert={sound.negative_prompt ?? ''}
              onWert={(text) => setSound({ ...sound, negative_prompt: text.trim() ? text : null })}
            />
            <ZahlFeld
              legende="Seed"
              wert={sound.seed}
              min={0}
              onWert={(seed) => setSound({ ...sound, seed: seed ?? 0 })}
            />
            <ZahlFeld
              legende="Länge"
              einheit="s"
              hinweis="Leer: die natürliche Länge des Generators."
              wert={sound.duration_seconds}
              min={0.1}
              schritt={0.1}
              leerErlaubt
              onWert={(duration_seconds) => setSound({ ...sound, duration_seconds })}
            />
          </Feldreihe>
        </>
      )}
    </div>
  );
}

function Ort({
  placement,
  akustik,
  setPlacement,
}: {
  placement: { device: string | null; distance: number; pan: number } | null;
  akustik: Acoustics | null;
  setPlacement(next: { device: string | null; distance: number; pan: number } | null): void;
}): React.JSX.Element {
  if (placement === null) {
    return (
      <div className="reihe">
        <span className="entfernt feld-hinweis">
          Referenzposition: mittig, ein Meter, ohne Gerät.
        </span>
        <button
          type="button"
          className="knopf"
          onClick={() => setPlacement({ device: null, distance: 1, pan: 0 })}
        >
          Ort setzen
        </button>
      </div>
    );
  }
  return (
    <>
      <Feldreihe spalten="11rem">
        <Regler
          legende="Panorama"
          wert={placement.pan}
          onWert={(pan) => setPlacement({ ...placement, pan })}
        />
        <ZahlFeld
          legende="Abstand"
          einheit="×"
          hinweis="1 ist die Referenz."
          wert={placement.distance}
          min={0}
          schritt={0.05}
          onWert={(distance) => setPlacement({ ...placement, distance: distance ?? 1 })}
        />
        <WahlFeld
          legende="Gerät"
          hinweis={akustik?.devices.find((row) => row.id === placement.device)?.note || undefined}
          disabled={akustik === null}
          wert={placement.device ?? ''}
          optionen={[
            { wert: '', name: '– direkt im Raum –' },
            ...(akustik?.devices ?? []).map((row) => ({
              wert: row.id,
              name: `${row.label} · v${row.version}`,
            })),
          ]}
          onWert={(device) => setPlacement({ ...placement, device: device || null })}
        />
      </Feldreihe>
      <button type="button" className="knopf" onClick={() => setPlacement(null)}>
        Ort zurücksetzen
      </button>
    </>
  );
}
