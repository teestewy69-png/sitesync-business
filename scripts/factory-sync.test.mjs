// Local Factory backup+sync: node --test scripts/factory-sync.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CODE_BACKUP_NAME_RE,
  EXIT,
  EXPECTED_REMOTE_PATH,
  FailClosedError,
  PRODUCTION_MANIFEST_URL,
  PRODUCTION_SITE_ID,
  acquireLock,
  assertKnownOrigin,
  classifyUpdate,
  collidingUntracked,
  depsFailureMessage,
  depsInstallNeeded,
  npmOutputTail,
  packageDependencyFieldsChanged,
  parseGitRemote,
  parsePorcelain,
  parseProductionManifest,
  probeFactoryPort,
  pruneCodeBackups,
  releaseLock,
  runSync,
  selectCodeBackupsToPrune,
} from "./factory-sync/lib.mjs";
import { STUB_RELEASE, isNetlifyProductionPublish, productionReleaseFromEnv, writeProductionReleaseManifest } from "./factory-sync/write-production-release-manifest.mjs";
import { parseCli } from "./factory-sync/sync.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOOD_SHA = "f69a60bc57aa8f31302a484763e8c1aa4d5de9d4";

function sh(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || `git ${args[0]} failed`).trim());
  return (r.stdout || "").trim();
}

function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  sh(dir, ["init", "-b", "master"]);
  sh(dir, ["config", "user.email", "factory-sync-test@sitesinc.co"]);
  sh(dir, ["config", "user.name", "Factory Sync Test"]);
  sh(dir, ["config", "commit.gpgsign", "false"]);
}

function commitFile(dir, rel, content, msg) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  sh(dir, ["add", "--", rel]);
  sh(dir, ["commit", "-m", msg]);
  return sh(dir, ["rev-parse", "HEAD"]).toLowerCase();
}

function pkgJson({ testScript = "node --test", dep = "1.0.0" } = {}) {
  return `${JSON.stringify({
    name: "factory-sync-fixture",
    version: "1.0.0",
    scripts: { test: testScript },
    dependencies: { leftpad: dep },
  }, null, 2)}\n`;
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "factory-sync-"));
}

function recordingGit(calls) {
  return (repo, args) => {
    calls.push(args.slice());
    const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
    return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
  };
}

function forbiddenGit(calls) {
  for (const args of calls) {
    const joined = args.join(" ");
    assert.equal(args.includes("--hard"), false, joined);
    assert.equal(args.includes("stash"), false, joined);
    assert.equal(args.includes("push"), false, joined);
    assert.equal(args.includes("clean"), false, joined);
    assert.equal(args[0] === "reset", false, joined);
    assert.equal(args.includes("--force"), false, joined);
    assert.equal(args.includes("-f"), false, joined);
  }
}

function manifestFor(commit, extra = {}) {
  return {
    schema: "sitesinc-production-release/v1",
    present: true,
    commit,
    context: "production",
    site: "sitesinc.co",
    ...extra,
  };
}

function fetchOk(commit, extra = {}) {
  const body = JSON.stringify(manifestFor(commit, extra));
  return async (url) => {
    assert.match(String(url), /^https:\/\/(www\.)?sitesinc\.co\/release\.json$/);
    return {
      ok: true,
      status: 200,
      url: "https://sitesinc.co/release.json",
      arrayBuffer: async () => Buffer.from(body),
    };
  };
}

async function pairRepos() {
  const root = tmp();
  const origin = path.join(root, "origin");
  const local = path.join(root, "local");
  const backupDir = path.join(root, "backups");
  initRepo(origin);
  const a = commitFile(origin, "app.txt", "A\n", "A");
  sh(origin, ["clone", origin, local]);
  sh(local, ["config", "user.email", "factory-sync-test@sitesinc.co"]);
  sh(local, ["config", "user.name", "Factory Sync Test"]);
  sh(local, ["config", "commit.gpgsign", "false"]);
  sh(local, ["remote", "set-url", "origin", origin]);
  const b = commitFile(origin, "app.txt", "B\n", "B");
  fs.mkdirSync(path.join(local, "data", "factory"), { recursive: true });
  fs.mkdirSync(path.join(local, "data", "store"), { recursive: true });
  fs.writeFileSync(path.join(local, ".env.local"), "TITAN_SMTP_PASS=local-secret-never-upload\n");
  fs.writeFileSync(path.join(local, "data", "factory", "workspace.json"), "{\"ok\":true}\n");
  fs.writeFileSync(path.join(local, "data", "store", "leads.json"), "[]\n");
  fs.writeFileSync(path.join(local, "notes.untracked.txt"), "keep me\n");
  return { root, origin, local, backupDir, a, b };
}

