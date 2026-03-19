ALTER TABLE hub_memberships
  DROP CONSTRAINT IF EXISTS hub_memberships_user_id_department_id_key;

ALTER TABLE hub_memberships
  ADD CONSTRAINT hub_memberships_user_id_department_id_key UNIQUE (user_id, department_id);
