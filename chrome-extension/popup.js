import { analyzeUrl } from "./analyzer.js";

const risk = document.getElementById("risk");
const hostnameElement = document.getElementById("hostname");
const asciiElement = document.getElementById("ascii");
const reasonsElement = document.getElementById("reasons");
const charactersElement = document.getElementById("characters");
const charsSection = document.getElementById("chars-section");
const modeStatus = document.getElementById("mode-status");
const toggle = document.getElementById("toggle");
const manualScan = document.getElementById("manual-scan");
const manualUrl = document.getElementById("manual-url");
const scanContext = document.getElementById("scan-context");

// DOM elements are built with textContent, never innerHTML from a visited URL.
function addText(parent, tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function displayResult(result, context = "今開いているタブを検査") {
  const labels = {
    high: "警戒：文字のなりすましが疑われます",
    medium: "注意：ラテン文字に似た文字があります",
    info: "国際化ドメイン（ただし危険とは限りません）",
    none: "対象の文字偽装は見つかりませんでした",
    unsupported: "このページは検査対象外です"
  };
  risk.textContent = labels[result.level];
  risk.className = "risk " + result.level;
  scanContext.textContent = context;
  hostnameElement.replaceChildren();
  asciiElement.textContent = result.asciiHostname ? "ASCII表記: " + result.asciiHostname : "";
  const suspicious = new Set(result.characters?.map((c) => `${c.labelIndex}:${c.position}`) || []);
  if (result.hostname) {
    result.hostname.split(".").forEach((label, labelIndex) => {
      if (labelIndex > 0) hostnameElement.append(document.createTextNode("."));
      Array.from(label).forEach((char, position) => {
        if (suspicious.has(`${labelIndex + 1}:${position + 1}`)) {
          addText(hostnameElement, "span", char, "flag");
        } else {
          hostnameElement.append(document.createTextNode(char));
        }
      });
    });
  } else {
    hostnameElement.textContent = "—";
  }
  reasonsElement.replaceChildren();
  for (const reason of result.reasons) addText(reasonsElement, "li", reason);
  charsSection.hidden = !result.characters?.length;
  charactersElement.replaceChildren();
  for (const item of (result.characters || []).slice(0, 20)) {
    const row = addText(charactersElement, "div", "", "character");
    addText(row, "span", item.character, "glyph");
    const details = addText(row, "div", "", "details");
    addText(details, "div", `${item.unicode} / ${item.script} / 構成要素${item.labelIndex}・文字${item.position}`);
    if (item.latinEquivalent) addText(details, "div", `類似するラテン文字: ${item.latinEquivalent}`);
  }
  if ((result.characters?.length || 0) > 20) {
    addText(charactersElement, "div", "表示は最初の20文字に制限しています。", "footnote");
  }
}

manualScan.addEventListener("submit", (event) => {
  event.preventDefault();
  displayResult(analyzeUrl(manualUrl.value.trim()), "貼り付けたURLを検査");
});

let autoEnabled = false;

async function refreshMode() {
  const enabled = await chrome.permissions.contains({ permissions: ["tabs"] });
  autoEnabled = enabled;
  modeStatus.textContent = enabled ? "有効" : "無効（手動のみ）";
  toggle.textContent = enabled ? "自動監視を無効化" : "自動監視を有効化";
  toggle.className = enabled ? "remove" : "";
  toggle.disabled = false;
  return enabled;
}

toggle.addEventListener("click", () => {
  toggle.disabled = true;
  // Request permission synchronously in the click event (user gesture).
  const operation = autoEnabled
    ? chrome.permissions.remove({ permissions: ["tabs"] })
    : chrome.permissions.request({ permissions: ["tabs"] });
  void operation.then(async () => {
    await refreshMode();
  }).catch(() => {
    modeStatus.textContent = "権限変更に失敗しました";
    toggle.disabled = false;
  });
});

async function initialize() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    displayResult(analyzeUrl(tab?.url || ""));
  } catch {
    displayResult(analyzeUrl(""));
  }
  await refreshMode();
}
void initialize();
