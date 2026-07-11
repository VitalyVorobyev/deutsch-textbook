/**
 * Local learner profiles (no accounts, no server).
 *
 * Each profile owns an isolated IndexedDB database. There is no built-in
 * default profile: on a fresh install `resolveProfileState()` reports
 * 'first-run' and the FirstRunGate asks for a name. The legacy id `vitaly`
 * is still aliased to the pre-profile `deutsch-atlas` database so historical
 * progress is never migrated or lost. The active profile id and the registry
 * live in localStorage; switching a profile reloads the page so every island
 * remounts against the new database (see src/lib/store.ts `getStore`).
 */

export interface Profile {
  /** slug, `^[a-z0-9-]+$`; also the IndexedDB namespace and the progress/<id>/ folder */
  id: string;
  /** human-facing name shown in the switcher */
  label: string;
}

/** Pre-profile installs stored everything in the `deutsch-atlas` DB under this id. */
export const LEGACY_PROFILE_ID = 'vitaly';

export const PROFILE_KEY = 'da:profile';
export const PROFILES_KEY = 'da:profiles';

/** The IndexedDB database name for a profile — the legacy id aliases the legacy DB. */
export function dbNameFor(id: string): string {
  return id === LEGACY_PROFILE_ID ? 'deutsch-atlas' : `deutsch-atlas--${id}`;
}

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Active profile id — O(1). Falls back to the first registered profile. */
export function getActiveProfileId(): string {
  if (!hasStorage()) return LEGACY_PROFILE_ID;
  const id = localStorage.getItem(PROFILE_KEY);
  if (id) return id;
  return listProfiles()[0]?.id ?? LEGACY_PROFILE_ID;
}

/** All registered profiles; empty on a fresh install (no auto-seeded default). */
export function listProfiles(): Profile[] {
  if (!hasStorage()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? 'null');
  } catch {
    parsed = null;
  }
  return Array.isArray(parsed)
    ? parsed.filter(
        (p): p is Profile =>
          !!p && typeof p.id === 'string' && typeof p.label === 'string' && /^[a-z0-9-]+$/.test(p.id),
      )
    : [];
}

export function getActiveProfile(): Profile {
  const id = getActiveProfileId();
  return listProfiles().find((p) => p.id === id) ?? { id, label: id };
}

function persist(list: Profile[]): void {
  if (hasStorage()) localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Create a profile from a label; returns it (does not switch). Id is unique. */
export function createProfile(label: string): Profile {
  const list = listProfiles();
  const base = slugify(label) || 'profil';
  let id = base;
  for (let n = 2; list.some((p) => p.id === id); n++) id = `${base}-${n}`;
  const profile: Profile = { id, label: label.trim() || id };
  persist([...list, profile]);
  return profile;
}

export function renameProfile(id: string, label: string): void {
  persist(listProfiles().map((p) => (p.id === id ? { ...p, label: label.trim() || p.label } : p)));
}

/** Set the active profile and reload so all islands rebind to its database. */
export function switchProfile(id: string): void {
  if (!hasStorage()) return;
  localStorage.setItem(PROFILE_KEY, id);
  location.reload();
}

/**
 * Delete a profile: drop its IndexedDB database and registry entry. The last
 * remaining profile cannot be deleted. Deleting the active profile switches
 * to the first survivor (which reloads).
 */
export function deleteProfile(id: string): void {
  const rest = listProfiles().filter((p) => p.id !== id);
  if (rest.length === 0) return;
  persist(rest);
  if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(dbNameFor(id));
  if (getActiveProfileId() === id) switchProfile(rest[0].id);
}

let resolved: Promise<'ready' | 'first-run'> | undefined;

/**
 * Decide once per page load whether a profile exists (or legacy pre-profile
 * data could be adopted) or the first-run gate must ask for a name. Shared by
 * the gate and every store access (store.ts awaits it before touching
 * IndexedDB), so legacy detection always runs against an untouched DB.
 */
export function resolveProfileState(): Promise<'ready' | 'first-run'> {
  return (resolved ??= detect());
}

async function detect(): Promise<'ready' | 'first-run'> {
  if (!hasStorage()) return 'ready';
  if (listProfiles().length > 0) return 'ready';
  if (await legacyDbHasData()) {
    // Pre-profile install: adopt the legacy DB as the classic default profile.
    persist([{ id: LEGACY_PROFILE_ID, label: 'Vitaly' }]);
    localStorage.setItem(PROFILE_KEY, LEGACY_PROFILE_ID);
    return 'ready';
  }
  return 'first-run';
}

async function legacyDbHasData(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return false;
    // databases() only lists; opening the legacy DB here would create it
    // without the `progress` object store and break idb-keyval later.
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'deutsch-atlas')) return false;
    const { createStore, keys } = await import('idb-keyval');
    return (await keys(createStore('deutsch-atlas', 'progress'))).length > 0;
  } catch {
    return false;
  }
}
