/**
 * Local learner profiles (no accounts, no server).
 *
 * Each profile owns an isolated IndexedDB database (`deutsch-atlas--<id>`) and
 * writes its own identity into it, so the browser's databases — not
 * localStorage — are the source of truth for who has learned on this device.
 * localStorage merely caches the registry and the active id.
 *
 * There is no built-in default profile: on a fresh open `resolveProfileState()`
 * reports 'first-run' and the FirstRunGate asks who the learner is. It offers to
 * reconnect anything `discoverProfiles()` finds in this browser, including the
 * unnamed pre-profile database, which the learner claims by giving it a name.
 * Switching a profile reloads the page so every island remounts against the new
 * database (see src/lib/store.ts `getStore`).
 */

export interface Profile {
  /** slug, `^[a-z0-9-]+$`; also the progress/<id>/ folder name */
  id: string;
  /** human-facing name shown in the switcher */
  label: string;
  /** IndexedDB name; absent on registry entries written before this field existed */
  db?: string;
}

/** Identity record every profile writes into its own database, under the key `profile`. */
export interface ProfileRecord {
  id: string;
  label: string;
  createdAt: number;
}

/** A database found in this browser that holds progress — a learner we can reconnect. */
export interface DiscoveredProfile {
  /** IndexedDB name */
  db: string;
  /** from the database's identity record, or derived from its name; absent = never named */
  id?: string;
  /** from the identity record; absent on databases written before identity records existed */
  label?: string;
  attempts: number;
  /** newest attempt timestamp, for "last active" in the gate */
  lastActivity?: number;
}

const DB_PREFIX = 'deutsch-atlas--';
/** Pre-profile installs kept everything in this one, unnamed database. */
export const UNNAMED_DB = 'deutsch-atlas';
/** The object store inside every profile database. */
const STORE_NAME = 'progress';
/** Only reachable without localStorage — so no personal name is ever invented. */
const ANON_PROFILE_ID = 'local';
/**
 * The first profiles release adopted the unnamed database under this id instead of
 * asking for a name, and its registry entries carry no `db` field. Registries in the
 * wild still have it, so `dbNameFor` keeps resolving it to the unnamed database.
 */
const PRE_DB_FIELD_ID = 'vitaly';

export const PROFILE_KEY = 'da:profile';
export const PROFILES_KEY = 'da:profiles';

