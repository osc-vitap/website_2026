-- Door entry for GITTY UP 26. One pass per attendee, scanned at the
-- auditorium door by four volunteers on four queues.
--
-- The QR carries a random 128 bit token and nothing else. The original
-- design hashed email plus registration number, which has no secret in
-- it: registration numbers are a fixed format and campus emails are
-- derived from names, so anyone could compute a valid pass for a person
-- who never registered. A random token has nothing to guess, can be
-- revoked for one person without touching anybody else, and means a
-- scanner phone never carries a signing secret.

CREATE TABLE entry_passes (
    token TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,

    -- 'reserved' for someone holding a seat from seat_reservations,
    -- 'registered' for someone who signed up through the portal. The
    -- emailed QR is drawn in a different colour for each.
    kind TEXT NOT NULL CHECK (kind IN ('reserved', 'registered')),

    name TEXT NOT NULL,
    email TEXT NOT NULL,
    college_registration_number TEXT NOT NULL,

    -- Set only when kind = 'reserved', so the volunteer can point.
    seat_id TEXT,

    email_status TEXT NOT NULL DEFAULT 'pending',
    issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,

    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- One live pass per person per event, normalised the same way the seat
-- and registration tables already normalise.
--
-- Partial on revoked_at so a pass can be reissued after the first is
-- revoked. Without the WHERE, reissuing to someone who lost their email
-- would collide with the pass they can no longer use.
CREATE UNIQUE INDEX idx_entry_pass_person
ON entry_passes (event_id, UPPER(TRIM(college_registration_number)))
WHERE revoked_at IS NULL;

-- The claim counts live passes by kind on every scan, so it is indexed.
CREATE INDEX idx_entry_pass_kind ON entry_passes (event_id, kind);

CREATE TABLE entry_gate (
    event_id TEXT PRIMARY KEY,

    -- Bodies the room holds. Not derived from the seat map: the map is
    -- 22 rows of 26 and the real number depends on what the venue
    -- allows on the day, so it is a value an admin can change.
    capacity INTEGER NOT NULL,

    -- The kill switch. Flipping this to 0 stops the door without
    -- touching capacity or needing a deploy.
    is_open INTEGER NOT NULL DEFAULT 1,

    -- Counters for the queue display only. NOT the admission
    -- authority: occupancy is counted from entry_scans, which is the
    -- row that has to be right anyway. These are recomputed rather than
    -- incremented, so a lost write corrects itself on the next scan
    -- instead of drifting for the rest of the day.
    admitted_reserved INTEGER NOT NULL DEFAULT 0,
    admitted_general INTEGER NOT NULL DEFAULT 0,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- One row per admission. This table is the truth about who is inside.
CREATE TABLE entry_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    token TEXT NOT NULL,

    -- Copied from the pass at scan time so occupancy by kind can be
    -- counted without joining back to entry_passes inside the claim.
    kind TEXT NOT NULL,

    device_id TEXT NOT NULL,
    scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- An admin undoing a scan: someone let in by mistake, or a pass
    -- burned by a misfire. Voiding rather than deleting keeps the
    -- record of what happened.
    voided_at TEXT,
    voided_by TEXT,
    void_reason TEXT
);

-- The double entry defence, and the reason the claim needs no
-- compensating write. A second scan of the same token conflicts here
-- and the whole statement does nothing.
--
-- Partial on voided_at so a voided scan frees the token to be scanned
-- again, which is the entire point of being able to void one.
CREATE UNIQUE INDEX idx_entry_scan_once
ON entry_scans (event_id, token)
WHERE voided_at IS NULL;

-- The claim counts live scans of one kind. Covering, so the count is an
-- index scan rather than a table walk.
CREATE INDEX idx_entry_scan_kind ON entry_scans (event_id, kind, voided_at);

-- The five scanning phones. Not admin accounts: these reach /api/scan
-- and nothing else, and are deliberately outside the GitHub OAuth gate
-- because a volunteer on a borrowed phone cannot be asked to sign in to
-- the organisation.
CREATE TABLE scanner_devices (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    label TEXT NOT NULL,

    -- HMAC-SHA256 of the device token under ADMIN_HANDLE_PEPPER, hex.
    -- Stored the same way the admin outsider ids are, and for the same
    -- reason: a database dump should not hand over working credentials.
    token_hash TEXT NOT NULL,

    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_scanner_device_hash ON scanner_devices (token_hash);

-- Sessions for the scanning phones, kept in their own table.
--
-- Deliberately not admin_sessions. Sharing that table would mean one
-- lookup path serving both, and one mistake there turns a door phone
-- into an admin session with access to every registrant's email and
-- phone number.
CREATE TABLE scanner_sessions (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (device_id) REFERENCES scanner_devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_scanner_session_device ON scanner_sessions (device_id);

-- Append only, every outcome, including the refusals.
--
-- entry_scans only records admissions, so without this there is no
-- record of the person turned away at 10:40 and no way to answer "how
-- many did we refuse" afterwards. Workers logs are sampled and cannot
-- be queried, so the answer has to be in the database.
CREATE TABLE entry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    token TEXT,
    device_id TEXT,
    result TEXT NOT NULL,
    actor TEXT,
    reason TEXT,
    at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entry_events_event ON entry_events (event_id, at);

-- Open the gate for GITTY UP 26.
--
-- 520 is the seat map's 572 less the 52 seats in rows 1 and 2, which
-- TEAM_ROWS holds for the OSC team. It is a starting value an admin can
-- change from the panel, not a fact about the room.
INSERT INTO entry_gate (event_id, capacity)
SELECT id, 520 FROM events WHERE slug = 'gittyup26';
