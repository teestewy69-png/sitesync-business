/**
 * Minimal, safe structure for factory draft bodies (plain text with "#"/"##"/"###" headings and "- " lists).
 * Not a full Markdown parser: no HTML, links or inline formatting - text is rendered as text.
 */
export type DraftBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[] };

export function parseDraftBlocks(body: string): DraftBlock[] {
  const blocks: DraftBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", lines: para });
    if (list.length) blocks.push({ type: "list", items: list });
    para = [];
    list = [];
  };
  for (const raw of String(body || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      continue;
    }
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    if (item) {
      if (para.length) {
        blocks.push({ type: "paragraph", lines: para });
        para = [];
      }
      list.push(item[1].trim());
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