async function sync(local, backupDir, fetchImpl, extra = {}) {
  const calls = extra.calls || [];
  return runSync({
    repoRoot: local,
    backupDir,
    reason: extra.reason || "manual",
    fetchImpl,
    verifyOrigin: extra.verifyOrigin || (() => ({ host: "github.com", path: EXPECTED_REMOTE_PATH })),
    gitRunner: extra.gitRunner || recordingGit(calls),
    factoryProbe: extra.factoryProbe || (async () => false),
    createBundle: extra.createBundle,
    installDeps: Object.prototype.hasOwnProperty.call(extra, "installDeps")
      ? extra.installDeps
      : async () => {
          throw new Error("npm ci should not run unless this test opts into installDeps");
        },
    now: extra.now || Date.now(),
    retainCodeVersions: extra.retainCodeVersions,
    factoryPort: extra.factoryPort,
    factoryHost: extra.factoryHost,
    pid: extra.pid,
    ...extra.opts,
  });
}

test("parseProductionManifest: valid SHA; extra command/remote keys are ignored", () => {
  const parsed = parseProductionManifest(JSON.stringify({
    schema: "sitesinc-production-release/v1",
    present: true,
    commit: GOOD_SHA.toUpperCase(),
    context: "production",
    site: "sitesinc.co",
    command: "git reset --hard",
    remote: "https://evil.example/repo.git",
    url: "https://evil.example/malware",
    script: "rm -rf /",
    target: "origin/evil",
  }));
  assert.equal(parsed.commit, GOOD_SHA);
  assert.equal(parsed.remote, undefined);
  assert.equal(parsed.command, undefined);
});

test("parseProductionManifest: fail closed on absent, stub, junk, short SHA, wrong site", () => {
  assert.throws(() => parseProductionManifest(""), FailClosedError);
  assert.throws(() => parseProductionManifest("{"), /not JSON/);
  assert.throws(() => parseProductionManifest(JSON.stringify({ schema: "sitesinc-production-release/v1", present: false })), /not published/);
  assert.throws(() => parseProductionManifest(JSON.stringify({ schema: "sitesinc-production-release/v1", present: true, commit: "abc", context: "production", site: "sitesinc.co" })), /40-character/);
  assert.throws(() => parseProductionManifest(JSON.stringify({ schema: "nope", present: true, commit: GOOD_SHA, context: "production", site: "sitesinc.co" })), /unknown schema/);
  assert.throws(() => parseProductionManifest(JSON.stringify({ schema: "sitesinc-production-release/v1", present: true, commit: GOOD_SHA, context: "deploy-preview", site: "sitesinc.co" })), /not a production/);
  assert.throws(() => parseProductionManifest(JSON.stringify({ schema: "sitesinc-production-release/v1", present: true, commit: GOOD_SHA, context: "production", site: "evil.example" })), /not sitesinc.co/);
  assert.throws(() => parseProductionManifest("x".repeat(5000)), /too large/);
});

test("known origin parser accepts github https/ssh and refuses others", () => {
  assert.deepEqual(parseGitRemote("https://github.com/teestewy69-png/sitesync-business.git"), { host: "github.com", path: EXPECTED_REMOTE_PATH });
  assert.deepEqual(parseGitRemote("git@github.com:teestewy69-png/sitesync-business.git"), { host: "github.com", path: EXPECTED_REMOTE_PATH });
  assert.throws(() => assertKnownOrigin("https://evil.example/teestewy69-png/sitesync-business.git"), /not the known/);
  assert.throws(() => assertKnownOrigin("https://github.com/evil/sitesync-business.git"), /not the known/);
});

