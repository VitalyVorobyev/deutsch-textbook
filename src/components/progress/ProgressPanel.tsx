import { useEffect, useRef, useState } from 'react';
import {
  exportSnapshot,
  mergeSnapshot,
  replaceSnapshot,
  getAttempts,
  getCardStates,
  getSessionLog,
  type Attempt,
  type CardStates,
  type SessionLogEntry,
} from '../../lib/store';
import { scoreTotal, verifiedOnly } from '../../lib/scoring';
import { getActiveProfileId, getActiveProfile } from '../../lib/profile';
import { isTauri, getSyncDir, pickSyncDir, writeSnapshotToSyncDir } from '../../lib/syncdir';
import { localDateString } from '../../lib/store';
import { pick, type ExplainText } from '../../lib/prefs';
import { t, type StringKey } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import { Heatmap } from './Heatmap';
import { WeaknessTrends } from './WeaknessTrends';
import { SessionLog } from './SessionLog';
import type { CardDef } from '../../lib/srs';
import { VocabularyProgress, type VocabGroup } from '../vocab/VocabMastery';
import { CheckpointResults, type CheckpointInfo } from './CheckpointResults';
import { ProbeResults } from './ProbeResults';
import type { ProbeFamily } from '../../lib/probes';

interface Data {
  attempts: Attempt[];
  cards: CardStates;
  sessions: SessionLogEntry[];
}

/**
 * The page's three sub-tabs. Übersicht is the at-a-glance state, Nachweise
 * holds every measurement surface, Daten the export/import/sync controls.
 * "Progress by topic" is gone on purpose: it duplicated the Themen page's
 * "Alle Themen" table (same tier + evidence per topic), minus its filters,
 * search and next-action column — two renderings of one answer.
 */
type ProgressView = 'uebersicht' | 'nachweise' | 'daten';

const PROGRESS_VIEWS = [
  ['uebersicht', 'progress.tabUebersicht'],
  ['nachweise', 'progress.tabNachweise'],
  ['daten', 'progress.tabDaten'],
] as const;

const VIEW_KEY = 'da:progress-view';

/** Same shape as the Themen tab's savedView: never trust a stored value. */
function savedProgressView(value: string | null): ProgressView | undefined {
  return value === 'uebersicht' || value === 'nachweise' || value === 'daten' ? value : undefined;
}

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md).
    `{…}` placeholders are replaced by the caller. */
