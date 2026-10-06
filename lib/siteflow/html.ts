export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Standalone, print-friendly report document (no external assets, no scripts). */
export function reportDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#111;line-height:1.5}
h1{font-size:1.6rem;margin-bottom:.25rem}h2{font-size:1.2rem;margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.25rem}
table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid #ddd;padding:.4rem .5rem;text-align:left;vertical-align:top}
th{background:#f5f5f5}.muted{color:#666;font-size:.85rem}.ok{color:#0a7a2f}.warn{color:#9a6700}.bad{color:#b42318}
.pill{display:inline-block;border-radius:999px;padding:0 .5rem;font-size:.75rem;border:1px solid currentColor}
</style></head><body>${bodyHtml}
<p class="muted">Prepared by Sitesinc (sitesinc.co). Questions: reply to the delivery email.</p>
</body></html>`;
}