test("depsInstallNeeded: lockfile or dependency fields only; scripts-only package.json is unchanged", () => {
  const pkgA = pkgJson({ testScript: "a", dep: "1.0.0" });
  const pkgScripts = pkgJson({ testScript: "b", dep: "1.0.0" });
  const pkgDep = pkgJson({ testScript: "a", dep: "2.0.0" });
  assert.equal(packageDependencyFieldsChanged(pkgA, pkgScripts), false);
  assert.equal(packageDependencyFieldsChanged(pkgA, pkgDep), true);
  assert.deepEqual(depsInstallNeeded(["app.txt"], pkgA, pkgScripts), { needed: false, reason: "unchanged" });
  assert.deepEqual(depsInstallNeeded(["package.json"], pkgA, pkgScripts), { needed: false, reason: "unchanged" });
  assert.deepEqual(depsInstallNeeded(["package.json"], pkgA, pkgDep), { needed: true, reason: "package.json dependencies" });
  assert.deepEqual(depsInstallNeeded(["package-lock.json"], pkgA, pkgA), { needed: true, reason: "package-lock.json" });
  assert.deepEqual(depsInstallNeeded(["package-lock.json".split("/").join("\\")], pkgA, pkgA), { needed: true, reason: "package-lock.json" });
});

test("npmOutputTail keeps the error end and depsFailureMessage is actionable", () => {
  const tail = npmOutputTail("ignore stdout\n", "npm ERR! code EPERM\nnpm ERR! syscall unlink\nnpm ERR! path node_modules\\next\n");
  assert.match(tail, /EPERM/);
  assert.match(tail, /node_modules/);
  const msg = depsFailureMessage({ productionSha: GOOD_SHA, factoryRunning: false });
  assert.match(msg, /git is current/);
  assert.match(msg, /127\.0\.0\.1:3000/);
  assert.match(msg, /npm ci/);
  assert.equal(msg.includes("deps: unchanged"), false);
});

test("classifyUpdate: ff vs no change vs ahead vs diverged", () => {
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  assert.equal(classifyUpdate(a, a, { headIsAncestorOfProd: true, prodIsAncestorOfHead: true }), "no_change");
  assert.equal(classifyUpdate(a, b, { headIsAncestorOfProd: true, prodIsAncestorOfHead: false }), "can_ff");
  assert.equal(classifyUpdate(b, a, { headIsAncestorOfProd: false, prodIsAncestorOfHead: true }), "blocked_ahead");
  assert.equal(classifyUpdate(a, b, { headIsAncestorOfProd: false, prodIsAncestorOfHead: false }), "blocked_diverged");
});

test("porcelain + untracked collision helpers", () => {
  const p = parsePorcelain(" M app.txt\n?? notes.txt\n");
  assert.deepEqual(p.dirtyTracked, ["app.txt"]);
  assert.deepEqual(p.untracked, ["notes.txt"]);
  assert.deepEqual(collidingUntracked(["new.txt", "keep.txt"], ["new.txt", "app.txt"]), ["new.txt"]);
});

test("code backup retention selects only verified dated folders", () => {
  const names = [];
  for (let i = 1; i <= 12; i += 1) {
    names.push({ name: `2026-11-09T00-00-${String(i).padStart(2, "0")}Z_${"a".repeat(12)}`, isDirectory: true, hasVerifiedOk: true });
  }
  names.push({ name: "2026-11-09T00-00-99Z_deadbeef", isDirectory: true, hasVerifiedOk: false });
  names.push({ name: "do-not-delete.txt", isDirectory: false, hasVerifiedOk: false });
  names.push({ name: "random-folder", isDirectory: true, hasVerifiedOk: true });
  const prune = selectCodeBackupsToPrune(names, 10);
  assert.equal(prune.length, 2);
  assert.ok(prune.every((n) => CODE_BACKUP_NAME_RE.test(n)));
  assert.ok(!prune.includes("do-not-delete.txt"));
  assert.ok(!prune.includes("random-folder"));
  assert.ok(!prune.includes("2026-11-09T00-00-99Z_deadbeef"));
});

