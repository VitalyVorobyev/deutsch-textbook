/**
 * Das Pult — the mixing desk: one channel strip per line, one per bed.
 *
 * **It edits the draft, not the render.** Everything above it in Mischung is measured from the
 * render of the saved bytes; the pult writes the document, like every other field in the editor,
 * and a change is heard only after it is saved and rendered again. The panel says so, rather than
 * leaving a moved fader to look as if it had done nothing.
 *
 * **A strip carries the whole insert chain, folded.** A line has a level against the other lines,
 * three fixed equalizer bands and a send into the scene's room in its row; its place (pan,
 * distance, the device it is heard through and that device's overrides, `Ort`) and its inserts —
 * high-pass, low-pass, compressor, crusher, in the order the renderer applies them — open in a row
 * beneath it, because ten more columns would push the script off the screen. An insert is switched on at a
 * gentle start (`INSERT_START`) and switched off by removing it, never by zeroing its numbers. A
 * bed has how far it drops under speech.
 *
 * **Zero is not a value written down.** `mischungSetzen` removes a field that returns to neutral,
 * so moving a fader and moving it back leaves a scene that does not read as changed.
 */
import { Button, NumberInput, Switch } from '@vitavision/ui';
import { useState } from 'react';
import { Platte } from '../../components/Platte';
import type { Acoustics } from '../../contracts';
import { INSERT_START, eintragAendern, mischungSetzen, type Mischwerte } from '../../scene-draft';
import type {
  AmbienceEntry,
  BandFilter,
  Compression,
  Crush,
  Placement,
  Scene,
  SfxEntry,
  SpeechEntry,
} from '@da/schema/audio-scene';
import { Ort } from './Ort';

const SPRACHE_PEGEL = { min: -24, max: 6 };
const BAND = { min: -12, max: 12 };
const DUCKING = { min: -30, max: 0 };

