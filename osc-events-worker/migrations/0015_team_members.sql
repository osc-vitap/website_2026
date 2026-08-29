-- The public /team roster, made editable from the admin panel. It used to
-- be a hardcoded array in src/data/teamData.ts, which meant add/remove/edit
-- and photo uploads could not happen at runtime. The rows below seed the
-- table with exactly that array so /team renders identically on the first
-- deploy; image_url keeps pointing at the existing /team/*.webp files in the
-- site's public folder, and only newly uploaded photos live in R2.
CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    -- One of: Admins, Track Leads, Technical Leads, Executive Members. Kept
    -- as free text rather than a CHECK so the four tiers can be renamed in
    -- one place (the admin panel) without a migration.
    tier TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    -- A URL string, not an R2 key: seeded rows point at /team/*.webp and
    -- uploads point at /api/team/image/<key>, so the /team page treats both
    -- the same way.
    image_url TEXT NOT NULL DEFAULT '',
    github TEXT,
    linkedin TEXT,
    instagram TEXT,
    website TEXT,
    -- Ordering within a tier, ascending. Seeded from the old array order.
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_team_members_order ON team_members(sort_order);

INSERT INTO team_members (name, role, tier, bio, image_url, github, linkedin, instagram, website, sort_order) VALUES
('Mohammed Faariz', 'President', 'Admins', 'I maybe different but still the same paint over the canvas which was white before', '/team/faariz.webp', NULL, 'https://www.linkedin.com/in/mohammed-faariz-a-3a5600317/', 'https://instagram.com/_cottonrust', NULL, 1),
('Izhaan Raza', 'Vice President', 'Admins', 'Cool VP :) Started as IoT, transitioned to Backend dev, then agentics then system design and now Embedded Systems and low level.', '/team/izhaan.webp', 'https://github.com/Izhaan-Raza', NULL, 'https://instagram.com/izhaann7', NULL, 2),
('Pradyumna Basa', 'Technical Track Lead', 'Track Leads', 'I love to make stuff and break it all apart. (Also don''t ask me about PCB designing please).', '/team/pradyumna.webp', 'https://github.com/pradyumnabasa', 'https://www.linkedin.com/in/pradyumna-basa-a1641b321', 'https://instagram.com/pradyumnabasa', NULL, 3),
('Ayushi', 'Non-Technical Track Lead', 'Track Leads', 'The only acceptable bribe is vanilla latte and dragons ✨', '/team/ayushi.webp', 'https://github.com/Ayushi-17', NULL, NULL, NULL, 4),
('Anant Satya Mohit Kavuru', 'Technical Lead', 'Technical Leads', 'CS undergrad, Linux enthusiast, building cool stuff.', '/team/anant.webp', 'https://github.com/Condition00', 'https://www.linkedin.com/in/anantkavuru', 'https://instagram.com/anantkavuru', NULL, 5),
('Harshikaa lasya', 'Technical Co-Lead', 'Technical Leads', 'Usually building backend stuff, occasionally breaking it, and always learning something new along the way.', '/team/harshikaa.webp', 'https://github.com/phoenixx-codes', 'https://www.linkedin.com/in/bhanu-harshikaa-lasya/', NULL, NULL, 6),
('Ryan Shreyas Medikonda', 'Creative Lead', 'Executive Members', 'Hi! I''m Ryan, creative lead for OSC. Mostly swimming through life, making sense of it all. I currently enjoy playing video games and working out.', '/team/ryan.webp', 'https://github.com/ryan000007', 'https://www.linkedin.com/in/ryan-shreyas-medikonda-191a91313/', 'https://instagram.com/ryxn_07', NULL, 7),
('Piyush Prasad Singh', 'Creative Co-Lead', 'Executive Members', '20 year old 2D / 3D Designer.', '/team/piyush.webp', 'https://github.com/sanctionednewt/', 'https://linkedin.com/in/piyushps107/', 'https://instagram.com/h.suyi.p', NULL, 8),
('Sumedh Singh Gautam', 'Events Lead', 'Executive Members', 'Player: Sumedh Singh Gautam. Mission: Build crazy softwares, exploit intelligent systems, and level up by every project. Every challenge is another quest, and every line of code adds experience toward becoming a better engineer.', '/team/sumedh.webp', 'https://github.com/iamsumedhsg', 'https://linkedin.com/in/sumedh-singh-gautam/', NULL, 'https://instagram.com/geek_ssg', 9);
