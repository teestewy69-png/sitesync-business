// Factory operator auth: local loopback-dev bypass vs production / non-loopback token gate.
//   node --test scripts/factory-auth.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const auth = await import("../lib/factory/auth.ts");
const { middleware } = await import("../middleware.ts");
const { NextRequest } = await import("next/server.js");

const ENV_KEYS = ["NODE_ENV", "NETLIFY", "CONTEXT", "FACTORY_ACCESS_TOKEN", "CLIENT_DOMAIN_ROUTING"];

async function withEnv(overrides, fn) {
  const prev = {};
  for (const k of ENV_KEYS) prev[k] = process.env[k];
  for (const k of ENV_KEYS) {
    if (!(k in overrides)) continue;
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

function req(url, headers = {}) {
  const u = new URL(url);
  return new NextRequest(url, { headers: { host: u.host, ...headers } });
}

async function run(url, headers = {}) {
  return middleware(req(url, headers));
}

function isPass(res) {
  return res.headers.get("x-middleware-next") === "1";
}

test("factoryToken: FACTORY_ACCESS_TOKEN wins over the local-dev-only fallback (env precedence)", async () => {
  await withEnv({ NODE_ENV: "development", NETLIFY: undefined, CONTEXT: undefined, FACTORY_ACCESS_TOKEN: "change-me-before-any-remote-deploy" }, () => {
    assert.equal(auth.factoryToken(), "change-me-before-any-remote-deploy");
    assert.notEqual(auth.factoryToken(), "local-dev-only");
  });
  await withEnv({ NODE_ENV: "development", NETLIFY: undefined, CONTEXT: undefined, FACTORY_ACCESS_TOKEN: undefined }, () => {
    assert.equal(auth.factoryToken(), "local-dev-only");
  });
  await withEnv({ NODE_ENV: "production", NETLIFY: undefined, CONTEXT: undefined, FACTORY_ACCESS_TOKEN: undefined }, () => {
    assert.equal(auth.factoryToken(), "");
  });
});

test("isLoopbackHost: only 127.0.0.1 / localhost / ::1 (with or without port)", () => {
  for (const h of ["127.0.0.1", "127.0.0.1:3000", "localhost", "LOCALHOST:3000", "[::1]", "[::1]:3000", "::1"]) {
    assert.equal(auth.isLoopbackHost(h), true, h);
  }
  for (const h of ["192.168.1.10:3000", "10.0.0.5", "0.0.0.0:3000", "sitesinc.co", "127.0.0.2", "app.localhost", "example.localhost"]) {
    assert.equal(auth.isLoopbackHost(h), false, h);
  }
});

test("allowLocalDevFactoryBypass: Host only; x-forwarded-host is ignored", async () => {
  await withEnv({ NODE_ENV: "development", NETLIFY: undefined, CONTEXT: undefined }, () => {
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers({ host: "127.0.0.1:3000" })), true);
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers({ host: "sitesinc.co", "x-forwarded-host": "127.0.0.1:3000" })), false);
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers({ host: "192.168.0.4:3000" })), false);
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers(), "127.0.0.1"), true, "missing Host falls back to nextUrl hostname");
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers({ "x-forwarded-host": "127.0.0.1" }), "sitesinc.co"), false);
  });
  await withEnv({ NODE_ENV: "production", NETLIFY: undefined, CONTEXT: undefined }, () => {
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers({ host: "127.0.0.1:3000" })), false);
  });
  await withEnv({ NODE_ENV: "development", NETLIFY: "true", CONTEXT: undefined }, () => {
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers({ host: "127.0.0.1:3000" })), false);
  });
  await withEnv({ NODE_ENV: "development", NETLIFY: undefined, CONTEXT: "production" }, () => {
    assert.equal(auth.allowLocalDevFactoryBypass(new Headers({ host: "localhost:3000" })), false);
  });
});

test("local loopback dev bypass: /app and Factory APIs open with no cookie; /app/login redirects to /app", async () => {
  await withEnv({ NODE_ENV: "development", NETLIFY: undefined, CONTEXT: undefined, FACTORY_ACCESS_TOKEN: "change-me-before-any-remote-deploy" }, async () => {
    let res = await run("http://127.0.0.1:3000/app");
    assert.equal(isPass(res), true);
    assert.equal(res.status, 200);

    res = await run("http://localhost:3000/app/clients");
    assert.equal(isPass(res), true);

    res = await run("http://[::1]:3000/api/factory");
    assert.equal(isPass(res), true);
    assert.notEqual(res.status, 401);

    res = await run("http://127.0.0.1:3000/app/login?next=%2Fapp%2Fclients");
    assert.equal(res.status, 307);
    assert.equal(new URL(res.headers.get("location")).pathname, "/app");
    assert.equal(new URL(res.headers.get("location")).search, "");

    const apiReq = req("http://127.0.0.1:3000/api/factory/export");
    assert.equal(await auth.isAuthorizedFactoryRequest(apiReq), true, "API re-check honors the bypass");
  });
});

test("production still gated: sitesinc.co /app redirects to login; Factory APIs 401", async () => {
  await withEnv({ NODE_ENV: "production", NETLIFY: "true", CONTEXT: "production", FACTORY_ACCESS_TOKEN: "prod-secret" }, async () => {
    let res = await run("https://sitesinc.co/app");
    assert.equal(res.status, 307);
    assert.match(res.headers.get("location"), /\/app\/login\?next=%2Fapp$/);

    res = await run("https://sitesinc.co/app/clients");
    assert.equal(res.status, 307);
    assert.match(res.headers.get("location"), /\/app\/login/);

    res = await run("https://sitesinc.co/api/factory");
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { ok: false, error: "Factory authentication required." });

    res = await run("https://sitesinc.co/api/factory/city-launch");
    assert.equal(res.status, 401);

    res = await run("https://sitesinc.co/app/login");
    assert.equal(isPass(res), true, "login page stays public in production");

    res = await run("http://127.0.0.1:3000/app");
    assert.equal(res.status, 307, "production NODE_ENV stays gated even on loopback");

    const apiReq = req("https://sitesinc.co/api/factory/export");
    assert.equal(await auth.isAuthorizedFactoryRequest(apiReq), false);

    const cookie = await auth.sessionValue("prod-secret");
    res = await run("https://sitesinc.co/app", { cookie: `${auth.FACTORY_COOKIE}=${cookie}` });
    assert.equal(isPass(res), true, "production still accepts a cookie hashed from FACTORY_ACCESS_TOKEN");
    assert.equal(await auth.isAuthorizedFactoryRequest(req("https://sitesinc.co/api/factory/export", { cookie: `${auth.FACTORY_COOKIE}=${cookie}` })), true);
  });
});

test("non-loopback dev still gated", async () => {
  await withEnv({ NODE_ENV: "development", NETLIFY: undefined, CONTEXT: undefined, FACTORY_ACCESS_TOKEN: undefined }, async () => {
    let res = await run("http://192.168.1.50:3000/app");
    assert.equal(res.status, 307);
    assert.match(res.headers.get("location"), /\/app\/login\?next=%2Fapp$/);

    res = await run("http://10.0.0.8:3000/api/factory");
    assert.equal(res.status, 401);

    res = await run("https://sitesinc.co/app/clients");
    assert.equal(res.status, 307);

    res = await run("http://192.168.1.50:3000/app/login");
    assert.equal(isPass(res), true, "login stays reachable when gated");

    const apiReq = req("http://192.168.1.50:3000/api/factory/export");
    assert.equal(await auth.isAuthorizedFactoryRequest(apiReq), false);
  });
});
