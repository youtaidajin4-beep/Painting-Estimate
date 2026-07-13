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
  .login-btn.link { background: transparent; border: none; color: #1b7f3b; font-size: 14px; margin: 4px 0 0; padding: 8px; }
  .login-divider { text-align: center; color: #86868b; font-size: 13px; margin: 18px 0; }
  .login-input { width: 100%; padding: 12px 14px; border: 1px solid #dde1e6; border-radius: 10px; font-size: 15px; margin-bottom: 10px; box-sizing: border-box; }
  .login-msg { font-size: 13px; color: #1b7f3b; margin-top: 8px; line-height: 1.6; }
  .login-err { font-size: 13px; color: #ff3b30; margin-top: 8px; line-height: 1.6; }
  .login-note { font-size: 13px; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; line-height: 1.6; }
`;

type Mode = "login" | "signup";

interface LoginPageProps {
  onOfflineContinue?: () => void;
}

export function LoginPage({ onOfflineContinue }: LoginPageProps) {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cloudReady = isSupabaseConfigured;
  const showOffline = Boolean(onOfflineContinue && import.meta.env.DEV);

  const resetMessages = () => {
    setErr("");
    setMsg("");
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetMessages();
    setPassword("");
    setPasswordConfirm("");
  };

  const handleSubmit = async () => {
    resetMessages();
    if (!email.trim()) {
      setErr("メールアドレスを入力してください");
      return;
    }
    if (!password) {
      setErr("パスワードを入力してください");
      return;
    }
    if (password.length < 6) {
      setErr("パスワードは6文字以上で入力してください");
      return;
    }
    if (mode === "signup" && password !== passwordConfirm) {
      setErr("パスワード（確認）が一致しません");
      return;
    }
    if (!cloudReady) {
      setErr("ログイン機能を準備中です。しばらくしてから再度お試しください。");
      return;
    }

    setBusy(true);
    const res =
      mode === "login"
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(email.trim(), password);
    setBusy(false);

    if (res.error) {
      setErr(res.error);
      return;
    }

    if (mode === "signup") {
      setMsg("アカウントを作成しました。ログインしています…");
    }
  };

  return (
    <div className="login-wrap">
      <style>{styles}</style>
      <div className="login-card">
        <h1 className="login-title">塗装見積 Pro</h1>
        <p className="login-sub">会社ごとにデータとロゴが分離されたクラウド版です。</p>
        <p className="login-hint">
          {mode === "login"
            ? "メールアドレスとパスワードでログインしてください。次回からは自動でログイン状態が続きます。"
            : "初回のみアカウントを作成してください。作成後は同じメールとパスワードでログインできます。"}
        </p>

        {!cloudReady && (
          <div className="login-note">
            ログイン機能を準備中です。開発者向け: `.env` に Supabase の設定を入れてください。
          </div>
        )}

        <input
          className="login-input"
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoComplete="email"
        />
        <input
          className="login-input"
          type="password"
          placeholder="パスワード（6文字以上）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "signup" && (
          <input
            className="login-input"
            type="password"
            placeholder="パスワード（確認）"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoComplete="new-password"
          />
        )}

        <button className="login-btn primary" disabled={busy} onClick={handleSubmit}>
          {busy ? "処理中…" : mode === "login" ? "ログインする" : "アカウントを作成する"}
        </button>

        <button className="login-btn link" type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "初めての方はこちら（新規登録）" : "すでにアカウントをお持ちの方はログイン"}
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
