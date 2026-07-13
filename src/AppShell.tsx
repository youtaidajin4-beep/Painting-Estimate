import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { callAnthropic } from "./lib/ai";
import { isSupabaseConfigured } from "./lib/supabase";
import { uploadBrandingAsset } from "./lib/storageAdapter";
import { supabase } from "./lib/supabase";
import { OnboardingPage } from "./pages/OnboardingPage";
import { TenantProvider, useTenant } from "./tenant/TenantProvider";
import type { OrganizationBranding } from "./types/tenant";
import { InvitePanel } from "./components/InvitePanel";

const PaintApp = lazy(() => import("../塗装見積Pro"));
const GenbaKanriPro = lazy(() => import("../現場管理Pro"));

type AppId = "paint" | "genba";

function LoadingScreen({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        color: "#86868b",
        fontFamily: "system-ui, sans-serif",
        background: "#f5f5f7",
      }}
    >
      {label}
    </div>
  );
}

function AuthenticatedShell() {
  const { user, signOut, loading: authLoading } = useAuth();
  const {
    organization,
    organizations,
    branding,
    loading: tenantLoading,
    selectOrganization,
    updateBranding,
  } = useTenant();
  const [app, setApp] = useState<AppId>("paint");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    window.__callAnthropic = callAnthropic;
    return () => {
      delete window.__callAnthropic;
    };
  }, []);

  useEffect(() => {
    if (!tenantLoading && user && organizations.length === 0) {
      setNeedsOnboarding(true);
    } else if (organizations.length > 0) {
      setNeedsOnboarding(false);
    }
  }, [tenantLoading, user, organizations.length]);

  const handleBrandingChange = async (patch: Partial<OrganizationBranding> & { logo?: string; seal?: string }) => {
    if (!organization || !supabase) return;
    const next: Partial<OrganizationBranding> = { ...patch };
    if (patch.logo?.startsWith("data:")) {
      const url = await uploadBrandingAsset(supabase, organization.id, "logo", patch.logo);
      if (url) next.logo_url = url;
    }
    if (patch.seal?.startsWith("data:")) {
      const url = await uploadBrandingAsset(supabase, organization.id, "seal", patch.seal);
      if (url) next.seal_url = url;
    }
    await updateBranding(next);
  };

  if (authLoading || tenantLoading) {
    return <LoadingScreen />;
  }

  if (!user) return <LoginPage />;

  if (needsOnboarding || !organization) {
    return <OnboardingPage onComplete={() => window.location.reload()} />;
  }

  const shellStyles = `
    .app-shell-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff; border-bottom: 1px solid #dde1e6; position: sticky; top: 0; z-index: 100; }
    .app-shell-tabs { display: flex; gap: 4px; flex: 1; }
    .app-shell-tab { padding: 8px 14px; border-radius: 8px; border: none; background: transparent; font-size: 14px; font-weight: 600; cursor: pointer; color: #5c6570; }
    .app-shell-tab.active { background: #f0faf3; color: var(--tenant-primary, #1b7f3b); }
    .app-shell-org { font-size: 13px; color: #86868b; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .app-shell-logout { padding: 6px 10px; border: 1px solid #dde1e6; border-radius: 8px; background: #fff; font-size: 12px; cursor: pointer; }
  `;

  return (
  <>
    <style>{shellStyles}</style>
    <div className="app-shell-bar no-print">
      <div className="app-shell-tabs">
        <button
          className={`app-shell-tab ${app === "paint" ? "active" : ""}`}
          onClick={() => {
            setApp("paint");
            if (window.__paintStorage) {
              window.storage = {
                get: (k) => window.__paintStorage!.get(k),
                set: (k, v) => window.__paintStorage!.set(k, v),
                delete: (k) => window.__paintStorage!.delete(k),
                list: async () => ({ keys: [] }),
              };
            }
          }}
        >
          塗装見積
        </button>
        <button
          className={`app-shell-tab ${app === "genba" ? "active" : ""}`}
          onClick={() => {
            setApp("genba");
            if (window.__genbaStorage) {
              window.storage = {
                get: (k) => window.__genbaStorage!.get(k),
                set: (k, v) => window.__genbaStorage!.set(k, v),
                delete: (k) => window.__genbaStorage!.delete(k),
                list: async () => ({ keys: [] }),
              };
            }
          }}
        >
          現場管理
        </button>
      </div>
      {organizations.length > 1 && (
        <select
          className="app-shell-org"
          value={organization.id}
          onChange={(e) => selectOrganization(e.target.value)}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      {organizations.length === 1 && (
        <span className="app-shell-org">{organizations[0]?.name}</span>
      )}
      <button className="app-shell-logout" onClick={() => signOut()}>
        ログアウト
      </button>
    </div>
    <InvitePanel />
    <Suspense fallback={<LoadingScreen label="アプリを読み込み中…" />}>
      {app === "paint" ? (
        <PaintApp branding={branding} tenantMode onBrandingChange={handleBrandingChange} />
      ) : (
        <GenbaKanriPro branding={branding} tenantMode />
      )}
    </Suspense>
  </>
  );
}

function OfflineApp() {
  return (
    <Suspense fallback={<LoadingScreen label="アプリを読み込み中…" />}>
      <PaintApp tenantMode={false} />
    </Suspense>
  );
}

export function AppShell() {
  const { user, loading: authLoading } = useAuth();
  const [offlineMode, setOfflineMode] = useState(false);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    if (offlineMode) {
      return <OfflineApp />;
    }
    return <LoginPage onOfflineContinue={() => setOfflineMode(true)} />;
  }

  if (!isSupabaseConfigured) {
    return <OfflineApp />;
  }

  return (
    <TenantProvider organizationId={null}>
      <AuthenticatedShell />
    </TenantProvider>
  );
}
