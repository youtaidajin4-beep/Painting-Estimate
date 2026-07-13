import type { OrganizationBranding } from "../types/tenant";

interface BrandHeaderProps {
  branding?: OrganizationBranding | null;
  subtitle?: string;
  className?: string;
}

export function BrandHeader({ branding, subtitle, className = "brand" }: BrandHeaderProps) {
  const appName = branding?.app_name || "塗装見積 Pro";
  const color = branding?.primary_color || "#1B7F3B";
  const parts = appName.split(/\s+/);
  const main = parts.slice(0, -1).join(" ") || appName.replace(/\s*Pro$/, "");
  const suffix = appName.includes("Pro") ? "Pro" : parts[parts.length - 1] || "";

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {branding?.logo_url ? (
        <img
          src={branding.logo_url}
          alt="ロゴ"
          style={{ height: 22, maxWidth: 80, objectFit: "contain" }}
        />
      ) : (
        <i style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />
      )}
      <span>
        {main} {suffix && <b style={{ color }}>{suffix}</b>}
      </span>
      {subtitle && <span style={{ fontSize: 13, color: "#86868b", marginLeft: 4 }}>{subtitle}</span>}
    </div>
  );
}
