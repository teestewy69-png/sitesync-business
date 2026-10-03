import {
  blobStoreName,
  blobsContextPresent,
  ensureBlobsFromRequest,
  readIndex,
  readRecord,
  readRecords,
  storeBackend,
  storeIsDurable,
  writeIndex,
  writeRecord,
  writeRecords,
} from "@/lib/persistence";
import { isStagingEnv } from "@/lib/site-env";
import type { LeadStage } from "@/lib/lead-stage";

export type Lead = {
  id: string;
  name: string;
  email: string;
  source: string;
  createdAt: string;
  projectId?: string;
  monitoringInterest?: boolean;
  goals?: string;
  details?: string;
  linkageState?: "linked" | "project_pending";
  idempotencyKey?: string;
  notificationState?: "sent" | "failed" | "not_configured";
  env?: "staging";
  /** Operator-only pipeline stage; absent means "new". */
  stage?: LeadStage;
  stageUpdatedAt?: string;
};

export type Inquiry = {
  id: string;
  slug: string;
  productName: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  env?: "staging";
  idempotencyKey?: string;
  fingerprint?: string;
  notificationState?: "sent" | "failed" | "not_configured";
  stage?: LeadStage;
  stageUpdatedAt?: string;
};

export type ClientProject = {
  id: string;
  source: "inquiry" | "subscribe" | "factory_intake";
  createdAt: string;
  label: string;
  leadId?: string;
  monitoringInterest?: boolean;
  env?: "staging";
  /** Operator-only pipeline stage; absent means "new". */
  stage?: LeadStage;
  stageUpdatedAt?: string;
};

export type OrderItem = {
  slug: string;
  name: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  status: "recorded" | "awaiting_stripe" | "email_only";
  email: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  items: OrderItem[];
  subtotal: number;
  notes?: string;
  stripeCheckoutUrl?: string;
  createdAt: string;
  env?: "staging";
};

function withSiteEnv<T extends { env?: "staging" }>(record: T): T {
  if (!isStagingEnv()) return record;
  return { ...record, env: "staging" };
}

type Collection = "leads" | "inquiries" | "orders" | "projects";

type RecordMap = {
  leads: Lead;
  inquiries: Inquiry;
  orders: Order;
  projects: ClientProject;
};

let writeChain: Promise<void> = Promise.resolve();

function emailIndexKey(email: string, source: string): string {
  return `email/${source}/${email.toLowerCase()}`;
}

function projectLeadIndexKey(leadId: string): string {
  return `project-by-lead/${leadId}`;
}

function idempotencyIndexKey(source: string, key: string): string {
  return `idempotency/${source}/${key}`;
}

function inquiryKeyIndexKey(key: string): string {
  return `idempotency/inquiry/${key}`;
}

function inquiryFingerprintIndexKey(fingerprint: string): string {
  return `inquiry-fp/${fingerprint}`;
}

async function mutateLocal<K extends Collection>(
  collection: K,
  mutate: (records: RecordMap[K][]) => RecordMap[K][]
): Promise<void> {
  const run = writeChain.then(async () => {
    const records = await readRecords<RecordMap[K]>(collection);
    await writeRecords(collection, mutate(records));
  });
  writeChain = run.catch(() => undefined);
  await run;
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export async function stableId(prefix: string, seed: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`sitesinc:${prefix}:${seed}`)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 18);
  return `${prefix}_${hex}`;
}

export function storeInfo() {
  return {
    backend: storeBackend(),
    durable: storeIsDurable(),
    storeName: storeBackend() === "netlify-blobs" ? blobStoreName() : "data/store",
    blobsContext: blobsContextPresent(),
  };
}

export { ensureBlobsFromRequest };

