// src/index.js
export { default as audioConvert } from './tools/audioConvert.js';
export { default as audioCompress } from './tools/audioCompress.js';
export { default as audioCut } from './tools/audioCut.js';
export { default as audioJoin } from './tools/audioJoin.js';
export { default as audioMetadata } from './tools/audioMetadata.js';

export { showResultActions, shareFile, getSharedFile, clearSharedFile } from './core/toolBridge.js';