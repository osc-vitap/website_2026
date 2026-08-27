-- The Worker now normalises year_of_study and github on the way in
-- (normalizeYearOfStudy and normalizeGithub). The 239 rows taken before
-- it did are still in whatever shape the form accepted, and both
-- columns are printed verbatim by the admin dashboard and the CSV
-- export, so the event-day roster reads as two conventions at once.
-- This brings the history to the form the Worker writes from now on.
--
-- Only the values whose meaning is not in doubt are rewritten. What is
-- left, and why, is at the end of this file.

-- YEAR OF STUDY, written as the calendar year they joined.
--
-- 6 rows answered "Year of Study" with "2026". In the 2026-27 session
-- someone who joined in 2026 is in year 1, so the year of study is 2027
-- minus the value -- the same arithmetic normalizeYearOfStudy does. All
-- six carry a registration number starting "26", which is that answer
-- again from a field the student did not type freehand.
--
-- Guarded rather than applied to anything that parses as a number,
-- because the column is free text and this file will eventually be
-- re-run by hand against rows it has already cleaned:
--
--   * only all-digit values are considered, so "2025-2026" and
--     "1st year" cannot reach the arithmetic.
--   * only values above 10 are read as a joining year at all, which is
--     what keeps the 225 rows already saying "1" to "4" out of it.
--   * the result has to land in 1..5 -- four years of B.Tech, five for
--     the integrated programmes. "2027" would give 0 and "2030" a
--     negative year: those stay as they are for a human to ask about,
--     rather than being written to a number that merely looks
--     plausible.
--
-- The last guard is also what makes a second run harmless: the rule
-- only ever writes 1..5 and only ever reads values above 10, so nothing
-- it has already fixed can match it again.
UPDATE registration_members
SET year_of_study = CAST(2027 - CAST(TRIM(year_of_study) AS INTEGER) AS TEXT)
WHERE TRIM(year_of_study) <> ''
    AND TRIM(year_of_study) NOT GLOB '*[^0-9]*'
    AND CAST(TRIM(year_of_study) AS INTEGER) > 10
    AND 2027 - CAST(TRIM(year_of_study) AS INTEGER) BETWEEN 1 AND 5;

-- YEAR OF STUDY, written out in words.
--
-- 6 rows: "1st year" twice, "1st Year", "First year", "2nd year" twice.
-- normalizeYearOfStudy takes digits only, so it rejects these at the
-- form rather than converting them. The ones already stored are only
-- ever going to be fixed here. Registration numbers agree with all six:
-- the four first-year spellings start "26", both second-year rows "25".
--
-- The third- and fourth-year spellings are listed too, so a straggler
-- registered before this migration is applied is cleaned by it as well.
-- Matching is on the lowercased, trimmed value against exact spellings:
-- a LIKE or prefix match would also swallow "1st year, switching to
-- 2nd", which is not something to answer on someone's behalf.
--
-- The CASE has no ELSE on purpose. If the two lists below are ever
-- edited apart, the unmatched row yields NULL, and year_of_study is NOT
-- NULL, so the migration fails loudly instead of blanking a year.
UPDATE registration_members
SET year_of_study = CASE LOWER(TRIM(year_of_study))
    WHEN '1st year' THEN '1'
    WHEN 'first year' THEN '1'
    WHEN '2nd year' THEN '2'
    WHEN 'second year' THEN '2'
    WHEN '3rd year' THEN '3'
    WHEN 'third year' THEN '3'
    WHEN '4th year' THEN '4'
    WHEN 'fourth year' THEN '4'
END
WHERE LOWER(TRIM(year_of_study)) IN (
    '1st year',
    'first year',
    '2nd year',
    'second year',
    '3rd year',
    'third year',
    '4th year',
    'fourth year'
);

-- GITHUB, stored as a profile URL.
--
-- 62 of the 239 rows filled the field in: 25 pasted a profile URL, the
-- rest typed a handle. normalizeGithub stores the handle from either,
-- so the URLs are the ones out of step -- and the Discord roster is the
-- reason the handle won: escapeDiscord backslashes every ':' it meets,
-- so a stored URL reaches the channel as "https\://github.com/ada".
--
-- The prefixes are matched in the shapes GITHUB_PROFILE_URL accepts,
-- and matched from the start of the value, so only github.com itself is
-- rewritten. One participant gave "https://git.meowda.xyz/meowda", a
-- self-hosted instance: taking its last path segment would file them
-- under the GitHub account "meowda", which belongs to someone else. It
-- is not a github.com URL, it is not touched, and it stays a URL.
--
-- The handle is checked against GitHub's own username rule before it is
-- written -- non-empty, letters, digits and single interior hyphens, up
-- to 39 characters. That check is what stands between this and a
-- damaged row. "https://github.com/" names nobody and extracts to an
-- empty handle, and "github.com/name/project" is a repository pasted by
-- mistake, which GITHUB_PROFILE_URL also declines rather than trimming
-- to its first segment. Neither is rewritten.
--
-- A second run is harmless: what this writes is a bare handle, and a
-- bare handle has no github.com prefix to match.
UPDATE registration_members AS m
SET github = extracted.handle
FROM (
    SELECT
        id,
        RTRIM(
            SUBSTR(
                TRIM(github),
                INSTR(LOWER(TRIM(github)), 'github.com/') + 11
            ),
            '/'
        ) AS handle
    FROM registration_members
    WHERE LOWER(TRIM(github)) LIKE 'github.com/%'
        OR LOWER(TRIM(github)) LIKE 'www.github.com/%'
        OR LOWER(TRIM(github)) LIKE 'http://github.com/%'
        OR LOWER(TRIM(github)) LIKE 'http://www.github.com/%'
        OR LOWER(TRIM(github)) LIKE 'https://github.com/%'
        OR LOWER(TRIM(github)) LIKE 'https://www.github.com/%'
) AS extracted
WHERE m.id = extracted.id
    AND extracted.handle <> ''
    AND LENGTH(extracted.handle) <= 39
    AND extracted.handle NOT GLOB '*[^A-Za-z0-9-]*'
    AND extracted.handle NOT GLOB '-*'
    AND extracted.handle NOT GLOB '*-'
    AND extracted.handle NOT GLOB '*--*';

-- Deliberately left alone.
--
-- Two years of study, both on gittyup26:
--
--   registration_members.id 63   year_of_study "2025-2026"
--   registration_members.id 158  year_of_study "0"
--
-- "2025-2026" is an academic year, which is year 1 or year 2 depending
-- on which end of it they meant, and "0" is not a year of study at all.
-- Their registration numbers start "25" and "26", which is a hint and
-- not an answer -- a wrong year in front of the organisers on event day
-- costs more than an email, so these two get asked.
--
-- And five github values that are neither a profile URL nor a handle:
-- a bare "https://github.com", an "@handle", an email address, a name
-- with an underscore in it, and the self-hosted URL above.
-- normalizeGithub refuses all five at the form today, but they are
-- already stored and there is nothing to convert them to -- emptying
-- the field would throw away the only thing the participant gave, so
-- they stay as typed. So does the row reading "Na", which no rule can
-- tell from a handle.
