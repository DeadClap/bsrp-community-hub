CREATE TABLE IF NOT EXISTS hub_user_game_access (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  primary_license TEXT NOT NULL UNIQUE,
  whitelist_status TEXT NOT NULL,
  ban_status TEXT NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id)
);

INSERT INTO hub_user_game_access (id, user_id, primary_license, whitelist_status, ban_status, notes)
SELECT id, user_id, license, whitelist_status, ban_status, notes
FROM hub_player_profiles
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'hub_operational_events'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'access_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE hub_operational_events DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE hub_operational_events
  ADD CONSTRAINT hub_operational_events_access_id_fkey
  FOREIGN KEY (access_id) REFERENCES hub_user_game_access (id) ON DELETE SET NULL;

DROP TABLE IF EXISTS hub_player_profiles CASCADE;


