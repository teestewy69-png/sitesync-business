import type { Metadata } from "next";
import SitePage from "@/components/SitePage";

export const metadata: Metadata = { title: "Your Kit | Sitesinc", robots: { index: false, follow: false } };

export default function KitThanksPage() {
  return (
    <SitePage>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Thanks! Your kit is ready.</h1>
        <a href="/downloads/Sitesinc-Website-Google-Kit.pdf" download className="mt-6 inline-flex rounded-xl bg-brand-500 px-5 py-3 font-semibold text-black hover:bg-brand-400">Download the PDF</a>
        <h2 className="mt-12 text-2xl font-semibold">Rather have it done for you?</h2>
        <p className="mt-3 text-slate-300">The checklist works. It also takes time. Sitesinc builds a real, working website you own for a one-time $1,995, with no monthly subscription. Your $27 kit purchase counts toward it; mention your purchase email when you book.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="https://buy.stripe.com/4gM7sL7z74T7aX38o2a3u05" className="rounded-xl bg-brand-500 px-5 py-3 font-semibold text-black hover:bg-brand-400">Start with a deposit</a>
          <a href="https://buy.stripe.com/14AcN56v385j7KR0VAa3u07" className="rounded-xl border border-brand-400 px-5 py-3 font-semibold text-brand-300">Pay for the full build</a>
        </div>
        <p className="mt-8 text-sm text-slate-400">Questions? <a href="mailto:save@sitesinc.co" className="text-brand-300 hover:underline">save@sitesinc.co</a> or call/text <a href="tel:+19093231575" className="text-brand-300 hover:underline">(909) 323-1575</a></p>
      </section>
    </SitePage>
  );
}
