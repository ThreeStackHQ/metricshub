/**
 * MetricsHub Stripe API Client
 *
 * Wraps Stripe REST API with:
 *   - AES-256-GCM token decryption
 *   - Automatic token refresh (when refresh token is present)
 *   - Cursor-based pagination (auto-paginates list endpoints)
 *   - Retry logic with exponential backoff (429 / 5xx)
 *   - Read-only operations (subscriptions, customers, invoices, plans)
 *
 * Usage:
 *   const client = await createStripeClient(connection);
 *   const subscriptions = await client.listAllSubscriptions();
 */
import { db, stripeConnections, eq } from "@metricshub/db";
import type { StripeConnection } from "@metricshub/db";
import { decrypt, encrypt } from "./encrypt";

// ─── Stripe Types (minimal, what MetricsHub needs) ──────────────────────────

export interface StripeSubscription {
  id: string;
  customer: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";
  plan: {
    id: string;
    amount: number;       // in cents
    currency: string;
    interval: "day" | "week" | "month" | "year";
    interval_count: number;
    nickname: string | null;
    product: string;
  };
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        unit_amount: number | null;
        currency: string;
        recurring: {
          interval: "day" | "week" | "month" | "year";
          interval_count: number;
        } | null;
        product: string;
      };
      quantity: number;
    }>;
  };
  current_period_start: number;
  current_period_end: number;
  trial_start: number | null;
  trial_end: number | null;
  canceled_at: number | null;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
  created: number;
}

export interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  subscriptions?: {
    data: StripeSubscription[];
  };
}

export interface StripeInvoice {
  id: string;
  customer: string;
  subscription: string | null;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  paid_at: number | null;
  period_start: number;
  period_end: number;
}

interface StripeListResponse<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  url: string;
}

interface StripeOAuthRefreshResponse {
  access_token: string;
  token_type: string;
  stripe_user_id: string;
  error?: string;
  error_description?: string;
}

// ─── Retry config ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── StripeClient class ───────────────────────────────────────────────────────

export class StripeClient {
  private readonly baseUrl = "https://api.stripe.com/v1";

  constructor(
    private accessToken: string,
    private readonly connection: StripeConnection
  ) {}

  // ── Core fetch with retry ────────────────────────────────────────────────

