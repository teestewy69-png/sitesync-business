import content from "@/content.json";

export default function About() {
  const { about } = content;

  return (
    <section
      id="about"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-14 text-white sm:py-16"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-4xl space-y-4 px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {about.title}
        </h2>
        {about.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-base text-slate-300">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
