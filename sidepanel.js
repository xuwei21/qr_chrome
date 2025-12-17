// sidepanel.js

// 全局变量存储搜索状态
let currentSearchQuery = '';
let allItems = [];
let dragStartIndex = -1;
let dragOverIndex = -1;
let isDragging = false;

// 初始化
document.addEventListener('DOMContentLoaded', function () {
  loadItems();
  document.getElementById('add-item').addEventListener('click', addNewItem);

  // 添加搜索框事件监听
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');

  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', clearSearch);
  }
});

// 拖曳事件处理函数
function handleDragStart(e, index) {
  dragStartIndex = index;
  isDragging = true;
  e.target.classList.add('dragging');
  e.dataTransfer.setData('text/plain', index);
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e, index) {
  e.preventDefault();
  if (isDragging && index !== dragStartIndex) {
    dragOverIndex = index;
    e.currentTarget.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, index) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (dragStartIndex !== -1 && dragStartIndex !== index) {
    moveItem(dragStartIndex, index);
  }

  dragStartIndex = -1;
  dragOverIndex = -1;
  isDragging = false;
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.item').forEach(item => {
    item.classList.remove('drag-over');
  });
  dragStartIndex = -1;
  dragOverIndex = -1;
  isDragging = false;
}

// 从存储中加载项目
function loadItems() {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];

    // 数据迁移：如果存在 time 字段，转换为 order
    let needsMigration = false;
    if (items.length > 0 && items[0].time !== undefined) {
      // 按时间倒序排序，然后分配 order
      items.sort((a, b) => b.time - a.time);
      items.forEach((item, index) => {
        item.order = index;
        // 移除 time 字段（可选）
        // delete item.time;
      });
      needsMigration = true;
    } else if (items.length > 0 && items[0].order === undefined) {
      // 确保有 order 字段
      items.forEach((item, index) => {
        item.order = index;
      });
      needsMigration = true;
    }

    // 按 order 升序排序
    items.sort((a, b) => a.order - b.order);

    // 确保每个项目都有必要的字段
    items.forEach(item => {
      if (item.masked === undefined) item.masked = false;
      if (item.note === undefined) item.note = '';
      if (item.order === undefined) item.order = items.length - 1; // 最后
    });

    // 如果需要迁移，保存新数据
    if (needsMigration) {
      chrome.storage.local.set({ qrItems: items });
    }

    // 保存到全局变量
    allItems = items;

    // 根据当前搜索条件渲染
    if (currentSearchQuery) {
      const filteredItems = filterItemsBySearch(allItems, currentSearchQuery);
      renderItems(filteredItems, currentSearchQuery);
    } else {
      renderItems(items);
    }

    setTimeout(syncMaskState, 100);
  });
}

// 搜索处理函数
function handleSearch(event) {
  currentSearchQuery = event.target.value.trim();
  updateClearSearchButton();

  if (currentSearchQuery) {
    const filteredItems = filterItemsBySearch(allItems, currentSearchQuery);
    renderItems(filteredItems, currentSearchQuery);
  } else {
    // 无搜索词，显示所有项目
    renderItems(allItems);
  }
}

// 清空搜索
function clearSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }

  currentSearchQuery = '';
  updateClearSearchButton();
  renderItems(allItems);
}

// 更新清空搜索按钮的显示状态
function updateClearSearchButton() {
  const clearSearchBtn = document.getElementById('clear-search');
  if (clearSearchBtn) {
    if (currentSearchQuery) {
      clearSearchBtn.style.display = 'flex';
    } else {
      clearSearchBtn.style.display = 'none';
    }
  }
}

// 根据搜索词过滤项目
function filterItemsBySearch(items, searchQuery) {
  if (!searchQuery) return items;

  try {
    // 创建不区分大小写的正则表达式
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    return items.filter(item => {
      // 搜索备注字段
      if (item.note && regex.test(item.note)) {
        return true;
      }

      // 可选：也搜索内容字段
      if (item.content && regex.test(item.content)) {
        return true;
      }

      return false;
    });
  } catch (error) {
    console.error('搜索正则表达式错误:', error);
    return items;
  }
}