export async function storeWritable(): Promise<boolean> {
  try {
    const probeId = `probe_${Date.now().toString(36)}`;
    await writeIndex("health/probe", probeId);
    if (storeBackend() === "local-json") {
      const leads = await readRecords<Lead>("leads");
      await writeRecords("leads", leads);
    }
    return true;
  } catch (err) {
    console.error("Store writable check failed:", err instanceof Error ? err.name : "unknown");
    return false;
  }
}

export async function appendLead(lead: Lead): Promise<Lead> {
  const record = withSiteEnv(lead);
  await writeRecord("leads", record);
  await writeIndex(emailIndexKey(record.email, record.source), record.id);
  if (record.idempotencyKey) {
    await writeIndex(idempotencyIndexKey(record.source, record.idempotencyKey), record.id);
  }
  return record;
}

export async function listLeads(): Promise<Lead[]> {
  return [...(await readRecords<Lead>("leads"))].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function findLeadById(id: string): Promise<Lead | null> {
  return readRecord<Lead>("leads", id);
}

export async function findLeadByEmail(email: string, source: string): Promise<Lead | null> {
  if (storeBackend() === "netlify-blobs") {
    const id = await readIndex(emailIndexKey(email, source));
    if (!id) return null;
    return readRecord<Lead>("leads", id);
  }
  const leads = await readRecords<Lead>("leads");
  return [...leads].reverse().find((lead) => lead.email === email && lead.source === source) || null;
}

export async function findLeadByIdempotency(source: string, key: string): Promise<Lead | null> {
  if (storeBackend() === "netlify-blobs") {
    const id = await readIndex(idempotencyIndexKey(source, key));
    if (!id) return null;
    return readRecord<Lead>("leads", id);
  }
  const leads = await readRecords<Lead>("leads");
  return [...leads].reverse().find((lead) => lead.source === source && lead.idempotencyKey === key) || null;
}

export async function listInquiries(): Promise<Inquiry[]> {
  return [...(await readRecords<Inquiry>("inquiries"))].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null> {
  const current = await readRecord<Lead>("leads", id);
  if (storeBackend() === "netlify-blobs") {
    if (!current) return null;
    const updated = { ...current, ...patch, id };
    await writeRecord("leads", updated);
    return updated;
  }
  let updated: Lead | null = null;
  await mutateLocal("leads", (records) =>
    records.map((lead) => {
      if (lead.id !== id) return lead;
      updated = { ...lead, ...patch, id: lead.id };
      return updated;
    })
  );
  return updated;
}

type StageCollection = "leads" | "inquiries" | "projects";
type StageKind = "lead" | "inquiry" | "project";

const STAGE_COLLECTIONS: { collection: StageCollection; kind: StageKind }[] = [
  { collection: "leads", kind: "lead" },
  { collection: "inquiries", kind: "inquiry" },
  { collection: "projects", kind: "project" },
];

/**
 * Operator-only: set the pipeline stage on a lead, inquiry, or project by id.
 * Writes only `stage` and `stageUpdatedAt`; `status`, dedupe keys and notification state are untouched.
 * Returns null when no record has that id. Never returns contact details.
 */
export async function updateRecordStage(
  id: string,
  stage: LeadStage
): Promise<{ id: string; kind: StageKind; stage: LeadStage; stageUpdatedAt: string } | null> {
  const stageUpdatedAt = new Date().toISOString();
  for (const { collection, kind } of STAGE_COLLECTIONS) {
    const current = await readRecord<RecordMap[StageCollection]>(collection, id);
    if (!current) continue;
    if (storeBackend() === "netlify-blobs") {
      await writeRecord(collection, { ...current, stage, stageUpdatedAt, id });
    } else {
      await mutateLocal(collection, (records) =>
        (records as RecordMap[StageCollection][]).map((row) =>
          row.id === id ? { ...row, stage, stageUpdatedAt } : row
        ) as RecordMap[typeof collection][]
      );
    }
    return { id, kind, stage, stageUpdatedAt };
  }
  return null;
}

export async function appendInquiry(inquiry: Inquiry): Promise<Inquiry> {
  const record = withSiteEnv(inquiry);
  await writeRecord("inquiries", record);
  // Lookup indexes only exist on Netlify Blobs; a failed index write must not lose the inquiry.
  try {
    if (inquiry.idempotencyKey) {
      await writeIndex(inquiryKeyIndexKey(inquiry.idempotencyKey), inquiry.id);
    }
    if (inquiry.fingerprint) {
      await writeIndex(inquiryFingerprintIndexKey(inquiry.fingerprint), inquiry.id);
    }
  } catch (err) {
    console.error("Inquiry index write failed:", err instanceof Error ? err.name : "unknown");
  }
  return record;
}

/** Stable hash of slug + email + message (whitespace/case-insensitive) used for short-window dedupe. */
export async function inquiryFingerprint(slug: string, email: string, message: string): Promise<string> {
  const normalized = message.toLowerCase().replace(/\s+/g, " ").trim();
  return stableId("inqfp", `${slug}|${email.toLowerCase()}|${normalized}`);
}

/** Deterministic inquiry id for a client idempotency key (retries overwrite instead of duplicating). */
export async function inquiryIdForKey(key: string): Promise<string> {
  return stableId("inq", `key:${key}`);
}

export async function findInquiryById(id: string): Promise<Inquiry | null> {
  return readRecord<Inquiry>("inquiries", id);
}

export async function findInquiryByIdempotency(key: string): Promise<Inquiry | null> {
  if (storeBackend() === "netlify-blobs") {
    const id = await readIndex(inquiryKeyIndexKey(key));
    if (!id) return null;
    return readRecord<Inquiry>("inquiries", id);
  }
  const rows = await readRecords<Inquiry>("inquiries");
  return [...rows].reverse().find((row) => row.idempotencyKey === key) || null;
}

export async function findRecentInquiryByFingerprint(
  fingerprint: string,
  windowMs: number
): Promise<Inquiry | null> {
  let candidate: Inquiry | null = null;
  if (storeBackend() === "netlify-blobs") {
    const id = await readIndex(inquiryFingerprintIndexKey(fingerprint));
    candidate = id ? await readRecord<Inquiry>("inquiries", id) : null;
  } else {
    const rows = await readRecords<Inquiry>("inquiries");
    candidate = [...rows].reverse().find((row) => row.fingerprint === fingerprint) || null;
  }
  if (!candidate) return null;
  const age = Date.now() - Date.parse(candidate.createdAt);
  return Number.isFinite(age) && age >= 0 && age <= windowMs ? candidate : null;
}

export async function appendProject(project: ClientProject): Promise<ClientProject> {
  const record = withSiteEnv(project);
  await writeRecord("projects", record);
  if (record.leadId) await writeIndex(projectLeadIndexKey(record.leadId), record.id);
  return record;
}

export async function listProjects(): Promise<ClientProject[]> {
  return [...(await readRecords<ClientProject>("projects"))].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function findProjectByLeadId(leadId: string): Promise<ClientProject | null> {
  if (storeBackend() === "netlify-blobs") {
    const id = await readIndex(projectLeadIndexKey(leadId));
    if (!id) return null;
    return readRecord<ClientProject>("projects", id);
  }
  const projects = await readRecords<ClientProject>("projects");
  return projects.find((project) => project.leadId === leadId) || null;
}

export async function appendOrder(order: Order): Promise<Order> {
  const record = withSiteEnv(order);
  await writeRecord("orders", record);
  return record;
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  if (storeBackend() === "netlify-blobs") {
    const current = await readRecord<Order>("orders", id);
    if (!current) return null;
    const updated = { ...current, ...patch, id };
    await writeRecord("orders", updated);
    return updated;
  }
  let updated: Order | null = null;
  await mutateLocal("orders", (records) =>
    records.map((order) => {
      if (order.id !== id) return order;
      updated = { ...order, ...patch, id: order.id };
      return updated;
    })
  );
  return updated;
}
