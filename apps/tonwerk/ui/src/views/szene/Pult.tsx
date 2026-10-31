/**
 * Das Pult — the mixing desk: one channel strip per line, one per bed.
 *
 * **It edits the draft, not the render.** Everything above it in Mischung is measured from the
 * render of the saved bytes; the pult writes the document, like every other field in the editor,
 * and a change is heard only after it is saved and rendered again. The panel says so, rather than
 * leaving a moved fader to look as if it had done nothing.
 *
 * **A strip carries what this desk can set, and nothing it cannot.** A line has a level against the
 * other lines, three fixed equalizer bands and a send into the scene's room; a bed has how far it
 * drops under speech. The band filters, compressor and crusher of an effects chain are kept when a
 * strip is moved — they are the scene's, not this panel's to drop.
 *
 * **Zero is not a value written down.** `mischungSetzen` removes a field that returns to neutral,
 * so moving a fader and moving it back leaves a scene that does not read as changed.
 */
import { NumberInput } from '@vitavision/ui';
import { Platte } from '../../components/Platte';
import { mischungSetzen, type Mischwerte } from '../../scene-draft';
import type { AmbienceEntry, Scene, SpeechEntry } from '@da/schema/audio-scene';

const SPRACHE_PEGEL = { min: -24, max: 6 };
const BAND = { min: -12, max: 12 };
const DUCKING = { min: -30, max: 0 };

export function Pult({
  entwurf,
  setEntwurf,
  bearbeitbar,
}: {
  entwurf: Scene;
  setEntwurf(next: Scene): void;
  bearbeitbar: boolean;
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
      erklaerung="Pegel, Klang und Raumanteil jeder Zeile, und wie weit ein Bett unter Sprache absinkt. Das Pult ändert den Entwurf: zu hören ist eine Änderung erst nach Speichern und neuem Rendern."
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
}: {
  name: string;
  text: string | undefined;
  entry: SpeechEntry;
  bearbeitbar: boolean;
  setzen(werte: Mischwerte): void;
}): React.JSX.Element {
  const eq = entry.effects?.eq;
  return (
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
    </tr>
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
