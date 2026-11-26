import { deepAuditUrl, type DeepAuditResult, type DeepFinding } from "@/lib/deep-audit";
import { getNotifyEmail, isMailConfigured, sendMail } from "@/lib/mail";
import { findLeadById, storeInfo, updateLead } from "@/lib/store";

/**
 * Free website audit by email (founder ruling 2026-11-23): the audit is NOT
 * run on the spot. The visitor leaves a website address + email, the lead is
 * saved under this source, and the results are emailed back with a free copy
 * of the SitesInc ebook — the email opens a relationship instead of ending
 * at "audit and go".
 */
export const FREE_AUDIT_SOURCE = "free-audit";

/** The free ebook thrown in with every audit: "What Your Web Builder Won't Tell You". */
export const AUDIT_EBOOK_URL =
  "https://sitesinc.co/what-your-web-builder-wont-tell-you.pdf";

const NAME_FALLBACK = "Website owner";
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function greetingName(name: string): string {
  const trimmed = (name || "").trim();
  return trimmed && trimmed !== NAME_FALLBACK ? trimmed : "";
}

/**
 * Where a finding shows up: the affected-page count with up to 3 example pages, or the single
 * page for a one-page finding. Site-level findings ("site") name no page.
 */
function pagesNote(f: DeepFinding): string {
  if (f.pages > 1) {
    const examples = f.examples.length ? ` — e.g. ${f.examples.join(", ")}` : "";
    return ` (shows up on ${f.pages} pages${examples})`;
  }
  if (f.examples.length) return ` (on ${f.examples[0]})`;
  return "";
}

/**
 * The report shape the walk-through call needs: the big problems first, every one with its
 * business consequence, then the rest grouped by severity. Every distinct finding is named —
 * the full list is the selling material, so nothing is truncated away.
 */
function findingsText(findings: DeepFinding[]): string {
  if (findings.length === 0) {
    return "The audit didn't flag anything in the checks we run — that's a clean result.";
  }
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  const line = (f: DeepFinding) =>
    `- [${f.severity.toUpperCase()}] ${f.issue}${pagesNote(f)}\n  Fix: ${f.fix}\n  What it means for your business: ${f.consequence}`;
  const sections: string[] = [];
  const highs = sorted.filter((f) => f.severity === "high");
  const mediums = sorted.filter((f) => f.severity === "medium");
  const lows = sorted.filter((f) => f.severity === "low");
  if (highs.length) sections.push(`THE BIG PROBLEMS FIRST\n\n${highs.map(line).join("\n")}`);
  if (mediums.length) sections.push(`ALSO FOUND — MEDIUM PRIORITY\n\n${mediums.map(line).join("\n")}`);
  if (lows.length) sections.push(`ALSO FOUND — LOW PRIORITY\n\n${lows.map(line).join("\n")}`);
  return sections.join("\n\n");
}

function findingsHtml(findings: DeepFinding[]): string {
  if (findings.length === 0) {
    return "<p>The audit didn&rsquo;t flag anything in the checks we run — that&rsquo;s a clean result.</p>";
  }
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  const item = (f: DeepFinding) =>
    `<li><strong>[${esc(f.severity.toUpperCase())}] ${esc(f.issue)}</strong>${esc(pagesNote(f))}<br/>Fix: ${esc(f.fix)}<br/><em>What it means for your business:</em> ${esc(f.consequence)}</li>`;
  const sections: string[] = [];
  const highs = sorted.filter((f) => f.severity === "high");
  const mediums = sorted.filter((f) => f.severity === "medium");
  const lows = sorted.filter((f) => f.severity === "low");
  if (highs.length)
    sections.push(`<p><strong>THE BIG PROBLEMS FIRST</strong></p><ul>${highs.map(item).join("")}</ul>`);
  if (mediums.length)
    sections.push(`<p><strong>ALSO FOUND — MEDIUM PRIORITY</strong></p><ul>${mediums.map(item).join("")}</ul>`);
  if (lows.length)
    sections.push(`<p><strong>ALSO FOUND — LOW PRIORITY</strong></p><ul>${lows.map(item).join("")}</ul>`);
  return sections.join("");
}

const SIGN_OFF = `Tony, SitesInc
1968 South Coast Hwy #3632, Laguna Beach, CA 92651
If you'd rather not hear from us again, reply and say so and we won't email you again.`;

