-- Auto-create practice and user_profile on signup
-- When a new user signs up with practice_name in metadata,
-- this trigger creates the practice and links the user as practice_admin.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_practice_id uuid;
BEGIN
  -- Create the practice from signup metadata
  INSERT INTO public.practices (name)
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'practice_name', 'My Practice'))
  RETURNING id INTO new_practice_id;

  -- Create the user profile linked to this practice
  INSERT INTO public.user_profiles (id, practice_id, role, full_name)
  VALUES (
    NEW.id,
    new_practice_id,
    'practice_admin',
    NEW.raw_user_meta_data ->> 'full_name'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire after a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
