import type { AtlasGroup } from './schemas';
import type { TopicNode } from './mastery';

export function groupChildren(groups: AtlasGroup[]): Map<string | undefined, AtlasGroup[]> {
  const children = new Map<string | undefined, AtlasGroup[]>();
  for (const group of groups) children.set(group.parent, [...(children.get(group.parent) ?? []), group]);
  return children;
}

export function leafGroups(groups: AtlasGroup[]): AtlasGroup[] {
  const parents = new Set(groups.flatMap((group) => group.parent ? [group.parent] : []));
  return groups.filter((group) => !parents.has(group.id));
}

export function groupBreadcrumb(groupId: string, groups: AtlasGroup[]): AtlasGroup[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const path: AtlasGroup[] = [];
  let current = byId.get(groupId);
  while (current) {
    path.unshift(current);
    current = current.parent ? byId.get(current.parent) : undefined;
  }
  return path;
}

export function crossGroupDependencies(groupId: string, topics: TopicNode[]) {
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const own = topics.filter((topic) => topic.group === groupId);
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  for (const topic of own) {
    for (const prerequisite of topic.prerequisites) {
      const source = byId.get(prerequisite);
      if (source?.group && source.group !== groupId) incoming.add(source.group);
    }
  }
  for (const topic of topics) {
    if (topic.group === groupId) continue;
    if (topic.prerequisites.some((id) => own.some((candidate) => candidate.id === id)) && topic.group)
      outgoing.add(topic.group);
  }
  return { incoming: [...incoming], outgoing: [...outgoing] };
}
