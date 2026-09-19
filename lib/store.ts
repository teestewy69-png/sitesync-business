import { readRecords, storeBackend, storeIsDurable, writeRecords } from "@/lib/persistence";

export type Lead = {
  id: string;
  name: string;
  email: string;
  source: string;
  createdAt: string;
  projectId?: string;
  monitoringInterest?: boolean;
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

async function readCollection<K extends Collection>(collection: K): Promise<RecordMap[K][]> {
  return readRecords<RecordMap[K]>(collection);
}

async function writeCollection<K extends Collection>(
  collection: K,
  records: RecordMap[K][]
): Promise<void> {
  await writeRecords(collection, records);
}

async function mutateCollection<K extends Collection>(
  collection: K,
  mutate: (records: RecordMap[K][]) => RecordMap[K][]
): Promise<void> {
  const run = writeChain.then(async () => {
    const records = await readCollection(collection);
    await writeCollection(collection, mutate(records));
  });
  writeChain = run.catch(() => undefined);
  await run;
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function storeInfo() {
  return {
    backend: storeBackend(),
    durable: storeIsDurable(),
  };
}

export async function storeWritable(): Promise<boolean> {
  try {
    const probe = await readCollection("leads");
    await writeCollection("leads", probe);
    return true;
  } catch {
    return false;
  }
}

export async function appendLead(lead: Lead): Promise<Lead> {
  await mutateCollection("leads", (records) => [...records, lead]);
  return lead;
}

export async function listLeads(): Promise<Lead[]> {
  return [...(await readCollection("leads"))].reverse();
}

export async function findLeadByEmail(email: string, source: string): Promise<Lead | null> {
  const leads = await readCollection("leads");
  return [...leads].reverse().find((lead) => lead.email === email && lead.source === source) || null;
}

export async function listInquiries(): Promise<Inquiry[]> {
  return [...(await readCollection("inquiries"))].reverse();
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null> {
  let updated: Lead | null = null;
  await mutateCollection("leads", (records) =>
    records.map((lead) => {
      if (lead.id !== id) return lead;
      updated = { ...lead, ...patch, id: lead.id };
      return updated;
    })
  );
  return updated;
}

export async function appendInquiry(inquiry: Inquiry): Promise<Inquiry> {
  await mutateCollection("inquiries", (records) => [...records, inquiry]);
  return inquiry;
}

export async function appendProject(project: ClientProject): Promise<ClientProject> {
  await mutateCollection("projects", (records) => [project, ...records].slice(0, 400));
  return project;
}

export async function listProjects(): Promise<ClientProject[]> {
  return readCollection("projects");
}

export async function findProjectByLeadId(leadId: string): Promise<ClientProject | null> {
  const projects = await readCollection("projects");
  return projects.find((project) => project.leadId === leadId) || null;
}

export async function appendOrder(order: Order): Promise<Order> {
  await mutateCollection("orders", (records) => [...records, order]);
  return order;
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  let updated: Order | null = null;
  await mutateCollection("orders", (records) =>
    records.map((order) => {
      if (order.id !== id) return order;
      updated = { ...order, ...patch, id: order.id };
      return updated;
    })
  );
  return updated;
}
