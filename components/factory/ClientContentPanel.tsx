"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ARTWORK_AVAILABILITY,
  CLIENT_ASSET_ROLES,
  clientAssetUrl,
  MAX_CLIENT_ASSET_BYTES,
} from "@/lib/factory/client-content";
import type { ClientArtwork, ClientAsset } from "@/lib/factory/types";

export type ClientContentPanelPage = {
  slug: string;
  title: string;
  status: string;
  source: "template" | "operator";
  body: string;
};

type Props = {
  projectId: string;
  templateId: string;
  pages: ClientContentPanelPage[];
  assets: ClientAsset[];
  artworks: ClientArtwork[];
  pricingNote: string;
  pricesAllowed: boolean;
};

const input = "mt-1 block w-full rounded-lg bg-black/40 px-2 py-1.5 text-sm text-white ring-1 ring-white/10";
const button =
  "rounded-lg bg-gradient-to-b from-brand-300 to-brand-600 px-3 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60";
const ghost = "rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60";

async function action(payload: Record<string, unknown>) {
  const res = await fetch("/api/factory/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, hostOrigin: window.location.origin }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string; warnings?: string[]; count?: number };
  if (!res.ok || !data.ok) throw new Error(data.error || "Not saved.");
  return data;
}

/** Operator tools for a client's own content: per-page copy, image uploads and (artist template) the artwork list. */
export default function ClientContentPanel(props: Props) {
  const router = useRouter();
  const editable = props.pages;
  const [slug, setSlug] = useState(editable[0]?.slug || "");
  const current = editable.find((p) => p.slug === slug);
  const [copy, setCopy] = useState(current?.source === "operator" ? current.body : "");
  const [copyTitle, setCopyTitle] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [alt, setAlt] = useState("");
  const [role, setRole] = useState("work");
  const [works, setWorks] = useState<ClientArtwork[]>(props.artworks);
  const [assetAlts, setAssetAlts] = useState<Record<string, string>>(
    Object.fromEntries(props.assets.map((a) => [a.id, a.alt]))
  );

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      setMessage(await fn());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not saved.");
    } finally {
      setBusy("");
    }
  }

  function pickPage(next: string) {
    setSlug(next);
    const page = editable.find((p) => p.slug === next);
    setCopy(page?.source === "operator" ? page.body : "");
    setCopyTitle("");
  }

  const updateWork = (index: number, patch: Partial<ClientArtwork>) =>
    setWorks(works.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  return (
    <section className="mt-6 rounded-2xl border border-white/10 p-5" id="client-content">
      <h2 className="text-lg font-semibold">Client content</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        The client&apos;s own words, images and works. Page copy replaces the template draft and is kept through
        template rebuilds; it is still a draft that needs approval. Nothing here publishes anything or contacts
        anyone. No prices, reviews or testimonials are added
        {props.pricesAllowed ? "" : "; prices are dropped because the pricing note does not list them publicly"}.
      </p>
      {message ? <p className="mt-3 text-xs text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-3 text-xs text-amber-200">Not saved: {error}</p> : null}

      {/* ---------------------------- page copy ---------------------------- */}
      <h3 className="mt-6 text-base font-semibold">Page copy</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="text-xs text-slate-400">
          Page
          <select value={slug} onChange={(e) => pickPage(e.target.value)} className={input}>
            {editable.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.slug} · {p.source === "operator" ? "client copy" : "template draft"} · {p.status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Page title (optional)
          <input value={copyTitle} onChange={(e) => setCopyTitle(e.target.value)} placeholder={current?.title} className={input} />
        </label>
        <label className="text-xs text-slate-400 sm:col-span-2">
          Copy (plain text; &quot;## &quot; starts a section heading, &quot;- &quot; a list item)
          <textarea value={copy} rows={10} onChange={(e) => setCopy(e.target.value)} className={input} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={Boolean(busy) || !copy.trim()}
          onClick={() =>
            run("copy", async () => {
              await action({ op: "set-client-page-copy", projectId: props.projectId, slug, body: copy, title: copyTitle });
              return `Saved client copy for ${slug} (ready for review, noindex).`;
            })
          }
        >
          {busy === "copy" ? "Saving…" : "Save page copy"}
        </button>
        {current?.source === "operator" ? (
          <button
            type="button"
            className={ghost}
            disabled={Boolean(busy)}
            onClick={() =>
              run("clear", async () => {
                await action({ op: "clear-client-page-copy", projectId: props.projectId, slug });
                setCopy("");
                return `Cleared client copy for ${slug}; the template draft is back.`;
              })
            }
          >
            Clear copy (back to template)
          </button>
        ) : null}
      </div>

      {/* ----------------------------- uploads ----------------------------- */}
      <h3 className="mt-8 text-base font-semibold">Images ({props.assets.length})</h3>
      <p className="mt-1 text-xs text-slate-400">
        JPEG, PNG or WebP, up to {MAX_CLIENT_ASSET_BYTES / 1_000_000} MB each. Alt text is required. Roles: work, artist-photo
        (About), logo (header), other.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          Alt text
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Crystal Ball, painting" className={input} />
        </label>
        <label className="text-xs text-slate-400">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
            {CLIENT_ASSET_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={Boolean(busy)}
          className="text-xs text-slate-300"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            run("upload", async () => {
              if (!alt.trim()) throw new Error("Add alt text first.");
              const form = new FormData();
              form.append("projectId", props.projectId);
              form.append("file", file);
              form.append("alt", alt);
              form.append("role", role);
              const res = await fetch("/api/factory/client-assets", { method: "POST", body: form });
              const data = (await res.json()) as { ok?: boolean; error?: string; deduped?: boolean };
              if (!res.ok || !data.ok) throw new Error(data.error || "Upload failed.");
              setAlt("");
              return data.deduped ? "That image was already uploaded." : `Uploaded ${file.name}.`;
            });
          }}
        />
      </div>
      {props.assets.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {props.assets.map((asset) => (
            <li key={asset.id} className="rounded-xl border border-white/10 p-2 text-xs text-slate-300">
              {/* eslint-disable-next-line @next/next/no-img-element -- client upload served from the factory store */}
              <img src={clientAssetUrl(props.projectId, asset.filename)} alt={asset.alt} className="aspect-square w-full rounded-lg object-cover" />
              <p className="mt-1 truncate text-slate-500">
                {asset.id} · {asset.role} · {Math.round(asset.bytes / 1000)} KB
              </p>
              <input
                value={assetAlts[asset.id] ?? asset.alt}
                onChange={(e) => setAssetAlts({ ...assetAlts, [asset.id]: e.target.value })}
                className={input}
                aria-label={`Alt text for ${asset.id}`}
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  className={ghost}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    run("alt", async () => {
                      await action({ op: "update-client-asset", projectId: props.projectId, assetId: asset.id, alt: assetAlts[asset.id] ?? asset.alt });
                      return "Alt text saved.";
                    })
                  }
                >
                  Save alt
                </button>
                <button
                  type="button"
                  className={ghost}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    run("delete", async () => {
                      await action({ op: "delete-client-asset", projectId: props.projectId, assetId: asset.id });
                      return `Deleted ${asset.id}.`;
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ---------------------------- artworks ----------------------------- */}
      {props.templateId === "portfolio" ? (
        <>
          <h3 className="mt-8 text-base font-semibold">Artwork list ({works.length})</h3>
          <p className="mt-1 text-xs text-slate-400">
            All fields optional. Featured works lead the home &quot;Selected work&quot; grid. Pricing note:{" "}
            {props.pricingNote || "none"}
            {props.pricesAllowed ? " (prices may be listed)" : " (no prices are stored or shown)"}.
          </p>
          <div className="mt-2 space-y-2">
            {works.map((work, index) => (
              <div key={work.id || index} className="grid gap-2 rounded-xl border border-white/10 p-2 sm:grid-cols-8">
                {(["title", "series", "medium", "year", "size"] as const).map((key) => (
                  <label key={key} className={`text-xs text-slate-400 ${key === "title" || key === "medium" ? "sm:col-span-2" : ""}`}>
                    {key}
                    <input value={work[key] || ""} onChange={(e) => updateWork(index, { [key]: e.target.value })} className={input} />
                  </label>
                ))}
                <label className="text-xs text-slate-400">
                  availability
                  <select
                    value={work.availability || ""}
                    onChange={(e) => updateWork(index, { availability: (e.target.value || undefined) as ClientArtwork["availability"] })}
                    className={input}
                  >
                    <option value="">-</option>
                    {ARTWORK_AVAILABILITY.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400 sm:col-span-2">
                  image
                  <select value={work.imageId || ""} onChange={(e) => updateWork(index, { imageId: e.target.value || undefined })} className={input}>
                    <option value="">none</option>
                    {props.assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.alt.slice(0, 40)} ({a.id})
                      </option>
                    ))}
                  </select>
                </label>
                {props.pricesAllowed ? (
                  <label className="text-xs text-slate-400">
                    price
                    <input value={work.price || ""} onChange={(e) => updateWork(index, { price: e.target.value })} className={input} />
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={Boolean(work.featured)} onChange={(e) => updateWork(index, { featured: e.target.checked })} />
                  featured
                </label>
                <button type="button" className={ghost} onClick={() => setWorks(works.filter((_, i) => i !== index))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={ghost} onClick={() => setWorks([...works, { id: `art-new-${works.length + 1}` }])}>
              Add work
            </button>
            <button
              type="button"
              className={button}
              disabled={Boolean(busy)}
              onClick={() =>
                run("works", async () => {
                  const data = await action({ op: "set-client-artworks", projectId: props.projectId, artworks: works });
                  return `Saved ${data.count ?? works.length} work(s); template drafts rebuilt.${data.warnings?.length ? ` ${data.warnings.join(" ")}` : ""}`;
                })
              }
            >
              {busy === "works" ? "Saving…" : "Save artwork list"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
