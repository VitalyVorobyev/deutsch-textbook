/**
 * The review ledger and the shared queue as every view sees them (ADR 0014): each file's status,
 * each topic's review derived from them by `@da/content/topic-review` — the rule the learner build
 * applies too — and the queue's entries.
 *
 * Fetched beside the graph, not inside it: a mark or a queue entry touches no content, so it
 * rebuilds nothing; this provider re-reads both after a write, when the corpus changes, and when a
 * view asks.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from '@vitavision/ui';
import { topicReviews, type TopicReview } from '@da/content/topic-review';
import { corpusClient, type FileReview, type GraphPayload, type QueueEntry } from './data';

interface Reviews {
  files?: FileReview[];
  queue?: QueueEntry[];
  byFile: Map<string, FileReview>;
  topics: Map<string, TopicReview>;
  error?: string;
  reload: () => void;
}

const Context = createContext<Reviews>({
  byFile: new Map(),
  topics: new Map(),
  reload: () => {},
});

export function ReviewsProvider({
  graph,
  revision,
  children,
}: {
  graph?: GraphPayload;
  revision: number;
  children: React.ReactNode;
}) {
  const [files, setFiles] = useState<FileReview[]>();
  const [queue, setQueue] = useState<QueueEntry[]>();
  const [error, setError] = useState<string>();
  const reload = useCallback(() => {
    Promise.all([corpusClient.reviewStatuses(), corpusClient.queue()])
      .then(([rows, entries]) => {
        setFiles(rows);
        setQueue(entries);
        setError(undefined);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => {
    if (graph) reload();
  }, [graph, revision, reload]);

  const value = useMemo<Reviews>(() => {
    const byFile = new Map((files ?? []).map((row) => [row.file, row]));
    const topics =
      graph && files
        ? topicReviews(graph.topics, graph.elements, files)
        : new Map<string, TopicReview>();
    return { files, queue, byFile, topics, error, reload };
  }, [graph, files, queue, error, reload]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReviews(): Reviews {
  return useContext(Context);
}

/** A topic's review as one word for filters and chips; `undefined` while the ledger loads. */
export type TopicStatus = 'reviewed' | 'draft';

export function topicStatus(reviews: Reviews, topicId: string): TopicStatus | undefined {
  const review = reviews.topics.get(topicId);
  return review ? (review.reviewed ? 'reviewed' : 'draft') : undefined;
}

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  reviewed: 'geprüft',
  draft: 'Entwurf',
};

/** A file's review status in the editor's words. */
export const FILE_STATUS: Record<
  FileReview['status'],
  { label: string; tone: 'neutral' | 'brand' | 'ok' | 'warn' }
> = {
  entwurf: { label: 'Entwurf', tone: 'neutral' },
  'claude-reviewed': { label: 'von Claude übergeben', tone: 'brand' },
  'owner-reviewed': { label: 'von dir geprüft', tone: 'ok' },
  geaendert: { label: 'seit Prüfung geändert', tone: 'warn' },
};

/** Mark one file `owner-reviewed` at the revision on screen; the result is a toast. */
export async function markFile(review: FileReview): Promise<boolean> {
  if (!review.current) return false;
  const result = await corpusClient.markReviewed(review.file, review.current);
  if (result.ok)
    toast({ tone: 'success', title: 'Als geprüft markiert', description: review.file });
  else toast({ tone: 'error', title: 'Nicht markiert', description: result.error });
  return result.ok;
}
