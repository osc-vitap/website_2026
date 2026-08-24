ALTER TABLE events
ADD COLUMN archive_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE events
ADD COLUMN archive_key TEXT;

ALTER TABLE events
ADD COLUMN archived_at TEXT;
