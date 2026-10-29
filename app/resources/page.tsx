import type { Metadata } from "next";
import SitePage from "@/components/SitePage";

export const metadata: Metadata = {
  title: "Small Business Tools & Resources | Sitesinc",
  description: "Tools small businesses commonly use for domains, hosting, business email, scheduling and invoicing.",
  alternates: { canonical: "/resources" },
};

const cats = [
  { name: "Domains", note: "Register your domain in an account you own." },
  { name: "Hosting", note: "Where your website files live." },
  { name: "Business email", note: "Email at your own domain." },
  { name: "Scheduling", note: "Let customers book time with you." },
  { name: "Invoicing & accounting", note: "Send invoices and track payments." },
  { name: "Field-service software", note: "Quotes, jobs and scheduling for trades." },
];

export default function ResourcesPage() {
  return (
    <SitePage>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Small Business Tools &amp; Resources</h1>
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"><strong>Disclosure:</strong> Some links on this page may be affiliate links. If you sign up through them, Sitesinc may earn a commission at no extra cost to you. We only list tools we think are useful.</p>
        <div className="mt-8 space-y-4">
          {cats.map((c) => (
            <div key={c.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <p className="mt-1 text-slate-300">{c.note}</p>
              <p className="mt-1 text-xs text-slate-500">Recommendations coming soon.</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-slate-400">Prefer to do it yourself? Get the <a href="/website-kit" className="text-brand-300 hover:underline">Website &amp; Google Visibility Kit</a>.</p>
      </section>
    </SitePage>
  );
}
