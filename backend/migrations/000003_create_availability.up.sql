CREATE TABLE IF NOT EXISTS availability (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    slot_start     TEXT    NOT NULL,
    slot_end       TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'maybe')),
    UNIQUE(participant_id, slot_start, slot_end)
);

CREATE INDEX idx_availability_participant_id ON availability(participant_id);
CREATE INDEX idx_availability_slot_start ON availability(slot_start);
