import { google } from "googleapis";

/** URI de callback OAuth — local, Vercel ou pedido HTTP actual. */
export function getGoogleOAuthRedirectUri(req) {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }

  if (req?.headers) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host && !host.includes("localhost")) {
      return `${proto}://${host}/api/drive/auth/callback`;
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/drive/auth/callback`;
  }

  return "http://localhost:3333/api/drive/auth/callback";
}

export function isInvalidGrantError(error) {
  const message = String(error?.message || error?.response?.data?.error || "").toLowerCase();
  return message.includes("invalid_grant");
}

/** Google nem sempre reenvia refresh_token — nunca o apagar ao guardar. */
export function mergeOAuthTokens(current = {}, incoming = {}) {
  const merged = { ...current, ...incoming };
  if (!incoming.refresh_token && current.refresh_token) {
    merged.refresh_token = current.refresh_token;
  }
  return merged;
}

export async function clearStoredOAuthTokens(supabase, localTokensPath, fs) {
  try {
    if (localTokensPath && fs?.existsSync?.(localTokensPath)) {
      fs.unlinkSync(localTokensPath);
    }
  } catch (_) {}

  if (supabase) {
    try {
      await supabase.from("settings").delete().eq("key", "google_drive_tokens");
    } catch (_) {}
  }
}

/** Valida/renova tokens antes de usar a API. */
export async function buildOAuthClient(oauthKeys, tokens, redirectUri, onTokensUpdated) {
  const oauth2Client = new google.auth.OAuth2(
    oauthKeys.client_id,
    oauthKeys.client_secret,
    redirectUri,
  );
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    const merged = mergeOAuthTokens(oauth2Client.credentials, newTokens);
    oauth2Client.setCredentials(merged);
    if (onTokensUpdated) {
      await onTokensUpdated(merged);
    }
  });

  await oauth2Client.getAccessToken();
  return oauth2Client;
}