test("write-production-release-manifest: stub unless sitesyncllc production + valid SHA", () => {
  const dir = tmp();
  const file = path.join(dir, "release.json");
  assert.equal(isNetlifyProductionPublish({}), false);
  assert.deepEqual(productionReleaseFromEnv({}), STUB_RELEASE);
  const prodEnv = {
    NETLIFY: "true",
    CONTEXT: "production",
    SITE_ID: PRODUCTION_SITE_ID,
    COMMIT_REF: GOOD_SHA,
  };
  const written = writeProductionReleaseManifest(file, prodEnv, { now: new Date("2026-11-09T00:00:00.000Z") });
  assert.equal(written.body.present, true);
  assert.equal(written.body.commit, GOOD_SHA);
  assert.equal(written.body.site, "sitesinc.co");
  assert.equal(written.body.schema, "sitesinc-production-release/v1");
  assert.deepEqual(Object.keys(written.body).sort(), ["commit", "context", "present", "publishedAt", "schema", "site"]);
  const onDisk = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(onDisk.commit, GOOD_SHA);
  assert.ok(!JSON.stringify(written.body).includes("TOKEN"));
  assert.equal(isNetlifyProductionPublish({ ...prodEnv, CONTEXT: "deploy-preview" }), false);
  assert.equal(isNetlifyProductionPublish({ ...prodEnv, NEXT_PUBLIC_SITE_ENV: "staging" }), false);
  assert.equal(isNetlifyProductionPublish({ ...prodEnv, SITE_ID: "00000000-0000-0000-0000-000000000000" }), false);
  assert.throws(() => productionReleaseFromEnv({ ...prodEnv, COMMIT_REF: "notasha" }), /COMMIT_REF/);
});

test("committed generated stub is present:false so local/dev cannot impersonate production", () => {
  const stub = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/generated/production-release.json"), "utf8"));
  assert.equal(stub.present, false);
  assert.equal(stub.schema, "sitesinc-production-release/v1");
  assert.equal(Object.prototype.hasOwnProperty.call(stub, "commit"), false);
});

test("normal fast-forward: backup verified, HEAD matches production, env/data/untracked preserved", async () => {
  const { local, backupDir, a, b, origin } = await pairRepos();
  const calls = [];
  const result = await sync(local, backupDir, fetchOk(b, { command: "git push --force", remote: "https://evil.example/x.git" }), { calls });
  assert.equal(result.codeSync, "updated");
  assert.equal(result.codeInSync, true);
  assert.equal(result.exitCode, EXIT.OK);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), b);
  assert.notEqual(a, b);
  assert.equal(fs.readFileSync(path.join(local, ".env.local"), "utf8"), "TITAN_SMTP_PASS=local-secret-never-upload\n");
  assert.equal(fs.readFileSync(path.join(local, "data/factory/workspace.json"), "utf8"), "{\"ok\":true}\n");
  assert.equal(fs.readFileSync(path.join(local, "data/store/leads.json"), "utf8"), "[]\n");
  assert.equal(fs.readFileSync(path.join(local, "notes.untracked.txt"), "utf8"), "keep me\n");
  assert.equal(result.envDataParity, "local-only");
  assert.match(result.envDataNote, /not production/);
  const bundle = path.join(result.lastCodeBackup, "repo.bundle");
  assert.equal(fs.existsSync(path.join(result.lastCodeBackup, "verified.ok")), true);
  assert.equal(fs.existsSync(bundle), true);
  const secrets = fs.readdirSync(path.join(backupDir, "secrets"));
  assert.equal(secrets.length, 1);
  const envBackup = path.join(backupDir, "secrets", secrets[0], ".env.local");
  assert.equal(fs.readFileSync(envBackup, "utf8"), "TITAN_SMTP_PASS=local-secret-never-upload\n");
  const mode = fs.statSync(envBackup).mode & 0o777;
  if (process.platform !== "win32") assert.equal(mode, 0o600);
  forbiddenGit(calls);
  assert.equal(sh(local, ["remote", "get-url", "origin"]), origin);
  assert.equal(PRODUCTION_MANIFEST_URL, "https://sitesinc.co/release.json");
});

test("scripts-only package.json change skips npm ci when lockfile is unchanged", async () => {
  const { origin, local, backupDir } = await pairRepos();
  commitFile(origin, "package.json", pkgJson({ testScript: "a" }), "pkg a");
  sh(local, ["fetch", "origin"]);
  sh(local, ["merge", "--ff-only", "origin/master"]);
  const b = commitFile(origin, "package.json", pkgJson({ testScript: "b" }), "scripts only");
  let npmRuns = 0;
  const result = await sync(local, backupDir, fetchOk(b), {
    installDeps: async () => { npmRuns += 1; },
  });
  assert.equal(result.codeSync, "updated");
  assert.equal(result.deps, "unchanged");
  assert.equal(result.codeInSync, true);
  assert.equal(npmRuns, 0);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), b);
});

