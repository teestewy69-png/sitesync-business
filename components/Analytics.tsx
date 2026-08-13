"use client";

import Script from "next/script";

type AnalyticsProps = {
  measurementId: string;
};

export default function Analytics({ measurementId }: AnalyticsProps) {
  if (!measurementId) return null;

  return (
    <>
      {/* This matches the first script tag from Google */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      {/* This matches the second script tag from Google */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
