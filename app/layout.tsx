import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "Tiffani Madison · Telegram Chat Pilot",
    description: "A private test experience for Tiffani Madison's Telegram fan assistant.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Tiffani Madison · Private Telegram Chat Pilot",
      description: "Manage fan chats, content, bookings, sales, and creator takeover in one place.",
      images: [{ url: image, width: 1200, height: 630, alt: "Tiffani Madison private Telegram chat pilot" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Tiffani Madison · Private Telegram Chat Pilot",
      description: "A private test of Tiffani's Telegram fan assistant.",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
