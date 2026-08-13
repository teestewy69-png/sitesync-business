import Link from "next/link";

export default function RealSmallBusinessWebsiteNeeds() {
  return (
    <main className="min-h-screen bg-black text-white">
      <article className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/blog"
          className="mb-4 inline-flex text-xs text-brand-300 hover:underline"
        >
          ← Back to blog
        </Link>

        <header className="space-y-2">
          <p className="text-[11px] text-slate-400">
            Published on {new Date("2024-08-01").toLocaleDateString()}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            What a Real Small Business Website Actually Needs to Have (And Most
            Don’t)
          </h1>
          <p className="text-sm text-slate-300 sm:text-base">
            Most small business websites look “fine” at a glance—but
            they&apos;re missing 3–5 critical elements that cost you leads every
            single week. Use this guide to see if your site is really doing its
            job.
          </p>
        </header>

        <div className="mt-8 space-y-6 text-sm text-slate-200 sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              1. A clear hero section that says who you are and what you do
            </h2>
            <p className="mt-2">
              The first screen of your website (the “hero section”) should
              answer three questions instantly:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Who is this for?</li>
              <li>What do they do?</li>
              <li>What should I do next?</li>
            </ul>
            <p className="mt-2">
              If someone has to scroll or hunt around to figure out what you
              sell, you&apos;re losing them. A strong headline, one or two short
              lines of explanation, and a clear button (call, book, buy, request
              a quote) make all the difference.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              2. A simple, specific offer section
            </h2>
            <p className="mt-2">
              A lot of small business sites list everything they could possibly
              do. That&apos;s overwhelming. Instead, highlight your main offers:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Your core service or package</li>
              <li>Who it’s for</li>
              <li>What&apos;s included</li>
              <li>What happens after someone buys or books</li>
            </ul>
            <p className="mt-2">
              Clear, focused offers help visitors say “yes” faster—and help you
              attract the right kind of customers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              3. Real social proof: reviews, results, and logos
            </h2>
            <p className="mt-2">
              People trust other people more than they trust you. Your website
              should feature:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                Short, specific testimonials with names (and photos if possible)
              </li>
              <li>Logos of businesses you&apos;ve worked with</li>
              <li>Any simple “before/after” results you can share</li>
            </ul>
            <p className="mt-2">
              Even two or three strong pieces of proof can dramatically increase
              how many visitors turn into leads.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              4. A contact or booking flow that doesn’t make people think
            </h2>
            <p className="mt-2">
              If your “Contact” page is just a blank form and an email, you can
              do better. A good contact or booking flow:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Explains what will happen after they submit</li>
              <li>Asks only the questions you really need</li>
              <li>Works great on mobile</li>
            </ul>
            <p className="mt-2">
              When people know what to expect, they&apos;re much more likely to
              reach out.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              5. A basic FAQ that answers objections before they stop you
            </h2>
            <p className="mt-2">
              Your FAQ isn&apos;t just for “extra info”—it&apos;s where you
              handle the questions that stop people from buying:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>“How much does this cost?”</li>
              <li>“How long will it take?”</li>
              <li>“What happens if I&apos;m not happy?”</li>
            </ul>
            <p className="mt-2">
              When you answer these upfront, more visitors feel safe taking the
              next step.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              6. Technical basics handled: mobile, speed, and security
            </h2>
            <p className="mt-2">
              Under the hood, a “real” business website also needs to:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Load quickly, especially on mobile connections</li>
              <li>Be easy to use on phones and tablets</li>
              <li>Use HTTPS (the little lock icon) to keep things secure</li>
            </ul>
            <p className="mt-2">
              These aren&apos;t “nice-to-haves” anymore—Google and your visitors
              both expect them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              How Sitesync Business bakes all of this into your site
            </h2>
            <p className="mt-2">
              When we build your site, these elements aren&apos;t
              add-ons—they&apos;re part of the core package:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>A clear hero and main offer section designed to convert</li>
              <li>Places for your best testimonials and proof</li>
              <li>A simple, guided contact or booking flow</li>
              <li>
                FAQ and key pages optimized for mobile, speed, and clarity
              </li>
            </ul>
            <p className="mt-2">
              You don&apos;t have to memorize this checklist or learn design
              theory. We use it behind the scenes to make sure your website
              actually does what you&apos;re hiring it to do: bring in more of
              the right customers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              Your next step
            </h2>
            <p className="mt-2">
              If your current site is missing several of these pieces—or you
              don&apos;t have a real website at all—your next step is simple:
            </p>
            <p className="mt-2">
              <Link
                href="/"
                className="font-semibold text-brand-300 hover:underline"
              >
                Click here to see how Sitesync Business can build it for you.
              </Link>{" "}
              We&apos;ll handle the structure, design, SEO basics, and
              monetization setup so you can focus on running your business.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
