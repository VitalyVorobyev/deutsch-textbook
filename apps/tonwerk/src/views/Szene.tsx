/**
 * Szene — one scene document, read-only.
 *
 * The reviewer's question on this page is always the same: *may this go out?* Everything is
 * arranged to answer it in one pass, in the order a reviewer actually needs:
 *
 * 1. **Was ist das** — identity, kind, stage, and the sha the rest of the page is about.
 * 2. **Besetzung** — who speaks, with the voice and seed that produced them.
 * 3. **Skript** — the German, in the script face, with where each line actually landed once a
 *    render exists. Timing comes from the QA report's `timing`, which is the render manifest's own
 *    measurement; before a render there is nothing to show and nothing is invented.
 * 4. **Zeitleiste, Akustik, Varianten, Renderstände** — the apparatus around the words.
 * 5. **Prüfbericht** and **Freigabe** — what the machine measured and what a person vouched for.
 *
 * **The sha is load-bearing and is repeated on purpose.** `renders` is keyed by `scene.sha256()`,
 * an approval names the bytes it certifies, and QA describes one variant of one revision. A page
 * that showed a render beside a scene it was not made from would be worse than showing nothing.
 */
import { isAssetRef } from '@da/schema/audio-scene';
import type { Scene, TimelineEntry } from '@da/schema/audio-scene';
import { Marke, Platte, Zustand } from '../components/Platte';
import { dauer, dezibel, kurzSha, prozent, sekunden, zahl, zeitpunkt } from '../format';
import { href } from '../router';
import { useApi, useEngineRead } from '../useEngine';
import type { QaReport, SpeakerQa } from '../contracts';
import { fehlerText } from './fehler';

const STUFE: Record<string, string> = {
  draft: 'Entwurf',
  automatically_checked: 'automatisch geprüft',
  human_approved: 'freigegeben',
  exported: 'veröffentlicht',
  declined: 'abgelehnt',
};

export function Szene({ slug }: { slug: string }): React.JSX.Element {
  const api = useApi();
  const { data, error, laedt } = useEngineRead((signal) => api.scene(slug, signal), [api, slug]);

  if (laedt) return <Zustand art="laedt" text={`Szene ${slug} wird gelesen …`} />;
  if (error) {
    return (
      <>
        <header className="kopf">
          <span className="tafel kopf-eyebrow">Szene</span>
          <h1>{slug}</h1>
        </header>
        <p className="hinweis hinweis-alarm" role="alert">{fehlerText(error)}</p>
        <div>
          <a className="knopf" href={href('szenen')}>Zurück zur Liste</a>
        </div>
      </>
    );
  }
  if (!data) return <Zustand art="leer" text="Diese Szene gibt es nicht." />;

  const scene = data.document.scene;
  const takte = new Map((data.qa?.timing ?? []).map((row) => [row.utterance_id, row]));

  return (
    <>
      <header className="kopf">
        <span className="tafel kopf-eyebrow">
          <a href={href('szenen')} style={{ color: 'inherit' }}>Szenen</a> · {data.kind === 'narration' ? 'Narration' : 'Dialog'}
        </span>
        <h1>{data.slug}</h1>
        <p className="skript" style={{ marginTop: 'var(--ton-mass-2)' }}>{scene.title?.en}</p>
      </header>

      {data.document.valid ? null : (
        <p className="hinweis hinweis-alarm" role="alert">
          Dieses Dokument entspricht nicht dem Vertrag Scene v1 — es wird unten nachsichtig gelesen,
          Felder können fehlen. {data.document.problem}
        </p>
      )}

      <Platte titel="Stand" randlos>
        <dl className="werte platte-leib">
          <div className="wert">
            <dt>Stufe</dt>
            <dd>{STUFE[data.stage] ?? data.stage}</dd>
          </div>
          <div className="wert">
            <dt>Revision</dt>
            <dd className="zahl">{data.revision}</dd>
          </div>
          <div className="wert">
            <dt>Szenen-Sha</dt>
            <dd className="zahl" title={data.scene_sha256}>{kurzSha(data.scene_sha256)}</dd>
          </div>
          <div className="wert">
            <dt>Ebene</dt>
            <dd className="zahl">{scene.brief?.level ?? '–'}</dd>
          </div>
          <div className="wert">
            <dt>Aufgabe</dt>
            <dd>{data.exercise ? 'vorhanden' : <span className="leer" />}</dd>
          </div>
          <div className="wert">
            <dt>Autorschaft</dt>
            <dd>{scene.authoring === 'generated' ? 'generiert' : 'von Hand'}</dd>
          </div>
        </dl>
        {scene.brief ? (
          <div className="platte-leib" style={{ borderTop: '1px solid var(--ton-kante)' }}>
            <p className="tafel">Auftrag</p>
            <p className="skript" style={{ marginTop: 'var(--ton-mass-2)' }}>{scene.brief.scenario}</p>
            <div className="reihe" style={{ marginTop: 'var(--ton-mass-3)', gap: 'var(--ton-mass-2)' }}>
              {scene.brief.topic ? <Marke>Thema {scene.brief.topic}</Marke> : null}
              {scene.brief.grammar_target ? <Marke ton="messung">{scene.brief.grammar_target}</Marke> : null}
              {(scene.brief.outcomes ?? []).map((outcome) => (
                <Marke key={outcome} ton="signal">{outcome}</Marke>
              ))}
              {scene.brief.duration_seconds ? (
                <Marke>{scene.brief.duration_seconds[0]}–{scene.brief.duration_seconds[1]} s geplant</Marke>
              ) : null}
            </div>
          </div>
        ) : null}
      </Platte>

      <Besetzung scene={scene} />
      <Skript scene={scene} takte={takte} />
      <Zeitleiste scene={scene} />
      <AkustikUndVarianten scene={scene} renders={data.renders} />
      <Pruefbericht qa={data.qa ?? null} />
      <Freigabe approval={data.approval ?? null} sceneSha={data.scene_sha256} />
    </>
  );
}

