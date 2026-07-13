/** Map Supabase Auth errors to user-friendly Japanese messages. */
export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("email rate limit") || lower.includes("rate limit exceeded")) {
    return "メール送信の上限に達しました。しばらく待ってから再度お試しください（目安: 1時間ほど）。";
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (lower.includes("user already registered")) {
    return "このメールアドレスはすでに登録されています。ログインしてください。";
  }
  if (lower.includes("signup is disabled")) {
    return "新規登録は現在停止されています。管理者にお問い合わせください。";
  }
  if (lower.includes("email not confirmed")) {
    return "メールアドレスの確認が完了していません。届いたメールのリンクをクリックしてください。";
  }

  return message;
}
