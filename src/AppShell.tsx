import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { callAnthropic } from "./lib/ai";
import { isSupabaseConfigured } from "./lib/supabase";
import { uploadBrandingAsset } from "./lib/storageAdapter";
import { supabase } from "./lib/supabase";
import { OnboardingPage } from "./pages/OnboardingPage";
import { TenantProvider, useTenant } from "./tenant/TenantProvider";
import type { OrganizationBranding } from "./types/tenant";
import { AppShellProvider, installStorageForApp, type AppId } from "./context/AppShellContext";

const PaintApp = lazy(() => import("../塗装見積Pro"));
const GenbaKanriPro = lazy(() => import("../現場管理Pro"));

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

  const switchApp = useCallback((next: AppId) => {
    setApp(next);
    installStorageForApp(next);
  }, []);

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

  return (
    <AppShellProvider
      currentApp={app}
      switchApp={switchApp}
      signOut={signOut}
      organization={organization}
      organizations={organizations}
      selectOrganization={selectOrganization}
    >
      <Suspense fallback={<LoadingScreen label="アプリを読み込み中…" />}>
        {app === "paint" ? (
          <PaintApp branding={branding} tenantMode onBrandingChange={handleBrandingChange} />
        ) : (
          <GenbaKanriPro branding={branding} tenantMode />
        )}
      </Suspense>
    </AppShellProvider>
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
