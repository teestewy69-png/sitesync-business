/**
 * Local Website Factory backup + sync.
 *
 * Fast-forwards the local git checkout to the EXACT commit published on
 * https://sitesinc.co (from /release.json), never to origin/master blindly.
 *
 * Safety: no reset --hard, no stash, no git clean, no force push, no push, no
 * deploy. Fail closed. Preserve .env.local, data/factory, data/store, untracked files.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

export const PRODUCTION_RELEASE_SCHEMA = "sitesinc-production-release/v1";
export const PRODUCTION_RELEASE_SITE = "sitesinc.co";
export const PRODUCTION_MANIFEST_URL = "https://sitesinc.co/release.json";
export const PRODUCTION_SITE_ID = "e4f05aab-7228-4962-87c3-2035218d94db";
export const PRODUCTION_SITE_NAME = "sitesyncllc";
export const PRODUCTION_COMMIT_RE = /^[0-9a-f]{40}$/;
export const EXPECTED_REMOTE_HOSTS = ["github.com"];
export const EXPECTED_REMOTE_PATH = "teestewy69-png/sitesync-business";
export const CODE_RETENTION = 10;
export const LOCK_STALE_MS = 45 * 60 * 1000;
export const MANIFEST_MAX_BYTES = 4096;
export const FACTORY_HOST = "127.0.0.1";
export const FACTORY_PORT = 3000;
export const DEFAULT_BACKUP_DIR_WIN = "C:\\Users\\Vero2\\factory-backups";
export const DEFAULT_REPO_DIR_WIN = "C:\\Users\\Vero2\\Sitesinc-Factory";
export const CODE_BACKUP_NAME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z_[0-9a-f]{7,40}$/;
export const PROTECTED_PATHS = [
  ".env",
  ".env.local",
  "data/factory",
  "data/store",
  "data/siteflow",
  "data/private",
  "Attachments",
];

export const EXIT = {
  OK: 0,
  ERROR: 1,
  BLOCKED: 2,
  LOCK: 3,
  ALREADY_RUNNING: 10,
};

export class FailClosedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FailClosedError";
    this.code = code;
  }
}

export function defaultBackupDir() {
  if (process.env.FACTORY_BACKUP_DIR) return process.env.FACTORY_BACKUP_DIR;
  if (process.platform === "win32") return DEFAULT_BACKUP_DIR_WIN;
  return "";
}

export function utcStamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}

export function shortSha(sha) {
  return String(sha || "").slice(0, 12);
}

/** Parse git remote URL; never execute it. Host + path only. */
export function parseGitRemote(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/[\r\n\0]/.test(value)) return null;
  let host = "";
  let pathname = "";
  if (/^https?:\/\//i.test(value) || value.startsWith("ssh://")) {
    try {
      const u = new URL(value);
      host = (u.hostname || "").toLowerCase();
      pathname = u.pathname || "";
    } catch {
      return null;
    }
  } else {
    const scp = value.match(/^git@([^:]+):(.+)$/);
    if (!scp) return null;
    host = scp[1].toLowerCase();
    pathname = scp[2];
  }
  pathname = pathname.replace(/^\/+/, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  if (host === "github.com" && pathname.startsWith("github.com/")) {
    pathname = pathname.slice("github.com/".length);
  }
  if (!host || !pathname || pathname.includes("..")) return null;
  return { host, path: pathname.toLowerCase() };
}

export function assertKnownOrigin(raw, expected = { hosts: EXPECTED_REMOTE_HOSTS, path: EXPECTED_REMOTE_PATH }) {
  const parsed = parseGitRemote(raw);
  if (!parsed) throw new FailClosedError("blocked_origin", "origin remote URL is missing or not a git URL.");
  const hosts = (expected.hosts || EXPECTED_REMOTE_HOSTS).map((h) => h.toLowerCase());
  if (!hosts.includes(parsed.host)) {
    throw new FailClosedError("blocked_origin", `origin host '${parsed.host}' is not the known Sitesinc repo host.`);
  }
  if (parsed.path !== expected.path.toLowerCase()) {
    throw new FailClosedError("blocked_origin", `origin path '${parsed.path}' is not the known Sitesinc repo.`);
  }
  return parsed;
}

/**
 * Untrusted web body → allowlisted {commit, publishedAt} only.
 * Extra keys (remote, command, url, script, target, git) are ignored, never followed.
 */
