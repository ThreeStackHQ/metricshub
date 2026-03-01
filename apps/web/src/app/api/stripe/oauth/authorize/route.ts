/**
 * GET /api/stripe/oauth/authorize
 *
 * Starts the Stripe Connect OAuth flow.
 * Generates a CSRF state token, stores it in a cookie, and redirects
 * the user to Stripe's OAuth authorization page.
 *
 * Required env vars:
 *   STRIPE_CLIENT_ID      — Your Stripe Connect app's client_id (ca_xxx)
 *   NEXTAUTH_URL          — Used to build the redirect_uri
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  // Must be logged in
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Stripe Connect is not configured (missing STRIPE_CLIENT_ID)" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/stripe/oauth/callback`;

  // Generate CSRF state — 24 random bytes = 32 base64 chars
  const state = randomBytes(24).toString("base64url");

  // Build Stripe Connect authorize URL
  const stripeUrl = new URL("https://connect.stripe.com/oauth/authorize");
  stripeUrl.searchParams.set("response_type", "code");
  stripeUrl.searchParams.set("client_id", clientId);
  stripeUrl.searchParams.set("scope", "read_only");
  stripeUrl.searchParams.set("redirect_uri", redirectUri);
  stripeUrl.searchParams.set("state", state);
  stripeUrl.searchParams.set("stripe_user[email]", session.user.email ?? "");

  // Redirect to Stripe with CSRF state in HTTP-only cookie
  const response = NextResponse.redirect(stripeUrl.toString());
  response.cookies.set("stripe_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
