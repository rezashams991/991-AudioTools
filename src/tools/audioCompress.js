// src/tools/audioCompress.js
import { setupDropZone } from '../core/fileHandler.js';
import { getAudioMetadata, renderAudioPreview } from '../core/audioUtils.js';
import { convertToMp3 } from '../core/audioConverter.js';
import { showResultActions } from '../core/toolBridge.js';

const VALID_MP3_BITRATES = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

function roundToValidMp3Bitrate(bitrate) {
  if (!bitrate) return 128;
  let closest = VALID_MP3_BITRATES[0];
  for (const b of VALID_MP3_BITRATES) {
    if (Math.abs(b - bitrate) < Math.abs(closest - bitrate)) closest = b;
  }
  return closest;
}

export default function run(container) {
  container.innerHTML = `
    <h3>🗜 Audio Compressor</h3>
    <p>Reduce file size by lowering bitrate (quality).</p>
    <div style="margin:15px 0;padding:12px;background:#f8f9fa;border-radius:6px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <span>Current: <span id="currentBitrateDisplay">—</span> kbps</span>
        <span>Target: <span id="targetBitrateDisplay">—</span> kbps</span>
      </div>
      <input type="range" id="qualitySlider" min="0" max="100" value="50" step="1" style="width:100%;margin:10px 0;" disabled />
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;">
        <span>32 kbps (Low)</span>
        <span id="maxBitrateLabel">— kbps</span>
      </div>
    </div>
    <div id="fileStatus">No file selected.</div>
    <button id="loadBtn">Select File</button>
    <button id="compressBtn" disabled>Compress</button>
    <div id="preview" style="margin-top:10px;"></div>
    <div id="status"></div>
    <div id="progressBar" style="margin-top:10px;display:none;width:100%;height:20px;background:#e9ecef;border-radius:4px;overflow:hidden;">
      <div id="progressFill" style="height:100%;width:0%;background:#28a745;transition:width 0.3s;"></div>
    </div>
    <div id="resultInfo" style="margin-top:10px;display:none;padding:10px;background:#e8f5e9;border-radius:6px;border-left:4px solid #28a745;"></div>
  `;

  const loadBtn = container.querySelector('#loadBtn');
  const compressBtn = container.querySelector('#compressBtn');
  const fileStatus = container.querySelector('#fileStatus');
  const preview = container.querySelector('#preview');
  const status = container.querySelector('#status');
  const progressBar = container.querySelector('#progressBar');
  const progressFill = container.querySelector('#progressFill');
  const resultInfo = container.querySelector('#resultInfo');
  const qualitySlider = container.querySelector('#qualitySlider');
  const currentBitrateDisplay = container.querySelector('#currentBitrateDisplay');
  const targetBitrateDisplay = container.querySelector('#targetBitrateDisplay');
  const maxBitrateLabel = container.querySelector('#maxBitrateLabel');

  let currentFile = null;
  let currentBitrate = null;

  qualitySlider.addEventListener('input', () => {
    const val = parseInt(qualitySlider.value);
    const raw = Math.round(32 + (val / 100) * (currentBitrate - 32));
    targetBitrateDisplay.textContent = roundToValidMp3Bitrate(raw);
  });

  async function loadFile(file) {
    currentFile = file;
    const metadata = await getAudioMetadata(file);
    currentBitrate = metadata.bitrate || 192;
    if (!metadata.bitrate) status.textContent = '⚠️ Bitrate not detected. Assuming 192 kbps.';

    fileStatus.textContent = `📁 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    renderAudioPreview(preview, metadata, file);

    qualitySlider.disabled = false;
    qualitySlider.value = 50;
    currentBitrateDisplay.textContent = currentBitrate;
    maxBitrateLabel.textContent = `${currentBitrate} kbps`;
    const mid = roundToValidMp3Bitrate(Math.round(32 + (50 / 100) * (currentBitrate - 32)));
    targetBitrateDisplay.textContent = mid;

    status.textContent = '✅ File loaded. Adjust slider and click Compress.';
    compressBtn.disabled = false;
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

  compressBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    try {
      const raw = Math.round(32 + (parseInt(qualitySlider.value) / 100) * (currentBitrate - 32));
      const targetBitrate = roundToValidMp3Bitrate(raw);

      if (targetBitrate >= currentBitrate) {
        status.textContent = `⚠️ Target (${targetBitrate} kbps) must be lower than original (${currentBitrate} kbps).`;
        return;
      }

      const originalSize = currentFile.size;
      progressBar.style.display = 'block';
      progressFill.style.width = '0%';
      resultInfo.style.display = 'none';
      status.textContent = 'Decoding...';

      const arrayBuffer = await currentFile.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      progressFill.style.width = '30%';
      status.textContent = `Compressing to ${targetBitrate} kbps...`;
      const resultBlob = await convertToMp3(audioBuffer, targetBitrate);

      progressFill.style.width = '90%';
      const newSize = resultBlob.size;
      const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);
      const savedKB = (originalSize - newSize) / 1024;

      resultInfo.style.display = 'block';
      resultInfo.innerHTML = `
        ✅ Compression Complete!<br>
        Original: <strong>${(originalSize/1024).toFixed(1)} KB</strong> (${currentBitrate} kbps) →
        New: <strong>${(newSize/1024).toFixed(1)} KB</strong> (${targetBitrate} kbps)<br>
        💾 Saved ${savedKB.toFixed(1)} KB (${reduction}% reduction)
      `;

      const newName = currentFile.name.replace(/\.[^.]+$/, '_compressed.mp3');
      showResultActions(resultBlob, newName, 'audio/mp3', container);

      progressFill.style.width = '100%';
      status.textContent = '✅ Compressed!';
      setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 3000);
    } catch (err) {
      status.textContent = '❌ Error: ' + err.message;
      progressBar.style.display = 'none';
    }
  });
}