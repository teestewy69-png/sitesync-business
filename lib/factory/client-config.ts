import type { DesignStyleId } from "@/lib/design-styles";
import { DESIGN_STYLES } from "@/lib/design-styles";
import type { ClientProject, SeededClientPage } from "@/lib/store";
import {
  CLIENT_TEMPLATES,
  type ClientTemplateId,
  getClientTemplate,
  inferTemplateId,
  seedPagesForTemplate,
} from "./client-templates";

export type ClientBuildConfig = {
  businessName: string;
  contactName: string;
  email: string;
  niche: string;
  businessType: string;
  city: string;
  state: string;
  phone: string;
  primaryGoal: string;
  notes: string;
  /** What the client sells, in their words. */
  offer: string;
  /** Client-provided pricing note ("Available on request"); empty = no prices anywhere. */
  pricingNote: string;
  /** Domain the client already owns (normalized host), or "". */
  domain: string;
  monitoringInterest: boolean;
  designStyleId: DesignStyleId;
  templateId: ClientTemplateId;
  seededPages: SeededClientPage[];
};

export type IntakeConfigInput = {
  /** Legacy/public form name field. Used as the business name when businessName is absent. */
  name?: string;
  businessName?: string;
  contactName?: string;
  /** What the client sells (free text). Drives template choice together with businessType. */
  offer?: string;
  pricingNote?: string;
  /** Domain the client already owns. */
  domain?: string;
  email?: string;
  goals?: string;
  details?: string;
  label?: string;
  source?: string;
  monitoringInterest?: boolean;
  phone?: string;
  city?: string;
  state?: string;
  niche?: string;
  businessType?: string;
  primaryGoal?: string;
  notes?: string;
  designStyleId?: string;
  preferredDesign?: string;
  templateId?: string;
};

const US_STATES =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;

const CITY_STATE =
  /(?:\bin\s+|\bat\s+|\bnear\s+|\b|^)([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2}),\s*([A-Z]{2})\b/;

const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;

function clean(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function isDesignStyleId(value: string): value is DesignStyleId {
  return DESIGN_STYLES.some((style) => style.id === value);
}

export function normalizeDesignStyleId(
  value?: string,
  fallback?: DesignStyleId
): DesignStyleId {
  const raw = clean(value, 40).toLowerCase();
  if (raw && isDesignStyleId(raw)) return raw;
  const byName = DESIGN_STYLES.find(
    (style) => style.name.toLowerCase() === raw || style.id === raw
  );
  if (byName) return byName.id;
  return fallback || "neon-glass";
}

/** Infer niche / location / phone / goal from free-text goals+details. */
export function parseIntakeHints(text: string): {
  niche: string;
  city: string;
  state: string;
  phone: string;
  primaryGoal: string;
} {
  const blob = clean(text, 6000);
  let city = "";
  let state = "";
  const loc = blob.match(CITY_STATE);
  if (loc) {
    city = clean(loc[1], 80);
    state = loc[2].toUpperCase();
  } else {
    const st = blob.match(US_STATES);
    if (st) state = st[1].toUpperCase();
  }
  const phone = (blob.match(PHONE_RE) || [""])[0];

  const nicheHints: [RegExp, string][] = [
    [/plumb/i, "plumbing"],
    [/hvac|heating|air conditioning/i, "HVAC"],
    [/electr/i, "electrical"],
    [/roof/i, "roofing"],
    [/landscap|lawn/i, "landscaping"],
    [/barber|salon|hair/i, "barber / salon"],
    [/restaurant|food truck|cafe|coffee/i, "food & hospitality"],
    [/coach|consult/i, "coaching / consulting"],
    [/photo|artist|portfolio|gallery/i, "creative / portfolio"],
    [/dentist|dental|chiro|clinic/i, "health / clinic"],
    [/lawyer|attorney|law firm/i, "legal"],
    [/contractor|construction|remodel/i, "contractor"],
  ];
  let niche = "";
  for (const [re, label] of nicheHints) {
    if (re.test(blob)) {
      niche = label;
      break;
    }
  }

  let primaryGoal = "";
  if (/call|phone|lead/i.test(blob)) primaryGoal = "Get more calls / leads";
  else if (/book|appoint/i.test(blob)) primaryGoal = "Get more bookings";
  else if (/sell|checkout|shop|stripe/i.test(blob)) primaryGoal = "Sell online";
  else if (/redesign|rebuild|refresh/i.test(blob)) primaryGoal = "Website redesign";
  else if (blob) primaryGoal = clean(blob.split(/[.\n]/)[0] || blob, 160);

  return { niche, city, state, phone: clean(phone, 40), primaryGoal };
}

/**
 * Build a full client build config from intake fields.
 * Parses name/goals/details/label; applies template + design defaults.
 */
const TEMPLATE_DEFAULT_GOAL: Record<ClientTemplateId, string> = {
  portfolio: "Inquiries about the work",
  "local-service": "Get more calls / leads",
  general: "Launch a clear client website",
};

const PRICE_ON_REQUEST =
  /\b(?:available|price[sd]?|pricing)\s+(?:up)?on\s+request\b|\bprice\s+upon\s+request\b|\binquire\s+for\s+pric/i;

/** Pricing note from an explicit field, else only a clear "on request" statement in the notes. Never invents a price. */
export function derivePricingNote(explicit: unknown, notes: string): string {
  const direct = clean(explicit, 160);
  if (direct) return direct;
  return PRICE_ON_REQUEST.test(notes) ? "Available on request" : "";
}

/** Normalize a client-owned domain ("https://www.Example.com/x" -> "example.com"). Invalid -> "". */
export function normalizeOwnedDomain(raw: unknown): string {
  let value = clean(raw, 253).toLowerCase();
  if (!value) return "";
  value = value.replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "").replace(/\.$/, "");
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value) ? value : "";
}