export function parseProductionManifest(text, { maxBytes = MANIFEST_MAX_BYTES } = {}) {
  if (text == null) throw new FailClosedError("manifest_missing", "Production release metadata is absent.");
  const raw = typeof text === "string" ? text : String(text);
  if (!raw.trim()) throw new FailClosedError("manifest_missing", "Production release metadata is empty.");
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new FailClosedError("manifest_invalid", "Production release metadata is too large.");
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new FailClosedError("manifest_invalid", "Production release metadata is not JSON.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new FailClosedError("manifest_invalid", "Production release metadata is not an object.");
  }
  if (data.present === false) {
    throw new FailClosedError("manifest_missing", "Production release metadata is not published on this build.");
  }
  if (data.schema !== PRODUCTION_RELEASE_SCHEMA) {
    throw new FailClosedError("manifest_invalid", "Production release metadata has an unknown schema.");
  }
  if (data.context != null && data.context !== "production") {
    throw new FailClosedError("manifest_invalid", "Release metadata is not a production context.");
  }
  if (data.site != null && String(data.site).toLowerCase() !== PRODUCTION_RELEASE_SITE) {
    throw new FailClosedError("manifest_invalid", "Release metadata site is not sitesinc.co.");
  }
  const commit = String(data.commit || "").trim().toLowerCase();
  if (!PRODUCTION_COMMIT_RE.test(commit)) {
    throw new FailClosedError("manifest_invalid", "Production commit is not a 40-character lowercase git SHA.");
  }
  const publishedAt = typeof data.publishedAt === "string" && data.publishedAt.trim() ? data.publishedAt.trim() : "";
  return { commit, publishedAt, schema: PRODUCTION_RELEASE_SCHEMA, site: PRODUCTION_RELEASE_SITE, context: "production" };
}

export function isProtectedPath(relPath) {
  const n = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  return PROTECTED_PATHS.some((p) => n === p || n.startsWith(`${p}/`));
}

export function parsePorcelain(text) {
  const dirtyTracked = [];
  const untracked = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line) continue;
    const code = line.slice(0, 2);
    const file = line.slice(3).replace(/\\/g, "/");
    if (code === "??") untracked.push(file);
    else if (code !== "!!") dirtyTracked.push(file);
  }
  return { dirtyTracked, untracked };
}

export function collidingUntracked(untracked, incomingPaths) {
  const set = new Set((incomingPaths || []).map((p) => p.replace(/\\/g, "/")));
  return (untracked || []).filter((p) => set.has(p.replace(/\\/g, "/")));
}

export function classifyUpdate(head, productionSha, { headIsAncestorOfProd, prodIsAncestorOfHead }) {
  const a = String(head || "").toLowerCase();
  const b = String(productionSha || "").toLowerCase();
  if (!PRODUCTION_COMMIT_RE.test(a) || !PRODUCTION_COMMIT_RE.test(b)) {
    throw new FailClosedError("error", "HEAD or production SHA failed format checks.");
  }
  if (a === b) return "no_change";
  if (headIsAncestorOfProd) return "can_ff";
  if (prodIsAncestorOfHead) return "blocked_ahead";
  return "blocked_diverged";
}

export const LOCKFILE_NAMES = ["package-lock.json", "npm-shrinkwrap.json"];
export const PACKAGE_DEP_KEYS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundleDependencies",
  "bundledDependencies",
  "overrides",
  "workspaces",
  "packageManager",
];

