import { FACTORY_PROJECT_ID } from "./types";
import type {
  ChecklistFinalDecision,
  ChecklistItem,
  ChecklistSection,
  ChecklistSectionStatus,
  OperatorChecklist,
} from "./types";

export const CHECKLIST_STATUSES: ChecklistSectionStatus[] = ["not_started", "in_progress", "complete"];
export const NOTES_MAX = 4000;
export const CHECKLIST_DECISIONS: ChecklistFinalDecision[] = ["", "good_enough", "cleanup_pass", "major_fix"];

function items(...labels: string[]): ChecklistItem[] {
  return labels.map((label) => ({
    id: slug(label),
    label,
    checked: false,
  }));
}

function slug(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function section(id: string, title: string, href: string | undefined, labels: string[]): ChecklistSection {
  return {
    id,
    title,
    href,
    status: "not_started",
    notes: "",
    items: items(...labels),
  };
}

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  section("project", "Project", "/app", [
    "Open or create Sitesinc Growth Case Study",
    "Confirm project type = internal",
    "Confirm live site is linked",
    "Confirm primary goal = qualified website requests",
  ]),
  section("intake", "Intake / Brief", "/app", [
    "Business/project name is correct",
    "Audience is clear",
    "Primary offer is clear",
    "Primary CTA is clear",
    "Notes make sense for the project",
    "Nothing important is missing from intake",
  ]),
  section("research", "Research", "/app", [
    "Competitors are useful/relevant",
    "Target keyword themes make sense",
    "Pain points/objections are useful",
    "Monetization/conversion notes are useful",
    "Research output feels usable",
  ]),
  section("blueprint", "Blueprint", "/app/content", [
    "Page list is sensible",
    "Slugs are good",
    "Internal linking makes sense",
    "No thin/duplicate/spammy pages",
    "Important pages are present",
  ]),
  section("content", "Content / Briefs", "/app/content", [
    "Target keyword is set",
    "Analyze top 3 runs",
    "Competitor output makes sense",
    "Recommended word count is useful",
    "Suggested sections are useful",
    "Gap analysis is useful",
    "Brief would help a human/AI write better content",
  ]),
  section("staging", "Build / Staging", "/app/staging", [
    "Preview build loads",
    "Homepage looks correct",
    "Pricing is correct",
    "Hero copy is correct",
    "FAQ is correct",
    "CTA links are correct",
    "No old pricing remains",
    "No broken pages",
    "Mobile view works",
  ]),
  section("seo", "SEO Intelligence", "/app/seo", [
    "Site appears in SEO Intelligence",
    "Site selector works",
    "SEO overview loads",
    "Page-level SEO review loads",
    "Diagnostics / issues load",
    "Content Refresh loads",
    "Preflight, indexing, and backlinks are in the workspace",
    "No invented Search Console or rank counts",
  ]),
  section("funnel", "Funnel / Intake", "/app/inbox", [
    "Visit homepage",
    "Click CTA",
    "Fill form",
    "Submit",
    "Success message is truthful",
    "Lead is saved",
    "Project is linked",
    "Inbox shows it",
    "Email delivers",
    "Duplicate retry does not create another project",
    "Mobile form works",
    "Intake completed end to end on a real phone (not a resized desktop browser)",
    "Fallback: a real lead can be acted on from the notify email alone if the inbox is late",
  ]),
  section("performance", "Performance / Accessibility", "/app/release", [
    "Mobile Lighthouse score is acceptable for launch",
    "Desktop Lighthouse score is acceptable for launch",
    "Accessibility sanity check (contrast, labels, keyboard focus) shows no severe failures",
    "No JavaScript errors in the browser console on home, form, and success states",
    "No major layout shift or broken images on a real phone",
  ]),
  section("technical", "Technical / Deployment", "/app/release", [
    "robots.txt works",
    "sitemap.xml works",
    "canonical tags correct",
    "Open Graph correct",
    "schema present where appropriate",
    "noindex only on preview/private pages",
    "no public factory links",
    "production protection correct",
    "Production deploy ID confirmed in Netlify (locked to commit 45106cf)",
    "Rollback deploy ID is written down where I can find it fast",
    "No accidental production publish path is open (auto-publish, merged release PR)",
    "Release PR stays draft and unmerged until I say yes",
  ]),
  section("monitoring", "Monitoring / Follow-up", "/app/inbox", [
    "I know where to find new requests",
    "I know what status they start in",
    "I know how to respond to a real lead",
    "I know how to move a lead to paid/in progress",
    "Monitoring option is represented clearly",
  ]),
  section("business", "Business Readiness", "/app/inbox", [
    "First 5-10 outreach targets are listed",
    "Launch post is drafted",
    "DM / email outreach message is drafted",
    "Invoice for the first 50% is ready to send",
    "Final 50% collection steps are written down",
    "I can explain the optional $129/month monitoring in one sentence",
  ]),
  section("final", "Final Review", "/app/case-study", [
    "What felt strongest?",
    "What felt weak or clunky?",
    "What would confuse a future paying client?",
    "What would confuse me as the operator?",
    "Top 3 fixes before scaling traffic",
  ]),
];

export function seedChecklist(
  projectId = FACTORY_PROJECT_ID,
  projectName = "Sitesinc Growth Case Study"
): OperatorChecklist {
  return {
    projectId,
    projectName,
    updatedAt: "",
    finalDecision: "",
    sections: CHECKLIST_SECTIONS.map((row) => ({
      ...row,
      items: row.items.map((item) => ({ ...item })),
    })),
  };
}

export function derivedStatus(items: ChecklistItem[]): ChecklistSectionStatus {
  const done = items.filter((item) => item.checked).length;
  if (done === 0) return "not_started";
  if (done === items.length) return "complete";
  return "in_progress";
}

export function mergeChecklist(
  saved: OperatorChecklist | null,
  projectId: string,
  projectName: string
): OperatorChecklist {
  const seeded = seedChecklist(projectId, projectName);
  if (!saved || saved.projectId !== projectId) return seeded;

  const savedSections = new Map((Array.isArray(saved.sections) ? saved.sections : []).map((row) => [row.id, row]));
  return {
    projectId,
    projectName: saved.projectName || projectName,
    updatedAt: saved.updatedAt || "",
    finalDecision: CHECKLIST_DECISIONS.includes(saved.finalDecision) ? saved.finalDecision : "",
    sections: seeded.sections.map((sectionDef) => {
      const existing = savedSections.get(sectionDef.id);
      const savedItems = new Map((Array.isArray(existing?.items) ? existing.items : []).map((item) => [item.id, item]));
      const items = sectionDef.items.map((item) => ({
        ...item,
        checked: Boolean(savedItems.get(item.id)?.checked),
      }));
      const savedStatus = CHECKLIST_STATUSES.includes(existing?.status as ChecklistSectionStatus)
        ? (existing?.status as ChecklistSectionStatus)
        : derivedStatus(items);
      // Items added after a section was marked complete reopen it.
      const status = savedStatus === "complete" && items.some((item) => !item.checked) ? "in_progress" : savedStatus;
      return {
        ...sectionDef,
        status,
        notes: typeof existing?.notes === "string" ? existing.notes.slice(0, NOTES_MAX) : "",
        items,
      };
    }),
  };
}

export function checklistProgress(checklist: OperatorChecklist) {
  const all = checklist.sections.flatMap((section) => section.items);
  const done = all.filter((item) => item.checked).length;
  const completeSections = checklist.sections.filter((section) => section.status === "complete").length;
  return {
    done,
    total: all.length,
    completeSections,
    totalSections: checklist.sections.length,
  };
}
