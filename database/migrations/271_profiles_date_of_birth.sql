-- Add date_of_birth to profiles for COPPA age-gating
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Update handle_new_user trigger to store DOB from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
  dob_val DATE;
BEGIN
  -- Generate username from metadata (email signup) or email (OAuth)
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    LOWER(SPLIT_PART(NEW.email, '@', 1))
  );

  -- Sanitize: only lowercase alphanumeric and underscore
  base_username := LOWER(REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g'));

  -- Ensure minimum length of 3 characters
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user_' || SUBSTRING(NEW.id::TEXT, 1, 8);
  END IF;

  -- Truncate to 20 chars to leave room for uniqueness suffix
  base_username := SUBSTRING(base_username, 1, 20);
  final_username := base_username;

  -- Find unique username by appending numeric suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::TEXT;
  END LOOP;

  -- Parse date_of_birth from metadata if provided
  BEGIN
    dob_val := (NEW.raw_user_meta_data->>'date_of_birth')::DATE;
  EXCEPTION WHEN OTHERS THEN
    dob_val := NULL;
  END;

  -- Create profile with ON CONFLICT to handle race conditions
  INSERT INTO public.profiles (id, username, display_name, avatar_url, date_of_birth)
  VALUES (
    NEW.id,
    final_username,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    dob_val
  )
  ON CONFLICT (id) DO UPDATE SET
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, profiles.date_of_birth);

  -- Create default user preferences (non-blocking)
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
