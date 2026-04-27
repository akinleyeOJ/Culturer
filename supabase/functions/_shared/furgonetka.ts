// Shared Furgonetka REST + OAuth2 client used by every furgonetka-* Edge
// Function.
//
// Auth model: OAuth2 `password` grant (per Furgonetka sandbox docs).
//
//   1. Register an OAuth2 application in the Furgonetka panel
//      (sandbox: https://sandbox.furgonetka.pl/api/aplikacje-oauth)
//      to obtain client_id / client_secret.
//   2. We POST to {OAUTH_BASE}/oauth/token with HTTP Basic auth
//      (base64 client_id:client_secret) and form body:
//        grant_type=password
//        scope=api
//        username={Culturar's Furgonetka login email}
//        password={Culturar's Furgonetka login password}
//      -> returns access_token + refresh_token + expires_in (~hours)
//   3. The token is cached in module scope. Before it expires we use the
//      refresh_token (no re-login needed). If both fail we fall back to a
//      fresh `password` grant.
//
// Why password grant (not client_credentials)?
//   The Furgonetka REST API authorises actions as a *user*. Our shipping
//   strategy uses ONE Culturar-owned Furgonetka account that prints labels
//   on behalf of all sellers (per FURGONETKA_MIGRATION_PLAN.md). Sellers
//   don't need their own Furgonetka logins.
//
// Environment variables (Supabase project secrets):
//   FURGONETKA_CLIENT_ID       (required)
//   FURGONETKA_CLIENT_SECRET   (required)
//   FURGONETKA_USERNAME        (required — Culturar's Furgonetka login email)
//   FURGONETKA_PASSWORD        (required — Culturar's Furgonetka login password)
//   FURGONETKA_API_BASE        (optional, default = sandbox API host)
//   FURGONETKA_OAUTH_BASE      (optional, default = sandbox OAuth host)
//   FURGONETKA_OAUTH_SCOPE     (optional, default = "api")
//   FURGONETKA_LANGUAGE        (optional, default = "en_GB")

const SANDBOX_API_BASE = "https://api.sandbox.furgonetka.pl";
const SANDBOX_OAUTH_BASE = "https://api.sandbox.furgonetka.pl";

export const FURGONETKA_API_BASE =
  Deno.env.get("FURGONETKA_API_BASE") || SANDBOX_API_BASE;

export const FURGONETKA_OAUTH_BASE =
  Deno.env.get("FURGONETKA_OAUTH_BASE") || SANDBOX_OAUTH_BASE;

const FURGONETKA_OAUTH_SCOPE = Deno.env.get("FURGONETKA_OAUTH_SCOPE") || "api";

const FURGONETKA_LANGUAGE = Deno.env.get("FURGONETKA_LANGUAGE") || "en_GB";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const jsonResponse = (
  body: unknown,
  init: ResponseInit = { status: 200 },
) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

export const successResponse = (body: Record<string, unknown>) =>
  jsonResponse({ success: true, ...body });

export const errorResponse = (message: string, status = 200) =>
  jsonResponse({ success: false, error: message }, { status });

// ---------------------------------------------------------------------------
// OAuth2 token cache
// ---------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

const REFRESH_BUFFER_MS = 60_000;

const base64Encode = (input: string): string => {
  if (typeof btoa === "function") return btoa(input);
  // deno-lint-ignore no-explicit-any
  return (globalThis as any).Buffer.from(input, "utf-8").toString("base64");
};

const requireEnv = (name: string): string => {
  const value = Deno.env.get(name) || "";
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const getBasicAuthHeader = (): string => {
  const clientId = requireEnv("FURGONETKA_CLIENT_ID");
  const clientSecret = requireEnv("FURGONETKA_CLIENT_SECRET");
  return `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`;
};

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

const parseTokenResponse = (
  payload: OAuthTokenResponse,
  response: Response,
): CachedToken => {
  if (!response.ok) {
    const message =
      payload.error_description ||
      payload.error ||
      `OAuth token request failed (${response.status})`;
    throw new Error(message);
  }
  if (!payload.access_token) {
    throw new Error("OAuth token response did not contain access_token");
  }
  const expiresIn = Number(payload.expires_in || 3600);
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || null,
    expiresAt: Date.now() + Math.max(0, expiresIn * 1000 - REFRESH_BUFFER_MS),
  };
};

async function fetchTokenWithPasswordGrant(): Promise<CachedToken> {
  const username = requireEnv("FURGONETKA_USERNAME");
  const password = requireEnv("FURGONETKA_PASSWORD");

  const params = new URLSearchParams({
    grant_type: "password",
    scope: FURGONETKA_OAUTH_SCOPE,
    username,
    password,
  });

  const response = await fetch(`${FURGONETKA_OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as OAuthTokenResponse;
  return parseTokenResponse(payload, response);
}

async function fetchTokenWithRefresh(
  refreshToken: string,
): Promise<CachedToken> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${FURGONETKA_OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as OAuthTokenResponse;
  return parseTokenResponse(payload, response);
}

export async function getFurgonetkaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  if (cachedToken?.refreshToken) {
    try {
      cachedToken = await fetchTokenWithRefresh(cachedToken.refreshToken);
      return cachedToken.accessToken;
    } catch (refreshErr) {
      console.warn(
        "Furgonetka refresh_token grant failed, falling back to password grant:",
        refreshErr instanceof Error ? refreshErr.message : refreshErr,
      );
      cachedToken = null;
    }
  }

  cachedToken = await fetchTokenWithPasswordGrant();
  return cachedToken.accessToken;
}

export async function buildFurgonetkaHeaders(): Promise<HeadersInit> {
  const token = await getFurgonetkaToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Language": FURGONETKA_LANGUAGE,
  };
}

// ---------------------------------------------------------------------------
// Generic request helper
// ---------------------------------------------------------------------------

export interface FurgonetkaRequestOptions {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function callFurgonetka<T = unknown>({
  path,
  method = "GET",
  body,
  query,
}: FurgonetkaRequestOptions): Promise<T> {
  const url = new URL(path, FURGONETKA_API_BASE);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const doFetch = async () => {
    const headers = await buildFurgonetkaHeaders();
    return fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let response = await doFetch();

  if (response.status === 401) {
    cachedToken = null;
    response = await doFetch();
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload as { message?: string })?.message ||
      (payload as { error_description?: string })?.error_description ||
      (payload as { error?: string })?.error ||
      `Furgonetka request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}
