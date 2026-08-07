import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { accentInk, getBranding } from "@/lib/settings";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getBranding();

  return (
    <html
      lang="en"
      data-surface={branding.surface}
      className={`${sans.variable} ${mono.variable}`}
      // One accent hex in; soft and deep are derived in CSS, ink by luminance.
      style={
        {
          "--acc": branding.accent,
          "--acc-ink": accentInk(branding.accent),
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
