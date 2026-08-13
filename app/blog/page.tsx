import Link from "next/link";
import { posts } from "@/data/posts";

export default function BlogIndex() {
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Sitesync Business Blog
        </h1>
        <p className="mt-3 text-sm text-slate-300 sm:text-base">
          Straightforward guides on websites, SEO, and making your small
          business site actually earn its keep.
        </p>

        <div className="mt-8 space-y-4">
          {sorted.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition hover:border-brand-400/60 hover:bg-brand-500/5"
            >
              <p className="text-[11px] text-slate-400">
                {new Date(post.date).toLocaleDateString()}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-50 sm:text-xl">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="mt-2 text-sm text-slate-300">{post.description}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-2 inline-flex text-xs font-semibold text-brand-300 hover:underline"
              >
                Read article →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
