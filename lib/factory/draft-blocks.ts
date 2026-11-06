/**
 * Minimal, safe structure for factory draft bodies (plain text with "#"/"##"/"###" headings and "- "/numbered lists).
 * Not a full Markdown parser: no HTML, links or inline formatting - text is rendered as text.
 */
export type DraftBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[]; ordered?: boolean };

export function parseDraftBlocks(body: string): DraftBlock[] {
  const blocks: DraftBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let listOrdered = false;
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", lines: para });
    if (list.length) {
      blocks.push(listOrdered ? { type: "list", items: list, ordered: true } : { type: "list", items: list });
    }
    para = [];
    list = [];
    listOrdered = false;
  };
  for (const raw of String(body || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      continue;
    }
    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      if (para.length) {
        blocks.push({ type: "paragraph", lines: para });
        para = [];
      }
      if (list.length && listOrdered) {
        blocks.push({ type: "list", items: list, ordered: true });
        list = [];
        listOrdered = false;
      }
      list.push(unordered[1].trim());
      continue;
    }
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      if (para.length) {
        blocks.push({ type: "paragraph", lines: para });
        para = [];
      }
      if (list.length && !listOrdered) {
        blocks.push({ type: "list", items: list });
        list = [];
      }
      listOrdered = true;
      list.push(ordered[1].trim());
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list.length) {
      blocks.push(listOrdered ? { type: "list", items: list, ordered: true } : { type: "list", items: list });
      list = [];
      listOrdered = false;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
