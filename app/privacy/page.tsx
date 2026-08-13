import Link from "next/link";

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Effective date: August 12, 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-300">
          <section>
            <p>
              Sitesync Business (“we,” “us,” or “our”) operates the website at{" "}
              <span className="text-slate-100">sitesinc.co</span>. This Privacy
              Policy explains how we collect, use, and protect your information
              when you visit our website, contact us, purchase services, or sign
              up for updates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              1. Information We Collect
            </h2>
            <p className="mt-2">
              We may collect the following types of information:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium text-slate-100">
                  Contact information
                </span>{" "}
                such as your name, email address, phone number, and business
                details when you fill out forms or contact us.
              </li>
              <li>
                <span className="font-medium text-slate-100">
                  Project information
                </span>{" "}
                such as your business name, services, branding, domain details,
                and content you provide for your website build.
              </li>
              <li>
                <span className="font-medium text-slate-100">
                  Payment-related information
                </span>{" "}
                when you purchase services or digital products. Payments are
                processed through third-party providers such as Stripe. We do
                not store your full payment card details on our servers.
              </li>
              <li>
                <span className="font-medium text-slate-100">
                  Analytics and usage data
                </span>{" "}
                such as browser type, pages visited, time on site, referring
                sources, and other website usage data collected through tools
                like Google Analytics.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              2. How We Use Your Information
            </h2>
            <p className="mt-2">We use information we collect to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Provide and deliver our website design and development services
              </li>
              <li>
                Communicate with you about your inquiry, purchase, or project
              </li>
              <li>Process payments and send order-related confirmations</li>
              <li>Improve our website, services, and user experience</li>
              <li>
                Send updates, resources, or marketing emails if you opt in
              </li>
              <li>Monitor traffic, performance, and engagement on our website</li>
              <li>Protect against fraud, abuse, or misuse of our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              3. Email Communications
            </h2>
            <p className="mt-2">
              If you sign up for our email list, download a resource, or contact
              us, we may send you emails related to your request, your project,
              or occasional marketing and educational content. You can
              unsubscribe from promotional emails at any time using the
              unsubscribe link in the email or by contacting us at{" "}
              <a
                href="mailto:save@sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                save@sitesinc.co
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              4. Analytics and Tracking
            </h2>
            <p className="mt-2">
              We may use analytics tools such as Google Analytics to understand
              how visitors use our website. These tools may collect information
              such as your IP address, device type, browser, pages viewed, and
              actions taken on the site. This information helps us improve our
              website and services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              5. Third-Party Services
            </h2>
            <p className="mt-2">
              We may use trusted third-party service providers to help operate
              our business, including:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Stripe for payment processing</li>
              <li>Google Analytics for traffic and usage reporting</li>
              <li>Netlify for website hosting and deployment</li>
              <li>Email and form tools for communications and lead capture</li>
            </ul>
            <p className="mt-2">
              These third parties may process your information in accordance
              with their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              6. How We Share Information
            </h2>
            <p className="mt-2">
              We do not sell your personal information. We may share information
              only as necessary to:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Provide services you requested</li>
              <li>Process payments through third-party providers</li>
              <li>Comply with legal obligations</li>
              <li>Protect our rights, property, or users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              7. Data Security
            </h2>
            <p className="mt-2">
              We take reasonable steps to protect your information, but no
              method of transmission over the internet or method of storage is
              completely secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              8. Data Retention
            </h2>
            <p className="mt-2">
              We retain personal information only as long as necessary for
              business, legal, tax, or operational purposes, or as needed to
              provide our services and maintain records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              9. Your Rights
            </h2>
            <p className="mt-2">
              Depending on your location, you may have the right to request
              access to, correction of, or deletion of your personal
              information. To make a request, contact us at{" "}
              <a
                href="mailto:save@sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                save@sitesinc.co
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              10. Children’s Privacy
            </h2>
            <p className="mt-2">
              Our website and services are not directed to children under 13,
              and we do not knowingly collect personal information from
              children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              11. Changes to This Policy
            </h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. Changes will
              be posted on this page with an updated effective date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              12. Contact Us
            </h2>
            <p className="mt-2">
              If you have questions about this Privacy Policy, contact us at:
            </p>
            <p className="mt-3">
              <span className="font-medium text-slate-100">
                Sitesync Business
              </span>
              <br />
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
        </div>
      </div>
    </main>
  );
}
