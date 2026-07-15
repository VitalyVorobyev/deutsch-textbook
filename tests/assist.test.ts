/**
 * The assist library's contract (docs/assist-design.md): the probe self-hides
 * where Ollama cannot answer, reviewDraft's hints are anchored to the draft by
 * the quote filter, garbage earns exactly one corrective retry, and an abort
 * propagates to the caller. All network is mocked — no test talks to Ollama.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  assistHiddenForSession,
  chooseAssistModel,
  hideAssistForSession,
  noteAssistFailure,
  probeAssist,
  resetAssistForTests,
  reviewDraft,
  writeHintsSchema,
  type WriteHints,
} from '../src/lib/assist';
import { ASSIST_MODEL_KEY } from '../src/lib/prefs';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  resetAssistForTests();
  localStorage.clear();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** An Ollama /api/chat reply whose message content is the given JSON. */
function chatReply(content: unknown): Response {
  return jsonResponse({
    message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) },
  });
}

const DRAFT = 'Hallo Jonas! Ich aufstehe um halb sieben. Meine Bruder hilft mir nicht mit die Küche.';

const request = {
  draft: DRAFT,
  taskPrompt: 'Write a short message about your working day.',
  goal: 'Describe your rhythm.',
  requirements: ['Give two clock times with um.'],
  modelAnswer: 'Ich stehe um halb sieben auf.',
  level: 'A2',
  hintLang: 'en' as const,
};

function hint(quote: string): WriteHints['hints'][number] {
  return { quote, category: 'grammar', nudge: 'Which case does *mit* take?' };
}

