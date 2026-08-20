"use client";

import { usePathname, useRouter } from "next/navigation";
import { scrollToId } from "@/lib/scroll";

export default function WebsiteFactoryHeader() {
  const pathname = usePathname();
  const router = useRouter();

  function go(id: string) {
    if (pathname === "/") {
      scrollToId(id);
      return;
    }
    router.push(`/#${id}`);
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Website Factory</h1>
        <p className="text-xs text-slate-400">
          Create projects, generate sites, then audit and optimize them with the
          SEO Intelligence engine.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => go("pick-design")}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500"
        >
          New Project
        </button>
        <button
          type="button"
          onClick={() => go("designs")}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
        >
          View Sites
        </button>
      </div>
    </div>
  );
}
