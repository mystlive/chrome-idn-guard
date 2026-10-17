import { analyzeUrl } from "./analyzer.js";

const BADGES = {
  high: { text: "!", color: "#b42318", title: "文字偽装に注意：ドメインを確認してください" },
  medium: { text: "?", color: "#b86e00", title: "類似文字の可能性：ドメインを確認してください" },
  info: { text: "IDN", color: "#2463a7", title: "国際化ドメイン：クリックして文字を確認" },
  none: { text: "", color: "#4f6b5b", title: "URL文字チェック：顕著な兆候は見つかりませんでした" },
  unsupported: { text: "", color: "#777777", title: "URL文字チェック：このページは対象外" }
};

async function applyBadge(tabId, url) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const result = analyzeUrl(url || "");
  const badge = BADGES[result.level];
  await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
  await chrome.action.setBadgeText({ tabId, text: badge.text });
  await chrome.action.setTitle({ tabId, title: badge.title });
}

async function refreshAll(clear = false) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      await applyBadge(tab.id, clear ? "" : tab.url);
    }
  } catch {
    // No telemetry, no URL logging, no background network traffic.
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    // Only run automatic checks when the optional permission was granted.
    void chrome.permissions.contains({ permissions: ["tabs"] }).then((enabled) => {
      if (enabled) void applyBadge(tabId, changeInfo.url || tab.url || "");
    });
  }
});

chrome.permissions.onAdded.addListener((permissions) => {
  if (permissions.permissions?.includes("tabs")) void refreshAll();
});
chrome.permissions.onRemoved.addListener((permissions) => {
  if (permissions.permissions?.includes("tabs")) void refreshAll(true);
});
chrome.runtime.onStartup.addListener(() => { void initialize(); });
chrome.runtime.onInstalled.addListener(() => { void initialize(); });

async function initialize() {
  if (await chrome.permissions.contains({ permissions: ["tabs"] })) {
    await refreshAll();
  }
}
