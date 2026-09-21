import FactoryShell, { Pill } from "@/components/factory/Shell";
import { PRODUCTION_SURFACES } from "@/lib/factory/surfaces";
import { runStagingQa } from "@/lib/factory/qa";
import { readWorkspace } from "@/lib/factory/workspace";

export default async function ReleasePage() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
  const qa = await runStagingQa(origin);
  const workspace = await readWorkspace();

  return (
    <FactoryShell title="Staging QA and production checklist">
      <p className="max-w-3xl text-base text-slate-300">
        Private staging only. Nothing here deploys sitesinc.co. Production stays the current live
        homepage until you approve a Netlify production deploy.
      </p>
      <p className="mt-2 text-sm text-slate-400">
        QA origin {qa.origin} · ran {qa.ranAt}
        {qa.launchBlocking ? " · launch blocking issues open" : " · no launch blockers in this pass"}
      </p>

      <h2 className="mt-10 text-lg font-semibold">QA results</h2>
      <ul className="mt-3 space-y-2">
        {qa.items.map((item) => (
          <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3 text-sm">
            <Pill
              tone={
                item.status === "fail" ? "warn" : item.status === "pass" ? "ok" : "muted"
              }
            >
              {item.status}
            </Pill>{" "}
            <strong>{item.area}.</strong> {item.detail}
            {item.launchBlocking ? " Launch blocking." : ""}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">Intake conversions</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {workspace.intakeProjects.slice(0, 5).map((item) => (
          <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3">
            {item.id} · {item.source} · {item.label} · {item.createdAt}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">Production deployment checklist</h2>
      <p className="mt-2 text-sm text-slate-400">
        Do not run <code>netlify deploy --prod</code> until every box is explicit. Surfaces selected
        now: {workspace.productionRelease?.selected?.join(", ") || "none"}.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
        <li>Staging QA pass on this page is green for launch-blocking items.</li>
        <li>Operator chooses surfaces on /app/staging. Homepage replacement stays blocked.</li>
        <li>Case study remains noindex and labeled in progress.</li>
        <li>No ranking, indexing, backlink, or conversion claims on public pages.</li>
        <li>Commit only the approved routes. Do not include unpublished factory drafts as live URLs.</li>
        <li>Take a Netlify production deploy snapshot / previous deploy ID before going live.</li>
        <li>Deploy production only after Tony’s explicit approval.</li>
        <li>Recheck sitesinc.co homepage, pricing, intake, and robots/sitemap after deploy.</li>
      </ol>

      <h2 className="mt-10 text-lg font-semibold">Routes proposed if later approved</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {PRODUCTION_SURFACES.map((surface) => (
          <li key={surface.id} className="rounded-xl border border-white/10 px-4 py-3">
            <strong>{surface.label}</strong>
            <span className="block text-slate-400">{surface.paths.join(" · ")}</span>
            <span className="block text-slate-500">{surface.note}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">Rollback procedure</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
        <li>If factory pages were published in-repo: use Rollback factory pages on /app/staging. That sets them noindex and 404s public factory routes.</li>
        <li>If a Netlify production deploy already went out: restore the previous successful production deploy in Netlify (Deploys → previous published deploy → Publish). Do not rebuild from a dirty branch.</li>
        <li>Confirm https://sitesinc.co still serves the original marketing homepage.</li>
        <li>Confirm /website-design and other factory routes 404 unless they were meant to stay.</li>
        <li>Leave /case-study noindex if it was ever deployed. Do not add ranking claims during rollback.</li>
        <li>Record the rollback deploy ID and time in the factory workspace notes.</li>
      </ol>
    </FactoryShell>
  );
}
