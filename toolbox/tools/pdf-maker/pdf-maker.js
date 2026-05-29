// PDF Maker — a freeform page you can draw on, type on, and paste images into,
// then export as a PDF. Built on Fabric.js (the canvas) + jsPDF (the export).
//
// Mental model: the white area is one A4 page. Everything on it is a Fabric
// "object" (a pen stroke, a text box, an image) that you can select and move.

(() => {
  'use strict';

  // A4 at 96 DPI, in pixels. The canvas works at this fixed resolution so the
  // exported PDF maps cleanly onto a real A4 page.
  const A4 = { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } };

  let orientation = 'portrait';

  // The page's *logical* size never changes with zoom — only the on-screen
  // scale does. All object coordinates and the PDF export live in this space.
  const pageSize = () => A4[orientation];

  // Zoom = view scale only, like Word / Google Docs. 1 means 100%.
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4;
  let zoom = 1;

  // --- Set up the Fabric canvas ---------------------------------------------
  const canvas = new fabric.Canvas('paper', {
    width: A4[orientation].w,
    height: A4[orientation].h,
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
  });

  // --- DOM handles -----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const colorInput = $('color');
  const sizeInput = $('size');
  const toast = $('toast');

  // ===========================================================================
  // Tool modes (select / pen / eraser / text)
  // ===========================================================================
  let mode = 'select';

  function setMode(next) {
    mode = next;
    document.querySelectorAll('.tool').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === next)
    );

    // Pen and eraser both use Fabric's free-drawing mode.
    canvas.isDrawingMode = next === 'pen' || next === 'eraser';
    canvas.selection = next === 'select';

    if (canvas.isDrawingMode) {
      const brush = new fabric.PencilBrush(canvas);
      // The eraser is just a white brush — simple and reliable on a white page.
      brush.color = next === 'eraser' ? '#ffffff' : colorInput.value;
      brush.width = next === 'eraser'
        ? Math.max(10, Number(sizeInput.value) * 2)
        : Number(sizeInput.value);
      canvas.freeDrawingBrush = brush;
    }

    // In non-draw modes, objects should be selectable again.
    canvas.forEachObject((o) => (o.selectable = next === 'select' ? true : o.selectable));
    canvas.requestRenderAll();
  }

  document.querySelectorAll('.tool').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === 'text') return addText();
      setMode(btn.dataset.mode);
    })
  );

  // ===========================================================================
  // Color & size
  // ===========================================================================
  colorInput.addEventListener('input', () => {
    if (canvas.freeDrawingBrush && mode === 'pen') {
      canvas.freeDrawingBrush.color = colorInput.value;
    }
    // If a text object is selected, recolor it too.
    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'i-text') {
      obj.set('fill', colorInput.value);
      canvas.requestRenderAll();
      saveState();
    }
  });

  sizeInput.addEventListener('input', () => {
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = mode === 'eraser'
        ? Math.max(10, Number(sizeInput.value) * 2)
        : Number(sizeInput.value);
    }
  });

  // ===========================================================================
  // Text
  // ===========================================================================
  function addText(left, top) {
    const text = new fabric.IText('Type here', {
      left: left ?? pageSize().w / 2 - 60,
      top: top ?? pageSize().h / 2 - 20,
      fontFamily: '-apple-system, "Segoe UI", sans-serif',
      fontSize: Math.max(14, Number(sizeInput.value) * 4),
      fill: colorInput.value,
    });
    setMode('select');
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    canvas.requestRenderAll();
  }

  // ===========================================================================
  // Images: file picker, paste, and drag-and-drop
  // ===========================================================================
  function addImageFromDataURL(dataURL, left, top) {
    fabric.Image.fromURL(dataURL, (img) => {
      // Scale the image down so it always fits comfortably on the page.
      const { w, h } = pageSize();
      const scale = Math.min(1, (w * 0.8) / img.width, (h * 0.8) / img.height);
      img.scale(scale);
      img.set({
        left: left ?? (w - img.width * scale) / 2,
        top: top ?? (h - img.height * scale) / 2,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    });
  }

  function readFilesAsImages(files, left, top) {
    [...files]
      .filter((f) => f.type.startsWith('image/'))
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => addImageFromDataURL(e.target.result, left, top);
        reader.readAsDataURL(file);
      });
  }

  // "Image…" button -> hidden file input
  $('add-image').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (e) => {
    readFilesAsImages(e.target.files);
    e.target.value = ''; // allow picking the same file again
  });

  // Paste (Ctrl/Cmd+V): images become pictures, plain text becomes a text box.
  document.addEventListener('paste', (e) => {
    const items = [...(e.clipboardData?.items || [])];
    const imageItem = items.find((it) => it.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      readFilesAsImages([imageItem.getAsFile()]);
      return;
    }
    // Don't hijack paste while the user is editing a text box.
    const active = canvas.getActiveObject();
    if (active && active.isEditing) return;
    const text = e.clipboardData?.getData('text');
    if (text) {
      e.preventDefault();
      const t = new fabric.IText(text, {
        left: 60,
        top: 60,
        fontFamily: '-apple-system, "Segoe UI", sans-serif',
        fontSize: Math.max(14, Number(sizeInput.value) * 4),
        fill: colorInput.value,
      });
      canvas.add(t);
      canvas.setActiveObject(t);
      canvas.requestRenderAll();
    }
  });

  // Drag-and-drop image files straight onto the page.
  const stage = $('stage');
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    const pointer = canvas.getPointer(e);
    readFilesAsImages(e.dataTransfer.files, pointer.x, pointer.y);
  });

  // ===========================================================================
  // Zoom — scales only how big the page looks on screen. The drawing and the
  // exported PDF always stay at full resolution.
  // ===========================================================================
  const zoomLabel = $('zoom-label');

  function applyZoom(level) {
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level));
    const { w, h } = pageSize();
    canvas.setZoom(zoom);                 // scale the content...
    canvas.setWidth(w * zoom);            // ...and grow/shrink the canvas to match
    canvas.setHeight(h * zoom);
    canvas.requestRenderAll();
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }

  const zoomBy = (factor) => applyZoom(zoom * factor);

  function fitToWindow() {
    const padding = 48; // a little breathing room around the page
    const { w, h } = pageSize();
    applyZoom(Math.min((stage.clientWidth - padding) / w, (stage.clientHeight - padding) / h));
  }

  $('zoom-in').addEventListener('click', () => zoomBy(1.25));
  $('zoom-out').addEventListener('click', () => zoomBy(1 / 1.25));
  $('zoom-label').addEventListener('click', () => applyZoom(1)); // click % -> 100%
  $('zoom-fit').addEventListener('click', fitToWindow);

  // Ctrl/Cmd + scroll wheel, and trackpad pinch (which arrives as ctrl+wheel).
  stage.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
    },
    { passive: false }
  );

  // ===========================================================================
  // Delete / clear
  // ===========================================================================
  function deleteSelection() {
    const active = canvas.getActiveObject();
    if (active && active.isEditing) return; // let Backspace edit text instead
    canvas.getActiveObjects().forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  $('delete').addEventListener('click', deleteSelection);

  $('clear').addEventListener('click', () => {
    if (canvas.getObjects().length === 0) return;
    if (!confirm('Clear the whole page? This cannot be undone with one click.')) return;
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    applyZoom(zoom); // clear() resets the view, so re-apply the current zoom
  });

  document.addEventListener('keydown', (e) => {
    // Zoom shortcuts work everywhere (like a document editor).
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') { e.preventDefault(); return zoomBy(1.25); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); return zoomBy(1 / 1.25); }
      if (e.key === '0') { e.preventDefault(); return applyZoom(1); }
    }

    const active = canvas.getActiveObject();
    const editing = active && active.isEditing;
    if ((e.key === 'Delete' || e.key === 'Backspace') && !editing) {
      e.preventDefault();
      deleteSelection();
    }
    if (editing) return; // don't fire shortcuts while typing
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }
    // Single-key tool switches
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'v') setMode('select');
      if (e.key === 'p') setMode('pen');
      if (e.key === 'e') setMode('eraser');
      if (e.key === 't') addText();
    }
  });

  // ===========================================================================
  // Undo / redo (snapshot-based)
  // ===========================================================================
  let history = [];
  let redoStack = [];
  let restoring = false;

  function snapshot() {
    return JSON.stringify(canvas.toJSON());
  }

  function saveState() {
    if (restoring) return;
    redoStack = [];
    history.push(snapshot());
    if (history.length > 30) history.shift(); // cap memory use
  }

  function restore(json) {
    restoring = true;
    canvas.loadFromJSON(json, () => {
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
      restoring = false;
    });
  }

  function undo() {
    if (history.length <= 1) return;
    redoStack.push(history.pop());
    restore(history[history.length - 1]);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const json = redoStack.pop();
    history.push(json);
    restore(json);
  }

  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);

  canvas.on('object:added', saveState);
  canvas.on('object:modified', saveState);
  canvas.on('object:removed', saveState);
  history.push(snapshot()); // record the initial empty page

  // ===========================================================================
  // Orientation
  // ===========================================================================
  $('orientation').addEventListener('change', (e) => {
    orientation = e.target.value;
    applyZoom(zoom); // re-size the page for the new orientation at current zoom
  });

  // ===========================================================================
  // Export to PDF
  // ===========================================================================
  $('export').addEventListener('click', async () => {
    // Deselect so selection handles don't end up in the image.
    canvas.discardActiveObject();

    // Capture at 100% so the exported resolution never depends on the zoom
    // level; render at 2x for a crisp result, then restore the user's view.
    const viewZoom = zoom;
    applyZoom(1);
    const dataURL = canvas.toDataURL({ format: 'png', multiplier: 2 });
    applyZoom(viewZoom);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.addImage(dataURL, 'PNG', 0, 0, pageW, pageH);

    const bytes = doc.output('arraybuffer');
    const result = await window.toolbox.savePdf(bytes, 'document.pdf');

    if (result.ok) {
      showToast('Saved ✓');
    } else if (result.canceled) {
      // user backed out — say nothing
    } else {
      showToast('Could not save: ' + (result.error || 'unknown error'), true);
    }
  });

  // ===========================================================================
  // Toast helper
  // ===========================================================================
  let toastTimer;
  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // Start in select mode at 100% zoom.
  setMode('select');
  applyZoom(1);
})();
