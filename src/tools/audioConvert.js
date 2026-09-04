// src/tools/audioConvert.js
import { setupDropZone } from '../core/fileHandler.js';
import { getAudioMetadata, renderAudioPreview } from '../core/audioUtils.js';
import { convertFile } from '../core/audioConverter.js';
import { showResultActions, getSharedFile, clearSharedFile } from '../core/toolBridge.js';

const PRESET_BITRATES = [
  { value: '64', label: '64 kbps (Low)' },
  { value: '96', label: '96 kbps' },
  { value: '128', label: '128 kbps (Standard)' },
  { value: '192', label: '192 kbps (High)' },
  { value: '256', label: '256 kbps (Very High)' },
  { value: '320', label: '320 kbps (Maximum)' },
];

export default function run(container) {
  container.innerHTML = `
    <h3>🎵 Audio Format Converter</h3>
    <p>Convert audio files to MP3, WAV, FLAC, OGG, or M4A (AAC).</p>
    <div class="converter-row" style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0;align-items:center;">
      <label>Output Format:
        <select id="formatSelect">
          <option value="mp3">MP3</option>
          <option value="wav">WAV</option>
          <option value="flac">FLAC</option>
          <option value="ogg">OGG</option>
          <option value="m4a">M4A (AAC)</option>
        </select>
      </label>
      <label>Bitrate (kbps):
        <select id="bitrateSelect">
          ${PRESET_BITRATES.map(b => `<option value="${b.value}" ${b.value === '128' ? 'selected' : ''}>${b.label}</option>`).join('')}
        </select>
      </label>
    </div>
    <div id="fileStatus">No file selected.</div>
    <button id="loadBtn">Select File</button>
    <button id="convertBtn" disabled>Convert</button>
    <div id="preview" style="margin-top:10px;"></div>
    <div id="status"></div>
    <div id="progressBar" style="margin-top:10px;display:none;width:100%;height:20px;background:#e9ecef;border-radius:4px;overflow:hidden;">
      <div id="progressFill" style="height:100%;width:0%;background:#28a745;transition:width 0.3s;"></div>
    </div>
  `;

  const formatSelect = container.querySelector('#formatSelect');
  const bitrateSelect = container.querySelector('#bitrateSelect');
  const loadBtn = container.querySelector('#loadBtn');
  const convertBtn = container.querySelector('#convertBtn');
  const fileStatus = container.querySelector('#fileStatus');
  const preview = container.querySelector('#preview');
  const status = container.querySelector('#status');
  const progressBar = container.querySelector('#progressBar');
  const progressFill = container.querySelector('#progressFill');

  let currentFile = null;

  async function loadFile(file) {
    currentFile = file;
    const metadata = await getAudioMetadata(file);
    fileStatus.textContent = `📁 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    renderAudioPreview(preview, metadata, file);
    status.textContent = '✅ File loaded. Select options and click Convert.';
    convertBtn.disabled = false;
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

  convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const inputFormat = currentFile.name.split('.').pop().toLowerCase();
    const outputFormat = formatSelect.value;
    if (inputFormat === outputFormat) {
      status.textContent = `⚠️ Input is already ${outputFormat.toUpperCase()}. Select a different format.`;
      return;
    }

    try {
      const bitrate = parseInt(bitrateSelect.value) || 128;
      progressBar.style.display = 'block';
      progressFill.style.width = '0%';
      status.textContent = 'Processing...';

      const updateProgress = (pct) => {
        progressFill.style.width = Math.min(pct, 95) + '%';
        status.textContent = `Processing... ${Math.round(pct)}%`;
      };

      updateProgress(10);
      const resultBlob = await convertFile(currentFile, outputFormat, bitrate);
      updateProgress(90);
      const newName = currentFile.name.replace(/\.[^.]+$/, '.') + outputFormat;
      showResultActions(resultBlob, newName, `audio/${outputFormat}`, container);

      progressFill.style.width = '100%';
      status.textContent = '✅ Conversion complete!';
      setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 3000);
    } catch (err) {
      status.textContent = '❌ Error: ' + err.message;
      progressBar.style.display = 'none';
    }
  });
}