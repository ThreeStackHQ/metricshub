import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MetricsHub — SaaS Metrics for Indie Hackers",
  description:
    "Simple, beautiful SaaS metrics dashboard. Connect your Stripe account and see MRR, ARR, churn, and more. Baremetrics, but $9/mo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
