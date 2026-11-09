#!/usr/bin/env node
/**
 * Local Factory sync CLI. See docs/FACTORY_SYNC.md.
 *
 *   node scripts/factory-sync/sync.mjs --reason=scheduled|launch|manual
 *   node scripts/factory-sync/sync.mjs --status
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defaultBackupDir, DEFAULT_REPO_DIR_WIN, EXIT, exitCodeFor, runSync } from "./lib.mjs";

function argValue(argv, name) {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  return "";
}

function loadLocalConfig(repoRoot) {
  const file = path.join(repoRoot, "scripts", "factory-sync", "windows", "local-config.json");
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data || typeof data !== "object") return {};
    return {
      repoRoot: typeof data.repoRoot === "string" ? data.repoRoot : "",
      backupDir: typeof data.backupDir === "string" ? data.backupDir : "",
    };
  } catch {
    return {};
  }
}

export function parseCli(argv = process.argv.slice(2)) {
  const statusOnly = argv.includes("--status");
  const reasonRaw = argValue(argv, "reason") || (statusOnly ? "status" : "manual");
  const reason = ["scheduled", "launch", "manual", "status"].includes(reasonRaw) ? reasonRaw : "manual";
  return {
    statusOnly,
    reason,
    repoRoot: argValue(argv, "repo") || "",
    backupDir: argValue(argv, "backup-dir") || "",
  };
}

export async function main(argv = process.argv.slice(2)) {
  const cli = parseCli(argv);
  const cwd = process.cwd();
  const local = loadLocalConfig(cwd);
  const repoRoot = cli.repoRoot || local.repoRoot || cwd || (process.platform === "win32" ? DEFAULT_REPO_DIR_WIN : cwd);
  const backupDir = cli.backupDir || process.env.FACTORY_BACKUP_DIR || local.backupDir || defaultBackupDir() || path.join(repoRoot, ".factory-backups");

  if (cli.statusOnly) {
    const file = path.join(backupDir, "status.json");
    if (!fs.existsSync(file)) {
      console.log(`No status yet. Expected ${file}`);
      return EXIT.OK;
    }
    const raw = fs.readFileSync(file, "utf8");
    console.log(raw.trim());
    try {
      const data = JSON.parse(raw);
      console.log(`\ncodeInSync=${Boolean(data.codeInSync)} envDataParity=${data.envDataParity || "local-only"}`);
    } catch {
      /* printed raw */
    }
    return EXIT.OK;
  }

  const result = await runSync({ repoRoot, backupDir, reason: cli.reason });
  const line = `[factory-sync] ${result.codeSync} codeInSync=${result.codeInSync} local=${result.localHead.slice(0, 12)} production=${result.productionCommit.slice(0, 12)}`;
  console.log(line);
  if (result.message) console.log(result.message);
  if (result.envDataNote) console.log(result.envDataNote);
  const pending = path.join(backupDir, "PENDING-SYNC.txt");
  if (result.pendingSync && fs.existsSync(pending)) console.log(`Pending: ${pending}`);
  console.log(`Status: ${path.join(backupDir, "status.json")}`);
  return exitCodeFor(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.message : "unknown");
      process.exit(EXIT.ERROR);
    }
  );
}
