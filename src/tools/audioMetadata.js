// src/tools/audioMetadata.js
import { setupDropZone } from '../core/fileHandler.js';
import { getAudioMetadata } from '../core/audioUtils.js';
import { getSharedFile, clearSharedFile, showResultActions } from '../core/toolBridge.js';
import ID3Writer from 'browser-id3-writer';

export default function run(container) {
  container.innerHTML = `
    <h3>🏷️ Metadata Editor</h3>
    <p>View and edit MP3 metadata (title, artist, album, year, genre, cover).</p>
    <p style="font-size:13px;color:#6c757d;">⚠️ Editing is only supported for <strong>MP3</strong> files. Other formats are view‑only.</p>
    <div id="fileStatus">No file selected.</div>
    <button id="loadBtn">Select File</button>
    <div id="preview" style="margin-top:10px;"></div>
    <div id="editor" style="display:none;margin-top:20px;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6;">
      <h4 style="margin-top:0;">Edit Metadata</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label style="font-weight:bold;">Title</label><input id="editTitle" type="text" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;" /></div>
        <div><label style="font-weight:bold;">Artist</label><input id="editArtist" type="text" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;" /></div>
        <div><label style="font-weight:bold;">Album</label><input id="editAlbum" type="text" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;" /></div>
        <div><label style="font-weight:bold;">Year</label><input id="editYear" type="text" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;" /></div>
        <div style="grid-column:1/-1;"><label style="font-weight:bold;">Genre</label><input id="editGenre" type="text" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;" /></div>
        <div style="grid-column:1/-1;">
          <label style="font-weight:bold;">Cover Art</label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <img id="coverPreview" src="" alt="Cover" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ddd;display:none;" />
            <button id="changeCoverBtn" style="padding:6px 12px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">Change Cover</button>
            <button id="removeCoverBtn" style="padding:6px 12px;background:#dc3545;color:#fff;border:none;border-radius:4px;cursor:pointer;">Remove Cover</button>
            <input id="coverFileInput" type="file" accept="image/*" style="display:none;" />
          </div>
        </div>
      </div>
      <div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="saveBtn" style="padding:8px 20px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">💾 Save</button>
        <button id="resetBtn" style="padding:8px 20px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">↻ Reset</button>
      </div>
      <div id="saveStatus" style="margin-top:10px;"></div>
    </div>
    <div id="status" style="margin-top:10px;"></div>
    <div id="progressBar" style="margin-top:10px;display:none;width:100%;height:20px;background:#e9ecef;border-radius:4px;overflow:hidden;">
      <div id="progressFill" style="height:100%;width:0%;background:#28a745;transition:width 0.3s;"></div>
    </div>
  `;

  const loadBtn = container.querySelector('#loadBtn');
  const fileStatus = container.querySelector('#fileStatus');
  const preview = container.querySelector('#preview');
  const status = container.querySelector('#status');
  const progressBar = container.querySelector('#progressBar');
  const progressFill = container.querySelector('#progressFill');
  const editor = container.querySelector('#editor');
  const editTitle = container.querySelector('#editTitle');
  const editArtist = container.querySelector('#editArtist');
  const editAlbum = container.querySelector('#editAlbum');
  const editYear = container.querySelector('#editYear');
  const editGenre = container.querySelector('#editGenre');
  const coverPreview = container.querySelector('#coverPreview');
  const changeCoverBtn = container.querySelector('#changeCoverBtn');
  const removeCoverBtn = container.querySelector('#removeCoverBtn');
  const coverFileInput = container.querySelector('#coverFileInput');
  const saveBtn = container.querySelector('#saveBtn');
  const resetBtn = container.querySelector('#resetBtn');
  const saveStatus = container.querySelector('#saveStatus');

  let currentFile = null;
  let currentMetadata = null;
  let newCoverData = null;
  let isMp3 = false;

  function renderPreview(metadata, file) {
    const duration = metadata.duration ? formatDuration(metadata.duration) : '--:--';
    const bitrate = metadata.bitrate ? `${metadata.bitrate} kbps` : 'Unknown';
    const size = formatSize(metadata.size || file.size);

    const coverHtml = metadata.coverUrl
      ? `<img src="${metadata.coverUrl}" alt="Cover" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" />`
      : `<div style="width:80px;height:80px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:36px;color:white;">🎵</div>`;

    preview.innerHTML = `
      <div style="display:flex;gap:15px;padding:12px;background:#f8f9fa;border-radius:6px;margin:10px 0;align-items:center;flex-wrap:wrap;">
        <div style="flex-shrink:0;">${coverHtml}</div>
        <div style="flex:1;min-width:200px;">
          <div style="font-weight:bold;font-size:16px;">${metadata.title || file.name}</div>
          <div style="color:#666;font-size:14px;">${metadata.artist || 'Unknown Artist'} ${metadata.album ? '· ' + metadata.album : ''}</div>
          <div style="color:#888;font-size:13px;margin-top:4px;">
            ${metadata.format ? metadata.format.toUpperCase() : 'Unknown'} · ${duration} · ${bitrate} · ${size}
            ${metadata.sampleRate ? '· ' + Math.round(metadata.sampleRate/1000) + ' kHz' : ''}
            ${metadata.channels ? '· ' + metadata.channels + 'ch' : ''}
          </div>
        </div>
      </div>
    `;
  }

  async function loadFile(file) {
    currentFile = file;
    isMp3 = file.name.toLowerCase().endsWith('.mp3');
    const metadata = await getAudioMetadata(file);
    currentMetadata = metadata;
    fileStatus.textContent = `📁 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    renderPreview(metadata, file);

    editTitle.value = metadata.title || '';
    editArtist.value = metadata.artist || 'Unknown';
    editAlbum.value = metadata.album || '';
    editYear.value = metadata.year || '';
    editGenre.value = metadata.genre || '';
    newCoverData = null;

    if (metadata.coverUrl) {
      coverPreview.src = metadata.coverUrl;
      coverPreview.style.display = 'block';
    } else {
      coverPreview.style.display = 'none';
    }

    const editable = isMp3;
    [editTitle, editArtist, editAlbum, editYear, editGenre, changeCoverBtn, removeCoverBtn, saveBtn].forEach(el => {
      el.disabled = !editable;
      el.style.opacity = editable ? '1' : '0.6';
      el.style.pointerEvents = editable ? 'auto' : 'none';
    });
    saveStatus.textContent = editable ? '' : '⚠️ Editing only supported for MP3.';
    saveStatus.style.color = editable ? '' : '#856404';
    editor.style.display = 'block';
    status.textContent = '✅ File loaded. Edit and click Save.';
  }

  const shared = getSharedFile();
  if (shared?.blob) {
    const file = new File([shared.blob], shared.fileName, { type: shared.mimeType || 'audio/mpeg' });
    clearSharedFile();
    setTimeout(() => loadFile(file), 100);
  }

  setupDropZone(container, 'audio/*', async (files) => {
    if (files.length > 0) await loadFile(files[0]);
  });

  loadBtn.addEventListener('click', async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.style.display = 'none';
      container.appendChild(input);
      const file = await new Promise((resolve) => {
        input.addEventListener('change', () => {
          resolve(input.files?.[0] || null);
          input.remove();
        });
        input.click();
      });
      if (file) await loadFile(file);
    } catch (err) {
      status.textContent = '❌ Error: ' + err.message;
    }
  });

  changeCoverBtn.addEventListener('click', () => coverFileInput.click());
  coverFileInput.addEventListener('change', () => {
    const file = coverFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      newCoverData = new Uint8Array(e.target.result);
      coverPreview.src = URL.createObjectURL(file);
      coverPreview.style.display = 'block';
      saveStatus.textContent = '📸 New cover loaded. Click Save.';
      saveStatus.style.color = '#004085';
    };
    reader.readAsArrayBuffer(file);
  });

  removeCoverBtn.addEventListener('click', () => {
    newCoverData = null;
    coverPreview.style.display = 'none';
    coverFileInput.value = '';
    saveStatus.textContent = '🗑️ Cover will be removed. Click Save.';
    saveStatus.style.color = '#721c24';
  });

  resetBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    const metadata = await getAudioMetadata(currentFile);
    currentMetadata = metadata;
    editTitle.value = metadata.title || '';
    editArtist.value = metadata.artist || 'Unknown';
    editAlbum.value = metadata.album || '';
    editYear.value = metadata.year || '';
    editGenre.value = metadata.genre || '';
    newCoverData = null;
    if (metadata.coverUrl) {
      coverPreview.src = metadata.coverUrl;
      coverPreview.style.display = 'block';
    } else {
      coverPreview.style.display = 'none';
    }
    saveStatus.textContent = '';
    status.textContent = '🔄 Reset to original.';
  });

  saveBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    if (!isMp3) {
      saveStatus.textContent = '⚠️ Editing only supported for MP3.';
      saveStatus.style.color = '#856404';
      return;
    }

    try {
      saveStatus.textContent = '⏳ Saving...';
      progressBar.style.display = 'block';
      progressFill.style.width = '10%';

      const arrayBuffer = await currentFile.arrayBuffer();
      const writer = new ID3Writer(arrayBuffer);

      if (editTitle.value.trim()) writer.setFrame('TIT2', editTitle.value.trim());
      if (editArtist.value.trim()) writer.setFrame('TPE1', editArtist.value.trim());
      if (editAlbum.value.trim()) writer.setFrame('TALB', editAlbum.value.trim());
      if (editYear.value.trim()) writer.setFrame('TYER', editYear.value.trim());
      if (editGenre.value.trim()) writer.setFrame('TCON', editGenre.value.trim());

      if (newCoverData && newCoverData !== null) {
        writer.setFrame('APIC', {
          data: newCoverData,
          type: 'image/jpeg',
          description: 'Cover',
        });
      }

      progressFill.style.width = '60%';
      writer.addTag();
      const taggedBuffer = writer.arrayBuffer;
      progressFill.style.width = '80%';

      const newBlob = new Blob([taggedBuffer], { type: 'audio/mpeg' });
      const newName = currentFile.name.replace(/\.[^.]+$/, '_tagged.mp3');

      showResultActions(newBlob, newName, 'audio/mpeg', container);

      progressFill.style.width = '100%';
      saveStatus.textContent = '✅ Metadata saved!';
      saveStatus.style.color = '#28a745';
      setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 3000);
    } catch (err) {
      saveStatus.textContent = '❌ Error: ' + err.message;
      saveStatus.style.color = '#dc3545';
      progressBar.style.display = 'none';
    }
  });

  // Helper functions (reused)
  function formatDuration(seconds) {
    if (!seconds) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}