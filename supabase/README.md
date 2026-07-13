# Supabase Edge Functions

## anthropic-proxy

サーバー側で Anthropic API を呼び出します。クライアントに API キーを置きません。

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy anthropic-proxy
```

## LINE Login

`supabase/functions/line-auth/README.md` を参照し、Supabase Dashboard で OIDC プロバイダ `line` を設定してください。
