export type MemberRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  role: MemberRole;
}

export interface OrganizationBranding {
  organization_id: string;
  app_name: string;
  logo_url: string | null;
  seal_url: string | null;
  primary_color: string;
  co_name: string;
  co_addr: string;
  co_tel: string;
  co_mail: string;
  co_rep: string;
  support_url: string;
  terms: string;
  bank: string;
  invoice_no: string;
}

export const DEFAULT_BRANDING: OrganizationBranding = {
  organization_id: "",
  app_name: "塗装見積 Pro",
  logo_url: null,
  seal_url: null,
  primary_color: "#1B7F3B",
  co_name: "",
  co_addr: "",
  co_tel: "",
  co_mail: "",
  co_rep: "",
  support_url: "",
  terms: "工事完了後、翌月末までに下記口座へお振込みをお願いいたします。",
  bank: "",
  invoice_no: "",
};