test("package-lock.json change runs npm ci", async () => {
  const { origin, local, backupDir } = await pairRepos();
  commitFile(origin, "package.json", pkgJson(), "pkg");
  commitFile(origin, "package-lock.json", "{ \"lockfileVersion\": 3, \"a\": 1 }\n", "lock a");
  sh(local, ["fetch", "origin"]);
  sh(local, ["merge", "--ff-only", "origin/master"]);
  const b = commitFile(origin, "package-lock.json", "{ \"lockfileVersion\": 3, \"a\": 2 }\n", "lock b");
  let npmRuns = 0;
  const result = await sync(local, backupDir, fetchOk(b), {
    installDeps: async () => { npmRuns += 1; },
  });
  assert.equal(result.codeSync, "updated");
  assert.equal(result.deps, "npm_ci_ok");
  assert.equal(npmRuns, 1);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), b);
});

test("npm ci failure after lockfile change reports npm_ci_failed and logs the error tail", async () => {
  const { origin, local, backupDir } = await pairRepos();
  commitFile(origin, "package.json", pkgJson(), "pkg");
  commitFile(origin, "package-lock.json", "{ \"lockfileVersion\": 3, \"a\": 1 }\n", "lock a");
  sh(local, ["fetch", "origin"]);
  sh(local, ["merge", "--ff-only", "origin/master"]);
  const b = commitFile(origin, "package-lock.json", "{ \"lockfileVersion\": 3, \"a\": 2 }\n", "lock b");
  const err = new Error("EPERM: operation not permitted, unlink 'node_modules\\\\next'");
  err.npmErrorTail = "npm ERR! code EPERM\nnpm ERR! syscall unlink\nnpm ERR! path node_modules\\next\nnpm ERR! errno -4048";
  const result = await sync(local, backupDir, fetchOk(b), {
    installDeps: async () => { throw err; },
  });
  assert.equal(result.codeSync, "updated_deps_failed");
  assert.equal(result.deps, "npm_ci_failed");
  assert.notEqual(result.deps, "unchanged");
  assert.equal(result.codeInSync, true);
  assert.equal(result.exitCode, EXIT.ERROR);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), b);
  assert.match(result.message, /git is current/);
  assert.match(result.message, /127\.0\.0\.1:3000/);
  assert.match(result.npmErrorTail, /EPERM/);
  const log = fs.readFileSync(path.join(backupDir, "logs", "factory-sync.log"), "utf8");
  assert.match(log, /npm_ci_output/);
  assert.match(log, /EPERM/);
  const status = JSON.parse(fs.readFileSync(path.join(backupDir, "status.json"), "utf8"));
  assert.equal(status.deps, "npm_ci_failed");
  assert.equal(status.codeSync, "updated_deps_failed");
});

test("no change when local HEAD already is production", async () => {
  const { local, backupDir, origin } = await pairRepos();
  sh(local, ["fetch", "origin"]);
  sh(local, ["merge", "--ff-only", "origin/master"]);
  const head = sh(local, ["rev-parse", "HEAD"]).toLowerCase();
  const result = await sync(local, backupDir, fetchOk(head));
  assert.equal(result.codeSync, "in_sync");
  assert.equal(result.codeInSync, true);
  assert.equal(result.localHead, head);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), head);
  assert.equal(fs.existsSync(path.join(local, ".env.local")), true);
});

test("dirty tracked files block; git is unchanged", async () => {
  const { local, backupDir, a, b } = await pairRepos();
  fs.appendFileSync(path.join(local, "app.txt"), "dirty\n");
  const result = await sync(local, backupDir, fetchOk(b));
  assert.equal(result.codeSync, "blocked_dirty");
  assert.equal(result.exitCode, EXIT.BLOCKED);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
  assert.match(fs.readFileSync(path.join(local, "app.txt"), "utf8"), /dirty/);
});

