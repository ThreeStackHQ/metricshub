import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — MetricsHub",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-gray-400 text-sm">Manage your account and preferences.</p>
      </div>

      {/* Profile section */}
      <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
            <div className="px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-gray-300">
              {session.user?.name ?? "—"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <div className="px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-gray-300">
              {session.user?.email ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Coming soon */}
      <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">Notifications & Billing</h2>
        <p className="text-sm text-gray-500">Coming in a future sprint — email alerts, plan management, and more.</p>
      </div>
    </div>
  );
}
