import assert from 'node:assert/strict';
import { test } from 'node:test';
import { domainToASCII, domainToUnicode } from 'node:url';
import { analyzeUrl } from '../chrome-extension/analyzer.js';
import { decodeHostname, decodePunycode } from '../chrome-extension/punycode.js';

test('Punycode RFC samples and round-trip using Node IDNA', () => {
  const samples = ['bücher.example', '例え.テスト', 'pаypal.com', 'ѕсоре.com', 'グーグル.com', 'παράδειγμα.δοκιμή'];
  for (const unicodeDomain of samples) {
    const ascii = domainToASCII(unicodeDomain);
    assert.ok(ascii, unicodeDomain);
    assert.equal(decodeHostname(ascii), domainToUnicode(ascii));
  }
  assert.equal(decodePunycode('bcher-kva'), 'bücher');
  assert.throws(() => decodePunycode('abc!'), /Invalid/);
});

test('impersonation of a recognized domain is high risk', () => {
  const result = analyzeUrl('https://pаypal.com/login?secret=DO_NOT_LOG');
  assert.equal(result.level, 'high');
  assert.equal(result.hostname, 'pаypal.com');
  assert.equal(result.protectedSpoof, true);
  assert.equal(result.characters[0].unicode, 'U+0430');
  assert.equal(JSON.stringify(result).includes('DO_NOT_LOG'), false);
});

test('IDN single-script whole-label homoglyph is detected', () => {
  const result = analyzeUrl('https://ѕсоре.com');
  assert.equal(result.level, 'medium');
  assert.equal(result.skeleton, 'scope.com');
});

test('mixes of Latin/Cyrillic in one label are high risk', () => {
  assert.equal(analyzeUrl('https://exаmple.org').level, 'high');
  assert.equal(analyzeUrl('https://aрple.com').level, 'high');
});

test('legitimate internationalized domains are not labelled malicious by script alone', () => {
  assert.equal(analyzeUrl('https://例え.テスト/').level, 'info');
  assert.equal(analyzeUrl('https://пример.рф/').level, 'info');
});

test('normal domains have no warning and non-web URLs are unsupported', () => {
  assert.equal(analyzeUrl('https://paypal.com/').level, 'none');
  assert.equal(analyzeUrl('chrome://extensions/').level, 'unsupported');
  assert.equal(analyzeUrl('not a url').level, 'unsupported');
});

test('pasted URLs are analyzed locally without retaining path, credentials, or query data', () => {
  const result = analyzeUrl('https://private-user:private-pass@pаypal.com/login?token=DO_NOT_LOG#fragment');
  assert.equal(result.level, 'high');
  assert.equal(result.hostname, 'pаypal.com');
  assert.equal(JSON.stringify(result).includes('private-user'), false);
  assert.equal(JSON.stringify(result).includes('private-pass'), false);
  assert.equal(JSON.stringify(result).includes('DO_NOT_LOG'), false);
});

test('does not show false protected-brand match on a subdomain', () => {
  assert.equal(analyzeUrl('https://paypal.com.evil.test').level, 'none');
});
