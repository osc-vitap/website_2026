-- Add event_id directly to registration_members so that
-- college registration numbers can be unique per event.

ALTER TABLE registration_members
ADD COLUMN event_id TEXT;

-- Populate event_id for existing registrations.
UPDATE registration_members
SET event_id = (
    SELECT event_id
    FROM registrations
    WHERE registrations.id = registration_members.registration_id
);

-- Prevent the same college registration number
-- from registering for the same event more than once.
CREATE UNIQUE INDEX idx_unique_event_college_registration
ON registration_members(event_id, college_registration_number);