import Link from "next/link";
import type { ClientProject } from "@/lib/store";

export default function SiteGrowBay({ projects }: { projects: ClientProject[] }) {
  const withWorkspace = projects.filter((p) => p.factoryWorkspaceId || p.templateId).length;
  return (
    <section className="mt-16 rounded-2xl border border-purple-400/40 bg-purple-500/5 p-6" id="sitegrow-bay">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-purple-200">1. Build</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Purple is the client-site build. A public intake lead becomes a client project with
            template, design, seeded pages, preview, and its own baseline crawl. This is not a separate SiteGrow
            app and not an auto-publish to the client&apos;s domain.
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">wired</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Client projects", projects.length],
          ["Factory initialized", withWorkspace],
          ["Ready to open", projects.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/10 px-3 py-2">
            <p className="text-2xl font-semibold text-white">{value}</p>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {projects.length ? (
        <ul className="mt-4 space-y-1 text-sm">
          {projects.slice(0, 12).map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
            >
              <span>
                <Link href={`/app/clients/${row.id}`} className="font-medium text-brand-300 hover:underline">
                  {row.businessName || row.label}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  · {row.templateId || "no template"} · {row.city || "no city"}
                  {row.leadId ? " · from intake" : ""}
                </span>
              </span>
              <span className="flex flex-wrap gap-3 text-xs">
                <Link href={`/app/clients/${row.id}`} className="text-brand-300 hover:underline">
                  Open
                </Link>
                <Link href={`/demo/client/${row.id}`} className="text-slate-400 hover:text-white">
                  Preview
                </Link>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No client projects yet. A homepage request or the New client project form on this page creates one.
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Full list: <Link href="/app/clients" className="text-brand-300 hover:underline">/app/clients</Link>
      </p>
    </section>
  );
}
