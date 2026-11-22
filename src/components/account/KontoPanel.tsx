import { useEffect, useRef, useState } from 'react';
import { exportSnapshot, mergeSnapshot, replaceSnapshot, localDateString } from '../../lib/store';
import { getActiveProfileId, getActiveProfile } from '../../lib/profile';
import {
  isTauri,
  getSyncDir,
  newestSnapshotBackup,
  pickSyncDir,
  writeSnapshotToSyncDir,
  type SnapshotBackup,
} from '../../lib/syncdir';
import { legacyWebkitContainer, type LegacyStoreInfo } from '../../lib/legacy-store';
import { recentStalls, type StallEntry } from '../../lib/stall-log';
import { pick } from '../../lib/prefs';
import { forceSync, readSyncState } from '../../lib/sync-remote';
import { t } from '../../lib/strings';
import { useExplainLang, useUiLang } from '../hooks';
import AccountPanel from './AccountPanel';

/** Explanation-language strings — one hoisted record per file (docs/adrs/0005-explanation-languages.md).
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
  replacedSynced: {
    en: 'Progress replaced and uploaded.',
    ru: 'Прогресс заменён и отправлен в облако.',
  },
  mergedSynced: {
    en: 'Progress merged and uploaded.',
    ru: 'Прогресс объединён и отправлен в облако.',
  },
  datenLead: {
    en: 'Where your progress lives, and how to move or back it up — on this device always, in the cloud if you connect an account.',
    ru: 'Где хранится ваш прогресс и как его перенести или сохранить — на этом устройстве всегда, а в облаке — если подключить аккаунт.',
  },
  importCloudNote: {
    en: 'If a cloud account is connected, the loaded file is uploaded automatically.',
    ru: 'Если подключён облачный аккаунт, загруженная копия автоматически отправится в облако.',
  },
  importFailed: { en: 'Import failed: {reason}', ru: 'Не удалось импортировать: {reason}' },
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

/**
 * The /konto page: where the progress lives and how it moves. The local copy
 * (export, import, the desktop sync folder), the storage diagnostics, and the
 * cloud account. Nothing here measures learning, which is why it is not on
 * Fortschritt.
 */
