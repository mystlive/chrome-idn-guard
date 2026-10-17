import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { domainToASCII } from 'node:url';
import { analyzeUrl } from '../chrome-extension/analyzer.js';

const cases = JSON.parse(readFileSync(new URL('../test-site/scenarios.json', import.meta.url), 'utf8'));

test('each local site hostname has a verified IDNA ASCII label and produces expected badge', () => {
  assert.equal(cases.length, 5);
  const hosts = new Set();
  for (const c of cases) {
    assert.equal(c.ascii_host, domainToASCII(c.unicode_host));
    assert.equal(c.ascii_host.endsWith('.test'), true);
    assert.equal(hosts.has(c.ascii_host), false);
    hosts.add(c.ascii_host);
    const result = analyzeUrl(`http://${c.ascii_host}:8765/`);
    assert.equal(result.level, c.expectedLevel, c.id);
    assert.equal(result.hostname, c.unicode_host, c.id);
  }
});
