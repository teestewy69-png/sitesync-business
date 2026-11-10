import type { ClientBuildConfig } from "@/lib/factory/client-config";
import { listingChecklistText, localListingChecklist } from "@/lib/factory/local-listings";
import {
  missingOwnerAnswers,
  OWNER_INTAKE_QUESTIONS,
  ownerVideoEmbed,
  serviceCityPlan,
  yearsPhrase,
} from "@/lib/factory/owner-intake";

/**
 * Operator view of the four traffic basics for one client:
 * owner first-hand answers, "[service] in [city]" page plan (written by City Launch),
 * the owner video slot, and the honest local listings checklist.
 */
export default function ClientTrafficPanel({
  config,
  website,
}: {
  config: ClientBuildConfig;
  /** Live client website, when known (selected / owned domain). */
  website?: string;
}) {
  const owner = config.owner;
  const missing = missingOwnerAnswers(owner);
  const plan = serviceCityPlan({ niche: config.niche, state: config.state, city: config.city, facts: owner });
  const video = ownerVideoEmbed(owner.ownerVideoUrl);
  const checklist = localListingChecklist(config, { website });
  const checklistText = listingChecklistText(checklist);
  const answer = (key: (typeof OWNER_INTAKE_QUESTIONS)[number]["key"]) => {
    const v = owner[key];
    if (Array.isArray(v)) return v.join(", ");
    if (key === "yearsInBusiness") return yearsPhrase(v);
    return v;
  };

  return (
    <section className="mt-10 rounded-2xl border border-sky-400/30 bg-sky-500/5 p-6" id="traffic-basics">
      <h2 className="text-lg font-semibold text-sky-100">Traffic basics</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        Owner answers in their own words, &quot;[service] in [city]&quot; pages, an owner video, and an honest list of
        places to be listed. No ranking promises, no paid links, no link swaps.
      </p>

      <h3 className="mt-5 text-sm font-semibold text-white">1. Owner questions</h3>
      <p className="mt-1 text-xs text-slate-400">
        {missing.length
          ? `Still to ask: ${missing.map((q) => q.label.split(" (")[0].toLowerCase()).join(", ")}. Edit them in “Edit client details” below.`
          : "All core owner questions answered. Drafts use these answers."}
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {OWNER_INTAKE_QUESTIONS.map((q) => {
          const value = answer(q.key);
          return (
            <div key={q.key} className="rounded-xl border border-white/10 px-4 py-3">
              <dt className="text-xs uppercase tracking-wider text-slate-500">{q.label.split(" (")[0]}</dt>
              <dd className={`mt-1 whitespace-pre-line ${value ? "text-slate-200" : "italic text-amber-200/80"}`}>
                {value || (q.optional ? "not given (optional)" : "not asked yet")}
              </dd>
            </div>
          );
        })}
      </dl>

      <h3 className="mt-6 text-sm font-semibold text-white">2. Service + city pages</h3>
      {plan.length ? (
        <>
          <p className="mt-1 text-xs text-slate-400">
            One page per service town, written by City Launch (unique local copy, uniqueness gate, human approval).
            Click <strong>Use intake towns</strong> in the City Launch panel to load these rows.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {plan.map((row) => (
              <li key={`${row.city}-${row.state}`} className="rounded-lg border border-white/10 px-3 py-2">
                <span className="text-white">{row.title}</span>
                {row.alsoCovers.length ? (
                  <span className="text-xs text-slate-500"> · also covers {row.alsoCovers.join(", ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-xs text-amber-100">
          Add the owner&apos;s most common jobs and service towns (with a state, or set the client state) to plan
          &quot;[service] in [city]&quot; pages.
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold text-white">3. Owner video</h3>
      <p className="mt-1 text-xs text-slate-400">
        {video
          ? `Video set (${video.kind === "iframe" ? "embedded player" : "video file"}). The “Meet the owner” section shows on the client home page.`
          : owner.ownerVideoUrl
            ? "The video link isn't a YouTube, Vimeo or https .mp4/.webm link, so the section stays hidden."
            : "No video yet, so the “Meet the owner” section is hidden. Ask for a 30-60 second phone video of the owner."}
      </p>

      <h3 className="mt-6 text-sm font-semibold text-white">4. Local listings checklist</h3>
      <div className="mt-2 rounded-xl border border-white/10 px-4 py-3 text-sm">
        <p className="text-xs uppercase tracking-wider text-slate-500">Use these exact details everywhere</p>
        <p className="mt-1 text-slate-200">
          {checklist.nap.name} · {checklist.nap.phone} · {checklist.nap.address} · {checklist.nap.website}
        </p>
      </div>
      <ol className="mt-3 space-y-2 text-sm">
        {checklist.items.map((item, i) => (
          <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3">
            <p className="font-medium text-white">
              {i + 1}. {item.name} <span className="text-xs font-normal text-slate-500">· {item.cost}</span>
            </p>
            <p className="mt-1 text-slate-300">{item.action}</p>
            <p className="mt-1 text-xs text-slate-500">{item.why}</p>
            {item.conditional ? <p className="mt-1 text-xs text-amber-200/80">{item.conditional}</p> : null}
            {item.url.startsWith("https://") ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-300 hover:underline">
                {item.url}
              </a>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{item.url}</p>
            )}
          </li>
        ))}
      </ol>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
        {checklist.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <a
        href={`data:text/plain;charset=utf-8,${encodeURIComponent(checklistText)}`}
        download={`listings-checklist-${config.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`}
        className="mt-3 inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
      >
        Download checklist (.txt) for the owner
      </a>
    </section>
  );
}
