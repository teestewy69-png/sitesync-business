import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import content from "@/content.json";
import Analytics from "@/components/Analytics";
import AnnouncementTicker from "@/components/AnnouncementTicker";
import HideOnClientSite from "@/components/HideOnClientSite";
import StagingBanner from "@/components/StagingBanner";
import { CartProvider } from "@/components/shop/CartProvider";
import {
  isStagingEnv,
  publicAnalyticsHosts,
  publicAnalyticsMeasurementId,
} from "@/lib/site-env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const GA_MEASUREMENT_ID = publicAnalyticsMeasurementId();
const GA_HOSTS = publicAnalyticsHosts();
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
  ...(isStagingEnv()
    ? { robots: { index: false, follow: false, nocache: true } }
    : {}),
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
          <HideOnClientSite>
            <AnnouncementTicker />
          </HideOnClientSite>
          {children}
          <StagingBanner />
          <Analytics measurementId={GA_MEASUREMENT_ID} allowedHosts={GA_HOSTS} />
        </CartProvider>
      </body>
    </html>
  );
}
