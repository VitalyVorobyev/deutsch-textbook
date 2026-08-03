/**
 * Worker bindings and secrets.
 *
 * Every secret is optional in the type, and every route that needs one checks
 * before using it. A half-configured deployment must degrade to "sign-in is
 * unavailable" rather than throw — the site itself does not need any of this.
 */
export interface Env {
  /** Static assets (`dist/`). Everything that is not `/api/*` is handed back here. */
  ASSETS: Fetcher;
  DB: D1Database;
  SNAPSHOTS: R2Bucket;

  /** HMAC key for the short-lived OAuth state cookie. */
  SESSION_SECRET?: string;
  /** Comma-separated. A verified email here is created/promoted as an approved owner. */
  OWNER_EMAILS?: string;

  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
