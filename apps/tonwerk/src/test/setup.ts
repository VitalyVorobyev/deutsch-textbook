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

afterEach(() => {
  cleanup();
});
