# Toolbox

A small **desktop app** that holds a growing stack of personal tools.
Built with [Electron](https://www.electronjs.org/) so it's just HTML/CSS/JS —
the same things the rest of this site uses.

The first tool is a **PDF Maker**: a blank page you can draw on, type on, and
paste images into, then export as a PDF.

## Run it on your computer

You need [Node.js](https://nodejs.org/) installed (v18 or newer). Then, in a
terminal:

```bash
cd toolbox
npm install      # one time — downloads Electron
npm start        # opens the app window
```

`npm install` needs internet once (to fetch Electron). After that the app runs
fully offline — the drawing/PDF libraries are already vendored in `vendor/`.

## Turn it into a real Mac app (open it from Spotlight, no terminal)

Run the build **once** in a terminal:

```bash
cd toolbox
npm install        # if you haven't already
npm run build
```

This creates `PDF Maker.app` inside the `toolbox/dist/` folder. Then:

1. Open the `dist` folder in Finder.
2. Drag **PDF Maker.app** into your **Applications** folder.

That's it. From now on press <kbd>Cmd</kbd>+<kbd>Space</kbd>, type **PDF Maker**,
and hit Return — no terminal needed. (You can also rename the app later by
changing `"productName"` in `package.json`, e.g. to `"Toolbox"` once it holds
more tools, then running `npm run build` again.)

> The app is built and signed locally, so macOS opens it without the
> "unidentified developer" warning you get from downloaded apps.

## Using the PDF Maker

- **Select** — move, resize, or click an item to pick it.
- **Pen** — draw freehand. Pick a color and size on the toolbar.
- **Eraser** — paints white over a white page (good for cleaning up drawings).
- **Text** — drops in an editable text box (also press <kbd>T</kbd>).
- **Image…** — pick an image file. You can also **paste** (<kbd>Ctrl/Cmd</kbd>+<kbd>V</kbd>)
  or **drag-and-drop** an image onto the page.
- **Undo / Redo** — <kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> and <kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>.
- **Delete** — removes the selected item (<kbd>Del</kbd>).
- **Export PDF** — renders the page and opens a native Save dialog.
- **Zoom** — use the pill at the bottom-right (`−` / `100%` / `+` / `Fit`).
  The page just *looks* bigger or smaller, like in Word or Google Docs — your
  drawing and the exported PDF always stay full size. Click `100%` to reset,
  or `Fit` to size the page to the window.

Keyboard shortcuts: `V` select, `P` pen, `E` eraser, `T` text. Zoom with
<kbd>Ctrl/Cmd</kbd> `+` / `-` / `0`, or <kbd>Ctrl/Cmd</kbd>+scroll
(pinch on a trackpad).

## Project layout

```
toolbox/
├── package.json          # app config + "npm start"
├── main.js               # Electron main process: the window + native Save dialog
├── preload.js            # the only bridge between the page and the file system
├── index.html            # the launcher ("your stack" of tools)
├── tools/
│   └── pdf-maker/        # one self-contained tool
│       ├── pdf-maker.html
│       ├── pdf-maker.css
│       └── pdf-maker.js
└── vendor/               # offline copies of Fabric.js + jsPDF
```

## Adding a new tool later

1. Make a folder under `tools/`, e.g. `tools/image-to-pdf/`, with its own
   `*.html` / `*.css` / `*.js`.
2. Add one entry to the `TOOLS` list in `index.html` pointing at its HTML file.

That's it — the launcher picks it up automatically. If a tool needs to write
files, reuse the `window.toolbox.savePdf(...)` pattern (see `preload.js`) or add
a new bridge method there.

## Ideas for the next tools

- **Image → PDF**: combine several images into one multi-page PDF.
- **Merge / split PDFs**: reorder or extract pages.
- **Multi-page canvas**: add more than one page to the PDF Maker.