describe('probeAssist', () => {
  test('reachable Ollama: returns the installed tags, and the result is cached per page load', async () => {
    const fetchMock = mock(async () =>
      jsonResponse({ models: [{ name: 'gemma4:e4b' }, { name: 'llama3:8b' }] }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await probeAssist()).toEqual({ reachable: true, models: ['gemma4:e4b', 'llama3:8b'] });
    expect(await probeAssist()).toEqual({ reachable: true, models: ['gemma4:e4b', 'llama3:8b'] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://localhost:11434/api/tags');
  });

  test('connection refused: unreachable, no models', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    expect(await probeAssist()).toEqual({ reachable: false, models: [] });
  });

  test('no answer within the probe timeout: unreachable', async () => {
    // A fetch that never resolves until its signal aborts — the ~1.2 s probe
    // budget is what ends it.
    globalThis.fetch = mock(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason ?? new Error('aborted')),
          );
        }),
    ) as unknown as typeof fetch;

    expect(await probeAssist()).toEqual({ reachable: false, models: [] });
  });

  test('https page outside Tauri: the probe never runs at all', async () => {
    const happyDom = (globalThis as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM;
    happyDom.setURL('https://deutsch-atlas.example/');
    const fetchMock = mock(async () => jsonResponse({ models: [{ name: 'gemma4:e4b' }] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      expect(await probeAssist()).toEqual({ reachable: false, models: [] });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      happyDom.setURL('about:blank');
    }
  });
});

describe('writeHintsSchema', () => {
  test('rejects more than four hints', () => {
    const five = { praise: 'Gut!', hints: [1, 2, 3, 4, 5].map(() => hint('Ich aufstehe')) };
    expect(writeHintsSchema.safeParse(five).success).toBe(false);
    expect(writeHintsSchema.safeParse({ ...five, hints: five.hints.slice(0, 4) }).success).toBe(true);
  });

  test('rejects a category outside the enum', () => {
    const bad = { praise: 'Gut!', hints: [{ quote: 'x', category: 'style', nudge: 'y' }] };
    expect(writeHintsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('reviewDraft', () => {
  test('happy path: sends the constrained request and returns the parsed hints', async () => {
    const fetchMock = mock(async () =>
      chatReply({ praise: 'Nice rhythm!', hints: [hint('mit die Küche')] }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await reviewDraft(request, { model: 'gemma4:e4b' });

    expect(result).toEqual({ praise: 'Nice rhythm!', hints: [hint('mit die Küche')] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, { method: string; body: string }];
    expect(String(url)).toBe('http://localhost:11434/api/chat');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gemma4:e4b');
    expect(body.stream).toBe(false);
    expect(body.think).toBe(false);
    expect(body.options).toEqual({ temperature: 0.2 });
    expect(body.format.properties.hints.maxItems).toBe(4);
    expect(body.messages[0].role).toBe('system');
    // the item's task, the model answer and the draft all reach the model
    expect(body.messages[1].content).toContain(request.taskPrompt);
    expect(body.messages[1].content).toContain(request.modelAnswer);
    expect(body.messages[1].content).toContain(DRAFT);
    // the rubric names the level ceiling and the hint language
    expect(body.messages[0].content).toContain('A2');
    expect(body.messages[0].content).toContain('English');
  });

  test('quote filter: a hallucinated quote is dropped, anchored ones survive, no retry', async () => {
    const fetchMock = mock(async () =>
      chatReply({
        praise: 'Gut!',
        hints: [hint('mit die Küche'), hint('in der Küche')], // second never written
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await reviewDraft(request, { model: 'gemma4:e4b' });

    expect(result).toEqual({ praise: 'Gut!', hints: [hint('mit die Küche')] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('quotes survive trivial whitespace differences', async () => {
    globalThis.fetch = mock(async () =>
      chatReply({ praise: 'Gut!', hints: [hint('mit  die\nKüche')] }),
    ) as unknown as typeof fetch;

    const result = await reviewDraft(request, { model: 'gemma4:e4b' });
    expect(result?.hints).toHaveLength(1);
  });

  test('every quote hallucinated: retries once with a corrective message, then returns null', async () => {
    const fetchMock = mock(async () =>
      chatReply({ praise: 'Gut!', hints: [hint('der Hund'), hint('')] }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await reviewDraft(request, { model: 'gemma4:e4b' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(
      (fetchMock.mock.calls[1]! as unknown as [string, { body: string }])[1].body,
    );
    // the retry carries the whole exchange plus the corrective user message
    expect(retryBody.messages).toHaveLength(4);
    expect(retryBody.messages[2].role).toBe('assistant');
    expect(retryBody.messages[3].role).toBe('user');
    expect(retryBody.messages[3].content).toContain('verbatim');
  });

  test('the corrective retry can succeed', async () => {
    let call = 0;
    globalThis.fetch = mock(async () => {
      call += 1;
      return call === 1
        ? chatReply({ praise: 'Gut!', hints: [hint('der Hund')] })
        : chatReply({ praise: 'Gut!', hints: [hint('Ich aufstehe')] });
    }) as unknown as typeof fetch;

    const result = await reviewDraft(request, { model: 'gemma4:e4b' });
    expect(result?.hints).toEqual([hint('Ich aufstehe')]);
  });

  test('malformed JSON despite format: one corrective retry, then null', async () => {
    const fetchMock = mock(async () => chatReply('praise: not json'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await reviewDraft(request, { model: 'gemma4:e4b' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('praise with zero hints is a legitimate result, not a retry', async () => {
    const fetchMock = mock(async () => chatReply({ praise: 'Alles gut!', hints: [] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await reviewDraft(request, { model: 'gemma4:e4b' })).toEqual({
      praise: 'Alles gut!',
      hints: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('an HTTP error returns null without a corrective retry', async () => {
    const fetchMock = mock(async () => new Response('model not found', { status: 404 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await reviewDraft(request, { model: 'missing:model' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("the caller's abort propagates out of reviewDraft", async () => {
    globalThis.fetch = mock(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason ?? new Error('aborted')),
          );
        }),
    ) as unknown as typeof fetch;

    const controller = new AbortController();
    const pending = reviewDraft(request, { model: 'gemma4:e4b', signal: controller.signal });
    controller.abort();

    let thrown: unknown;
    try {
      await pending;
    } catch (error) {
      thrown = error;
    }
    expect((thrown as DOMException).name).toBe('AbortError');
  });
});

describe('chooseAssistModel', () => {
  test('prefers the stored choice while it is installed', () => {
    localStorage.setItem(ASSIST_MODEL_KEY, 'llama3:8b');
    expect(chooseAssistModel(['gemma4:e4b', 'llama3:8b'])).toBe('llama3:8b');
  });

  test('falls back to the first gemma tag when the stored model is gone', () => {
    localStorage.setItem(ASSIST_MODEL_KEY, 'mistral:7b');
    expect(chooseAssistModel(['llama3:8b', 'gemma4:e4b'])).toBe('gemma4:e4b');
  });

  test('else the first tag; null when nothing is installed', () => {
    expect(chooseAssistModel(['llama3:8b', 'phi4:mini'])).toBe('llama3:8b');
    expect(chooseAssistModel([])).toBeNull();
  });
});

describe('session hiding', () => {
  test('the second timeout/abort failure hides the feature for the session', () => {
    expect(assistHiddenForSession()).toBe(false);
    noteAssistFailure();
    expect(assistHiddenForSession()).toBe(false);
    noteAssistFailure();
    expect(assistHiddenForSession()).toBe(true);
  });

  test('unusable output hides immediately (the retry already happened inside reviewDraft)', () => {
    hideAssistForSession();
    expect(assistHiddenForSession()).toBe(true);
  });
});
