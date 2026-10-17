import { decodeHostname } from "./punycode.js";
import { LATIN_LOOKALIKES } from "./confusables-basic.js";

const LATIN = /\p{Script=Latin}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const GREEK = /\p{Script=Greek}/u;
const LETTER = /\p{Letter}/u;
const PUNYCODE = /^xn--/i;

// Only full domain matches are treated as an impersonated protected domain.
const PROTECTED_DOMAINS = new Set([
  "paypal.com", "google.com", "amazon.com", "apple.com",
  "microsoft.com", "github.com", "openai.com", "chatgpt.com", "note.com"
]);

function scriptOf(char) {
  if (LATIN.test(char)) return "ラテン文字";
  if (CYRILLIC.test(char)) return "キリル文字";
  if (GREEK.test(char)) return "ギリシャ文字";
  return LETTER.test(char) ? "その他の文字体系" : null;
}

function toAsciiLookalike(label) {
  return Array.from(label, (char) => LATIN_LOOKALIKES[char] || char)
    .join("").toLowerCase();
}

function isProtectedMatch(hostname) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return PROTECTED_DOMAINS.has(normalized);
}

function checkHostname(asciiHostname) {
  const hostname = decodeHostname(asciiHostname);
  const asciiLabels = asciiHostname.split(".");
  const labels = hostname.split(".");
  const characters = [];
  const reasons = [];
  const allScripts = new Set();
  let mixedRisk = false;
  let resemblesLatin = false;

  labels.forEach((label, labelIndex) => {
    const scripts = new Set();
    let changed = false;
    Array.from(label).forEach((character, charIndex) => {
      const script = scriptOf(character);
      if (script) {
        scripts.add(script);
        allScripts.add(script);
      }
      const latinEquivalent = LATIN_LOOKALIKES[character] || null;
      if (latinEquivalent) changed = true;
      if (script === "キリル文字" || script === "ギリシャ文字") {
        characters.push({
          character, position: charIndex + 1, labelIndex: labelIndex + 1,
          unicode: "U+" + character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"),
          script, latinEquivalent
        });
      }
    });
    if (scripts.size > 1 &&
        (scripts.has("キリル文字") || scripts.has("ギリシャ文字")) &&
        (scripts.has("ラテン文字") || (scripts.has("キリル文字") && scripts.has("ギリシャ文字")))) {
      mixedRisk = true;
      reasons.push(`${labelIndex + 1}番目のドメイン構成要素で、紛らわしい文字体系が混在しています。`);
    }
    const allLookalike = /^[a-z0-9-]+$/.test(toAsciiLookalike(label));
    if (!scripts.has("ラテン文字") && changed && allLookalike &&
        labelIndex < labels.length - 1) {
      resemblesLatin = true;
    }
  });

  const hasNonAscii = /[^\x00-\x7f]/.test(hostname);
  const decodedDifferently = asciiLabels.some((label) => PUNYCODE.test(label));
  const skeleton = labels.map(toAsciiLookalike).join(".");
  const protectedSpoof = skeleton !== hostname.toLowerCase() &&
    isProtectedMatch(skeleton) && !isProtectedMatch(hostname);
  let level = "none";
  if (protectedSpoof) {
    level = "high";
    reasons.unshift("著名サービスのドメインに似せた文字が見つかりました。正規サイトとは別のドメインです。");
  } else if (mixedRisk) {
    level = "high";
  } else if (resemblesLatin) {
    level = "medium";
    reasons.push("ラテン文字だけで構成された名前に見える、別の文字体系のドメイン構成要素があります。");
  } else if (hasNonAscii || decodedDifferently) {
    level = "info";
    reasons.push("国際化ドメインです。非ASCII文字だけで詐欺とは判定しません。");
  } else {
    reasons.push("この簡易検査では、対象とする文字偽装の兆候を検出しませんでした。");
  }

  return {
    level, hostname, asciiHostname, skeleton, characters, reasons,
    punycode: decodedDifferently, scripts: [...allScripts],
    protectedSpoof
  };
}

export function analyzeUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { level: "unsupported", reasons: ["有効なURLを取得できません。"] };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { level: "unsupported", reasons: ["HTTP/HTTPS以外のページは検査しません。"] };
  }
  // URL.hostname uses IDNA ASCII serialization in Chrome, including xn-- labels.
  const asciiHostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!asciiHostname) {
    return { level: "unsupported", reasons: ["ドメイン名がありません。"] };
  }
  return checkHostname(asciiHostname);
}
