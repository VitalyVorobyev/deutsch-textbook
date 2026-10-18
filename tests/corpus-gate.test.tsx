/**
 * The session pages fetch their cards and exercise sets (ADR 0008) instead of receiving them as
 * props, and `CorpusGate` is the one place that decides what a page shows meanwhile. Two things
 * here are silent when broken:
 *
 *  - **A session never mounts on an empty list.** Mounted early, a flashcard session plans
 *    "nothing due" and training "nothing to practise" — confident claims a slow or failed download
 *    must not make (the ADR 0006 rule, applied to content). So the children render only once
 *    every file has arrived.
 *  - **A failure can be retried.** A rejected request that stayed cached would turn one dropped
 *    connection into a page that can never load.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CorpusGate } from '../src/components/session/CorpusIslands';
import { fetchCorpus, resetCorpusCache } from '../src/lib/corpus-client';

const realFetch = globalThis.fetch;
let calls: string[];
let respond: (url: string) => Promise<Response>;
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

beforeEach(() => {
  resetCorpusCache();
  calls = [];
  respond = () => new Promise<Response>(() => {});
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return respond(url);
  }) as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

describe('CorpusGate', () => {
  test('while a file is in flight it shows a status line and never renders the session', () => {
    let rendered = false;
    render(
      <CorpusGate<[string[]]> urls={['/data/cards-a.json']}>
        {() => {
          rendered = true;
          return <p>session</p>;
        }}
      </CorpusGate>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(rendered).toBe(false);
  });

  test('it waits for every file and hands them over in order', async () => {
    respond = (url) => ok(url.includes('cards') ? ['card'] : ['set']);
    render(
      <CorpusGate<[string[], string[]]> urls={['/data/cards-a.json', '/data/sets-b.json']}>
        {([cards, sets]) => <p>{`${cards.join()}|${sets.join()}`}</p>}
      </CorpusGate>,
    );
    await waitFor(() => expect(screen.getByText('card|set')).toBeTruthy());
  });

  test('a failed download shows an error, and retry fetches again', async () => {
    respond = () => Promise.resolve(new Response('', { status: 503 }));
    render(
      <CorpusGate<[string[]]> urls={['/data/cards-a.json']}>
        {([cards]) => <p>{cards.join()}</p>}
      </CorpusGate>,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());

    respond = () => ok(['card']);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('card')).toBeTruthy());
    expect(calls).toEqual(['/data/cards-a.json', '/data/cards-a.json']);
  });
});

describe('fetchCorpus', () => {
  test('two consumers of one file share one request', async () => {
    respond = () => ok(['card']);
    const [a, b] = await Promise.all([
      fetchCorpus('/data/cards-a.json'),
      fetchCorpus('/data/cards-a.json'),
    ]);
    expect(a).toEqual(['card']);
    expect(b).toBe(a);
    expect(calls).toHaveLength(1);
  });
});
