// src/core/fileHandler.js
// File input, download, and drop zone utilities

import { setupDragAndDrop } from './dragDrop.js';
import { showResultActions } from './toolBridge.js';

export function uploadFile(container, accept = 'audio/*', preSelectedFile = null) {
  return new Promise((resolve) => {
    if (preSelectedFile instanceof File) {
      resolve(preSelectedFile);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    container.appendChild(input);
    input.click();
    input.addEventListener('change', () => {
      const file = input.files?.[0] || null;
      resolve(file);
      input.remove();
    });
  });
}

export function downloadFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function setupDropZone(container, accept = 'audio/*', onFiles, options = {}) {
  return setupDragAndDrop(container, null, {
    accept,
    multiple: options.multiple !== undefined ? options.multiple : true,
    onFiles,
    dropZoneText: options.dropZoneText || `📂 Drop ${accept.includes('*') ? 'files' : 'supported files'} here or click to browse`,
  });
}

export { showResultActions };