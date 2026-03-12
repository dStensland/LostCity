-- Keep Atlanta interest channels high-signal: the adaptive recreation
-- channel is not yet materializing matches cleanly, so disable it until
-- the upstream matching/access path is resolved.

UPDATE interest_channels
SET
  is_active = false,
  updated_at = now()
WHERE portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
  AND slug = 'atlanta-adaptive-recreation';
