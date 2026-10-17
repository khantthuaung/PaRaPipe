import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { themeInitScript } from "../lib/theme";



export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "PaRaPipe — Lecture notes that stick";
  const description = "Record lectures, transcribe locally with Whisper Small, and create source-linked study notes with Qwen 4B.";
  return {
    title,
    description,
    icons: { icon: "/parapipe-logo.png", shortcut: "/parapipe-logo.png" },
    openGraph: { title, description, images: [{ url: `${origin}/parapipe-logo.png`, width: 1536, height: 1024 }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/parapipe-logo.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
