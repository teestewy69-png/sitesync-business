import Link from "next/link";
import content from "@/content.json";

type ProductKey = "launch" | "full" | "maintenance" | "ebook";

const COPY: Record<
  ProductKey,
  { title: string; body: string }
> = {
  launch: {
    title: "Thanks — we received your request",
    body: "Submitting a Sitesinc form is a request, not a purchase. If we accept the project, you will receive a $997.50 start invoice by email. The remaining $997.50 is due at launch.",
  },
  full: {
    title: "Thanks — we received your request",
    body: "This is not a website checkout. If we accept the project, Sitesinc sends the $997.50 start invoice manually.",
  },
  maintenance: {
    title: "Thanks — monitoring request received",
    body: "Optional monitoring is $129/month and can be enrolled manually after a website is accepted. Cancel anytime. No long-term contract.",
  },
  ebook: {
    title: "Thanks for grabbing the kit!",
    body: "Your payment was successful. Check your email for delivery details. If anything's missing, reply to us and we'll sort it out.",
  },
};

function resolveProduct(value: string | string[] | undefined): ProductKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "full" || raw === "maintenance" || raw === "ebook" || raw === "launch") {
    return raw;
  }
  return "launch";
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[]; order?: string | string[] }>;
}) {
  const params = await searchParams;
  const product = resolveProduct(params.product);
  const copy = COPY[product];
  const email = content.footer.email;
  const orderRaw = Array.isArray(params.order) ? params.order[0] : params.order;
  const orderId = orderRaw?.trim() || "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-base text-slate-300">
          {copy.body} We&apos;ll reach you from{" "}
          <span className="font-semibold text-brand-300">{email}</span>.
        </p>
        {orderId ? (
          <p className="text-sm text-slate-400">
            Order ID: <span className="font-mono text-slate-200">{orderId}</span>
          </p>
        ) : null}
        <p className="text-sm text-slate-400">
          If you don&apos;t see our email, check your spam folder or contact us
          directly at{" "}
          <a
            href={`mailto:${email}`}
            className="text-brand-300 hover:underline"
          >
            {email}
          </a>
          .
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
        >
          Back to Sitesinc
        </Link>
      </div>
    </main>
  );
}
