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
    // 按时间倒序排序
    items.sort((a, b) => b.time - a.time);
    renderItems(items);
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

  const hasContent = item.content && item.content.trim() !== '';

  itemDiv.innerHTML = `
    <div class="item-content">
      <div class="item-header">
        <div class="radio-group">
          <label>
            <input type="radio" name="type-${index}" value="0" ${item.type === 0 ? 'checked' : ''}> 稿件
          </label>
          <label>
            <input type="radio" name="type-${index}" value="1" ${item.type === 1 ? 'checked' : ''}> 用户
          </label>
          <label>
            <input type="radio" name="type-${index}" value="2" ${item.type === 2 ? 'checked' : ''}> 自定义
          </label>
        </div>
        <div class="item-actions">
          <button class="btn btn-delete">删除</button>
          <button class="btn btn-top">置顶</button>
        </div>
      </div>
      <input type="text" class="text-input" placeholder="输入内容..." value="${item.content || ''}">
    </div>
    <div class="qr-container ${hasContent ? 'has-qr' : ''}">
      ${hasContent ? `<div class="qr-code" id="qr-code-${index}"></div>` : ''}
    </div>
  `;

  const textInput = itemDiv.querySelector('.text-input');
  const radioInputs = itemDiv.querySelectorAll('input[type="radio"]');
  const deleteBtn = itemDiv.querySelector('.btn-delete');
  const topBtn = itemDiv.querySelector('.btn-top');
  const qrContainer = itemDiv.querySelector('.qr-container');

  // 文本输入变化时生成二维码
  textInput.addEventListener('input', function () {
    const content = textInput.value.trim();
    const checkedRadio = itemDiv.querySelector('input[type="radio"]:checked');
    const currentType = parseInt(checkedRadio.value);
    if (content) {
      updateQRCode(itemDiv, index, currentType);
      qrContainer.classList.add('has-qr');
    } else {
      qrContainer.innerHTML = '';
      qrContainer.classList.remove('has-qr');
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

  // 单选按钮变化
  radioInputs.forEach((radio) => {
    radio.addEventListener('change', function () {
      const newType = parseInt(this.value);
      textInput.value = '';
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

  // 初始生成二维码（如果有内容）
  if (hasContent) {
    updateQRCode(itemDiv, index, item.type);
  }

  return itemDiv;
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

// 更新二维码
function updateQRCode(itemDiv, index, type) {
  const textInput = itemDiv.querySelector('.text-input');
  const qrContainer = itemDiv.querySelector('.qr-container');
  let content = textInput.value.trim();

  // 清除之前的二维码
  qrContainer.innerHTML = '';

  if (content) {
    let qrContent = content;
    if (type === 0 && !content.startsWith('bilibili://video/')) {
      qrContent = `bilibili://video/${qrContent}`;
    } else if (type === 1 && !content.startsWith('bilibili://space/')) {
      qrContent = `bilibili://space/${qrContent}`;
    }

    const qrCodeDiv = document.createElement('div');
    qrCodeDiv.className = 'qr-code';
    qrCodeDiv.id = `qr-code-${index}`;
    qrContainer.appendChild(qrCodeDiv);

    // 使用 QRCode.js 生成二维码
    new QRCode(qrCodeDiv, {
      text: qrContent,
      width: 120,
      height: 120,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });
  }
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

// 添加新项目
function addNewItem() {
  chrome.storage.local.get(['qrItems'], function (result) {
    const items = result.qrItems || [];
    const newItem = {
      type: 0,
      content: '',
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
  itemElements.forEach((itemElement) => {
    const textInput = itemElement.querySelector('.text-input');
    const checkedRadio = itemElement.querySelector('input[type="radio"]:checked');
    items.push({
      type: parseInt(checkedRadio.value),
      content: textInput.value,
      time: Date.now(),
    });
  });
  // 按时间倒序
  items.sort((a, b) => b.time - a.time);
  chrome.storage.local.set({ qrItems: items });
}