import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db, stripeConnections, eq } from "@metricshub/db";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connections — MetricsHub",
};

export const dynamic = "force-dynamic";

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "live" | "test" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        status === "live"
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
          : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
      {status === "live" ? "Live" : "Test"}
    </span>
  );
}

// ─── Connection Card ──────────────────────────────────────────────────────────

interface ConnectionCardProps {
  id: string;
  displayName: string | null;
  email: string | null;
  stripeAccountId: string;
  livemode: boolean;
  connectedAt: Date;
}

function ConnectionCard({
  id,
  displayName,
  email,
  stripeAccountId,
  livemode,
  connectedAt,
}: ConnectionCardProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(connectedAt);

  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5 hover:border-blue-500/40 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Stripe logo placeholder */}
          <div className="w-10 h-10 bg-[#635BFF]/15 border border-[#635BFF]/25 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[#635BFF]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {displayName ?? "Stripe Account"}
            </p>
            <p className="text-xs text-gray-400 truncate">{email ?? stripeAccountId}</p>
          </div>
        </div>
        <StatusBadge status={livemode ? "live" : "test"} />
      </div>

      <div className="mt-4 pt-4 border-t border-[#30363d] flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Connected {formattedDate}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard?connection=${id}`}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            View metrics →
          </Link>
          <form action={`/api/connections/${id}/disconnect`} method="POST">
            <button
              type="submit"
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                if (confirm("Disconnect this Stripe account? Metrics data will be removed.")) {
                  (e.currentTarget.closest("form") as HTMLFormElement).submit();
                }
              }}
            >
              Disconnect
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const connections = await db
    .select()
    .from(stripeConnections)
    .where(eq(stripeConnections.userId, session.user.id));

  const stripeOAuthUrl = `/api/stripe/connect`;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Stripe Connections</h1>
          <p className="text-gray-400 text-sm">
            Connect your Stripe accounts to track MRR, ARR, churn, and more.
          </p>
        </div>
        <Link
          href={stripeOAuthUrl}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Connection
        </Link>
      </div>

      {connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              id={conn.id}
              displayName={conn.displayName}
              email={conn.email}
              stripeAccountId={conn.stripeAccountId}
              livemode={conn.livemode}
              connectedAt={conn.createdAt}
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="bg-[#1c2128] border border-dashed border-[#30363d] rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#635BFF]/15 border border-[#635BFF]/25 mb-5">
            <svg className="w-8 h-8 text-[#635BFF]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No Stripe accounts connected</h2>
          <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
            Connect your first Stripe account to start seeing your real-time SaaS metrics.
          </p>
          <Link
            href={stripeOAuthUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Connect Stripe Account
          </Link>

          {/* Features reminder */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-left max-w-lg mx-auto">
            {[
              { label: "MRR & ARR", desc: "Track monthly & annual revenue" },
              { label: "Churn Rate", desc: "Monitor subscription cancellations" },
              { label: "NRR", desc: "Net revenue retention over time" },
            ].map((f) => (
              <div key={f.label} className="bg-[#0d1117] rounded-lg p-3 border border-[#30363d]">
                <p className="text-xs font-semibold text-blue-400 mb-1">{f.label}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
