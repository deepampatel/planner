CREATE TABLE IF NOT EXISTS participants (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id      INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    display_name TEXT    NOT NULL,
    edit_token   TEXT    NOT NULL UNIQUE,
    timezone     TEXT    NOT NULL DEFAULT 'UTC',
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_participants_plan_id ON participants(plan_id);
CREATE INDEX idx_participants_edit_token ON participants(edit_token);
