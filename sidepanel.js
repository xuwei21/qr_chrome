// sidepanel.js

// 初始化
document.addEventListener('DOMContentLoaded', function () {
  loadItems();
  document.getElementById('add-item').addEventListener('click', addNewItem);
});

// 从存储中加载项目
function loadItems() {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];
    // 确保每个项目都有 masked 字段
    items.forEach(item => {
      if (item.masked === undefined) {
        item.masked = false;
      }
      if (item.note === undefined) {
        item.note = ''; // 确保有备注字段
      }
    });
    // 按时间倒序排序
    items.sort((a, b) => b.time - a.time);
    renderItems(items);
    setTimeout(syncMaskState, 100);
  });
}

// 渲染项目列表
function renderItems(items) {
  const itemList = document.getElementById('item-list');
  if (items.length === 0) {
    itemList.innerHTML = '<div class="empty-state">暂无数据，点击下方按钮添加</div>';
    return;
  }
  itemList.innerHTML = '';
  items.forEach((item, index) => {
    const itemElement = createItemElement(item, index);
    itemList.appendChild(itemElement);
  });
}

// 创建项目元素
function createItemElement(item, index) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item';
  itemDiv.dataset.index = index;

  // 在 createItemElement 函数中，确保初始状态正确
  const hasContent = item.content && item.content.trim() !== '';
  const maskedClass = item.masked ? 'masked' : '';

  // 在 createItemElement 函数中，修改二维码部分的结构
  itemDiv.innerHTML = `
  <div class="item-content">
    <div class="item-header">
      <div class="radio-group">
        <label>
          <input type="radio" name="type-${index}" value="0" ${item.type === 0 ? 'checked' : ''}> 稿件
        </label>
        <label>
          <input type="radio" name="type-${index}" value="1" ${item.type === 1 ? 'checked' : ''}> Mid
        </label>
        <label>
          <input type="radio" name="type-${index}" value="2" ${item.type === 2 ? 'checked' : ''}> 自定义
        </label>
      </div>
      <div class="item-actions">
        <button class="btn btn-delete">删除</button>
        <button class="btn btn-top">上移</button>
      </div>
    </div>
    <input type="text" class="text-input" placeholder="输入内容..." value="${item.content || ''}">
    <textarea class="note-textarea" placeholder="备注（可选）">${item.note || ''}</textarea>
  </div>
  <div class="qr-container ${hasContent ? 'has-qr' : ''}">
    ${hasContent ?
      `<div class="qr-code-wrapper ${maskedClass}">
   <div class="qr-code" id="qr-code-${index}"></div>
   <div class="qr-mask">
     <span>已遮挡</span>
   </div>
   <button class="qr-toggle-mask">${item.masked ? '取消遮挡' : '遮挡'}</button>
 </div>`
      : ''}
  </div>
`;

  const textInput = itemDiv.querySelector('.text-input');
  const radioInputs = itemDiv.querySelectorAll('input[type="radio"]');
  const deleteBtn = itemDiv.querySelector('.btn-delete');
  const topBtn = itemDiv.querySelector('.btn-top');
  const qrContainer = itemDiv.querySelector('.qr-container');
  const noteTextarea = itemDiv.querySelector('.note-textarea');

  // 文本输入变化时生成二维码
  textInput.addEventListener('input', function () {
    const content = textInput.value.trim();
    const checkedRadio = itemDiv.querySelector('input[type="radio"]:checked');
    const currentType = parseInt(checkedRadio.value);
    if (content) {
      updateQRCode(itemDiv, index, currentType);
      qrContainer.classList.add('has-qr');
      noteTextarea.classList.add('show');
    } else {
      qrContainer.innerHTML = '';
      qrContainer.classList.remove('has-qr');
      noteTextarea.classList.remove('show');
    }
    saveItems();
  });

  // 失焦时格式化显示
  textInput.addEventListener('blur', function () {
    const content = textInput.value.trim();
    const checkedRadio = itemDiv.querySelector('input[type="radio"]:checked');
    const currentType = parseInt(checkedRadio.value);
    if (content) {
      formatTextInput(textInput, currentType);
      updateQRCode(itemDiv, index, currentType);
      saveItems();
    }
  });

  // 备注输入变化时保存
  noteTextarea.addEventListener('input', function() {
    saveItems();
  });

  // 备注失焦时保存
  noteTextarea.addEventListener('blur', function() {
    saveItems();
  });

  // 单选按钮变化
  radioInputs.forEach((radio) => {
    radio.addEventListener('change', function () {
      const newType = parseInt(this.value);
      textInput.value = '';
      noteTextarea.value = '';
      qrContainer.innerHTML = '';
      qrContainer.classList.remove('has-qr');
      updateItemType(index, newType);
      saveItems();
    });
  });

  // 删除
  deleteBtn.addEventListener('click', function () {
    deleteItem(index);
  });

  // 置顶
  topBtn.addEventListener('click', function () {
    moveItemToTop(index);
  });

  // 在 createItemElement 函数的事件监听部分添加：
  const toggleMaskBtn = itemDiv.querySelector('.qr-toggle-mask');
  if (toggleMaskBtn) {
    toggleMaskBtn.addEventListener('click', function (e) {
      e.stopPropagation(); // 防止事件冒泡
      toggleMaskState(index, itemDiv);
    });
  }

  // 初始生成二维码（如果有内容）
  if (hasContent) {
    noteTextarea.classList.add('show');
    updateQRCode(itemDiv, index, item.type);
  }else {
    noteTextarea.classList.remove('show');
  }

  return itemDiv;
}

