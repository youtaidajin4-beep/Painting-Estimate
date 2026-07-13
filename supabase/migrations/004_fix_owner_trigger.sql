-- Fix: protect_last_owner blocked cascade deletes when the whole
-- organization is removed. Allow member deletion if the parent
-- organization row no longer exists (i.e. org is being deleted).
CREATE OR REPLACE FUNCTION protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the organization itself is gone, this is a cascade delete: allow it.
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.role = 'owner')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner') THEN
    IF (SELECT count(*) FROM organization_members
        WHERE organization_id = OLD.organization_id AND role = 'owner') <= 1 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last owner';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
