// background.js

function isRestrictedUrl(url = "") {
  return (
    /^chrome:/.test(url) ||
    /^chrome-extension:/.test(url) ||
    /^edge:/.test(url) ||
    /^opera:/.test(url) ||
    /^devtools:/.test(url) ||
    /^view-source:/.test(url) ||
    /^about:/.test(url) ||
    /^https?:\/\/chromewebstore\.google\.com\//.test(url) ||
    /^https?:\/\/chrome\.google\.com\/webstore\//.test(url)
  );
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return true;
  } catch (e) {
    console.warn("动态注入 content.js 失败：", e);
    return false;
  }
}

async function openSidePanelFallback(tab) {
  // 官方 Side Panel（若可用）
  if (chrome.sidePanel && typeof chrome.sidePanel.open === "function") {
    try {
      if (tab && tab.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        return true;
      }
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      return true;
    } catch (e) {
      console.warn("sidePanel.open 失败，将使用独立窗口回退：", e);
    }
  }

  // 独立窗口回退
  try {
    const win = await chrome.windows.getCurrent();
    const width = 480;
    const left = Math.max(0, (win.left ?? 0) + (win.width ?? 1280) - width);
    await chrome.windows.create({
      url: chrome.runtime.getURL("sidepanel.html") + "?reason=blocked",
      type: "popup",
      focused: true,
      left,
      top: win.top,
      width,
      height: win.height
    });
    return true;
  } catch (e) {
    console.error("独立窗口回退失败：", e);
    return false;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === "function") {
    try {
      await chrome.sidePanel.setOptions({ enabled: true, path: "sidepanel.html" });
    } catch (e) {
      console.warn("sidePanel.setOptions 失败（可能 Chrome 版本较旧）：", e);
    }
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab || !tab.id || !tab.url || isRestrictedUrl(tab.url)) {
      // 受限页面或拿不到 tab 信息 → 直接回退
      await openSidePanelFallback(tab);
      return;
    }

    // 先尝试发消息（若内容脚本已在）
    let ok = false;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "EXT_TOGGLE_EMBED_PANEL" });
      ok = true;
    } catch (_) {
      // 如果没有“接收端”，尝试热注入后再发一次
      const injected = await ensureContentScript(tab.id);
      if (injected) {
        await chrome.tabs.sendMessage(tab.id, { type: "EXT_TOGGLE_EMBED_PANEL" });
        ok = true;
      }
    }

    if (!ok) {
      // 仍不行就回退
      await openSidePanelFallback(tab);
    }
  } catch (e) {
    console.warn("页面内侧滑切换失败，改用回退方案：", e);
    await openSidePanelFallback(tab);
  }
});