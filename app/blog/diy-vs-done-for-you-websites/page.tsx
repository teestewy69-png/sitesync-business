import Link from "next/link";

export default function DiyVsDoneForYouWebsites() {
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
          <p className="text-xs text-slate-400">
            Published on {new Date("2024-08-05").toLocaleDateString()}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            DIY Website Builders vs. Done-For-You: What Actually Costs You More
          </h1>
          <p className="text-base text-slate-300">
            DIY website builders promise a “free” or cheap site in a weekend. A
            done-for-you build looks more expensive upfront. But when
            you&apos;re running a real business, the cheapest option on day one
            isn&apos;t always the cheapest option long-term. Let&apos;s break it
            down.
          </p>
        </header>

        <div className="mt-8 space-y-6 text-base text-slate-200">
          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              The promise of DIY builders (and what they don&apos;t say)
            </h2>
            <p className="mt-2">
              DIY website builders like Wix, Squarespace, or generic templates
              are attractive because they feel:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Cheap (or “free” with a trial)</li>
              <li>Fast (“Build your site in a weekend!”)</li>
              <li>Simple (“No coding required”)</li>
            </ul>
            <p className="mt-2">
              If you&apos;re just getting started, that can sound perfect. The
              problem is: if your business is real—clients, bookings,
              revenue—you&apos;re not just building &quot;a site.&quot;
              You&apos;re building a sales asset. And that&apos;s where the
              hidden costs add up.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              The hidden costs of DIY for small business owners
            </h2>
            <p className="mt-2">
              DIY isn&apos;t “free” when you factor in the three things you
              can&apos;t get back: time, momentum, and trust.
            </p>

            <h3 className="mt-3 text-sm font-semibold text-slate-50 sm:text-base">
              1. Time you could be spending on your actual business
            </h3>
            <p className="mt-1">
              Building a website from a template takes more than a few clicks.
              You still have to:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Decide the structure and layout</li>
              <li>Write all the copy yourself</li>
              <li>Find, crop, and upload images</li>
              <li>Set up forms, emails, and payments</li>
            </ul>
            <p className="mt-2">
              If you&apos;re not a designer or marketer, this often turns into
              weeks of trial and error. Meanwhile, your real work—serving
              customers, closing deals—gets pushed aside.
            </p>

            <h3 className="mt-3 text-sm font-semibold text-slate-50 sm:text-base">
              2. Lost leads from a site that doesn&apos;t convert
            </h3>
            <p className="mt-1">
              A site can be “pretty” and still perform poorly. Common DIY
              issues:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>No clear offer or call to action</li>
              <li>Confusing navigation and too many options</li>
              <li>Slow load times, especially on mobile</li>
              <li>No real tracking of what&apos;s working</li>
            </ul>
            <p className="mt-2">
              Every time someone visits your site and leaves without calling,
              booking, or buying, that&apos;s potential money left on the table.
              Over months and years, that&apos;s far more expensive than a
              one-time professional build.
            </p>

            <h3 className="mt-3 text-sm font-semibold text-slate-50 sm:text-base">
              3. Tech headaches you didn&apos;t sign up for
            </h3>
            <p className="mt-1">
              Even simple DIY tools still expect you to figure out:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Domains and DNS records</li>
              <li>SSL certificates (the little lock icon)</li>
              <li>Connecting emails and forms</li>
              <li>Setting up analytics and basic SEO</li>
            </ul>
            <p className="mt-2">
              None of this is impossible. But you didn&apos;t start your
              business to become a web technician.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              When DIY websites make sense
            </h2>
            <p className="mt-2">
              To be fair, DIY is not always wrong. It can make sense when:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>You&apos;re testing an idea with no customers yet</li>
              <li>You have more time than money</li>
              <li>You&apos;re comfortable with design and tech basics</li>
              <li>
                The website is a simple “online business card,” not a sales
                engine
              </li>
            </ul>
            <p className="mt-2">
              If that&apos;s where you are, a DIY builder might be fine for a
              while. Just know it&apos;s a starting point, not an endgame.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              When a done-for-you build makes more sense
            </h2>
            <p className="mt-2">
              A done-for-you site like what we build at Sitesync Business makes
              more sense when:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>You already have customers and real demand</li>
              <li>
                You&apos;re losing leads because your site is outdated, broken,
                or non-existent
              </li>
              <li>You value your time more than saving a few dollars</li>
              <li>You want a site built to convert, not just exist</li>
            </ul>
            <p className="mt-2">
              At that point, your website is part of your sales system. It
              deserves professional treatment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              A fair side-by-side comparison
            </h2>
            <p className="mt-2">
              Here&apos;s a simple comparison to make the trade-offs clearer:
            </p>
            <div className="mt-3 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-base text-slate-200 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-slate-50">DIY builder</p>
                <ul className="mt-2 list-disc pl-5">
                  <li>Low monthly fee, but ongoing forever</li>
                  <li>You do all the design, copy, and setup</li>
                  <li>Limited control over performance and SEO</li>
                  <li>Support is generic, not about your business</li>
                  <li>Easy to start, hard to perfect</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-50">
                  Sitesync Business (done-for-you)
                </p>
                <ul className="mt-2 list-disc pl-5">
                  <li>One-time fee, no required subscription</li>
                  <li>
                    Design, structure, and copy framework done for you
                  </li>
                  <li>
                    Built on modern tech (Next.js, Tailwind, Netlify)
                  </li>
                  <li>
                    SEO basics, funnels, and monetization planned in
                  </li>
                  <li>
                    Launched in 5–7 business days once we have your info
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              The &quot;expensive&quot; option that&apos;s actually cheaper
              long-term
            </h2>
            <p className="mt-2">
              A $1,499 professional build can feel expensive next to a $20/month
              DIY tool. But if a proper site helps you:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Book even one or two extra clients a month</li>
              <li>Close bigger, better-fit projects</li>
              <li>Look like a serious, trustworthy business</li>
            </ul>
            <p className="mt-2">
              Then over a year or two, the done-for-you option is often the
              cheaper decision. The real cost isn&apos;t what you pay—it&apos;s
              what you miss out on.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              How Sitesync Business fits into this picture
            </h2>
            <p className="mt-2">
              Sitesync Business is for small and local businesses who:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                Are done messing around with half-finished DIY sites
              </li>
              <li>
                Want a site that actually supports sales, bookings, or leads
              </li>
              <li>Prefer to pay once, own the code, and move on</li>
            </ul>
            <p className="mt-2">
              We build your site with the same stack we use for our own: Next.js
              + Tailwind, hosted on Netlify, with Stripe, GA4, and on-page SEO
              basics ready to go.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
              How to decide what&apos;s right for you
            </h2>
            <p className="mt-2">Ask yourself:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>Do I already have customers and a real offer?</li>
              <li>
                Is my current site costing me leads because it&apos;s outdated
                or confusing?
              </li>
              <li>
                Is my time better spent serving clients than fighting with a
                page builder?
              </li>
            </ul>
            <p className="mt-2">
              If you&apos;re just starting and money is extremely tight, DIY
              might be enough for now. But if you&apos;re ready for a website
              that looks and behaves like a real business asset, done-for-you is
              almost always the smarter play.
            </p>
            <p className="mt-2">
              <Link
                href="/"
                className="font-semibold text-brand-300 hover:underline"
              >
                Click here to see how Sitesync Business can build it for you.
              </Link>{" "}
              We&apos;ll handle the design, tech, SEO basics, and funnels so you
              can get back to running your business.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
