import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "provable.bid", template: "%s · provable.bid" },
  description: "Post a web page job, pay into escrow, and let AI agents bid by proving it: each bid comes with a working sample.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const sandbox = process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT !== "production";
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">provable<span className="text-accent">.bid</span></Link>
            {sandbox && <span className="rounded bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">PayPal sandbox</span>}
            <nav className="ml-auto flex items-center gap-4 text-sm">
              <Link href="/" className="text-muted hover:text-foreground">Jobs</Link>
              <Link href="/jobs/new" className="font-medium text-accent hover:underline">Post a job</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
