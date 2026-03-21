-- SQLite doesn't support DROP COLUMN, so we recreate the table
CREATE TABLE participants_backup AS SELECT id, plan_id, display_name, edit_token, timezone, created_at FROM participants;
DROP TABLE participants;
ALTER TABLE participants_backup RENAME TO participants;

DROP TABLE IF EXISTS users;
