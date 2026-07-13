import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import {
  createCloudStorageAdapter,
  installStorageAdapter,
} from "../lib/storageAdapter";
import type { Organization, OrganizationBranding } from "../types/tenant";
import { DEFAULT_BRANDING } from "../types/tenant";

interface TenantContextValue {
  organizations: Organization[];
  organization: Organization | null;
  branding: OrganizationBranding;
  loading: boolean;
  selectOrganization: (id: string) => void;
  refreshBranding: () => Promise<void>;
  updateBranding: (patch: Partial<OrganizationBranding>) => Promise<boolean>;
}

const TenantContext = createContext<TenantContextValue | null>(null);
const ORG_STORAGE_KEY = "pw-active-org";

export function TenantProvider({
  children,
  organizationId,
}: {
  children: ReactNode;
  organizationId: string | null;
}) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [branding, setBranding] = useState<OrganizationBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const loadOrganizations = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("organization_members")
      .select("role, organizations(id, name, slug, plan)")
      .eq("user_id", user.id);

    const orgs: Organization[] = (data || [])
      .filter((row) => row.organizations)
      .map((row) => {
        const org = row.organizations as {
          id: string;
          name: string;
          slug: string | null;
          plan: string;
        };
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          role: row.role as Organization["role"],
        };
      });

    setOrganizations(orgs);

    const savedId = localStorage.getItem(ORG_STORAGE_KEY);
    const activeId =
      organizationId ||
      (savedId && orgs.find((o) => o.id === savedId)?.id) ||
      orgs[0]?.id ||
      null;

    if (activeId) {
      const org = orgs.find((o) => o.id === activeId) || null;
      setOrganization(org);
      localStorage.setItem(ORG_STORAGE_KEY, activeId);
    } else {
      setOrganization(null);
    }
  }, [user, organizationId]);

  const loadBranding = useCallback(async (orgId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("organization_branding")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (data) {
      setBranding(data as OrganizationBranding);
      document.title = data.app_name || "塗装見積 Pro";
      document.documentElement.style.setProperty(
        "--tenant-primary",
        data.primary_color || "#1B7F3B"
      );
      window.__tenantBranding = data as OrganizationBranding;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setOrganization(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      await loadOrganizations();
      setLoading(false);
    })();
  }, [user, loadOrganizations]);

  useEffect(() => {
    if (!organization || !supabase) return;

    loadBranding(organization.id);

    const paintAdapter = createCloudStorageAdapter(supabase, organization.id, "paint");
    const genbaAdapter = createCloudStorageAdapter(supabase, organization.id, "genba");

    window.__paintStorage = paintAdapter;
    window.__genbaStorage = genbaAdapter;
    installStorageAdapter(paintAdapter, "pw:");
    window.__activeOrgId = organization.id;
  }, [organization, loadBranding]);

  const selectOrganization = (id: string) => {
    const org = organizations.find((o) => o.id === id) || null;
    setOrganization(org);
    localStorage.setItem(ORG_STORAGE_KEY, id);
    if (org) loadBranding(org.id);
  };

  const refreshBranding = async () => {
    if (organization) await loadBranding(organization.id);
  };

  const updateBranding = async (patch: Partial<OrganizationBranding>) => {
    if (!supabase || !organization) return false;
    const next = { ...branding, ...patch, organization_id: organization.id };
    const { error } = await supabase
      .from("organization_branding")
      .upsert(next, { onConflict: "organization_id" });
    if (error) return false;
    setBranding(next);
    window.__tenantBranding = next;
    document.title = next.app_name;
    document.documentElement.style.setProperty(
      "--tenant-primary",
      next.primary_color || "#1B7F3B"
    );
    return true;
  };

  const value = useMemo(
    () => ({
      organizations,
      organization,
      branding,
      loading,
      selectOrganization,
      refreshBranding,
      updateBranding,
    }),
    [organizations, organization, branding, loading, refreshBranding, updateBranding]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
