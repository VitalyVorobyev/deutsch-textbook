/**
 * Pure SVG layout for the Atlas map (no DOM, deterministic).
 *
 * Level bands are stacked vertically in the order their levels first appear in
 * `units` (the spine is validated to keep A1 units before A2, so that order IS
 * the level order). Inside a band each unit owns one column, in spine order —
 * left→right is the recommended path. A multi-topic unit stacks its topics
 * vertically in its column.
 *
 * All coordinates are in one SVG/CSS pixel space, origin top-left.
 */

export interface LayoutUnit {
  id: string;
  level: string;
  /** topic ids in teaching order — stacked top→bottom inside the unit's column */
  topics: string[];
}

export interface LayoutGraphNode {
  id: string;
  prerequisites: string[];
  /** base topics this one revisits at greater depth (spiral learning) */
  deepens?: string[];
}

export type EdgeKind = 'prerequisite' | 'deepens';

export interface PlacedNode {
  id: string;
  level: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** SVG path data (cubic bezier) in the map's coordinate space */
  d: string;
}

export interface PlacedBand {
  level: string;
  y: number;
  height: number;
}

export interface AtlasLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  bands: PlacedBand[];
}

export const NODE_W = 176;
export const NODE_H = 84;
const COL_GAP = 56;
const ROW_GAP = 24;
export const PAD_X = 24;
/** label zone at the top of each band — also the empty space long same-band edges arc through */
export const BAND_LABEL_H = 44;
const BAND_PAD_BOTTOM = 24;
const BAND_GAP = 16;

interface Slot {
  band: number;
  col: number;
}

/** `shift` moves the anchors sideways so a deepens edge that shares both
    endpoints with a prerequisite edge doesn't vanish underneath it. */
function edgePath(from: PlacedNode, to: PlacedNode, a: Slot, b: Slot, shift: number): string {
  if (a.band === b.band) {
    // Same band: the source is earlier in the spine, i.e. further left —
    // route from its right edge to the target's left edge.
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2 + shift;
    const x2 = to.x;
    const y2 = to.y + to.h / 2 + shift;
    if (Math.abs(b.col - a.col) > 1) {
      // Skipping ≥1 column: arc through the band's label zone instead of
      // running straight through the nodes in between.
      const cy = Math.min(from.y, to.y) - 28;
      return `M ${x1} ${y1} C ${x1 + 40} ${cy}, ${x2 - 40} ${cy}, ${x2} ${y2}`;
    }
    const dx = Math.max((x2 - x1) / 2, 24);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }
  // Cross-band: the source's band is above — bottom center → top center.
  const x1 = from.x + from.w / 2 + shift;
  const y1 = from.y + from.h;
  const x2 = to.x + to.w / 2 + shift;
  const y2 = to.y;
  const dy = Math.max((y2 - y1) / 2, 24);
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}

/**
 * Positions every topic of every unit and routes one edge per prerequisite /
 * deepens reference. Edges whose endpoints are not placed (a graph node whose
 * topic is in no unit) are skipped rather than invented.
 */
export function layoutAtlas(units: LayoutUnit[], graph: LayoutGraphNode[]): AtlasLayout {
  const bandLevels: string[] = [];
  for (const u of units) if (!bandLevels.includes(u.level)) bandLevels.push(u.level);

  const nodes: PlacedNode[] = [];
  const bands: PlacedBand[] = [];
  const slots = new Map<string, Slot>();

  let y = 0;
  let width = 0;
  bandLevels.forEach((level, band) => {
    const bandUnits = units.filter((u) => u.level === level);
    const rows = Math.max(...bandUnits.map((u) => u.topics.length));
    const height = BAND_LABEL_H + rows * NODE_H + (rows - 1) * ROW_GAP + BAND_PAD_BOTTOM;
    bands.push({ level, y, height });
    bandUnits.forEach((unit, col) => {
      unit.topics.forEach((id, row) => {
        nodes.push({
          id,
          level,
          x: PAD_X + col * (NODE_W + COL_GAP),
          y: y + BAND_LABEL_H + row * (NODE_H + ROW_GAP),
          w: NODE_W,
          h: NODE_H,
        });
        slots.set(id, { band, col });
      });
    });
    width = Math.max(width, PAD_X * 2 + bandUnits.length * (NODE_W + COL_GAP) - COL_GAP);
    y += height + BAND_GAP;
  });

  const placed = new Map(nodes.map((n) => [n.id, n]));
  const edges: PlacedEdge[] = [];
  for (const node of graph) {
    const to = placed.get(node.id);
    if (!to) continue;
    const link = (fromId: string, kind: EdgeKind) => {
      const from = placed.get(fromId);
      if (!from) return;
      // a deepens target may also be a prerequisite — nudge so both edges show
      const shift = kind === 'deepens' && node.prerequisites.includes(fromId) ? 12 : 0;
      edges.push({
        from: fromId,
        to: node.id,
        kind,
        d: edgePath(from, to, slots.get(fromId)!, slots.get(node.id)!, shift),
      });
    };
    for (const p of node.prerequisites) link(p, 'prerequisite');
    for (const d of node.deepens ?? []) link(d, 'deepens');
  }

  return { width, height: Math.max(y - BAND_GAP, 0), nodes, edges, bands };
}
