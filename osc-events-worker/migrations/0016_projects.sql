-- Admin-managed list of open-source projects shown on oscvitap.com/projects.
-- Replaces the previous hardcoded array in src/data/projectsData.ts as the
-- source of truth at runtime: the file is kept so the public /projects page
-- renders before the Worker is reachable, but every CRUD operation goes
-- through the new /api/admin/projects endpoints from now on.
--
-- The id column is the slug (lowercase letters, numbers, single hyphens),
-- matching the events table convention. Tech stack and contributors are
-- stored as JSON-encoded arrays of strings, validated by the Worker on
-- every write; storing them as JSON in TEXT keeps the schema small and
-- avoids a join table for what is, in practice, a few short strings.
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tech_stack TEXT NOT NULL DEFAULT '[]',
    repo_url TEXT NOT NULL,
    live_url TEXT,
    contributors TEXT NOT NULL DEFAULT '[]',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_order ON projects(display_order, id);

-- Seed from the existing static array so the admin shows the same five
-- projects on first deploy, in the same order. The live /projects page
-- continues to read src/data/projectsData.ts until it is migrated to the
-- API in a separate change.
INSERT OR IGNORE INTO projects (id, title, description, tech_stack, repo_url, live_url, contributors, display_order) VALUES
('wsoc-website', 'WSoC-Website', 'Official website for Winter of Summer of Code (WSoC). A platform to encourage student participation in open source.', '["JavaScript","HTML","CSS"]', 'https://github.com/osc-vitap/WSoC-Website', 'https://wsoc.oscvitap.org', '["https://i.pravatar.cc/150?u=1","https://i.pravatar.cc/150?u=2"]', 1),
('oschub', 'OSCHub', 'A centralized web application for OSC livestreams, organizing events and content for the community.', '["Django","Python","CSS"]', 'https://github.com/osc-vitap/oschub', 'https://osc-hub.herokuapp.com', '["https://i.pravatar.cc/150?u=3","https://i.pravatar.cc/150?u=4","https://i.pravatar.cc/150?u=5"]', 2),
('productivity-tracker', 'Productivity-tracker', 'Application to help you stay focused and productive, built as part of OSC''s WSoC initiative.', '["Python3"]', 'https://github.com/osc-vitap/Productivity-tracker', NULL, '["https://i.pravatar.cc/150?u=6"]', 3),
('opensource101', 'OpenSource101', 'A starter repository made specifically to help you get your first pull request and learn the basics of Git and GitHub.', '["Svelte","JavaScript"]', 'https://github.com/osc-vitap/OpenSource101', 'https://opensource101.oscvitap.org/', '["https://i.pravatar.cc/150?u=7","https://i.pravatar.cc/150?u=8"]', 4),
('awesome-osc', 'Awesome-OSC', 'A compiled list of resources to help beginners navigate through GitHub and the Open Source world.', '["Markdown"]', 'https://github.com/osc-vitap/Awesome-OSC', NULL, '["https://i.pravatar.cc/150?u=9"]', 5);
