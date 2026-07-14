import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useTenant } from "../tenant/TenantProvider";

interface InvitePanelProps {
  open: boolean;
  onClose: () => void;
}

export function InvitePanel({ open, onClose }: InvitePanelProps) {
  const { organization } = useTenant();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open || !organization || !["owner", "admin"].includes(organization.role)) {
    return null;
  }

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
    <div
      className="no-print"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,.4)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 16,
          padding: "24px 20px",
          boxShadow: "0 12px 40px rgba(0,0,0,.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>メンバー招待</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
          招待コードを発行して、チームメンバーに共有してください。
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={createInvite}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "#1b7f3b",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "発行中…" : "招待コードを発行"}
        </button>
        {token && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#f0fdf4",
              borderRadius: 10,
              border: "1px solid #bbf7d0",
            }}
          >
            <div style={{ fontSize: 12, color: "#166534", marginBottom: 6 }}>招待コード</div>
            <code style={{ fontSize: 13, wordBreak: "break-all" }}>{token}</code>
            <button
              type="button"
              onClick={copyInvite}
              style={{
                display: "block",
                marginTop: 10,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #dde1e6",
                background: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              コピー
            </button>
          </div>
        )}
        {err && <p style={{ color: "#ff3b30", fontSize: 13, marginTop: 12 }}>{err}</p>}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "10px",
            border: "none",
            background: "transparent",
            color: "#6b7280",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
