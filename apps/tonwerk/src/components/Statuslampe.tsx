/**
 * Die Statuslampe — the Pegel at row scale.
 *
 * Two dimensions, and each one carries a fact rather than a decoration:
 *
 * * **The ring says whose move it is next.** Grey nobody, cyan the machine, brass a person.
 * * **The core says what verdict has been recorded.** Empty means none yet.
 *
 * That makes three readings worth naming. `awaiting_approval` is a brass ring around a cyan core:
 * the machine has given its verdict and the next move belongs to a human. `published` is brass on
 * brass with a halo — the only lit state, and the only one that means the audio left the building.
 * `stale` is a brass ring around a red core: an approval that no longer covers the bytes, which is
 * exactly what the word means and the reason the colour system is worth the trouble.
 *
 * The label is German. The `data-status` attribute keeps the engine's own word, which is what the
 * stylesheet keys on and what a test can assert without depending on a translation.
 */
import { STATUS_LABEL, STATUS_MEANING, isRegistryStatus } from '../contracts';

export function Statuslampe({ status }: { status: string }): React.JSX.Element {
  const known = isRegistryStatus(status);
  return (
    <span
      className="lampe"
      data-status={status}
      title={known ? STATUS_MEANING[status] : 'Ein Status, den dieser Build nicht kennt.'}
    >
      <span className="lampe-glas" aria-hidden="true" />
      {known ? STATUS_LABEL[status] : status}
    </span>
  );
}
