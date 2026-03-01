import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MetricsHub — Know Your SaaS Numbers",
  description:
    "Connect Stripe in 2 minutes. Track MRR, ARR, churn, and growth — all in one clean dashboard.",
};

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="border-b border-[#30363d] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight">MetricsHub</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Live Stripe sync · No backend needed
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-5 tracking-tight leading-tight">
          Know Your{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            SaaS Numbers
          </span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Connect Stripe in 2 minutes. Track MRR, ARR, churn rate, NRR, and growth —
          all in one clean dashboard built for indie hackers.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            Start for free
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 border border-[#30363d] text-gray-300 hover:border-blue-500/40 hover:text-white font-medium rounded-xl text-sm transition-all"
          >
            Live demo
          </Link>
        </div>
        <p className="text-xs text-gray-600 mt-4">No credit card required · Free forever on 1 connection</p>

        {/* Dashboard mockup */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d1117] z-10 pointer-events-none" style={{ top: "60%" }} />
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 shadow-2xl shadow-black/50 max-w-3xl mx-auto">
            {/* Fake header */}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#30363d]">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-2 text-xs text-gray-500">dashboard.metricshub.io</span>
            </div>
            {/* Fake metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "MRR", value: "$12,450", change: "+11.2%", color: "blue" },
                { label: "ARR", value: "$149.4k", change: "+11.2%", color: "blue" },
                { label: "Subscribers", value: "342", change: "+47", color: "blue" },
                { label: "Churn Rate", value: "2.1%", change: "↓ 0.3%", color: "emerald" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-[#0d1117] rounded-lg p-3 border border-[#30363d] border-t-2 border-t-blue-500/60"
                >
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className="text-lg font-bold text-white">{card.value}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">{card.change}</p>
                </div>
              ))}
            </div>
            {/* Fake chart placeholder */}
            <div className="mt-3 bg-[#0d1117] rounded-lg border border-[#30363d] h-24 flex items-end px-3 pb-2 gap-1 overflow-hidden">
              {[40, 52, 48, 61, 58, 65, 72, 69, 78, 85, 82, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: `rgba(59,130,246,${0.2 + (i / 11) * 0.5})`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">
            Everything you need to track SaaS growth
          </h2>
          <p className="text-gray-400">
            Built by indie hackers, for indie hackers.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              ),
              title: "Stripe Connect",
              desc: "One-click OAuth integration. No API keys to manage.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              title: "Real-time Metrics",
              desc: "MRR, ARR, churn rate, NRR — always up to date.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              ),
              title: "Growth Charts",
              desc: "Interactive time series charts with period selectors.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ),
              title: "Cohort Analysis",
              desc: "Retention heatmaps and churn rate trends by cohort.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 hover:border-blue-500/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-600/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Simple pricing</h2>
          <p className="text-gray-400">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {/* Free */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
            <p className="text-sm font-medium text-gray-400 mb-1">Free</p>
            <p className="text-4xl font-extrabold text-white mb-1">$0</p>
            <p className="text-sm text-gray-500 mb-6">forever</p>
            <ul className="space-y-2.5 mb-6">
              {["1 Stripe connection", "Core metrics (MRR, ARR, churn)", "30-day history", "Email support"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="block text-center py-2.5 border border-[#30363d] text-gray-300 hover:border-blue-500/40 hover:text-white rounded-lg text-sm font-medium transition-all"
            >
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-blue-600/5 border-2 border-blue-500/30 rounded-2xl p-6 relative">
            <div className="absolute top-4 right-4 px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
              Popular
            </div>
            <p className="text-sm font-medium text-blue-400 mb-1">Pro</p>
            <p className="text-4xl font-extrabold text-white mb-1">$9</p>
            <p className="text-sm text-gray-500 mb-6">per month</p>
            <ul className="space-y-2.5 mb-6">
              {[
                "3 Stripe connections",
                "Unlimited history",
                "Advanced analytics",
                "Growth & cohort charts",
                "CSV export",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="block text-center py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all"
            >
              Start Pro free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              name: "Alex M.",
              role: "Indie hacker, SaaS founder",
              quote:
                "Finally a metrics tool that doesn't cost $100/mo. MetricsHub gives me exactly what I need.",
            },
            {
              name: "Sarah K.",
              role: "Bootstrapped founder",
              quote:
                "Setup took 3 minutes. Now I check my MRR every morning with coffee. Love it.",
            },
            {
              name: "Tom R.",
              role: "Developer & maker",
              quote:
                "The cohort retention view helped me spot a churn spike I would have missed for weeks.",
            },
          ].map((t) => (
            <div
              key={t.name}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-5"
            >
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-gray-500">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#30363d] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">
              MetricsHub · Built by indie hackers, for indie hackers
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <Link href="/login" className="hover:text-gray-300 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-gray-300 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
