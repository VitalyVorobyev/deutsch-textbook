/**
 * Fetching the session pages' shared content files (src/lib/corpus-payload.ts) in the browser.
 *
 * One request per URL per page: SessionFlow, and the flashcard and training steps inside it, ask
 * for the same file, so the promise is shared. A failed request is forgotten, so a retry makes a
 * new one — a cached rejection would turn one dropped connection into a page that can never load.
 */
const inflight = new Map<string, Promise<unknown>>();

export function fetchCorpus<T>(url: string): Promise<T> {
  let request = inflight.get(url);
  if (!request) {
    request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return response.json();
    });
    request.catch(() => inflight.delete(url));
    inflight.set(url, request);
  }
  return request as Promise<T>;
}

/** Tests only: forget every request. */
export function resetCorpusCache(): void {
  inflight.clear();
}
