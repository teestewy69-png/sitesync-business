"use client";

import { FormEvent, useState } from "react";
import { Brain, Search, Sparkles, Wallet } from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Done-for-you site generation",
    body: "Type a business and watch a complete, conversion-ready site assemble — layouts, copy, services, and CTAs included.",
  },
  {
    icon: Search,
    title: "SEO from day one",
    body: "Titles, structure, and local search basics baked in so a new site can actually get found.",
  },
  {
    icon: Wallet,
    title: "Monetization ready",
    body: "Lead capture, Stripe-ready checkout, and money pages instead of a pretty brochure that never converts.",
  },
  {
    icon: Brain,
    title: "SEO Intelligence",
    body: "Audit generated sites, find content gaps, and keep optimizing after launch — not just at launch.",
  },
];

type Status = "idle" | "loading" | "success" | "error";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Try again.");
      }
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-gradient-to-b from-black via-canvas to-black text-white">
      <div className="pointer-events-none absolute -top-40 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-[-8rem] h-[28rem] w-[28rem] rounded-full bg-brand-800/25 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:py-16">
        <header className="flex items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Sitesinc"
            className="h-14 w-auto rounded-lg ring-1 ring-white/10 sm:h-16"
          />
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Factory under construction
          </p>
        </header>

        <section className="mt-16 space-y-6 sm:mt-20">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-300">
            Coming soon
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Sitesinc is a website factory.
          </h1>
          <p className="max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
            We&apos;re building the system that generates done-for-you sites,
            then layers on SEO, monetization, and SEO Intelligence — so local
            businesses get a real website without waiting on an agency.
          </p>
        </section>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
            >
              <feature.icon className="h-5 w-5 text-brand-300" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-white">
                {feature.title}
              </h2>
              <p className="mt-2 text-base leading-relaxed text-slate-400">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>

        <section className="mt-12 rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-elevated sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">
            Join the waitlist
          </h2>
          <p className="mt-2 text-base text-slate-400">
            Be first in line when the factory opens. No spam — launch updates
            only.
          </p>

          {status === "success" ? (
            <p className="mt-6 rounded-xl bg-brand-500/10 px-4 py-3 text-base font-medium text-brand-200 ring-1 ring-brand-500/25">
              You&apos;re on the list. We&apos;ll email you when Sitesinc is
              ready.
            </p>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mt-6 flex flex-col gap-3 sm:flex-row"
            >
              <label className="sr-only" htmlFor="waitlist-email">
                Email address
              </label>
              <input
                id="waitlist-email"
                type="email"
                name="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@business.com"
                className="w-full rounded-xl bg-black/40 px-4 py-3 text-base text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="shrink-0 rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-base font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "loading" ? "Joining…" : "Join waitlist"}
              </button>
            </form>
          )}

          {status === "error" ? (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          ) : null}
        </section>

        <p className="mt-auto pt-12 text-sm text-slate-500">
          © {new Date().getFullYear()} Sitesinc. The factory is being built.
        </p>
      </div>
    </main>
  );
}
