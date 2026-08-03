-- Device pairing: the desktop app's way to obtain a device token without the
-- learner carrying a 43-character secret between two machines by hand.
--
-- Shaped after the OAuth 2.0 Device Authorization Grant (RFC 8628) and split
-- into two credentials for the reason that RFC splits them:
--
--   id         sha256 of the *device code* — the long secret the desktop keeps
--              and polls with. Never displayed, never typed, hashed at rest for
--              the same reason sessions and device tokens are.
--   user_code  the short, human one. It is only ever entered by someone who is
--              already signed in, and on its own it redeems nothing: approving
--              a request hands the token to whoever holds the device code.
--
-- Guessing `user_code` therefore buys an attacker the ability to have their own
-- pairing approved by a confused owner — which is why the approval screen shows
-- the label and the code, and why the learner types the code rather than
-- following a link that carries it. Guessing `id` is the 256-bit problem.
--
-- No token is stored here, not even briefly: the device token is minted at
-- redemption and the row is deleted in the same step, so there is no window in
-- which a readable credential sits in the database.
CREATE TABLE pairing_requests (
  id               TEXT PRIMARY KEY,
  user_code        TEXT NOT NULL UNIQUE,
  label            TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  -- Last poll, for the minimum-interval check. A desktop that ignores the
  -- interval is told to slow down rather than served.
  polled_at        INTEGER,
  -- NULL until a signed-in, approved account claims it.
  approved_user_id TEXT REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX pairing_requests_expires ON pairing_requests(expires_at);
