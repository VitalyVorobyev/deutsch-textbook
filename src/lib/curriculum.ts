/** Server-side curriculum loader (usable in .astro frontmatter only — islands get the spine as props). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { atlasSchema, type AtlasNode, type AtlasUnit } from './schemas';

export interface Curriculum {
  /** ordered units — the file order of `units:` in content/atlas.yaml IS the spine order */
  units: AtlasUnit[];
  /** graph nodes with prerequisites, deepens edges and outcomes */
  nodes: AtlasNode[];
  /** every topic id, units flattened in file order — the recommended path */
  spine: string[];
}

let cached: Curriculum | undefined;

/**
 * Parses content/atlas.yaml at build time. Deliberately not a content
 * collection: the file is one document whose array order is meaningful (the
 * spine), while collections model unordered per-entry documents — a plain
 * validated parse keeps both the order and the two-section shape.
 */
export function getCurriculum(): Curriculum {
  if (!cached) {
    const file = join(process.cwd(), 'content', 'atlas.yaml');
    const atlas = atlasSchema.parse(YAML.parse(readFileSync(file, 'utf8')));
    cached = {
      units: atlas.units,
      nodes: atlas.nodes,
      spine: atlas.units.flatMap((u) => u.topics),
    };
  }
  return cached;
}
