// src/tools/audioJoin.js
import { setupDropZone } from '../core/fileHandler.js';
import { getAudioMetadata } from '../core/audioUtils.js';
import { convertToMp3 } from '../core/audioConverter.js';
import { showResultActions, getSharedFile, clearSharedFile } from '../core/toolBridge.js';

function fmtDuration(seconds) {
  if (!seconds) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function run(container) {
  container.innerHTML = `
    <h3>🔗 Audio Joiner</h3>
    <p>Combine multiple audio files into one MP3. Use ⬆/⬇ to reorder (top = plays first).</p>
    <div id="fileStatus">No files selected.</div>
    <div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;">
      <button id="addBtn">➕ Add Files</button>
      <button id="joinBtn" style="background:#28a745;color:#fff;border:none;padding:6px 18px;" disabled>🔗 Join</button>
      <button id="clearBtn" style="background:#dc3545;color:#fff;border:none;padding:6px 18px;">🗑️ Clear</button>
    </div>
    <ul id="fileList" style="list-style:none;padding:0;margin-bottom:15px;border:1px solid #dee2e6;border-radius:4px;min-height:20px;max-height:350px;overflow-y:auto;"></ul>
    <div id="outputInfo" style="display:none;margin:10px 0;padding:12px;background:#f0f8ff;border-radius:6px;border-left:4px solid #007bff;font-size:14px;">
      <div><strong>📦 Output Summary</strong></div>
      <div id="outputDetails" style="margin-top:5px;"></div>
      <div style="margin-top:5px;font-size:12px;color:#856404;">⚠️ Metadata (title, artist, cover) will be removed. Output is plain MP3.</div>
    </div>
    <div id="status"></div>
    <div id="progressBar" style="margin-top:10px;display:none;width:100%;height:20px;background:#e9ecef;border-radius:4px;overflow:hidden;">
      <div id="progressFill" style="height:100%;width:0%;background:#28a745;transition:width 0.3s;"></div>
    </div>
  `;

  const addBtn = container.querySelector('#addBtn');
  const joinBtn = container.querySelector('#joinBtn');
  const clearBtn = container.querySelector('#clearBtn');
  const fileList = container.querySelector('#fileList');
  const fileStatus = container.querySelector('#fileStatus');
  const status = container.querySelector('#status');
  const progressBar = container.querySelector('#progressBar');
  const progressFill = container.querySelector('#progressFill');
  const outputInfo = container.querySelector('#outputInfo');
  const outputDetails = container.querySelector('#outputDetails');

  let selectedFiles = [];

  function renderFileList() {
    fileList.innerHTML = '';
    if (selectedFiles.length === 0) {
      fileList.style.minHeight = '20px';
      outputInfo.style.display = 'none';
      joinBtn.disabled = true;
      fileStatus.textContent = 'No files selected.';
      return;
    }

    fileList.style.minHeight = '60px';
    selectedFiles.forEach((file, index) => {
      const li = document.createElement('li');
      li.style.cssText = 'padding:12px 16px;margin-bottom:6px;background:#fff;border:1px solid #e9ecef;border-radius:6px;display:flex;justify-content:space-between;align-items:center;';

      const left = document.createElement('span');
      left.textContent = `${index + 1}. ${file.name}`;
      left.style.cssText = 'font-size:14px;font-weight:500;';

      const right = document.createElement('span');
      right.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:#6c757d;';

      if (file._duration) {
        const durSpan = document.createElement('span');
        durSpan.textContent = fmtDuration(file._duration);
        durSpan.style.cssText = 'font-family:monospace;background:#f1f3f5;padding:2px 8px;border-radius:4px;';
        right.appendChild(durSpan);
      }

      const sizeSpan = document.createElement('span');
      sizeSpan.textContent = formatSize(file.size);
      right.appendChild(sizeSpan);

      const upBtn = document.createElement('button');
      upBtn.textContent = '⬆';
      upBtn.style.cssText = 'background:none;border:1px solid #ced4da;border-radius:4px;cursor:pointer;padding:2px 6px;font-size:14px;';
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => {
        if (index > 0) {
          [selectedFiles[index - 1], selectedFiles[index]] = [selectedFiles[index], selectedFiles[index - 1]];
          updateState();
        }
      });
      right.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.textContent = '⬇';
      downBtn.style.cssText = 'background:none;border:1px solid #ced4da;border-radius:4px;cursor:pointer;padding:2px 6px;font-size:14px;';
      downBtn.disabled = index === selectedFiles.length - 1;
      downBtn.addEventListener('click', () => {
        if (index < selectedFiles.length - 1) {
          [selectedFiles[index + 1], selectedFiles[index]] = [selectedFiles[index], selectedFiles[index + 1]];
          updateState();
        }
      });
      right.appendChild(downBtn);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#dc3545;font-weight:bold;font-size:18px;padding:0 4px;';
      removeBtn.addEventListener('click', () => {
        selectedFiles.splice(index, 1);
        updateState();
      });
      right.appendChild(removeBtn);

      li.appendChild(left);
      li.appendChild(right);
      fileList.appendChild(li);
    });

    updateOutputInfo();
    joinBtn.disabled = false;
    fileStatus.textContent = `${selectedFiles.length} file(s) selected.`;
  }

  async function updateOutputInfo() {
    if (selectedFiles.length < 2) {
      outputInfo.style.display = 'none';
      return;
    }

    let totalDuration = 0;
    let maxBitrate = 0;
    let formats = new Set();
    let channels = new Set();

    for (const file of selectedFiles) {
      try {
        let meta = file._metadata;
        if (!meta) {
          meta = await getAudioMetadata(file);
          file._metadata = meta;
        }
        if (meta.duration) {
          file._duration = meta.duration;
          totalDuration += meta.duration;
        }
        if (meta.bitrate && meta.bitrate > maxBitrate) maxBitrate = meta.bitrate;
        if (meta.format) formats.add(meta.format);
        if (meta.channels) channels.add(meta.channels);
      } catch (e) { /* ignore */ }
    }

    outputDetails.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;">
        <span>Formats: <strong>${formats.size ? Array.from(formats).join(', ') : 'mixed'}</strong></span>
        <span>Total: <strong>${fmtDuration(totalDuration)}</strong></span>
        <span>Channels: <strong>${channels.size ? (channels.size === 1 ? `${Array.from(channels)[0]}ch` : `${Math.max(...Array.from(channels))}ch max`) : 'unknown'}</strong></span>
        <span>Bitrate: <strong>${maxBitrate ? maxBitrate + ' kbps' : 'unknown'}</strong></span>
        <span style="grid-column:1/3;">Files: <strong>${selectedFiles.length}</strong></span>
      </div>
    `;
    outputInfo.style.display = 'block';
  }

  function updateState() { renderFileList(); }

  const shared = getSharedFile();
  if (shared?.blob) {
    const file = new File([shared.blob], shared.fileName, { type: shared.mimeType || 'audio/mpeg' });
    clearSharedFile();
    selectedFiles.push(file);
    setTimeout(updateState, 100);
  }

  setupDropZone(container, 'audio/*', async (files) => {
    for (const f of files) {
      try {
        const meta = await getAudioMetadata(f);
        f._metadata = meta;
        if (meta.duration) f._duration = meta.duration;
      } catch (_) {}
      selectedFiles.push(f);
    }
    updateState();
    status.textContent = `✅ ${files.length} file(s) added.`;
  });

  addBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.style.display = 'none';
    container.appendChild(input);
    input.addEventListener('change', async () => {
      for (const f of input.files || []) {
        try {
          const meta = await getAudioMetadata(f);
          f._metadata = meta;
          if (meta.duration) f._duration = meta.duration;
        } catch (_) {}
        selectedFiles.push(f);
      }
      updateState();
      status.textContent = `✅ ${input.files.length} file(s) added.`;
      input.remove();
    });
    input.click();
  });

  clearBtn.addEventListener('click', () => {
    selectedFiles = [];
    updateState();
    status.textContent = '';
  });

  joinBtn.addEventListener('click', async () => {
    if (selectedFiles.length < 2) return;

    try {
      progressBar.style.display = 'block';
      progressFill.style.width = '0%';
      status.textContent = 'Reading files...';

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const decodedBuffers = [];
      let totalLength = 0;
      let maxChannels = 1;
      let sampleRate = 44100;

      for (let i = 0; i < selectedFiles.length; i++) {
        status.textContent = `Decoding ${i + 1}/${selectedFiles.length}...`;
        const arrayBuffer = await selectedFiles[i].arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        decodedBuffers.push(audioBuffer);
        totalLength += audioBuffer.length;
        maxChannels = Math.max(maxChannels, audioBuffer.numberOfChannels);
        if (i === 0) sampleRate = audioBuffer.sampleRate;
        progressFill.style.width = `${10 + ((i + 1) / selectedFiles.length) * 40}%`;
      }

      status.textContent = 'Merging...';
      const mergedBuffer = audioContext.createBuffer(maxChannels, totalLength, sampleRate);
      for (let ch = 0; ch < maxChannels; ch++) {
        const channelData = mergedBuffer.getChannelData(ch);
        let offset = 0;
        for (const buf of decodedBuffers) {
          const srcCh = ch < buf.numberOfChannels ? ch : 0;
          channelData.set(buf.getChannelData(srcCh), offset);
          offset += buf.length;
        }
      }

      progressFill.style.width = '70%';
      status.textContent = 'Converting to MP3...';
      const resultBlob = await convertToMp3(mergedBuffer, 128);

      progressFill.style.width = '95%';
      const newName = `joined_${selectedFiles.length}_files.mp3`;
      showResultActions(resultBlob, newName, 'audio/mp3', container);

      progressFill.style.width = '100%';
      status.textContent = '✅ Joining complete!';
      setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 3000);
    } catch (err) {
      status.textContent = '❌ Error: ' + err.message;
      progressBar.style.display = 'none';
    }
  });

  updateState();
}