export default function KontoPanel() {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [message, setMessage] = useState<string | null>(null);
  const [syncDir, setSyncDir] = useState<string | null>(null);
  const [stalls, setStalls] = useState<StallEntry[]>([]);
  const [backup, setBackup] = useState<SnapshotBackup | null>(null);
  const [legacyStore, setLegacyStore] = useState<LegacyStoreInfo | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importMode = useRef<'merge' | 'replace'>('merge');

  useEffect(() => {
    if (isTauri()) void getSyncDir().then(setSyncDir);
    // Diagnostics: what the store did, and what is on disk regardless of what it did.
    // The stall log is a synchronous localStorage read, so it is deferred out of the
    // effect body rather than setting state in it.
    queueMicrotask(() => setStalls(recentStalls()));
    if (isTauri()) {
      void newestSnapshotBackup(getActiveProfileId()).then(setBackup, () => setBackup(null));
      void legacyWebkitContainer().then(setLegacyStore, () => setLegacyStore(null));
    }
  }, []);

  async function changeSyncDir() {
    const dir = await pickSyncDir();
    if (!dir) return;
    setSyncDir(dir);
    // write a snapshot right away so the new folder visibly works
    const snapshot = await exportSnapshot(getActiveProfile().label);
    const written = await writeSnapshotToSyncDir(
      getActiveProfileId(),
      JSON.stringify(snapshot, null, 2),
      localDateString(),
    );
    // A parked write still names the file it produced — the conflict path IS the
    // message the learner should see (the folder holds a fatter daily file).
    setMessage(pick(lang, UI.writtenTo).replace('{path}', written.path));
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
        const written = await writeSnapshotToSyncDir(profileId, body, localDateString());
        setMessage(pick(lang, UI.writtenTo).replace('{path}', written.path));
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
    } catch (e) {
      setMessage(pick(lang, UI.importFailed).replace('{reason}', pick(lang, importErrorReason(e))));
      return;
    }
    // Whether the applied file then reaches the cloud is a property of the
    // account state, never of which button was pressed (ADR 0007). A failed
    // push keeps the plain local message: the account section below already
    // explains a pending or blocked account.
    if (readSyncState().profileId === getActiveProfileId()) {
      const outcome = await forceSync();
      if (outcome.state === 'ok') {
        setMessage(pick(lang, mode === 'replace' ? UI.replacedSynced : UI.mergedSynced));
        return;
      }
    }
    setMessage(mode === 'replace' ? pick(lang, UI.replaced) : pick(lang, UI.merged));
  }

  function pickFile(mode: 'merge' | 'replace') {
    importMode.current = mode;
    fileInput.current?.click();
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-stone-500 dark:text-stone-400">{pick(lang, UI.datenLead)}</p>
      <section className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
        <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          {t('progress.datenLocal', uiLang)}
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
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
        <p className="mt-3 text-center text-xs text-stone-400">{pick(lang, UI.importCloudNote)}</p>
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
          <p className="mt-3 text-center text-xs text-stone-400">{pick(lang, UI.autoSyncTauri)}</p>
        ) : (
          import.meta.env.DEV && (
            <p className="mt-3 text-center text-xs text-stone-400">{pick(lang, UI.autoSyncDev)}</p>
          )
        )}
        {message && (
          <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">{message}</p>
        )}
      </section>

      {/* Storage diagnostics. Exists because the failure that motivated it — the red
              "Fortschritt konnte nicht geladen werden" card while a healthy 1.7 MB backup
              sat on disk — left the learner with no way to tell a stalled read from lost
              data, and left the author with no evidence at all. Counters and file facts
              only; nothing here is a measurement of learning. */}
      <section className="mt-8 rounded-lg border border-stone-200 p-5 text-sm dark:border-stone-700">
        <h3 className="font-bold">{t('persist.diagTitle', uiLang)}</h3>

        {stalls.length === 0 ? (
          <p className="mt-2 text-stone-500 dark:text-stone-400">{t('persist.diagNone', uiLang)}</p>
        ) : (
          <dl className="mt-2 space-y-1 text-stone-600 dark:text-stone-300">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500 dark:text-stone-400">
                {t('persist.diagCount', uiLang)}
              </dt>
              <dd className="font-semibold tabular-nums">{stalls.length}</dd>
            </div>
            {/* Three rows, not one: reads and writes share this log since ADR 0006, so a
                    single most-recent entry is weak evidence — a stalled grade and a stalled
                    Themen read are different bugs and both want to be visible. */}
            {stalls.slice(0, 3).map((e, i) => (
              <div key={e.id} className="flex justify-between gap-4">
                <dt className="text-stone-500 dark:text-stone-400">
                  {i === 0 ? t('persist.diagLast', uiLang) : ''}
                </dt>
                <dd className="text-right">
                  <span className="font-mono text-xs">{e.surface}</span>{' '}
                  {new Date(e.at).toLocaleString()}{' '}
                  <span className="tabular-nums">
                    ({Math.round(e.waitedMs / 1000)} s, {e.attempts}×)
                  </span>{' '}
                  {e.outcome ? (
                    <span className="font-mono text-xs">
                      {e.phase} · {e.outcome} · queue {e.queueDepth ?? 0} · v{e.build}
                    </span>
                  ) : e.recoveredAfterMs === undefined ? (
                    t('persist.diagNeverSettled', uiLang)
                  ) : (
                    t('persist.diagRecovered', uiLang)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {isTauri() && (
          <p className="mt-3 text-stone-600 dark:text-stone-300">
            <span className="text-stone-500 dark:text-stone-400">
              {t('persist.diagBackup', uiLang)}:
            </span>{' '}
            {backup ? (
              <>
                <span className="tabular-nums">{backup.date}</span> ·{' '}
                <span className="tabular-nums">
                  {backup.cards} / {backup.attempts}
                </span>{' '}
                · <span className="tabular-nums">{Math.round(backup.bytes / 1024)} KB</span>
                <br />
                <span className="break-all font-mono text-xs text-stone-400">{backup.path}</span>
              </>
            ) : (
              t('persist.diagBackupNone', uiLang)
            )}
          </p>
        )}

        {legacyStore && (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            {t('persist.diagStaleStore', uiLang)}
            <br />
            <span className="break-all font-mono text-xs">{legacyStore.path}</span>
            {legacyStore.modifiedAt > 0 && (
              <>
                {' · '}
                <span className="tabular-nums text-xs">
                  {new Date(legacyStore.modifiedAt * 1000).toLocaleDateString()}
                </span>
              </>
            )}
          </p>
        )}
      </section>
      {/* Renders its own cards and asks for the session when mounted. */}
      <AccountPanel />
    </div>
  );
}
