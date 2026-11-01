/**
 * Der Ort — where a line or an event sits: pan, distance, and the device it is heard through.
 *
 * **A device's numbers can be changed for this placement only.** Beside the device picker sit its
 * band edges, level and room send, each showing the device's own value. Leaving a field empty, or
 * typing the device's number, is no override, so a placement reads as changed only while it really
 * departs from the device (`abweichungSetzen`). Picking another device drops the overrides, which
 * were numbers against the old one. Anything deeper than these four is a different device and
 * belongs in `data/acoustic-profiles.yaml`.
 */
import { Button } from '@vitavision/ui';
import type { Placement } from '@da/schema/audio-scene';
import { Feldreihe, Regler, WahlFeld, WertFeld, ZahlFeld } from '../../components/Feld';
import type { Acoustics } from '../../contracts';
import { abweichungSetzen, geraetWechseln, type Abweichung } from '../../scene-draft';

const ABWEICHUNGEN: readonly {
  feld: Abweichung;
  legende: string;
  einheit: string;
  min: number;
  max: number;
  schritt: number;
}[] = [
  {
    feld: 'highpass_hz',
    legende: 'Geräte-Hochpass',
    einheit: 'Hz',
    min: 1,
    max: 24000,
    schritt: 10,
  },
  {
    feld: 'lowpass_hz',
    legende: 'Geräte-Tiefpass',
    einheit: 'Hz',
    min: 1,
    max: 24000,
    schritt: 100,
  },
  { feld: 'gain_db', legende: 'Gerätepegel', einheit: 'dB', min: -40, max: 12, schritt: 0.5 },
  {
    feld: 'room_send_db',
    legende: 'Geräte-Raumanteil',
    einheit: 'dB',
    min: -12,
    max: 12,
    schritt: 0.5,
  },
];

export function Ort({
  placement,
  akustik,
  setPlacement,
}: {
  placement: Placement | null;
  akustik: Acoustics | null;
  setPlacement(next: Placement | null): void;
}): React.JSX.Element {
  if (placement === null) {
    return (
      <div className="reihe">
        <span className="entfernt feld-hinweis">
          Referenzposition: mittig, ein Meter, ohne Gerät.
        </span>
        <Button size="sm" onClick={() => setPlacement({ device: null, distance: 1, pan: 0 })}>
          Ort setzen
        </Button>
      </div>
    );
  }
  const geraet = akustik?.devices.find((row) => row.id === placement.device);
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
          hinweis={geraet?.note || undefined}
          disabled={akustik === null}
          wert={placement.device ?? ''}
          optionen={[
            { wert: '', name: '– direkt im Raum –' },
            ...(akustik?.devices ?? []).map((row) => ({
              wert: row.id,
              name: `${row.label} · v${row.version}`,
            })),
          ]}
          onWert={(device) => setPlacement(geraetWechseln(placement, device || null))}
        />
      </Feldreihe>
      {placement.device ? (
        <Feldreihe spalten="9rem">
          {ABWEICHUNGEN.map(({ feld, legende, einheit, min, max, schritt }) => {
            const eigen = geraet?.[feld];
            return (
              <WertFeld
                key={feld}
                legende={legende}
                einheit={einheit}
                hinweis={
                  eigen === null ? 'Das Gerät hat keinen; ein Wert fügt ihn hinzu.' : undefined
                }
                platzhalter={eigen === undefined || eigen === null ? '' : `${eigen}`}
                wert={placement.device_overrides?.[feld] ?? null}
                min={min}
                max={max}
                schritt={schritt}
                onWert={(wert) => setPlacement(abweichungSetzen(placement, feld, wert, geraet))}
              />
            );
          })}
        </Feldreihe>
      ) : null}
      {placement.device ? (
        <p className="feld-hinweis">
          Leer heißt: wie das Gerät. Ein anderes Gerät verwirft diese Abweichungen.
        </p>
      ) : null}
      <Button size="sm" onClick={() => setPlacement(null)}>
        Ort zurücksetzen
      </Button>
    </>
  );
}