// 渲染项目列表
function renderItems(items, searchQuery = '') {
  const itemList = document.getElementById('item-list');

  // 移除可能的搜索结果统计
  const existingStats = document.querySelector('.search-stats');
  if (existingStats) {
    existingStats.remove();
  }

  if (items.length === 0) {
    if (searchQuery) {
      // 搜索无结果
      itemList.innerHTML = `
        <div class="no-results">
          <span class="emoji">🔍</span>
          <p>未找到匹配"${searchQuery}"的二维码</p>
          <p style="font-size: 12px; margin-top: 8px; opacity: 0.7;">尝试其他关键词或清空搜索</p>
        </div>
      `;

      // 添加搜索结果统计到顶部
      addSearchStats(0, searchQuery);
    } else {
      // 无数据
      itemList.innerHTML = '<div class="empty-state">暂无数据</div>';
    }
    return;
  }

  itemList.innerHTML = '';

  // 如果有搜索词，显示搜索结果统计
  if (searchQuery) {
    addSearchStats(items.length, searchQuery);
  }

  items.sort((a, b) => a.order - b.order);
  items.forEach((item, index) => {
    const itemElement = createItemElement(item, index, searchQuery);
    itemList.appendChild(itemElement);
  });
}

// 添加搜索结果统计
function addSearchStats(count, searchQuery) {
  const itemList = document.getElementById('item-list');
  const statsElement = document.createElement('div');
  statsElement.className = 'search-stats';

  if (count === 0) {
    statsElement.textContent = `未找到匹配"${searchQuery}"的二维码`;
  }

  itemList.insertBefore(statsElement, itemList.firstChild);
}

// 创建项目元素（修改以支持高亮）
function createItemElement(item, index, searchQuery = '') {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item';
  itemDiv.draggable = true;
  itemDiv.dataset.order = item.order;
  itemDiv.dataset.index = index;

  const hasContent = item.content && item.content.trim() !== '';
  const maskedClass = item.masked ? 'masked' : '';

  // 处理备注高亮
  let noteDisplay = item.note || '';
  if (searchQuery && item.note) {
    try {
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      noteDisplay = item.note.replace(regex, '<span class="search-highlight">$1</span>');
    } catch (error) {
      console.error('高亮正则表达式错误:', error);
    }
  }

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
    <div class="note-container">
      <textarea class="note-textarea" placeholder="备注（可选）">${item.note || ''}</textarea>
    </div>
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

  // 备注输入变化时保存并重新搜索
  noteTextarea.addEventListener('input', function () {
    // 先保存
    saveItems();

    // 更新全局数据
    chrome.storage.local.get(['qrItems'], function (result) {
      allItems = result.qrItems || [];
      allItems.sort((a, b) => b.time - a.time);

      // 如果当前有搜索词，重新执行搜索
      if (currentSearchQuery) {
        const filteredItems = filterItemsBySearch(allItems, currentSearchQuery);
        renderItems(filteredItems, currentSearchQuery);
      }
    });
  });

  // 备注失焦时保存
  noteTextarea.addEventListener('blur', function () {
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

  // 添加拖曳事件监听器
  itemDiv.addEventListener('dragstart', (e) => handleDragStart(e, index));
  itemDiv.addEventListener('dragover', (e) => handleDragOver(e, index));
  itemDiv.addEventListener('dragleave', handleDragLeave);
  itemDiv.addEventListener('drop', (e) => handleDrop(e, index));
  itemDiv.addEventListener('dragend', handleDragEnd);

  // 遮挡切换按钮
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
  } else {
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

      chrome.storage.local.set({ qrItems: items }, function () {
        // 更新全局数据
        allItems = items;
        allItems.sort((a, b) => b.time - a.time);

        // 更新UI
        updateMaskUI(itemDiv, newMaskedState);
        // 确保保存状态
        saveItems();
      });
    }
  });
}

