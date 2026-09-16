/* XPP front end for the xppcore-server protocol (docs/protocol.md).

   Plain browser JavaScript, no dependencies and no editor API: the host
   creates `new XppClient(rootElement, sendFunction)` and feeds every event
   object from the server to `client.receive(ev)`. web/serve.js hosts it in
   a browser; the VS Code extension hosts it in a webview. */
(function (global) {
  'use strict';

  const DASHES = [[], [1, 6], [], [4, 2], [1, 3], [4, 4], [1, 5], [4, 4, 4, 1], [4, 2], [1, 3]];
  const GREEK = {a: 'α', b: 'β', c: 'χ', d: 'δ', e: 'ε', f: 'φ', g: 'γ', h: 'η', i: 'ι', j: 'ϕ', k: 'κ',
    l: 'λ', m: 'μ', n: 'ν', o: 'ο', p: 'π', q: 'θ', r: 'ρ', s: 'σ', t: 'τ', u: 'υ', v: 'ϖ', w: 'ω',
    x: 'ξ', y: 'ψ', z: 'ζ', A: 'Α', B: 'Β', C: 'Χ', D: 'Δ', E: 'Ε', F: 'Φ', G: 'Γ', H: 'Η', I: 'Ι',
    K: 'Κ', L: 'Λ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Π', Q: 'Θ', R: 'Ρ', S: 'Σ', T: 'Τ', U: 'Υ', W: 'Ω',
    X: 'Ξ', Y: 'Ψ', Z: 'Ζ'};
  const TEXT_SIZES = [8, 10, 12, 14, 18]; /* xppaut's five font sizes */
  const AUTO_BUTTONS = [['Parameter', 'param'], ['Axes', 'axes'], ['Numerics', 'numerics'], ['Run', 'run'],
    ['Grab', 'grab'], ['Usr period', 'usr'], ['Clear', 'clear'], ['reDraw', 'redraw'], ['File', 'file']];
  /* keys typed while the AUTO tab is shown (auto_x11.c auto_keypress) */
  const AUTO_KEYS = {a: 'axes', n: 'numerics', g: 'grab', r: 'run', d: 'redraw', c: 'clear', u: 'usr', p: 'param', f: 'file'};

  /* the data browser's buttons: label, op, hint */
  const BROWSER_BUTTONS = [
    ['Find', 'find', 'Find the row where a column is closest to a value'],
    ['Get', 'get', 'Make the selected row the initial conditions'],
    ['Replace', 'replace', 'Replace a column by a formula'],
    ['Unrepl', 'unreplace', 'Undo the last Replace'],
    ['Table', 'table', 'Write a column as a function table file'],
    ['Load', 'load', 'Load data from a file'],
    ['Write', 'write', 'Write the rows from First to Last to a file'],
    ['First', 'first', 'Start the range at the selected row'],
    ['Last', 'last', 'End the range at the selected row'],
    ['Restore', 'restore', 'Redraw the plot from the rows First to Last'],
    ['Add col', 'addcol', 'Add a column computed from a formula'],
    ['Del col', 'delcol', 'Delete a column'],
  ];
  const BR_ROW = 20, BR_HEAD = 22, BR_TCOL = 110, BR_COL = 100;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* xppaut key names from a DOM keyboard event, or null */
  function keyName(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (e.key.length === 1) return e.key;
    const named = ['Escape', 'Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'ArrowLeft',
      'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'];
    return named.includes(e.key) ? e.key : null;
  }

  /* one drawing surface: a canvas that replays draw ops */
  class Surface {
    constructor(client, id, w, h) {
      this.client = client;
      this.id = id;
      this.canvas = el('canvas', 'xpp-canvas');
      this.canvas.tabIndex = 0;
      this.ctx = this.canvas.getContext('2d');
      this.overlay = null;
      this.resize(w, h);
      this.color = 0;
      this.lineWidth = 1;
      this.dash = 0;
      this.font = {size: 1, symbol: false, color: 0};
    }
    resize(w, h) {
      if (this.canvas.width === w && this.canvas.height === h) return;
      const old = this.canvas.width ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height) : null;
      this.canvas.width = w;
      this.canvas.height = h;
      this.clear();
      if (old) this.ctx.putImageData(old, 0, 0);
    }
    pen(i) {
      return this.client.colorOf(i);
    }
    apply() {
      const c = this.ctx;
      c.strokeStyle = c.fillStyle = this.pen(this.color);
      c.lineWidth = Math.max(1, this.lineWidth);
      c.setLineDash(DASHES[this.dash] || []);
    }
    clear() {
      const c = this.ctx;
      c.save();
      c.fillStyle = this.client.colorOf(-1);
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.restore();
    }
    textFont(size, symbol) {
      const px = TEXT_SIZES[Math.max(0, Math.min(4, size))];
      return (symbol ? 'italic ' : '') + px + 'px "DejaVu Sans Mono", Consolas, monospace';
    }
    run(ops) {
      const c = this.ctx;
      for (const o of ops) {
        switch (o[0]) {
          case 'clear': this.clear(); break;
          case 'color': this.color = o[1]; break;
          case 'lw': this.lineWidth = o[1]; break;
          case 'dash': this.dash = o[1]; break;
          case 'ls': break;
          case 'line':
            this.apply();
            c.beginPath();
            c.moveTo(o[1] + 0.5, o[2] + 0.5);
            c.lineTo(o[3] + 0.5, o[4] + 0.5);
            c.stroke();
            break;
          case 'point':
            this.apply();
            if (!o[3]) c.fillRect(o[1], o[2], 1, 1);
            else {
              const r = Math.round(o[3] / 1.41421356 + 0.5);
              c.beginPath();
              c.arc(o[1], o[2], r, 0, 2 * Math.PI);
              c.fill();
            }
            break;
          case 'bead':
            this.apply();
            c.beginPath();
            c.arc(o[1], o[2], 2, 0, 2 * Math.PI);
            c.fill();
            break;
          case 'frect': this.apply(); c.fillRect(o[1], o[2], o[3], o[4]); break;
          case 'rect': this.apply(); c.strokeRect(o[1] + 0.5, o[2] + 0.5, o[3], o[4]); break;
          case 'circle':
          case 'fcircle':
            this.apply();
            c.beginPath();
            c.arc(o[1], o[2], o[3], 0, 2 * Math.PI);
            o[0] === 'circle' ? c.stroke() : c.fill();
            break;
          case 'ellipse':
          case 'fellipse':
            this.apply();
            c.beginPath();
            c.ellipse(o[1] + o[3] / 2, o[2] + o[4] / 2, Math.abs(o[3] / 2), Math.abs(o[4] / 2), 0, 0, 2 * Math.PI);
            o[0] === 'ellipse' ? c.stroke() : c.fill();
            break;
          case 'cross':
            c.save();
            c.globalCompositeOperation = 'difference';
            c.strokeStyle = '#ffffff';
            c.lineWidth = 2;
            c.setLineDash([]);
            c.beginPath();
            c.moveTo(o[1] - 8, o[2]); c.lineTo(o[1] + 8, o[2]);
            c.moveTo(o[1], o[2] - 8); c.lineTo(o[1], o[2] + 8);
            c.stroke();
            c.restore();
            break;
          case 'font': this.font = {size: o[1], symbol: o[2] === 1, color: o[3]}; this.color = o[3]; break;
          case 'text':
            c.fillStyle = this.pen(0);
            c.font = this.textFont(1, false);
            c.fillText(o[3], o[1], o[2]);
            break;
          case 'rtext':
            this.apply();
            c.font = this.textFont(this.font.size, this.font.symbol);
            c.fillText(this.font.symbol ? greek(o[3]) : o[3], o[1], o[2]);
            break;
          case 'stext': this.richText(o[1], o[2], o[3], o[4]); break;
        }
      }
    }
    /* XPP rich text: \1 symbol, \0 roman, \s sub, \S super, \n normal */
    richText(x, y, s, size) {
      const c = this.ctx;
      let cx = x, cy = y, cs = size, symbol = false, buf = '';
      const sup = TEXT_SIZES[size] * 0.8, sub = sup / 2;
      const flush = () => {
        if (!buf) return;
        c.font = this.textFont(cs, false);
        c.fillStyle = this.pen(0);
        const t = symbol ? greek(buf) : buf;
        c.fillText(t, cx, cy);
        cx += c.measureText(t).width;
        buf = '';
      };
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && i + 1 < s.length) {
          flush();
          const k = s[++i];
          if (k === '0') symbol = false;
          else if (k === '1') symbol = true;
          else if (k === 'n') { cy = y; cs = size; }
          else if (k === 's') { cy += sub; if (size > 0) cs = size - 1; }
          else if (k === 'S') { cy -= sup; if (size > 0) cs = size - 1; }
        } else buf += s[i];
      }
      flush();
    }
    /* canvas coordinates of a mouse event */
    at(e) {
      const r = this.canvas.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) * this.canvas.width / r.width),
        Math.round((e.clientY - r.top) * this.canvas.height / r.height)];
    }
  }

  function greek(s) {
    return Array.from(s, ch => GREEK[ch] || ch).join('');
  }

  class XppClient {
    constructor(root, send) {
      this.root = root;
      this.send = send;
      this.palette = [];
      this.surfaces = new Map();
      this.menus = null;
      this.menuWhich = 0;
      this.state = null;
      this.pendingAsk = null;
      this.typeahead = [];
      this.busy = false;
      this.build();
    }

    colorOf(i) {
      if (i === -1 || i === undefined) return '#ffffff';
      if (i === 0) return '#000000';
      return this.palette[i] || '#000000';
    }

    /* ---- layout ---------------------------------------------------------------- */

    build() {
      const r = this.root;
      r.classList.add('xpp');
      r.innerHTML = '';
      this.titleBar = el('div', 'xpp-title', 'XPP');
      this.menuPanel = el('div', 'xpp-menu');
      /* the main plot, AUTO, animation and extra plot windows share this
         area as tabs: stacked below each other they end up off screen */
      this.plotArea = el('div', 'xpp-plots');
      this.tabBar = el('div', 'xpp-tabs');
      this.tabBar.hidden = true;
      const mainPage = el('div', 'xpp-page xpp-main-page');
      this.mainTitle = el('div', 'xpp-plot-title');
      this.mainHost = el('div', 'xpp-main-plot');
      mainPage.append(this.mainTitle, this.mainHost);
      this.plotArea.append(this.tabBar, mainPage);
      this.pages = new Map();
      this.addPage(1, 'Plot', mainPage);
      this.shownWin = 1;
      this.activeWin = 1;
      this.sidePanel = el('div', 'xpp-side');
      this.status = el('div', 'xpp-status');
      this.hint = el('span', 'xpp-hint');
      this.progress = el('span', 'xpp-progress');
      this.status.append(this.hint, this.progress);
      this.extraWindows = el('div', 'xpp-extra');
      this.errorBar = el('div', 'xpp-errors');
      this.logBox = el('details', 'xpp-log');
      this.logSummary = el('summary', '', 'Messages');
      this.logText = el('pre', 'xpp-log-text');
      this.logBox.append(this.logSummary, this.logText);
      this.logLines = 0;
      const middle = el('div', 'xpp-middle');
      middle.append(this.menuPanel, this.plotArea, this.sidePanel);
      r.append(this.titleBar, this.errorBar, middle, this.extraWindows, this.logBox, this.status);
      this.dialogLayer = el('div', 'xpp-dialogs');
      r.appendChild(this.dialogLayer);

      r.tabIndex = 0;
      r.addEventListener('keydown', e => this.onKey(e));
      new ResizeObserver(() => this.sendMainSize()).observe(this.mainHost);
      /* side by side needs room; a narrow panel stacks menus, plot and values */
      new ResizeObserver(() => r.classList.toggle('xpp-narrow', r.clientWidth < 760)).observe(r);
    }

    /* The error the user must see. One at a time: a newer one replaces it,
       and starting the next command clears it (the history stays under
       Messages). A load failure or crash is sticky: nothing else will run. */
    showError(text, detail, sticky) {
      if (this.errorSticky && !sticky) return;
      this.errorBar.innerHTML = '';
      this.errorSticky = !!sticky;
      const item = el('div', 'xpp-error-item');
      const msg = el('div', 'xpp-error-text', text);
      const close = el('button', 'xpp-close', '\u00d7');
      close.title = 'Dismiss';
      close.addEventListener('click', () => item.remove());
      item.append(msg, close);
      if (detail) {
        const pre = el('pre', 'xpp-error-detail', detail);
        item.appendChild(pre);
      }
      this.errorBar.appendChild(item);
    }

    clearError() {
      if (!this.errorSticky) this.errorBar.innerHTML = '';
    }

    /* text the program printed (what xppaut writes to its terminal) */
    log(text, scan = true) {
      /* output arrives in pieces: a line counts once its newline has come */
      const lines = ((this.logPartial || '') + String(text).replace(/\r/g, '')).split('\n');
      this.logPartial = lines.pop();
      for (const line of lines) {
        this.logText.textContent += line + '\n';
        this.logLines++;
        /* xppaut reports model and file problems only as printed text */
        const known = this.lastError && line.includes(this.lastError);
        if (scan && !known && /error|illegal|not found|can't|cannot|unable|bad |undefined|failed/i.test(line)) {
          this.recentErrors = (this.recentErrors || []).concat(line.trim()).slice(-10);
          clearTimeout(this.errorTimer);
          this.errorTimer = setTimeout(() => {
            if (this.recentErrors.length) this.showError('XPP reported a problem', this.recentErrors.join('\n'));
            this.recentErrors = [];
          }, 200);
        }
      }
      const extra = this.logText.textContent.length - 200000;
      if (extra > 0) this.logText.textContent = this.logText.textContent.slice(extra);
      this.logSummary.textContent = `Messages (${this.logLines})`;
      this.logText.scrollTop = this.logText.scrollHeight;
    }

    /* the server process ended */
    exited(code) {
      if (this.logPartial) this.log('\n');
      /* the summary below already shows what was printed */
      clearTimeout(this.errorTimer);
      this.recentErrors = [];
      this.busy = true;
      if (this.pendingAsk && this.pendingAsk.close) this.pendingAsk.close();
      this.pendingAsk = null;
      const tail = this.logText.textContent.trimEnd().split('\n').slice(-25).join('\n');
      if (!this.menus) {
        this.showError('XPP could not load this file. What it printed:', tail || '(nothing)', true);
      } else if (code) {
        this.showError(`XPP stopped unexpectedly (exit code ${code}). Last output:`, tail || '(nothing)', true);
      } else {
        this.hint.textContent = 'XPP has exited.';
      }
      this.logBox.open = !this.menus || !!code;
    }

    addPage(win, label, page, onClose) {
      const tab = el('button', 'xpp-tab', label);
      if (onClose) {
        const x = el('span', 'xpp-tab-close', '\u00d7');
        x.title = 'Close';
        x.addEventListener('click', e => {
          e.stopPropagation();
          this.removePage(win);
          onClose();
        });
        tab.appendChild(x);
      }
      tab.addEventListener('click', () => {
        this.showPage(win);
        /* a plot window tab also makes it xppaut's current graph */
        if (win <= 10 && !this.busy && this.activeWin !== win) this.send({cmd: 'click', win});
      });
      this.tabBar.appendChild(tab);
      this.pages.set(win, {page, tab});
      if (win !== 1) this.plotArea.appendChild(page);
      this.tabBar.hidden = this.pages.size < 2;
      this.showPage(this.shownWin || 1);
    }

    removePage(win) {
      const p = this.pages.get(win);
      if (!p) return;
      p.page.remove();
      p.tab.remove();
      this.pages.delete(win);
      this.tabBar.hidden = this.pages.size < 2;
      if (this.shownWin === win) this.showPage(1);
    }

    showPage(win) {
      if (!this.pages.has(win)) return;
      this.shownWin = win;
      for (const [w, p] of this.pages) {
        p.page.hidden = w !== win;
        p.tab.classList.toggle('xpp-tab-on', w === win);
      }
      if (win === 1) this.sendMainSize();
    }

    sendMainSize() {
      const s = this.surfaces.get(1);
      if (!s || !this.mainHost.clientWidth) return; /* hidden behind another tab */
      const w = Math.max(200, Math.floor(this.mainHost.clientWidth));
      const h = Math.max(150, Math.floor(this.mainHost.clientHeight));
      if (w === s.canvas.width && h === s.canvas.height) return;
      clearTimeout(this.sizeTimer);
      this.sizeTimer = setTimeout(() => {
        s.resize(w, h);
        this.send({cmd: 'size', win: 1, w, h});
      }, 150);
    }

    renderMenu() {
      const m = this.menus;
      if (!m) return;
      const which = ['main', 'file', 'num'][this.menuWhich] || 'main';
      const items = m[which], keys = m[which + '_keys'], hints = m[which + '_hints'];
      this.menuPanel.innerHTML = '';
      items.forEach((label, i) => {
        const b = el('button', 'xpp-menu-item', label);
        b.title = (hints && hints[i]) || '';
        const key = keys[i];
        b.addEventListener('click', () => this.key(key === '' ? 'Escape' : key));
        b.addEventListener('mouseenter', () => { this.hint.textContent = b.title; });
        this.menuPanel.appendChild(b);
      });
    }

    renderState() {
      const st = this.state;
      if (!st) return;
      if (!this.sideBuilt) this.buildSide();
      this.fillTable(this.parTable, st.pars);
      this.fillTable(this.icTable, st.ics);
      this.fillTable(this.bcTable, st.bcs || []);
      this.bcTable.box.hidden = !(st.bcs && st.bcs.length);
      this.delayTable.box.hidden = !st.delays;
      if (st.delays) this.fillTable(this.delayTable, st.delays);
      this.menuWhich = st.menu;
      this.updateSliders();
    }

    buildSide() {
      this.sidePanel.innerHTML = '';
      const button = (label, hint, click) => {
        const b = el('button', '', label);
        b.title = hint;
        b.addEventListener('click', click);
        return b;
      };
      const runs = el('div', 'xpp-go');
      runs.append(
        button('Integrate', 'Initialconds / Go (i g): run from the initial conditions below', () => this.keys(['i', 'g'])),
        button('From end', 'Initialconds / Last (i l): make the end of the last run the initial conditions and run from there',
          () => this.keys(['i', 'l'])));
      const views = el('div', 'xpp-row');
      views.append(
        button('Data', 'Browse the numbers of the last run (the X11 Data window)', () => this.openData()),
        button('Equations', 'List the equations', () => this.command({cmd: 'equations'})));
      this.sidePanel.append(runs, views);
      /* @ button lines of the ODE file */
      if (this.userButtons && this.userButtons.length) {
        const row = el('div', 'xpp-row xpp-userbuttons');
        this.userButtons.forEach((name, index) =>
          row.appendChild(button(name, 'Button defined in the ODE file', () => this.command({cmd: 'userbut', index}))));
        this.sidePanel.appendChild(row);
      }
      this.sidePanel.appendChild(this.buildSliders());
      const numberHint = 'A number, or %formula such as %2*pi';
      this.icTable = this.valueTable('Initial conditions', 'ic', numberHint, [
        button('Default', 'Initial conditions from the ODE file', () => this.command({cmd: 'default', kind: 'ic'})),
        button('x vs t', 'Plot the checked variables against time', () => this.plotChecked(0)),
        button('Phase', 'Phase plane of the first 2 or 3 checked variables', () => this.plotChecked(1)),
        button('Array', 'Array plot of the variables from the first to the second checked', () => this.plotChecked(2)),
      ]);
      this.parTable = this.valueTable('Parameters', 'par', numberHint, [
        button('Default', 'Parameters from the ODE file', () => this.command({cmd: 'default', kind: 'par'})),
      ]);
      this.bcTable = this.valueTable('Boundary conditions', 'bc', 'An expression that is zero at the boundary', [], true);
      this.delayTable = this.valueTable('Delay initial data', 'delay', 'An expression in t for t < 0', [], true);
      this.sidePanel.append(this.icTable.box, this.parTable.box, this.bcTable.box, this.delayTable.box);
      this.sideBuilt = true;
    }

    valueTable(title, kind, hint, actions, collapsed) {
      const box = el(collapsed ? 'details' : 'div', 'xpp-values');
      const head = el(collapsed ? 'summary' : 'div', 'xpp-values-title', title);
      box.appendChild(head);
      if (actions && actions.length) {
        const row = el('div', 'xpp-row');
        row.append(...actions);
        box.appendChild(row);
      }
      const list = el('div', 'xpp-values-list');
      box.appendChild(list);
      return {box, list, kind, hint, inputs: new Map(), checks: new Map()};
    }

    plotChecked(how) {
      const names = [...this.icTable.checks].filter(([, c]) => c.checked).map(([n]) => n);
      if (!names.length) {
        this.hint.textContent = 'Check variables in the Initial conditions list first';
        return;
      }
      this.icTable.checks.forEach(c => { c.checked = false; });
      this.command({cmd: 'plotvars', how, names});
    }

    /* ---- parameter sliders (the three at the bottom of the X11 main window) ---- */

    buildSliders() {
      const box = el('details', 'xpp-values xpp-sliders');
      box.appendChild(el('summary', 'xpp-values-title', 'Sliders'));
      this.sliders = [0, 1, 2].map(i => {
        const def = (this.sliderDefs || [])[i] || {};
        const row = el('div', 'xpp-slider');
        const pick = el('select', 'xpp-slider-name');
        const range = el('input', 'xpp-slider-range');
        range.type = 'range';
        range.min = 0;
        range.max = 1000;
        const lo = el('input', 'xpp-slider-lim');
        const hi = el('input', 'xpp-slider-lim');
        const val = el('span', 'xpp-slider-val');
        lo.value = def.lo ?? 0;
        hi.value = def.hi ?? 1;
        lo.title = 'Low end';
        hi.title = 'High end';
        range.title = 'Drag to change the value and integrate again';
        const sl = {pick, range, lo, hi, val, name: def.name || ''};
        pick.addEventListener('change', () => { sl.name = pick.value; this.updateSliders(true); });
        for (const f of [lo, hi]) {
          f.addEventListener('keydown', e => e.stopPropagation());
          f.addEventListener('change', () => this.updateSliders(true));
        }
        range.addEventListener('input', () => {
          const a = Number(lo.value), b = Number(hi.value);
          if (!sl.name || !Number.isFinite(a) || !Number.isFinite(b)) return;
          const v = a + (b - a) * Number(range.value) / 1000;
          val.textContent = Number(v.toPrecision(6));
          this.slide(sl.name, v);
        });
        const limits = el('div', 'xpp-slider-limits');
        limits.append(lo, val, hi);
        row.append(pick, range, limits);
        box.appendChild(row);
        return sl;
      });
      if ((this.sliderDefs || []).length) box.open = true;
      return box;
    }

    updateSliders(force) {
      const st = this.state;
      if (!this.sliders || !st) return;
      const names = [...st.pars.map(p => p[0]), ...st.ics.map(p => p[0])];
      const values = new Map([...st.pars, ...st.ics].map(([n, v]) => [n.toLowerCase(), v]));
      for (const sl of this.sliders) {
        if (sl.pick.options.length !== names.length + 1) {
          sl.pick.innerHTML = '';
          sl.pick.appendChild(el('option', '', 'Par/Var\u2026')).value = '';
          for (const n of names) sl.pick.appendChild(el('option', '', n)).value = n;
        }
        const match = names.find(n => n.toLowerCase() === sl.name.toLowerCase()) || '';
        sl.pick.value = match;
        sl.name = match;
        const v = values.get(sl.name.toLowerCase());
        if (v === undefined) {
          sl.val.textContent = '';
          continue;
        }
        sl.val.textContent = Number(Number(v).toPrecision(6));
        if (!force && document.activeElement === sl.range) continue; /* being dragged */
        const a = Number(sl.lo.value), b = Number(sl.hi.value);
        if (Number.isFinite(a) && Number.isFinite(b) && b !== a)
          sl.range.value = Math.max(0, Math.min(1000, Math.round(1000 * (v - a) / (b - a))));
      }
    }

    /* only the latest position matters: one slide at a time */
    slide(name, value) {
      this.pendingSlide = {name, value};
      if (!this.busy) this.flushSlide();
    }

    flushSlide() {
      const p = this.pendingSlide;
      if (!p) return;
      this.pendingSlide = null;
      this.busy = true;
      this.clearError();
      this.send({cmd: 'slide', name: p.name, value: p.value, rerun: 1});
    }

    /* ---- data browser ---------------------------------------------------------- */

    openData() {
      if (!this.pages.has('data')) this.buildData();
      this.showPage('data');
      this.brRender();
    }

    buildData() {
      const page = el('div', 'xpp-page xpp-window xpp-data');
      const tools = el('div', 'xpp-data-tools');
      for (const [label, op, hint] of BROWSER_BUTTONS) {
        const b = el('button', '', label);
        b.title = hint;
        b.addEventListener('click', () => this.command({cmd: 'browser', op, row: this.brSel || 0}));
        tools.appendChild(b);
      }
      this.brInfo = el('div', 'xpp-data-info');
      const scroll = el('div', 'xpp-data-scroll');
      scroll.tabIndex = 0;
      this.brHead = el('div', 'xpp-data-head');
      this.brSpace = el('div', 'xpp-data-space');
      scroll.append(this.brHead, this.brSpace);
      this.brScroll = scroll;
      this.brSel = 0;
      scroll.addEventListener('scroll', () => this.brRender());
      new ResizeObserver(() => this.brRender()).observe(scroll);
      this.brSpace.addEventListener('click', e => {
        const r = e.target.closest('[data-row]');
        if (!r) return;
        this.brSel = Number(r.dataset.row);
        this.brRender();
      });
      scroll.addEventListener('keydown', e => {
        const rows = this.br ? this.br.rows : 0;
        const page = Math.max(1, Math.floor((scroll.clientHeight - BR_HEAD) / BR_ROW) - 1);
        const moves = {ArrowUp: -1, ArrowDown: 1, PageUp: -page, PageDown: page, Home: -rows, End: rows};
        if (!(e.key in moves) || !rows) return;
        e.preventDefault();
        e.stopPropagation();
        this.brSel = Math.max(0, Math.min(rows - 1, this.brSel + moves[e.key]));
        this.brScrollTo(this.brSel);
        this.brRender();
      });
      page.append(tools, this.brInfo, scroll);
      this.addPage('data', 'Data', page, () => {
        this.br = null;
        this.brAsked = '';
        this.send({cmd: 'browser', from: 0, count: 0});
      });
    }

    brScrollTo(row) {
      const sc = this.brScroll;
      const top = row * BR_ROW, visible = sc.clientHeight - BR_HEAD - BR_ROW;
      if (top < sc.scrollTop) sc.scrollTop = top;
      else if (top > sc.scrollTop + visible) sc.scrollTop = top - visible;
    }

    onBrowser(ev) {
      const first = !this.br;
      this.br = ev;
      this.brAsked = '';
      if (first || ev.row0 !== this.brRow0) {
        /* the core moved the selection (Find) */
        this.brSel = ev.row0;
        if (this.brScroll) this.brScrollTo(ev.row0);
      }
      this.brRow0 = ev.row0;
      this.brRender();
    }

    brRender() {
      const sc = this.brScroll;
      if (!sc || !sc.clientHeight) return;
      const br = this.br;
      const rows = br ? br.rows : 0, cols = br ? br.cols : ['T'];
      const ndata = cols.length - 1;
      this.brSpace.style.height = rows * BR_ROW + 'px';
      const width = BR_TCOL + ndata * BR_COL;
      this.brSpace.style.width = this.brHead.style.width = width + 'px';
      const first = Math.floor(sc.scrollTop / BR_ROW);
      const count = Math.ceil((sc.clientHeight - BR_HEAD) / BR_ROW) + 1;
      const c0 = Math.floor(sc.scrollLeft / BR_COL);
      const nc = Math.ceil((sc.clientWidth - BR_TCOL) / BR_COL) + 1;
      /* ask for a larger block than visible so small scrolls need nothing */
      const have = br && br.from <= first && br.from + br.data.length >= Math.min(rows, first + count)
        && br.col <= c0 + 1 && br.col + (br.data[0] ? br.data[0].length - 1 : nc) >= Math.min(ndata, c0 + nc) + 1;
      if (!have) {
        const req = {cmd: 'browser', from: Math.max(0, first - count), count: count * 3,
          col: Math.max(1, c0 + 1 - nc), ncol: nc * 3};
        const key = JSON.stringify(req);
        if (key !== this.brAsked) {
          this.brAsked = key;
          this.send(req);
        }
      }
      const cell = (text, cls, left) => {
        const c = el('div', 'xpp-data-cell' + (cls ? ' ' + cls : ''), text);
        c.style.left = left + 'px';
        return c;
      };
      this.brHead.innerHTML = '';
      this.brHead.appendChild(cell('T', 'xpp-data-t', sc.scrollLeft));
      for (let j = c0; j < Math.min(ndata, c0 + nc); j++)
        this.brHead.appendChild(cell(cols[j + 1], '', BR_TCOL + j * BR_COL));
      this.brSpace.innerHTML = '';
      const fmt = v => (v === null ? 'nan' : v === undefined ? '' : String(v));
      for (let i = first; i < Math.min(rows, first + count); i++) {
        const row = el('div', 'xpp-data-row');
        row.dataset.row = i;
        row.style.top = i * BR_ROW + 'px';
        if (i === this.brSel) row.classList.add('xpp-data-sel');
        else if (br && i >= br.start && i < br.end && (br.start > 0 || br.end < rows)) row.classList.add('xpp-data-range');
        const d = br && br.data[i - br.from];
        row.appendChild(cell(d ? fmt(d[0]) : '', 'xpp-data-t', sc.scrollLeft));
        for (let j = c0; j < Math.min(ndata, c0 + nc); j++) {
          const k = j + 1 - (br ? br.col : 1) + 1;
          row.appendChild(cell(d && k >= 1 ? fmt(d[k]) : '', '', BR_TCOL + j * BR_COL));
        }
        this.brSpace.appendChild(row);
      }
      this.brInfo.textContent = !rows ? 'No data yet: integrate first.'
        : `${rows} rows. Selected row ${this.brSel}. First..Last: ${br.start}..${br.end - 1}. Click a row to select it.`;
    }

    fillTable(t, pairs) {
      /* boundary conditions all read "0=": they go by position */
      const byIndex = t.kind === 'bc' || t.kind === 'delay';
      for (const [index, [name, value]] of pairs.entries()) {
        const key = byIndex ? index : name;
        let input = t.inputs.get(key);
        if (!input) {
          const row = el('label', 'xpp-value');
          if (t.kind === 'ic') {
            const check = el('input', 'xpp-value-check');
            check.type = 'checkbox';
            check.title = 'Check to plot with x vs t or Phase';
            row.appendChild(check);
            t.checks.set(name, check);
          }
          row.appendChild(el('span', 'xpp-value-name', name));
          input = el('input', 'xpp-value-input');
          input.spellcheck = false;
          if (t.hint) input.title = t.hint;
          /* an edit counts when the field loses focus too (clicking Integrate
             right after typing), not only on Enter */
          input.addEventListener('change', () => {
            const text = input.value.trim();
            const numeric = t.kind === 'ic' || t.kind === 'par';
            if (text === input.dataset.value) return;
            if (text === '' || (numeric && !text.startsWith('%') && !Number.isFinite(Number(text)))) {
              input.value = input.dataset.value;
              return;
            }
            input.dataset.value = text;
            this.send(byIndex ? {cmd: 'set', kind: t.kind, index, text} : {cmd: 'set', kind: t.kind, name, text});
          });
          input.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              input.blur();
            } else if (e.key === 'Escape') {
              input.value = input.dataset.value;
              input.blur();
            }
          });
          row.appendChild(input);
          t.list.appendChild(row);
          t.inputs.set(key, input);
        }
        const s = String(value);
        input.dataset.value = s;
        if (document.activeElement !== input) input.value = s;
      }
    }

    /* ---- input --------------------------------------------------------------------- */

    key(k) {
      if (this.pendingAsk && this.answerByKey(k)) return;
      if (this.busy) {
        if (k === 'Escape') this.send({cmd: 'key', key: k});
        else this.typeahead.push(k);
        return;
      }
      this.busy = true;
      this.clearError();
      this.send({cmd: 'key', key: k});
    }

    keys(list) {
      list.forEach(k => this.key(k));
    }

    onKey(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const k = keyName(e);
      if (!k) return;
      e.preventDefault();
      if (this.shownWin === 101 && !this.pendingAsk && AUTO_KEYS[k.toLowerCase()]) {
        this.command({cmd: 'auto', op: AUTO_KEYS[k.toLowerCase()]});
        return;
      }
      this.key(k);
    }

    /* commands sent while dragging: only the latest of each kind, in order,
       one at a time */
    queue(key, cmd) {
      this.queued = this.queued || new Map();
      this.queued.delete(key);
      this.queued.set(key, cmd);
      if (!this.busy) this.flushQueue();
    }

    flushQueue() {
      if (!this.queued || !this.queued.size) return false;
      const [key, cmd] = this.queued.entries().next().value;
      this.queued.delete(key);
      this.command(cmd);
      return true;
    }

    /* ---- events -------------------------------------------------------------------- */

    receive(ev) {
      switch (ev.ev) {
        case 'hello':
          this.menus = ev.menus;
          this.userButtons = ev.userbuttons || [];
          this.lists = ev.lists || [];
          this.autoHints = ev.auto_hints || [];
          this.sliderDefs = ev.sliders || [];
          this.titleBar.textContent = ev.title;
          this.charCell = ev.char;
          this.renderMenu();
          break;
        case 'palette': this.palette = ev.colors; break;
        case 'window': this.onWindow(ev); break;
        case 'draw': {
          const s = this.surfaces.get(ev.win);
          if (s) s.run(ev.ops);
          break;
        }
        case 'state': this.state = ev; this.renderState(); this.renderMenu(); break;
        case 'menu': this.menuWhich = ev.which; this.renderMenu(); break;
        case 'title': this.setPlotTitle(ev.text); break;
        case 'message': this.onMessage(ev); break;
        case 'progress': this.progress.textContent = ev.of ? `${ev.n}/${ev.of}` : ''; break;
        case 'idle':
          this.busy = false;
          this.progress.textContent = '';
          this.aniPlaying = false;
          if (this.pendingSlide) {
            this.flushSlide();
            break;
          }
          if (this.flushQueue()) break;
          if (this.pendingAniUp || this.pendingAniMove || (this.pendingSeek !== undefined && this.pendingSeek !== null)) {
            this.flushAniInput();
            break;
          }
          if (this.typeahead.length) this.key(this.typeahead.shift());
          break;
        case 'ask': this.onAsk(ev); break;
        case 'equilibrium': this.showEquilibrium(ev); break;
        case 'source': this.showSource(ev); break;
        case 'equations': this.showEquations(ev); break;
        case 'browser': this.onBrowser(ev); break;
        case 'ani': this.onAni(ev); break;
        case 'aplot': this.onArrayPlot(ev); break;
        case 'film': this.onFilm(ev); break;
        case 'ping': this.flash(); break;
        case 'bye': this.hint.textContent = 'XPP has exited.'; break;
        /* sent by the host, not the server */
        case 'log': this.log(ev.text); break;
        case 'exit': this.exited(ev.code); break;
      }
    }

    onMessage(ev) {
      if (ev.error !== undefined) {
        clearTimeout(this.errorTimer); /* the printed copy of this message */
        this.recentErrors = [];
        this.lastError = ev.error.trim();
        this.showError(ev.error);
        this.log('error: ' + ev.error + '\n', false);
      } else if (ev.box !== undefined) {
        this.boxHint = ev.box;
        this.hint.textContent = ev.box;
      } else {
        const text = ev.bottom ?? ev.xy ?? ev.auto ?? ev.calc ?? '';
        if (ev.auto !== undefined && this.autoHint) this.autoHint.textContent = text;
        else this.hint.textContent = text;
      }
    }

    flash() {
      this.root.classList.add('xpp-ping');
      setTimeout(() => this.root.classList.remove('xpp-ping'), 150);
    }

    onWindow(ev) {
      if (ev.op === 'create') {
        let s = this.surfaces.get(ev.win);
        if (!s) {
          s = new Surface(this, ev.win, ev.w, ev.h);
          this.surfaces.set(ev.win, s);
          this.placeSurface(s, ev);
        } else s.resize(ev.w, ev.h);
        if (ev.win === 1) this.sendMainSize();
      } else if (ev.op === 'destroy') {
        const s = this.surfaces.get(ev.win);
        if (s) {
          (s.frame || s.canvas).remove();
          this.surfaces.delete(ev.win);
        }
        this.removePage(ev.win);
      } else if (ev.op === 'select') {
        this.activeWin = ev.win;
        this.showPage(ev.win);
        for (const s of this.surfaces.values()) s.canvas.classList.toggle('xpp-active', s.id === ev.win);
      }
    }

    /* xppaut names the current graph window after what it plots ("W vs V") */
    setPlotTitle(text) {
      if (this.activeWin === 1) {
        this.mainTitle.textContent = text;
        return;
      }
      const s = this.surfaces.get(this.activeWin);
      if (s && s.titleBar) s.titleBar.textContent = `Window ${this.activeWin}: ${text}`;
    }

    placeSurface(s, ev) {
      s.canvas.addEventListener('mousedown', e => this.onCanvasDown(s, e));
      if (ev.win <= 10) {
        /* x,y under the mouse in the active plot (many_pops.c do_motion_events) */
        s.canvas.addEventListener('mousemove', e => {
          const v = this.state && this.state.view;
          if (!v || v.win !== s.id || v.three || this.pendingAsk || v.right === v.left || v.top === v.bottom) return;
          const [i, j] = s.at(e);
          const x = (v.xhi - v.xlo) * (i - v.left) / (v.right - v.left) + v.xlo;
          const y = (v.yhi - v.ylo) * (j - v.bottom) / (v.top - v.bottom) + v.ylo;
          this.hint.textContent = `x=${x.toFixed(6)} y=${y.toFixed(6)}`;
        });
      }
      if (ev.win === 1) {
        this.mainHost.appendChild(s.canvas);
        return;
      }
      const frame = el('div', 'xpp-page xpp-window');
      const bar = el('div', 'xpp-window-title', ev.title || (ev.win <= 10 ? `Window ${ev.win}` : ''));
      frame.append(bar);
      s.titleBar = bar;
      s.frame = frame;
      if (ev.win === 101) {
        /* AUTO: buttons, the diagram, stability circle, info strip, hint */
        bar.textContent = ev.title || 'AUTO';
        const body = el('div', 'xpp-auto');
        const buttons = el('div', 'xpp-auto-buttons');
        AUTO_BUTTONS.forEach(([label, opName], i) => {
          const b = el('button', '', label);
          b.title = (this.autoHints || [])[i] || '';
          b.addEventListener('click', () => this.command({cmd: 'auto', op: opName}));
          b.addEventListener('mouseenter', () => { if (this.autoHint && b.title) this.autoHint.textContent = b.title; });
          buttons.appendChild(b);
        });
        const closeAuto = el('button', '', 'Close');
        closeAuto.title = 'Close the AUTO window (File/Auto opens it again with the diagram)';
        closeAuto.addEventListener('click', () => this.command({cmd: 'auto', op: 'close'}));
        buttons.appendChild(closeAuto);
        const abort = el('button', 'xpp-abort', 'ABORT');
        abort.addEventListener('click', () => this.send({cmd: 'abort'}));
        buttons.appendChild(abort);
        const stab = new Surface(this, 102, 108, 108);
        this.surfaces.set(102, stab);
        buttons.appendChild(stab.canvas);
        const right = el('div', 'xpp-auto-right');
        const info = new Surface(this, 103, ev.w, 45);
        this.surfaces.set(103, info);
        this.autoHint = el('div', 'xpp-auto-hint');
        /* Grab waits for keys on the diagram: say so where the user looks */
        this.autoGrab = el('div', 'xpp-auto-grab');
        this.autoGrab.hidden = true;
        this.autoGrab.append(el('span', '', 'Grab: ← → move along the branch, Tab jumps to the next labelled point, Enter grabs it. '));
        const done = el('button', '', 'Stop grabbing (Esc)');
        done.addEventListener('click', () => this.answer({key: 'Escape'}));
        this.autoGrab.appendChild(done);
        frame.appendChild(this.autoGrab);
        /* x,y under the mouse (auto_motion_xy); a click also stores the point */
        s.canvas.addEventListener('mousemove', e => {
          const au = this.state && this.state.auto;
          if (!au || !au.wid || !au.hgt || (this.pendingAsk && this.pendingAsk.kind === 'drag')) return;
          const [i, j] = s.at(e);
          const x = au.xmin + (i - au.x0) * (au.xmax - au.xmin) / au.wid;
          const y = au.ymin + (au.y0 - j + au.hgt) * (au.ymax - au.ymin) / au.hgt;
          if (!this.pendingAsk) this.autoHint.textContent = `x=${Number(x.toPrecision(6))},y=${Number(y.toPrecision(6))}`;
        });
        s.canvas.addEventListener('click', e => {
          if (this.pendingAsk || this.busy || this.answeredByPress) return;
          const [x, y] = s.at(e);
          this.command({cmd: 'auto', op: 'point', x, y});
        });
        right.append(s.canvas, info.canvas, this.autoHint);
        body.append(buttons, right);
        frame.appendChild(body);
        /* the diagram takes the room its tab has */
        const fit = () => {
          if (!frame.clientWidth) return; /* another tab is shown */
          /* the frame, not the body: the body grows with the canvas */
          const w = Math.floor(frame.clientWidth - buttons.offsetWidth - 24);
          /* stacked (narrow) layout: the height follows the content, so derive it */
          const h = this.root.classList.contains('xpp-narrow') ? Math.round(w * 0.75)
            : Math.floor(frame.clientHeight - bar.offsetHeight - this.autoGrab.offsetHeight
              - info.canvas.offsetHeight - this.autoHint.offsetHeight - 30);
          if (w < 200 || h < 150 || (w === s.canvas.width && h === s.canvas.height)) return;
          clearTimeout(this.autoSizeTimer);
          this.autoSizeTimer = setTimeout(() => {
            info.resize(w, 45);
            this.send({cmd: 'size', win: 101, w, h});
          }, 150);
        };
        new ResizeObserver(fit).observe(frame);
      } else if (ev.win === 105) {
        frame.append(this.buildArrayPlot(s, frame, bar));
      } else if (ev.win === 104) {
        bar.textContent = 'Animation';
        frame.append(this.buildAnimation(s, frame, bar));
      } else {
        frame.appendChild(s.canvas);
        s.canvas.addEventListener('focus', () => this.send({cmd: 'click', win: s.id}));
        /* extra plot windows take the size of their tab, like the main one */
        new ResizeObserver(() => {
          if (!frame.clientWidth) return;
          const w = Math.max(200, frame.clientWidth - 4);
          const h = this.root.classList.contains('xpp-narrow') ? Math.round(w * 0.75)
            : Math.max(150, frame.clientHeight - bar.offsetHeight - 4);
          if (w === s.canvas.width && h === s.canvas.height) return;
          clearTimeout(s.sizeTimer);
          s.sizeTimer = setTimeout(() => {
            s.resize(w, h);
            this.send({cmd: 'size', win: s.id, w, h});
          }, 150);
        }).observe(frame);
      }
      const label = ev.win === 101 ? 'AUTO' : ev.win === 104 ? 'Animation' : ev.win === 105 ? 'Array' : `Window ${ev.win}`;
      this.addPage(ev.win, label, frame);
      this.showPage(ev.win);
    }

    /* ---- array plot (aplotwin.c): a grid of colour indices painted here ---- */

    buildArrayPlot(s, frame, bar) {
      const box = el('div', 'xpp-aplot');
      const buttons = el('div', 'xpp-ani-buttons');
      const hints = {redraw: 'Draw again from the data', edit: 'Columns, rows, skips and z range',
        print: 'Write a PostScript file', fit: 'Fit the z range to the data', range: 'Save a GIF for each run of Integrate/Range',
        gif: 'Save the picture as a GIF', close: 'Close the array plot'};
      for (const [label, op] of [['Redraw', 'redraw'], ['Edit', 'edit'], ['Print', 'print'], ['Fit', 'fit'],
        ['Range', 'range'], ['GIF', 'gif'], ['Close', 'close']]) {
        const b = el('button', '', label);
        b.title = hints[op];
        b.addEventListener('click', () => this.command({cmd: 'aplot', op}));
        buttons.appendChild(b);
      }
      this.aplotTime = el('div', 'xpp-ani-info');
      const body = el('div', 'xpp-aplot-body');
      const scale = el('div', 'xpp-aplot-scale');
      this.aplotMax = el('div', 'xpp-ani-info');
      this.aplotScale = el('canvas', 'xpp-aplot-bar');
      this.aplotMin = el('div', 'xpp-ani-info');
      scale.append(this.aplotMax, this.aplotScale, this.aplotMin);
      body.append(scale, s.canvas);
      box.append(buttons, this.aplotTime, body);
      this.aplotSurface = s;
      s.canvas.title = 'Drag up or down to scroll through time';
      s.canvas.addEventListener('mousedown', e => {
        let last = e.clientY;
        const move = m => {
          this.pendingAplotDy = (this.pendingAplotDy || 0) + (m.clientY - last);
          last = m.clientY;
          if (!this.busy && this.pendingAplotDy) {
            const dy = this.pendingAplotDy;
            this.pendingAplotDy = 0;
            this.command({cmd: 'aplot', op: 'scroll', dy});
          }
        };
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
      new ResizeObserver(() => {
        if (!frame.clientWidth) return;
        const w = Math.max(100, frame.clientWidth - scale.offsetWidth - 24);
        const h = this.root.classList.contains('xpp-narrow') ? w
          : Math.max(100, frame.clientHeight - bar.offsetHeight - buttons.offsetHeight - this.aplotTime.offsetHeight - 24);
        if (w !== s.canvas.width || h !== s.canvas.height) {
          s.canvas.width = w;
          s.canvas.height = h;
          this.paintArrayPlot();
        }
      }).observe(frame);
      return box;
    }

    onArrayPlot(ev) {
      this.aplot = ev;
      if (this.pages.has(105)) {
        this.pages.get(105).tab.firstChild.textContent = 'Array: ' + ev.title;
        this.showPage(105);
      }
      this.paintArrayPlot();
    }

    paintArrayPlot() {
      const ev = this.aplot, s = this.aplotSurface;
      if (!ev || !s) return;
      const c = s.ctx, W = s.canvas.width, H = s.canvas.height;
      c.fillStyle = this.colorOf(-1);
      c.fillRect(0, 0, W, H);
      const dx = W / Math.max(1, ev.nx), dy = H / Math.max(1, ev.ny);
      for (let j = 0; j < ev.ny; j++) {
        for (let i = 0; i < ev.nx; i++) {
          const k = ev.cells[j * ev.nx + i];
          if (k < 0) continue;
          c.fillStyle = this.colorOf(ev.first + k);
          c.fillRect(Math.floor(i * dx), Math.floor(j * dy), Math.ceil(dx) + 1, Math.ceil(dy) + 1);
        }
      }
      if (ev.tag) {
        c.fillStyle = this.colorOf(0);
        c.font = '12px monospace';
        c.fillText(ev.tag, 2, 12);
      }
      this.aplotTime.textContent = ev.nx ? ` ${ev.tlo} < t < ${ev.thi}` : 'Nothing to show: use Edit, or integrate first';
      this.aplotMax.textContent = ev.zmax;
      this.aplotMin.textContent = ev.zmin;
      const bar = this.aplotScale;
      bar.width = 16;
      bar.height = Math.max(40, Math.min(200, H - 40));
      const bc = bar.getContext('2d');
      for (let y = 0; y < bar.height; y++) {
        bc.fillStyle = this.colorOf(ev.first + Math.round(ev.ncolors * (bar.height - 1 - y) / (bar.height - 1)));
        bc.fillRect(0, y, 16, 1);
      }
    }

    /* ---- animation window (aniwin.c's VCR) ---- */

    buildAnimation(s, frame, bar) {
      const box = el('div', 'xpp-ani');
      const buttons = el('div', 'xpp-ani-buttons');
      const add = (label, hint, click) => {
        const b = el('button', '', label);
        b.title = hint;
        b.addEventListener('click', click);
        buttons.appendChild(b);
        return b;
      };
      const ani = op => () => this.command({cmd: 'ani', op});
      /* while Go plays these reach its loop; otherwise they are commands */
      const live = op => () => (this.aniPlaying ? this.send({cmd: 'ani', op}) : this.command({cmd: 'ani', op}));
      add('Go', 'Play the animation', () => {
        if (this.busy) return;
        this.aniPlaying = true;
        this.command({cmd: 'ani', op: 'go'});
      });
      add('Pause', 'Stop playing', () => this.send({cmd: 'ani', op: 'pause'}));
      add('Reset', 'Back to the first frame', ani('reset'));
      add('\u25c0', 'One frame back', () => this.command({cmd: 'ani', op: 'step', n: -1}));
      add('\u25b6', 'One frame forward', () => this.command({cmd: 'ani', op: 'step', n: 1}));
      add('Fast', 'Less delay between frames', live('fast'));
      add('Slow', 'More delay between frames', live('slow'));
      add('Skip', 'Frames to advance per step', ani('skip'));
      add('File', 'Load an animation (.ani) file', ani('file'));
      add('Grab', 'Drag the grab points of the animation with the mouse', ani('grab'));
      this.aniFly = add('Fly', 'Animate while integrating', ani('fly'));
      add('Frames', 'Save frames while playing: PPM files or an animated GIF', ani('mpeg'));
      add('Close', 'Close the animation window', ani('close'));
      this.aniSlider = el('input', 'xpp-ani-slider');
      this.aniSlider.type = 'range';
      this.aniSlider.min = 0;
      this.aniSlider.max = 0;
      this.aniSlider.addEventListener('input', () => {
        this.pendingSeek = Number(this.aniSlider.value);
        if (!this.busy) this.flushAniInput();
      });
      this.aniInfo = el('div', 'xpp-ani-info');
      /* grab: the mouse drags points; moves are coalesced like slider moves */
      s.canvas.addEventListener('mousedown', e => {
        if (!this.aniState || !this.aniState.grab || this.busy) return;
        const [x, y] = s.at(e);
        this.command({cmd: 'ani', op: 'mouse', what: 'down', x, y});
        const move = m => {
          const [mx, my] = s.at(m);
          this.pendingAniMove = {mx, my};
          if (!this.busy) this.flushAniInput();
        };
        const up = u => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          const [ux, uy] = s.at(u);
          this.pendingAniMove = null;
          this.pendingAniUp = {x: ux, y: uy};
          if (!this.busy) this.flushAniInput();
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
      box.append(buttons, this.aniSlider, this.aniInfo, s.canvas);
      const fit = () => {
        if (!frame.clientWidth) return;
        const w = Math.floor(frame.clientWidth - 16);
        const h = this.root.classList.contains('xpp-narrow') ? Math.round(w * 1.2)
          : Math.floor(frame.clientHeight - bar.offsetHeight - buttons.offsetHeight
            - this.aniSlider.offsetHeight - this.aniInfo.offsetHeight - 24);
        /* the server rounds to 4 and 5 pixels and the frame follows the picture: small changes would loop */
        if (w < 80 || h < 80 || (Math.abs(w - s.canvas.width) < 10 && Math.abs(h - s.canvas.height) < 10)) return;
        clearTimeout(this.aniSizeTimer);
        this.aniSizeTimer = setTimeout(() => this.send({cmd: 'size', win: 104, w, h}), 150);
      };
      new ResizeObserver(fit).observe(frame);
      return box;
    }

    /* the latest slider position or grab drag, one command at a time */
    flushAniInput() {
      if (this.pendingAniUp) {
        const u = this.pendingAniUp;
        this.pendingAniUp = null;
        this.command({cmd: 'ani', op: 'mouse', what: 'up', x: u.x, y: u.y});
      } else if (this.pendingAniMove) {
        const m = this.pendingAniMove;
        this.pendingAniMove = null;
        this.command({cmd: 'ani', op: 'mouse', what: 'move', x: m.mx, y: m.my});
      } else if (this.pendingSeek !== undefined && this.pendingSeek !== null) {
        const pos = this.pendingSeek;
        this.pendingSeek = null;
        this.command({cmd: 'ani', op: 'seek', pos});
      }
    }

    onAni(ev) {
      this.aniState = ev;
      if (!this.aniSlider) return;
      this.aniSlider.max = Math.max(0, ev.rows - 1);
      if (document.activeElement !== this.aniSlider) this.aniSlider.value = ev.pos;
      this.aniFly.textContent = ev.fly ? 'Fly \u2713' : 'Fly';
      this.aniInfo.textContent = (ev.grab ? 'Grab: drag a point with the mouse. ' : '')
        + `Frame ${ev.pos} of ${ev.rows}, skip ${ev.skip}, delay ${ev.speed} ms`;
    }

    /* ---- kinescope: frames of a plot window kept here ---- */

    onFilm(ev) {
      this.film = this.film || [];
      if (ev.op === 'capture') {
        const src = this.surfaces.get(ev.win);
        if (src) this.film.push(src.ctx.getImageData(0, 0, src.canvas.width, src.canvas.height));
      } else if (ev.op === 'reset') {
        this.film = [];
        if (this.pages.has('film')) this.removePage('film');
      } else if (ev.op === 'play' || ev.op === 'autoplay') {
        this.openFilm();
        this.showFilmFrame(0);
        if (ev.op === 'autoplay') this.playFilm(ev.cycles, ev.delay);
      }
    }

    openFilm() {
      if (!this.pages.has('film')) {
        const page = el('div', 'xpp-page xpp-window xpp-film');
        const buttons = el('div', 'xpp-ani-buttons');
        const add = (label, hint, click) => {
          const b = el('button', '', label);
          b.title = hint;
          b.addEventListener('click', click);
          buttons.appendChild(b);
        };
        add('\u23ee', 'First frame (Home)', () => this.showFilmFrame(0));
        add('\u25c0', 'Previous frame (Left)', () => this.showFilmFrame(this.filmPos - 1));
        add('\u25b6', 'Next frame (Right, or click the picture)', () => this.showFilmFrame(this.filmPos + 1));
        add('\u23ed', 'Last frame (End)', () => this.showFilmFrame(this.film.length - 1));
        add('Play', 'Play once', () => this.playFilm(1, 100));
        add('Stop', 'Stop playing', () => clearTimeout(this.filmTimer));
        this.filmInfo = el('span', 'xpp-ani-info');
        buttons.appendChild(this.filmInfo);
        this.filmCanvas = el('canvas', 'xpp-canvas');
        this.filmCanvas.tabIndex = 0;
        this.filmCanvas.addEventListener('click', () => this.showFilmFrame(this.filmPos + 1));
        this.filmCanvas.addEventListener('keydown', e => {
          const n = this.film.length;
          const to = {ArrowRight: this.filmPos + 1, ArrowLeft: this.filmPos - 1, Home: 0, End: n - 1}[e.key];
          if (to === undefined) return;
          e.preventDefault();
          e.stopPropagation();
          this.showFilmFrame(to);
        });
        page.append(buttons, this.filmCanvas);
        this.addPage('film', 'Kinescope', page, () => clearTimeout(this.filmTimer));
      }
      this.showPage('film');
    }

    showFilmFrame(i) {
      const n = this.film ? this.film.length : 0;
      if (!n || !this.filmCanvas) return;
      this.filmPos = ((i % n) + n) % n; /* wraps around like X11 */
      const f = this.film[this.filmPos];
      this.filmCanvas.width = f.width;
      this.filmCanvas.height = f.height;
      this.filmCanvas.getContext('2d').putImageData(f, 0, 0);
      this.filmInfo.textContent = `Frame ${this.filmPos + 1} of ${n}`;
    }

    playFilm(cycles, delay) {
      clearTimeout(this.filmTimer);
      let left = Math.max(1, cycles) * this.film.length - 1;
      const tick = () => {
        if (left-- <= 0) return;
        this.showFilmFrame(this.filmPos + 1);
        this.filmTimer = setTimeout(tick, Math.max(10, delay));
      };
      this.showFilmFrame(0);
      this.filmTimer = setTimeout(tick, Math.max(10, delay));
    }

    /* the server writes frames and GIFs from what is drawn here */
    answerPixels(a) {
      let img = null;
      if (a.film !== undefined) img = this.film && this.film[a.film];
      else {
        const src = this.surfaces.get(a.win);
        if (src) img = src.ctx.getImageData(0, 0, src.canvas.width, src.canvas.height);
      }
      if (!img) {
        this.cancel();
        return;
      }
      const n = img.width * img.height, rgb = new Uint8Array(n * 3);
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        rgb[i * 3] = img.data[j];
        rgb[i * 3 + 1] = img.data[j + 1];
        rgb[i * 3 + 2] = img.data[j + 2];
      }
      let bin = '';
      for (let i = 0; i < rgb.length; i += 0x8000) bin += String.fromCharCode.apply(null, rgb.subarray(i, i + 0x8000));
      this.answer({w: img.width, h: img.height, rgb: btoa(bin)});
    }

    command(cmd) {
      if (this.busy) return;
      this.busy = true;
      this.clearError();
      this.send(cmd);
    }

    onCanvasDown(s, e) {
      const a = this.pendingAsk;
      this.answeredByPress = !!a; /* the click that follows is not a new action */
      const v = this.state && this.state.view;
      if (!a && v && v.three && v.win === s.id && !this.busy) {
        /* drag a 3D plot to turn it */
        const [x, y] = s.at(e);
        this.command({cmd: 'rotate', what: 'down', x, y});
        this.trackMouse(s, (what, mx, my) => this.queue('rotate-' + what, {cmd: 'rotate', what, x: mx, y: my}));
        return;
      }
      if (!a || (a.win !== undefined && a.win !== s.id && !(a.win === 101 && s.id === 101))) {
        if (s.id >= 2 && s.id <= 10 && !this.busy) this.send({cmd: 'click', win: s.id});
        return;
      }
      const [x, y] = s.at(e);
      if (a.kind === 'drag') {
        /* Scroll: every pointer event answers one drag ask */
        this.dragEvents = [];
        this.answer({what: 'down', x, y});
        this.trackMouse(s, (what, mx, my) => {
          const last = this.dragEvents[this.dragEvents.length - 1];
          if (what === 'move' && last && last.what === 'move') this.dragEvents.pop();
          this.dragEvents.push({what, x: mx, y: my});
          if (this.pendingAsk && this.pendingAsk.kind === 'drag') this.answer(this.dragEvents.shift());
        });
        return;
      }
      if (a.kind === 'mouse') this.answer({x, y});
      else if (a.kind === 'grab') this.answer({x, y});
      else if (a.kind === 'rubber') this.rubber(s, a, x, y);
    }

    /* moves and the release of a button pressed on surface s */
    trackMouse(s, report) {
      const move = m => {
        const [x, y] = s.at(m);
        report('move', x, y);
      };
      const up = u => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        const [x, y] = s.at(u);
        report('up', x, y);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }

    rubber(s, a, x0, y0) {
      const snap = s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height);
      let x1 = x0, y1 = y0;
      const move = e => {
        [x1, y1] = s.at(e);
        s.ctx.putImageData(snap, 0, 0);
        s.ctx.save();
        s.ctx.strokeStyle = '#808080';
        s.ctx.setLineDash([3, 3]);
        s.ctx.beginPath();
        if (a.flag === 1) {
          s.ctx.moveTo(x0, y0);
          s.ctx.lineTo(x1, y1);
        } else s.ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        s.ctx.stroke();
        s.ctx.restore();
      };
      const up = e => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        [x1, y1] = s.at(e);
        s.ctx.putImageData(snap, 0, 0);
        this.answer({x: x0, y: y0, x2: x1, y2: y1});
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }

    /* ---- asks ------------------------------------------------------------------------ */

    answer(fields) {
      const a = this.pendingAsk;
      if (!a) return;
      this.pendingAsk = null;
      if (a.close) a.close();
      if (this.autoGrab) this.autoGrab.hidden = true;
      this.root.classList.remove('xpp-picking');
      this.send(Object.assign({cmd: 'answer', id: a.id}, fields));
      this.root.focus();
    }

    cancel() {
      this.answer({ok: 0});
    }

    /* a key typed while something is being asked */
    answerByKey(k) {
      const a = this.pendingAsk;
      if (a.kind === 'menu' || a.kind === 'choice') {
        if (k === 'Escape') { this.cancel(); return true; }
        const key = k.toLowerCase();
        if (a.keys.includes(key)) { this.answer({key}); return true; }
        if (k === 'Enter' && a.kind === 'menu' && a.def >= 0) { this.answer({key: a.keys[a.def]}); return true; }
        return true;
      }
      if (a.kind === 'mouse' || a.kind === 'rubber' || a.kind === 'alert') {
        if (k === 'Escape' || (a.kind === 'alert' && k === 'Enter')) {
          a.kind === 'alert' ? this.answer({}) : this.cancel();
        }
        return true;
      }
      if (a.kind === 'grab') {
        this.answer({key: k});
        return true;
      }
      if (a.kind === 'drag') {
        this.cancel(); /* any key ends scrolling */
        return true;
      }
      return false; /* forms take their keys through their inputs */
    }

    onAsk(a) {
      this.pendingAsk = a;
      this.busy = true;
      /* a click or key is wanted in a window: bring its tab forward */
      if (a.win !== undefined) this.showPage(a.win === 102 || a.win === 103 ? 101 : a.win);
      switch (a.kind) {
        case 'menu': this.askMenu(a); break;
        case 'choice': this.askChoice(a); break;
        case 'string': this.askForm(a, [a.name], [a.value], a.title || a.name, a.ok, a.cancel); break;
        case 'form': this.askForm(a, a.names, a.values, a.title); break;
        case 'file': this.askFile(a); break;
        case 'checklist': this.askChecklist(a); break;
        case 'alert': this.askAlert(a); break;
        case 'pixels': this.answerPixels(a); return;
        case 'mouse':
        case 'rubber':
          this.root.classList.add('xpp-picking');
          this.hint.textContent = this.boxHint || (a.kind === 'mouse' ? 'Click in the plot (Esc cancels)'
            : a.flag === 1 ? 'Drag a line in the plot (Esc cancels)' : 'Drag a box in the plot (Esc cancels)');
          break;
        case 'drag':
          this.root.classList.add('xpp-picking');
          if (this.dragEvents && this.dragEvents.length) this.answer(this.dragEvents.shift());
          break;
        case 'grab':
          this.hint.textContent = 'Arrows/Tab move, Enter grabs, Esc quits, s/e mark a branch';
          if (this.autoGrab) this.autoGrab.hidden = false;
          break;
      }
      if (this.typeahead.length && (a.kind === 'menu' || a.kind === 'choice')) {
        const k = this.typeahead.shift();
        this.answerByKey(k);
      }
    }

    dialog(title) {
      const box = el('div', 'xpp-dialog');
      if (title) box.appendChild(el('div', 'xpp-dialog-title', title));
      this.dialogLayer.appendChild(box);
      this.pendingAsk.close = () => box.remove();
      return box;
    }

    askMenu(a) {
      const box = this.dialog(a.title);
      box.classList.add('xpp-popup');
      a.items.forEach((label, i) => {
        const b = el('button', 'xpp-menu-item' + (i === a.def ? ' xpp-default' : ''), label);
        if (a.hints) b.title = a.hints[i] || '';
        b.addEventListener('click', () => this.answer({key: a.keys[i]}));
        box.appendChild(b);
      });
      const c = el('button', 'xpp-cancel', 'Cancel');
      c.addEventListener('click', () => this.cancel());
      box.appendChild(c);
    }

    askChoice(a) {
      const box = this.dialog(a.title);
      box.appendChild(el('div', 'xpp-question', a.question));
      const row = el('div', 'xpp-buttons');
      a.choices.forEach((label, i) => {
        const b = el('button', '', label);
        b.addEventListener('click', () => this.answer({key: a.keys[i]}));
        row.appendChild(b);
      });
      box.appendChild(row);
      row.firstChild.focus();
    }

    askAlert(a) {
      const box = this.dialog('');
      box.appendChild(el('div', 'xpp-question', a.message));
      const b = el('button', '', a.button || 'Ok');
      b.addEventListener('click', () => this.answer({}));
      box.appendChild(b);
      b.focus();
    }

    askForm(a, names, values, title, okLabel, cancelLabel) {
      const box = this.dialog(title);
      const form = el('form', 'xpp-form');
      const inputs = names.map((n, i) => {
        const label = el('label', 'xpp-field');
        const shown = n.replace(/^\*\d/, '');
        label.appendChild(el('span', '', shown));
        const input = el('input');
        input.value = values[i];
        input.spellcheck = false;
        if (a.max) input.maxLength = a.max;
        const pick = /^\*(\d)/.exec(n);
        if (pick && this.lists && this.lists[Number(pick[1])]) {
          /* the X11 scroll list of variables, parameters, colours, markers or methods */
          const list = el('datalist');
          list.id = `xpp-list-${a.id}-${i}`;
          this.lists[Number(pick[1])].forEach(v => list.appendChild(el('option', '', v)).value = v);
          label.appendChild(list);
          input.setAttribute('list', list.id);
          input.title = 'Pick from the list or type';
        }
        label.appendChild(input);
        form.appendChild(label);
        return input;
      });
      const row = el('div', 'xpp-buttons');
      const ok = el('button', '', okLabel || 'Ok');
      ok.type = 'submit';
      const cancel = el('button', '', cancelLabel || 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', () => this.cancel());
      row.append(ok, cancel);
      form.appendChild(row);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const v = inputs.map(i => i.value);
        if (a.kind === 'form') this.answer({values: v});
        else if (a.kind === 'file') this.answer({file: v[0]});
        else this.answer({value: v[0]});
      });
      form.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') this.cancel();
        if (e.key === 'Enter') {
          /* also when a datalist suggestion popup has the key */
          e.preventDefault();
          form.requestSubmit();
        }
      });
      box.appendChild(form);
      inputs[0].focus();
      inputs[0].select();
    }

    /* the file selector: a name field and the folder's contents */
    askFile(a) {
      this.askForm(a, ['File'], [a.file], a.title);
      const box = this.dialogLayer.lastChild;
      const form = box.querySelector('form');
      const input = form.querySelector('input');
      const where = el('div', 'xpp-files-dir', a.dir);
      const wild = el('input', 'xpp-files-wild');
      wild.value = a.wild;
      wild.title = 'Which files to list; Enter lists again';
      wild.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        this.answer({wild: wild.value});
      });
      const list = el('div', 'xpp-files');
      const item = (text, cls, click, dbl) => {
        const it = el('div', 'xpp-file ' + cls, text);
        it.addEventListener('click', click);
        if (dbl) it.addEventListener('dblclick', dbl);
        list.appendChild(it);
      };
      item('..', 'xpp-dir', () => this.answer({cd: '..'}));
      (a.dirs || []).filter(d => d !== '.' && d !== '..').forEach(d => item(d + '/', 'xpp-dir', () => this.answer({cd: d})));
      (a.files || []).forEach(f => item(f, '', () => { input.value = f; }, () => this.answer({file: f})));
      const head = el('div', 'xpp-files-head');
      head.append(where, wild);
      form.insertBefore(head, form.lastChild);
      form.insertBefore(list, form.lastChild);
    }

    askChecklist(a) {
      const box = this.dialog(a.title);
      const boxes = a.names.map((n, i) => {
        const label = el('label', 'xpp-check');
        const c = el('input');
        c.type = 'checkbox';
        c.checked = !!a.flags[i];
        label.append(c, document.createTextNode(' ' + n));
        box.appendChild(label);
        return c;
      });
      const row = el('div', 'xpp-buttons');
      const ok = el('button', '', 'Done');
      ok.addEventListener('click', () => this.answer({flags: boxes.map(c => (c.checked ? 1 : 0))}));
      const cancel = el('button', '', 'Cancel');
      cancel.addEventListener('click', () => this.cancel());
      row.append(ok, cancel);
      box.appendChild(row);
    }

    showEquilibrium(ev) {
      let w = this.eqPanel;
      if (!w) {
        /* top of the side panel, next to the values it can import into */
        w = this.eqPanel = el('div', 'xpp-window xpp-eq');
        this.sidePanel.prepend(w);
      }
      w.innerHTML = '';
      const bar = el('div', 'xpp-window-title', `Equilibrium: ${ev.type}`);
      const close = el('button', 'xpp-close', '×');
      close.addEventListener('click', () => { w.remove(); this.eqPanel = null; });
      bar.appendChild(close);
      w.appendChild(bar);
      w.appendChild(el('div', 'xpp-eq-counts',
        `c+ = ${ev.cplus}  c- = ${ev.cminus}  im = ${ev.im}  r+ = ${ev.rplus}  r- = ${ev.rminus}`));
      for (const [name, v] of ev.values) w.appendChild(el('div', 'xpp-eq-value', `${name} = ${Number(v).toPrecision(5)}`));
      const imp = el('button', '', 'Import');
      imp.title = 'Make this equilibrium the initial conditions';
      imp.addEventListener('click', () => this.command({cmd: 'eqimport'}));
      const row = el('div', 'xpp-row');
      row.appendChild(imp);
      w.appendChild(row);
    }

    /* a closable tab holding text (Source, Equations); shown again, it is replaced */
    textPanel(kind, title) {
      const key = 'panel_' + kind;
      this.removePage(key);
      const w = this[key] = el('div', 'xpp-page xpp-window xpp-source');
      this.addPage(key, title, w, () => { this[key] = null; });
      this.showPage(key);
      return w;
    }

    showEquations(ev) {
      const w = this.textPanel('equations', 'Equations');
      w.appendChild(el('pre', '', ev.lines.join('\n')));
    }

    showSource(ev) {
      const w = this.textPanel('source', 'Source');
      const actions = (ev.comments || []).map((c, index) => [c, index]).filter(([c]) => c[1]);
      if (actions.length) {
        /* comments with {name=value,...} actions: X11's Action view */
        const list = el('div', 'xpp-actions');
        list.appendChild(el('div', 'xpp-values-title', 'Actions (click to apply)'));
        for (const [c, index] of actions) {
          const b = el('button', 'xpp-action', c[0]);
          b.addEventListener('click', () => this.command({cmd: 'action', index}));
          list.appendChild(b);
        }
        w.appendChild(list);
      }
      w.appendChild(el('pre', '', ev.lines.join('\n')));
    }
  }

  global.XppClient = XppClient;
})(typeof window !== 'undefined' ? window : globalThis);
