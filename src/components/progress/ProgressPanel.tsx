import { useEffect, useRef, useState } from 'react';
import {
  exportSnapshot,
  mergeSnapshot,
  replaceSnapshot,
  getAttempts,
  getCardStates,
  getSessionLog,
  getTopicsState,
  type Attempt,
  type CardStates,
  type SessionLogEntry,
  type TopicsState,
} from '../../lib/store';
import { getActiveProfileId, getActiveProfile } from '../../lib/profile';
import { isTauri, getSyncDir, pickSyncDir, writeSnapshotToSyncDir } from '../../lib/syncdir';
import { localDateString } from '../../lib/store';
import type { TopicNode } from '../../lib/mastery';
import { useExplainLang } from '../hooks';
import { Heatmap } from './Heatmap';
import { WeaknessTrends } from './WeaknessTrends';
import { SessionLog } from './SessionLog';
import { TopicProgressList } from './TopicProgressList';

interface Data {
  attempts: Attempt[];
  cards: CardStates;
  sessions: SessionLogEntry[];
  topics: TopicsState;
}

interface Props {
  nodes: TopicNode[];
}

export default function ProgressPanel({ nodes }: Props) {
  const lang = useExplainLang();
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncDir, setSyncDir] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importMode = useRef<'merge' | 'replace'>('merge');

  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en);

  async function loadData(): Promise<Data> {
    const [attempts, cards, sessions, topics] = await Promise.all([
      getAttempts(),
      getCardStates(),
      getSessionLog(),
      getTopicsState(),
    ]);
    return { attempts, cards, sessions, topics };
  }

  async function refresh() {
    setData(await loadData());
  }

  useEffect(() => {
    void loadData().then(setData);
    if (isTauri()) void getSyncDir().then(setSyncDir);
  }, []);

  async function changeSyncDir() {
    const dir = await pickSyncDir();
    if (!dir) return;
    setSyncDir(dir);
    // write a snapshot right away so the new folder visibly works
    const snapshot = await exportSnapshot(getActiveProfile().label);
    const path = await writeSnapshotToSyncDir(
      getActiveProfileId(),
      JSON.stringify(snapshot, null, 2),
      localDateString(),
    );
    setMessage(t(`Written to ${path}`, `Сохранено в ${path}`));
  }

  async function doExport() {
    const profileId = getActiveProfileId();
    const snapshot = await exportSnapshot(getActiveProfile().label);
    const body = JSON.stringify(snapshot, null, 2);

    // The dev-only writer (writes straight into the repo under `bun run dev`). The
    // endpoint exists nowhere else, so on the deployed site we do not even ask.
    if (import.meta.env.DEV) {
      try {
        const res = await fetch(`/__progress/${profileId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        if (res.ok) {
          const info = (await res.json().catch(() => ({}))) as { path?: string };
          setMessage(
            t(
              `Written to ${info.path ?? `progress/${profileId}/`} — commit it so the agent can tailor drills.`,
              `Сохранено в ${info.path ?? `progress/${profileId}/`} — закоммитьте, чтобы агент подобрал упражнения.`,
            ),
          );
          return;
        }
      } catch {
        // dev endpoint unavailable (middleware off) — fall back below.
      }
    }

    // Desktop app: write into the sync folder.
    if (isTauri()) {
      try {
        const path = await writeSnapshotToSyncDir(profileId, body, localDateString());
        setMessage(t(`Written to ${path}`, `Сохранено в ${path}`));
        return;
      } catch {
        // sync folder unwritable — fall back to a download.
      }
    }

    const blob = new Blob([body], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(
      t(
        `Snapshot saved. Drop it into progress/${profileId}/ in the repo so the agent can tailor drills.`,
        `Снимок сохранён. Положите его в progress/${profileId}/ репозитория, чтобы агент подобрал упражнения.`,
      ),
    );
  }

  async function doImport(file: File) {
    const mode = importMode.current;
    try {
      const snapshot = JSON.parse(await file.text());
      if (mode === 'replace') {
        const ok = confirm(
          t(
            'Replace ALL progress in this profile with the imported snapshot? This cannot be undone.',
            'Заменить ВЕСЬ прогресс этого профиля импортируемым снимком? Отменить нельзя.',
          ),
        );
        if (!ok) return;
        await replaceSnapshot(snapshot);
      } else {
        await mergeSnapshot(snapshot);
      }
      await refresh();
      setMessage(
        mode === 'replace'
          ? t('Progress replaced.', 'Прогресс заменён.')
          : t('Progress merged.', 'Прогресс объединён.'),
      );
    } catch (e) {
      setMessage(
        t(
          `Import failed: ${e instanceof Error ? e.message : String(e)}`,
          `Не удалось импортировать: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  function pickFile(mode: 'merge' | 'replace') {
    importMode.current = mode;
    fileInput.current?.click();
  }

  const correct = data ? data.attempts.filter((a) => a.correct).length : 0;
  const accuracy = data && data.attempts.length ? Math.round((correct / data.attempts.length) * 100) : 0;

  return (
    <div className="space-y-8">
      {data && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <dl className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3 sm:gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">{t('Answers', 'Ответов')}</dt>
              <dd className="mt-1 text-2xl font-bold">{data.attempts.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">{t('Accuracy', 'Точность')}</dt>
              <dd className="mt-1 text-2xl font-bold">{accuracy}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">
                {t('Cards started', 'Карточек начато')}
              </dt>
              <dd className="mt-1 text-2xl font-bold">{Object.keys(data.cards).length}</dd>
            </div>
          </dl>
        </section>
      )}

      {data && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <Heatmap attempts={data.attempts} sessions={data.sessions} cards={data.cards} />
        </section>
      )}

      {data && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <TopicProgressList
            nodes={nodes}
            ctx={{ attempts: data.attempts, cards: data.cards, topics: data.topics }}
          />
        </section>
      )}

      {data && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <WeaknessTrends attempts={data.attempts} />
        </section>
      )}

      {data && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <SessionLog attempts={data.attempts} sessions={data.sessions} />
        </section>
      )}

      <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void doExport()}
            className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
          >
            {t('Export progress', 'Экспорт прогресса')}
          </button>
          <button
            type="button"
            onClick={() => pickFile('merge')}
            className="min-h-11 rounded-md border border-stone-300 px-4 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600 sm:min-h-0"
          >
            {t('Import (merge)', 'Импорт (объединить)')}
          </button>
          <button
            type="button"
            onClick={() => pickFile('replace')}
            className="min-h-11 rounded-md px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-red-600 dark:text-stone-400 sm:min-h-0"
          >
            {t('Replace…', 'Заменить…')}
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
        {isTauri() && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="font-semibold">{t('Sync folder:', 'Папка синхронизации:')}</span>
            <code className="max-w-full truncate rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-900">
              {syncDir ?? '…'}
            </code>
            <button
              type="button"
              onClick={() => void changeSyncDir()}
              className="rounded-md border border-stone-300 px-2 py-1 font-semibold hover:border-amber-500 dark:border-stone-600"
            >
              {t('Change…', 'Изменить…')}
            </button>
          </div>
        )}
        {isTauri() ? (
          <p className="mt-3 text-center text-xs text-stone-400">
            {t(
              'Auto-sync is on: every change writes a snapshot to the sync folder. Point it at your repo clone’s progress/ folder so the agent can tailor drills.',
              'Автосинхронизация включена: каждое изменение записывает снимок в папку синхронизации. Укажите папку progress/ клона репозитория, чтобы агент подбирал упражнения.',
            )}
          </p>
        ) : (
          import.meta.env.DEV && (
            <p className="mt-3 text-center text-xs text-stone-400">
              {t(
                'Auto-sync is on: while bun run dev is running, every change is written to progress/ automatically. Export is for the deployed site.',
                'Автосинхронизация включена: пока работает bun run dev, каждое изменение автоматически записывается в progress/. Экспорт нужен для задеплоенного сайта.',
              )}
            </p>
          )
        )}
        {message && (
          <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">{message}</p>
        )}
      </section>
    </div>
  );
}
