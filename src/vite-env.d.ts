/// <reference types="vite/client" />

import type { OrganizationBranding } from "./types/tenant";

interface StorageAdapter {
  load<T>(key: string, fallback: T): Promise<T>;
  save(key: string, value: unknown): Promise<boolean>;
  get(key: string): Promise<{ key: string; value: string }>;
  set(key: string, value: string): Promise<{ key: string; value: string }>;
  delete(key: string): Promise<{ key: string; deleted: boolean }>;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_FUNCTIONS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    storage?: StorageAdapter & {
      list(): Promise<{ keys: string[] }>;
    };
    __cloudStorage?: StorageAdapter;
    __paintStorage?: StorageAdapter;
    __genbaStorage?: StorageAdapter;
    __tenantBranding?: OrganizationBranding;
    __activeOrgId?: string;
    __storagePrefix?: string;
    __callAnthropic?: (body: unknown) => Promise<Response>;
  }
}

export {};