test("diverged local history blocks", async () => {
  const { local, backupDir, origin, b } = await pairRepos();
  commitFile(local, "local-only.txt", "nope\n", "local diverged");
  const head = sh(local, ["rev-parse", "HEAD"]).toLowerCase();
  const result = await sync(local, backupDir, fetchOk(b));
  assert.equal(result.codeSync, "blocked_diverged");
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), head);
  assert.ok(!isNaN(parseInt(head, 16)));
  assert.equal(fs.existsSync(path.join(origin, "app.txt")), true);
});

test("local ahead of production blocks (no reset backward)", async () => {
  const { local, backupDir, a } = await pairRepos();
  sh(local, ["fetch", "origin"]);
  sh(local, ["merge", "--ff-only", "origin/master"]);
  const ahead = commitFile(local, "ahead.txt", "local\n", "local ahead");
  const result = await sync(local, backupDir, fetchOk(a));
  assert.equal(result.codeSync, "blocked_ahead");
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), ahead);
});

test("untracked collision blocks", async () => {
  const { origin, local, backupDir, a } = await pairRepos();
  commitFile(origin, "collision.txt", "from prod\n", "add collision");
  const prod = sh(origin, ["rev-parse", "HEAD"]).toLowerCase();
  fs.writeFileSync(path.join(local, "collision.txt"), "local untracked\n");
  const result = await sync(local, backupDir, fetchOk(prod));
  assert.equal(result.codeSync, "blocked_untracked_collision");
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
  assert.equal(fs.readFileSync(path.join(local, "collision.txt"), "utf8"), "local untracked\n");
});

test("network failure fail-closed, no git update", async () => {
  const { local, backupDir, a } = await pairRepos();
  const result = await sync(local, backupDir, async () => { throw new TypeError("ECONNRESET"); });
  assert.equal(result.codeSync, "network_failure");
  assert.equal(result.exitCode, EXIT.ERROR);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
});

test("invalid manifest fail-closed", async () => {
  const { local, backupDir, a } = await pairRepos();
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    url: "https://sitesinc.co/release.json",
    arrayBuffer: async () => Buffer.from('{"schema":"sitesinc-production-release/v1","present":true,"commit":"gg","context":"production","site":"sitesinc.co"}'),
  });
  const result = await sync(local, backupDir, fetchImpl);
  assert.equal(result.codeSync, "manifest_invalid");
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
});

test("HTTP 404 manifest_missing does not fall back to origin/master", async () => {
  const { local, backupDir, a } = await pairRepos();
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    url: "https://sitesinc.co/release.json",
    arrayBuffer: async () => Buffer.from("Not found"),
  });
  const result = await sync(local, backupDir, fetchImpl);
  assert.equal(result.codeSync, "manifest_missing");
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
});

test("concurrent run: lock held", async () => {
  const { local, backupDir, b } = await pairRepos();
  const lock = acquireLock(backupDir, { pid: process.pid, now: Date.now(), reason: "other" });
  assert.equal(lock.ok, true);
  const result = await sync(local, backupDir, fetchOk(b));
  assert.equal(result.codeSync, "lock_held");
  assert.equal(result.exitCode, EXIT.LOCK);
  assert.notEqual(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), b);
  releaseLock(backupDir);
});

test("backup failure leaves HEAD unchanged", async () => {
  const { local, backupDir, a, b } = await pairRepos();
  const result = await sync(local, backupDir, fetchOk(b), {
    createBundle: async () => { throw new FailClosedError("backup_failed", "disk full"); },
  });
  assert.equal(result.codeSync, "backup_failed");
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
});

test("running Factory defers and writes PENDING-SYNC", async () => {
  const { local, backupDir, a, b } = await pairRepos();
  const server = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = server.address().port;
  const result = await sync(local, backupDir, fetchOk(b), {
    factoryProbe: async () => probeFactoryPort("127.0.0.1", port),
    factoryPort: port,
    reason: "scheduled",
  });
  server.close();
  assert.equal(result.codeSync, "deferred_factory_running");
  assert.equal(result.pendingSync, true);
  assert.equal(result.codeInSync, false);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
  assert.equal(fs.existsSync(path.join(backupDir, "PENDING-SYNC.txt")), true);
});

