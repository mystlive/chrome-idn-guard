import { analyzeUrl } from "./analyzer.js";

const BADGES = {
  high: { text: "!", color: "#b42318", title: "文字偽装に注意：ドメインを確認してください" },
  medium: { text: "?", color: "#b86e00", title: "類似文字の可能性：ドメインを確認してください" },
  info: { text: "IDN", color: "#2463a7", title: "国際化ドメイン：クリックして文字を確認" },
  none: { text: "", color: "#4f6b5b", title: "URL文字チェック：顕著な兆候は見つかりませんでした" },
  unsupported: { text: "", color: "#777777", title: "URL文字チェック：このページは対象外" }
};

const LINK_GUARD_ID = "domain-guardian-link-guard";
const LINK_GUARD_PERMISSIONS = {
  permissions: ["scripting"],
  origins: ["http://*/*", "https://*/*"]
};
const approvedHosts = new Map();

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DG_SYNC_LINK_GUARD") {
    void syncLinkGuard(true).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "DG_ANALYZE" && typeof message.url === "string") {
    sendResponse({ result: analyzeUrl(message.url) });
    return false;
  }

  if (message?.type === "DG_ANALYZE_LINKS" && Array.isArray(message.urls)) {
    const urls = message.urls.filter((url) => typeof url === "string").slice(0, 40);
    sendResponse({ results: urls.map((url) => analyzeUrl(url)) });
    return false;
  }

  if (message?.type === "DG_APPROVE_HOST" && typeof message.hostname === "string") {
    const hostname = message.hostname.toLowerCase();
    if (/^[a-z0-9.-]+$/.test(hostname)) approvedHosts.set(hostname, Date.now() + 5000);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "DG_CHECK_PAGE" && typeof message.url === "string") {
    let hostname = "";
    try { hostname = new URL(message.url).hostname.toLowerCase(); } catch { /* unsupported */ }
    const expiry = approvedHosts.get(hostname) || 0;
    if (expiry >= Date.now()) {
      approvedHosts.delete(hostname);
      sendResponse({ approved: true });
    } else {
      approvedHosts.delete(hostname);
      sendResponse({ result: analyzeUrl(message.url) });
    }
    return false;
  }

  if (message?.type === "DG_CLOSE_TAB" && Number.isInteger(sender.tab?.id)) {
    void chrome.tabs.remove(sender.tab.id).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }
});

chrome.permissions.onAdded.addListener((permissions) => {
  if (permissions.permissions?.includes("tabs")) void refreshAll();
  if (permissions.permissions?.includes("scripting") || permissions.origins?.length) {
    void syncLinkGuard(true);
  }
});
chrome.permissions.onRemoved.addListener((permissions) => {
  if (permissions.permissions?.includes("tabs")) void refreshAll(true);
  if (permissions.permissions?.includes("scripting") || permissions.origins?.length) {
    void syncLinkGuard(false);
  }
});
chrome.runtime.onStartup.addListener(() => { void initialize(); });
chrome.runtime.onInstalled.addListener(() => { void initialize(); });

async function initialize() {
  if (await chrome.permissions.contains({ permissions: ["tabs"] })) {
    await refreshAll();
  }
  await syncLinkGuard(true);
}

async function shutdownInjectedScripts() {
  try { await chrome.scripting.unregisterContentScripts({ ids: [LINK_GUARD_ID] }); } catch { /* not registered */ }
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.filter((tab) => Number.isInteger(tab.id)).map((tab) =>
      chrome.tabs.sendMessage(tab.id, { type: "DG_DISABLE" })
    ));
  } catch { /* permissions may already be revoked */ }
}

async function syncLinkGuard(injectExistingTabs) {
  let enabled = false;
  try { enabled = await chrome.permissions.contains(LINK_GUARD_PERMISSIONS); } catch { /* permission unavailable */ }
  if (!enabled) {
    await shutdownInjectedScripts();
    return;
  }

  try {
    const current = await chrome.scripting.getRegisteredContentScripts({ ids: [LINK_GUARD_ID] });
    if (!current.length) {
      await chrome.scripting.registerContentScripts([{
        id: LINK_GUARD_ID,
        matches: ["http://*/*", "https://*/*"],
        js: ["link-guard.js"],
        runAt: "document_start",
        allFrames: false,
        persistAcrossSessions: true
      }]);
    }
  } catch { /* registration will be retried on startup or the next permission change */ }

  if (injectExistingTabs) {
    try {
      const tabs = await chrome.tabs.query({});
      await Promise.allSettled(tabs.filter((tab) => Number.isInteger(tab.id)).map((tab) =>
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["link-guard.js"] })
      ));
    } catch { /* restricted browser pages cannot be injected */ }
  }
}
