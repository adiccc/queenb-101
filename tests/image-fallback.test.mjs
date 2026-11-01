import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const promptUrl = moduleUrl(await compile('../lib/ai/prompt.ts'));
const { CloudflareAvatarProvider } = await import(moduleUrl(
  (await compile('../lib/ai/cloudflare-provider.ts')).replace('"./prompt"', JSON.stringify(promptUrl)),
));
const primary = 'https://queenb-flux-image-generator.queenb-images.workers.dev/generate';
const secondary = 'https://queenb-flux-image-generator.queenb-avatars.workers.dev/generate';
const quota = () => Response.json({ error: 'Image generation failed', details: 'AiError: 4006: You have used up your daily free allocation of 10,000 neurons.' }, { status: 500 });
const success = () => new Response('image bytes', { headers: { 'content-type': 'image/jpeg' } });

for (const [first, second] of [[primary, secondary], [secondary, primary]]) {
  test(`quota retries once from ${new URL(first).hostname}, preserving photo and authorization`, async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      const form = await new Response(init.body).formData();
      calls.push({ url, authorization: init.headers.Authorization, prompt: form.get('prompt'), photo: await form.get('input_image_0').text() });
      return calls.length === 1 ? quota() : success();
    });
    const result = await new CloudflareAvatarProvider(first, 'test-secret').generateAvatar({
      image: { data: Buffer.from('photo bytes').toString('base64'), mimeType: 'image/png' },
      traits: { name: 'Test', passion: 'coding', power: 'team', item: 'book', vibe: 'happy' },
    });
    assert.equal(result.data, Buffer.from('image bytes').toString('base64'));
    assert.deepEqual(calls.map(c => c.url), [first, second]);
    assert.deepEqual({ ...calls[0], url: second }, calls[1]);
    assert.equal(calls[1].authorization, 'Bearer test-secret');
    assert.equal(calls[1].photo, 'photo bytes');
  });
}

test('successful mascot generation uses only the primary', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => success());
  await new CloudflareAvatarProvider(primary, 'secret').generateMascot('mascot');
  assert.equal(fetch.mock.callCount(), 1);
});

for (const [name, response] of [
  ['unauthorized', () => new Response('Unauthorized', { status: 401 })],
  ['rate limit', () => Response.json({ details: 'Too many requests' }, { status: 429 })],
  ['capacity', () => Response.json({ details: 'AiError 4006: Service temporarily at capacity' }, { status: 500 })],
  ['non-JSON error', () => new Response('upstream failed', { status: 502 })],
  ['network error', () => { throw new Error('network failed'); }],
]) {
  test(`${name} does not trigger fallback`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', response);
    await assert.rejects(new CloudflareAvatarProvider(primary, 'secret').generateMascot('mascot'));
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test('both quotas exhausted stop after two attempts', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', quota);
  await assert.rejects(new CloudflareAvatarProvider(primary, 'secret').generateMascot('mascot'), /daily free allocation/);
  assert.equal(fetch.mock.callCount(), 2);
});

test('custom endpoint does not send credentials or images to an implicit fallback', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', quota);
  await assert.rejects(new CloudflareAvatarProvider('https://custom.example/generate', 'secret').generateMascot('mascot'));
  assert.equal(fetch.mock.callCount(), 1);
});

test('missing secret fails before calling either service', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', success);
  await assert.rejects(new CloudflareAvatarProvider(primary).generateMascot('mascot'), /not configured/);
  assert.equal(fetch.mock.callCount(), 0);
});
