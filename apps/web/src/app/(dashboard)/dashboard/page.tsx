import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — MetricsHub",
};

export const dynamic = "force-dynamic";

// ─── Metric Card ────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  changeLabel: string;
  icon: React.ReactNode;
}

function MetricCard({ label, value, change, changeType, changeLabel, icon }: MetricCardProps) {
  const changeColor =
    changeType === "positive"
      ? "text-emerald-400"
      : changeType === "negative"
        ? "text-red-400"
        : "text-gray-400";

  const changeArrow =
    changeType === "positive" ? "↑" : changeType === "negative" ? "↓" : "→";

  return (
    <div className="bg-[#1c2128] border border-[#30363d] border-t-2 border-t-blue-500 rounded-xl p-5 hover:border-blue-500/40 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-gray-400">{label}</span>
        <span className="text-gray-600">{icon}</span>
      </div>
      <div className="mb-2">
        <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
      </div>
      <div className={`flex items-center gap-1 text-sm ${changeColor}`}>
        <span>{changeArrow}</span>
        <span className="font-medium">{change}</span>
        <span className="text-gray-500 font-normal ml-1">{changeLabel}</span>
      </div>
    </div>
  );
}

// ─── Stat Row (smaller secondary metrics) ────────────────────────────────────

function StatRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#30363d] last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-white">{value}</span>
        <span className="text-xs text-gray-500 ml-2">{sub}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // TODO: Replace with real data from Sprint 1.11 Metrics API
  const hasConnections = false;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          Your SaaS Metrics
        </h1>
        <p className="text-gray-400 text-sm">
          {hasConnections
            ? "Real-time data from your connected Stripe accounts."
            : "Connect your Stripe account to start tracking MRR, churn, and more."}
        </p>
      </div>

      {hasConnections ? (
        <>
          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Monthly Recurring Revenue"
              value="$12,400"
              change="5.2%"
              changeType="positive"
              changeLabel="vs last month"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <MetricCard
              label="Annual Recurring Revenue"
              value="$148,800"
              change="4.8%"
              changeType="positive"
              changeLabel="annualised"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
            <MetricCard
              label="Active Subscribers"
              value="342"
              change="+12"
              changeType="positive"
              changeLabel="this month"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <MetricCard
              label="Churn Rate"
              value="2.1%"
              change="0.3%"
              changeType="positive"
              changeLabel="improvement"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Growth Metrics</h3>
              <StatRow label="New Subscribers (MTD)" value="47" sub="this month" />
              <StatRow label="Churned Subscribers" value="8" sub="-2.3%" />
              <StatRow label="Net Revenue Retention" value="108%" sub="NRR" />
              <StatRow label="Average Revenue Per User" value="$36.26" sub="ARPU" />
            </div>
            <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Revenue Breakdown</h3>
              <StatRow label="New MRR" value="$1,702" sub="+$1,702" />
              <StatRow label="Expansion MRR" value="$340" sub="upgrades" />
              <StatRow label="Churned MRR" value="−$290" sub="cancels" />
              <StatRow label="Net New MRR" value="$1,752" sub="net" />
            </div>
          </div>
        </>
      ) : (
        /* Empty state — no Stripe connection yet */
        <div className="space-y-4">
          {/* Blurred placeholder cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none pointer-events-none opacity-40 blur-sm">
            {["MRR", "ARR", "Subscribers", "Churn Rate"].map((label) => (
              <div key={label} className="bg-[#1c2128] border border-[#30363d] border-t-2 border-t-blue-500 rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-3">{label}</p>
                <p className="text-2xl font-bold text-white">—</p>
                <p className="text-sm text-gray-500 mt-1">— vs last month</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-[#1c2128] border border-[#30363d] rounded-2xl p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-500/25 mb-5">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connect your Stripe account</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              Link your Stripe account to start tracking MRR, ARR, churn rate, NRR, and more.
              Setup takes less than 2 minutes.
            </p>
            <Link
              href="/connections"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Connect Stripe
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
