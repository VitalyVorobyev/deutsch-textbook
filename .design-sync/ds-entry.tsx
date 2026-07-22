// Bundle entry for the claude.ai/design sync.
//
// Deutsch-Atlas is an Astro application, not a published component library, so
// there is no dist/ entry to bundle. This file is the entry instead: it
// re-exports the components that render from props alone — no IndexedDB store,
// no learner profile, no session state — which is exactly the set that can
// render inside a design tool. Everything omitted here is omitted because it
// reads the store at mount and would render empty or throw.
//
// Keep this list in sync with `componentSrcMap` in config.json: that map is
// what decides which components get preview cards, this file is what decides
// what lands in window.DeutschAtlas.

// ── Exercise item renderers ────────────────────────────────────────────────
export { Cloze } from '../src/components/exercises/Cloze';
export { MultipleChoice } from '../src/components/exercises/MultipleChoice';
export { Match } from '../src/components/exercises/Match';
export { Order } from '../src/components/exercises/Order';
export { TableFill } from '../src/components/exercises/TableFill';
export { Translate } from '../src/components/exercises/Translate';
export { Listen } from '../src/components/exercises/Listen';
export { default as DocumentStimulus } from '../src/components/exercises/DocumentStimulus';

// ── Shared exercise primitives ─────────────────────────────────────────────
export { ActionRow, Feedback, Instruction, Translation } from '../src/components/exercises/shared';

// ── Topic status badges ────────────────────────────────────────────────────
export { TierBadge, SelfAssessedMark, PlacedMark } from '../src/components/topic/TierBadge';
export { EvidenceChips, EvidenceChipRow } from '../src/components/topic/EvidenceChips';

// ── Progress ───────────────────────────────────────────────────────────────
export { Sparkline } from '../src/components/progress/Sparkline';
export { TopicProgressList } from '../src/components/progress/TopicProgressList';

// ── Atlas ──────────────────────────────────────────────────────────────────
export { TopicDetail } from '../src/components/atlas/TopicDetail';

// ── Controls ───────────────────────────────────────────────────────────────
export { default as SpeakerButton } from '../src/components/SpeakerButton';
