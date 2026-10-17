(() => {
  const STATE_KEY = "__DOMAIN_GUARDIAN_LINK_GUARD_V1__";
  if (globalThis[STATE_KEY]?.active) return;

  const state = { active: true };
  globalThis[STATE_KEY] = state;

  let overlayHost = null;
  let observer = null;
  let scanTimer = 0;
  let scanQueue = [];
  const queuedLinks = new WeakMap();
  const markedLinks = new WeakMap();

  function parseWebUrl(value) {
    try {
      const url = new URL(value, location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url;
    } catch {
      return null;
    }
  }

  function isInternationalized(url) {
    return url.hostname.split(".").some((label) => label.toLowerCase().startsWith("xn--"));
  }

  function urlForAnalysis(url) {
    return `${url.protocol}//${url.host}/`;
  }

  function candidateUrl(value, skipSameOrigin = true) {
    const url = parseWebUrl(value);
    if (!url || !isInternationalized(url)) return null;
    if (skipSameOrigin && url.origin === location.origin) return null;
    return url;
  }

  function anchorFromEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    return path.find((node) => node instanceof Element && node.matches("a[href]")) || null;
  }

  function queueAnchor(anchor) {
    if (!state.active || !(anchor instanceof HTMLAnchorElement)) return;
    const url = candidateUrl(anchor.href);
    const previous = queuedLinks.get(anchor);
    if (!url) {
      const badge = markedLinks.get(anchor);
      if (badge?.isConnected) badge.remove();
      markedLinks.delete(anchor);
      queuedLinks.delete(anchor);
      return;
    }
    if (previous === url.href) return;
    queuedLinks.set(anchor, url.href);
    scanQueue.push({ anchor, href: url.href, analysisUrl: urlForAnalysis(url) });
    if (!scanTimer) scanTimer = setTimeout(flushScanQueue, 25);
  }

  function queueLinks(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    if (root instanceof Element && root.matches("a[href]")) queueAnchor(root);
    root.querySelectorAll?.("a[href]").forEach(queueAnchor);
  }

  function addBadge(anchor, result) {
    const existing = markedLinks.get(anchor);
    if (existing?.isConnected) existing.remove();
    if (result.level !== "high" && result.level !== "medium" && result.level !== "info") {
      markedLinks.delete(anchor);
      return;
    }
    const badge = document.createElement("span");
    badge.dataset.domainGuardianBadge = "true";
    badge.textContent = result.level === "high" ? " ⚠ 要確認" : result.level === "medium" ? " ? 要確認" : " IDN";
    badge.setAttribute("aria-hidden", "true");
    badge.style.cssText = [
      "display:inline-block!important", "position:relative!important", "z-index:2147483000!important",
      "margin-inline-start:4px!important", "padding:1px 4px!important", "border:1px solid!important",
      "border-radius:4px!important", "font:600 11px/1.4 system-ui,sans-serif!important",
      "vertical-align:middle!important", "white-space:nowrap!important"
    ].join(";");
    if (result.level === "high") {
      badge.style.setProperty("color", "#8b1e18", "important");
      badge.style.setProperty("background", "#fff0ee", "important");
      badge.style.setProperty("border-color", "#c7352d", "important");
    } else if (result.level === "medium") {
      badge.style.setProperty("color", "#744600", "important");
      badge.style.setProperty("background", "#fff5dc", "important");
      badge.style.setProperty("border-color", "#b66a00", "important");
    } else {
      badge.style.setProperty("color", "#244d7e", "important");
      badge.style.setProperty("background", "#edf4ff", "important");
      badge.style.setProperty("border-color", "#4a78b8", "important");
    }
    anchor.append(badge);
    markedLinks.set(anchor, badge);
  }

  async function flushScanQueue() {
    scanTimer = 0;
    const batch = scanQueue.splice(0, 40);
    if (scanQueue.length) scanTimer = setTimeout(flushScanQueue, 0);
    if (!batch.length || !state.active) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "DG_ANALYZE_LINKS",
        urls: batch.map((item) => item.analysisUrl)
      });
      if (!state.active || !Array.isArray(response?.results)) return;
      batch.forEach((item, index) => {
        if (!item.anchor.isConnected || item.anchor.href !== item.href) return;
        const result = response.results[index];
        if (result) addBadge(item.anchor, result);
      });
    } catch {
      // A failed local check leaves the link unchanged and is handled at activation time.
    }
  }

  function resultTitle(result) {
    if (!result) return "ドメインを確認しています";
    if (result.level === "high") return "文字のなりすましが疑われます";
    if (result.level === "medium") return "似た文字で構成されたドメインです";
    if (result.level === "info") return "Unicodeを含む国際化ドメインです";
    if (result.level === "none") return "目立った文字偽装の兆候は検出されませんでした";
    return "このURLは検査できませんでした";
  }

  function resultClass(result) {
    if (!result) return "pending";
    return ["high", "medium", "info", "none"].includes(result.level) ? result.level : "error";
  }

  function showOverlay(context, target, result) {
    if (overlayHost?.isConnected) overlayHost.remove();
    overlayHost = document.createElement("div");
    overlayHost.setAttribute("data-domain-guardian-overlay", "true");
    const shadow = overlayHost.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host{all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;color:#172536!important}
      *{box-sizing:border-box}
      .backdrop{position:fixed;inset:0;display:grid;place-items:center;overflow:auto;overscroll-behavior:contain;padding:20px;background:rgba(13,25,39,.78);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#172536}
      .card{width:min(620px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:12px;box-shadow:0 18px 65px rgba(0,0,0,.35);padding:24px}
      h1{font-size:21px;line-height:1.3;margin:0 0 10px;color:#18293c}
      .explain{margin:0 0 14px;color:#394a5b}
      .status{padding:11px 13px;border-left:5px solid #64748b;border-radius:5px;background:#f0f3f6;font-weight:700;margin:14px 0}
      .status.high{border-color:#bc2f27;background:#fff0ee;color:#8b1e18}
      .status.medium{border-color:#b66a00;background:#fff6e1;color:#754800}
      .status.info{border-color:#3866a5;background:#edf4ff;color:#244d7e}
      .status.none{border-color:#39735b;background:#eff8f3;color:#235a43}
      .host{overflow-wrap:anywhere;font-size:18px;font-weight:700;margin:8px 0 4px}
      .ascii{font-size:12px;color:#536477;overflow-wrap:anywhere}
      ul{padding-left:21px;margin:12px 0;line-height:1.55}
      .note{font-size:12px;color:#536477;margin:14px 0 0}
      .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:9px;margin-top:20px}
      button{border:0;border-radius:6px;padding:10px 15px;font:600 14px system-ui,sans-serif;cursor:pointer;background:#1c4870;color:#fff}
      button:disabled{opacity:.55;cursor:wait}
      button.secondary{background:#e8edf2;color:#26394c}
      button:focus-visible{outline:3px solid #7eafe0;outline-offset:2px}
      @media(max-width:480px){.backdrop{padding:10px}.card{padding:18px}.actions{flex-direction:column-reverse}button{width:100%}}
    `;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const card = document.createElement("section");
    card.className = "card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "dg-title");
    const title = document.createElement("h1");
    title.id = "dg-title";
    title.textContent = context === "link" ? "リンクを開く前に確認してください" : "読み込み中のドメインを確認してください";
    const explain = document.createElement("p");
    explain.className = "explain";
    explain.textContent = context === "link"
      ? "リンク先のドメインにUnicode表記が含まれるため、移動を一時停止しました。"
      : "自動確認を行いました。ページの操作を止めています。読み込み自体はすでに始まっています。";
    if (context === "link" && target.newTab) explain.textContent += " 続けると新しいタブで開きます。";
    const status = document.createElement("div");
    status.className = "status " + resultClass(result);
    status.setAttribute("aria-live", "polite");
    status.textContent = resultTitle(result);
    const host = document.createElement("div");
    host.className = "host";
    host.textContent = result?.hostname || target.hostname || "—";
    const ascii = document.createElement("div");
    ascii.className = "ascii";
    ascii.textContent = result?.asciiHostname ? "ASCII表記: " + result.asciiHostname : "";
    const reasons = document.createElement("ul");
    for (const reason of result?.reasons || []) {
      const item = document.createElement("li");
      item.textContent = reason;
      reasons.append(item);
    }
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "判定は文字の見た目に関する簡易検査です。安全性を保証するものではありません。";
    const actions = document.createElement("div");
    actions.className = "actions";
    const cancel = document.createElement("button");
    cancel.className = "secondary";
    cancel.textContent = context === "link" ? "キャンセル" : "戻る";
    const proceed = document.createElement("button");
    proceed.textContent = context === "link" && target.newTab ? "新しいタブで続ける" : "確認して続ける";
    proceed.disabled = !result;
    cancel.addEventListener("click", () => {
      if (context === "link") {
        overlayHost?.remove();
      } else if (history.length > 1) {
        history.back();
      } else {
        void chrome.runtime.sendMessage({ type: "DG_CLOSE_TAB" }).catch(() => {});
      }
    });
    proceed.addEventListener("click", () => {
      if (context === "page") {
        overlayHost?.remove();
        return;
      }
      void openLinkAfterApproval(target);
    });
    actions.append(cancel, proceed);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel.click();
      } else if (event.key === "Tab") {
        const focusable = proceed.disabled ? [cancel] : [cancel, proceed];
        const index = focusable.indexOf(shadow.activeElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && index === focusable.length - 1) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    });
    card.append(title, explain, status, host, ascii, reasons, note, actions);
    backdrop.append(card);
    shadow.append(style, backdrop);
    (document.documentElement || document).append(overlayHost);
    cancel.focus();

    return (nextResult) => {
      if (!overlayHost?.isConnected) return;
      status.className = "status " + resultClass(nextResult);
      status.textContent = resultTitle(nextResult);
      proceed.disabled = !nextResult;
      host.textContent = nextResult?.hostname || target.hostname || "—";
      ascii.textContent = nextResult?.asciiHostname ? "ASCII表記: " + nextResult.asciiHostname : "";
      reasons.replaceChildren();
      for (const reason of nextResult?.reasons || []) {
        const item = document.createElement("li");
        item.textContent = reason;
        reasons.append(item);
      }
    };
  }

  async function openLinkAfterApproval(target) {
    if (target.newTab) {
      const newTab = window.open("about:blank", "_blank");
      if (newTab) newTab.opener = null;
      try {
        await chrome.runtime.sendMessage({ type: "DG_APPROVE_HOST", hostname: target.hostname });
        if (newTab) newTab.location.replace(target.href);
        else window.location.assign(target.href);
      } catch {
        if (newTab) newTab.location.replace(target.href);
        else window.location.assign(target.href);
      }
      overlayHost?.remove();
      return;
    }
    try {
      await chrome.runtime.sendMessage({ type: "DG_APPROVE_HOST", hostname: target.hostname });
    } catch { /* The destination will be checked again on load. */ }
    window.location.assign(target.href);
  }

  async function checkCurrentPage() {
    const url = parseWebUrl(location.href);
    if (!url || !isInternationalized(url)) return;
    const target = { href: url.href, hostname: url.hostname };
    const update = showOverlay("page", target, null);
    try {
      const response = await chrome.runtime.sendMessage({ type: "DG_CHECK_PAGE", url: urlForAnalysis(url) });
      if (!state.active) return;
      if (response?.approved) {
        overlayHost?.remove();
        overlayHost = null;
        return;
      }
      update(response?.result || {
        level: "unsupported", hostname: url.hostname, asciiHostname: url.hostname,
        reasons: ["判定結果を取得できませんでした。URLを目視で確認してください。"]
      });
    } catch {
      if (!state.active) return;
      update({
        level: "unsupported", hostname: url.hostname, asciiHostname: url.hostname,
        reasons: ["判定結果を取得できませんでした。URLを目視で確認してください。"]
      });
    }
  }

  function handleActivation(event) {
    if (!state.active) return;
    if (event.type === "click" && event.button !== 0) return;
    if (event.type === "auxclick" && event.button !== 1) return;
    const anchor = anchorFromEvent(event);
    if (!anchor || anchor.hasAttribute("download")) return;
    const url = candidateUrl(anchor.href);
    if (!url) return;
    const rawTarget = (anchor.getAttribute("target") || "").toLowerCase();
    if (rawTarget && !["_self", "_top", "_parent", "_blank"].includes(rawTarget)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const target = {
      href: url.href,
      hostname: url.hostname,
      newTab: event.type === "auxclick" || rawTarget === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey
    };
    const update = showOverlay("link", target, null);
    void chrome.runtime.sendMessage({ type: "DG_ANALYZE", url: urlForAnalysis(url) }).then((response) => {
      if (state.active && response?.result) update(response.result);
    }).catch(() => {
      if (state.active) update({
        level: "unsupported", hostname: url.hostname, asciiHostname: url.hostname,
        reasons: ["判定結果を取得できませんでした。URLを目視で確認してください。"]
      });
    });
  }

  function disable() {
    if (!state.active) return;
    state.active = false;
    document.removeEventListener("click", handleActivation, true);
    document.removeEventListener("auxclick", handleActivation, true);
    observer?.disconnect();
    if (scanTimer) clearTimeout(scanTimer);
    scanQueue = [];
    for (const anchor of document.querySelectorAll("a[href]")) {
      const badge = markedLinks.get(anchor);
      if (badge?.isConnected) badge.remove();
    }
    overlayHost?.remove();
    overlayHost = null;
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    globalThis[STATE_KEY] = null;
  }

  function onRuntimeMessage(message) {
    if (message?.type === "DG_DISABLE") disable();
  }

  document.addEventListener("click", handleActivation, true);
  document.addEventListener("auxclick", handleActivation, true);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  queueLinks(document);
  if (document.documentElement) {
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLAnchorElement) queueAnchor(record.target);
        for (const node of record.addedNodes) queueLinks(node);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
  }
  void checkCurrentPage();
})();
