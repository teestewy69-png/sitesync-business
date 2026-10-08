import type { ReactNode } from "react";
import s from "@/components/city-launch/city-landing.module.css";

/** Renders an approved workspace page body (plain text with light markdown: #/##/### headings, "- " lists). */
export default function Prose({ body, skipFirstH1 = true }: { body: string; skipFirstH1?: boolean }) {
  const out: ReactNode[] = [];
  const lines = body.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: string[] = [];
  let skipped = !skipFirstH1;
  const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").trim();
  const flush = () => {
    if (para.length) out.push(<p key={`p${out.length}`}>{clean(para.join(" "))}</p>);
    if (list.length) out.push(<ul key={`u${out.length}`}>{list.map((li, i) => <li key={i}>{clean(li)}</li>)}</ul>);
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      if (h[1].length === 1 && !skipped) {
        skipped = true;
        continue;
      }
      out.push(h[1].length <= 2 ? <h2 key={`h${out.length}`} className={s.h2}>{clean(h[2])}</h2> : <h3 key={`h${out.length}`}>{clean(h[2])}</h3>);
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) {
      if (para.length) {
        out.push(<p key={`p${out.length}`}>{clean(para.join(" "))}</p>);
        para = [];
      }
      list.push(li[1]);
      continue;
    }
    if (list.length) flush();
    para.push(line);
  }
  flush();
  return <div className={s.prose}>{out}</div>;
}
