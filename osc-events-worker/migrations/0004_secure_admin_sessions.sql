-- Remove GitHub access tokens from persisted admin sessions.
-- OAuth access tokens are only needed during the GitHub callback.

CREATE TABLE admin_sessions_new (
    id TEXT PRIMARY KEY,
    github_user_id TEXT NOT NULL,
    github_username TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_sessions_new (
    id,
    github_user_id,
    github_username,
    expires_at,
    created_at
)
SELECT
    id,
    github_user_id,
    github_username,
    expires_at,
    created_at
FROM admin_sessions;

DROP TABLE admin_sessions;

ALTER TABLE admin_sessions_new
RENAME TO admin_sessions;

CREATE INDEX idx_admin_sessions_expires
ON admin_sessions(expires_at);