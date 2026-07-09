import { useEffect, useRef, useState } from 'react';
import { exportSnapshot, importSnapshot, getAttempts, getCardStates } from '../../lib/store';
import { useExplainLang } from '../hooks';

export default function ProgressPanel() {
  const lang = useExplainLang();
  const [summary, setSummary] = useState<{ attempts: number; accuracy: number; cards: number } | null>(null);
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
        <dl className="grid grid-cols-3 gap-4 text-center">
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

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => void doExport()}
          className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {lang === 'ru' ? 'Экспорт прогресса' : 'Export progress'}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-md border border-stone-300 px-4 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600"
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
