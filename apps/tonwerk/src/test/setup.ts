import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * happy-dom gives the specs a DOM but not a URL object store: `URL.createObjectURL` is what the
 * blob path in `useEngine` calls, and without it a portrait or a demo take throws instead of
 * rendering. A counter rather than a no-op, so a test can tell one blob from another.
 */
let blobs = 0;
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:tonwerk/${++blobs}`;
  URL.revokeObjectURL = () => {};
}

/**
 * happy-dom implements no `window.confirm`, and the dirty guard is built on one. A default that
 * *allows* the navigation is the right stand-in: a spec that forgets to stub it then behaves like
 * a person who clicked through, which is the failure a missing guard produces — so a guard test
 * that stops working fails rather than passing on the absence of a function.
 */
if (typeof window.confirm !== 'function') {
  window.confirm = () => true;
}

afterEach(() => {
  cleanup();
});
