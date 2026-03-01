/**
 * GET /api/stripe/oauth/callback
 *
 * Handles the Stripe Connect OAuth callback.
 * 1. Verifies the CSRF state token
 * 2. Exchanges the authorization code for access/refresh tokens
 * 3. Fetches the connected account's display info
 * 4. Encrypts tokens with AES-256-GCM
 * 5. Upserts the connection in stripe_connections
 * 6. Redirects to /dashboard/connections
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY     — Your Stripe secret key (sk_live/sk_test)
 *   STRIPE_CLIENT_ID      — Your Stripe Connect app's client_id
 *   NEXTAUTH_URL          — Base URL for redirect_uri
 *   ENCRYPTION_SECRET     — Secret for AES-256-GCM token encryption
 */
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db, stripeConnections, eq, and } from "@metricshub/db";
import { encrypt } from "@/lib/encrypt";

export const dynamic = "force-dynamic";

// ─── Stripe OAuth token exchange ──────────────────────────────────────────────

interface StripeOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  stripe_publishable_key?: string;
  stripe_user_id: string;
  scope: string;
  livemode: boolean;
  error?: string;
  error_description?: string;
}

interface StripeAccountInfo {
  id: string;
  email?: string;
  display_name?: string;
  business_profile?: {
    name?: string;
  };
  settings?: {
    dashboard?: {
      display_name?: string;
    };
  };
}

async function exchangeCodeForTokens(code: string): Promise<StripeOAuthTokenResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/stripe/oauth/callback`;

  const body = new URLSearchParams({
    client_secret: secretKey,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json()) as StripeOAuthTokenResponse;

  if (data.error) {
    throw new Error(`Stripe OAuth error: ${data.error} — ${data.error_description}`);
  }

  return data;
}

async function fetchAccountInfo(stripeAccountId: string, accessToken: string): Promise<StripeAccountInfo> {
  const res = await fetch(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    // Non-fatal — we'll just skip display info
    return { id: stripeAccountId };
  }

  return res.json() as Promise<StripeAccountInfo>;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Must be logged in
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const userId = session.user.id;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const error = searchParams.get("error");

  // Build error redirect helper
  const errorRedirect = (msg: string) => {
    const url = new URL(`${appUrl}/dashboard/connections`);
    url.searchParams.set("error", msg);
    const res = NextResponse.redirect(url.toString());
    res.cookies.delete("stripe_oauth_state");
    return res;
  };

  // Handle Stripe-side errors (e.g. user cancelled)
  if (error) {
    const description = searchParams.get("error_description") ?? error;
    return errorRedirect(description);
  }

  if (!code || !returnedState) {
    return errorRedirect("Missing code or state from Stripe");
  }

  // ── CSRF state verification ────────────────────────────────────────────────
  const storedState = request.cookies.get("stripe_oauth_state")?.value;
  if (!storedState || storedState !== returnedState) {
    return errorRedirect("Invalid state — possible CSRF attack");
  }

  try {
    // ── Exchange code for tokens ───────────────────────────────────────────
    const tokenData = await exchangeCodeForTokens(code);

    // ── Fetch account display info ────────────────────────────────────────
    const accountInfo = await fetchAccountInfo(
      tokenData.stripe_user_id,
      tokenData.access_token
    );

    const displayName =
      accountInfo.settings?.dashboard?.display_name ??
      accountInfo.business_profile?.name ??
      accountInfo.email ??
      null;

    // ── Encrypt tokens ────────────────────────────────────────────────────
    const encryptedAccess = encrypt(tokenData.access_token);

    let refreshEnc = null;
    let refreshIv = null;
    let refreshTag = null;
    if (tokenData.refresh_token) {
      const encryptedRefresh = encrypt(tokenData.refresh_token);
      refreshEnc = encryptedRefresh.enc;
      refreshIv = encryptedRefresh.iv;
      refreshTag = encryptedRefresh.tag;
    }

    // ── Upsert stripe_connections ─────────────────────────────────────────
    // If same account was previously connected by this user → update tokens
    const existing = await db
      .select({ id: stripeConnections.id })
      .from(stripeConnections)
      .where(
        and(
          eq(stripeConnections.userId, userId),
          eq(stripeConnections.stripeAccountId, tokenData.stripe_user_id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(stripeConnections)
        .set({
          accessTokenEnc: encryptedAccess.enc,
          accessTokenIv: encryptedAccess.iv,
          accessTokenTag: encryptedAccess.tag,
          refreshTokenEnc: refreshEnc,
          refreshTokenIv: refreshIv,
          refreshTokenTag: refreshTag,
          displayName,
          email: accountInfo.email ?? null,
          livemode: tokenData.livemode,
          scope: tokenData.scope,
          updatedAt: new Date(),
        })
        .where(eq(stripeConnections.id, existing[0].id));
    } else {
      await db.insert(stripeConnections).values({
        userId,
        stripeAccountId: tokenData.stripe_user_id,
        displayName,
        email: accountInfo.email ?? null,
        livemode: tokenData.livemode,
        accessTokenEnc: encryptedAccess.enc,
        accessTokenIv: encryptedAccess.iv,
        accessTokenTag: encryptedAccess.tag,
        refreshTokenEnc: refreshEnc,
        refreshTokenIv: refreshIv,
        refreshTokenTag: refreshTag,
        scope: tokenData.scope,
      });
    }

    // ── Success: redirect to connections dashboard ────────────────────────
    const successUrl = new URL(`${appUrl}/dashboard/connections`);
    successUrl.searchParams.set("connected", "true");

    const res = NextResponse.redirect(successUrl.toString());
    res.cookies.delete("stripe_oauth_state");
    return res;
  } catch (err) {
    console.error("[stripe/oauth/callback] Error:", err);
    return errorRedirect("Failed to connect Stripe account. Please try again.");
  }
}
