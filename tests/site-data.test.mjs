import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { Miniflare } from "miniflare";

const files = ["../lib/groups.ts", "../lib/auth/permissions.ts", "../lib/storage/snapshot.ts", "../worker/auth.ts", "../worker/site-data.ts", "../worker/group-api.ts"];
const code = (await Promise.all(files.map(async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\n/gm, "").replace(/^export /gm, "")))).join("\n");
// Deliberately fake test credentials, used only in isolated Miniflare instances.
const bindings = { QUEENB_ACCESS_CODE: "queenb-test-access", QUEENB_SESSION_SECRET: "test-only-session-secret-at-least-32-characters" };
const script = `${code}\nexport default { fetch(request, env) { return handleGroupApi(request, env, async () => Response.json({ image: "test-generation-reached" })); } };`;
const fixture = () => ({ version: 1, data: { milestones: [], goals: [], questions: [], characters: [{ id: "c1", name: "Test", fallback: "Q", passion: "code", power: "team", item: "book", vibe: "happy", avatarId: "avatar-1" }], settings: { journeySubtitle: "test" } }, images: { "avatar-1": "data:image/png;base64,aGVsbG8=", "queenb-group-mascot": "data:image/png;base64,d29ybGQ=" }, mascotAnswers: { creature: "cat" } });
function runtime(overrides = {}) {
  return new Miniflare({ modules: true, script, r2Buckets: ["QUEENB_DATA"], bindings, ratelimits: { AUTH_RATE_LIMITER: { simple: { limit: 100, period: 60 } } }, compatibilityDate: "2026-01-01", ...overrides });
}
const get = (mf, path, headers = {}) => mf.dispatchFetch(`https://site.example${path}`, { headers });
const login = (mf, code = bindings.QUEENB_ACCESS_CODE, headers = {}) => mf.dispatchFetch("https://site.example/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ code }) });
async function cookie(mf) {
  const response = await login(mf);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly; SameSite=Strict; Secure/);
  assert.doesNotMatch(response.headers.get("Set-Cookie"), /Max-Age=/);
  return response.headers.get("Set-Cookie").split(";")[0];
}
const put = (mf, group, body, cookie, version = { "If-None-Match": "*" }) => mf.dispatchFetch(`https://site.example/api/groups/${group}/data`, { method: "PUT", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...version }, body: JSON.stringify(body) });

 test("separate R2 objects roundtrip all data; empty groups and legacy file remain untouched", async () => {
  const mf = runtime();
  try {
    const bucket = await mf.getR2Bucket("QUEENB_DATA");
    await bucket.put("group.json", "LEGACY DO NOT TOUCH");
    assert.deepEqual(await (await get(mf, "/api/groups/711/data")).json(), { empty: true });
    assert.equal((await bucket.list()).objects.length, 1, "GET must not create defaults or copy legacy data");
    assert.equal((await put(mf, "711", fixture())).status, 401);
    assert.equal((await get(mf, "/api/groups/999/data")).status, 404);
    assert.equal((await get(mf, "/api/groups/0711/data")).status, 404);
    assert.equal((await get(mf, "/api/site-data")).status, 410);
    const auth = await cookie(mf);
    assert.equal((await put(mf, "711", fixture(), auth)).status, 204);
    let response = await get(mf, "/api/groups/711/data");
    assert.deepEqual(await response.json(), fixture());
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const aTag = response.headers.get("ETag");
    assert.deepEqual(await (await get(mf, "/api/groups/513/data")).json(), { empty: true });
    const b = fixture(); b.data.characters[0].name = "Other group"; b.mascotAnswers.creature = "bee";
    assert.equal((await put(mf, "513", b, auth)).status, 204);
    response = await get(mf, "/api/groups/513/data");
    assert.deepEqual(await response.json(), b);
    assert.deepEqual(await (await get(mf, "/api/groups/711/data")).json(), fixture());
    const reset = fixture(); reset.data.characters = []; reset.images = {}; delete reset.mascotAnswers;
    assert.equal((await put(mf, "711", reset, auth, { "If-Match": aTag })).status, 204);
    assert.deepEqual(await (await get(mf, "/api/groups/513/data")).json(), b);
    assert.equal(await (await bucket.get("group.json")).text(), "LEGACY DO NOT TOUCH");
    assert.deepEqual((await bucket.list()).objects.map(o => o.key).sort(), ["group.json", "groups/513/data.json", "groups/711/data.json"]);
  } finally { await mf.dispose(); }
});

