-- User profiles table
-- Links Supabase auth.users to a practice with a role.
-- This is the source of truth for practice_id and role used in RLS policies.

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  practice_id uuid NOT NULL REFERENCES practices (id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'staff',
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_practice ON user_profiles (practice_id);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
