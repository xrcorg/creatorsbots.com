import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "CreatorsBots · Creator Portal",
    description: "A private creator operations portal for Telegram conversations, content, bookings, and sales.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "CreatorsBots · Creator Portal",
      description: "Manage fan chats, content, bookings, sales, and creator takeover in one place.",
      images: [{ url: image, width: 1200, height: 630, alt: "CreatorsBots creator portal" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CreatorsBots · Creator Portal",
      description: "Private creator operations for Telegram conversations, content, bookings, and sales.",
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