test("ETags prevent concurrent overwrites; invalid, cross-origin and oversized writes are rejected", async () => {
  const mf = runtime();
  try {
    const auth = await cookie(mf);
    assert.equal((await put(mf, "711", fixture(), auth, {})).status, 428);
    assert.equal((await put(mf, "711", {}, auth)).status, 400);
    assert.equal((await put(mf, "711", fixture(), auth, { "If-None-Match": "*", Origin: "https://elsewhere.example" })).status, 403);
    let response = await put(mf, "711", fixture(), auth);
    const etag = response.headers.get("ETag");
    assert.equal((await put(mf, "711", fixture(), auth)).status, 409);
    const a = fixture(), b = fixture(); a.data.settings.journeySubtitle = "A"; b.data.settings.journeySubtitle = "B";
    const results = await Promise.all([put(mf, "711", a, auth, { "If-Match": etag }), put(mf, "711", b, auth, { "If-Match": etag })]);
    assert.deepEqual(results.map(r => r.status).sort(), [204, 409]);
    response = await get(mf, "/api/groups/711/data");
    const version = { "If-Match": response.headers.get("ETag") };
    const missingImage = fixture(); delete missingImage.images["avatar-1"];
    assert.equal((await put(mf, "711", missingImage, auth, version)).status, 400);
    assert.equal((await put(mf, "711", { huge: "x".repeat(20 * 1024 * 1024) }, auth, version)).status, 413);
  } finally { await mf.dispose(); }
});

test("wrong, missing, tampered and expired codes/sessions cannot write or generate images", async () => {
  const mf = runtime();
  try {
    assert.equal((await login(mf, "wrong")).status, 401);
    assert.equal((await login(mf, bindings.QUEENB_ACCESS_CODE, { Origin: "https://attacker.example" })).status, 403);
    const auth = await cookie(mf);
    assert.deepEqual((await (await get(mf, "/api/auth/session", { Cookie: auth })).json()).permissions, ["teacher:enter", "data:write", "images:generate"]);
    const payload = Buffer.from(JSON.stringify({ v: 1, exp: Math.floor(Date.now()/1000)-1, permissions: ["data:write", "images:generate"] })).toString("base64url");
    const signature = createHmac("sha256", JSON.stringify([bindings.QUEENB_SESSION_SECRET, bindings.QUEENB_ACCESS_CODE])).update(payload).digest("base64url");
    for (const invalid of [undefined, `${auth}broken`, `queenb_session=${payload}.${signature}`]) {
      assert.equal((await put(mf, "711", fixture(), invalid)).status, 401);
      for (const path of ["avatar", "mascot"]) {
        const response = await mf.dispatchFetch(`https://site.example/api/${path}?groupId=711`, { method: "POST", headers: invalid ? { Cookie: invalid } : {}, body: "invalid request must never reach generation" });
        assert.equal(response.status, 401);
      }
    }
    for (const path of ["avatar", "mascot"]) {
      assert.equal((await mf.dispatchFetch(`https://site.example/api/${path}?groupId=711`, { method: "POST", headers: { Cookie: auth } })).status, 200);
      assert.equal((await mf.dispatchFetch(`https://site.example/api/${path}?groupId=999`, { method: "POST", headers: { Cookie: auth } })).status, 404);
    }
    const response = await mf.dispatchFetch("https://site.example/api/auth/session", { method: "DELETE", headers: { Cookie: auth } });
    assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
  } finally { await mf.dispose(); }
});

test("missing secrets fail closed; login attempts are rate limited", async () => {
  const missing = runtime({ bindings: {} });
  const limited = runtime({ ratelimits: { AUTH_RATE_LIMITER: { simple: { limit: 2, period: 60 } } } });
  try {
    assert.equal((await login(missing)).status, 503);
    assert.equal((await put(missing, "711", fixture())).status, 503);
    assert.equal((await login(limited, "wrong")).status, 401);
    assert.equal((await login(limited, "wrong")).status, 401);
    assert.equal((await login(limited)).status, 429);
  } finally { await Promise.all([missing.dispose(), limited.dispose()]); }
});

test("image Worker requires server secret before calling the AI model", async () => {
  const { default: imageWorker } = await import("../workers/flux-image-worker/src/index.js");
  let calls = 0;
  const env = { IMAGE_WORKER_SECRET: "test-service-secret", AI: { run: async () => { calls++; return { image: "aGVsbG8=" }; } } };
  const request = token => { const body = new FormData(); body.set("prompt", "test"); return new Request("https://image.example/generate", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body }); };
  assert.equal((await imageWorker.fetch(request(), env)).status, 401);
  assert.equal((await imageWorker.fetch(request("wrong"), env)).status, 401);
  assert.equal(calls, 0);
  assert.equal((await imageWorker.fetch(request(env.IMAGE_WORKER_SECRET), env)).status, 200);
  assert.equal(calls, 1);
});
