// background.js

async function openSideUI(tab) {
  // 优先使用官方 Side Panel（Chrome 114+）
  if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
    try {
      // 先尝试对当前 tab 打开
      if (tab && tab.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        return;
      }
      // 回退到对当前窗口打开
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      return;
    } catch (e) {
      console.warn('chrome.sidePanel.open 失败，改用窗口回退方案：', e);
      // 继续走窗口回退
    }
  }

  // 回退方案：创建右侧贴边的独立窗口，模拟侧边栏
  try {
    const win = await chrome.windows.getCurrent();
    const width = 480; // 侧栏宽度，可按需调整
    const left = Math.max(
      0,
      (win.left ?? 0) + (win.width ?? 1280) - width
    );
    await chrome.windows.create({
      url: chrome.runtime.getURL('sidepanel.html'),
      type: 'popup',
      focused: true,
      left,
      top: win.top,
      width,
      height: win.height,
      // 注意：有的系统/窗口管理器可能会忽略部分定位，这里尽量贴边
    });
  } catch (e) {
    console.error('回退窗口创建失败：', e);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // 如果可用，显式启用 Side Panel 并绑定默认页面（非必须，但更稳妥）
  if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function') {
    try {
      await chrome.sidePanel.setOptions({
        enabled: true,
        path: 'sidepanel.html'
      });
    } catch (e) {
      console.warn('sidePanel.setOptions 失败（可能是旧版 Chrome）：', e);
    }
  }
});

// 点击扩展图标时打开侧栏或回退窗口
chrome.action.onClicked.addListener(async (tab) => {
  await openSideUI(tab);
});