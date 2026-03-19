ALTER TABLE hub_operational_events
  RENAME COLUMN player_id TO access_id;

DROP INDEX IF EXISTS hub_operational_events_player_id_idx;
CREATE INDEX IF NOT EXISTS hub_operational_events_access_id_idx ON hub_operational_events (access_id);
