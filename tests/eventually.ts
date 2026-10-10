/**
 * Poll a condition until it holds or a deadline passes — for tests of timer-driven recovery.
 *
 * A fixed `Bun.sleep(n)` before asserting a timer chain's outcome encodes the speed of the machine
 * it was written on. The Windows release lane is slower, and twice a test that slept just past
 * the production budget asserted before the chain had finished (`managed-store`, 0.6.1). The bound
 * here is generous on purpose: it only costs time when the code is actually broken.
 */
export async function eventually(condition: () => boolean, timeoutMs = 3000, stepMs = 5): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`condition did not hold within ${timeoutMs} ms`);
    await Bun.sleep(stepMs);
  }
}
