-- Run this once in your Neon SQL editor to create the tickets table

CREATE TABLE IF NOT EXISTS tickets (
  id                TEXT        PRIMARY KEY,
  case_id           TEXT,
  tin               TEXT,
  creation_date     TEXT,
  assign_date       TEXT,
  handling_date     TEXT,
  owner             TEXT,
  priority          TEXT,
  status            TEXT,
  workgroup         TEXT,
  issue_type        TEXT,
  description       TEXT,
  reopened          TEXT,
  last_closed_by    TEXT,
  escalation_reason TEXT,
  saved_at          TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);
