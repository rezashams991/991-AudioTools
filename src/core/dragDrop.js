// src/core/dragDrop.js

export function setupDragAndDrop(container, uploadFn, options = {}) {
  const {
    accept = '*/*',
    multiple = false,
    onFiles = null,
    dropZoneText = '📂 Drop files here or click to browse',
  } = options;

  const dropZone = document.createElement('div');
  dropZone.style.cssText = `
    border: 3px dashed #28a745;
    border-radius: 12px;
    padding: 30px 20px;
    margin: 10px 0;
    text-align: center;
    color: #28a745;
    font-size: 16px;
    background: #e8f5e9;
    position: sticky;
    top: 10px;
    z-index: 1000;
    display: none;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  `;
  dropZone.innerHTML = `
    <span style="font-size: 32px;">📂</span>
    <span>${dropZoneText}</span>
    <span style="font-size: 12px; color: #6c757d;">Supported: ${accept.replace(/\*/g, '') || 'all files'}</span>
  `;

  const firstChild = container.firstChild;
  if (firstChild) {
    container.insertBefore(dropZone, firstChild);
  } else {
    container.appendChild(dropZone);
  }

  let dragCounter = 0;

  function showDropZone() { dropZone.style.display = 'flex'; }
  function hideDropZone() { dropZone.style.display = 'none'; dragCounter = 0; }

  // Cleanup check to prevent memory leaks across tool changes
  const checkAlive = () => {
    if (!document.body.contains(dropZone)) {
      destroy();
      return false;
    }
    return true;
  };

  const onDragEnter = (e) => {
    if (!checkAlive()) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      showDropZone();
    }
  };

  const onDragOver = (e) => {
    if (!checkAlive()) return;
    e.preventDefault(); 
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (e) => {
    if (!checkAlive()) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) hideDropZone();
  };

  const onDrop = (e) => {
    if (!checkAlive()) return;
    e.preventDefault(); 
    e.stopPropagation();
    dragCounter = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      hideDropZone();
      return;
    }

    let filteredFiles = files;
    if (accept && accept !== '*/*') {
      const acceptTypes = accept.split(',').map(s => s.trim());
      filteredFiles = files.filter(file => {
        return acceptTypes.some(type => {
          if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type);
          if (type.includes('*')) return file.type.startsWith(type.replace('*', ''));
          return file.type === type || file.name.toLowerCase().endsWith(type);
        });
      });
    }

    if (filteredFiles.length === 0) {
      alert(`No supported files found. Supported: ${accept}`);
      hideDropZone();
      return;
    }

    const finalFiles = multiple ? filteredFiles : filteredFiles.slice(0, 1);

    if (onFiles) {
      onFiles(finalFiles);
    } else if (uploadFn) {
      if (multiple) {
        for (const file of finalFiles) uploadFn(container, accept, file);
      } else {
        uploadFn(container, accept, finalFiles[0]);
      }
    }
    hideDropZone();
  };

  document.addEventListener('dragenter', onDragEnter, true);
  document.addEventListener('dragover', onDragOver, true);
  document.addEventListener('dragleave', onDragLeave, true);
  document.addEventListener('drop', onDrop, true);

  const onDropZoneDragEnter = (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.style.borderColor = '#1a7a3a';
    dropZone.style.background = '#c8e6c9';
    dropZone.style.transform = 'scale(1.02)';
  };

  const onDropZoneDragOver = (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.style.borderColor = '#1a7a3a';
    dropZone.style.background = '#c8e6c9';
  };

  const onDropZoneDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.style.borderColor = '#28a745';
    dropZone.style.background = '#e8f5e9';
    dropZone.style.transform = 'scale(1)';
  };

  const onDropZoneDrop = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const finalFiles = multiple ? files : files.slice(0, 1);
    if (onFiles) await onFiles(finalFiles);
    hideDropZone();
  };

  const onDropZoneClick = () => {
    if (uploadFn && dropZone.style.display !== 'none') uploadFn(container, accept);
  };

  dropZone.addEventListener('dragenter', onDropZoneDragEnter);
  dropZone.addEventListener('dragover', onDropZoneDragOver);
  dropZone.addEventListener('dragleave', onDropZoneDragLeave);
  dropZone.addEventListener('drop', onDropZoneDrop);
  dropZone.addEventListener('click', onDropZoneClick);

  const destroy = () => {
    dropZone.removeEventListener('dragenter', onDropZoneDragEnter);
    dropZone.removeEventListener('dragover', onDropZoneDragOver);
    dropZone.removeEventListener('dragleave', onDropZoneDragLeave);
    dropZone.removeEventListener('drop', onDropZoneDrop);
    dropZone.removeEventListener('click', onDropZoneClick);
    document.removeEventListener('dragenter', onDragEnter, true);
    document.removeEventListener('dragover', onDragOver, true);
    document.removeEventListener('dragleave', onDragLeave, true);
    document.removeEventListener('drop', onDrop, true);
    if (dropZone.parentNode) dropZone.parentNode.removeChild(dropZone);
  };

  return { dropZone, destroy, showDropZone, hideDropZone };
}