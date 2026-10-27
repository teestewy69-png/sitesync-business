"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tone = "purple" | "blue" | "green" | "red";

const TONE: Record<Tone, { text: string; dot: string; active: string }> = {
  purple: {
    text: "text-purple-300",
    dot: "bg-purple-400",
    active: "bg-purple-500/15 text-purple-100",
  },
  blue: {
    text: "text-sky-300",
    dot: "bg-sky-400",
    active: "bg-sky-500/15 text-sky-100",
  },
  green: {
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    active: "bg-emerald-500/15 text-emerald-100",
  },
  red: {
    text: "text-rose-300",
    dot: "bg-rose-400",
    active: "bg-rose-500/15 text-rose-100",
  },
};

const STATIONS: Array<{
  tone: Tone;
  label: string;
  items: Array<{ href: string; label: string }>;
}> = [
  {
    tone: "purple",
    label: "Build",
    items: [
      { href: "/app/inbox", label: "Inbox" },
      { href: "/app/clients", label: "Client sites" },
      { href: "/app/flips", label: "Flip Mode" },
    ],
  },
  {
    tone: "blue",
    label: "Domain",
    items: [{ href: "/app#domainiq-bay", label: "DomainIQ" }],
  },
  {
    tone: "green",
    label: "Cities",
    items: [
      { href: "/app/content", label: "Briefs & drafts" },
      { href: "/app#city-launch-bay", label: "ScaleQuan" },
    ],
  },
  {
    tone: "red",
    label: "Ship",
    items: [
      { href: "/app/baseline", label: "Baseline" },
      { href: "/app/staging", label: "Staging" },
      { href: "/app/seo", label: "SEO" },
      { href: "/app/release", label: "Release" },
    ],
  },
];

function active(pathname: string, href: string) {
  if (href.includes("#")) return false;
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function FactoryRail() {
  const pathname = usePathname() || "/app";
  return (
    <nav aria-label="Warehouse line" className="px-4 py-4 lg:px-5 lg:py-6">
      <Link href="/app" className="mb-6 hidden text-sm font-semibold tracking-tight text-white lg:block">
        Warehouse
      </Link>
      <ol className="grid grid-cols-4 gap-2 lg:block lg:space-y-7">
        {STATIONS.map((station, index) => {
          const tone = TONE[station.tone];
          return (
            <li key={station.label} className="min-w-0">
              <p className={`flex items-center gap-1 text-xs font-semibold leading-tight lg:gap-2 lg:text-sm ${tone.text}`}>
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                {index + 1}. {station.label}
              </p>
              <ul className="mt-2 space-y-1 lg:pl-4">
                {station.items.map((item) => {
                  const on = active(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-lg px-1 py-1 text-[11px] leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:px-2 lg:py-1.5 lg:text-sm lg:leading-normal ${
                          on ? tone.active : "text-zinc-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 hidden space-y-1 border-t border-white/10 pt-4 text-sm lg:block">
        <Link href="/app/puter" className="block rounded-lg px-2 py-1.5 text-zinc-400 hover:text-white">
          Puter model
        </Link>
        <Link href="/app/case-study" className="block rounded-lg px-2 py-1.5 text-zinc-400 hover:text-white">
          Case study
        </Link>
        <Link href="/app/qa" className="block rounded-lg px-2 py-1.5 text-zinc-400 hover:text-white">
          Operator QA
        </Link>
        <Link href="/" className="block rounded-lg px-2 py-1.5 text-zinc-400 hover:text-white">
          Public site
        </Link>
      </div>
    </nav>
  );
}
