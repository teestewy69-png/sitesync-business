import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import content from "@/content.json";
import Analytics from "@/components/Analytics";
import AnnouncementTicker from "@/components/AnnouncementTicker";
import { CartProvider } from "@/components/shop/CartProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const { seo } = content;

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  metadataBase: new URL(seo.url),
  alternates: {
    canonical: seo.url,
  },
  openGraph: {
    title: seo.og.title,
    description: seo.og.description,
    url: seo.url,
    siteName: seo.siteName,
    type: "website",
    locale: seo.locale,
    images: [{ url: seo.image }],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.twitter.title,
    description: seo.twitter.description,
    images: [seo.image],
  },
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-slate-200">
        <CartProvider>
          <AnnouncementTicker />
          {children}
          <Analytics measurementId={GA_MEASUREMENT_ID} />
        </CartProvider>
      </body>
    </html>
  );
}
