import { useEffect, useRef, useState } from 'react';
import {
  exportSnapshot,
  importSnapshot,
  getAttempts,
  getCardStates,
  getSessionLog,
  type SessionLogEntry,
} from '../../lib/store';
import { weakFocuses, type FocusStat } from '../../lib/weakness';
import { useExplainLang } from '../hooks';

export default function ProgressPanel() {
  const lang = useExplainLang();
  const [summary, setSummary] = useState<{ attempts: number; accuracy: number; cards: number } | null>(null);
  const [weak, setWeak] = useState<FocusStat[]>([]);
  const [sessions, setSessions] = useState<SessionLogEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    const attempts = await getAttempts();
    const cards = await getCardStates();
    const correct = attempts.filter((a) => a.correct).length;
    setSummary({
      attempts: attempts.length,
      accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : 0,
      cards: Object.keys(cards).length,
    });
    setWeak(weakFocuses(attempts).slice(0, 5));
    setSessions(await getSessionLog());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function doExport() {
    const snapshot = await exportSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(
      lang === 'ru'
        ? 'Снимок сохранён. Положите файл в папку progress/ репозитория, чтобы агент мог подобрать упражнения под ваши ошибки.'
        : 'Snapshot saved. Drop the file into the repo’s progress/ folder so the agent can tailor drills to your mistakes.',
    );
  }

  async function doImport(file: File) {
    try {
      const snapshot = JSON.parse(await file.text());
      await importSnapshot(snapshot);
      await refresh();
      setMessage(lang === 'ru' ? 'Прогресс восстановлен.' : 'Progress restored.');
    } catch (e) {
      setMessage(
        lang === 'ru'
          ? `Не удалось импортировать: ${e instanceof Error ? e.message : String(e)}`
          : `Import failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
      {summary && (
        <dl className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3 sm:gap-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-400">
              {lang === 'ru' ? 'Ответов' : 'Answers'}
            </dt>
            <dd className="mt-1 text-2xl font-bold">{summary.attempts}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-400">
              {lang === 'ru' ? 'Точность' : 'Accuracy'}
            </dt>
            <dd className="mt-1 text-2xl font-bold">{summary.accuracy}%</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-400">
              {lang === 'ru' ? 'Карточек начато' : 'Cards started'}
            </dt>
            <dd className="mt-1 text-2xl font-bold">{summary.cards}</dd>
          </div>
        </dl>
      )}

      {sessions.length > 0 && (
        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
          {lang === 'ru' ? 'Последняя сессия' : 'Last session'}:{' '}
          <span className="font-semibold tabular-nums">{sessions.at(-1)!.date}</span>
          {' · '}
          {sessions.length} {lang === 'ru' ? 'всего' : 'total'}
        </p>
      )}

      {weak.length > 0 && (
        <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-700">
          <h2 lang="de" className="text-sm font-semibold text-stone-600 dark:text-stone-300">
            Schwachstellen
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {lang === 'ru'
              ? 'Путаницы с самой высокой долей ошибок за последнее время — тренировка и новые упражнения будут целить именно в них.'
              : 'The confusions with the highest recent error rates — training sessions and new drills target these first.'}
          </p>
          <ul className="mt-3 space-y-1.5">
            {weak.map((w) => (
              <li key={w.focus} className="flex items-center gap-2 text-sm">
                <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-700 dark:bg-stone-700 dark:text-stone-200">
                  {w.focus}
                </code>
                <span className="ml-auto tabular-nums font-semibold text-red-600 dark:text-red-400">
                  {Math.round(w.errorRate * 100)}%
                </span>
                <span className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-stone-400">
                  {w.attempts} {lang === 'ru' ? 'ответов' : 'attempts'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => void doExport()}
          className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
        >
          {lang === 'ru' ? 'Экспорт прогресса' : 'Export progress'}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="min-h-11 rounded-md border border-stone-300 px-4 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600 sm:min-h-0"
        >
          {lang === 'ru' ? 'Импорт…' : 'Import…'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = '';
          }}
        />
      </div>

      {message && (
        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">{message}</p>
      )}
    </div>
  );
}
