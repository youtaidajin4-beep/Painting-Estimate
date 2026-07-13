import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "../lib/supabase";

const styles = `
  .login-wrap { min-height: 100vh; display: grid; place-items: center; background: #f5f5f7; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .login-card { width: 100%; max-width: 420px; background: #fff; border-radius: 16px; padding: 32px 28px; box-shadow: 0 8px 32px rgba(0,0,0,.08); }
  .login-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; color: #1d1d1f; }
  .login-sub { font-size: 14px; color: #86868b; margin: 0 0 24px; line-height: 1.6; }
  .login-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 13px 16px; border-radius: 10px; border: 1px solid #dde1e6; background: #fff; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 10px; color: #1d1d1f; }
  .login-btn:hover { background: #f9f9fb; }
  .login-btn.primary { background: #1b7f3b; color: #fff; border-color: #1b7f3b; }
  .login-btn.line { background: #06c755; color: #fff; border-color: #06c755; }
  .login-btn.ghost { background: #f2f2f7; border-color: #dde1e6; }
  .login-divider { text-align: center; color: #86868b; font-size: 13px; margin: 18px 0; }
  .login-input { width: 100%; padding: 12px 14px; border: 1px solid #dde1e6; border-radius: 10px; font-size: 15px; margin-bottom: 10px; box-sizing: border-box; }
  .login-msg { font-size: 13px; color: #1b7f3b; margin-top: 8px; }
  .login-err { font-size: 13px; color: #ff3b30; margin-top: 8px; }
  .login-note { font-size: 13px; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; line-height: 1.6; }
`;

interface LoginPageProps {
  onOfflineContinue?: () => void;
}

export function LoginPage({ onOfflineContinue }: LoginPageProps) {
  const { signInWithGoogle, signInWithApple, signInWithLine, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cloudReady = isSupabaseConfigured;

  const handleEmail = async () => {
    setErr("");
    setMsg("");
    if (!email.trim()) {
      setErr("メールアドレスを入力してください");
      return;
    }
    if (!cloudReady) {
      setErr("クラウドログインを使うには .env に Supabase の設定が必要です");
      return;
    }
    setBusy(true);
    const res = await signInWithEmail(email.trim());
    setBusy(false);
    if (res.error) setErr(res.error);
    else setMsg("ログインリンクをメールで送信しました。受信トレイをご確認ください。");
  };

  const handleOAuth = async (fn: () => Promise<void>, label: string) => {
    if (!cloudReady) {
      setErr(`「${label}」を使うには .env に Supabase の設定が必要です`);
      return;
    }
    setErr("");
    await fn();
  };

  return (
    <div className="login-wrap">
      <style>{styles}</style>
      <div className="login-card">
        <h1 className="login-title">塗装見積 Pro</h1>
        <p className="login-sub">
          会社ごとにデータとロゴが分離されたクラウド版です。ログイン方法を選んでください。
        </p>

        {!cloudReady && (
          <div className="login-note">
            Supabase が未設定のため、クラウドログインはまだ使えません。
            `.env` を設定するか、下の「オフラインで試す」からアプリを開けます。
          </div>
        )}

        <button className="login-btn" onClick={() => handleOAuth(signInWithGoogle, "Gmail でログイン")}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.52 2.98-2.1 5.5-4.48 7.18l7.17 5.57C42.98 37.99 46.98 31.84 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.17-5.57c-2.01 1.35-4.59 2.16-8.72 2.16-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Gmail でログイン
        </button>

        <button className="login-btn" onClick={() => handleOAuth(signInWithApple, "Apple でログイン")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.985 1.447-.12-1.108.507-2.29 1.243-3.126C14.176 2.67 15.5 1.994 16.365 1.43zM20.88 17.17c-.735 1.08-1.584 2.148-2.85 2.148-1.062 0-1.413-.695-2.642-.695-1.23 0-1.62.67-2.644.718-1.06.044-1.866-.958-2.593-2.037-1.418-2.05-2.505-5.8-1.035-8.337.73-1.26 2.04-2.04 3.526-2.063 1.085-.02 2.087.73 2.738.73.63 0 1.84-.9 3.1-.768.527.022 2.005.21 2.95 1.58-.075.047-1.76 1.03-1.74 3.074.022 2.44 2.13 3.26 2.16 3.27-.02.06-.336 1.15-1.1 2.27z"/></svg>
          Apple でログイン
        </button>

        <button className="login-btn line" onClick={() => handleOAuth(signInWithLine, "LINE でログイン")}>
          LINE でログイン
        </button>

        <div className="login-divider">またはメールアドレス</div>

        <input
          className="login-input"
          type="email"
          placeholder="name@company.co.jp"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEmail()}
        />
        <button className="login-btn primary" disabled={busy} onClick={handleEmail}>
          メールでログインリンクを送る
        </button>

        {onOfflineContinue && (
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
