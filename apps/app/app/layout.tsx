import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { getBranding } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: {
      default: branding.schoolName,
      template: `%s — ${branding.schoolName}`,
    },
    description: branding.tagline,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
