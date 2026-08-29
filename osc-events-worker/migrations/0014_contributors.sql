-- Contributors roster for oscvitap.com/contributors
-- Allows dynamic management of core contributors from the admin dashboard.

CREATE TABLE contributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT NOT NULL UNIQUE,
    avatar_url TEXT NOT NULL,
    html_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contributors_order ON contributors(display_order, id);

-- Seed existing core contributors
INSERT OR IGNORE INTO contributors (login, avatar_url, html_url, display_order) VALUES
('Bharath1910', 'https://avatars.githubusercontent.com/u/72338995?v=4', 'https://github.com/Bharath1910', 1),
('Condition00', 'https://avatars.githubusercontent.com/u/172305133?v=4', 'https://github.com/Condition00', 2),
('dat-adi', 'https://avatars.githubusercontent.com/u/31721284?v=4', 'https://github.com/dat-adi', 3),
('fullmeteor172', 'https://avatars.githubusercontent.com/u/38424726?v=4', 'https://github.com/fullmeteor172', 4),
('hardikxk', 'https://avatars.githubusercontent.com/u/183656738?v=4', 'https://github.com/hardikxk', 5),
('iamsumedhsg', 'https://avatars.githubusercontent.com/u/170885777?v=4', 'https://github.com/iamsumedhsg', 6),
('Izhaan-Raza', 'https://avatars.githubusercontent.com/u/66744194?v=4', 'https://github.com/Izhaan-Raza', 7),
('keiundefeated', 'https://avatars.githubusercontent.com/u/226298442?v=4', 'https://github.com/keiundefeated', 8),
('KrishnaBakaraju', 'https://avatars.githubusercontent.com/u/202231883?v=4', 'https://github.com/KrishnaBakaraju', 9),
('libremelon', 'https://avatars.githubusercontent.com/u/157024103?v=4', 'https://github.com/libremelon', 10),
('nilesh384', 'https://avatars.githubusercontent.com/u/175202054?v=4', 'https://github.com/nilesh384', 11),
('phoenixx-codes', 'https://avatars.githubusercontent.com/u/198185913?v=4', 'https://github.com/phoenixx-codes', 12),
('Rikhil-Nell', 'https://avatars.githubusercontent.com/u/152618980?v=4', 'https://github.com/Rikhil-Nell', 13),
('SVijayB', 'https://avatars.githubusercontent.com/u/54742586?v=4', 'https://github.com/SVijayB', 14),
('TanvishGG', 'https://avatars.githubusercontent.com/u/101194211?v=4', 'https://github.com/TanvishGG', 15),
('TheAvinashK', 'https://avatars.githubusercontent.com/u/31067081?v=4', 'https://github.com/TheAvinashK', 16);
