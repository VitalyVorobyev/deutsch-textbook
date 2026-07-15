import { useEffect, useRef, useState } from 'react';
import {
  listProfiles,
  getActiveProfileId,
  startProfile,
  switchProfile,
  deleteProfile,
  resolveProfileState,
  type Profile,
} from '../lib/profile';
import { pick, setUiLang } from '../lib/prefs';
import { UI_LANGS } from '../lib/strings';
import { useExplainLang, useUiLang } from './hooks';

/** Explanation-language strings — one hoisted record per file (docs/i18n-design.md).
    `{label}` is replaced by the caller. */
const UI = {
  switchProfile: { en: 'Switch learner profile', ru: 'Сменить профиль' },
  deleteConfirm: {
    en: 'Delete profile “{label}” and all its progress?',
    ru: 'Удалить профиль «{label}» и весь его прогресс?',
  },
  profile: { en: 'Profile', ru: 'Профиль' },
  deleteProfile: { en: 'Delete profile', ru: 'Удалить профиль' },
  uiLanguage: { en: 'Interface language', ru: 'Язык интерфейса' },
  name: { en: 'Name', ru: 'Имя' },
  add: { en: 'Add', ru: 'Добавить' },
  newProfile: { en: 'New profile', ru: 'Новый профиль' },
} as const satisfies Record<string, { en: string; ru: string }>;

/** Header dropdown to switch, create, and delete local learner profiles,
    and the per-profile UI-language (chrome) setting. */
export default function ProfileSwitcher() {
  const lang = useExplainLang();
  const uiLang = useUiLang();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for the first-run/legacy decision — it may seed the registry.
    void resolveProfileState().then(() => {
      setProfiles(listProfiles());
      setActiveId(getActiveProfileId());
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const active = profiles.find((p) => p.id === activeId);

  function handleCreate() {
    const label = newLabel.trim();
    if (!label) return;
    void startProfile(label); // stamps the new database with its identity, then reloads
  }

  function handleDelete(id: string, label: string) {
    const ok = confirm(pick(lang, UI.deleteConfirm).replace('{label}', label));
    if (!ok) return;
    deleteProfile(id); // reloads if the active profile was deleted
    setProfiles(listProfiles());
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold dark:border-stone-600 sm:px-2 sm:py-1"
        aria-haspopup="menu"
        aria-expanded={open}
        title={pick(lang, UI.switchProfile)}
      >
        <span aria-hidden>👤</span>
        <span className="max-w-24 truncate">{active?.label ?? '…'}</span>
        <span aria-hidden className="text-stone-400">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-800"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {pick(lang, UI.profile)}
          </p>
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => (p.id === activeId ? setOpen(false) : switchProfile(p.id))}
                className={`flex-1 rounded px-2 py-1.5 text-left text-sm ${
                  p.id === activeId
                    ? 'font-semibold text-amber-700 dark:text-amber-400'
                    : 'hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
              >
                {p.id === activeId ? '✓ ' : ''}
                {p.label}
              </button>
              {profiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.label)}
                  className="rounded px-1.5 py-1 text-xs text-stone-400 hover:text-red-600"
                  title={pick(lang, UI.deleteProfile)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <div className="mt-1 border-t border-stone-200 pt-1 dark:border-stone-700">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {pick(lang, UI.uiLanguage)}
            </p>
            <div className="flex gap-1 px-2 pb-1" role="group" aria-label={pick(lang, UI.uiLanguage)}>
              {UI_LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setUiLang(l)}
                  className={`flex-1 rounded px-1.5 py-1 text-xs font-semibold uppercase ${
                    l === uiLang
                      ? 'bg-amber-600 text-white'
                      : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1 border-t border-stone-200 pt-1 dark:border-stone-700">
            {adding ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                className="flex items-center gap-1 p-1"
              >
                <input
                  autoFocus
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={pick(lang, UI.name)}
                  className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-900"
                />
                <button
                  type="submit"
                  className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  {pick(lang, UI.add)}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full rounded px-2 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                + {pick(lang, UI.newProfile)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