const UI = {
  writtenTo: { en: 'Written to {path}', ru: 'Сохранено в {path}' },
  writtenToCommit: {
    en: 'Written to {path} — commit it so the agent can tailor drills.',
    ru: 'Сохранено в {path} — закоммитьте, чтобы агент подобрал упражнения.',
  },
  downloadedDrop: {
    en: 'Snapshot saved. Drop it into progress/{id}/ in the repo so the agent can tailor drills.',
    ru: 'Снимок сохранён. Положите его в progress/{id}/ репозитория, чтобы агент подобрал упражнения.',
  },
  replaceConfirm: {
    en: 'Replace ALL progress in this profile with the imported snapshot? This cannot be undone.',
    ru: 'Заменить ВЕСЬ прогресс этого профиля импортируемым снимком? Отменить нельзя.',
  },
  replaced: { en: 'Progress replaced.', ru: 'Прогресс заменён.' },
  merged: { en: 'Progress merged.', ru: 'Прогресс объединён.' },
  importFailed: { en: 'Import failed: {reason}', ru: 'Не удалось импортировать: {reason}' },
  untouched: {
    en: 'Nothing to show yet. Answer your first exercise or review your first flashcard, and this page fills up: what you practised, on which days, and which confusions keep costing you points.',
    ru: 'Пока показывать нечего. Решите первое упражнение или повторите первую карточку — и эта страница заполнится: что вы отрабатывали, в какие дни и какие ошибки повторяются чаще всего.',
  },
  answers: { en: 'Answers', ru: 'Ответов' },
  accuracy: { en: 'Accuracy', ru: 'Точность' },
  cardsStarted: { en: 'Cards started', ru: 'Карточек начато' },
  evidenceTitle: { en: 'Evidence by actual response', ru: 'Практика по фактическому ответу' },
  evidenceNote: {
    en: 'What you actually did, separate from the skill targeted by the curriculum outcome. Older attempts use their target mode because they did not record a response mode.',
    ru: 'Что вы фактически делали — отдельно от навыка, указанного в цели курса. Для старых попыток показан целевой навык, потому что тип ответа ещё не сохранялся.',
  },
  verified: { en: 'verified', ru: 'проверено' },
  practice: { en: 'practice', ru: 'практика' },
  exportBtn: { en: 'Export progress', ru: 'Экспорт прогресса' },
  importMergeBtn: { en: 'Import (merge)', ru: 'Импорт (объединить)' },
  replaceBtn: { en: 'Replace…', ru: 'Заменить…' },
  syncFolder: { en: 'Sync folder:', ru: 'Папка синхронизации:' },
  changeBtn: { en: 'Change…', ru: 'Изменить…' },
  autoSyncTauri: {
    en: 'Auto-sync is on: every change writes a snapshot to the sync folder. Point it at your repo clone’s progress/ folder so the agent can tailor drills.',
    ru: 'Автосинхронизация включена: каждое изменение записывает снимок в папку синхронизации. Укажите папку progress/ клона репозитория, чтобы агент подбирал упражнения.',
  },
  autoSyncDev: {
    en: 'Auto-sync is on: while bun run dev is running, every change is written to progress/ automatically. Export is for the deployed site.',
    ru: 'Автосинхронизация включена: пока работает bun run dev, каждое изменение автоматически записывается в progress/. Экспорт нужен для задеплоенного сайта.',
  },
} as const satisfies Record<string, { en: string; ru: string }>;

const MODE_LABELS: Record<string, { en: string; ru: string }> = {
  selection: { en: 'Selected response', ru: 'Выбор ответа' },
  listening: { en: 'Listening', ru: 'Аудирование' },
  reading: { en: 'Reading', ru: 'Чтение' },
  writing: { en: 'Writing', ru: 'Письмо' },
  'spoken-production': { en: 'Spoken production', ru: 'Устная речь' },
  'spoken-interaction': { en: 'Spoken interaction', ru: 'Диалог' },
};

/**
 * The import boundary validates with Zod, and a ZodError's `message` is a JSON dump of every
 * issue it found — useless to a learner who picked the wrong file. Say what actually happened.
 */
function importErrorReason(error: unknown): { en: string; ru: string } {
  if (error instanceof SyntaxError) {
    return { en: 'that file is not JSON.', ru: 'этот файл не является JSON.' };
  }
  if (error && typeof error === 'object' && 'issues' in error) {
    return {
      en: 'that file is not a valid Deutsch-Atlas progress snapshot.',
      ru: 'этот файл не является корректным снимком прогресса Deutsch-Atlas.',
    };
  }
  return {
    en: error instanceof Error ? error.message : String(error),
    ru: error instanceof Error ? error.message : String(error),
  };
}

interface Props {
  outcomeModes: Record<string, string>;
  cards: CardDef[];
  /** group titles are chrome-string keys, rendered by VocabularyProgress */
  vocabularyGroups: Array<{ title: StringKey; items: VocabGroup[] }>;
  /** every level checkpoint in the content — each panel hides itself until taken */
  checkpoints?: CheckpointInfo[];
  /** outcome id → learner-facing can-do text, shared by every checkpoint panel */
  outcomeLabels: Record<string, ExplainText>;
  probeFamilies: ProbeFamily[];
  /** probe set id → the topic's German title, for the results list */
  probeLabels: Record<string, string>;
  probeTopicPaths: Record<string, string>;
}

