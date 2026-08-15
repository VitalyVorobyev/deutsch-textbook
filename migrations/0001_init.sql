-- Accounts, identities, sessions and device tokens.
--
-- Note what is NOT here: nothing about a learner's progress. The snapshot is
-- opaque bytes in R2 and the server never parses it (docs/cloud-sync.md), so a
-- snapshot schema version never reaches this file.

CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  -- The verified provider email. UNIQUE because it is the account-linking key:
  -- signing in with GitHub after Google must find the same row, not mint a second.
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT,
  -- 'pending' is the default for every new account and grants no storage at all.
  status       TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'blocked')),
  role         TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'owner')),
  created_at   INTEGER NOT NULL,
  decided_at   INTEGER,
  decided_by   TEXT
);

CREATE TABLE identities (
  provider   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);

CREATE INDEX identities_user ON identities(user_id);

-- `id` is sha256(token), never the token: a leaked database read cannot be
-- replayed as a session.
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expires ON sessions(expires_at);

-- Desktop (Tauri) transport. The webview is a different origin, so the session
-- cookie cannot reach it. Same hashing rule as sessions. Sync only — never admin.
CREATE TABLE device_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX device_tokens_user ON device_tokens(user_id);
