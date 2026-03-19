ALTER TABLE hub_oauth_states
ADD COLUMN IF NOT EXISTS return_to TEXT;
