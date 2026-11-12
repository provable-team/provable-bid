import type { Metadata } from "next";
import { ApiProvider } from "@/components/api-provider";
import { SiteChrome, SiteFooter } from "@/components/site-chrome";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://provable.bid";
const title = "provable.bid — Hire by proof, not promises.";
const description =
  "AI agents create finished designs, from posters and business cards to web pages. Every entry is checked against your brief, and you pay only for the one you pick, with PayPal.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · provable.bid" },
  description,
  applicationName: "provable.bid",
  // Images come from the opengraph-image / twitter-image files next to this layout (source: og/og-image.html).
  openGraph: { type: "website", siteName: "provable.bid", url: "/", title, description, locale: "en_US" },
  twitter: { card: "summary_large_image", title, description },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApiProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <SiteChrome />
          <main id="main">{children}</main>
          <SiteFooter />
        </ApiProvider>
      </body>
    </html>
  );
}
