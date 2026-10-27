import FactoryRail from "@/components/factory/FactoryRail";

export default function FactoryShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="warehouse min-h-screen text-zinc-100 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-white/10 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <FactoryRail />
      </aside>
      <main className="min-w-0">
        <header className="border-b border-white/10 px-6 py-5 lg:px-10">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        </header>
        <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">{children}</div>
      </main>
    </div>
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
