/**
 * The Themen page's "where was I" state — filters, search, selection, expanded
 * panels and scroll offset — persisted through src/lib/resume.ts (surface
 * 'themen') so that switching to another main-nav tab and back lands on the
 * same spot. Day expiry and profile scoping come from resume.ts; this module
 * owns the shape and the restore-side validation. This is deliberately *not*
 * the `da:topics-view` preference: the active tab is durable, everything here
 * is ephemeral and restarts clean the next local day.
 *
 * A stored value is learner-editable input: every field is validated against
 * what actually exists (levels, topic ids, group ids) before it is applied,
 * and anything unrecognised silently falls back to its default.
 */
import type { CurriculumStrand } from '@da/schema';
import { STRANDS, type LevelFilter, type StatusFilter } from './course';

export type DrawerState = 'closed' | 'collapsed' | 'open';

export interface ThemenResume {
  query: string;
  atlas: {
    level: LevelFilter;
    strand: CurriculumStrand | 'all';
    selectedId?: string;
    expandedGroup?: string;
    drawer: DrawerState;
  };
  overview: {
    level: LevelFilter;
    status: StatusFilter;
    expandedId?: string;
  };
  scrollY: number;
}

/** What exists right now — restored ids must point at it or be dropped. */
export interface ThemenResumeContext {
  levels: ReadonlySet<string>;
  topicIds: ReadonlySet<string>;
  groupIds: ReadonlySet<string>;
}

export const THEMEN_RESUME_DEFAULTS: ThemenResume = {
  query: '',
  atlas: { level: 'all', strand: 'all', drawer: 'closed' },
  overview: { level: 'all', status: 'all' },
  scrollY: 0,
};

const DRAWER_STATES: readonly DrawerState[] = ['closed', 'collapsed', 'open'];
// Mirrors OverviewTable's STATUSES filter ids ('all' | 'open' | Tier).
const STATUS_FILTERS: readonly StatusFilter[] = [
  'all', 'open', 'untouched', 'read', 'practiced', 'mastered',
];

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** Never trust a stored shape — validate field by field, default the rest. */
export function sanitizeThemenResume(saved: unknown, ctx: ThemenResumeContext): ThemenResume {
  const s = record(saved);
  const atlas = record(s.atlas);
  const overview = record(s.overview);

  const level = (value: unknown): LevelFilter =>
    value === 'all' || (typeof value === 'string' && ctx.levels.has(value))
      ? (value as LevelFilter)
      : 'all';
  const knownId = (value: unknown, ids: ReadonlySet<string>): string | undefined =>
    typeof value === 'string' && ids.has(value) ? value : undefined;

  return {
    query: typeof s.query === 'string' ? s.query.slice(0, 200) : '',
    atlas: {
      level: level(atlas.level),
      strand:
        typeof atlas.strand === 'string' &&
        (STRANDS as readonly string[]).includes(atlas.strand)
          ? (atlas.strand as CurriculumStrand)
          : 'all',
      selectedId: knownId(atlas.selectedId, ctx.topicIds),
      expandedGroup: knownId(atlas.expandedGroup, ctx.groupIds),
      drawer:
        typeof atlas.drawer === 'string' &&
        (DRAWER_STATES as readonly string[]).includes(atlas.drawer)
          ? (atlas.drawer as DrawerState)
          : 'closed',
    },
    overview: {
      level: level(overview.level),
      status:
        typeof overview.status === 'string' &&
        (STATUS_FILTERS as readonly string[]).includes(overview.status)
          ? (overview.status as StatusFilter)
          : 'all',
      expandedId: knownId(overview.expandedId, ctx.topicIds),
    },
    scrollY:
      typeof s.scrollY === 'number' && Number.isFinite(s.scrollY) && s.scrollY > 0
        ? s.scrollY
        : 0,
  };
}