function Besetzung({ scene }: { scene: Scene }): React.JSX.Element {
  const cast = scene.cast ?? [];
  return (
    <Platte titel="Besetzung" zaehler={`${zahl(cast.length)} ${cast.length === 1 ? 'Stimme' : 'Stimmen'}`} randlos>
      <div className="tabelle-rahmen">
        <table className="tabelle">
          <thead>
            <tr>
              <th scope="col">Rolle</th>
              <th scope="col">Figur</th>
              <th scope="col">Stimme</th>
              <th scope="col" className="zahl-rechts">Seed</th>
              <th scope="col">Anweisung</th>
            </tr>
          </thead>
          <tbody>
            {cast.map((member) => (
              <tr key={member.role}>
                <td className="zeile-rolle" style={{ padding: 'var(--ton-mass-2) var(--ton-mass-3)' }}>{member.role}</td>
                <td className="zahl leise">
                  {member.character ? (
                    <span title={`Version ${member.character.version} des Katalogs`}>
                      {member.character.id} · v{member.character.version}
                    </span>
                  ) : (
                    <span className="leer" />
                  )}
                </td>
                <td className="zahl">
                  {member.voice?.voice}
                  <span className="entfernt"> · {member.voice?.engine}</span>
                </td>
                <td className="zahl-rechts zahl">{zahl(member.voice?.seed)}</td>
                <td className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>
                  {member.voice?.style ?? <span className="leer" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Platte>
  );
}

function Skript({
  scene,
  takte,
}: {
  scene: Scene;
  takte: Map<string, { start_ms: number; end_ms: number }>;
}): React.JSX.Element {
  const script = scene.script ?? [];
  const gemessen = takte.size > 0;
  return (
    <Platte
      titel="Skript"
      zaehler={`${zahl(script.length)} ${script.length === 1 ? 'Äußerung' : 'Äußerungen'}`}
      erklaerung={
        gemessen
          ? 'Rechts steht, wo jede Äußerung im gerenderten Master tatsächlich liegt — gemessen, nicht geplant.'
          : 'Es gibt noch keinen Render dieser Bytes, also auch keine gemessenen Zeiten.'
      }
      randlos
    >
      {script.map((utterance) => {
        const takt = takte.get(utterance.id);
        return (
          <div className="zeile" key={utterance.id}>
            <div className="zeile-rolle">{utterance.role}</div>
            <div>
              <p className="skript">{utterance.display_text}</p>
              {utterance.synthesis_text ? (
                <p className="zeile-neben">
                  gesprochen: <span className="zahl">{utterance.synthesis_text}</span>
                </p>
              ) : null}
              {(utterance.pronunciation_overrides ?? []).length > 0 ? (
                <p className="zeile-neben">
                  {(utterance.pronunciation_overrides ?? [])
                    .map((row) => `${row.display} → ${row.synthesis}`)
                    .join(' · ')}
                </p>
              ) : null}
            </div>
            <div className="zeile-takt">
              {takt ? (
                <>
                  {dauer(takt.start_ms)}
                  <div className="entfernt">{sekunden(takt.end_ms - takt.start_ms)}</div>
                </>
              ) : (
                <>
                  Tempo {utterance.pace}
                  <div className="entfernt">+{zahl(utterance.pause_after_ms)} ms</div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </Platte>
  );
}

/** What a timeline entry is *of*: a library sound by digest, or a prompt for one not yet made. */
function klang(entry: TimelineEntry): React.JSX.Element {
  if (entry.type === 'speech') return <span className="zahl">{entry.utterance_id}</span>;
  const sound = entry.sound;
  if (!sound) return <span className="leer" />;
  if (isAssetRef(sound)) {
    return (
      <span className="zahl entfernt" title={sound.ref}>
        {kurzSha(sound.ref)}
        {sound.source_start_ms ? ` ab ${sekunden(sound.source_start_ms)}` : ''}
      </span>
    );
  }
  return (
    <span className="skript" style={{ fontSize: 'var(--ton-grad-13)' }} title={`Seed ${sound.seed}`}>
      {sound.prompt}
    </span>
  );
}

function Zeitleiste({ scene }: { scene: Scene }): React.JSX.Element {
  const timeline = scene.timeline ?? [];
  const betten = timeline.filter((entry) => entry.type === 'ambience');
  const ereignisse = timeline.filter((entry) => entry.type === 'sfx');

  return (
    <Platte
      titel="Zeitleiste"
      zaehler={`${zahl(betten.length)} Betten · ${zahl(ereignisse.length)} Ereignisse`}
      erklaerung="Ein Bett ist eine durchgehende Umgebung und darf nie auf Sprechlautstärke; ein Ereignis darf das Lauteste im Raum sein."
      randlos
    >
      {betten.length + ereignisse.length === 0 ? (
        <Zustand art="leer" text="Nur Sprache — kein Bett, kein Ereignis." />
      ) : (
        <div className="tabelle-rahmen">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Art</th>
                <th scope="col">Klang</th>
                <th scope="col" className="zahl-rechts">Ab</th>
                <th scope="col" className="zahl-rechts">Bis</th>
                <th scope="col" className="zahl-rechts">Pegel</th>
                <th scope="col">Ort</th>
              </tr>
            </thead>
            <tbody>
              {[...betten, ...ereignisse].map((entry, index) => (
                <tr key={`${entry.type}-${index}`}>
                  <td>
                    <Marke ton={entry.type === 'ambience' ? 'ruhig' : 'messung'}>
                      {entry.type === 'ambience' ? 'Bett' : 'Ereignis'}
                    </Marke>
                  </td>
                  <td>{klang(entry)}</td>
                  <td className="zahl-rechts zahl">
                    {entry.type === 'ambience' ? dauer(entry.start_ms) : dauer(entry.at_ms)}
                  </td>
                  <td className="zahl-rechts zahl entfernt">
                    {entry.type === 'ambience' ? (entry.end_ms === null ? 'Ende' : dauer(entry.end_ms)) : '–'}
                  </td>
                  <td className="zahl-rechts zahl">{dezibel(entry.gain_db)}</td>
                  <td className="zahl entfernt">
                    {entry.type === 'ambience'
                      ? `${zahl(entry.fade_in_ms)}/${zahl(entry.fade_out_ms)} ms Blende`
                      : ortsangabe(entry.placement)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Platte>
  );
}

function ortsangabe(placement: { device?: string | null; distance?: number; pan?: number } | null | undefined): string {
  if (!placement) return '–';
  const teile = [
    placement.device ?? null,
    placement.distance !== undefined && placement.distance !== 1 ? `Abstand ${placement.distance}` : null,
    placement.pan ? `Pan ${placement.pan}` : null,
  ].filter(Boolean);
  return teile.length ? teile.join(' · ') : 'Referenzposition';
}

function AkustikUndVarianten({
  scene,
  renders,
}: {
  scene: Scene;
  renders: { variant: string; preset?: string | null; rendered: boolean; duration_ms?: number | null; created_at?: string | null; master_sha256?: string | null }[];
}): React.JSX.Element {
  const stand = new Map(renders.map((row) => [row.variant, row]));
  return (
    <Platte
      titel="Akustik und Varianten"
      zaehler={`${zahl(renders.filter((row) => row.rendered).length)} von ${zahl(renders.length)} gerendert`}
      erklaerung="Renderstände gelten nur für genau diese Szenen-Bytes. Nach einer Revision steht hier wieder überall „nicht gerendert“ — das ist richtig so, das alte Audio gehört zu einem anderen Text."
      randlos
    >
      <div className="platte-leib reihe">
        <Marke ton={scene.acoustics?.room ? 'messung' : 'ruhig'}>
          Raum {scene.acoustics?.room ?? 'keiner'}
        </Marke>
        <Marke>Vorlauf {zahl(scene.acoustics?.lead_in_ms ?? 0)} ms</Marke>
      </div>
      {(scene.variants ?? []).length === 0 ? (
        <Zustand art="leer" text="Diese Szene erklärt keine Schwierigkeitsvariante." />
      ) : (
        <div className="tabelle-rahmen">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Variante</th>
                <th scope="col">Preset</th>
                <th scope="col">Abweichungen</th>
                <th scope="col">Render</th>
                <th scope="col" className="zahl-rechts">Länge</th>
                <th scope="col">Master-Sha</th>
                <th scope="col">Erzeugt</th>
              </tr>
            </thead>
            <tbody>
              {(scene.variants ?? []).map((variant) => {
                const row = stand.get(variant.id);
                return (
                  <tr key={variant.id}>
                    <td className="zahl">{variant.id}</td>
                    <td className="leise">{variant.preset ?? <span className="leer" />}</td>
                    <td className="zahl entfernt">
                      {Object.entries(variant.overrides ?? {}).length === 0 ? (
                        <span className="leer" />
                      ) : (
                        Object.entries(variant.overrides ?? {})
                          .map(([key, value]) => `${key}=${value}`)
                          .join(' · ')
                      )}
                    </td>
                    <td>
                      {row?.rendered ? (
                        <Marke ton="messung">gerendert</Marke>
                      ) : (
                        <Marke>nicht gerendert</Marke>
                      )}
                    </td>
                    <td className="zahl-rechts zahl">{row?.rendered ? dauer(row.duration_ms) : <span className="leer" />}</td>
                    <td className="zahl entfernt" title={row?.master_sha256 ?? undefined}>
                      {kurzSha(row?.master_sha256)}
                    </td>
                    <td className="zahl entfernt">{zeitpunkt(row?.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Platte>
  );
}

function Pruefbericht({ qa }: { qa: QaReport | null }): React.JSX.Element {
  if (!qa) {
    return (
      <Platte titel="Prüfbericht">
        <Zustand art="leer" text="Für diese Revision liegt keine automatische Prüfung vor." />
      </Platte>
    );
  }
  const transcripts = qa.transcripts;
  const zeilen = transcripts?.lines ?? [];
  return (
    <Platte
      titel="Prüfbericht"
      zaehler={
        qa.passed === undefined ? undefined : (
          <Marke ton={qa.passed ? 'messung' : 'alarm'}>{qa.passed ? 'bestanden' : 'durchgefallen'}</Marke>
        )
      }
      erklaerung="Was die Maschine gemessen hat: erkannte Wörter gegen erwartete, Stimmkonsistenz und die Klangumgebung. Eine bestandene Prüfung ist keine Freigabe."
      randlos
    >
      <div className="platte-leib reihe">
        <Marke ton={(transcripts?.full_wer ?? 0) > 0.08 ? 'alarm' : 'ruhig'}>
          Gesamt-WER {prozent(transcripts?.full_wer)}
        </Marke>
        {qa.variant ? <Marke>Variante {qa.variant}</Marke> : null}
        {qa.scene_sha256 ? <Marke titel={qa.scene_sha256}>Sha {kurzSha(qa.scene_sha256)}</Marke> : null}
      </div>

      {(transcripts?.failures ?? []).length > 0 ? (
        <ul className="platte-leib stapel-eng" style={{ paddingTop: 0 }}>
          {(transcripts?.failures ?? []).map((failure) => (
            <li key={failure} className="hinweis hinweis-alarm">{failure}</li>
          ))}
        </ul>
      ) : null}

      {zeilen.length > 0 ? (
        <div className="tabelle-rahmen">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Äußerung</th>
                <th scope="col">Erwartet</th>
                <th scope="col">Erkannt</th>
                <th scope="col" className="zahl-rechts">WER</th>
                <th scope="col">Urteil</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((line) => (
                <tr key={line.line_id}>
                  <td className="zahl leise">{line.line_id}</td>
                  <td className="skript" style={{ fontSize: 'var(--ton-grad-13)' }}>{line.expected}</td>
                  <td className="skript entfernt" style={{ fontSize: 'var(--ton-grad-13)' }}>{line.transcript}</td>
                  <td className="zahl-rechts zahl">{prozent(line.wer)}</td>
                  <td>
                    {line.passed ? <Marke ton="messung">ok</Marke> : <Marke ton="alarm">Abweichung</Marke>}
                    {(line.missing_protected ?? []).length > 0 ? (
                      <div className="zeile-neben">fehlt: {(line.missing_protected ?? []).join(', ')}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="platte-leib gitter-2" style={{ borderTop: '1px solid var(--ton-kante)' }}>
        <Sprecherpruefung speaker={qa.speaker_qa} />
        <Klangumgebung soundscape={qa.soundscape} />
      </div>
    </Platte>
  );
}

/**
 * The speaker check has three outcomes and only one of them is a measurement.
 *
 * A missing model and a passing check must never look alike: "nicht gemessen" is a state the
 * reviewer has to act on (install the weights, or accept an unmeasured take), and folding it into a
 * boolean would turn it into a silent pass.
 */
function Sprecherpruefung({ speaker }: { speaker: SpeakerQa | undefined }): React.JSX.Element {
  if (speaker === undefined) {
    return (
      <div>
        <p className="tafel">Stimmkonsistenz</p>
        <p className="leise">Nicht Teil dieses Berichts.</p>
      </div>
    );
  }
  if (typeof speaker === 'string') {
    return (
      <div>
        <p className="tafel">Stimmkonsistenz</p>
        <p className="leise">Nicht gemessen: <span className="zahl">{speaker}</span></p>
      </div>
    );
  }
  return (
    <div>
      <p className="tafel">Stimmkonsistenz</p>
      <ul className="stapel-eng" style={{ marginTop: 'var(--ton-mass-2)' }}>
        {(speaker.characters ?? []).map((character) => (
          <li key={character.speaker} className="reihe" style={{ gap: 'var(--ton-mass-2)' }}>
            <span className="zeile-rolle">{character.speaker}</span>
            <span className="zahl leise">
              {zahl(character.measured_lines)}/{zahl(character.line_count)} gemessen
            </span>
            <span className="zahl">
              min {character.minimum_similarity === null || character.minimum_similarity === undefined ? '–' : character.minimum_similarity.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>
      {(speaker.warnings ?? []).length > 0 ? (
        <p className="hinweis" style={{ marginTop: 'var(--ton-mass-3)' }}>{(speaker.warnings ?? []).join(' · ')}</p>
      ) : null}
      <p className="entfernt" style={{ marginTop: 'var(--ton-mass-2)', fontSize: 'var(--ton-grad-12)' }}>
        Schwelle: {speaker.threshold_status ?? 'unbekannt'}
      </p>
    </div>
  );
}

function Klangumgebung({ soundscape }: { soundscape: QaReport['soundscape'] }): React.JSX.Element {
  if (!soundscape) {
    return (
      <div>
        <p className="tafel">Klangumgebung</p>
        <p className="leise">Nicht Teil dieses Berichts.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="tafel">Klangumgebung</p>
      <ul className="stapel-eng" style={{ marginTop: 'var(--ton-mass-2)' }}>
        <li className="leise">
          {zahl(soundscape.bed_count)} Betten · {zahl(soundscape.event_count)} Ereignisse ·
          Abdeckung {prozent(soundscape.configured_coverage_ratio, 0)}
        </li>
        <li className="zahl leise">
          konfiguriert {dezibel(soundscape.configured_gain_min_db)} bis {dezibel(soundscape.configured_gain_max_db)}
        </li>
        <li className="zahl leise">gemessen {dezibel(soundscape.measured_ambience_rms_dbfs)} im Master</li>
      </ul>
      {(soundscape.warnings ?? []).length > 0 ? (
        <p className="hinweis" style={{ marginTop: 'var(--ton-mass-3)' }}>{(soundscape.warnings ?? []).join(' · ')}</p>
      ) : null}
    </div>
  );
}

function Freigabe({
  approval,
  sceneSha,
}: {
  approval: { status?: string; editor?: string; reviewed_at?: string; checklist?: string[]; audio_sha256?: string | null; scene_sha256?: string | null; variant?: string | null } | null;
  sceneSha: string;
}): React.JSX.Element {
  if (!approval) {
    return (
      <Platte titel="Freigabe">
        <Zustand art="leer" text="Diese Revision ist von niemandem freigegeben." />
      </Platte>
    );
  }
  // An approval names the bytes it certifies. If it names other bytes than the ones on this page,
  // it does not cover them — that is the whole reason the `stale` status exists, and it must be
  // visible here rather than only in the registry.
  const passend = !approval.scene_sha256 || approval.scene_sha256 === sceneSha;
  return (
    <Platte
      titel="Freigabe"
      zaehler={<Marke ton={passend ? 'signal' : 'alarm'}>{passend ? 'gilt für diese Bytes' : 'gilt für andere Bytes'}</Marke>}
      randlos
    >
      <dl className="werte platte-leib">
        <div className="wert">
          <dt>Freigegeben von</dt>
          <dd>{approval.editor ?? '–'}</dd>
        </div>
        <div className="wert">
          <dt>Wann</dt>
          <dd className="zahl">{zeitpunkt(approval.reviewed_at)}</dd>
        </div>
        <div className="wert">
          <dt>Variante</dt>
          <dd className="zahl">{approval.variant ?? '–'}</dd>
        </div>
        <div className="wert">
          <dt>Audio-Sha</dt>
          <dd className="zahl" title={approval.audio_sha256 ?? undefined}>{kurzSha(approval.audio_sha256)}</dd>
        </div>
      </dl>
      {(approval.checklist ?? []).length > 0 ? (
        <div className="platte-leib reihe" style={{ borderTop: '1px solid var(--ton-kante)' }}>
          {(approval.checklist ?? []).map((item) => (
            <Marke key={item} ton="signal">{item}</Marke>
          ))}
        </div>
      ) : null}
    </Platte>
  );
}
