import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function loadSource(path, imports = {}) {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  source = source.replace(/from "([^"]+)"/g, (_, id) => `from "${imports[id] ?? import.meta.resolve(id)}"`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  return { url, exports: await import(url) };
}
const groups = await loadSource("../lib/groups.ts");

test("entry screen renders all seven regions in RTL without loading a group's data", async () => {
  const page = await loadSource("../app/page.tsx", { "../lib/groups": groups.url });
  const html = renderToStaticMarkup(createElement(page.exports.default));
  assert.match(html, /באיזה אזור את\?/);
  assert.match(html, /dir="rtl"/);
  for (const region of Object.keys(groups.exports.groupsByRegion)) assert.ok(html.includes(region));
  assert.doesNotMatch(html, /ייבוא גיבוי|ייצוא גיבוי/);
});

test("group allowlist exactly matches all requested regions; arbitrary R2 keys are rejected", () => {
  assert.deepEqual(groups.exports.groupsByRegion, { "צפון": [111,112,113,114,115], "דרום": [711,712,713,715,716,721], "שרון": [311,312], "חיפה": [211,212,213,214,215], "ירושלים": [611,612,613,614,616], "מרכז": [511,512,513,514,515,531], "תל אביב והסביבה": [411,412,413,414,415] });
  assert.equal(groups.exports.groupDataKey("711"), "groups/711/data.json");
  for (const id of ["101", "999", "0711", "../group.json", "711/../513", "", null]) assert.equal(groups.exports.isGroupId(id), false);
  assert.throws(() => groups.exports.groupDataKey("../group.json"));
});

test("media and mascot answers cannot leak between mounted groups, even with identical image IDs", async () => {
  const { exports: { GroupMedia } } = await loadSource("../lib/storage/group-media.tsx");
  const a = new GroupMedia("711"), b = new GroupMedia("513");
  await a.putImage("queenb-group-mascot", new Blob(["A"])); a.answers = { creature: "cat" };
  assert.equal(await b.getImage("queenb-group-mascot"), undefined);
  assert.equal(b.answers, undefined);
  await b.putImage("queenb-group-mascot", new Blob(["B"])); b.answers = { creature: "bee" };
  a.clear();
  assert.equal(await (await b.getImage("queenb-group-mascot")).text(), "B");
  assert.deepEqual(b.answers, { creature: "bee" });
  assert.equal(await a.getImage("queenb-group-mascot"), undefined);
});
