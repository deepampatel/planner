PRAGMA foreign_keys = OFF;

CREATE TABLE plans_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    slug             TEXT    NOT NULL UNIQUE,
    custom_slug      TEXT    UNIQUE,
    title            TEXT    NOT NULL,
    location         TEXT    DEFAULT '',
    date_range_start TEXT    NOT NULL,
    date_range_end   TEXT    NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    granularity      TEXT    NOT NULL DEFAULT 'time' CHECK (granularity IN ('time', 'day')),
    host_token       TEXT    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'expired')),
    timezone         TEXT    NOT NULL DEFAULT 'UTC',
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    expires_at       TEXT    NOT NULL
);

INSERT INTO plans_new (id, slug, custom_slug, title, location, date_range_start, date_range_end,
    duration_minutes, granularity, host_token, status, timezone, created_at, updated_at, expires_at)
SELECT id, slug, custom_slug, title, location, date_range_start, date_range_end,
    duration_minutes, granularity, host_token, status, timezone, created_at, updated_at, expires_at
FROM plans WHERE granularity != 'options';

DROP TABLE plans;
ALTER TABLE plans_new RENAME TO plans;

CREATE INDEX idx_plans_slug ON plans(slug);
CREATE INDEX idx_plans_custom_slug ON plans(custom_slug);
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_expires_at ON plans(expires_at);

PRAGMA foreign_keys = ON;
