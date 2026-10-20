# SiteGrow drafts export (format `sitegrow-drafts/v1`)

Factory flip mode exports scheduled social post **drafts** per site. It never posts or schedules anything.

Download (operator session required):
- JSON: `GET /api/factory/export?flip=<projectId>&format=sitegrow-json`
- CSV:  `GET /api/factory/export?flip=<projectId>&format=sitegrow-csv`

## JSON
```json
{ "format": "sitegrow-drafts/v1", "site": {"name": "FlipRadar", "domain": "flipradar.co"}, "importAs": "draft",
  "posts": [ {"id": "sg_001", "platform": "threads", "scheduledFor": "2026-10-20T15:00:00.000Z",
              "status": "draft", "text": "...", "link": "https://flipradar.co/tools/arv-calculator?utm_source=threads&..."} ] }
```

## CSV
Header row, UTF-8, RFC 4180 quoting: `id,site,platform,scheduled_for,status,text,link`

- `platform`: one of `threads, twitter, instagram, pinterest, facebook, linkedin` (SiteGrow platform keys; `twitter` is manual-only in SiteGrow).
- `scheduled_for`: ISO 8601 UTC. `status`: always `draft`.
- Text is trimmed to each platform's length limit including the link. Instagram posts need media attached in SiteGrow.
- Links carry `utm_source=<platform>&utm_medium=social&utm_campaign=sitegrow` so GA4 records social traffic.

Note: SiteGrow's own importer schema was not available to verify against; if it expects different column names, map them 1:1 from this file.

# Flip content generation with local Ollama

Hosted staging cannot reach a home PC's Ollama, so flip content is generated where Ollama runs and imported:

1. On Tony's PC (fresh checkout of `staging`, Node 22): `npm ci`, then
   `set LLM_BASE_URL=http://127.0.0.1:11434/v1` and `set LLM_MODEL=qwen3.8:latest`,
   `node --experimental-strip-types scripts/flip-generate-local.mjs --cities 10 --out flip-generated.json`.
   This runs the factory's own flip actions + writer against a local store (`./data`). Resumable.
2. Import into staging: `POST /api/factory/action` `{op:"flip-import-generated", projectId, pages:"<JSON array>"}`.
   Staging re-checks every page (900-1,500 words; no NBA/props/PropCheck/Sitesinc/betting text) and stores them as
   drafts `pending_approval` (or `needs_fix`). Nothing is published.

`LLM_BASE_URL` + `LLM_MODEL` (optional `LLM_API_KEY`) make the factory LLM client use any OpenAI-compatible server
first; OpenRouter/OpenAI/... keys remain the fallback when unset. `LLM_TIMEOUT_MS` (default 900000) for slow local models.