test("launch reason while port open uses already-running exit code and does not start an update", async () => {
  const { local, backupDir, a, b } = await pairRepos();
  const result = await sync(local, backupDir, fetchOk(b), { factoryProbe: async () => true, reason: "launch" });
  assert.equal(result.codeSync, "deferred_factory_running");
  assert.equal(result.exitCode, EXIT.ALREADY_RUNNING);
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
});

test("unknown origin URL is refused before fetch/merge", async () => {
  const { local, backupDir, a, b } = await pairRepos();
  sh(local, ["remote", "set-url", "origin", "https://evil.example/not-sitesinc.git"]);
  const result = await runSync({
    repoRoot: local,
    backupDir,
    reason: "manual",
    fetchImpl: fetchOk(b),
    factoryProbe: async () => false,
  });
  assert.equal(result.codeSync, "blocked_origin");
  assert.equal(sh(local, ["rev-parse", "HEAD"]).toLowerCase(), a);
});

test("pruneCodeBackups only removes extra verified code dirs", async () => {
  const backupDir = path.join(tmp(), "backups");
  const code = path.join(backupDir, "code");
  fs.mkdirSync(code, { recursive: true });
  fs.writeFileSync(path.join(backupDir, "keep-unrelated.txt"), "no\n");
  fs.mkdirSync(path.join(backupDir, "secrets", "keep-me"), { recursive: true });
  fs.writeFileSync(path.join(backupDir, "secrets", "keep-me", ".env.local"), "x\n");
  for (let i = 1; i <= 12; i += 1) {
    const name = `2026-11-09T01-00-${String(i).padStart(2, "0")}Z_${"b".repeat(12)}`;
    const dir = path.join(code, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "verified.ok"), "ok\n");
  }
  const incomplete = path.join(code, "2026-11-09T01-00-99Z_incomplete");
  fs.mkdirSync(incomplete);
  fs.writeFileSync(path.join(incomplete, "HEAD.txt"), "nope\n");
  const pruned = await pruneCodeBackups(backupDir, 10);
  assert.equal(pruned.length, 2);
  assert.equal(fs.existsSync(path.join(backupDir, "keep-unrelated.txt")), true);
  assert.equal(fs.existsSync(path.join(backupDir, "secrets", "keep-me", ".env.local")), true);
  assert.equal(fs.existsSync(incomplete), true);
  assert.equal(fs.readdirSync(code).filter((n) => fs.existsSync(path.join(code, n, "verified.ok"))).length, 10);
});

test("CLI parse + Windows artifacts never force-push or require Netlify tokens", () => {
  assert.deepEqual(parseCli(["--status"]), { statusOnly: true, reason: "status", repoRoot: "", backupDir: "" });
  assert.equal(parseCli(["--reason=launch"]).reason, "launch");
  const win = path.join(ROOT, "scripts/factory-sync/windows");
  const files = fs.readdirSync(win).map((n) => path.join(win, n));
  files.push(path.join(ROOT, "scripts/factory-sync/lib.mjs"));
  files.push(path.join(ROOT, "scripts/factory-sync/sync.mjs"));
  for (const file of files) {
    if (!fs.statSync(file).isFile()) continue;
    const text = fs.readFileSync(file, "utf8");
    assert.equal(/\bgit\s+reset\b/.test(text), false, file);
    assert.equal(text.includes("push --force"), false, file);
    assert.equal(text.includes("NETLIFY_AUTH_TOKEN"), false, file);
    assert.equal(/\bgit\s+stash\b/.test(text), false, file);
  }
  const bat = fs.readFileSync(path.join(win, "Start-Sitesinc-Factory.bat"), "utf8");
  assert.match(bat, /127\.0\.0\.1/);
  assert.match(bat, /--port 3000/);
  assert.match(bat, /--reason=launch/);
});

test("package.json test list includes factory-sync tests", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  for (const name of ["factory-sync", "factory-auth", "design-styles", "seo-hubs"]) {
    assert.match(pkg.scripts.test, new RegExp(`${name}\\.test\\.mjs`));
  }
  assert.equal(pkg.scripts["factory-sync"], "node scripts/factory-sync/sync.mjs");
  assert.match(pkg.scripts.build, /write-production-release-manifest/);
  assert.match(pkg.scripts.build, /^node scripts\/factory-sync\/write-production-release-manifest\.mjs && next build$/);
});
