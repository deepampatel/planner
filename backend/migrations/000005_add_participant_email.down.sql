-- SQLite doesn't support DROP COLUMN in older versions, but modernc.org/sqlite does
ALTER TABLE participants DROP COLUMN email;
ALTER TABLE participants DROP COLUMN has_responded;
