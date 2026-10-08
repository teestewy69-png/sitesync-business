// Test-only ESM resolve hook: lets `node --test` (Node >= 22.18 type stripping) import repo TypeScript that
// uses extensionless relative imports and the "@/..." path alias, exactly as Next/tsc resolve them.
// Register with: register("./fixtures/ts-resolver.mjs", import.meta.url)
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXTS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function tryFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTS) if (existsSync(base + ext)) return base + ext;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parent = fileURLToPath(context.parentURL);
    if (/\.(ts|tsx|mts)$/.test(parent) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier)) base = path.resolve(path.dirname(parent), specifier);
  }
  // Next's subpath entry points ("next/server", "next/headers") are CommonJS files without an exports map.
  if (/^next\/[a-z-]+$/.test(specifier)) return nextResolve(`${specifier}.js`, context);
  if (base) {
    const file = tryFile(base);
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
