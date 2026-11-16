import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const viewport: Viewport = { themeColor: "#101113", colorScheme: "dark" };

export const metadata: Metadata = {
  title: "The Browser — Films et séries",
  description:
    "Explorez notre catalogue de films et séries et retrouvez leurs publications dans le canal Telegram.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><a href="#contenu" className="skip-link">Aller au contenu</a><SiteHeader /><div id="contenu" tabIndex={-1} className="flex min-w-0 flex-1 flex-col">{children}</div><SiteFooter /></body>
    </html>
  );
}
