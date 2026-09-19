import FactoryShell from "@/components/factory/Shell";
import { listInquiries, listLeads, listProjects, storeInfo } from "@/lib/store";
import { readWorkspace } from "@/lib/factory/workspace";

export default async function InboxPage() {
  const [leads, inquiries, projects, workspace] = await Promise.all([
    listLeads(),
    listInquiries(),
    listProjects(),
    readWorkspace(),
  ]);
  const store = storeInfo();
  const linkedProjects = projects.length > 0 ? projects : workspace.intakeProjects;

  return (
    <FactoryShell title="Private intake inbox">
      <p className="max-w-3xl text-sm text-slate-400">
        Name and email stay in the private store. Public pages and the case study never show this.
        SMTP is a follow-up channel, not the source of truth. Store: {store.backend}
        {store.durable ? " (durable)" : " (local development only — not safe on Netlify)"}.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Checklist leads</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {leads.length === 0 ? (
          <li className="text-slate-500">No checklist leads yet.</li>
        ) : (
          leads.map((lead) => (
            <li key={lead.id} className="rounded-xl border border-white/10 px-4 py-3">
              <strong>{lead.name}</strong> · {lead.email}
              <span className="block text-slate-400">
                {lead.id} · project {lead.projectId || "unlinked"} · monitoring{" "}
                {lead.monitoringInterest ? "yes" : "no"} · {lead.createdAt}
              </span>
            </li>
          ))
        )}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Shop inquiries</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {inquiries.length === 0 ? (
          <li className="text-slate-500">No shop inquiries yet.</li>
        ) : (
          inquiries.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3">
              <strong>{item.name}</strong> · {item.email} · {item.productName}
              <span className="block text-slate-400">
                {item.id} · {item.createdAt}
              </span>
            </li>
          ))
        )}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Internal project links</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {linkedProjects.slice(0, 10).map((item) => (
          <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3">
            {item.id} · {item.label} · lead {item.leadId || "none"}
            {"monitoringInterest" in item
              ? ` · monitoring ${item.monitoringInterest ? "yes" : "no"}`
              : ""}
          </li>
        ))}
      </ul>
    </FactoryShell>
  );
}
