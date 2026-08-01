import { useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
import type { listeningItemSchema } from '../../lib/schemas';
import { normalizeDictation, normalizeTranslation } from '../../lib/cloze';
import { shuffle } from '../../lib/shuffle';
import { t } from '../../lib/strings';
import { useUiLang } from '../hooks';
import { ActionRow, Feedback, Instruction, Translation, type ItemProps } from './shared';

type Item = z.infer<typeof listeningItemSchema>;

export function Listening({ item, lang, onResult, locked, onNext, nextLabel }: ItemProps<Item>) {
  const uiLang = useUiLang();
  const audio = useRef<HTMLAudioElement>(null);
  const [plays, setPlays] = useState(0);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [order, setOrder] = useState(() => item.response.kind === 'ordering' ? shuffle(item.response.units) : []);
  const optionOrder = useMemo(() => item.response.kind === 'true-false' ? shuffle([0, 1]) : 'options' in item.response ? shuffle(item.response.options.map((_, i) => i)) : [], [item]);
  const response = item.response;

  function play() {
    if (plays >= item.max_replays || !audio.current) return;
    audio.current.currentTime = 0; void audio.current.play(); setPlays((n) => n + 1);
  }

  function submit() {
    if (checked || locked) return;
    let correct = false, correctParts: number | undefined, totalParts: number | undefined, given = '';
    if (response.kind === 'single-choice') { correct = selected[0] === response.correct; given = response.options[selected[0] ?? -1] ?? ''; }
    if (response.kind === 'true-false') { correct = selected[0] === Number(response.correct); given = String(selected[0] === 1); }
    if (response.kind === 'multi-select') {
      const expected = new Set(response.correct); const chosen = new Set(selected);
      correctParts = response.options.filter((_, i) => expected.has(i) === chosen.has(i)).length; totalParts = response.options.length;
      correct = correctParts === totalParts; given = selected.map((i) => response.options[i]).join(' | ');
    }
    if (response.kind === 'ordering') { correctParts = order.filter((unit, i) => unit === response.units[i]).length; totalParts = order.length; correct = correctParts === totalParts; given = order.join(' | '); }
    if (response.kind === 'short-answer') { const normalized = normalizeTranslation(text); correct = response.answers.some((answer) => normalizeTranslation(answer) === normalized); given = text; }
    if (response.kind === 'dictation') {
      const line = item.transcript.find((turn) => turn.id === response.line_id); const answers = [line?.text ?? '', ...response.accept].map(normalizeDictation);
      correct = answers.includes(normalizeDictation(text)); given = text;
    }
    setIsCorrect(correct); setChecked(true); onResult({ correct, given, correctParts, totalParts, responseMode: 'listening' });
  }

  const prompt = response.kind === 'true-false' ? response.statement : response.kind === 'dictation' ? 'Schreiben Sie, was Sie hören.' : response.prompt;
  const correctAnswer = response.kind === 'single-choice' ? response.options[response.correct]
    : response.kind === 'multi-select' ? response.correct.map((i) => response.options[i]).join(' · ')
    : response.kind === 'true-false' ? String(response.correct)
    : response.kind === 'ordering' ? response.units.join(' · ')
    : response.kind === 'short-answer' ? response.answers.join(' · ')
    : item.transcript.find((turn) => turn.id === response.line_id)?.text;
  const simpleOptions = response.kind === 'true-false' ? ['Falsch', 'Richtig'] : 'options' in response ? response.options : [];

  return <div>
    <Instruction text={item.instruction} lang={lang} />
    <audio ref={audio} src={item.audio} />
    <div className="mb-4 flex items-center gap-3"><button type="button" onClick={play} disabled={plays >= item.max_replays} className="min-h-11 rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t('action.play', uiLang)}</button><span className="text-xs text-stone-400">{plays} / {item.max_replays}</span></div>
    <p lang="de" className="mb-3 text-lg font-medium">{prompt}</p>
    {simpleOptions.length > 0 && <div className="space-y-2">{optionOrder.map((index) => <label key={index} className="block rounded-md border p-3"><input type={response.kind === 'multi-select' ? 'checkbox' : 'radio'} checked={selected.includes(index)} onChange={() => setSelected((old) => response.kind === 'multi-select' ? old.includes(index) ? old.filter((i) => i !== index) : [...old, index] : [index])} /> <span className="ml-2">{simpleOptions[index]}</span></label>)}</div>}
    {response.kind === 'ordering' && <div className="space-y-2">{order.map((unit, index) => <div key={unit} className="flex gap-2 rounded border p-2"><button type="button" onClick={() => index > 0 && setOrder((old) => { const n=[...old]; [n[index-1],n[index]]=[n[index]!,n[index-1]!]; return n; })}>↑</button><span>{unit}</span></div>)}</div>}
    {(response.kind === 'short-answer' || response.kind === 'dictation') && <input className="w-full rounded-md border p-3" value={text} onChange={(e) => setText(e.target.value)} />}
    <Translation text={item.translation} lang={lang} />
    {!checked && <button type="button" onClick={submit} className="mt-4 min-h-11 rounded-md bg-amber-600 px-4 py-2 font-semibold text-white">{t('action.check', uiLang)}</button>}
    {checked && <><ActionRow checked correct={isCorrect} onNext={onNext} nextLabel={nextLabel} /><div className="mt-4 space-y-1 rounded-md border p-3 text-sm">{item.transcript.map((turn, i) => <p key={i}><strong>{turn.speaker}:</strong> {turn.text}</p>)}</div><Feedback correct={isCorrect} correctAnswer={correctAnswer} explain={item.explain} lang={lang} /></>}
  </div>;
}
