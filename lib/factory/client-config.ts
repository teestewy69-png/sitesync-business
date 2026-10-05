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
  email: string;
  niche: string;
  businessType: string;
  city: string;
  state: string;
  phone: string;
  primaryGoal: string;
  notes: string;
  monitoringInterest: boolean;
  designStyleId: DesignStyleId;
  templateId: ClientTemplateId;
  seededPages: SeededClientPage[];
};

export type IntakeConfigInput = {
  name?: string;
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
export function buildClientConfig(input: IntakeConfigInput): ClientBuildConfig {
  const name = clean(input.name, 120);
  const email = clean(input.email, 160).toLowerCase();
  const goals = clean(input.goals, 2000);
  const details = clean(input.details, 4000);
  const label = clean(input.label, 160);
  const notesBlob = [goals, details, label].filter(Boolean).join("\n");
  const hints = parseIntakeHints(notesBlob);

  const businessName = name || label || "New client business";
  const niche = clean(input.niche, 80) || hints.niche || "local service";
  const businessType =
    clean(input.businessType, 80) ||
    (niche.toLowerCase().includes("portfolio") || niche.toLowerCase().includes("artist")
      ? "portfolio"
      : "local-service");
  const city = clean(input.city, 80) || hints.city;
  const state = clean(input.state, 2).toUpperCase() || hints.state;
  const phone = clean(input.phone, 40) || hints.phone;
  const primaryGoal =
    clean(input.primaryGoal, 200) ||
    hints.primaryGoal ||
    clean(goals, 200) ||
    "Launch a clear client website";
  const notes = clean(input.notes || details || goals, 4000);

  const requestedTemplate = clean(input.templateId, 40) as ClientTemplateId;
  const templateId = CLIENT_TEMPLATES.some((t) => t.id === requestedTemplate)
    ? requestedTemplate
    : inferTemplateId({ niche, businessType, label, goals: notesBlob });

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
    email,
    niche,
    businessType,
    city,
    state,
    phone,
    primaryGoal,
    notes,
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
    name: project.businessName || project.label,
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
    goals: project.primaryGoal,
    details: project.notes,
    label: project.label,
  });
}
