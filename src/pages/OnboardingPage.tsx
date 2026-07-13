import { useState } from "react";
import { supabase } from "../lib/supabase";

const styles = `
  .onb-wrap { min-height: 100vh; display: grid; place-items: center; background: #f5f5f7; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .onb-card { width: 100%; max-width: 440px; background: #fff; border-radius: 16px; padding: 32px 28px; box-shadow: 0 8px 32px rgba(0,0,0,.08); }
  .onb-title { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
  .onb-sub { font-size: 14px; color: #86868b; margin: 0 0 20px; line-height: 1.6; }
  .onb-input { width: 100%; padding: 12px 14px; border: 1px solid #dde1e6; border-radius: 10px; font-size: 15px; margin-bottom: 12px; box-sizing: border-box; }
  .onb-btn { width: 100%; padding: 13px; border: none; border-radius: 10px; background: #1b7f3b; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  .onb-btn:disabled { opacity: .5; cursor: not-allowed; }
  .onb-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .onb-tab { flex: 1; padding: 10px; border: 1px solid #dde1e6; border-radius: 8px; background: #fff; cursor: pointer; font-size: 14px; }
  .onb-tab.active { border-color: #1b7f3b; background: #f0faf3; font-weight: 600; }
  .onb-err { color: #ff3b30; font-size: 13px; margin-top: 8px; }
`;

interface OnboardingPageProps {
  onComplete: (orgId: string) => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [orgName, setOrgName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleCreate = async () => {
    if (!supabase || !orgName.trim()) return;
    setBusy(true);
    setErr("");
    const { data, error } = await supabase.rpc("create_organization_with_owner", {
      org_name: orgName.trim(),
      branding_app_name: orgName.trim() + " 見積システム",
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onComplete(data as string);
  };

  const handleJoin = async () => {
    if (!supabase || !inviteToken.trim()) return;
    setBusy(true);
    setErr("");
    const { data, error } = await supabase.rpc("join_organization_by_invite", {
      invite_token: inviteToken.trim(),
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onComplete(data as string);
  };

  return (
    <div className="onb-wrap">
      <style>{styles}</style>
      <div className="onb-card">
        <h1 className="onb-title">会社のセットアップ</h1>
        <p className="onb-sub">
          新しい会社を登録するか、招待コードで既存のチームに参加してください。データとロゴは会社ごとに完全に分離されます。
        </p>

        <div className="onb-tabs">
          <button className={`onb-tab ${mode === "create" ? "active" : ""}`} onClick={() => setMode("create")}>
            新規会社を作成
          </button>
          <button className={`onb-tab ${mode === "join" ? "active" : ""}`} onClick={() => setMode("join")}>
            招待コードで参加
          </button>
        </div>

        {mode === "create" ? (
          <>
            <input
              className="onb-input"
              placeholder="会社名（例：株式会社○○塗装）"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <button className="onb-btn" disabled={busy || !orgName.trim()} onClick={handleCreate}>
              会社を作成して始める
            </button>
          </>
        ) : (
          <>
            <input
              className="onb-input"
              placeholder="招待コード"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
            />
            <button className="onb-btn" disabled={busy || !inviteToken.trim()} onClick={handleJoin}>
              チームに参加
            </button>
          </>
        )}

        {err && <p className="onb-err">{err}</p>}
      </div>
    </div>
  );
}
