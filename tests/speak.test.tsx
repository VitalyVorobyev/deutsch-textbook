/**
 * The speak item's minimal-ceremony flow: speak (recording optional) → one
 * press → model answer beside the learner's own take. A stopped take plays back
 * automatically (with a visible fallback when autoplay is refused) — hearing
 * yourself is the one real feedback this exercise has — but nothing is gated:
 * the app cannot verify speech, so it never charges steps for feedback it
 * cannot give. The payload contract is locked byte-exact: audio is never
 * persisted, and the logged shape carries no checklist fields.
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

async function recordAndStop(name: RegExp = /Record/) {
  fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(await screen.findByRole('button', { name: /Stop/ }));
}

describe('Speak minimal-ceremony flow', () => {
  test('stopping a recording auto-plays it back', async () => {
    renderSpeak();
    await recordAndStop();
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Your recording')).toBeTruthy();
  });

  test('nothing is gated: Show model works right after stopping — and even without any recording', async () => {
    const { onResult } = renderSpeak();
    await recordAndStop();
    const show = screen.getByRole('button', { name: 'Show model' }) as HTMLButtonElement;
    expect(show.disabled).toBe(false);
    fireEvent.click(show);
    expect(onResult).toHaveBeenCalledTimes(1);
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

  test('the compare screen keeps the take playable beside the model and shows the criteria as text', async () => {
    renderSpeak();
    await recordAndStop();
    fireEvent.click(screen.getByRole('button', { name: 'Show model' }));

    expect(screen.getByLabelText('Your recording')).toBeTruthy();
    expect(screen.getByText(item.model_answer)).toBeTruthy();
    // the checklist renders as guidance, not as buttons to press
    expect(screen.getByText('I said my name.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Met' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  test('a re-record on the compare screen auto-plays; entering compare does not replay the old take', async () => {
    renderSpeak();
    await recordAndStop();
    expect(playMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Show model' }));
    // the same take remounts on the compare screen — no replay
    expect(playMock).toHaveBeenCalledTimes(1);

    await recordAndStop(/Record again/);
    expect(createdUrls.length).toBe(2);
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  test('unmount revokes every created object URL', async () => {
    const { view } = renderSpeak();
    await recordAndStop();
    fireEvent.click(screen.getByRole('button', { name: 'Show model' }));
    await recordAndStop(/Record again/);

    expect(createdUrls.length).toBe(2);
    view.unmount();
    expect(revokedUrls.sort()).toEqual([...createdUrls].sort());
  });

  test('Show model logs exactly the minimal payload shape, once', async () => {
    const { onResult } = renderSpeak();
    await recordAndStop();
    fireEvent.click(screen.getByRole('button', { name: 'Show model' }));

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]![0]).toEqual({
      correct: true,
      given: '',
      evidence: 'practice',
      responseMode: 'spoken-production',
      practice: { kind: 'speaking', recorded: true },
    });
  });

  test('without recording support the flow still works and logs recorded: false', () => {
    removeRecordingSupport();
    const { onResult } = renderSpeak();

    expect(screen.getByText(/Recording is unavailable/)).toBeTruthy();
    expect(document.querySelector('audio')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show model' }));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect((onResult.mock.calls[0]![0] as { practice: { recorded: boolean } }).practice.recorded).toBe(false);
    expect(screen.getByText(item.model_answer)).toBeTruthy();
  });
});
