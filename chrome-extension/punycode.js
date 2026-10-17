// RFC 3492 Punycode decoder for IDN A-labels. No third-party dependencies.
// Decoding does not validate full IDNA / Unicode registration rules.
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const MAX_CODE_POINT = 0x10ffff;
const MAX_INT = Number.MAX_SAFE_INTEGER;

function digitValue(code) {
  if (code >= 48 && code <= 57) return code - 22; // 0..9 => 26..35
  if (code >= 65 && code <= 90) return code - 65; // A..Z => 0..25
  if (code >= 97 && code <= 122) return code - 97; // a..z => 0..25
  return -1;
}

function adapt(delta, count, first) {
  delta = first ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  delta += Math.floor(delta / count);
  let k = 0;
  while (delta > ((BASE - TMIN) * TMAX) / 2) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

export function decodePunycode(input) {
  if (!input || !/^[\x00-\x7f]+$/.test(input)) throw new Error("Invalid Punycode input");
  const output = [];
  const delimiter = input.lastIndexOf("-");
  let index = 0;
  if (delimiter >= 0) {
    for (let j = 0; j < delimiter; j += 1) {
      const code = input.charCodeAt(j);
      if (code >= 128) throw new Error("Invalid basic code point");
      output.push(code);
    }
    index = delimiter + 1;
  }
  if (index >= input.length) throw new Error("Empty encoded tail");
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  while (index < input.length) {
    const oldI = i;
    let weight = 1;
    for (let k = BASE; ; k += BASE) {
      if (index >= input.length) throw new Error("Incomplete Punycode label");
      const digit = digitValue(input.charCodeAt(index++));
      if (digit < 0) throw new Error("Invalid Punycode digit");
      if (digit > Math.floor((MAX_INT - i) / weight)) throw new Error("Punycode overflow");
      i += digit * weight;
      const threshold = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < threshold) break;
      const factor = BASE - threshold;
      if (weight > Math.floor(MAX_INT / factor)) throw new Error("Punycode overflow");
      weight *= factor;
    }
    const count = output.length + 1;
    bias = adapt(i - oldI, count, oldI === 0);
    const delta = Math.floor(i / count);
    if (delta > MAX_CODE_POINT - n) throw new Error("Code point overflow");
    n += delta;
    i %= count;
    if (n >= 0xd800 && n <= 0xdfff) throw new Error("Surrogate code point");
    output.splice(i, 0, n);
    i += 1;
  }
  return String.fromCodePoint(...output);
}

export function decodeHostname(asciiHostname) {
  const labels = asciiHostname.split(".");
  return labels.map((label) => {
    if (!/^xn--/i.test(label)) return label;
    try {
      const decoded = decodePunycode(label.slice(4));
      return decoded;
    } catch {
      return label; // Conservative: preserve invalid label for display.
    }
  }).join(".");
}
