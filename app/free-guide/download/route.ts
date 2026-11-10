import { guidePlainText } from "@/lib/lead-guide";

export const dynamic = "force-static";

/** The free guide as a plain-text download (same content as /free-guide and the guide email). */
export function GET() {
  return new Response(guidePlainText(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="sitesinc-7-things-make-the-phone-ring.txt"',
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=3600",
    },
  });
}
