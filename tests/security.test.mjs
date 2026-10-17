import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const root = new URL('../chrome-extension/', import.meta.url);

test('manifest requests only activeTab initially and tabs optionally', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab']);
  assert.deepEqual(manifest.optional_permissions, ['tabs']);
  assert.equal(manifest.host_permissions, undefined);
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
});

test('extension JS is packaged and does not use external network or storage APIs', async () => {
  const files = (await readdir(root)).filter((name) => name.endsWith('.js'));
  for (const filename of files) {
    const code = await readFile(new URL(filename, root), 'utf8');
    assert.doesNotMatch(code, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|\bsendBeacon\s*\(/);
    assert.doesNotMatch(code, /chrome\.storage\.|chrome\.history\.|chrome\.scripting\./);
    assert.doesNotMatch(code, /\.innerHTML\s*=/);
  }
});

test('auto badge is only updated when optional tabs permission was granted', async () => {
  let enabled = false;
  let onUpdate;
  const badgeTexts = [];
  globalThis.chrome = {
    tabs: {
      onUpdated: { addListener: (fn) => { onUpdate = fn; } },
      query: async () => []
    },
    permissions: {
      contains: async () => enabled,
      onAdded: { addListener: () => {} },
      onRemoved: { addListener: () => {} }
    },
    runtime: {
      onStartup: { addListener: () => {} },
      onInstalled: { addListener: () => {} }
    },
    action: {
      setBadgeText: async (arg) => badgeTexts.push(arg),
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {}
    }
  };
  await import('../chrome-extension/background.js');
  const fakeTab = { url: 'https://pаypal.com/' };
  onUpdate(11, {url: fakeTab.url}, fakeTab);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(badgeTexts.length, 0);
  enabled = true;
  onUpdate(11, {url: fakeTab.url}, fakeTab);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(badgeTexts, [{tabId:11, text:'!'}]);
});
