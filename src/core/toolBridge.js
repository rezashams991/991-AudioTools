// src/core/toolBridge.js
// Shared file management between tools

let sharedFile = null;
let sharedFileName = null;
let sharedMimeType = null;

export function shareFile(blob, fileName, mimeType) {
  sharedFile = blob;
  sharedFileName = fileName;
  sharedMimeType = mimeType;
  window.dispatchEvent(new CustomEvent('fileShared', { detail: { blob, fileName, mimeType } }));
}

export function getSharedFile() {
  return { blob: sharedFile, fileName: sharedFileName, mimeType: sharedMimeType };
}

export function clearSharedFile() {
  sharedFile = null;
  sharedFileName = null;
  sharedMimeType = null;
}

export function showResultActions(blob, fileName, mimeType, container) {
  const existing = container.querySelector('.result-actions');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'result-actions';
  wrapper.style.cssText = 'margin-top:15px;padding:12px;background:#f0f8ff;border-radius:6px;border:1px solid #b0d4f1;display:flex;gap:10px;flex-wrap:wrap;align-items:center;';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = '📤 Send to Another Tool';
  sendBtn.style.cssText = 'padding:8px 16px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;';
  sendBtn.addEventListener('click', () => {
    shareFile(blob, fileName, mimeType);
    showToolSelector(container);
  });
  wrapper.appendChild(sendBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = '⬇️ Download';
  downloadBtn.style.cssText = 'padding:8px 16px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;';
  downloadBtn.addEventListener('click', () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  wrapper.appendChild(downloadBtn);

  container.appendChild(wrapper);
}

function showToolSelector(container) {
  const existing = container.querySelector('.tool-selector');
  if (existing) existing.remove();

  const selector = document.createElement('div');
  selector.className = 'tool-selector';
  selector.style.cssText = 'margin-top:10px;padding:10px;background:#fff;border-radius:4px;border:1px solid #ccc;';

  const label = document.createElement('span');
  label.textContent = 'Select target tool: ';
  selector.appendChild(label);

  const select = document.createElement('select');
  const tools = [
    { value: 'audioConvert', label: '🎵 Format Converter' },
    { value: 'audioCompress', label: '🗜 Compress' },
    { value: 'audioCut', label: '✂️ Cut' },
    { value: 'audioJoin', label: '🔗 Join' },
    { value: 'audioMetadata', label: '🏷️ Metadata' },
  ];
  tools.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    select.appendChild(opt);
  });
  selector.appendChild(select);

  const goBtn = document.createElement('button');
  goBtn.textContent = 'Go';
  goBtn.style.cssText = 'margin-left:10px;padding:4px 12px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;';
  goBtn.addEventListener('click', () => {
    const toolName = select.value;
    const toolbar = document.getElementById('toolbar');
    if (toolbar) {
      const btn = toolbar.querySelector(`[data-tool="${toolName}"]`);
      if (btn) { btn.click(); selector.remove(); }
    }
  });
  selector.appendChild(goBtn);
  container.appendChild(selector);
}