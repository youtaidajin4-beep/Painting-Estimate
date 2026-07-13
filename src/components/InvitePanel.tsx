import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useTenant } from "../tenant/TenantProvider";

export function InvitePanel() {
  const { organization } = useTenant();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!organization || !["owner", "admin"].includes(organization.role)) return null;

  const createInvite = async () => {
    if (!supabase || !organization) return;
    setBusy(true);
    setErr("");
    const { data, error } = await supabase
      .from("organization_invites")
      .insert({ organization_id: organization.id, role: "member" })
      .select("token")
      .single();
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setToken(data.token);
  };

  const copyInvite = async () => {
    const text = `招待コード: ${token}\nアプリにログイン後「招待コードで参加」に入力してください。`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{ padding: "8px 12px", fontSize: 12, borderTop: "1px solid #dde1e6", background: "#fafafa" }}>
      <button
        type="button"
        disabled={busy}
        onClick={createInvite}
        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dde1e6", background: "#fff", cursor: "pointer" }}
      >
        メンバー招待コードを発行
      </button>
      {token && (
        <span style={{ marginLeft: 8 }}>
          コード: <code>{token}</code>{" "}
          <button type="button" onClick={copyInvite} style={{ marginLeft: 4, cursor: "pointer" }}>
            コピー
          </button>
        </span>
      )}
      {err && <span style={{ color: "#ff3b30", marginLeft: 8 }}>{err}</span>}
    </div>
  );
}