  private async fetch<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Stripe-Version": "2024-06-20",
          },
        });

        // Rate limit — wait and retry
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          await sleep(waitMs);
          continue;
        }

        // Token expired (401) — try refresh
        if (res.status === 401 && attempt === 0) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry with new token
            continue;
          }
        }

        // Server errors — exponential backoff
        if (res.status >= 500) {
          lastError = new Error(`Stripe server error: ${res.status}`);
          await sleep(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt));
          continue;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(
            body.error?.message ?? `Stripe API error: ${res.status}`
          );
        }

        return res.json() as Promise<T>;
      } catch (err) {
        if (err instanceof Error) {
          lastError = err;
          // Don't retry client errors
          if (!(err.message.includes("429") || err.message.includes("500"))) {
            throw err;
          }
        }
        await sleep(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }

    throw lastError ?? new Error("Stripe API request failed after retries");
  }

  // ── Token refresh ────────────────────────────────────────────────────────

  private async refreshAccessToken(): Promise<boolean> {
    const { refreshTokenEnc, refreshTokenIv, refreshTokenTag } = this.connection;

    if (!refreshTokenEnc || !refreshTokenIv || !refreshTokenTag) {
      return false; // No refresh token stored
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return false;

    try {
      const refreshToken = decrypt({
        enc: refreshTokenEnc,
        iv: refreshTokenIv,
        tag: refreshTokenTag,
      });

      const body = new URLSearchParams({
        client_secret: secretKey,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });

      const res = await fetch("https://connect.stripe.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const data = (await res.json()) as StripeOAuthRefreshResponse;

      if (data.error || !data.access_token) {
        return false;
      }

      // Update in-memory token
      this.accessToken = data.access_token;

      // Persist new encrypted token to DB
      const encryptedNew = encrypt(data.access_token);
      await db
        .update(stripeConnections)
        .set({
          accessTokenEnc: encryptedNew.enc,
          accessTokenIv: encryptedNew.iv,
          accessTokenTag: encryptedNew.tag,
          updatedAt: new Date(),
        })
        .where(eq(stripeConnections.id, this.connection.id));

      return true;
    } catch {
      return false;
    }
  }

  // ── Auto-paginating list helper ──────────────────────────────────────────

  private async listAll<T>(
    path: string,
    params: Record<string, string | number | boolean> = {},
    limit = 100
  ): Promise<T[]> {
    const results: T[] = [];
    let startingAfter: string | undefined;

    // Safety: max 100 pages (10,000 items at limit=100)
    for (let page = 0; page < 100; page++) {
      const pageParams: Record<string, string | number | boolean> = {
        ...params,
        limit,
      };
      if (startingAfter) {
        pageParams.starting_after = startingAfter;
      }

      const response = await this.fetch<StripeListResponse<T & { id: string }>>(
        path,
        pageParams
      );

      results.push(...response.data);

      if (!response.has_more || response.data.length === 0) {
        break;
      }

      startingAfter = response.data[response.data.length - 1].id;
    }

    return results;
  }

  // ── Public API methods ────────────────────────────────────────────────────

  /**
   * Fetch all active subscriptions (auto-paginates).
   * Pass `status="all"` to include canceled/trialing.
   */
  async listAllSubscriptions(
    status: string = "active"
  ): Promise<StripeSubscription[]> {
    return this.listAll<StripeSubscription>(
      "/subscriptions",
      status !== "all" ? { status } : {}
    );
  }

  /**
   * Fetch all customers (auto-paginates).
   */
  async listAllCustomers(): Promise<StripeCustomer[]> {
    return this.listAll<StripeCustomer>("/customers");
  }

  /**
   * Fetch all paid invoices in a time range (auto-paginates).
   */
  async listPaidInvoices(options?: {
    createdGte?: number;
    createdLte?: number;
  }): Promise<StripeInvoice[]> {
    const params: Record<string, string | number | boolean> = {
      status: "paid",
    };
    if (options?.createdGte) params["created[gte]"] = options.createdGte;
    if (options?.createdLte) params["created[lte]"] = options.createdLte;

    return this.listAll<StripeInvoice>("/invoices", params);
  }

  /**
   * Calculate MRR from a list of active subscriptions.
   * Normalizes all intervals to monthly, returns value in cents.
   */
  static calculateMrrCents(subscriptions: StripeSubscription[]): number {
    let totalMrrCents = 0;

    for (const sub of subscriptions) {
      if (sub.status !== "active" && sub.status !== "trialing") continue;

      for (const item of sub.items.data) {
        const price = item.price;
        if (!price.unit_amount || !price.recurring) continue;

        const amountCents = price.unit_amount * item.quantity;
        const { interval, interval_count } = price.recurring;

        // Normalize to monthly
        let monthlyAmount = amountCents;
        switch (interval) {
          case "day":
            monthlyAmount = Math.round((amountCents * 365) / 12 / interval_count);
            break;
          case "week":
            monthlyAmount = Math.round((amountCents * 52) / 12 / interval_count);
            break;
          case "month":
            monthlyAmount = Math.round(amountCents / interval_count);
            break;
          case "year":
            monthlyAmount = Math.round(amountCents / (12 * interval_count));
            break;
        }

        totalMrrCents += monthlyAmount;
      }
    }

    return totalMrrCents;
  }
}

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Create a StripeClient from a database stripe_connections record.
 * Decrypts the stored access token automatically.
 *
 * @throws Error if ENCRYPTION_KEY is not set or decryption fails
 */
export async function createStripeClient(
  connection: StripeConnection
): Promise<StripeClient> {
  const accessToken = decrypt({
    enc: connection.accessTokenEnc,
    iv: connection.accessTokenIv,
    tag: connection.accessTokenTag,
  });

  return new StripeClient(accessToken, connection);
}
