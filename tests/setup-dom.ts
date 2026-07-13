/**
 * A DOM for the component tests. The pure-logic suites neither use nor notice it.
 *
 * `speechSynthesis` is deliberately absent: SpeakerButton renders null without it
 * (ttsAvailable(), src/lib/speech.ts), which is what we want in a test.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