// 切换二维码遮挡状态
function toggleMaskState(index, itemDiv) {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];
    if (items[index]) {
      // 切换遮挡状态
      const newMaskedState = !items[index].masked;
      items[index].masked = newMaskedState;
      
      chrome.storage.local.set({ qrItems: items }, function() {
        // 更新UI
        updateMaskUI(itemDiv, newMaskedState);
        // 确保保存状态
        saveItems();
      });
    }
  });
}

// 更新遮挡UI显示
function updateMaskUI(itemDiv, isMasked) {
  const qrWrapper = itemDiv.querySelector('.qr-code-wrapper');
  const toggleBtn = itemDiv.querySelector('.qr-toggle-mask');

  if (isMasked) {
    // 添加遮挡状态
    qrWrapper.classList.add('masked');
    toggleBtn.textContent = '取消遮挡';
  } else {
    // 移除遮挡状态
    qrWrapper.classList.remove('masked');
    toggleBtn.textContent = '遮挡';
  }
}

// 格式化文本输入框显示
function formatTextInput(textInput, type) {
  let content = textInput.value.trim();
  if (!content || content === '' || content.startsWith('bilibili://')) return;

  if (type === 0) {
    textInput.value = `bilibili://video/${content}`;
  } else if (type === 1) {
    textInput.value = `bilibili://space/${content}`;
  }
  // 自定义不处理
}

// updateQRCode 函数
function updateQRCode(itemDiv, index, type) {
  const textInput = itemDiv.querySelector('.text-input');
  const qrContainer = itemDiv.querySelector('.qr-container');
  const noteTextarea = itemDiv.querySelector('.note-textarea');
  let content = textInput.value.trim();

  // 清除之前的二维码
  qrContainer.innerHTML = '';

  if (content) {
    noteTextarea.classList.add('show');
    let qrContent = content;
    if (type === 0 && !content.startsWith('bilibili://video/')) {
      qrContent = `bilibili://video/${qrContent}`;
    } else if (type === 1 && !content.startsWith('bilibili://space/')) {
      qrContent = `bilibili://space/${qrContent}`;
    } else {
      qrContent = content;
    }

    // 获取当前的遮挡状态
    chrome.storage.local.get(['qrItems'], function (result) {
      const items = result.qrItems || [];
      const currentItem = items[index];
      // 确保正确处理 undefined 状态
      const isMasked = currentItem ? (currentItem.masked !== undefined ? currentItem.masked : false) : false;
      
      // 创建二维码包装器
      const qrWrapper = document.createElement('div');
      qrWrapper.className = `qr-code-wrapper ${isMasked ? 'masked' : ''}`;

      const qrCodeDiv = document.createElement('div');
      qrCodeDiv.className = 'qr-code';
      qrCodeDiv.id = `qr-code-${index}`;
      qrWrapper.appendChild(qrCodeDiv);

      // 添加遮挡层
      const mask = document.createElement('div');
      mask.className = 'qr-mask';
      mask.innerHTML = '<span>已遮挡</span>';
      qrWrapper.appendChild(mask);

      // 添加遮挡切换按钮
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'qr-toggle-mask';
      toggleBtn.textContent = isMasked ? '取消遮挡' : '遮挡';
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleMaskState(index, itemDiv);
      });
      qrWrapper.appendChild(toggleBtn);

      qrContainer.appendChild(qrWrapper);
      qrContainer.classList.add('has-qr');

      // 生成二维码
      generateQRCodeByAPI(qrContent, qrCodeDiv, index);
    });
  } else {
    noteTextarea.classList.remove('show');
    qrContainer.classList.remove('has-qr');
  }
}

