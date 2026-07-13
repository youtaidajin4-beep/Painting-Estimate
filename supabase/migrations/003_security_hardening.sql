-- ============================================================
-- 003: Security hardening before production
--  1. Invite tokens: admins-only visibility, single-use
--  2. Member management: prevent admin -> owner escalation,
--     protect the last owner
--  3. Organization creation limit per user
--  4. Public branding bucket (logos need stable public URLs)
-- ============================================================

-- ---------- Helper: owner check ----------
CREATE OR REPLACE FUNCTION is_org_owner(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------- 1. Invites: hide tokens from plain members ----------
DROP POLICY IF EXISTS "members_read_invites" ON organization_invites;
-- admins_manage_invites (FOR ALL, admins) remains and covers SELECT for admins.

-- Single-use tracking
ALTER TABLE organization_invites ADD COLUMN IF NOT EXISTS used_by UUID REFERENCES auth.users(id);
ALTER TABLE organization_invites ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- ---------- 2. Member management hardening ----------
DROP POLICY IF EXISTS "admins_manage_members" ON organization_members;

-- Owners: full control over members of their org
CREATE POLICY "owners_manage_members" ON organization_members
  FOR ALL
  USING (is_org_owner(organization_id))
  WITH CHECK (is_org_owner(organization_id));

-- Admins: may only manage plain members (cannot touch or create owner/admin rows)
CREATE POLICY "admins_manage_plain_members" ON organization_members
  FOR ALL
  USING (is_org_admin(organization_id) AND role = 'member')
  WITH CHECK (is_org_admin(organization_id) AND role = 'member');

-- Protect the last owner from deletion / demotion
CREATE OR REPLACE FUNCTION protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_protect_last_owner ON organization_members;
CREATE TRIGGER trg_protect_last_owner
  BEFORE UPDATE OR DELETE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION protect_last_owner();

-- ---------- 3. Single-use invite + org creation limit ----------
CREATE OR REPLACE FUNCTION join_organization_by_invite(invite_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv organization_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv FROM organization_invites
  WHERE token = invite_token
    AND expires_at > now()
    AND used_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or already used invite';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = inv.organization_id AND user_id = auth.uid()
  ) THEN
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (inv.organization_id, auth.uid(), inv.role);

    UPDATE organization_invites
    SET used_at = now(), used_by = auth.uid()
    WHERE id = inv.id;
  END IF;

  RETURN inv.organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_organization_with_owner(
  org_name TEXT,
  branding_app_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Limit: max 5 organizations owned per user
  IF (SELECT count(*) FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner') >= 5 THEN
    RAISE EXCEPTION 'Organization limit reached (max 5 per user)';
  END IF;

  INSERT INTO organizations (name, slug)
  VALUES (
    org_name,
    lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8)
  )
  RETURNING id INTO new_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'owner');

  INSERT INTO organization_branding (organization_id, app_name, co_name)
  VALUES (
    new_org_id,
    COALESCE(branding_app_name, org_name || ' 見積システム'),
    org_name
  );

  RETURN new_org_id;
END;
$$;

-- ---------- 4. Public branding bucket ----------
-- Logos / seals need stable URLs usable in printed documents.
-- Filenames include a random suffix so URLs are unguessable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-branding', 'tenant-branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_tenant_branding" ON storage.objects;
CREATE POLICY "public_read_tenant_branding"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-branding');

DROP POLICY IF EXISTS "admins_insert_tenant_branding" ON storage.objects;
CREATE POLICY "admins_insert_tenant_branding"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-branding'
  AND is_org_admin((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "admins_update_tenant_branding" ON storage.objects;
CREATE POLICY "admins_update_tenant_branding"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-branding'
  AND is_org_admin((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "admins_delete_tenant_branding" ON storage.objects;
CREATE POLICY "admins_delete_tenant_branding"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-branding'
  AND is_org_admin((storage.foldername(name))[1]::uuid)
);
