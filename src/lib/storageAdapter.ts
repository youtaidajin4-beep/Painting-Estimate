import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTO_PREFIXES = ["paint-photos-", "paint-repph-"];

function isPhotoKey(key: string) {
  return PHOTO_PREFIXES.some((p) => key.startsWith(p));
}

function photoStoragePath(orgId: string, app: string, key: string) {
  return `${orgId}/${app}/photos/${key}.json`;
}

export interface CloudStorageAdapter {
  load<T>(key: string, fallback: T): Promise<T>;
  save(key: string, value: unknown): Promise<boolean>;
  get(key: string): Promise<{ key: string; value: string }>;
  set(key: string, value: string): Promise<{ key: string; value: string }>;
  delete(key: string): Promise<{ key: string; deleted: boolean }>;
}

export function createCloudStorageAdapter(
  supabase: SupabaseClient,
  organizationId: string,
  app: "paint" | "genba"
): CloudStorageAdapter {
  async function loadPhoto(key: string): Promise<string | null> {
    const { data: meta } = await supabase
      .from("tenant_photos")
      .select("storage_path")
      .eq("organization_id", organizationId)
      .eq("app", app)
      .eq("photo_key", key)
      .maybeSingle();

    if (!meta?.storage_path) return null;

    const { data, error } = await supabase.storage
      .from("tenant-assets")
      .download(meta.storage_path);

    if (error || !data) return null;
    return await data.text();
  }

  async function savePhoto(key: string, value: string): Promise<boolean> {
    const path = photoStoragePath(organizationId, app, key);
    const blob = new Blob([value], { type: "application/json" });

    const { error: upErr } = await supabase.storage
      .from("tenant-assets")
      .upload(path, blob, { upsert: true, contentType: "application/json" });

    if (upErr) return false;

    const { error: metaErr } = await supabase.from("tenant_photos").upsert(
      {
        organization_id: organizationId,
        app,
        photo_key: key,
        storage_path: path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,app,photo_key" }
    );

    return !metaErr;
  }

  async function deletePhoto(key: string): Promise<boolean> {
    const { data: meta } = await supabase
      .from("tenant_photos")
      .select("storage_path")
      .eq("organization_id", organizationId)
      .eq("app", app)
      .eq("photo_key", key)
      .maybeSingle();

    if (meta?.storage_path) {
      await supabase.storage.from("tenant-assets").remove([meta.storage_path]);
    }

    await supabase
      .from("tenant_photos")
      .delete()
      .eq("organization_id", organizationId)
      .eq("app", app)
      .eq("photo_key", key);

    return true;
  }

  return {
    async load<T>(key: string, fallback: T): Promise<T> {
      try {
        if (isPhotoKey(key)) {
          const raw = await loadPhoto(key);
          if (raw) return JSON.parse(raw) as T;
          return fallback;
        }

        const { data, error } = await supabase
          .from("tenant_data")
          .select("data_value")
          .eq("organization_id", organizationId)
          .eq("app", app)
          .eq("data_key", key)
          .maybeSingle();

        if (error || !data) return fallback;
        return data.data_value as T;
      } catch {
        return fallback;
      }
    },

    async save(key: string, value: unknown): Promise<boolean> {
      try {
        if (isPhotoKey(key)) {
          return savePhoto(key, JSON.stringify(value));
        }

        const { error } = await supabase.from("tenant_data").upsert(
          {
            organization_id: organizationId,
            app,
            data_key: key,
            data_value: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,app,data_key" }
        );

        return !error;
      } catch {
        return false;
      }
    },

    async get(key: string) {
      if (isPhotoKey(key)) {
        const raw = await loadPhoto(key);
        if (raw === null) throw new Error("not found");
        return { key, value: raw };
      }

      const { data, error } = await supabase
        .from("tenant_data")
        .select("data_value")
        .eq("organization_id", organizationId)
        .eq("app", app)
        .eq("data_key", key)
        .maybeSingle();

      if (error || !data) throw new Error("not found");
      return { key, value: JSON.stringify(data.data_value) };
    },

    async set(key: string, value: string) {
      if (isPhotoKey(key)) {
        const ok = await savePhoto(key, value);
        if (!ok) throw new Error("save failed");
        return { key, value };
      }

      const parsed = JSON.parse(value);
      const ok = await this.save(key, parsed);
      if (!ok) throw new Error("save failed");
      return { key, value };
    },

    async delete(key: string) {
      if (isPhotoKey(key)) {
        await deletePhoto(key);
        return { key, deleted: true };
      }

      await supabase
        .from("tenant_data")
        .delete()
        .eq("organization_id", organizationId)
        .eq("app", app)
        .eq("data_key", key);

      return { key, deleted: true };
    },
  };
}

export function installStorageAdapter(adapter: CloudStorageAdapter, prefix: string) {
  window.storage = {
    get: (key) => adapter.get(key),
    set: (key, value) => adapter.set(key, value),
    delete: (key) => adapter.delete(key),
    list: async () => ({ keys: [] }),
  };
  window.__cloudStorage = adapter;
  window.__storagePrefix = prefix;
}

export async function uploadBrandingAsset(
  supabase: SupabaseClient,
  organizationId: string,
  kind: "logo" | "seal",
  dataUrl: string
): Promise<string | null> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const path = `${organizationId}/branding/${kind}.${ext}`;

  const { error } = await supabase.storage
    .from("tenant-assets")
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (error) return null;

  const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
  return data.publicUrl;
}
