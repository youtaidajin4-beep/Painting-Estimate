// LINE Login OIDC setup helper
// Configure in Supabase Dashboard > Authentication > Providers > OpenID Connect:
// - Provider name: line
// - Issuer URL: https://access.line.me
// - Client ID: (from LINE Developers Console)
// - Client Secret: (from LINE Developers Console)
//
// Callback URL: https://<project-ref>.supabase.co/auth/v1/callback
//
// LINE Developers Console:
// - Create LINE Login channel
// - Enable OpenID Connect
// - Set Callback URL to Supabase callback above

export const LINE_OIDC_SETUP = {
  providerId: "line",
  issuer: "https://access.line.me",
  scopes: "openid profile email",
};
