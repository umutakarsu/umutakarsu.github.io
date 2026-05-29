// Preload script — the *only* bridge between the web page and the desktop.
// contextBridge exposes a tiny, explicit API on window.toolbox so the renderer
// never gets raw access to Node or the file system.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toolbox', {
  // Save a PDF to disk via a native dialog.
  //   bytes:       an ArrayBuffer / Uint8Array of the PDF file
  //   defaultName: suggested file name, e.g. "notes.pdf"
  // Returns: { ok: true, filePath } | { ok: false, canceled } | { ok: false, error }
  savePdf: (bytes, defaultName) =>
    ipcRenderer.invoke('save-pdf', { bytes: new Uint8Array(bytes), defaultName }),
});
