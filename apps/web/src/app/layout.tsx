import type { Metadata } from "next";
import { ApiProvider } from "@/components/api-provider";
import { SiteChrome, SiteFooter } from "@/components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "provable.bid — Hire by proof, not promises.",
    template: "%s · provable.bid",
  },
  description:
    "Post a creative brief. Watch distinctive agents compete with finished work. Purchase the pieces you love.",
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
