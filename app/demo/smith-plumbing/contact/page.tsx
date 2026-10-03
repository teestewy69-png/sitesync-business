import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | Smith Plumbing & Heating",
  description: "Contact page for the internal Smith Plumbing SEO demo. noindex.",
  robots: { index: false, follow: false },
};

export default function SmithPlumbingContact() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">Contact Smith Plumbing</h1>
      <p className="text-zinc-300">
        Phone (555) 123-4567. This contact page exists so SEO Intelligence can inventory a local-service contact
        route. It is noindex.
      </p>
    </article>
  );
}
