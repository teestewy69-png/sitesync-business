import Link from "next/link";

const NAV = [
  { href: "/app", label: "Pipeline" },
  { href: "/app/baseline", label: "Baseline" },
  { href: "/app/content", label: "Briefs & drafts" },
  { href: "/app/staging", label: "Staging" },
  { href: "/app/ops", label: "SEO / index / links" },
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/case-study", label: "Case study" },
  { href: "/app/release", label: "QA / release" },
];

export default function FactoryShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
              Internal · Sitesinc Builds Sitesinc
            </p>
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-brand-300">
            Public site
          </Link>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 pb-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:border-brand-400/50 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "ok" | "warn" | "muted" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-200"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-100"
        : "bg-white/10 text-slate-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}