function resultsEmail(lead: { name: string }, result: Extract<DeepAuditResult, { ok: true }>) {
  const name = greetingName(lead.name);
  const site = result.finalUrl || result.checkedUrl;
  const subject = `Your free website audit for ${site} — score: ${result.score}/100`;
  const countsLine = `The audit flagged ${result.counts.high + result.counts.medium + result.counts.low} things: ${result.counts.high} high, ${result.counts.medium} medium, ${result.counts.low} low priority. It crawled ${result.pagesCrawled} page${result.pagesCrawled === 1 ? "" : "s"}.`;

  const text = `Hi${name ? ` ${name}` : ""},

Here's the free audit you asked for. We ran your website, ${site}, through our checks, and it scored ${result.score} out of 100.

${countsLine}

Here's what the audit found:

${findingsText(result.findings)}

Your free copy of our ebook, What Your Web Builder Won't Tell You, is linked here in this email — it's yours to keep either way.
Download it here: ${AUDIT_EBOOK_URL}

Most of what the audit found is fixable, and fixing it is exactly what a SitesInc rebuild covers: a new site built for $1,995 flat — $997.50 to start and $997.50 at launch — with the site and the code yours, and the first month of monitoring free. If you'd like to walk through the findings together, just reply to this email or call (909) 323-1575. And if not, no hard feelings — the audit and the ebook are yours to keep.

${SIGN_OFF}`;

  const html = `<p>Hi${name ? ` ${esc(name)}` : ""},</p>
<p>Here's the free audit you asked for. We ran your website, ${esc(site)}, through our checks, and it scored <strong>${result.score} out of 100</strong>.</p>
<p>${esc(countsLine)}</p>
<p>Here's what the audit found:</p>
${findingsHtml(result.findings)}
<p>Your free copy of our ebook, <em>What Your Web Builder Won't Tell You</em>, is linked here in this email — it's yours to keep either way.<br/><a href="${AUDIT_EBOOK_URL}">Download the ebook (PDF)</a></p>
<p>Most of what the audit found is fixable, and fixing it is exactly what a SitesInc rebuild covers: a new site built for $1,995 flat — $997.50 to start and $997.50 at launch — with the site and the code yours, and the first month of monitoring free. If you'd like to walk through the findings together, just reply to this email or call (909) 323-1575. And if not, no hard feelings — the audit and the ebook are yours to keep.</p>
<p>Tony, SitesInc<br/>1968 South Coast Hwy #3632, Laguna Beach, CA 92651<br/>If you'd rather not hear from us again, reply and say so and we won't email you again.</p>`;

  return { subject, text, html };
}

function snagEmail(lead: { name: string }, site: string) {
  const name = greetingName(lead.name);
  const subject = `Your free website audit for ${site} — we hit a snag`;
  const text = `Hi${name ? ` ${name}` : ""},

You asked us for a free audit of ${site}, and we hit a snag: our checker couldn't get into the site to run it. Some sites block automated visitors, and some addresses need a small correction before they answer.

Your free copy of our ebook, What Your Web Builder Won't Tell You, is yours either way:
Download it here: ${AUDIT_EBOOK_URL}

Want us to run the audit by hand? Just reply to this email and we'll check your site ourselves and send you the findings.

${SIGN_OFF}`;
  const html = `<p>Hi${name ? ` ${esc(name)}` : ""},</p>
<p>You asked us for a free audit of ${esc(site)}, and we hit a snag: our checker couldn't get into the site to run it. Some sites block automated visitors, and some addresses need a small correction before they answer.</p>
<p>Your free copy of our ebook, <em>What Your Web Builder Won't Tell You</em>, is yours either way.<br/><a href="${AUDIT_EBOOK_URL}">Download the ebook (PDF)</a></p>
<p>Want us to run the audit by hand? Just reply to this email and we'll check your site ourselves and send you the findings.</p>
<p>Tony, SitesInc<br/>1968 South Coast Hwy #3632, Laguna Beach, CA 92651<br/>If you'd rather not hear from us again, reply and say so and we won't email you again.</p>`;
  return { subject, text, html };
}

/**
 * Run the deep audit for a saved free-audit lead and email the results (plus
 * the free ebook link) to the visitor, with a notification to the operator.
 * Idempotent: a lead already marked "sent" or "sending" is skipped, and the
 * lead is claimed ("sending") before any work starts, so repeat triggers
 * cannot produce a duplicate email.
 */
export async function sendAuditEmail(leadId: string): Promise<void> {
  const lead = await findLeadById(leadId);
  if (!lead) {
    console.error("Audit email: lead not found:", leadId);
    return;
  }
  if (lead.source !== FREE_AUDIT_SOURCE) return;
  if (lead.notificationState === "sent" || lead.notificationState === "sending") return;

  await updateLead(lead.id, { notificationState: "sending" });

  const notifyEmail = getNotifyEmail();
  const mailConfigured = isMailConfigured();
  const storeBackend = storeInfo().backend;
  const site = (lead.details || "").trim();

  let result: DeepAuditResult | null = null;
  try {
    result = await deepAuditUrl(site);
  } catch (err) {
    console.error("Audit email: deep audit threw:", err);
    result = null;
  }

  const mail =
    result && result.ok ? resultsEmail(lead, result) : snagEmail(lead, site || "your site");
  const summary =
    result && result.ok
      ? `Score: ${result.score}/100 · high ${result.counts.high} · medium ${result.counts.medium} · low ${result.counts.low} · pages crawled ${result.pagesCrawled}`
      : `Audit could not complete${result ? `: ${result.error}` : " (checker error)"} — snag email sent, ebook included.`;

  let mailed = { sent: false };
  try {
    mailed = await sendMail({
      to: lead.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    await sendMail({
      to: notifyEmail,
      subject: `New free audit: ${site} — ${result && result.ok ? `${result.score}/100` : "could not run"}`,
      text: `New free audit request\n\nName: ${lead.name}\nEmail: ${lead.email}\nSite: ${site}\n${summary}\nLead ID: ${lead.id}\nStore: ${storeBackend}\nSent ${lead.createdAt}\nSMTP configured: ${mailConfigured ? "yes" : "no"}`,
    });
  } catch (err) {
    console.error("Audit email error:", err);
  }

  try {
    await updateLead(lead.id, {
      notificationState: mailed.sent
        ? "sent"
        : mailConfigured
          ? "failed"
          : "not_configured",
    });
  } catch (err) {
    console.error(
      "Audit notification-state update failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
  }
}
