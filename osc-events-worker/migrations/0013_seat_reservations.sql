-- Seat reservation codes are generated in the admin panel. One code is
-- one seat for one person, so a code is consumed by a single reservation.
CREATE TABLE seat_reservation_codes (
    code TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    created_by TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX idx_seat_codes_event ON seat_reservation_codes(event_id);

CREATE TABLE seat_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    seat_id TEXT NOT NULL,
    code TEXT NOT NULL,
    college_registration_number TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    registration_member_id INTEGER,
    email_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_unique_event_seat ON seat_reservations(event_id, seat_id);

CREATE UNIQUE INDEX idx_unique_seat_code ON seat_reservations(code);

-- Matches the normalised form the registration tables already use, so one
-- registration number holds one seat per event whatever casing arrives.
CREATE UNIQUE INDEX idx_unique_event_seat_regno
ON seat_reservations(event_id, UPPER(TRIM(college_registration_number)));

CREATE INDEX idx_seat_reservations_event ON seat_reservations(event_id);
