-- Organizations (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  plan TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization members
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- White-label branding
CREATE TABLE organization_branding (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  app_name TEXT DEFAULT '塗装見積 Pro',
  logo_url TEXT,
  seal_url TEXT,
  primary_color TEXT DEFAULT '#1B7F3B',
  co_name TEXT DEFAULT '',
  co_addr TEXT DEFAULT '',
  co_tel TEXT DEFAULT '',
  co_mail TEXT DEFAULT '',
  co_rep TEXT DEFAULT '',
  support_url TEXT DEFAULT '',
  terms TEXT DEFAULT '工事完了後、翌月末までに下記口座へお振込みをお願いいたします。',
  bank TEXT DEFAULT '',
  invoice_no TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Generic tenant-scoped key-value data (paint-set-v1, gm-sites-v1, etc.)
CREATE TABLE tenant_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('paint', 'genba')),
  data_key TEXT NOT NULL,
  data_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, app, data_key)
);

-- Photo metadata (actual blobs in Storage)
CREATE TABLE tenant_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('paint', 'genba')),
  photo_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, app, photo_key)
);

-- Organization invitations
CREATE TABLE organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Helper: check membership
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_org" ON organizations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY "members_read_members" ON organization_members
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "admins_manage_members" ON organization_members
  FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "members_read_branding" ON organization_branding
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "admins_update_branding" ON organization_branding
  FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "members_rw_tenant_data" ON tenant_data
  FOR ALL USING (is_org_member(organization_id));

CREATE POLICY "members_rw_tenant_photos" ON tenant_photos
  FOR ALL USING (is_org_member(organization_id));

CREATE POLICY "members_read_invites" ON organization_invites
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "admins_manage_invites" ON organization_invites
  FOR ALL USING (is_org_admin(organization_id));

-- Create organization with owner (onboarding)
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

-- Join organization via invite token
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
  WHERE token = invite_token AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (inv.organization_id, auth.uid(), inv.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN inv.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_organization_with_owner(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_organization_by_invite(TEXT) TO authenticated;

-- Storage bucket (run via dashboard or storage API)
-- Bucket: tenant-assets, path: {org_id}/...
