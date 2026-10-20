import type { Metadata } from "next";
import content from "@/content.json";
import EmailCapture from "@/components/EmailCapture";
import SitePage from "@/components/SitePage";

export const metadata: Metadata = {
  title: "Contact | Sitesinc",
  description: content.contact.subtitle,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | Sitesinc",
    description: content.contact.subtitle,
    url: "/contact",
  },
};

export default function ContactPage() {
  const { contact, footer } = content;

  return (
    <SitePage>
      <section className="mx-auto max-w-3xl px-6 pt-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Contact</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{contact.title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-300">{contact.subtitle}</p>
        <p className="mt-4 text-base text-slate-400">
          Email{" "}
          <a href={`mailto:${footer.email}`} className="font-medium text-brand-300 hover:underline">
            {footer.email}
          </a>
        </p>
      </section>
      <EmailCapture variant="contact" />
    </SitePage>
  );
}
