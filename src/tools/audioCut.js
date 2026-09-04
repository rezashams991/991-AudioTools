// src/tools/audioCut.js
import { setupDropZone } from '../core/fileHandler.js';
import { getAudioMetadata, formatSize } from '../core/audioUtils.js';
import { convertToMp3 } from '../core/audioConverter.js';
import { showResultActions } from '../core/toolBridge.js';

function fmtTime(seconds) {
  if (!seconds || seconds === 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseTime(str) {
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export default function run(container) {
  container.innerHTML = `
    <h3>✂️ Audio Cutter</h3>
    <p>Drag handles to select portion (output as MP3).</p>
    <button id="loadBtn">Select File</button>
    <div id="preview" style="margin-top:15px;"></div>
    <div id="waveformContainer" style="margin-top:15px;display:none;background:#f8f9fa;border-radius:8px;padding:15px;box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <canvas id="waveformCanvas" style="width:100%;height:150px;display:block;cursor:pointer;border-radius:4px;background:#fff;border:1px solid #ddd;"></canvas>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-family:monospace;font-size:14px;color:#666;">
        <span id="startTime">00:00</span>
        <span id="playheadTime" style="font-weight:bold;color:#17a2b8;">--:--</span>
        <span id="endTime">00:00</span>
      </div>
      <div style="text-align:center;font-size:12px;color:#999;margin-top:-4px;margin-bottom:8px;">
        <span id="durationTime">Selected: 00:00</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:5px;align-items:center;justify-content:center;flex-wrap:wrap;">
        <label>Start: <input type="text" id="startInput" value="00:00" style="width:70px;text-align:center;border:1px solid #ccc;border-radius:4px;padding:4px;" /></label>
        <label>End: <input type="text" id="endInput" value="00:30" style="width:70px;text-align:center;border:1px solid #ccc;border-radius:4px;padding:4px;" /></label>
        <button id="playToggleBtn" style="padding:6px 18px;background:#17a2b8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">▶ Preview</button>
        <button id="cutBtn" style="padding:6px 18px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;" disabled>✂️ Cut</button>
      </div>
    </div>
    <div id="status" style="margin-top:10px;"></div>
    <div id="progressBar" style="margin-top:10px;display:none;width:100%;height:20px;background:#e9ecef;border-radius:4px;overflow:hidden;">
      <div id="progressFill" style="height:100%;width:0%;background:#28a745;transition:width 0.3s;"></div>
    </div>
  `;

  const loadBtn = container.querySelector('#loadBtn');
  const preview = container.querySelector('#preview');
  const waveformContainer = container.querySelector('#waveformContainer');
  const canvas = container.querySelector('#waveformCanvas');
  const ctx = canvas.getContext('2d');
  const startTime = container.querySelector('#startTime');
  const endTime = container.querySelector('#endTime');
  const playheadTime = container.querySelector('#playheadTime');
  const durationTime = container.querySelector('#durationTime');
  const startInput = container.querySelector('#startInput');
  const endInput = container.querySelector('#endInput');
  const playToggleBtn = container.querySelector('#playToggleBtn');
  const cutBtn = container.querySelector('#cutBtn');
  const status = container.querySelector('#status');
  const progressBar = container.querySelector('#progressBar');
  const progressFill = container.querySelector('#progressFill');

  let currentFile = null;
  let audioBuffer = null;
  let duration = 0;
  let startPercent = 0;
  let endPercent = 1;
  let isDragging = null;
  let audioContext = null;
  let isPlaying = false;
  let activeSource = null;
  let playStartContextTime = 0;
  let playOffsetSec = 0;

  function renderMetadataPreview(metadata, file) {
    const durationStr = metadata.duration ? fmtTime(metadata.duration) : '--:--';
    const bitrateStr = metadata.bitrate ? `${metadata.bitrate} kbps` : 'Unknown';
    const sizeStr = formatSize(metadata.size || file.size);

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
            ${metadata.format ? metadata.format.toUpperCase() : 'Unknown'} · ${durationStr} · ${bitrateStr} · ${sizeStr}
            ${metadata.sampleRate ? '· ' + Math.round(metadata.sampleRate/1000) + ' kHz' : ''}
            ${metadata.channels ? '· ' + metadata.channels + 'ch' : ''}
          </div>
        </div>
      </div>
    `;
  }

  function drawWaveform(buffer, playheadSec = -1) {
    if (!buffer) return;
    const data = buffer.getChannelData(0);
    const samples = 1024;
    const step = Math.floor(data.length / samples);
    const peaks = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        const idx = i * step + j;
        if (idx < data.length) sum += Math.abs(data[idx]);
      }
      peaks.push(sum / step);
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw waveform
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const y = (peaks[i] * h) / 2;
      if (i === 0) ctx.moveTo(x, h/2 - y);
      else ctx.lineTo(x, h/2 - y);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const y = (peaks[i] * h) / 2;
      if (i === 0) ctx.moveTo(x, h/2 + y);
      else ctx.lineTo(x, h/2 + y);
    }
    ctx.stroke();

    const startX = startPercent * w;
    const endX = endPercent * w;

    // Highlight selection
    ctx.fillStyle = 'rgba(40,167,69,0.15)';
    ctx.fillRect(startX, 0, endX - startX, h);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    // Draw handles
    ctx.fillStyle = '#28a745';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX + 8, 0);
    ctx.lineTo(startX + 8, h);
    ctx.lineTo(startX, h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX - 8, 0);
    ctx.lineTo(endX - 8, h);
    ctx.lineTo(endX, h);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Handle arrows
    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▶', startX + 4, h/2 + 5);
    ctx.fillText('◀', endX - 4, h/2 + 5);

    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#dc3545';
    ctx.font = '12px monospace';
    ctx.fillText(fmtTime(startPercent * duration), startX + 12, 14);

    
    ctx.textAlign = 'right';
    ctx.fillStyle = '#dc3545';
    ctx.font = '12px monospace';
    ctx.fillText(fmtTime(endPercent * duration), endX - 12, h - 6);

    // Playhead
    if (playheadSec >= 0) {
      const playX = (playheadSec / duration) * w;
      ctx.fillStyle = '#ffc107';
      ctx.fillRect(playX - 1, 0, 2, h);
      ctx.beginPath();
      ctx.moveTo(playX - 5, 0);
      ctx.lineTo(playX + 5, 0);
      ctx.lineTo(playX, 6);
      ctx.fill();
      playheadTime.textContent = fmtTime(playheadSec);
      playheadTime.style.color = '#ffc107';
    } else {
      playheadTime.textContent = '--:--';
      playheadTime.style.color = '#17a2b8';
    }
  }

  function updateTimeDisplay() {
    const startSec = startPercent * duration;
    const endSec = endPercent * duration;
    const selectedDuration = endSec - startSec;

    startTime.textContent = '00:00';
    endTime.textContent = fmtTime(duration);
    durationTime.textContent = 'Selected: ' + fmtTime(selectedDuration);
    startInput.value = fmtTime(startSec);
    endInput.value = fmtTime(endSec);

    if (!isPlaying) {
      playheadTime.textContent = '--:--';
      playheadTime.style.color = '#17a2b8';
    }
  }

  function getCursorPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }

  function stopPlayback() {
    if (activeSource) {
      try { activeSource.stop(); } catch(e) {}
      activeSource.disconnect();
      activeSource = null;
    }
    isPlaying = false;
    playToggleBtn.textContent = '▶ Preview';
    playToggleBtn.style.background = '#17a2b8';
    playheadTime.textContent = '--:--';
    playheadTime.style.color = '#17a2b8';
    drawWaveform(audioBuffer);
  }

  function updatePlayhead() {
    if (!isPlaying || !audioBuffer) return;
    const currentSec = playOffsetSec + (audioContext.currentTime - playStartContextTime);
    if (currentSec > endPercent * duration) { stopPlayback(); return; }
    drawWaveform(audioBuffer, currentSec);
    requestAnimationFrame(updatePlayhead);
  }

  function togglePlayback() {
    if (!audioBuffer) return;
    if (isPlaying) { stopPlayback(); return; }

    const startSec = startPercent * duration;
    const endSec = endPercent * duration;
    const playDuration = endSec - startSec;
    if (playDuration < 0.1) {
      status.textContent = '⚠️ Selected portion too short.';
      return;
    }

    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();

    activeSource = audioContext.createBufferSource();
    activeSource.buffer = audioBuffer;
    activeSource.connect(audioContext.destination);
    activeSource.start(0, startSec, playDuration);

    playStartContextTime = audioContext.currentTime;
    playOffsetSec = startSec;
    isPlaying = true;
    playToggleBtn.textContent = '⏹ Stop';
    playToggleBtn.style.background = '#dc3545';
    playheadTime.textContent = fmtTime(startSec);
    playheadTime.style.color = '#ffc107';

    activeSource.onended = () => { if (isPlaying) stopPlayback(); };
    requestAnimationFrame(updatePlayhead);
  }

  async function loadFile(file) {
    stopPlayback();
    currentFile = file;
    const metadata = await getAudioMetadata(file);
    renderMetadataPreview(metadata, file);

    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    duration = audioBuffer.duration;

    startPercent = 0;
    endPercent = Math.min(30 / duration, 1);
    waveformContainer.style.display = 'block';
    canvas.width = canvas.parentElement.clientWidth || 800;
    canvas.height = 150;
    drawWaveform(audioBuffer);
    updateTimeDisplay();
    cutBtn.disabled = false;
    status.textContent = '✅ File loaded. Drag handles to select portion.';
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

  canvas.addEventListener('mousedown', (e) => {
    const x = getCursorPosition(e);
    const distStart = Math.abs(x - startPercent);
    const distEnd = Math.abs(x - endPercent);
    if (distStart < distEnd && distStart < 0.05) isDragging = 'start';
    else if (distEnd < distStart && distEnd < 0.05) isDragging = 'end';
    else {
      const mid = (startPercent + endPercent) / 2;
      const offset = x - mid;
      const newStart = Math.max(0, startPercent + offset);
      const newEnd = Math.min(1, endPercent + offset);
      if (newStart >= 0 && newEnd <= 1 && newEnd - newStart > 0.01) {
        startPercent = newStart;
        endPercent = newEnd;
        drawWaveform(audioBuffer);
        updateTimeDisplay();
      }
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging || !audioBuffer) return;
    const x = getCursorPosition(e);
    if (isDragging === 'start') startPercent = Math.max(0, Math.min(endPercent - 0.01, x));
    else if (isDragging === 'end') endPercent = Math.min(1, Math.max(startPercent + 0.01, x));
    drawWaveform(audioBuffer, isPlaying ? playOffsetSec + (audioContext.currentTime - playStartContextTime) : -1);
    updateTimeDisplay();
  });

  document.addEventListener('mouseup', () => { isDragging = null; });

  startInput.addEventListener('change', () => {
    const val = parseTime(startInput.value);
    if (val >= 0 && val < endPercent * duration) {
      startPercent = val / duration;
      drawWaveform(audioBuffer);
      updateTimeDisplay();
    } else startInput.value = fmtTime(startPercent * duration);
  });

  endInput.addEventListener('change', () => {
    const val = parseTime(endInput.value);
    if (val > startPercent * duration && val <= duration) {
      endPercent = val / duration;
      drawWaveform(audioBuffer);
      updateTimeDisplay();
    } else endInput.value = fmtTime(endPercent * duration);
  });

  playToggleBtn.addEventListener('click', togglePlayback);

  cutBtn.addEventListener('click', async () => {
    if (!audioBuffer) return;
    try {
      stopPlayback();
      const startSec = startPercent * duration;
      const endSec = endPercent * duration;
      if (endSec - startSec < 0.5) {
        status.textContent = '❌ Selected portion too short (min 0.5s).';
        return;
      }

      progressBar.style.display = 'block';
      progressFill.style.width = '0%';
      status.textContent = 'Cutting...';
      progressFill.style.width = '20%';

      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(startSec * sampleRate);
      const endSample = Math.floor(endSec * sampleRate);
      const frameCount = endSample - startSample;
      const channels = audioBuffer.numberOfChannels;

      const newBuffer = audioContext.createBuffer(channels, frameCount, sampleRate);
      for (let ch = 0; ch < channels; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = newBuffer.getChannelData(ch);
        dst.set(src.subarray(startSample, endSample));
      }

      progressFill.style.width = '60%';
      status.textContent = 'Converting to MP3...';
      const resultBlob = await convertToMp3(newBuffer, 128);

      progressFill.style.width = '95%';
      const newName = currentFile.name.replace(/\.[^.]+$/, '_cut.mp3');
      showResultActions(resultBlob, newName, 'audio/mp3', container);

      progressFill.style.width = '100%';
      status.textContent = '✅ Cut complete!';
      setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 3000);
    } catch (err) {
      status.textContent = '❌ Error: ' + err.message;
      progressBar.style.display = 'none';
    }
  });

  window.addEventListener('resize', () => {
    if (audioBuffer && waveformContainer.style.display !== 'none') {
      canvas.width = canvas.parentElement.clientWidth || 800;
      drawWaveform(audioBuffer, isPlaying ? playOffsetSec + (audioContext.currentTime - playStartContextTime) : -1);
    }
  });
}