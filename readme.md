# 991-AudioTools

**Client-side audio processing tools** – a collection of 5 pure JavaScript utilities that run entirely in your browser.  
No file uploads, no servers, no data leaving your device. Just fast, private, and secure audio manipulation.

---

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [File Structure](#file-structure)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
  - [Local Testing](#local-testing)
  - [Integration into Your Website](#integration-into-your-website)
- [Tool List](#tool-list)
- [Browser Compatibility](#browser-compatibility)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Features

- **100% Client-Side** – All processing happens in your browser. No files are uploaded to any server.
- **Privacy First** – Your audio files never leave your device. Perfect for sensitive or personal content.
- **5 Powerful Tools** – Convert, compress, cut, join, and edit metadata.
- **Modern Codec Support** – MP3, WAV, FLAC, OGG, and M4A (AAC) encoding/decoding via WebAssembly.
- **Modular Architecture** – Each tool is a standalone ES module. Import only what you need.
- **Framework Agnostic** – Works with any website or framework (React, Vue, vanilla HTML, etc.).
- **Lightweight & Fast** – Optimized WASM encoders for near-native performance.

---

## Technologies Used

- **JavaScript (ES Modules)** – Modern, modular code structure.
- **[@audio/encode](https://www.npmjs.com/package/@audio/encode)** – WebAssembly-based audio encoding for MP3, FLAC, OGG, and AAC.
- **[audiobuffer-to-wav](https://www.npmjs.com/package/audiobuffer-to-wav)** – Direct WAV export from AudioBuffer.
- **[music-metadata-browser](https://www.npmjs.com/package/music-metadata-browser)** – Parse ID3 tags and cover art.
- **[browser-id3-writer](https://www.npmjs.com/package/browser-id3-writer)** – Write metadata to MP3 files.
- **Web Audio API** – Decode and process audio data.
- **Canvas API** – Render audio waveforms.
- **File API** – Read and process local files without upload.

---

## File Structure

```
991-audiotools/
├── src/
│   ├── core/
│   │   ├── audioUtils.js        # Metadata, formatting, preview rendering
│   │   ├── audioConverter.js    # Audio conversion (MP3, WAV, FLAC, OGG, M4A)
│   │   ├── fileHandler.js       # File I/O, download, drop zone
│   │   ├── toolBridge.js        # Shared file management between tools
│   │   └── dragDrop.js          # Drag-and-drop overlay handler
│   ├── tools/
│   │   ├── audioConvert.js      # Format converter with bitrate control
│   │   ├── audioCompress.js     # Compress with quality slider
│   │   ├── audioCut.js          # Cut selection with waveform preview
│   │   ├── audioJoin.js         # Merge multiple audio files
│   │   └── audioMetadata.js     # Metadata viewer & editor (MP3 only)
│   └── index.js                 # Main entry point – exports all tools
├── test.html                    # Simple test harness for local development
├── LICENSE                      # MIT License
└── README.md                    # This file
```

---

## Installation & Setup

### Prerequisites

- Any modern web browser (Chrome, Firefox, Edge, Safari).
- For local development: a static file server (e.g., Live Server, Python HTTP Server).

### Get the Code

Clone the repository:

```bash
git clone https://github.com/rezashams991/991-audiotools.git
cd 991-audiotools
```

---

## Usage

### Local Testing

1. Open the project folder in your code editor.
2. Launch a local development server:
   - **VS Code**: Right-click `test.html` → "Open with Live Server".
   - **Python**: `python3 -m http.server 8000` then visit `http://localhost:8000/test.html`.
3. Click any tool button to test it.
4. Upload an audio file and follow the on-screen instructions.

> **Note:** The `test.html` file is a minimal testing harness. It demonstrates how to dynamically import each tool from the `src/index.js` module.

### Integration into Your Website

To use these tools in your own website, you have two simple options:

#### Option 1: Copy the `src/` folder into your project

1. Copy the entire `src/` folder from this repository into your project root (or any subfolder).
2. Import the desired tool in your HTML:

```html
<script type="importmap">
{
  "imports": {
    "@audio/encode": "https://cdn.jsdelivr.net/npm/@audio/encode/+esm",
    "audiobuffer-to-wav": "https://cdn.jsdelivr.net/npm/audiobuffer-to-wav@1.0.0/+esm",
    "music-metadata-browser": "https://cdn.jsdelivr.net/npm/music-metadata@11.12.1/+esm",
    "browser-id3-writer": "https://cdn.jsdelivr.net/npm/browser-id3-writer@4.4.0/+esm"
  }
}
</script>

<script type="module">
    // Adjust the path to match your project structure
    import { audioConvert, audioCompress } from './src/index.js';
    
    // Render the Format Converter inside a container
    const container = document.getElementById('tool-container');
    audioConvert(container);
</script>
```

#### Option 2: Keep this repository as a subfolder

1. Clone this repository into your project folder (e.g., `libs/991-audiotools`).
2. Import tools using the relative path:

```html
<script type="module">
    import { audioCut, audioJoin } from './libs/991-audiotools/src/index.js';
    // ... use as above
</script>
```

**Important:**  
- The tools will render their own UI inside the container you provide. No additional CSS is required (but you can style it to match your site).
- All file processing stays entirely in the browser – no data is ever sent to a server.

---

## Tool List

| Tool | Description |
|------|-------------|
| **🎵 Format Converter** | Convert audio files between MP3, WAV, FLAC, OGG, and M4A (AAC). Adjustable bitrate. |
| **🗜 Compress** | Reduce audio file size by lowering bitrate. Shows real-time size reduction and savings. |
| **✂️ Cut** | Select and extract a portion of an audio file. Visual waveform with drag handles and live preview. |
| **🔗 Join** | Combine multiple audio files into one MP3. Reorder with up/down buttons; shows total duration and format summary. |
| **🏷️ Metadata** | View and edit ID3 tags (title, artist, album, year, genre, cover art). MP3 only. |

---

## Browser Compatibility

All tools are built with standard Web APIs and work in:

- **Chrome** 80+
- **Firefox** 75+
- **Edge** 80+
- **Safari** 13+

> **Note:** OGG Vorbis decoding depends on browser support. Firefox has native OGG support; Chrome/Edge require codec availability.

---

## Disclaimer

**This software is provided for educational and personal use only.**

- The tools are **client-side only** – no data is transmitted or stored externally.
- The author is **not responsible** for any misuse, data loss, or damage resulting from the use of these tools.
- Always keep backups of your original files before processing them.

By using this software, you acknowledge that you understand and accept these terms.

---

## License

This project is licensed under the **MIT License**.  
See the [`LICENSE`](https://github.com/rezashams991/991-audiotools/blob/main/LICENSE) file for the full text.

**MIT License** – you are free to use, modify, distribute, and sublicense this software for any purpose, provided that the original copyright notice and permission notice are included.

---

*Built with ❤ by [Reza Shams](https://github.com/rezashams991)*