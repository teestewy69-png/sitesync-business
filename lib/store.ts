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
};

export type Inquiry = {
  id: string;
  slug: string;
  productName: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

export type ClientProject = {
  id: string;
  source: "inquiry" | "subscribe" | "factory_intake";
  createdAt: string;
  label: string;
  leadId?: string;
  monitoringInterest?: boolean;
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
};

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
  await writeRecord("leads", lead);
  await writeIndex(emailIndexKey(lead.email, lead.source), lead.id);
  if (lead.idempotencyKey) {
    await writeIndex(idempotencyIndexKey(lead.source, lead.idempotencyKey), lead.id);
  }
  return lead;
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

export async function appendInquiry(inquiry: Inquiry): Promise<Inquiry> {
  await writeRecord("inquiries", inquiry);
  return inquiry;
}

export async function appendProject(project: ClientProject): Promise<ClientProject> {
  await writeRecord("projects", project);
  if (project.leadId) await writeIndex(projectLeadIndexKey(project.leadId), project.id);
  return project;
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
  await writeRecord("orders", order);
  return order;
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
