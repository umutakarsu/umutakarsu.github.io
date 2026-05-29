// Electron main process.
// Responsibilities:
//   1. Create the desktop window and load the tool launcher (index.html).
//   2. Handle the native "Save PDF" dialog when a tool asks to save bytes to disk.
//
// Everything the user actually interacts with lives in the renderer (the HTML
// pages). The main process is just the desktop shell + access to the file system.

const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const fs = require('fs/promises');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#f0ecdf',
    title: 'Toolbox',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer can't touch Node directly...
      nodeIntegration: false,   // ...only the safe API we expose in preload.js
    },
  });

  win.loadFile('index.html');
  return win;
}

// --- Native "Save PDF" dialog -------------------------------------------------
// A tool sends us the finished PDF as raw bytes plus a suggested file name.
// We ask the user where to put it, write it, and report back what happened.
ipcMain.handle('save-pdf', async (_event, { bytes, defaultName }) => {
  const focused = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(focused, {
    title: 'Save PDF',
    defaultPath: defaultName || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (canceled || !filePath) {
    return { ok: false, canceled: true };
  }

  try {
    await fs.writeFile(filePath, Buffer.from(bytes));
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

app.whenReady().then(() => {
  // Keep the default menu (gives us Edit > Copy/Paste, which the canvas relies
  // on, plus View > Toggle DevTools for debugging). Trim it down later if you like.
  Menu.setApplicationMenu(Menu.getApplicationMenu());

  createWindow();

  // macOS: re-open a window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS (standard mac behaviour).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
