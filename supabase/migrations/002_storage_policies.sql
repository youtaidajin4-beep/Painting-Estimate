-- Storage bucket policies for tenant-assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "members_read_tenant_assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "members_upload_tenant_assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "members_update_tenant_assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "members_delete_tenant_assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);
