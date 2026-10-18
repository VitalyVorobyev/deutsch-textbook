/**
 * Who is reviewing, remembered between scenes.
 *
 * A batch of 85 approvals is 85 times the same name typed into the same field, and a field that
 * has to be retyped is a field that eventually gets an initial. The name is the provenance record
 * — it is written verbatim into the published manifest — so making it easy to give correctly is
 * part of making it mean something.
 *
 * **Remembered here and not on the engine.** The engine does keep an `editor.txt` beside the
 * database (`remember_editor`, written on every approval), but it publishes no way to read it
 * back: the only reader was the deleted HTML approval form. Rather than add an endpoint for a
 * convenience, the browser keeps its own copy — the same place and the same failure mode as the
 * bearer token, and the engine's file stays what it always was, a local record of who reviews on
 * this machine.
 *
 * It is a **prefill and never a default**: the field is always visible, always editable, and an
 * approval with an empty name is refused by the engine before anything is stored.
 */

const KEY = 'tonwerk:pruefer';

export function gemerkterPruefer(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    // A browser with site data blocked. The name is then typed once per scene, which is the
    // behaviour before this module existed and is not a failure worth reporting.
    return '';
  }
}

export function merkePruefer(name: string): void {
  const sauber = name.trim();
  try {
    if (sauber) window.localStorage.setItem(KEY, sauber);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* nothing persisted; this session still has what was typed */
  }
}
