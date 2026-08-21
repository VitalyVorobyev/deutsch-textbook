/**
 * Figuren — the casting roster.
 *
 * Twelve characters, and the page exists to answer casting questions, so it shows what a casting
 * decision actually turns on: who this person is, which registers they hold, whether they can carry
 * narration alone, who they must not be cast beside, and what they sound like.
 *
 * **The demo is the point, so it is not hidden behind a click-through.** Three phrases per
 * character, the same three for everyone plus one of their own, which is what makes them
 * comparable. They are fetched with the bearer token and played from a blob URL — an `<audio src>`
 * cannot carry a header, and the engine's cookie path is legacy.
 *
 * **An absent portrait is an empty state, not an error.** The roster has to be readable before the
 * portraits are generated; a missing one says so in the frame where it will appear.
 *
 * **Consented cloned voices live on this page too**, under the roster (`Stimmen`). They belong to
 * the same question — who can speak in this course — and putting them elsewhere would have hidden
 * the comparison the demos exist for: a cloned voice is auditioned on the roster's own three
 * phrases, so it can be judged beside the twelve rather than on its own.
 */
import { useCallback, useState } from 'react';
import { Marke, Zustand } from '../components/Platte';
import { zahl } from '../format';
import { useApi, useEngineBlob, useEngineRead } from '../useEngine';
import type { Character } from '../contracts';
import { Stimmen } from './Stimmen';
import { fehlerText } from './fehler';

const REGISTER: Record<string, string> = {
  informal: 'du',
  neutral: 'neutral',
  formal: 'Sie',
};

export function Figuren(): React.JSX.Element {
  const api = useApi();
  const { data, error, laedt } = useEngineRead((signal) => api.characters(signal), [api]);
  // A counter, not a refetch function: `useEngineRead` re-reads when its key list changes, and a
  // key is the only way to say "again" without giving every child a copy of the fetch.
  const [runde, setRunde] = useState(0);
  const neuLesen = useCallback(() => setRunde((wert) => wert + 1), []);
  const stimmen = useEngineRead((signal) => api.voices(signal), [api, runde]);
  // **The last payload is kept while a re-read is in flight**, and this is not a flicker fix.
  // `useEngineRead` blanks its data the moment its keys change, so rendering straight from it would
  // unmount the whole voices subtree on every refresh — and the Klon-Assistent lives in that
  // subtree. Creating a voice asks for a re-read, so the assistant would be destroyed and rebuilt
  // at step one at exactly the moment it has something to show.
  // Adjusted **during render**, not in an effect — `useEngineRead`'s own rule, one layer up: an
  // effect runs one paint too late, so the panel would blank for a frame on every refresh.
  const [letzte, setLetzte] = useState<typeof stimmen.data>(null);
  if (stimmen.data && stimmen.data !== letzte) setLetzte(stimmen.data);
  const gezeigt = stimmen.data ?? letzte;

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">Katalog</span>
        <h1>Figuren</h1>
        <p>
          Die Sprecherinnen und Sprecher des Kurses. Eine Szene bindet eine Figur samt Version, damit
          sie nicht leise die Stimme wechselt, wenn der Katalog weiterzieht.
        </p>
      </header>

      {laedt ? <Zustand art="laedt" text="Katalog wird gelesen …" /> : null}
      {error ? <p className="hinweis hinweis-alarm" role="alert">{fehlerText(error)}</p> : null}

      {data ? (
        <div className="figuren">
          {data.characters.map((character) => (
            <Figur key={character.id} character={character} />
          ))}
        </div>
      ) : null}

      {stimmen.error ? (
        <p className="hinweis hinweis-alarm" role="alert">{fehlerText(stimmen.error)}</p>
      ) : null}
      {gezeigt ? (
        <Stimmen
          voices={gezeigt.voices}
          regeln={gezeigt.rules}
          engines={gezeigt.engines}
          phrasen={gezeigt.demo_phrases}
          neuLesen={neuLesen}
        />
      ) : null}
    </>
  );
}

function Figur({ character }: { character: Character }): React.JSX.Element {
  const portrait = useEngineBlob(character.selected_portrait_url);

  return (
    <article className="platte">
      <div className="figur-kopf">
        {portrait ? (
          <img className="figur-portraet" src={portrait} alt={`Porträt von ${character.display_name}`} />
        ) : (
          <div className="figur-portraet figur-portraet-leer" aria-hidden="true">
            kein Porträt
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h2 className="figur-name">{character.display_name}</h2>
          <p className="zahl entfernt" style={{ fontSize: 'var(--ton-grad-11)' }}>
            {character.id} · v{zahl(character.version)}
          </p>
          <div className="reihe" style={{ gap: 'var(--ton-mass-1)', marginTop: 'var(--ton-mass-2)' }}>
            {character.narration_capable ? (
              <Marke ton="signal" titel="Kann einen Lesetext allein tragen.">Erzählstimme</Marke>
            ) : null}
            <Marke titel="In wie vielen Projekten diese Figur besetzt ist.">
              {zahl(character.usage_count)}× besetzt
            </Marke>
          </div>
        </div>
      </div>

      <div className="platte-leib stapel-eng">
        {character.persona ? <p className="skript" style={{ fontSize: 'var(--ton-grad-14)' }}>{character.persona}</p> : null}

        <div className="reihe" style={{ gap: 'var(--ton-mass-1)' }}>
          {character.registers.map((register) => (
            <Marke key={register} ton="messung">{REGISTER[register] ?? register}</Marke>
          ))}
          {character.age_band ? <Marke>{character.age_band}</Marke> : null}
        </div>

        <dl className="werte" style={{ marginTop: 'var(--ton-mass-2)' }}>
          <div className="wert">
            <dt>Rollen</dt>
            <dd className="leise" style={{ fontSize: 'var(--ton-grad-13)' }}>
              {character.roles.length ? character.roles.join(', ') : '–'}
            </dd>
          </div>
          <div className="wert">
            <dt>Besetzungsmerkmale</dt>
            <dd className="leise" style={{ fontSize: 'var(--ton-grad-13)' }}>
              {character.casting_tags.length ? character.casting_tags.join(', ') : '–'}
            </dd>
          </div>
          <div className="wert">
            <dt>Nicht besetzen mit</dt>
            <dd className="zahl" style={{ fontSize: 'var(--ton-grad-13)', color: character.incompatible_with.length ? 'var(--ton-alarm)' : undefined }}>
              {character.incompatible_with.length ? character.incompatible_with.join(', ') : <span className="leer" />}
            </dd>
          </div>
          <div className="wert">
            <dt>Stimme</dt>
            <dd className="zahl" style={{ fontSize: 'var(--ton-grad-13)' }}>
              {character.voice_profile?.voice ?? '–'}
              {character.voice_profile?.seed === undefined ? '' : ` · Seed ${character.voice_profile.seed}`}
            </dd>
          </div>
        </dl>
      </div>

      {character.demo_urls.length === 0 ? (
        <p className="demo entfernt" style={{ fontSize: 'var(--ton-grad-12)' }}>
          Noch keine Hörprobe erzeugt.
        </p>
      ) : (
        character.demo_urls.map((url, index) => (
          <Hoerprobe key={url} url={url} phrase={character.demo_phrases[index]} nummer={index + 1} />
        ))
      )}
    </article>
  );
}

function Hoerprobe({ url, phrase, nummer }: { url: string; phrase?: string; nummer: number }): React.JSX.Element {
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
