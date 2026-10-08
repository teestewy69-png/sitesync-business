import { Fragment } from "react";
import { parseDraftBlocks } from "@/lib/factory/draft-blocks";

/** Renders a factory draft body with real headings, paragraphs and lists (text only, no HTML injection). */
export default function DraftBody({ body, className = "" }: { body: string; className?: string }) {
  const blocks = parseDraftBlocks(body);
  return (
    <article className={`space-y-4 text-base leading-relaxed text-zinc-200 ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level === 3) {
            return (
              <h4 key={index} className="pt-1 text-lg font-semibold text-white">
                {block.text}
              </h4>
            );
          }
          // The page already has its own <h1>; draft "#"/"##" become section headings.
          return (
            <h2 key={index} className="pt-3 text-2xl font-semibold tracking-tight text-white">
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </p>
        );
      })}
    </article>
  );
}
