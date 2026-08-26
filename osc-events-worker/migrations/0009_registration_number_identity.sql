-- The college registration number identifies a participant within an
-- event. The existing unique index compares raw strings, so
-- "22bce1234" and " 22BCE1234 " register twice. Rebuild it over the
-- normalised value instead.

-- Remove any duplicates the raw index let through, keeping the earliest
-- row for each (event, normalised registration number).
DELETE FROM registration_members
WHERE id NOT IN (
    SELECT MIN(id)
    FROM registration_members
    GROUP BY event_id, UPPER(TRIM(college_registration_number))
);

-- A registration whose members were all duplicates is itself a
-- duplicate; do not leave it behind as a member-less row.
DELETE FROM registrations
WHERE id NOT IN (
    SELECT DISTINCT registration_id
    FROM registration_members
);

-- Store existing values in the normalised form the API writes from now
-- on, so exports and the admin dashboard read consistently.
UPDATE registration_members
SET college_registration_number = UPPER(TRIM(college_registration_number));

DROP INDEX idx_unique_event_college_registration;

-- Uniqueness over the normalised expression: whatever casing or
-- whitespace reaches the database, one registration number is one
-- registration per event.
CREATE UNIQUE INDEX idx_unique_event_college_registration
ON registration_members(event_id, UPPER(TRIM(college_registration_number)));
