import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Organization } from "../types/tenant";

export type AppId = "paint" | "genba";

interface AppShellContextValue {
  currentApp: AppId;
  switchApp: (app: AppId) => void;
  signOut: () => Promise<void>;
  organization: Organization | null;
  organizations: Organization[];
  selectOrganization: (id: string) => void;
  canInvite: boolean;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({
  children,
  currentApp,
  switchApp,
  signOut,
  organization,
  organizations,
  selectOrganization,
}: {
  children: ReactNode;
  currentApp: AppId;
  switchApp: (app: AppId) => void;
  signOut: () => Promise<void>;
  organization: Organization | null;
  organizations: Organization[];
  selectOrganization: (id: string) => void;
}) {
  const value = useMemo<AppShellContextValue>(
    () => ({
      currentApp,
      switchApp,
      signOut,
      organization,
      organizations,
      selectOrganization,
      canInvite: Boolean(organization && ["owner", "admin"].includes(organization.role)),
    }),
    [currentApp, switchApp, signOut, organization, organizations, selectOrganization]
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  return ctx;
}

export function installStorageForApp(app: AppId) {
  if (app === "paint" && window.__paintStorage) {
    window.storage = {
      get: (k) => window.__paintStorage!.get(k),
      set: (k, v) => window.__paintStorage!.set(k, v),
      delete: (k) => window.__paintStorage!.delete(k),
      list: async () => ({ keys: [] }),
    };
  } else if (app === "genba" && window.__genbaStorage) {
    window.storage = {
      get: (k) => window.__genbaStorage!.get(k),
      set: (k, v) => window.__genbaStorage!.set(k, v),
      delete: (k) => window.__genbaStorage!.delete(k),
      list: async () => ({ keys: [] }),
    };
  }
}
