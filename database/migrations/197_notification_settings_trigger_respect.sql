-- Respect notification settings for trigger-driven notifications.
-- This updates existing trigger functions so user preference toggles are enforced
-- before notification rows are inserted.

CREATE OR REPLACE FUNCTION notification_setting_enabled(
  target_user_id UUID,
  setting_key TEXT,
  default_enabled BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
DECLARE
  is_enabled BOOLEAN;
BEGIN
  SELECT COALESCE((up.notification_settings ->> setting_key)::BOOLEAN, default_enabled)
  INTO is_enabled
  FROM user_preferences up
  WHERE up.user_id = target_user_id;

  RETURN COALESCE(is_enabled, default_enabled);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_follow_activity()
RETURNS TRIGGER AS $$
DECLARE
  activity_type_val TEXT;
BEGIN
  -- Determine activity type based on what's being followed
  IF NEW.followed_user_id IS NOT NULL THEN
    activity_type_val := 'follow_user';
  ELSIF NEW.followed_venue_id IS NOT NULL THEN
    activity_type_val := 'follow_venue';
  ELSE
    activity_type_val := 'follow_org';
  END IF;

  INSERT INTO activities (
    user_id, activity_type, visibility, target_user_id, venue_id, org_id
  )
  VALUES (
    NEW.follower_id,
    activity_type_val,
    'public',
    NEW.followed_user_id,
    NEW.followed_venue_id,
    NEW.followed_org_id
  );

  -- Create notification for followed user only if enabled
  IF NEW.followed_user_id IS NOT NULL
     AND notification_setting_enabled(NEW.followed_user_id, 'new_followers', true) THEN
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.followed_user_id, 'new_follower', NEW.follower_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for the invitee only if enabled
  IF notification_setting_enabled(NEW.invitee_id, 'friend_activity', true) THEN
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.invitee_id, 'friend_request', NEW.inviter_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION handle_friend_request_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Create mutual follows (both directions)
    INSERT INTO follows (follower_id, followed_user_id)
    VALUES (NEW.inviter_id, NEW.invitee_id)
    ON CONFLICT (follower_id, followed_user_id) DO NOTHING;

    INSERT INTO follows (follower_id, followed_user_id)
    VALUES (NEW.invitee_id, NEW.inviter_id)
    ON CONFLICT (follower_id, followed_user_id) DO NOTHING;

    NEW.responded_at := now();

    -- Notify inviter only if enabled
    IF notification_setting_enabled(NEW.inviter_id, 'friend_activity', true) THEN
      INSERT INTO notifications (user_id, type, actor_id)
      VALUES (NEW.inviter_id, 'friend_request_accepted', NEW.invitee_id);
    END IF;
  END IF;

  -- Handle declined requests
  IF NEW.status = 'declined' AND (OLD.status IS NULL OR OLD.status != 'declined') THEN
    NEW.responded_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_event_invite()
RETURNS TRIGGER AS $$
BEGIN
  IF notification_setting_enabled(NEW.invitee_id, 'event_invites', true) THEN
    INSERT INTO notifications (user_id, type, actor_id, event_id, message)
    SELECT
      NEW.invitee_id,
      'event_invite',
      NEW.inviter_id,
      NEW.event_id,
      (SELECT username FROM profiles WHERE id = NEW.inviter_id) || ' invited you to an event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_invite_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if status changed to accepted
  IF NEW.status = 'accepted' AND OLD.status = 'pending'
     AND notification_setting_enabled(NEW.inviter_id, 'event_invites', true) THEN
    INSERT INTO notifications (user_id, type, actor_id, event_id, message)
    SELECT
      NEW.inviter_id,
      'invite_accepted',
      NEW.invitee_id,
      NEW.event_id,
      (SELECT username FROM profiles WHERE id = NEW.invitee_id) || ' accepted your invite';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