export function Pult({
  entwurf,
  setEntwurf,
  bearbeitbar,
  akustik,
}: {
  entwurf: Scene;
  setEntwurf(next: Scene): void;
  bearbeitbar: boolean;
  /** The device catalog, for each line's device and what an override departs from. */
  akustik: Acoustics | null;
}): React.JSX.Element {
  const texte = new Map(entwurf.script.map((zeile) => [zeile.id, zeile] as const));
  const setzen = (index: number, werte: Mischwerte): void =>
    setEntwurf(mischungSetzen(entwurf, index, werte));

  const zeilen = entwurf.timeline.flatMap((entry, index) =>
    entry.type === 'speech' ? [{ entry, index }] : [],
  );
  const betten = entwurf.timeline.flatMap((entry, index) =>
    entry.type === 'ambience' ? [{ entry, index }] : [],
  );

  return (
    <Platte
      titel="Pult"
      zaehler={`${zeilen.length} Zeilen · ${betten.length} Betten`}
      erklaerung="Pegel, Klang, Raumanteil, Ort mit Gerät und Inserts jeder Zeile, und wie weit ein Bett unter Sprache absinkt. Das Pult ändert den Entwurf: zu hören ist eine Änderung erst nach Speichern und neuem Rendern."
      randlos
    >
      <div className="tabelle-rahmen">
        <table className="tabelle pult">
          <thead>
            <tr>
              <th scope="col">Zeile</th>
              <th scope="col">Pegel dB</th>
              <th scope="col">Tiefen dB</th>
              <th scope="col">Mitten dB</th>
              <th scope="col">Höhen dB</th>
              <th scope="col">Raum dB</th>
              <th scope="col">Ort · Inserts</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map(({ entry, index }) => {
              const zeile = texte.get(entry.utterance_id);
              const name = `${entry.utterance_id}${zeile ? ` · ${zeile.role}` : ''}`;
              return (
                <Kanal
                  key={`${index}-${entry.utterance_id}`}
                  name={name}
                  text={zeile?.display_text}
                  entry={entry}
                  bearbeitbar={bearbeitbar}
                  setzen={(werte) => setzen(index, werte)}
                  akustik={akustik}
                  setPlacement={(placement) =>
                    setEntwurf(eintragAendern(entwurf, index, { placement } as Partial<SfxEntry>))
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {betten.length > 0 ? (
        <div className="tabelle-rahmen">
          <table className="tabelle pult">
            <thead>
              <tr>
                <th scope="col">Bett</th>
                <th scope="col">Ducking dB</th>
              </tr>
            </thead>
            <tbody>
              {betten.map(({ entry, index }, nummer) => (
                <Bett
                  key={index}
                  name={`Bett ${nummer + 1}`}
                  entry={entry}
                  bearbeitbar={bearbeitbar}
                  setzen={(werte) => setzen(index, werte)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Platte>
  );
}

function Kanal({
  name,
  text,
  entry,
  bearbeitbar,
  setzen,
  akustik,
  setPlacement,
}: {
  name: string;
  text: string | undefined;
  entry: SpeechEntry;
  bearbeitbar: boolean;
  setzen(werte: Mischwerte): void;
  akustik: Acoustics | null;
  setPlacement(next: Placement | null): void;
}): React.JSX.Element {
  const eq = entry.effects?.eq;
  const geraet = entry.placement?.device
    ? (akustik?.devices.find((row) => row.id === entry.placement?.device)?.label ??
      entry.placement.device)
    : null;
  const [offen, setOffen] = useState(false);
  const aktiv = (['highpass', 'lowpass', 'compression', 'crush'] as const).filter(
    (name) => entry.effects?.[name] != null,
  ).length;
  return (
    <>
      <tr>
        <th scope="row">
          <div className="pult-zeile">
            <span className="zahl">{name}</span>
            {text ? <span className="skript pult-text">{text}</span> : null}
          </div>
        </th>
        <td>
          <Regler
            label={`${name}: Pegel`}
            wert={entry.gain_db ?? 0}
            grenzen={SPRACHE_PEGEL}
            bearbeitbar={bearbeitbar}
            setzen={(gain_db) => setzen({ gain_db })}
          />
        </td>
        <td>
          <Regler
            label={`${name}: Tiefen`}
            wert={eq?.low_db ?? 0}
            grenzen={BAND}
            bearbeitbar={bearbeitbar}
            setzen={(low_db) => setzen({ eq: { low_db } })}
          />
        </td>
        <td>
          <Regler
            label={`${name}: Mitten`}
            wert={eq?.mid_db ?? 0}
            grenzen={BAND}
            bearbeitbar={bearbeitbar}
            setzen={(mid_db) => setzen({ eq: { mid_db } })}
          />
        </td>
        <td>
          <Regler
            label={`${name}: Höhen`}
            wert={eq?.high_db ?? 0}
            grenzen={BAND}
            bearbeitbar={bearbeitbar}
            setzen={(high_db) => setzen({ eq: { high_db } })}
          />
        </td>
        <td>
          <Regler
            label={`${name}: Raum`}
            wert={entry.effects?.room_send_db ?? 0}
            grenzen={BAND}
            bearbeitbar={bearbeitbar}
            setzen={(room_send_db) => setzen({ room_send_db })}
          />
        </td>
        <td>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={offen}
            aria-label={`${name}: Ort und Inserts`}
            onClick={() => setOffen(!offen)}
          >
            {geraet ?? 'direkt'} · {aktiv > 0 ? `${aktiv} an` : 'keine'} {offen ? '▴' : '▾'}
          </Button>
        </td>
      </tr>
      {offen ? (
        <tr className="pult-inserts">
          <td colSpan={7}>
            <fieldset className="pult-ort" aria-label={`${name}: Ort`} disabled={!bearbeitbar}>
              <Ort placement={entry.placement} akustik={akustik} setPlacement={setPlacement} />
            </fieldset>
            <Inserts name={name} entry={entry} bearbeitbar={bearbeitbar} setzen={setzen} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

const HZ = { min: 20, max: 20000 };
const FLANKEN = { min: 1, max: 6 };

/**
 * The insert chain of one line, in signal order. Each insert is whole or absent: the switch writes
 * its start values or removes it, and its numbers edit the object in place.
 */
function Inserts({
  name,
  entry,
  bearbeitbar,
  setzen,
}: {
  name: string;
  entry: SpeechEntry;
  bearbeitbar: boolean;
  setzen(werte: Mischwerte): void;
}): React.JSX.Element {
  const effekte = entry.effects;
  return (
    <div className="pult-insertreihe">
      <Band
        titel="Hochpass"
        name={name}
        wert={effekte?.highpass ?? null}
        start={INSERT_START.highpass}
        bearbeitbar={bearbeitbar}
        setzen={(highpass) => setzen({ highpass })}
      />
      <Band
        titel="Tiefpass"
        name={name}
        wert={effekte?.lowpass ?? null}
        start={INSERT_START.lowpass}
        bearbeitbar={bearbeitbar}
        setzen={(lowpass) => setzen({ lowpass })}
      />
      <Insert
        titel="Kompressor"
        name={name}
        an={effekte?.compression != null}
        bearbeitbar={bearbeitbar}
        schalten={(an) => setzen({ compression: an ? { ...INSERT_START.compression } : null })}
      >
        {effekte?.compression ? (
          <KompressorFelder
            name={name}
            wert={effekte.compression}
            bearbeitbar={bearbeitbar}
            setzen={(compression) => setzen({ compression })}
          />
        ) : null}
      </Insert>
      <Insert
        titel="Crusher"
        name={name}
        an={effekte?.crush != null}
        bearbeitbar={bearbeitbar}
        schalten={(an) => setzen({ crush: an ? { ...INSERT_START.crush } : null })}
      >
        {effekte?.crush ? (
          <CrusherFelder
            name={name}
            wert={effekte.crush}
            bearbeitbar={bearbeitbar}
            setzen={(crush) => setzen({ crush })}
          />
        ) : null}
      </Insert>
    </div>
  );
}

function Insert({
  titel,
  name,
  an,
  bearbeitbar,
  schalten,
  children,
}: {
  titel: string;
  name: string;
  an: boolean;
  bearbeitbar: boolean;
  schalten(an: boolean): void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <fieldset className="pult-insert" aria-label={`${name}: ${titel}`}>
      <Switch checked={an} onCheckedChange={schalten} label={titel} disabled={!bearbeitbar} />
      {children}
    </fieldset>
  );
}

function Band({
  titel,
  name,
  wert,
  start,
  bearbeitbar,
  setzen,
}: {
  titel: string;
  name: string;
  wert: BandFilter | null;
  start: BandFilter;
  bearbeitbar: boolean;
  setzen(next: BandFilter | null): void;
}): React.JSX.Element {
  return (
    <Insert
      titel={titel}
      name={name}
      an={wert !== null}
      bearbeitbar={bearbeitbar}
      schalten={(an) => setzen(an ? { ...start } : null)}
    >
      {wert ? (
        <>
          <Feld
            label={`${name}: ${titel} Hz`}
            text="Hz"
            wert={wert.hz}
            grenzen={HZ}
            schritt={10}
            stellen={0}
            neutral={start.hz}
            bearbeitbar={bearbeitbar}
            setzen={(hz) => setzen({ ...wert, hz })}
          />
          <Feld
            label={`${name}: ${titel} Flanken`}
            text="× 12 dB/Okt."
            wert={wert.sections}
            grenzen={FLANKEN}
            schritt={1}
            stellen={0}
            neutral={start.sections}
            bearbeitbar={bearbeitbar}
            setzen={(sections) => setzen({ ...wert, sections })}
          />
        </>
      ) : null}
    </Insert>
  );
}

function KompressorFelder({
  name,
  wert,
  bearbeitbar,
  setzen,
}: {
  name: string;
  wert: Compression;
  bearbeitbar: boolean;
  setzen(next: Compression): void;
}): React.JSX.Element {
  const start = INSERT_START.compression;
  const feld = (
    feldname: keyof Compression,
    text: string,
    grenzen: { min: number; max: number },
    schritt: number,
  ) => (
    <Feld
      key={feldname}
      label={`${name}: Kompressor ${text}`}
      text={text}
      wert={wert[feldname]}
      grenzen={grenzen}
      schritt={schritt}
      stellen={schritt < 1 ? 1 : 0}
      neutral={start[feldname]}
      bearbeitbar={bearbeitbar}
      setzen={(zahl) => setzen({ ...wert, [feldname]: zahl })}
    />
  );
  return (
    <>
      {feld('threshold_db', 'Schwelle dB', { min: -60, max: 0 }, 1)}
      {feld('ratio', 'Verhältnis', { min: 1, max: 20 }, 0.5)}
      {feld('attack_ms', 'Attack ms', { min: 0.1, max: 2000 }, 1)}
      {feld('release_ms', 'Release ms', { min: 1, max: 9000 }, 10)}
      {feld('makeup_db', 'Make-up dB', { min: 0, max: 36 }, 0.5)}
    </>
  );
}

function CrusherFelder({
  name,
  wert,
  bearbeitbar,
  setzen,
}: {
  name: string;
  wert: Crush;
  bearbeitbar: boolean;
  setzen(next: Crush): void;
}): React.JSX.Element {
  return (
    <>
      <Feld
        label={`${name}: Crusher Bits`}
        text="Bits"
        wert={wert.bits}
        grenzen={{ min: 1, max: 64 }}
        schritt={1}
        stellen={0}
        neutral={INSERT_START.crush.bits}
        bearbeitbar={bearbeitbar}
        setzen={(bits) => setzen({ ...wert, bits })}
      />
      <Feld
        label={`${name}: Crusher Anteil`}
        text="Anteil"
        wert={wert.mix}
        grenzen={{ min: 0, max: 1 }}
        schritt={0.05}
        stellen={2}
        neutral={INSERT_START.crush.mix}
        bearbeitbar={bearbeitbar}
        setzen={(mix) => setzen({ ...wert, mix })}
      />
    </>
  );
}

/** One number of an insert, labelled beside it; empty goes back to the insert's start value. */
function Feld({
  label,
  text,
  wert,
  grenzen,
  schritt,
  stellen,
  neutral,
  bearbeitbar,
  setzen,
}: {
  label: string;
  text: string;
  wert: number;
  grenzen: { min: number; max: number };
  schritt: number;
  stellen: number;
  neutral: number;
  bearbeitbar: boolean;
  setzen(next: number): void;
}): React.JSX.Element {
  return (
    <span className="pult-feld">
      <NumberInput
        aria-label={label}
        className="pult-zahl"
        value={wert}
        min={grenzen.min}
        max={grenzen.max}
        step={schritt}
        precision={stellen}
        disabled={!bearbeitbar}
        onValueChange={setzen}
        onClear={() => setzen(neutral)}
      />
      <span className="pult-einheit">{text}</span>
    </span>
  );
}

function Bett({
  name,
  entry,
  bearbeitbar,
  setzen,
}: {
  name: string;
  entry: AmbienceEntry;
  bearbeitbar: boolean;
  setzen(werte: Mischwerte): void;
}): React.JSX.Element {
  const beschreibung =
    'prompt' in entry.sound ? entry.sound.prompt : `Bibliothek ${entry.sound.ref.slice(0, 8)}`;
  return (
    <tr>
      <th scope="row">
        <div className="pult-zeile">
          <span className="zahl">{name}</span>
          <span className="entfernt pult-text">{beschreibung}</span>
        </div>
      </th>
      <td>
        <Regler
          label={`${name}: Ducking`}
          wert={entry.duck_db ?? 0}
          grenzen={DUCKING}
          bearbeitbar={bearbeitbar}
          setzen={(duck_db) => setzen({ duck_db })}
        />
      </td>
    </tr>
  );
}

/** One number on a strip: dB, bounded by the contract, and empty means back to neutral. */
function Regler({
  label,
  wert,
  grenzen,
  bearbeitbar,
  setzen,
}: {
  label: string;
  wert: number;
  grenzen: { min: number; max: number };
  bearbeitbar: boolean;
  setzen(next: number): void;
}): React.JSX.Element {
  return (
    <NumberInput
      aria-label={label}
      className="pult-zahl"
      value={wert}
      min={grenzen.min}
      max={grenzen.max}
      step={0.5}
      precision={1}
      disabled={!bearbeitbar}
      onValueChange={setzen}
      onClear={() => setzen(0)}
    />
  );
}
