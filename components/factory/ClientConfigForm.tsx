"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ClientConfigFormValues = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  businessType: string;
  offer: string;
  primaryGoal: string;
  pricingNote: string;
  domain: string;
  notes: string;
};

const FIELDS: Array<{ key: keyof ClientConfigFormValues; label: string; wide?: boolean; area?: boolean }> = [
  { key: "businessName", label: "Business name" },
  { key: "contactName", label: "Contact name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State (2 letters)" },
  { key: "businessType", label: "Business type (e.g. artist, plumber)" },
  { key: "offer", label: "What they sell" },
  { key: "primaryGoal", label: "Primary goal" },
  { key: "pricingNote", label: "Pricing note (blank = no prices shown)" },
  { key: "domain", label: "Domain the client already owns" },
  { key: "notes", label: "Notes", wide: true, area: true },
];

/** Operator edit form for an existing client project. Saving rebuilds unapproved drafts from the new details. */
export const EMPTY_CLIENT_CONFIG: ClientConfigFormValues = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  businessType: "",
  offer: "",
  primaryGoal: "",
  pricingNote: "",
  domain: "",
  notes: "",
};

export default function ClientConfigForm({
  projectId,
  initial = EMPTY_CLIENT_CONFIG,
}: {
  /** Omit to create a new internal client project (record-intake) instead of editing one. */
  projectId?: string;
  initial?: ClientConfigFormValues;
}) {
  const creating = !projectId;
  const router = useRouter();
  const [values, setValues] = useState<ClientConfigFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const changed = Object.fromEntries(
        (Object.keys(values) as Array<keyof ClientConfigFormValues>)
          .filter((key) => values[key].trim() !== initial[key].trim())
          .map((key) => [key, values[key].trim()])
      );
      if (!Object.keys(changed).length) {
        setMessage("Nothing changed.");
        return;
      }
      if (creating && !values.businessName.trim()) throw new Error("Business name is required.");
      const res = await fetch("/api/factory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creating
            ? { op: "record-intake", source: "factory_intake", hostOrigin: window.location.origin, ...changed }
            : { op: "update-client-config", projectId, hostOrigin: window.location.origin, ...changed }
        ),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        projectId?: string;
        refreshed?: string[];
        kept?: string[];
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      if (creating) {
        if (data.projectId) router.push(`/app/clients/${data.projectId}`);
        setMessage(`Created ${data.projectId || "project"}.`);
        return;
      }
      setMessage(
        `Saved. Drafts rebuilt: ${data.refreshed?.join(", ") || "none"}${data.kept?.length ? ` · kept (approved): ${data.kept.join(", ")}` : ""}.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/10 p-5" id="edit-client">
      <h3 className="text-base font-semibold">{creating ? "New client project" : "Edit client details"}</h3>
      <p className="mt-1 text-xs text-slate-400">
        {creating
          ? "Creates the client project internally (no lead email is sent to anyone), picks the template from the business type, seeds drafts and queues the preview baseline."
          : "Saving rebuilds the templated drafts that are not approved yet, and queues a fresh preview baseline. Approved or published pages are kept as they are. Nothing is published and no one is contacted."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className={`text-xs text-slate-400 ${field.wide ? "sm:col-span-2" : ""}`}>
            {field.label}
            {field.area ? (
              <textarea
                value={values[field.key]}
                rows={3}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                className="mt-1 block w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white ring-1 ring-white/10"
              />
            ) : (
              <input
                value={values[field.key]}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                className="mt-1 block w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white ring-1 ring-white/10"
              />
            )}
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-lg bg-gradient-to-b from-brand-300 to-brand-600 px-3 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {busy ? "Saving…" : creating ? "Create client project" : "Save and rebuild drafts"}
        </button>
        {message ? <p className="text-xs text-emerald-200">{message}</p> : null}
        {error ? <p className="text-xs text-amber-200">{error}</p> : null}
      </div>
    </section>
  );
}
