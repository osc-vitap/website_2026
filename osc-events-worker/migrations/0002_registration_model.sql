-- Add registration configuration to events
ALTER TABLE events ADD COLUMN registration_type TEXT NOT NULL DEFAULT 'solo';
ALTER TABLE events ADD COLUMN min_team_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events ADD COLUMN max_team_size INTEGER NOT NULL DEFAULT 1;

-- Rebuild registrations around a registration/team
CREATE TABLE registration_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    year_of_study TEXT NOT NULL,
    college_registration_number TEXT NOT NULL,
    github TEXT,
    email TEXT NOT NULL,
    member_number INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registration_id) REFERENCES registrations(id)
);

-- Add team information to registrations
ALTER TABLE registrations ADD COLUMN team_name TEXT;
ALTER TABLE registrations ADD COLUMN team_size INTEGER NOT NULL DEFAULT 1;