/**
 * The speak item's feedback loop: a stopped recording plays back automatically
 * (with a visible fallback when autoplay is refused), the stage advance is gated
 * on having heard the take once, and reflect/reassess keep the take(s) playable
 * beside the model answer. The payload contract is locked byte-exact: audio is
 * never persisted, and the logged shape must not change.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Speak } from '../src/components/exercises/Speak';

class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: MediaStream) {}
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['ich spreche'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const realPlay = HTMLMediaElement.prototype.play;
const realCreateObjectURL = URL.createObjectURL;
const realRevokeObjectURL = URL.revokeObjectURL;

let createdUrls: string[] = [];
let revokedUrls: string[] = [];
let playMock = mock(async () => {});

beforeEach(() => {
  createdUrls = [];
  revokedUrls = [];
  playMock = mock(async () => {});
  HTMLMediaElement.prototype.play = playMock as unknown as typeof realPlay;
  (globalThis as Record<string, unknown>).MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: mock(async () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream),
    },
  });
  URL.createObjectURL = mock(() => {
    const url = `blob:mock-${createdUrls.length + 1}`;
    createdUrls.push(url);
    return url;
  }) as unknown as typeof realCreateObjectURL;
  URL.revokeObjectURL = mock((url: string) => { revokedUrls.push(url); }) as unknown as typeof realRevokeObjectURL;
});

afterEach(() => {
  cleanup();
  HTMLMediaElement.prototype.play = realPlay;
  delete (globalThis as Record<string, unknown>).MediaRecorder;
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  URL.createObjectURL = realCreateObjectURL;
  URL.revokeObjectURL = realRevokeObjectURL;
});

function removeRecordingSupport() {
  delete (globalThis as Record<string, unknown>).MediaRecorder;
  delete (navigator as unknown as Record<string, unknown>).mediaDevices;
}

const item = {
  id: 'vorstellen',
  revision: 1,
  outcomes: [],
  preview: false,
  type: 'speak' as const,
  mode: 'spoken-production' as const,
  prompt: { en: 'Introduce yourself.', ru: 'Представьтесь.' },
  goal: { en: 'Say your name and where you live.', ru: 'Назовите имя и где вы живёте.' },
  checklist: [{ en: 'I said my name.', ru: 'Я назвал(а) имя.' }],
  model_answer: 'Ich heiße Anna und wohne in Bremen.',
  model_translation: { en: 'My name is Anna and I live in Bremen.', ru: 'Меня зовут Анна, я живу в Бремене.' },
};

function renderSpeak(onResult = mock()) {
  const view = render(<Speak
    item={item}
    lang="en"
    onResult={onResult}
    locked={false}
    onNext={() => {}}
    nextLabel="Next"
  />);
  return { onResult, view };
}

async function recordAndStop() {
  fireEvent.click(screen.getByRole('button', { name: /Record/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Stop/ }));
}

/** Drive the current take's `ended` event — what the listen gate waits for. */
function finishListening(label = 'Your recording') {
  fireEvent(screen.getByLabelText(label), new Event('ended'));
}

describe('Speak feedback loop', () => {
  test('stopping a recording auto-plays it back', async () => {
    renderSpeak();
    await recordAndStop();
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Your recording')).toBeTruthy();
  });

  test('the stage advance stays disabled until the take has been heard to the end', async () => {
    renderSpeak();
    await recordAndStop();
    const advance = screen.getByRole('button', { name: 'Compare with model' }) as HTMLButtonElement;
    expect(advance.disabled).toBe(true);
    finishListening();
    expect(advance.disabled).toBe(false);
  });

  test('a refused autoplay falls back to a visible listen button that retries play()', async () => {
    let callCount = 0;
    playMock = mock(async () => {
      callCount += 1;
      if (callCount === 1) throw new DOMException('autoplay refused', 'NotAllowedError');
    });
    HTMLMediaElement.prototype.play = playMock as unknown as typeof realPlay;

    renderSpeak();
    await recordAndStop();
    // The rejection lands on the microtask queue right after the autoplay effect.
    await act(async () => {});
    const listen = await screen.findByRole('button', { name: /Listen to your recording/ });
    fireEvent.click(listen);
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  test('reflect keeps the recording playable beside the model answer', async () => {
    renderSpeak();
    await recordAndStop();
    finishListening();
    fireEvent.click(screen.getByRole('button', { name: 'Compare with model' }));

    expect(screen.getByLabelText('Your recording')).toBeTruthy();
    expect(screen.getByText(item.model_answer)).toBeTruthy();
  });

  test('the second attempt keeps the first take; reassess offers both takes', async () => {
    renderSpeak();
    await recordAndStop();
    const firstUrl = createdUrls[0];
    finishListening();
    fireEvent.click(screen.getByRole('button', { name: 'Compare with model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try an improved version' }));

    expect(revokedUrls).not.toContain(firstUrl);
    expect(screen.getByLabelText('First recording')).toBeTruthy();

    await recordAndStop();
    finishListening();
    fireEvent.click(screen.getByRole('button', { name: 'Check the second attempt' }));

    expect(screen.getByLabelText('First recording')).toBeTruthy();
    expect(screen.getByLabelText('Improved recording')).toBeTruthy();
  });

  test('unmount revokes every created object URL', async () => {
    const { view } = renderSpeak();
    await recordAndStop();
    finishListening();
    fireEvent.click(screen.getByRole('button', { name: 'Compare with model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try an improved version' }));
    await recordAndStop();

    expect(createdUrls.length).toBe(2);
    view.unmount();
    expect(revokedUrls.sort()).toEqual([...createdUrls].sort());
  });

  test('the full walk logs exactly the unchanged payload shape, once', async () => {
    const { onResult } = renderSpeak();
    await recordAndStop();
    finishListening();
    fireEvent.click(screen.getByRole('button', { name: 'Compare with model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try an improved version' }));
    await recordAndStop();
    finishListening();
    fireEvent.click(screen.getByRole('button', { name: 'Check the second attempt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save attempt' }));

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toEqual({
      correct: true,
      given: '',
      evidence: 'practice',
      responseMode: 'spoken-production',
      practice: { kind: 'speaking', recorded: true, before: ['met'], after: ['met'] },
    });
  });

  test('without recording support the flow completes ungated and logs recorded: false', () => {
    removeRecordingSupport();
    const { onResult } = renderSpeak();

    expect(screen.getByText(/Recording is unavailable/)).toBeTruthy();
    expect(document.querySelector('audio')).toBeNull();

    const advance = screen.getByRole('button', { name: 'Compare with model' }) as HTMLButtonElement;
    expect(advance.disabled).toBe(false);
    fireEvent.click(advance);
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try an improved version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check the second attempt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Met' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save attempt' }));

    expect(onResult).toHaveBeenCalledTimes(1);
    expect((onResult.mock.calls[0][0] as { practice: { recorded: boolean } }).practice.recorded).toBe(false);
  });
});
