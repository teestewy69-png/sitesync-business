import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | Kurtis",
  description: "Studio contact page for the internal Kurtis artist preview. noindex.",
  robots: { index: false, follow: false },
};

export default function KurtisContact() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-light">Contact the studio</h1>
      <p className="max-w-2xl text-zinc-400">
        Inquiries for the preview: studio@example.invalid. This is not a live inbox and is not submitted to Google.
      </p>
    </article>
  );
}
