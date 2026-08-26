-- registrations.team_size is written once, at registration, from the
-- number of members submitted. Migration 0009 removed duplicate
-- registration_members rows without adjusting it, so any registration
-- that lost a member to that dedupe now claims a larger team than it
-- has -- and the admin dashboard reads team_size directly.
--
-- Production had no duplicates when 0009 ran, so nothing there drifted.
-- This exists for any database that did, and it is safe either way:
-- recomputing from the rows that actually exist is a no-op when they
-- already agree.

UPDATE registrations
SET team_size = (
    SELECT COUNT(*)
    FROM registration_members m
    WHERE m.registration_id = registrations.id
)
WHERE team_size <> (
    SELECT COUNT(*)
    FROM registration_members m
    WHERE m.registration_id = registrations.id
);