// 添加重试机制
function retryGenerateQRCode(content, container, index, retryCount = 0) {
  const maxRetries = 3;

  if (retryCount >= maxRetries) {
    const loadingEl = container.querySelector('.qr-loading');
    if (loadingEl) {
      loadingEl.textContent = '生成失败';
      loadingEl.classList.add('qr-error');
    }
    return;
  }

  // 延迟重试，避免频繁请求
  setTimeout(() => {
    generateQRCodeByAPI(content, container, index);
  }, 1000 * (retryCount + 1));
}

// 通过API生成二维码
function generateQRCodeByAPI(content, container, index) {
  // 检查网络连接
  if (!navigator.onLine) {
    const loadingEl = container.querySelector('.qr-loading');
    if (loadingEl) {
      loadingEl.textContent = '网络未连接';
      loadingEl.classList.add('qr-error');
    }
    return;
  }
  // 对内容进行URL编码
  const encodedContent = encodeURIComponent(content);
  const apiUrl = `https://api.2dcode.biz/v1/create-qr-code?data=${encodedContent}&size=240x240`;

  // 创建图片元素
  const img = document.createElement('img');
  img.alt = '二维码';
  img.style.width = '120px';
  img.style.height = '120px';

  // 图片加载成功
  img.onload = function () {
    // 移除加载提示
    const loadingEl = container.querySelector('.qr-loading');
    if (loadingEl) {
      loadingEl.remove();
    }
    // 清空容器并添加图片
    container.innerHTML = '';
    container.appendChild(img);

    // 添加成功类名
    container.classList.add('qr-loaded');
  };

  // 图片加载失败
  img.onerror = function () {
    const loadingEl = container.querySelector('.qr-loading');
    if (loadingEl) {
      loadingEl.textContent = `重试中... (${retryCount + 1}/3)`;
    }
    retryGenerateQRCode(content, container, index, retryCount + 1);
  };

  // 设置图片源
  img.src = apiUrl;
}

// 更新项目类型
function updateItemType(index, type) {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];
    if (items[index]) {
      items[index].type = type;
      chrome.storage.local.set({ qrItems: items });
    }
  });
}

// 添加状态同步函数
function syncMaskState() {
  const itemElements = document.querySelectorAll('.item');
  itemElements.forEach((itemElement, index) => {
    const qrWrapper = itemElement.querySelector('.qr-code-wrapper');
    if (qrWrapper) {
      chrome.storage.local.get(['qrItems'], function(result) {
        const items = result.qrItems || [];
        if (items[index]) {
          const isMasked = items[index].masked;
          updateMaskUI(itemElement, isMasked);
        }
      });
    }
  });
}

// 添加新项目
function addNewItem() {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];
    const newItem = {
      type: 0,
      content: '',
      note: '',
      time: Date.now(),
    };
    items.unshift(newItem);
    chrome.storage.local.set({ qrItems: items }, function () {
      loadItems();
    });
  });
}

// 删除项目
function deleteItem(index) {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];
    items.splice(index, 1);
    chrome.storage.local.set({ qrItems: items }, function () {
      loadItems();
    });
  });
}

// 置顶项目
function moveItemToTop(index) {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];
    if (index > 0) {
      const item = items[index];
      items.splice(index, 1);
      items.unshift(item);
      items[0].time = Date.now();
      chrome.storage.local.set({ qrItems: items }, function () {
        loadItems();
      });
    }
  });
}

// 保存所有项目
function saveItems() {
  const itemElements = document.querySelectorAll('.item');
  const items = [];
  itemElements.forEach((itemElement, index) => {
    const textInput = itemElement.querySelector('.text-input');
    const noteTextarea = itemElement.querySelector('.note-textarea');
    const checkedRadio = itemElement.querySelector('input[type="radio"]:checked');
    const qrWrapper = itemElement.querySelector('.qr-code-wrapper');
    
    // 通过 CSS 类名判断遮挡状态，而不是按钮文本
    const isMasked = qrWrapper ? qrWrapper.classList.contains('masked') : false;
    
    items.push({
      type: parseInt(checkedRadio.value),
      content: textInput.value,
      note: noteTextarea ? noteTextarea.value : '',
      time: Date.now(),
      masked: isMasked
    });
  });
  
  // 按时间倒序
  items.sort((a, b) => b.time - a.time);
  chrome.storage.local.set({ qrItems: items });
}