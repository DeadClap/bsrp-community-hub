CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TABLE IF EXISTS hub_processed_event_keys CASCADE;
DROP TABLE IF EXISTS hub_integration_mappings CASCADE;
DROP TABLE IF EXISTS hub_oauth_states CASCADE;
DROP TABLE IF EXISTS hub_sessions CASCADE;
DROP TABLE IF EXISTS hub_access_requests CASCADE;
DROP TABLE IF EXISTS hub_audit_events CASCADE;
DROP TABLE IF EXISTS hub_operational_events CASCADE;
DROP TABLE IF EXISTS hub_server_connections CASCADE;
DROP TABLE IF EXISTS hub_player_profiles CASCADE;
DROP TABLE IF EXISTS hub_identity_links CASCADE;
DROP TABLE IF EXISTS hub_permission_grants CASCADE;
DROP TABLE IF EXISTS hub_memberships CASCADE;
DROP TABLE IF EXISTS hub_roles CASCADE;
DROP TABLE IF EXISTS hub_departments CASCADE;
DROP TABLE IF EXISTS hub_connected_accounts CASCADE;
DROP TABLE IF EXISTS hub_users CASCADE;

CREATE TABLE IF NOT EXISTS hub_users (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_notes TEXT
);
CREATE INDEX IF NOT EXISTS hub_users_status_idx ON hub_users (status);

CREATE TABLE IF NOT EXISTS hub_departments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hub_roles (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (department_id, slug)
);
CREATE INDEX IF NOT EXISTS hub_roles_department_id_idx ON hub_roles (department_id);

CREATE TABLE IF NOT EXISTS hub_connected_accounts (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  username TEXT NOT NULL,
  guild_member BOOLEAN NOT NULL DEFAULT FALSE,
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ,
  provisioned_at TIMESTAMPTZ,
  UNIQUE (provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS hub_connected_accounts_user_id_idx ON hub_connected_accounts (user_id);

CREATE TABLE IF NOT EXISTS hub_memberships (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES hub_roles (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hub_memberships_user_id_idx ON hub_memberships (user_id);
CREATE INDEX IF NOT EXISTS hub_memberships_department_id_idx ON hub_memberships (department_id);
CREATE INDEX IF NOT EXISTS hub_memberships_role_id_idx ON hub_memberships (role_id);
CREATE INDEX IF NOT EXISTS hub_memberships_status_idx ON hub_memberships (status);

CREATE TABLE IF NOT EXISTS hub_permission_grants (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  effect TEXT NOT NULL,
  scope TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hub_permission_grants_user_id_idx ON hub_permission_grants (user_id);

CREATE TABLE IF NOT EXISTS hub_identity_links (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  license TEXT NOT NULL UNIQUE,
  discord_id TEXT,
  linked_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS hub_identity_links_user_id_idx ON hub_identity_links (user_id);
CREATE INDEX IF NOT EXISTS hub_identity_links_discord_id_idx ON hub_identity_links (discord_id);

CREATE TABLE IF NOT EXISTS hub_player_profiles (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  license TEXT NOT NULL UNIQUE,
  whitelist_status TEXT NOT NULL,
  ban_status TEXT NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS hub_player_profiles_user_id_idx ON hub_player_profiles (user_id);

CREATE TABLE IF NOT EXISTS hub_server_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hub_operational_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  server_id TEXT REFERENCES hub_server_connections (id) ON DELETE SET NULL,
  player_id TEXT REFERENCES hub_player_profiles (id) ON DELETE SET NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS hub_operational_events_player_id_idx ON hub_operational_events (player_id);
CREATE INDEX IF NOT EXISTS hub_operational_events_server_id_idx ON hub_operational_events (server_id);
CREATE INDEX IF NOT EXISTS hub_operational_events_kind_idx ON hub_operational_events (kind);
CREATE INDEX IF NOT EXISTS hub_operational_events_created_at_idx ON hub_operational_events (created_at);

CREATE TABLE IF NOT EXISTS hub_audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_user_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS hub_audit_events_created_at_idx ON hub_audit_events (created_at);
CREATE INDEX IF NOT EXISTS hub_audit_events_actor_user_id_idx ON hub_audit_events (actor_user_id);

CREATE TABLE IF NOT EXISTS hub_access_requests (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
  requested_role_id TEXT NOT NULL REFERENCES hub_roles (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  decision_notes TEXT
);
CREATE INDEX IF NOT EXISTS hub_access_requests_user_id_idx ON hub_access_requests (user_id);
CREATE INDEX IF NOT EXISTS hub_access_requests_status_idx ON hub_access_requests (status);

CREATE TABLE IF NOT EXISTS hub_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hub_sessions_user_id_idx ON hub_sessions (user_id);
CREATE INDEX IF NOT EXISTS hub_sessions_status_idx ON hub_sessions (status);

CREATE TABLE IF NOT EXISTS hub_oauth_states (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  discord_user_id TEXT
);
CREATE INDEX IF NOT EXISTS hub_oauth_states_status_idx ON hub_oauth_states (status);
CREATE INDEX IF NOT EXISTS hub_oauth_states_expires_at_idx ON hub_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS hub_integration_mappings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_role_id TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES hub_roles (id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  UNIQUE (provider, external_role_id, direction)
);
CREATE INDEX IF NOT EXISTS hub_integration_mappings_role_id_idx ON hub_integration_mappings (role_id);

CREATE TABLE IF NOT EXISTS hub_processed_event_keys (
  event_key TEXT PRIMARY KEY
);
