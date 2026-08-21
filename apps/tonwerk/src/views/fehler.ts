/**
 * One sentence per failure class, written once.
 *
 * Every view shows the same four failures — the engine is not running, it refused the token, it
 * said no, or it answered something this build cannot read — and a view that phrases them itself
 * ends up phrasing them differently. An error here says what happened and what to do about it; it
 * does not apologise and it is never vague about which of the four it is.
 */
import { EngineError, OfflineError, ShapeError, UnauthorizedError } from '../api';

export function fehlerText(error: Error): string {
  if (error instanceof OfflineError) {
    return 'Keine Verbindung zur Engine unter 127.0.0.1:8765. Starte sie mit `atlas-listening serve`.';
  }
  if (error instanceof UnauthorizedError) {
    return `${error.message} Hol dir den aktuellen Token aus der Ausgabe von \`atlas-listening serve\`.`;
  }
  if (error instanceof ShapeError) {
    return `Die Engine hat auf ${error.path} etwas geantwortet, das dieser Build nicht lesen kann: ${error.detail}`;
  }
  if (error instanceof EngineError) {
    return `Die Engine hat abgelehnt (${error.status}): ${error.message}`;
  }
  return error.message;
}
