"use client";

import { FormEvent, useState } from "react";

export default function FactoryLoginPage() {
  const next = "/app";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/factory/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, next }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Could not sign in.");
      return;
    }
    window.location.assign(typeof data?.next === "string" ? data.next : "/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-surface p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Internal</p>
        <h1 className="text-xl font-semibold">Factory sign in</h1>
        <p className="text-sm text-slate-400">
          Operator access only. This is not a public account page.
        </p>
        <label className="block text-sm text-slate-300">
          Access token
          <input
            type="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {loading ? "Checking…" : "Enter factory"}
        </button>
      </form>
    </main>
  );
}