export default function ProgressPanel({
  outcomeModes,
  cards,
  vocabularyGroups,
  checkpoints = [],
  outcomeLabels,
  probeFamilies,
  probeLabels,
  probeTopicPaths,
}: Props) {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<ProgressView>('uebersicht');
  const [message, setMessage] = useState<string | null>(null);
  const [syncDir, setSyncDir] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importMode = useRef<'merge' | 'replace'>('merge');

  async function loadData(): Promise<Data> {
    const [attempts, cards, sessions] = await Promise.all([
      getAttempts(),
      getCardStates(),
      getSessionLog(),
    ]);
    return { attempts, cards, sessions };
  }

  async function refresh() {
    setData(await loadData());
  }

  useEffect(() => {
    // localStorage is client-only; queueMicrotask defers the restore out of the
    // effect body — the same idiom the Themen tab uses for its saved view.
    const saved = savedProgressView(localStorage.getItem(VIEW_KEY));
    queueMicrotask(() => {
      if (saved) setView(saved);
    });
    void loadData().then(setData);
    if (isTauri()) void getSyncDir().then(setSyncDir);
  }, []);

  function changeView(value: ProgressView) {
    setView(value);
    localStorage.setItem(VIEW_KEY, value);
  }

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
    setMessage(pick(lang, UI.writtenTo).replace('{path}', path));
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
            pick(lang, UI.writtenToCommit).replace('{path}', info.path ?? `progress/${profileId}/`),
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
        setMessage(pick(lang, UI.writtenTo).replace('{path}', path));
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
    setMessage(pick(lang, UI.downloadedDrop).replace('{id}', profileId));
  }

  async function doImport(file: File) {
    const mode = importMode.current;
    try {
      const snapshot = JSON.parse(await file.text());
      if (mode === 'replace') {
        const ok = confirm(pick(lang, UI.replaceConfirm));
        if (!ok) return;
        await replaceSnapshot(snapshot);
      } else {
        await mergeSnapshot(snapshot);
      }
      await refresh();
      setMessage(mode === 'replace' ? pick(lang, UI.replaced) : pick(lang, UI.merged));
    } catch (e) {
      setMessage(
        pick(lang, UI.importFailed).replace('{reason}', pick(lang, importErrorReason(e))),
      );
    }
  }

  function pickFile(mode: 'merge' | 'replace') {
    importMode.current = mode;
    fileInput.current?.click();
  }

  const verified = data ? verifiedOnly(data.attempts) : [];
  const correct = scoreTotal(verified);
  const accuracy = verified.length ? Math.round((correct / verified.length) * 100) : 0;
  const modeEvidence = new Map<string, { verified: number; practice: number }>();
  for (const attempt of data?.attempts ?? []) {
    const actualModes = attempt.responseMode
      ? [attempt.responseMode]
      : [...new Set((attempt.outcomes ?? []).map((outcome) => outcomeModes[outcome]).filter(Boolean))];
    for (const mode of actualModes) {
      const count = modeEvidence.get(mode) ?? { verified: 0, practice: 0 };
      count[attempt.evidence === 'practice' ? 'practice' : 'verified']++;
      modeEvidence.set(mode, count);
    }
  }
  // Nothing measured yet: an empty heatmap over empty charts says "broken", not
  // "new". Say what will fill them instead. Import stays reachable below.
  const untouched =
    !!data && data.attempts.length === 0 && Object.keys(data.cards).length === 0;

  return (
    <div className="space-y-8">
      {untouched && (
        <section className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-500 dark:border-stone-600 dark:text-stone-400">
          {pick(lang, UI.untouched)}
        </section>
      )}

      <div
        className="inline-flex rounded-md border border-stone-300 p-0.5 text-sm dark:border-stone-600"
        role="tablist"
        aria-label={t('progress.viewsAria', uiLang)}
      >
        {PROGRESS_VIEWS.map(([id, key]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => changeView(id)}
            className={`rounded px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${view === id ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900' : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'}`}
          >
            {t(key, uiLang)}
          </button>
        ))}
      </div>

      {view === 'uebersicht' && data && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <dl className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3 sm:gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">{pick(lang, UI.answers)}</dt>
              <dd className="mt-1 text-2xl font-bold">{data.attempts.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">{pick(lang, UI.accuracy)}</dt>
              <dd className="mt-1 text-2xl font-bold">{accuracy}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-400">
                {pick(lang, UI.cardsStarted)}
              </dt>
              <dd className="mt-1 text-2xl font-bold">{Object.keys(data.cards).length}</dd>
            </div>
          </dl>
        </section>
      )}

      {view === 'uebersicht' && data && (
        <VocabularyProgress cards={cards} groups={vocabularyGroups} states={data.cards} />
      )}

      {view === 'uebersicht' && data && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <Heatmap attempts={data.attempts} sessions={data.sessions} cards={data.cards} />
        </section>
      )}

      {view === 'uebersicht' && data && <SessionLog attempts={data.attempts} sessions={data.sessions} />}

      {view === 'nachweise' && data && modeEvidence.size > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
          <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">{pick(lang, UI.evidenceTitle)}</h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {pick(lang, UI.evidenceNote)}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...modeEvidence.entries()].map(([mode, count]) => (
              <div key={mode} className="rounded-md bg-stone-50 px-3 py-2 dark:bg-stone-900/50">
                <dt className="text-sm font-medium">{MODE_LABELS[mode] ? pick(lang, MODE_LABELS[mode]) : mode}</dt>
                <dd className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {count.verified} {pick(lang, UI.verified)} · {count.practice} {pick(lang, UI.practice)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {view === 'nachweise' &&
        data &&
        checkpoints.map((checkpoint) => (
          <CheckpointResults
            key={checkpoint.setId}
            checkpoint={checkpoint}
            outcomeModes={outcomeModes}
            outcomeLabels={outcomeLabels}
            attempts={data.attempts}
          />
        ))}

      {view === 'nachweise' && data && (
        <ProbeResults
          families={probeFamilies}
          labels={probeLabels}
          topicPaths={probeTopicPaths}
          attempts={data.attempts}
          lang={lang}
        />
      )}

      {/* Owns its card and renders nothing when it has nothing to say. */}
      {view === 'nachweise' && data && <WeaknessTrends attempts={data.attempts} />}

      {view === 'daten' && (
      <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void doExport()}
            className="min-h-11 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 sm:min-h-0"
          >
            {pick(lang, UI.exportBtn)}
          </button>
          <button
            type="button"
            onClick={() => pickFile('merge')}
            className="min-h-11 rounded-md border border-stone-300 px-4 py-1.5 text-sm font-semibold hover:border-amber-500 dark:border-stone-600 sm:min-h-0"
          >
            {pick(lang, UI.importMergeBtn)}
          </button>
          <button
            type="button"
            onClick={() => pickFile('replace')}
            className="min-h-11 rounded-md px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-red-600 dark:text-stone-400 sm:min-h-0"
          >
            {pick(lang, UI.replaceBtn)}
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
            <span className="font-semibold">{pick(lang, UI.syncFolder)}</span>
            <code className="max-w-full truncate rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-900">
              {syncDir ?? '…'}
            </code>
            <button
              type="button"
              onClick={() => void changeSyncDir()}
              className="rounded-md border border-stone-300 px-2 py-1 font-semibold hover:border-amber-500 dark:border-stone-600"
            >
              {pick(lang, UI.changeBtn)}
            </button>
          </div>
        )}
        {isTauri() ? (
          <p className="mt-3 text-center text-xs text-stone-400">
            {pick(lang, UI.autoSyncTauri)}
          </p>
        ) : (
          import.meta.env.DEV && (
            <p className="mt-3 text-center text-xs text-stone-400">
              {pick(lang, UI.autoSyncDev)}
            </p>
          )
        )}
        {message && (
          <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">{message}</p>
        )}
      </section>
      )}
    </div>
  );
}
