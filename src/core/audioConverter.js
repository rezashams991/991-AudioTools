// src/core/audioConverter.js
// Audio conversion using @audio/encode for MP3/FLAC/OGG/AAC and audiobuffer-to-wav for WAV

import encode from '@audio/encode';
import toWav from 'audiobuffer-to-wav';

const VALID_MP3_BITRATES = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

function roundToValidMp3Bitrate(bitrate) {
  if (!bitrate) return 128;
  let closest = VALID_MP3_BITRATES[0];
  for (const b of VALID_MP3_BITRATES) {
    if (Math.abs(b - bitrate) < Math.abs(closest - bitrate)) closest = b;
  }
  return closest;
}

function getChannelDataAsArray(audioBuffer) {
  const channelData = [];
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }
  return channelData;
}

export async function convertAudioBuffer(audioBuffer, format, bitrate = 128) {
  if (format === 'wav') {
    return new Blob([toWav(audioBuffer)], { type: 'audio/wav' });
  }

  const channelData = getChannelDataAsArray(audioBuffer);
  const finalBitrate = format === 'mp3' ? roundToValidMp3Bitrate(bitrate) : bitrate;

  const options = {
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    bitrate: finalBitrate,
  };

  let encodedBuffer;
  switch (format) {
    case 'mp3': encodedBuffer = await encode.mp3(channelData, options); break;
    case 'flac': encodedBuffer = await encode.flac(channelData, options); break;
    case 'ogg': encodedBuffer = await encode.ogg(channelData, options); break;
    case 'aac':
    case 'm4a': encodedBuffer = await encode.aac(channelData, options); break;
    default: throw new Error(`Unsupported format: ${format}`);
  }

  const mimeType = format === 'm4a' ? 'audio/mp4' : `audio/${format}`;
  return new Blob([encodedBuffer], { type: mimeType });
}

export async function convertFile(file, targetFormat, bitrate = 128) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error(`Failed to decode audio: ${err.message}`);
  }
  return convertAudioBuffer(audioBuffer, targetFormat, bitrate);
}

export const convertToMp3 = (audioBuffer, bitrate = 128) => convertAudioBuffer(audioBuffer, 'mp3', bitrate);
export const convertToWav = (audioBuffer) => convertAudioBuffer(audioBuffer, 'wav');
export const convertToFlac = (audioBuffer, bitrate = 128) => convertAudioBuffer(audioBuffer, 'flac', bitrate);
export const convertToOgg = (audioBuffer, bitrate = 128) => convertAudioBuffer(audioBuffer, 'ogg', bitrate);
export const convertToM4a = (audioBuffer, bitrate = 128) => convertAudioBuffer(audioBuffer, 'm4a', bitrate);