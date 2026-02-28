import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400 mb-8">
          Welcome back, {session.user?.name ?? session.user?.email}
        </p>

        {/* Placeholder — Sprint 1.5 will build the full dashboard */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Connect your Stripe account</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Connect your Stripe account to start tracking your MRR, ARR, churn rate, and more.
            Takes less than 2 minutes.
          </p>
          <button className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition">
            Connect Stripe →
          </button>
        </div>
      </div>
    </main>
  );
}
