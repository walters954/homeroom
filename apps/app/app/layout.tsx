import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homeroom",
  description:
    "Open-source, agent-first course and community platform. The LMS is where the teaching agent keeps its notes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