function tryJsonObject(text) {
  try {
    const data = JSON.parse(String(text || ""));
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** True when install-affecting package.json fields differ. Scripts-only edits do not count. */
export function packageDependencyFieldsChanged(oldText, newText) {
  const oldPkg = tryJsonObject(oldText);
  const newPkg = tryJsonObject(newText);
  if (!oldPkg || !newPkg) return true;
  for (const key of PACKAGE_DEP_KEYS) {
    if (JSON.stringify(oldPkg[key] ?? null) !== JSON.stringify(newPkg[key] ?? null)) return true;
  }
  return false;
}

/**
 * npm ci is needed only when the lockfile changed, or package.json dependency fields changed.
 * A scripts-only package.json edit (the 79f4363→8d2afc9 case) is not an install change.
 */
export function depsInstallNeeded(changedFiles, oldPackageJson = "", newPackageJson = "") {
  const files = (changedFiles || []).map((f) => String(f).replace(/\\/g, "/"));
  if (files.some((f) => LOCKFILE_NAMES.includes(f))) {
    return { needed: true, reason: "package-lock.json" };
  }
  if (files.includes("package.json") && packageDependencyFieldsChanged(oldPackageJson, newPackageJson)) {
    return { needed: true, reason: "package.json dependencies" };
  }
  return { needed: false, reason: "unchanged" };
}

export function npmOutputTail(stdout, stderr, { maxLines = 30, maxChars = 4000 } = {}) {
  const text = [stderr, stdout]
    .filter((s) => s && String(s).trim())
    .map((s) => String(s).replace(/\r\n/g, "\n"))
    .join("\n")
    .trim();
  if (!text) return "npm ci failed with no output";
  const lines = text.split("\n");
  const sliced = lines.length > maxLines ? lines.slice(-maxLines) : lines;
  let out = sliced.join("\n");
  if (out.length > maxChars) out = out.slice(-maxChars);
  return out;
}

export function depsFailureMessage({ productionSha, factoryRunning }) {
  const short = shortSha(productionSha);
  const server = factoryRunning
    ? "Factory still appears to be listening on 127.0.0.1:3000. Stop it first — Windows often locks node_modules while next dev is running — then run Sync Factory Now or `npm ci` in the repo."
    : "If next dev was running, stop Factory first (Windows often locks node_modules while the server holds files), then run `npm ci` in the repo or Sync Factory Now. Sync is supposed to defer the git update while 127.0.0.1:3000 is listening; if git already moved, check that the server was actually stopped before this run.";
  return `Code fast-forwarded to production ${short} (git is current; codeInSync is true). npm ci failed, so node_modules may be stale. ${server} npm error tail is in factory-backups\\logs\\factory-sync.log. Do not reset. No push or deploy was attempted.`;
}

function gitFileAt(repo, sha, file, opts) {
  if (!PRODUCTION_COMMIT_RE.test(sha)) return "";
  if (!/^[A-Za-z0-9._/-]+$/.test(file) || file.includes("..")) return "";
  const out = git(repo, ["show", `${sha}:${file}`], opts);
  if (out.status !== 0) return "";
  return out.stdout || "";
}

export function selectCodeBackupsToPrune(entries, keep = CODE_RETENTION) {
  const eligible = (entries || []).filter(
    (e) => e && e.isDirectory && e.hasVerifiedOk && CODE_BACKUP_NAME_RE.test(e.name)
  );
  eligible.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  return eligible.slice(Math.max(0, keep)).map((e) => e.name);
}

export function git(repo, args, { gitRunner } = {}) {
  if (gitRunner) return gitRunner(repo, args);
  const result = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw new FailClosedError("error", `git ${args[0]} failed to start: ${result.error.message}`);
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

export function gitOk(repo, args, opts) {
  const out = git(repo, args, opts);
  if (out.status !== 0) {
    const err = (out.stderr || out.stdout || "").trim().split(/\r?\n/)[0] || `git ${args[0]} exited ${out.status}`;
    throw new FailClosedError("error", err);
  }
  return (out.stdout || "").trim();
}

export function currentHead(repo, opts) {
  const sha = gitOk(repo, ["rev-parse", "HEAD"], opts).toLowerCase();
  if (!PRODUCTION_COMMIT_RE.test(sha)) throw new FailClosedError("error", "Local HEAD is not a 40-character SHA.");
  return sha;
}

function originUrl(repo, opts) {
  return gitOk(repo, ["remote", "get-url", "origin"], opts);
}

export function isAncestor(repo, ancestor, descendant, opts) {
  const out = git(repo, ["merge-base", "--is-ancestor", ancestor, descendant], opts);
  return out.status === 0;
}

export async function fetchProductionManifest({
  fetchImpl = globalThis.fetch,
  url = PRODUCTION_MANIFEST_URL,
  timeoutMs = 15000,
} = {}) {
  if (!fetchImpl) throw new FailClosedError("network_failure", "fetch is not available.");
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new FailClosedError("network_failure", "Production manifest URL is invalid.");
  }
  if (parsedUrl.protocol !== "https:") throw new FailClosedError("network_failure", "Production manifest must be HTTPS.");
  const allowed = new Set(["sitesinc.co", "www.sitesinc.co"]);
  if (!allowed.has(parsedUrl.hostname.toLowerCase())) {
    throw new FailClosedError("network_failure", "Production manifest host is not sitesinc.co.");
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(parsedUrl.href, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: { accept: "application/json", "user-agent": "sitesinc-factory-sync/1" },
    });
  } catch (err) {
    const msg = err && err.name === "AbortError" ? "Production manifest request timed out." : "Could not reach production release metadata.";
    throw new FailClosedError("network_failure", msg);
  } finally {
    clearTimeout(timer);
  }
  const finalUrl = String(res.url || parsedUrl.href);
  let finalHost = parsedUrl.hostname;
  try {
    finalHost = new URL(finalUrl).hostname.toLowerCase();
  } catch {
    throw new FailClosedError("network_failure", "Production manifest redirected to an invalid URL.");
  }
  if (!allowed.has(finalHost)) {
    throw new FailClosedError("network_failure", "Production manifest redirected off sitesinc.co.");
  }
  if (res.status === 404) throw new FailClosedError("manifest_missing", "Production release metadata is not published yet (HTTP 404).");
  if (!res.ok) throw new FailClosedError("network_failure", `Production release metadata HTTP ${res.status}.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MANIFEST_MAX_BYTES) throw new FailClosedError("manifest_invalid", "Production release metadata is too large.");
  return parseProductionManifest(buf.toString("utf8"));
}

export async function probeFactoryPort(host = FACTORY_HOST, port = FACTORY_PORT, { timeoutMs = 400 } = {}) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export function pidAlive(pid) {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

export function lockPath(backupDir) {
  return path.join(backupDir, "factory-sync.lock");
}

export function acquireLock(backupDir, { pid = process.pid, now = Date.now(), reason = "sync" } = {}) {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = lockPath(backupDir);
  const payload = `pid=${pid}\nstartedAt=${new Date(now).toISOString()}\nreason=${reason}\n`;
  try {
    fs.writeFileSync(file, payload, { flag: "wx", encoding: "utf8" });
    return { ok: true, file };
  } catch (err) {
    if (err && err.code !== "EEXIST") throw err;
  }
  let existing = "";
  try {
    existing = fs.readFileSync(file, "utf8");
  } catch {
    existing = "";
  }
  const foundPid = Number((existing.match(/^pid=(\d+)/m) || [])[1] || 0);
  const startedAt = Date.parse((existing.match(/^startedAt=(\S+)/m) || [])[1] || "") || 0;
  const stale = !pidAlive(foundPid) || (startedAt && now - startedAt > LOCK_STALE_MS);
  if (!stale) return { ok: false, file, pid: foundPid };
  try {
    fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
  fs.writeFileSync(file, payload, { flag: "wx", encoding: "utf8" });
  return { ok: true, file, stolen: true };
}

export function releaseLock(backupDir) {
  try {
    fs.unlinkSync(lockPath(backupDir));
  } catch {
    /* ignore */
  }
}

async function listRelFiles(root) {
  const out = [];
  async function walk(dir, prefix) {
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err && err.code === "ENOENT") return;
      throw err;
    }
    for (const ent of entries) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(full, rel);
      else if (ent.isFile()) {
        const st = await fs.promises.stat(full);
        out.push({ rel, size: st.size });
      }
    }
  }
  await walk(root, "");
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

export async function copyDirVerified(src, dest) {
  const srcFiles = await listRelFiles(src);
  if (!srcFiles.length && !fs.existsSync(src)) return { copied: 0, skipped: true };
  await fs.promises.cp(src, dest, { recursive: true, force: false, errorOnExist: true });
  const destFiles = await listRelFiles(dest);
  if (srcFiles.length !== destFiles.length) {
    throw new FailClosedError("backup_failed", `Backup file count mismatch for ${path.basename(src)}.`);
  }
  for (let i = 0; i < srcFiles.length; i += 1) {
    if (srcFiles[i].rel !== destFiles[i].rel || srcFiles[i].size !== destFiles[i].size) {
      throw new FailClosedError("backup_failed", `Backup verification mismatch for ${srcFiles[i].rel}.`);
    }
  }
  return { copied: srcFiles.length, skipped: false };
}

export function restrictSecretPath(target) {
  try {
    if (fs.statSync(target).isDirectory()) fs.chmodSync(target, 0o700);
    else fs.chmodSync(target, 0o600);
  } catch {
    /* chmod is best-effort on Windows */
  }
  if (process.platform !== "win32") return;
  const user = process.env.USERNAME || os.userInfo().username;
  const icacls = spawnSync(
    "icacls",
    [target, "/inheritance:r", "/grant:r", `${user}:(OI)(CI)F`, "/grant:r", "SYSTEM:(OI)(CI)F"],
    { encoding: "utf8", windowsHide: true }
  );
  if (icacls.status !== 0) {
    throw new FailClosedError("backup_failed", "Could not restrict permissions on the secrets backup.");
  }
}

function sha256File(file) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

export function writeStatus(backupDir, status) {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, "status.json");
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(status, null, 2)}\n`, { encoding: "utf8", mode: 0o644 });
  fs.renameSync(tmp, file);
  const pending = path.join(backupDir, "PENDING-SYNC.txt");
  if (status.pendingSync) {
    fs.writeFileSync(
      pending,
      [
        "Sitesinc Factory pending production sync",
        `checkedAt: ${status.checkedAt}`,
        `localHead: ${status.localHead || ""}`,
        `productionCommit: ${status.productionCommit || ""}`,
        `codeSync: ${status.codeSync}`,
        status.message || "",
        "",
        "Code-in-sync is separate from env/data. Local .env.local and data/factory + data/store are not production secrets.",
        "",
      ].join("\n"),
      "utf8"
    );
  } else if (fs.existsSync(pending)) {
    try {
      fs.unlinkSync(pending);
    } catch {
      /* ignore */
    }
  }
  return file;
}

export function appendLog(backupDir, line) {
  const dir = path.join(backupDir, "logs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "factory-sync.log");
  try {
    const st = fs.existsSync(file) ? fs.statSync(file) : null;
    if (st && st.size > 2 * 1024 * 1024) {
      const rotated = path.join(dir, "factory-sync.1.log");
      try {
        fs.unlinkSync(rotated);
      } catch {
        /* ignore */
      }
      fs.renameSync(file, rotated);
    }
  } catch {
    /* ignore */
  }
  fs.appendFileSync(file, `${line}\n`, "utf8");
}

function logLine(now, code, message) {
  return `${new Date(now).toISOString()} ${code} ${String(message || "").replace(/\s+/g, " ").trim()}`;
}

export async function backupBeforeUpdate({
  repo,
  backupDir,
  head,
  now,
  gitOpts,
  createBundle,
}) {
  const stamp = `${utcStamp(new Date(now))}_${shortSha(head)}`;
  const codeDir = path.join(backupDir, "code", stamp);
  const secretsDir = path.join(backupDir, "secrets", stamp);
  const dataDir = path.join(backupDir, "data", stamp);
  fs.mkdirSync(codeDir, { recursive: true });
  fs.writeFileSync(path.join(codeDir, "HEAD.txt"), `${head}\n`, "utf8");
  const bundle = path.join(codeDir, "repo.bundle");
  if (createBundle) await createBundle(bundle);
  else {
    gitOk(repo, ["bundle", "create", bundle, "HEAD"], gitOpts);
  }
  if (!fs.existsSync(bundle) || fs.statSync(bundle).size < 32) {
    throw new FailClosedError("backup_failed", "Code bundle was not created.");
  }
  const verified = git(repo, ["bundle", "verify", bundle], gitOpts);
  if (verified.status !== 0) throw new FailClosedError("backup_failed", "Code bundle failed git bundle verify.");
  fs.writeFileSync(path.join(codeDir, "SHA256.txt"), `${sha256File(bundle)}  repo.bundle\n`, "utf8");
  fs.writeFileSync(path.join(codeDir, "verified.ok"), "ok\n", "utf8");

  fs.mkdirSync(secretsDir, { recursive: true });
  restrictSecretPath(secretsDir);
  const envLocal = path.join(repo, ".env.local");
  let secretsCopied = 0;
  if (fs.existsSync(envLocal) && fs.statSync(envLocal).isFile()) {
    const dest = path.join(secretsDir, ".env.local");
    fs.copyFileSync(envLocal, dest);
    const a = fs.statSync(envLocal).size;
    const b = fs.statSync(dest).size;
    if (a !== b) throw new FailClosedError("backup_failed", ".env.local backup size mismatch.");
    restrictSecretPath(dest);
    secretsCopied = 1;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const factorySrc = path.join(repo, "data", "factory");
  const storeSrc = path.join(repo, "data", "store");
  const factory = await copyDirVerified(factorySrc, path.join(dataDir, "factory")).catch((err) => {
    if (err && err.code === "ENOENT") return { copied: 0, skipped: true };
    throw err;
  });
  const store = await copyDirVerified(storeSrc, path.join(dataDir, "store")).catch((err) => {
    if (err && err.code === "ENOENT") return { copied: 0, skipped: true };
    throw err;
  });

  return {
    stamp,
    codeDir,
    secretsDir,
    dataDir,
    secretsCopied,
    factoryCopied: factory.copied || 0,
    storeCopied: store.copied || 0,
  };
}

export async function pruneCodeBackups(backupDir, keep = CODE_RETENTION) {
  const codeRoot = path.join(backupDir, "code");
  let names = [];
  try {
    names = await fs.promises.readdir(codeRoot, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  const entries = [];
  for (const ent of names) {
    const hasVerifiedOk = ent.isDirectory() && fs.existsSync(path.join(codeRoot, ent.name, "verified.ok"));
    entries.push({ name: ent.name, isDirectory: ent.isDirectory(), hasVerifiedOk });
  }
  const prune = selectCodeBackupsToPrune(entries, keep);
  for (const name of prune) {
    await fs.promises.rm(path.join(codeRoot, name), { recursive: true, force: false });
  }
  return prune;
}

function envDataNote() {
  return "Local .env.local and data/factory + data/store stay on this PC. They are not production Netlify env vars or production CRM/blob data. codeInSync is git-only.";
}

function statusBase({ now, reason, head, productionCommit, codeSync, message, extra }) {
  const codeInSync = Boolean(head && productionCommit && head === productionCommit);
  const okCodes = new Set(["in_sync", "updated", "no_change", "deferred_factory_running", "lock_held"]);
  return {
    schema: "sitesinc-factory-sync-status/v1",
    checkedAt: new Date(now).toISOString(),
    reason,
    ok: okCodes.has(codeSync),
    codeInSync,
    codeSync,
    localHead: head || "",
    productionCommit: productionCommit || "",
    envDataParity: "local-only",
    envDataNote: envDataNote(),
    pendingSync: codeSync === "deferred_factory_running",
    message,
    ...extra,
  };
}

export async function runSync(opts = {}) {
  const now = opts.now || Date.now();
  const reason = opts.reason || "manual";
  const repo = path.resolve(opts.repoRoot || process.cwd());
  const backupDir = path.resolve(opts.backupDir || defaultBackupDir() || path.join(os.tmpdir(), "factory-backups"));
  const gitOpts = { gitRunner: opts.gitRunner };
  const factoryHost = opts.factoryHost || FACTORY_HOST;
  const factoryPort = opts.factoryPort || FACTORY_PORT;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const manifestUrl = opts.manifestUrl || PRODUCTION_MANIFEST_URL;
  const verifyOrigin = opts.verifyOrigin || ((url) => assertKnownOrigin(url));
  const probe = opts.factoryProbe || (() => probeFactoryPort(factoryHost, factoryPort));
  const keep = opts.retainCodeVersions ?? CODE_RETENTION;

  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(path.join(backupDir, "code"), { recursive: true });
  fs.mkdirSync(path.join(backupDir, "secrets"), { recursive: true });
  fs.mkdirSync(path.join(backupDir, "data"), { recursive: true });
  fs.mkdirSync(path.join(backupDir, "logs"), { recursive: true });
  restrictSecretPath(path.join(backupDir, "secrets"));

  const finish = (status, exitCode) => {
    const full = statusBase({ now, reason, head: status.localHead, productionCommit: status.productionCommit, codeSync: status.codeSync, message: status.message, extra: status });
    writeStatus(backupDir, full);
    appendLog(backupDir, logLine(now, full.codeSync, full.message));
    if (status.npmErrorTail) {
      appendLog(backupDir, `${new Date(now).toISOString()} npm_ci_output\n${status.npmErrorTail}`);
    }
    return { ...full, exitCode, backupDir };
  };

  const lock = acquireLock(backupDir, { pid: opts.pid || process.pid, now, reason });
  if (!lock.ok) {
    return finish(
      {
        codeSync: "lock_held",
        message: `Another Factory sync is running (pid ${lock.pid}). Overlapping runs are refused.`,
        localHead: "",
        productionCommit: "",
      },
      EXIT.LOCK
    );
  }

  try {
    let head = "";
    try {
      head = currentHead(repo, gitOpts);
    } catch (err) {
      return finish({ codeSync: "error", message: err.message, localHead: "", productionCommit: "" }, EXIT.ERROR);
    }

    let origin;
    try {
      origin = originUrl(repo, gitOpts);
      verifyOrigin(origin);
    } catch (err) {
      return finish({ codeSync: "blocked_origin", message: err.message, localHead: head, productionCommit: "" }, EXIT.ERROR);
    }

    let release;
    try {
      release = await fetchProductionManifest({ fetchImpl, url: manifestUrl, timeoutMs: opts.timeoutMs });
    } catch (err) {
      const code = err instanceof FailClosedError ? err.code : "network_failure";
      const exitCode = code === "manifest_missing" || code === "manifest_invalid" || code === "network_failure" ? EXIT.ERROR : EXIT.ERROR;
      return finish({ codeSync: code, message: err.message, localHead: head, productionCommit: "" }, exitCode);
    }

    const productionSha = release.commit;
    const fetchOut = git(repo, ["fetch", "origin"], gitOpts);
    if (fetchOut.status !== 0) {
      return finish(
        { codeSync: "network_failure", message: "git fetch origin failed. No local update was attempted.", localHead: head, productionCommit: productionSha },
        EXIT.ERROR
      );
    }

    const cat = git(repo, ["cat-file", "-t", productionSha], gitOpts);
    if (cat.status !== 0 || (cat.stdout || "").trim() !== "commit") {
      return finish(
        { codeSync: "manifest_invalid", message: "Production SHA is not a commit in the known origin after git fetch origin.", localHead: head, productionCommit: productionSha },
        EXIT.ERROR
      );
    }
    if (!isAncestor(repo, productionSha, "origin/master", gitOpts)) {
      return finish(
        { codeSync: "manifest_invalid", message: "Production SHA is not an ancestor of origin/master. Refusing an unpublished or unrelated commit.", localHead: head, productionCommit: productionSha },
        EXIT.ERROR
      );
    }

    const porcelain = gitOk(repo, ["status", "--porcelain=v1"], gitOpts);
    const { dirtyTracked, untracked } = parsePorcelain(porcelain);
    if (dirtyTracked.length) {
      return finish(
        {
          codeSync: "blocked_dirty",
          message: `Tracked local edits present (${dirtyTracked.slice(0, 8).join(", ")}). Sync stopped; nothing was reset, stashed, or discarded.`,
          localHead: head,
          productionCommit: productionSha,
          dirtyTracked,
        },
        EXIT.BLOCKED
      );
    }

    const incoming = gitOk(repo, ["diff", "--name-only", "HEAD", productionSha], gitOpts)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const protectedHits = incoming.filter(isProtectedPath);
    if (protectedHits.length) {
      return finish(
        {
          codeSync: "blocked_protected_path",
          message: `Incoming production commit would touch protected local paths (${protectedHits.join(", ")}).`,
          localHead: head,
          productionCommit: productionSha,
        },
        EXIT.BLOCKED
      );
    }
    const collisions = collidingUntracked(untracked, incoming);
    if (collisions.length) {
      return finish(
        {
          codeSync: "blocked_untracked_collision",
          message: `Untracked files would be overwritten (${collisions.slice(0, 8).join(", ")}). Sync stopped.`,
          localHead: head,
          productionCommit: productionSha,
          collisions,
        },
        EXIT.BLOCKED
      );
    }

    const headIsAncestorOfProd = head === productionSha || isAncestor(repo, head, productionSha, gitOpts);
    const prodIsAncestorOfHead = head === productionSha || isAncestor(repo, productionSha, head, gitOpts);
    const plan = classifyUpdate(head, productionSha, { headIsAncestorOfProd, prodIsAncestorOfHead });

    if (plan === "blocked_ahead") {
      return finish(
        {
          codeSync: "blocked_ahead",
          message: "Local HEAD is ahead of published production. Automatic sync only fast-forwards; it will not reset backward.",
          localHead: head,
          productionCommit: productionSha,
        },
        EXIT.BLOCKED
      );
    }
    if (plan === "blocked_diverged") {
      return finish(
        {
          codeSync: "blocked_diverged",
          message: "Local history has diverged from published production. Automatic sync stopped (no reset, stash, or force).",
          localHead: head,
          productionCommit: productionSha,
        },
        EXIT.BLOCKED
      );
    }

    if (plan === "no_change") {
      await pruneCodeBackups(backupDir, keep).catch(() => []);
      return finish(
        {
          codeSync: "in_sync",
          message: "Local git HEAD already matches the published production commit. Env/data were not modified.",
          localHead: head,
          productionCommit: productionSha,
        },
        EXIT.OK
      );
    }

    const factoryRunning = await probe();
    if (factoryRunning) {
      return finish(
        {
          codeSync: "deferred_factory_running",
          message: `Factory appears to be running on ${factoryHost}:${factoryPort}. Sync is pending so unsaved work and the running server are not interrupted. It will run before the next Start Sitesinc Factory launch, or after the server is stopped.`,
          localHead: head,
          productionCommit: productionSha,
          pendingSync: true,
        },
        reason === "launch" ? EXIT.ALREADY_RUNNING : EXIT.OK
      );
    }

    let backup;
    try {
      backup = await backupBeforeUpdate({
        repo,
        backupDir,
        head,
        now,
        gitOpts,
        createBundle: opts.createBundle,
      });
    } catch (err) {
      return finish(
        {
          codeSync: "backup_failed",
          message: `Backup failed (${err.message}). Local git was not updated.`,
          localHead: head,
          productionCommit: productionSha,
        },
        EXIT.ERROR
      );
    }

    const merge = git(repo, ["merge", "--ff-only", productionSha], gitOpts);
    if (merge.status !== 0) {
      return finish(
        {
          codeSync: "blocked_diverged",
          message: `git merge --ff-only refused: ${(merge.stderr || merge.stdout || "ff-only failed").trim().split(/\r?\n/)[0]}`,
          localHead: currentHead(repo, gitOpts),
          productionCommit: productionSha,
          lastCodeBackup: backup.codeDir,
        },
        EXIT.BLOCKED
      );
    }

    const newHead = currentHead(repo, gitOpts);
    if (newHead !== productionSha) {
      return finish(
        {
          codeSync: "error",
          message: "Fast-forward completed but HEAD does not match the production SHA.",
          localHead: newHead,
          productionCommit: productionSha,
          lastCodeBackup: backup.codeDir,
        },
        EXIT.ERROR
      );
    }

    const oldPackageJson = incoming.includes("package.json") ? gitFileAt(repo, head, "package.json", gitOpts) : "";
    const newPackageJson = incoming.includes("package.json") ? gitFileAt(repo, productionSha, "package.json", gitOpts) : "";
    const install = depsInstallNeeded(incoming, oldPackageJson, newPackageJson);
    let deps = install.needed ? install.reason : "unchanged";
    if (install.needed) {
      try {
        if (opts.installDeps) await opts.installDeps();
        else {
          const npm = spawnSync("npm", ["ci"], { cwd: repo, encoding: "utf8", windowsHide: true, timeout: 10 * 60 * 1000 });
          if (npm.status !== 0) {
            const tail = npmOutputTail(npm.stdout, npm.stderr);
            const err = new Error(tail.split("\n").filter(Boolean).slice(-1)[0] || "npm ci failed");
            err.npmErrorTail = tail;
            throw err;
          }
        }
        deps = "npm_ci_ok";
      } catch (err) {
        const factoryRunning = await probe().catch(() => false);
        const npmErrorTail = err && err.npmErrorTail ? err.npmErrorTail : npmOutputTail("", err instanceof Error ? err.message : "npm ci failed");
        return finish(
          {
            codeSync: "updated_deps_failed",
            message: depsFailureMessage({ productionSha, factoryRunning }),
            localHead: newHead,
            productionCommit: productionSha,
            lastCodeBackup: backup.codeDir,
            deps: "npm_ci_failed",
            depsReason: install.reason,
            factoryRunning: Boolean(factoryRunning),
            npmErrorTail,
          },
          EXIT.ERROR
        );
      }
    }

    let pruned = [];
    try {
      pruned = await pruneCodeBackups(backupDir, keep);
    } catch {
      pruned = [];
    }

    return finish(
      {
        codeSync: "updated",
        message: `Fast-forwarded local code ${shortSha(head)} → published production ${shortSha(productionSha)}. Env/data/untracked files were preserved. Backup ${backup.stamp}.`,
        localHead: newHead,
        productionCommit: productionSha,
        lastCodeBackup: backup.codeDir,
        secretsCopied: backup.secretsCopied,
        factoryCopied: backup.factoryCopied,
        storeCopied: backup.storeCopied,
        deps,
        prunedCodeBackups: pruned,
      },
      EXIT.OK
    );
  } finally {
    releaseLock(backupDir);
  }
}

export function exitCodeFor(result) {
  return result && Number.isInteger(result.exitCode) ? result.exitCode : EXIT.ERROR;
}
