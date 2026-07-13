import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "../lib/supabase";

const styles = `
  .login-wrap { min-height: 100vh; display: grid; place-items: center; background: #f5f5f7; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .login-card { width: 100%; max-width: 420px; background: #fff; border-radius: 16px; padding: 32px 28px; box-shadow: 0 8px 32px rgba(0,0,0,.08); }
  .login-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; color: #1d1d1f; }
  .login-sub { font-size: 14px; color: #86868b; margin: 0 0 8px; line-height: 1.6; }
  .login-hint { font-size: 13px; color: #5c6570; margin: 0 0 20px; line-height: 1.6; }
  .login-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 13px 16px; border-radius: 10px; border: 1px solid #dde1e6; background: #fff; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 10px; color: #1d1d1f; }
  .login-btn:hover { background: #f9f9fb; }
  .login-btn.primary { background: #1b7f3b; color: #fff; border-color: #1b7f3b; }
  .login-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .login-btn.ghost { background: #f2f2f7; border-color: #dde1e6; }
  .login-divider { text-align: center; color: #86868b; font-size: 13px; margin: 18px 0; }
  .login-input { width: 100%; padding: 12px 14px; border: 1px solid #dde1e6; border-radius: 10px; font-size: 15px; margin-bottom: 10px; box-sizing: border-box; }
  .login-msg { font-size: 13px; color: #1b7f3b; margin-top: 8px; line-height: 1.6; }
  .login-err { font-size: 13px; color: #ff3b30; margin-top: 8px; line-height: 1.6; }
  .login-note { font-size: 13px; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; line-height: 1.6; }
`;

interface LoginPageProps {
  onOfflineContinue?: () => void;
}

export function LoginPage({ onOfflineContinue }: LoginPageProps) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cloudReady = isSupabaseConfigured;
  const showOffline = Boolean(onOfflineContinue && import.meta.env.DEV);

  const handleLogin = async () => {
    setErr("");
    setMsg("");
    if (!email.trim()) {
      setErr("メールアドレスを入力してください");
      return;
    }
    if (!cloudReady) {
      setErr("ログイン機能を準備中です。しばらくしてから再度お試しください。");
      return;
    }
    setBusy(true);
    const res = await signInWithEmail(email.trim());
    setBusy(false);
    if (res.error) setErr(res.error);
    else {
      setMsg(
        "ログインリンクをメールで送信しました。メール内のリンクをクリックするとログインできます。初回の方も同じ手順で登録できます。"
      );
    }
  };

  return (
    <div className="login-wrap">
      <style>{styles}</style>
      <div className="login-card">
        <h1 className="login-title">塗装見積 Pro</h1>
        <p className="login-sub">
          会社ごとにデータとロゴが分離されたクラウド版です。
        </p>
        <p className="login-hint">
          メールアドレスを入力して「ログインする」を押してください。届いたリンクをクリックすればログイン完了です。
          初回は会社の作成画面が表示されます。
        </p>

        {!cloudReady && (
          <div className="login-note">
            ログイン機能を準備中です。開発者向け: `.env` に Supabase の設定を入れてください。
          </div>
        )}

        <input
          className="login-input"
          type="email"
          placeholder="name@company.co.jp"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          autoComplete="email"
        />
        <button className="login-btn primary" disabled={busy} onClick={handleLogin}>
          {busy ? "送信中…" : "ログインする"}
        </button>

        {showOffline && (
          <>
            <div className="login-divider">または</div>
            <button className="login-btn ghost" type="button" onClick={onOfflineContinue}>
              オフラインで試す（ログインなし）
            </button>
          </>
        )}

        {msg && <p className="login-msg">{msg}</p>}
        {err && <p className="login-err">{err}</p>}
      </div>
    </div>
  );
}
