// src/core/audioUtils.js
// Audio metadata, formatting, and preview rendering utilities

export async function getAudioMetadata(file) {
  try {
    const mm = await import('music-metadata-browser');
    const arrayBuffer = await file.arrayBuffer();
    const metadata = await mm.parseBlob(new Blob([arrayBuffer], { type: file.type }));
    const { format, common } = metadata;
    const meta = common || {};

    let coverUrl = null;
    if (meta.picture?.length > 0) {
      const picture = meta.picture[0];
      const blob = new Blob([picture.data], { type: picture.format || 'image/jpeg' });
      coverUrl = URL.createObjectURL(blob);
    }

    return {
      format: format.container || file.name.split('.').pop(),
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
      duration: format.duration || null,
      sampleRate: format.sampleRate || null,
      channels: format.numberOfChannels || null,
      size: file.size,
      title: meta.title || file.name.replace(/\.[^.]+$/, ''),
      artist: meta.artist || 'Unknown',
      album: meta.album || null,
      year: meta.year || null,
      genre: meta.genre?.join(', ') || null,
      coverUrl,
    };
  } catch {
    // Fallback: Web Audio API
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const duration = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;
      const channels = audioBuffer.numberOfChannels;
      const format = file.name.split('.').pop().toLowerCase();
      const bitrate = duration > 0 ? Math.round((file.size * 8) / duration / 1000) : null;

      return {
        format,
        bitrate,
        duration,
        sampleRate,
        channels,
        size: file.size,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: 'Unknown',
        album: null,
        year: null,
        genre: null,
        coverUrl: null,
      };
    } catch {
      return {
        format: file.name.split('.').pop(),
        bitrate: null,
        duration: null,
        sampleRate: null,
        channels: null,
        size: file.size,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: 'Unknown',
        album: null,
        year: null,
        genre: null,
        coverUrl: null,
      };
    }
  }
}

export function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function renderAudioPreview(container, metadata, file, showPlayer = true) {
  const duration = metadata.duration ? formatDuration(metadata.duration) : '--:--';
  const bitrate = metadata.bitrate ? `${metadata.bitrate} kbps` : 'Unknown';
  const size = formatSize(metadata.size || file.size);

  const coverHtml = metadata.coverUrl
    ? `<img src="${metadata.coverUrl}" alt="Cover" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" />`
    : `<div style="width:80px;height:80px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:36px;color:white;">🎵</div>`;

  const playerHtml = showPlayer
    ? `<audio controls style="width:100%;margin-top:8px;"><source src="${URL.createObjectURL(file)}" type="${file.type || 'audio/mpeg'}" /></audio>`
    : '';

  container.innerHTML = `
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
    ${playerHtml}
  `;
}