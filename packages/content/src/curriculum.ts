/** Server-side curriculum loader (usable in .astro frontmatter only — islands get the spine as props). */
import { readFileSync } from 'node:fs';
import { repoRoot } from './repo-root';
import { join } from 'node:path';
import YAML from 'yaml';
import {
  atlasSchema,
  topicManifestSchema,
  type AtlasGroup,
  type AtlasUnit,
  type TopicManifest,
} from '@da/schema';
import { manifestFiles } from './topics';

export interface Curriculum {
  /** ordered units — the file order of `units:` in content/atlas.yaml IS the spine order */
  units: AtlasUnit[];
  groups: AtlasGroup[];
  /** every topic, in spine order, with its prerequisites, deepens edges, outcomes and elements */
  nodes: TopicManifest[];
  /** every topic id, units flattened in file order — the recommended path */
  spine: string[];
}

let cached: Curriculum | undefined;

/**
 * Parses `content/atlas.yaml` plus the 49 `content/topics/<level>/<id>.topic.yaml` manifests at
 * build time.
 *
 * Deliberately not content collections: the atlas is one document whose array order is meaningful
 * (the spine), while collections model unordered per-entry documents. The manifests could be a
 * collection, but then the spine and the topics it orders would be loaded by two different
 * mechanisms, and only one of them would be reachable from `scripts/`.
 *
 * `nodes` is emitted in spine order rather than filename order. Nothing depended on the old
 * `nodes:` array order — every consumer looks a topic up by id — but an order that is an accident
 * of the filesystem is one nobody can rely on later.
 */
export function getCurriculum(): Curriculum {
  if (!cached) {
    const root = repoRoot();
    const atlas = atlasSchema.parse(
      YAML.parse(readFileSync(join(root, 'content', 'atlas.yaml'), 'utf8')),
    );
    const byId = new Map<string, TopicManifest>();
    for (const file of manifestFiles(root)) {
      const manifest = topicManifestSchema.parse(YAML.parse(readFileSync(file, 'utf8')));
      byId.set(manifest.id, manifest);
    }
    const spine = atlas.units.flatMap((u) => u.topics);
    cached = {
      units: atlas.units,
      groups: atlas.groups,
      // A topic missing from the spine is a validator failure, not something to paper over here;
      // filtering keeps the type honest for the build that runs before validation.
      nodes: spine.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
      spine,
    };
  }
  return cached;
}
