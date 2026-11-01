/**
 * Der Raum, für diese Szene verändert: send level, decay, pre-delay and damping.
 *
 * **Each field shows the room's own value**, and leaving it empty or typing that value is no
 * override, so a scene reads as changed only while it really departs from the room
 * (`raumAbweichungSetzen`) — the rule a device override keeps in `Ort`. Picking another room drops
 * the overrides. The seed and the early reflections are not here: they are what makes the room
 * *that* room, and changing them is a new room in `data/acoustic-profiles.yaml`.
 */
import type { SceneAcoustics } from '@da/schema/audio-scene';
import { Feldreihe, WertFeld } from '../../components/Feld';
import type { Acoustics } from '../../contracts';
import { raumAbweichungSetzen, type RaumAbweichung } from '../../scene-draft';

/** The scene model's bounds on each field, so the field reports nothing the engine refuses. */
const ABWEICHUNGEN: readonly {
  feld: RaumAbweichung;
  legende: string;
  einheit?: string;
  hinweis: string;
  min: number;
  max: number;
  schritt: number;
}[] = [
  {
    feld: 'wet',
    legende: 'Raumanteil',
    hinweis: 'Wie viel Raum zur trockenen Stimme kommt, 0 bis 1.',
    min: 0,
    max: 1,
    schritt: 0.01,
  },
  {
    feld: 'decay_s',
    legende: 'Nachhall',
    einheit: 's',
    hinweis: 'RT60: bis der Hall um 60 dB gefallen ist.',
    min: 0.05,
    max: 10,
    schritt: 0.05,
  },
  {
    feld: 'pre_delay_ms',
    legende: 'Vorverzögerung',
    einheit: 'ms',
    hinweis: 'Bis zur ersten Reflexion; so hört man die Größe.',
    min: 0,
    max: 200,
    schritt: 1,
  },
  {
    feld: 'lowpass_hz',
    legende: 'Dämpfung',
    einheit: 'Hz',
    hinweis: 'Wo der Hall zu dunkeln beginnt.',
    min: 500,
    max: 20000,
    schritt: 100,
  },
];

export function Raumabweichungen({
  acoustics,
  akustik,
  setAcoustics,
}: {
  acoustics: SceneAcoustics;
  akustik: Acoustics;
  setAcoustics(next: SceneAcoustics): void;
}): React.JSX.Element | null {
  if (acoustics.room === null) return null;
  const raum = akustik.rooms.find((row) => row.id === acoustics.room);
  return (
    <>
      <Feldreihe spalten="10rem">
        {ABWEICHUNGEN.map(({ feld, legende, einheit, hinweis, min, max, schritt }) => {
          const eigen = raum?.[feld];
          return (
            <WertFeld
              key={feld}
              legende={legende}
              einheit={einheit}
              hinweis={hinweis}
              platzhalter={eigen === undefined ? '' : `${eigen}`}
              wert={acoustics.room_overrides?.[feld] ?? null}
              min={min}
              max={max}
              schritt={schritt}
              onWert={(wert) =>
                setAcoustics(
                  raumAbweichungSetzen(
                    acoustics,
                    feld,
                    wert !== null && feld === 'pre_delay_ms' ? Math.round(wert) : wert,
                    raum,
                  ),
                )
              }
            />
          );
        })}
      </Feldreihe>
      <p className="feld-hinweis">
        Leer heißt: wie der Raum. Ein anderer Raum verwirft diese Abweichungen.
      </p>
    </>
  );
}
