// Parent: REQ-1502, REQ-1301
// Google OAuth2 authorization-code flow helpers. Deliberately dependency-free
// (native fetch, Node 22) rather than pulling in passport — this project's
// other Coolify-hosted backends use the same plain redirect/callback pattern
// (see docs/SUBDOMAIN_ARNOBMAHMUD_SETUP.md), so this matches that convention.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  expires_in?: number;
  [key: string]: unknown;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function getGoogleAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: process.env.GOOGLE_CALLBACK_URL || "",
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    ...(state && { state }),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Exchanges the one-time authorization code for an access token.
// Throws if Google rejects the code (expired, already used, mismatched redirect_uri).
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: process.env.GOOGLE_CALLBACK_URL || "",
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} ${errorBody}`);
  }

  return response.json() as Promise<GoogleTokens>;
}

// Fetches the authenticated Google user's profile (email, name, picture, email_verified).
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo fetch failed: ${response.status}`);
  }

  return response.json() as Promise<GoogleProfile>;
}
