// content.js 顶部增加“只注入一次”的守卫
if (window.__QR_PANEL_CONTENT_LOADED__) {
  // 已注入过，直接建立消息监听（可选）
} else {
  window.__QR_PANEL_CONTENT_LOADED__ = true;
}

(() => {
  const PANEL_WIDTH = 480;
  const HTML_PUSH_CLASS = 'ext-qr-panel-open';
  const PUSH_STYLE_ID = 'ext-qr-panel-push-style';
  const CONTAINER_ID = 'ext-qr-panel-container';

  let container;
  let isOpen = false;

  function ensurePushStyle(width) {
    let styleEl = document.getElementById(PUSH_STYLE_ID);
    const css = `
      html.${HTML_PUSH_CLASS} {
        margin-right: calc(${width}px + env(safe-area-inset-right));
        transition: margin-right 0.2s ease;
      }
    `;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = PUSH_STYLE_ID;
      styleEl.textContent = css;
      document.documentElement.appendChild(styleEl);
    } else {
      styleEl.textContent = css;
    }
  }

  function createContainer() {
    if (container && container.isConnected) return container;

    const host = document.createElement('div');
    host.id = CONTAINER_ID;

    // 基础定位与层级
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.right = '0';
    host.style.height = '100vh';
    host.style.width = '0px';
    host.style.zIndex = '2147483647';
    host.style.overflow = 'hidden';
    host.style.transition = 'width 0.2s ease';
    host.style.willChange = 'width';

    // 视觉：微投影，左侧分隔感更自然
    host.style.boxShadow = 'rgba(0, 0, 0, 0.06) 0 0 0 1px, rgba(0, 0, 0, 0.18) -8px 0 24px';
    host.style.background = 'transparent';

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }

      .frame {
        all: initial;
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: transparent;
      }

      /* 视觉分隔线：在暗色与浅色下都足够细腻 */
      .divider {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 1px;
        background: rgba(0, 0, 0, 0.08);
      }

      @media (prefers-color-scheme: dark) {
        .divider {
          background: rgba(255, 255, 255, 0.12);
        }
      }
    `;
    shadow.appendChild(style);

    const divider = document.createElement('div');
    divider.className = 'divider';
    shadow.appendChild(divider);

    const iframe = document.createElement('iframe');
    iframe.className = 'frame';
    iframe.src = chrome.runtime.getURL('sidepanel.html');
    shadow.appendChild(iframe);

    document.documentElement.appendChild(host);
    container = host;
    return container;
  }

  function openPanel() {
    ensurePushStyle(PANEL_WIDTH);
    createContainer();
    document.documentElement.classList.add(HTML_PUSH_CLASS);
    container.style.width = `${PANEL_WIDTH}px`;
    isOpen = true;
  }

  function closePanel() {
    document.documentElement.classList.remove(HTML_PUSH_CLASS);
    if (container && container.isConnected) {
      container.style.width = '0px';
      setTimeout(() => {
        if (container && container.isConnected && !isOpen) {
          container.remove();
        }
      }, 220);
    }
    isOpen = false;
  }

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'EXT_TOGGLE_EMBED_PANEL') {
      try {
        togglePanel();
        sendResponse({ ok: true, open: isOpen });
      } catch (e) {
        console.error('切换嵌入式面板失败：', e);
        sendResponse({ ok: false, error: e?.message });
      }
      return true;
    }
  });
})();