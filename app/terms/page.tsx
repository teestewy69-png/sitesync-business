import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link
          href="/"
          className="mb-4 inline-flex text-xs text-brand-300 hover:underline"
        >
          ← Back to home
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-base text-slate-400">
          Effective date: August 13, 2026
        </p>

        <div className="mt-8 space-y-8 text-base leading-7 text-slate-300">
          <section>
            <p>
              These Terms of Service (“Terms”) govern your use of the website at{" "}
              <span className="text-slate-100">sitesinc.co</span> and the
              website design and development services offered by Sitesync
              Business (“we,” “us,” or “our”). By using this website, purchasing
              a service, or submitting project information, you agree to these
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              1. Who We Are
            </h2>
            <p className="mt-2">
              Sitesync Business builds custom websites for small businesses
              using modern tools such as Next.js, Tailwind CSS, and Netlify
              hosting. Our public site and contact email are:
            </p>
            <p className="mt-3">
              Website:{" "}
              <a
                href="https://sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                https://sitesinc.co
              </a>
              <br />
              Email:{" "}
              <a
                href="mailto:save@sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                save@sitesinc.co
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              2. Services
            </h2>
            <p className="mt-2">
              Unless otherwise agreed in writing, a standard website build may
              include:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>A custom website built with Next.js and Tailwind CSS</li>
              <li>Choice among available design themes</li>
              <li>On-page SEO basics (titles, meta descriptions, structure)</li>
              <li>Lead capture / email signup setup where applicable</li>
              <li>Stripe payment link or checkout placeholders as agreed</li>
              <li>Netlify hosting setup and domain connection assistance</li>
              <li>Full code handoff so you own the project files</li>
              <li>One round of revisions after the first draft</li>
            </ul>
            <p className="mt-2">
              Exact deliverables depend on the package you purchase and any
              written scope we confirm with you. Optional maintenance plans are
              separate and not required for your site to remain live.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              3. Pricing and Launch Offers
            </h2>
            <p className="mt-2">
              Prices shown on the website (including any limited launch or early
              customer discounts) apply only while those offers are active and
              while spots remain. We may change pricing or end offers at any
              time. Once you complete payment for a listed offer, that purchase
              price is locked for that order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              4. Payments
            </h2>
            <p className="mt-2">
              Payments are processed by Stripe or another third-party payment
              provider. By paying, you agree to that provider’s terms. We do not
              store your full card details on our servers. Work on a paid build
              typically begins after payment clears and we receive the
              onboarding information we request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              5. Your Responsibilities
            </h2>
            <p className="mt-2">You agree to provide, in a timely manner:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Accurate business information, copy, and contact details</li>
              <li>Logos, photos, and brand assets you want used</li>
              <li>Access needed for domain connection or hosting setup</li>
              <li>
                Feedback within a reasonable time during the revision window
              </li>
            </ul>
            <p className="mt-2">
              You represent that you own or have rights to use all content you
              provide, and that it does not infringe others’ rights or violate
              law. Delays in providing content or feedback may delay delivery
              beyond the stated turnaround.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              6. Turnaround and Revisions
            </h2>
            <p className="mt-2">
              Typical turnaround is about 5–7 business days after we receive
              required content and cleared payment. Timelines are estimates, not
              guarantees. Standard builds include one round of revisions after
              the first draft. Additional revision rounds or scope changes may
              require extra fees, which we will confirm before doing the work.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              7. Ownership and License
            </h2>
            <p className="mt-2">
              After full payment and delivery, you own the custom website code
              and content we create specifically for your project, excluding
              third-party tools, libraries, fonts, stock assets, and our
              pre-existing templates, systems, or know-how. We retain the right
              to reuse general techniques, components, and non-client-specific
              tooling. You grant us a limited right to showcase your completed
              site in our portfolio and marketing unless you ask us in writing
              not to.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              8. Refunds and Cancellations
            </h2>
            <p className="mt-2">
              Because custom website work begins after payment and onboarding,
              purchases are generally non-refundable once work has started. If
              we have not started work, contact us promptly at{" "}
              <a
                href="mailto:save@sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                save@sitesinc.co
              </a>{" "}
              and we will review cancellation requests in good faith. Chargebacks
              filed without first contacting us may delay resolution. Optional
              monthly maintenance can be canceled going forward; fees already
              paid for a billing period are typically not prorated unless we
              agree otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              9. Free Resources and Email Signup
            </h2>
            <p className="mt-2">
              Free downloads (such as checklists) and email signup forms are
              provided as-is for informational purposes. They are not legal,
              financial, or professional advice, and results are not guaranteed.
              You can stop promotional emails anytime as described in our{" "}
              <Link href="/privacy" className="text-brand-300 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              10. Acceptable Use
            </h2>
            <p className="mt-2">
              You may not misuse this website or our services, including by
              attempting unauthorized access, disrupting the site, submitting
              harmful or illegal content, or using our work for unlawful
              purposes. We may refuse or stop work that we reasonably believe
              violates law or these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              11. Third-Party Services
            </h2>
            <p className="mt-2">
              Your project may rely on third parties such as Stripe, Netlify,
              Google Analytics, domain registrars, and email providers. Those
              services have their own terms and availability. We are not
              responsible for outages, policy changes, or fees charged by
              third parties outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              12. Disclaimers
            </h2>
            <p className="mt-2">
              Our website and services are provided “as is” and “as available.”
              We do not guarantee specific business results, search rankings,
              traffic levels, or sales. Website performance also depends on your
              content, offers, marketing, and market conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              13. Limitation of Liability
            </h2>
            <p className="mt-2">
              To the fullest extent permitted by law, Sitesync Business is not
              liable for indirect, incidental, special, consequential, or lost
              profit damages arising from your use of the site or our services.
              Our total liability for any claim related to a paid project is
              limited to the amount you paid us for that project in the three
              months before the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              14. Indemnity
            </h2>
            <p className="mt-2">
              You agree to indemnify and hold us harmless from claims arising
              from content you provide, your business activities, or your misuse
              of the website or deliverables, except to the extent caused by our
              willful misconduct.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              15. Changes
            </h2>
            <p className="mt-2">
              We may update these Terms from time to time. The updated version
              will be posted on this page with a new effective date. Continued
              use of the site or services after changes means you accept the
              updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              16. Contact
            </h2>
            <p className="mt-2">
              Questions about these Terms:{" "}
              <a
                href="mailto:save@sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                save@sitesinc.co
              </a>
            </p>
            <p className="mt-3">
              <span className="font-medium text-slate-100">
                Sitesync Business
              </span>
              <br />
              <a
                href="https://sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                https://sitesinc.co
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