function sameText(a: string, b: string): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return Boolean(norm(a)) && norm(a) === norm(b);
}

/**
 * Build a full client build config from intake fields.
 * Explicit fields win. Free text (goals/details/notes/offer/businessType) only fills gaps.
 * The internal label and the business name are never parsed for niche, template or goal.
 */
export function buildClientConfig(input: IntakeConfigInput): ClientBuildConfig {
  const label = clean(input.label, 160);
  const businessName = clean(input.businessName, 120) || clean(input.name, 120) || label || "New client business";
  const contactName = clean(input.contactName, 120);
  const email = clean(input.email, 160).toLowerCase();
  const goals = clean(input.goals, 2000);
  const details = clean(input.details, 4000);
  const offer = clean(input.offer, 200);
  const rawBusinessType = clean(input.businessType, 80);
  const notes = clean(input.notes || details || goals, 4000);
  const hints = parseIntakeHints(
    [rawBusinessType, offer, goals, details, clean(input.notes, 4000)].filter(Boolean).join("\n")
  );

  const niche = clean(input.niche, 80) || hints.niche || rawBusinessType.toLowerCase() || "local service";
  const businessType =
    rawBusinessType ||
    (niche.toLowerCase().includes("portfolio") || niche.toLowerCase().includes("artist")
      ? "portfolio"
      : "local-service");
  const city = clean(input.city, 80) || hints.city;
  const state = clean(input.state, 2).toUpperCase() || hints.state;
  const phone = clean(input.phone, 40) || hints.phone;

  const requestedTemplate = clean(input.templateId, 40) as ClientTemplateId;
  const templateId = CLIENT_TEMPLATES.some((t) => t.id === requestedTemplate)
    ? requestedTemplate
    : inferTemplateId({ niche, businessType, goals: [offer, goals].filter(Boolean).join(" ") });

  // Goal: explicit field, else what the goals text says. Never the business/contact name or the label.
  let primaryGoal = clean(input.primaryGoal, 200) || (goals ? parseIntakeHints(goals).primaryGoal : "");
  if (
    !primaryGoal ||
    sameText(primaryGoal, businessName) ||
    sameText(primaryGoal, label) ||
    (contactName && sameText(primaryGoal, contactName))
  ) {
    primaryGoal = TEMPLATE_DEFAULT_GOAL[templateId] || TEMPLATE_DEFAULT_GOAL.general;
  }

  const template = getClientTemplate(templateId);
  const designStyleId = normalizeDesignStyleId(
    input.designStyleId || input.preferredDesign,
    template.defaultDesignStyleId as DesignStyleId
  );

  const seededPages = seedPagesForTemplate(templateId, {
    businessName,
    niche,
    city,
    state,
  });

  return {
    businessName,
    contactName,
    email,
    niche,
    businessType,
    city,
    state,
    phone,
    primaryGoal,
    notes,
    offer,
    pricingNote: derivePricingNote(input.pricingNote, notes),
    domain: normalizeOwnedDomain(input.domain),
    monitoringInterest: Boolean(input.monitoringInterest),
    designStyleId,
    templateId,
    seededPages,
  };
}

/** Apply structured config onto a ClientProject record (keeps id/source/etc.). */
export function applyConfigToProject(
  project: ClientProject,
  config: ClientBuildConfig
): ClientProject {
  return {
    ...project,
    label: project.label || config.businessName,
    monitoringInterest: config.monitoringInterest ?? project.monitoringInterest,
    businessName: config.businessName,
    contactName: config.contactName || project.contactName,
    offer: config.offer || project.offer,
    pricingNote: config.pricingNote || project.pricingNote,
    ownedDomain: config.domain || project.ownedDomain,
    email: config.email || project.email,
    niche: config.niche,
    businessType: config.businessType,
    city: config.city,
    state: config.state,
    phone: config.phone,
    primaryGoal: config.primaryGoal,
    notes: config.notes,
    designStyleId: config.designStyleId,
    templateId: config.templateId,
    seededPages: config.seededPages,
    factoryWorkspaceId: project.factoryWorkspaceId || project.id,
  };
}

export function configFromProject(project: ClientProject): ClientBuildConfig {
  return buildClientConfig({
    businessName: project.businessName,
    name: project.businessName || project.label,
    contactName: project.contactName,
    offer: project.offer,
    pricingNote: project.pricingNote,
    domain: project.ownedDomain,
    email: project.email,
    niche: project.niche,
    businessType: project.businessType,
    city: project.city,
    state: project.state,
    phone: project.phone,
    primaryGoal: project.primaryGoal,
    notes: project.notes,
    monitoringInterest: project.monitoringInterest,
    designStyleId: project.designStyleId,
    templateId: project.templateId,
    label: project.label,
  });
}
