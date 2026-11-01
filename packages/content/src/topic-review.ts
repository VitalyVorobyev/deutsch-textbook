/**
 * Whether a topic is reviewed, derived from the review ledger (ADR 0014) — never declared.
 *
 * A topic is reviewed when its manifest and every file holding an element it owns are
 * `owner-reviewed` at their current bytes. A review covers exactly what was read: a file that
 * changes, or a file the topic gains, makes the topic a draft again until that file is read.
 *
 * Pure, so a browser view and the learner build apply the same rule to the statuses they hold.
 */

export interface TopicFilesInput {
  id: string;
  file: string;
}

export interface ElementFileInput {
  topic?: string;
  file: string;
  planned?: true;
}

export interface FileStatusInput {
  file: string;
  status: 'entwurf' | 'claude-reviewed' | 'owner-reviewed' | 'geaendert';
}

export interface TopicReview {
  topic: string;
  /** Every file the topic owns, manifest first. */
  files: string[];
  /** Of those, the files read and accepted at their current bytes. */
  ownerReviewed: number;
  reviewed: boolean;
}

/** The files a topic owns: its manifest, then each file holding one of its elements, each once. */
export function topicFiles(
  topic: TopicFilesInput,
  elements: readonly ElementFileInput[],
): string[] {
  const files = new Set<string>([topic.file]);
  for (const element of elements)
    if (element.topic === topic.id && !element.planned) files.add(element.file);
  return [...files];
}

export function topicReviews(
  topics: readonly TopicFilesInput[],
  elements: readonly ElementFileInput[],
  statuses: readonly FileStatusInput[],
): Map<string, TopicReview> {
  const status = new Map(statuses.map((row) => [row.file, row.status]));
  const byTopic = new Map<string, ElementFileInput[]>();
  for (const element of elements)
    if (element.topic) byTopic.set(element.topic, [...(byTopic.get(element.topic) ?? []), element]);
  return new Map(
    topics.map((topic) => {
      const files = topicFiles(topic, byTopic.get(topic.id) ?? []);
      const ownerReviewed = files.filter((file) => status.get(file) === 'owner-reviewed').length;
      return [
        topic.id,
        { topic: topic.id, files, ownerReviewed, reviewed: ownerReviewed === files.length },
      ];
    }),
  );
}
