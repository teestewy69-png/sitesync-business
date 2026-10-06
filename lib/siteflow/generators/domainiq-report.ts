/** DomainIQ domain report adapter: lib/domainiq engine + keyless availability, rendered to standalone HTML. */
import { discoverClientDomains } from "@/lib/factory/domainiq";
import { DOMAINIQ_ENGINE_VERSION } from "@/lib/domainiq";
import { affiliateDisclosureText, outboundHref, REGISTRAR_SLUGS } from "@/lib/affiliates";
import { esc, reportDocument } from "../html";
import { NonRetryableError } from "./errors";

export type DomainReportInput = { businessName?: string; niche?: string; city?: string; state?: string };

export async function generateDomainIQReport(input: DomainReportInput, opts: { origin: string }): Promise<string> {
  const seed = {
    businessName: (input.businessName || "").trim(),
    niche: (input.niche || "").trim(),
    city: (input.city || "").trim(),
    state: (input.state || "").trim(),
  };
  if (!seed.niche || !seed.businessName) {
    throw new NonRetryableError("DomainIQ report needs the business name and what the business does.");
  }
  const run = await discoverClientDomains(seed, { checkAvailability: true });
  if (!run.out.ok) throw new NonRetryableError(run.out.reason || "DomainIQ could not build suggestions from these details.");
  const candidates = run.candidates;
  if (!candidates.length) throw new NonRetryableError("DomainIQ produced no candidates for these details.");

  const rows = candidates
    .map((c, i) => {
      const avail =
        c.availability === "available"
          ? '<span class="ok">likely available</span>'
          : c.availability === "registered"
            ? '<span class="bad">registered</span>'
            : `<span class="warn">${esc(c.availability.replace(/_/g, " "))}</span>`;
      const links = REGISTRAR_SLUGS.map(
        (slug) =>
          `<a href="${esc(outboundHref(opts.origin, slug, { domain: c.domain, src: "domainiq-report" }))}" rel="sponsored nofollow noopener" target="_blank">${esc(slug)}</a>`
      ).join(" · ");
      return `<tr><td>${i + 1}</td><td><strong>${esc(c.domain)}</strong><br><span class="muted">${esc(c.summary)}</span></td>
<td>${c.score.toFixed(1)}<br><span class="muted">${esc(c.band)}</span></td><td>${avail}</td>
<td>${c.highlights.map((h) => `+ ${esc(h)}`).join("<br>")}${c.concerns.length ? "<br>" : ""}${c.concerns.map((h) => `− ${esc(h)}`).join("<br>")}</td>
<td class="muted">${c.availability === "registered" ? "" : links}</td></tr>`;
    })
    .join("\n");

  const checkedAt = run.checkedAt ? new Date(run.checkedAt).toUTCString() : "";
  const body = `<h1>Domain report: ${esc(seed.businessName)}</h1>
<p class="muted">${esc(seed.niche)}${seed.city ? ` · ${esc(seed.city)}` : ""}${seed.state ? `, ${esc(seed.state)}` : ""} · DomainIQ engine ${esc(DOMAINIQ_ENGINE_VERSION)}</p>
<h2>Ranked candidates</h2>
<p>Scores (0-100) weigh length, clarity, spelling risk, niche fit and local relevance. ${
    run.availabilityChecked
      ? `Availability was checked against public registry data (RDAP/DNS) on ${esc(checkedAt)}. It is a snapshot: a name can be taken at any time, so confirm at the registrar before you decide.`
      : "Availability could not be checked automatically this time; confirm each name at a registrar."
  }</p>
<table><thead><tr><th>#</th><th>Domain</th><th>Score</th><th>Availability</th><th>Why</th><th>Search at</th></tr></thead><tbody>
${rows}
</tbody></table>
<h2>How to use this</h2>
<ul><li>Prefer a short .com you can say out loud once and spell correctly.</li>
<li>Register it yourself at any registrar; Sitesinc does not buy or hold domains for you.</li>
<li>Turn on auto-renew and WHOIS privacy.</li></ul>
<p class="muted">${esc(affiliateDisclosureText())}</p>`;
  return reportDocument(`Domain report: ${seed.businessName}`, body);
}