// sidepanel.js - 添加 moveItem 函数
function moveItem(fromIndex, toIndex) {
  chrome.storage.local.get(['qrItems'], function (result) {
    let items = result.qrItems || [];
    // 确保 items 按 order 排序
    items.sort((a, b) => a.order - b.order);
    // 获取要移动的项目
    const itemToMove = items[fromIndex];
    // 移除该项目
    items.splice(fromIndex, 1);
    // 插入到新位置
    items.splice(toIndex, 0, itemToMove);
    // 重新分配 order 值（0 到 n-1）
    items.forEach((item, index) => {
      item.order = index;
    });

    // 保存
    chrome.storage.local.set({ qrItems: items }, function () {
      allItems = items;

      // 重新渲染
      if (currentSearchQuery) {
        const filteredItems = filterItemsBySearch(allItems, currentSearchQuery);
        renderItems(filteredItems, currentSearchQuery);
      } else {
        renderItems(allItems);
      }
    });
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

      // 更新全局数据
      allItems = items;
      allItems.sort((a, b) => b.time - a.time);
    }
  });
}

// 添加状态同步函数
function syncMaskState() {
  const itemElements = document.querySelectorAll('.item');
  itemElements.forEach((itemElement, index) => {
    const qrWrapper = itemElement.querySelector('.qr-code-wrapper');
    if (qrWrapper) {
      chrome.storage.local.get(['qrItems'], function (result) {
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
    let items = result.qrItems || [];

    // 确保 items 按 order 排序
    items.sort((a, b) => a.order - b.order);

    // 将所有现有项目的 order 加 1，为新项目腾出位置 0
    items.forEach(item => {
      item.order += 1;
    });

    const newItem = {
      type: 0,
      content: '',
      note: '',
      order: 0, // 新项目在顶部
      masked: false
    };

    items.unshift(newItem);

    chrome.storage.local.set({ qrItems: items }, function () {
      allItems = items;

      if (currentSearchQuery) {
        const filteredItems = filterItemsBySearch(allItems, currentSearchQuery);
        renderItems(filteredItems, currentSearchQuery);
      } else {
        renderItems(allItems);
      }
    });
  });
}

// 删除项目
function deleteItem(index) {
  chrome.storage.local.get(['qrItems'], function (result) {
    let items = result.qrItems || [];

    // 确保 items 按 order 排序
    items.sort((a, b) => a.order - b.order);
    const deletedOrder = items[index].order;

    // 删除项目
    items.splice(index, 1);
    items.forEach(item => {
      if (item.order > deletedOrder) {
        item.order -= 1;
      }
    });

    chrome.storage.local.set({ qrItems: items }, function () {
      allItems = items;

      if (currentSearchQuery) {
        const filteredItems = filterItemsBySearch(allItems, currentSearchQuery);
        renderItems(filteredItems, currentSearchQuery);
      } else {
        renderItems(allItems);
      }
    });
  });
}

// 置顶项目
function moveItemToTop(index) {
  chrome.storage.local.get(['qrItems'], function (result) {
    let items = result.qrItems || [];
    // 确保 items 按 order 排序
    items.sort((a, b) => a.order - b.order);
    if (index > 0) {
      const item = items[index];
      // 将 order 小于当前项目的项目 order 加 1
      items.forEach(it => {
        if (it.order < item.order) {
          it.order += 1;
        }
      });

      // 将当前项目移到顶部（order = 0）
      item.order = 0;

      // 重新按 order 排序
      items.sort((a, b) => a.order - b.order);

      chrome.storage.local.set({ qrItems: items }, function () {
        allItems = items;

        if (currentSearchQuery) {
          const filteredItems = filterItemsBySearch(allItems, currentSearchQuery);
          renderItems(filteredItems, currentSearchQuery);
        } else {
          renderItems(allItems);
        }
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

    const isMasked = qrWrapper ? qrWrapper.classList.contains('masked') : false;

    items.push({
      type: parseInt(checkedRadio.value),
      content: textInput.value,
      note: noteTextarea ? noteTextarea.value : '',
      order: index, // 使用当前索引作为 order
      masked: isMasked
    });
  });

  // 按 order 排序
  items.sort((a, b) => a.order - b.order);
  chrome.storage.local.set({ qrItems: items });
  allItems = items;
}