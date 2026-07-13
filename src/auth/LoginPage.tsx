import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "../lib/supabase";

const styles = `
  @keyframes loginFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes loginFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  .login-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", sans-serif;
    background: #0f1419;
  }

  .login-hero {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 56px 48px;
    color: #fff;
    background:
      radial-gradient(ellipse 80% 60% at 20% 80%, rgba(27,127,59,.35) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 20%, rgba(59,130,246,.15) 0%, transparent 50%),
      linear-gradient(160deg, #0f1419 0%, #1a2332 50%, #0d1f17 100%);
  }
  .login-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: linear-gradient(to bottom, rgba(0,0,0,.6), transparent);
  }
  .login-hero-inner {
    position: relative;
    z-index: 1;
    max-width: 420px;
    animation: loginFadeUp .6s ease both;
  }
  .login-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(27,127,59,.2);
    border: 1px solid rgba(27,127,59,.4);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .04em;
    color: #86efac;
    margin-bottom: 24px;
  }
  .login-badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 8px #4ade80;
    animation: loginFloat 2.5s ease-in-out infinite;
  }
  .login-hero-title {
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 16px;
    letter-spacing: -.02em;
  }
  .login-hero-title span { color: #4ade80; }
  .login-hero-desc {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255,255,255,.65);
    margin: 0 0 36px;
  }
  .login-features {
    display: flex;
    flex-direction: column;
    gap: 14px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .login-feature {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: rgba(255,255,255,.8);
  }
  .login-feature-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.1);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    font-size: 16px;
  }

  .login-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    background: #f8faf9;
  }
  .login-card {
    width: 100%;
    max-width: 400px;
    animation: loginFadeUp .6s .1s ease both;
  }
  .login-card-header { margin-bottom: 28px; }
  .login-logo {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, #1b7f3b, #22c55e);
    display: grid;
    place-items: center;
    margin-bottom: 20px;
    box-shadow: 0 8px 24px rgba(27,127,59,.3);
  }
  .login-logo svg { width: 26px; height: 26px; }
  .login-card-title {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 6px;
    letter-spacing: -.02em;
  }
  .login-card-sub {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
  }

  .login-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    background: #e8eeeb;
    border-radius: 12px;
    margin-bottom: 24px;
  }
  .login-tab {
    padding: 10px 16px;
    border: none;
    border-radius: 9px;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: all .2s ease;
  }
  .login-tab.active {
    background: #fff;
    color: #1b7f3b;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
  }

  .login-field { margin-bottom: 16px; }
  .login-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
  }
  .login-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .login-input-icon {
    position: absolute;
    left: 14px;
    color: #9ca3af;
    pointer-events: none;
    display: flex;
  }
  .login-input {
    width: 100%;
    padding: 13px 14px 13px 42px;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    font-size: 15px;
    background: #fff;
    color: #111827;
    box-sizing: border-box;
    transition: border-color .2s, box-shadow .2s;
    outline: none;
  }
  .login-input:focus {
    border-color: #1b7f3b;
    box-shadow: 0 0 0 3px rgba(27,127,59,.12);
  }
  .login-input::placeholder { color: #9ca3af; }

  .login-submit {
    width: 100%;
    padding: 14px 20px;
    margin-top: 8px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #1b7f3b 0%, #16a34a 100%);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: transform .15s, box-shadow .15s, opacity .15s;
    box-shadow: 0 4px 16px rgba(27,127,59,.35);
    letter-spacing: .01em;
  }
  .login-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(27,127,59,.45);
  }
  .login-submit:active:not(:disabled) { transform: translateY(0); }
  .login-submit:disabled { opacity: .6; cursor: not-allowed; }

  .login-switch {
    text-align: center;
    margin-top: 20px;
    font-size: 14px;
    color: #6b7280;
  }
  .login-switch button {
    background: none;
    border: none;
    color: #1b7f3b;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .login-switch button:hover { color: #15803d; }

  .login-alert {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    margin-top: 16px;
  }
  .login-alert.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }
  .login-alert.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }
  .login-alert.warn {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #b45309;
    margin-bottom: 16px;
  }

  .login-offline {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
  }
  .login-offline button {
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 13px;
    color: #6b7280;
    cursor: pointer;
    transition: background .15s;
  }
  .login-offline button:hover { background: #f3f4f6; }

  @media (max-width: 860px) {
    .login-page { grid-template-columns: 1fr; }
    .login-hero { display: none; }
    .login-panel { min-height: 100vh; }
  }
`;

type Mode = "login" | "signup";

interface LoginPageProps {
  onOfflineContinue?: () => void;
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PaintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
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
    <div className="login-page">
      <style>{styles}</style>

      <aside className="login-hero">
        <div className="login-hero-inner">
          <div className="login-badge">
            <span className="login-badge-dot" />
            クラウド版 SaaS
          </div>
          <h1 className="login-hero-title">
            塗装見積を、<br />
            <span>もっとスマートに。</span>
          </h1>
          <p className="login-hero-desc">
            見積作成から現場管理まで。会社ごとにデータとロゴが完全分離された、塗装業専用のクラウドシステムです。
          </p>
          <ul className="login-features">
            <li className="login-feature">
              <span className="login-feature-icon">🏢</span>
              会社ごとにデータを完全分離
            </li>
            <li className="login-feature">
              <span className="login-feature-icon">🎨</span>
              ロゴ・テーマ色のホワイトラベル対応
            </li>
            <li className="login-feature">
              <span className="login-feature-icon">📋</span>
              見積・現場管理をひとつの画面で
            </li>
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-logo">
              <PaintIcon />
            </div>
            <h2 className="login-card-title">塗装見積 Pro</h2>
            <p className="login-card-sub">
              {mode === "login" ? "アカウントにログイン" : "新しいアカウントを作成"}
            </p>
          </div>

          {!cloudReady && (
            <div className="login-alert warn">
              ログイン機能を準備中です。開発者向け: `.env` に Supabase の設定を入れてください。
            </div>
          )}

          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              ログイン
            </button>
            <button
              type="button"
              className={`login-tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => switchMode("signup")}
            >
              新規登録
            </button>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              メールアドレス
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <MailIcon />
              </span>
              <input
                id="login-email"
                className="login-input"
                type="email"
                placeholder="name@company.co.jp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              パスワード
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <LockIcon />
              </span>
              <input
                id="login-password"
                className="login-input"
                type="password"
                placeholder="6文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          </div>

          {mode === "signup" && (
            <div className="login-field">
              <label className="login-label" htmlFor="login-password-confirm">
                パスワード（確認）
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <LockIcon />
                </span>
                <input
                  id="login-password-confirm"
                  className="login-input"
                  type="password"
                  placeholder="もう一度入力"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <button className="login-submit" disabled={busy} onClick={handleSubmit}>
            {busy ? "処理中…" : mode === "login" ? "ログインする" : "アカウントを作成する"}
          </button>

          <p className="login-switch">
            {mode === "login" ? (
              <>
                はじめての方は{" "}
                <button type="button" onClick={() => switchMode("signup")}>
                  新規登録
                </button>
              </>
            ) : (
              <>
                アカウントをお持ちの方は{" "}
                <button type="button" onClick={() => switchMode("login")}>
                  ログイン
                </button>
              </>
            )}
          </p>

          {msg && <div className="login-alert success">{msg}</div>}
          {err && <div className="login-alert error">{err}</div>}

          {showOffline && (
            <div className="login-offline">
              <button type="button" onClick={onOfflineContinue}>
                オフラインで試す（ログインなし）
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