/** The IndexedDB database name for a profile: what the registry says, else derived from the id. */
export function dbNameFor(id: string): string {
  const registered = listProfiles().find((p) => p.id === id);
  if (registered?.db) return registered.db;
  if (id === PRE_DB_FIELD_ID) return UNNAMED_DB;
  return `${DB_PREFIX}${id}`;
}

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Active profile id — O(1). Falls back to the first registered profile. */
export function getActiveProfileId(): string {
  if (!hasStorage()) return ANON_PROFILE_ID;
  const id = localStorage.getItem(PROFILE_KEY);
  if (id) return id;
  return listProfiles()[0]?.id ?? ANON_PROFILE_ID;
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

/**
 * Register a profile from a label; returns it (does not switch, does not stamp
 * its database — use `startProfile`/`reconnectProfile`). The id is unique and
 * derived from the name, so entering the same name in a browser that still holds
 * the data reconnects to the same database. Pass `db` to bind the profile to a
 * database discovery found instead of a fresh one.
 */
function createProfile(label: string, opts: { db?: string } = {}): Profile {
  const list = listProfiles();
  const base = slugify(label) || 'profil';
  let id = base;
  for (let n = 2; list.some((p) => p.id === id); n++) id = `${base}-${n}`;
  const profile: Profile = { id, label: label.trim() || id, db: opts.db ?? `${DB_PREFIX}${id}` };
  persist([...list, profile]);
  return profile;
}

export function renameProfile(id: string, label: string): void {
  const next = listProfiles().map((p) => (p.id === id ? { ...p, label: label.trim() || p.label } : p));
  persist(next);
  const renamed = next.find((p) => p.id === id);
  if (renamed) void writeIdentity(renamed);
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
  const db = dbNameFor(id); // resolve while the entry still names its database
  persist(rest);
  if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(db);
  if (getActiveProfileId() === id) switchProfile(rest[0].id);
}

// ---------------------------------------------------------------------------
// The database side: identity records + discovery
// ---------------------------------------------------------------------------

/**
 * Write the profile's identity into its own database, so a browser that lost
 * localStorage (or never had a registry) can still tell who this database
 * belongs to. Bypasses src/lib/store.ts on purpose: `getStore()` parks every
 * operation while the first-run gate is up, and this write happens right then.
 */
async function writeIdentity(profile: Profile): Promise<void> {
  try {
    const { createStore, set } = await import('idb-keyval');
    const record: ProfileRecord = {
      id: profile.id,
      label: profile.label,
      createdAt: Date.now(),
    };
    await set('profile', record, createStore(profile.db ?? dbNameFor(profile.id), STORE_NAME));
  } catch {
    // A database without an identity record still works — discovery falls back
    // to its name — so never let this block the learner from starting.
  }
}

/** Create a brand-new profile, stamp its database, and make it active (reloads). */
export async function startProfile(label: string): Promise<void> {
  const profile = createProfile(label);
  await writeIdentity(profile);
  switchProfile(profile.id);
}

/**
 * Register a discovered database as a profile and make it active (reloads).
 * `label` names a database that never had a name (the pre-profile one); for an
 * already-named database its own id is kept, so card history and the
 * progress/<id>/ folder stay stable.
 */
export async function reconnectProfile(found: DiscoveredProfile, label?: string): Promise<void> {
  const name = (label ?? '').trim() || found.label || found.id || '';
  let profile: Profile;
  if (found.id) {
    profile = { id: found.id, label: name || found.id, db: found.db };
    persist([...listProfiles().filter((p) => p.id !== found.id), profile]);
  } else {
    profile = createProfile(name, { db: found.db });
  }
  await writeIdentity(profile); // backfills databases written before identity records
  switchProfile(profile.id);
}

let discovered: Promise<DiscoveredProfile[]> | undefined;

/** Learners already saved in this browser, newest activity first. Memoized per page load. */
export function discoverProfiles(): Promise<DiscoveredProfile[]> {
  return (discovered ??= discover());
}

async function discover(): Promise<DiscoveredProfile[]> {
  try {
    // databases() only lists. Opening a database that does not exist would create
    // it without the `progress` object store and break idb-keyval later, so we
    // never touch a name this did not return. (Absent in older Firefox: no
    // discovery there, but name → id → database is deterministic, so typing the
    // same name still reconnects.)
    if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return [];
    const names = (await indexedDB.databases())
      .map((d) => d.name)
      .filter((n): n is string => !!n && (n === UNNAMED_DB || n.startsWith(DB_PREFIX)));
    if (names.length === 0) return [];

    const { createStore, get } = await import('idb-keyval');
    const found = await Promise.all(names.map((name) => inspect(name, createStore, get)));
    return found
      .filter((f): f is DiscoveredProfile => f !== null)
      .sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));
  } catch {
    return [];
  }
}

type CreateStore = typeof import('idb-keyval').createStore;
type Get = typeof import('idb-keyval').get;

/** Read a database's identity and volume; null when it holds nothing worth reconnecting. */
async function inspect(db: string, createStore: CreateStore, get: Get): Promise<DiscoveredProfile | null> {
  const store = createStore(db, STORE_NAME);
  const record = await get<ProfileRecord>('profile', store);
  const attempts = (await get<{ ts: number }[]>('attempts', store)) ?? [];
  const cards = (await get<Record<string, unknown>>('cards', store)) ?? {};
  if (!record && attempts.length === 0 && Object.keys(cards).length === 0) return null;

  return {
    db,
    id: record?.id ?? (db.startsWith(DB_PREFIX) ? db.slice(DB_PREFIX.length) : undefined),
    label: record?.label,
    attempts: attempts.length,
    lastActivity: attempts.reduce((max, a) => (a.ts > max ? a.ts : max), 0) || undefined,
  };
}

// ---------------------------------------------------------------------------
// First-run decision
// ---------------------------------------------------------------------------

let resolved: Promise<'ready' | 'first-run'> | undefined;

/**
 * Decide once per page load whether a profile exists or the first-run gate must
 * ask who the learner is. Shared by the gate and every store access (store.ts
 * awaits it before touching IndexedDB), so no stray database is ever created
 * before the gate has had its say.
 */
export function resolveProfileState(): Promise<'ready' | 'first-run'> {
  return (resolved ??= detect());
}

async function detect(): Promise<'ready' | 'first-run'> {
  if (!hasStorage()) return 'ready';
  return listProfiles().length > 0 ? 'ready' : 'first-run';
}
