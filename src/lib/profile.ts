/**
 * Local learner profiles (no accounts, no server).
 *
 * Each profile owns an isolated IndexedDB database. The DEFAULT profile is
 * aliased to the legacy `deutsch-atlas` database so pre-profile progress is
 * never migrated or lost. The active profile id and the registry live in
 * localStorage; switching a profile reloads the page so every island remounts
 * against the new database (see src/lib/store.ts `getStore`).
 */

export interface Profile {
  /** slug, `^[a-z0-9-]+$`; also the IndexedDB namespace and the progress/<id>/ folder */
  id: string;
  /** human-facing name shown in the switcher */
  label: string;
}

export const DEFAULT_PROFILE_ID = 'vitaly';
const DEFAULT_PROFILE: Profile = { id: DEFAULT_PROFILE_ID, label: 'Vitaly' };

export const PROFILE_KEY = 'da:profile';
export const PROFILES_KEY = 'da:profiles';

/** The IndexedDB database name for a profile — default aliases the legacy DB. */
export function dbNameFor(id: string): string {
  return id === DEFAULT_PROFILE_ID ? 'deutsch-atlas' : `deutsch-atlas--${id}`;
}

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Active profile id — O(1), reads a single key. Falls back to the default. */
export function getActiveProfileId(): string {
  if (!hasStorage()) return DEFAULT_PROFILE_ID;
  return localStorage.getItem(PROFILE_KEY) || DEFAULT_PROFILE_ID;
}

/** All profiles, always including the default; seeds/repairs the registry. */
export function listProfiles(): Profile[] {
  if (!hasStorage()) return [DEFAULT_PROFILE];
  let parsed: unknown;
  try {
    parsed = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? 'null');
  } catch {
    parsed = null;
  }
  const list = Array.isArray(parsed)
    ? parsed.filter(
        (p): p is Profile =>
          !!p && typeof p.id === 'string' && typeof p.label === 'string' && /^[a-z0-9-]+$/.test(p.id),
      )
    : [];
  if (!list.some((p) => p.id === DEFAULT_PROFILE_ID)) {
    list.unshift(DEFAULT_PROFILE);
    persist(list);
  }
  return list;
}

export function getActiveProfile(): Profile {
  const id = getActiveProfileId();
  return listProfiles().find((p) => p.id === id) ?? DEFAULT_PROFILE;
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
 * Delete a profile: drop its IndexedDB database and registry entry. The default
 * profile cannot be deleted. Deleting the active profile switches to the
 * default (which reloads).
 */
export function deleteProfile(id: string): void {
  if (id === DEFAULT_PROFILE_ID) return;
  persist(listProfiles().filter((p) => p.id !== id));
  if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(dbNameFor(id));
  if (getActiveProfileId() === id) switchProfile(DEFAULT_PROFILE_ID);
}
