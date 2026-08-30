-- A registration ceiling that closes the form on its own.
--
-- GittyUp '26 is capped at 1050 registrations. Until now the only way to
-- stop a form was for a human to notice the number and flip is_open in
-- the dashboard, which means the cap holds only while somebody is
-- watching -- and registration peaks at the hours nobody is.
--
-- NULL means uncapped, which is every other event: the column is added
-- without a default so nothing that exists today changes behaviour.
--
-- The unit is ROWS IN registrations, not in registration_members -- the
-- same number the dashboard prints under "Registrations". For a solo or
-- workshop event those are equal; for a team event this caps teams, not
-- people. GittyUp '26 is the only capped event, so the distinction is
-- documented rather than decided here, and an organiser capping a team
-- event should read it as a cap on teams.
--
-- Enforced hourly by the scheduled job in src/index.ts
-- (enforceRegistrationCaps), which sets is_open = 0 once the count
-- reaches the cap. Hourly, so the count can overshoot the cap by
-- whatever arrives inside one hour; the cap stops the form, it does not
-- reject the registration that crosses it. Nothing in the registration
-- handler reads this column.
ALTER TABLE events
ADD COLUMN registration_cap INTEGER;

-- Guarded on the column still being NULL, for the reason 0012 spells
-- out: a migration file outlives the deploy that applies it, and this
-- one must not overwrite a cap an organiser has since set from the
-- admin API. A re-run after the cap has moved is a silent no-op.
--
-- Read the row back after the deploy rather than trusting the exit
-- status -- `d1 migrations apply` reports statements executed, not rows
-- written, so a run that matched nothing looks identical:
--
--   npx wrangler d1 execute osc-events-db --remote --command
--     "SELECT slug, is_open, registration_cap,
--             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id)
--        FROM events e WHERE slug = 'gittyup26';"
UPDATE events
SET registration_cap = 1050
WHERE slug = 'gittyup26'
  AND registration_cap IS NULL;
