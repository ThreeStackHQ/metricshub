import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MetricsHub",
  description: "SaaS metrics for indie hackers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
