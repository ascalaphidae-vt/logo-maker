/* Browser-independent document model. Canvas rendering uses only Canvas 2D. */
(function (root) {
  'use strict';
  const VERSION = 2;
  const presets = {
    candy: ['#fff58c', '#ff63b3', '#ffffff', '#5133a7'],
    ocean: ['#9ffbff', '#396dff', '#ffffff', '#19174e'],
    mint: ['#f9ff9d', '#22c8ad', '#ffffff', '#087b84'],
    sunset: ['#ffe64b', '#ff684c', '#ffffff', '#70316e'],
    night: ['#f8a7ff', '#8d5aff', '#20204b', '#090b24']
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const number = (value, fallback, min, max) => {
    const n = Number(value);
    return value !== '' && value != null && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  let serial = 0;
  const id = () => `part-${Date.now().toString(36)}-${++serial}`;
  function textElement(text = '参加型配信') {
    return { id: id(), type: 'text', name: 'テキスト', text, visible: true,
      x: 600, y: 315, scale: 1, rotation: 0,
      style: { font: 'sans-serif', size: 120, spacing: 0, top: presets.candy[0],
        bottom: presets.candy[1], inner: presets.candy[2], outer: presets.candy[3],
        inWidth: 9, outWidth: 15, shadow: 9, preset: 'candy' } };
  }
  function sparkle(x = 180, y = 140, radius = 26, fill = '#fff58c') {
    return { id: id(), type: 'sparkle', name: 'キラキラ', visible: true,
      x, y, scale: 1, rotation: 0, radius, fill };
  }
  function createDocument() {
    return { version: VERSION, canvas: { width: 1200, height: 630 }, elements: [textElement()] };
  }
  function normalizeElement(raw) {
    if (!raw || !['text', 'sparkle'].includes(raw.type)) throw new Error('未対応の要素が含まれています。');
    const item = raw.type === 'text' ? textElement() : sparkle();
    item.id = typeof raw.id === 'string' && raw.id.length < 100 ? raw.id : id();
    item.name = typeof raw.name === 'string' ? raw.name.slice(0, 60) : item.name;
    item.visible = raw.visible !== false;
    item.x = number(raw.x, 600, -10000, 10000);
    item.y = number(raw.y, 315, -10000, 10000);
    item.scale = number(raw.scale, 1, 0.05, 8);
    item.rotation = number(raw.rotation, 0, -180, 180);
    if (item.type === 'sparkle') {
      item.radius = number(raw.radius, 26, 4, 200);
      item.fill = color(raw.fill, item.fill);
      return item;
    }
    item.text = (typeof raw.text === 'string' ? raw.text : item.text).split('\n').slice(0, 4).join('\n').slice(0, 500);
    const s = raw.style || {}, style = item.style;
    style.font = typeof s.font === 'string' && s.font.length <= 200 ? s.font : style.font;
    for (const key of ['top', 'bottom', 'inner', 'outer']) style[key] = color(s[key], style[key]);
    for (const [key, min, max] of [['size', 20, 240], ['spacing', -20, 60], ['inWidth', 0, 30], ['outWidth', 0, 50], ['shadow', 0, 50]]) {
      style[key] = number(s[key], style[key], min, max);
    }
    style.preset = Object.hasOwn(presets, s.preset) ? s.preset : 'candy';
    return item;
  }
  function parseDocument(input) {
    const raw = typeof input === 'string' ? JSON.parse(input) : input;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('編集データの形式が正しくありません。');
    if (raw.version == null) {
      if (typeof raw.title !== 'string') throw new Error('旧形式の文字データがありません。');
      const item = normalizeElement({ ...textElement(), text: raw.title, style: raw });
      const doc = { version: VERSION, canvas: { width: 1200, height: 630 }, elements: [item] };
      if (raw.stars === true) for (const [x, y, r] of [[105,120,23],[1065,140,17],[110,495,14],[1080,505,28]]) doc.elements.push(sparkle(x, y, r, item.style.top));
      return doc;
    }
    if (raw.version !== VERSION) throw new Error(`このデータのバージョン (${raw.version}) は読み込めません。`);
    if (!Array.isArray(raw.elements) || raw.elements.length > 40) throw new Error('要素は最大40個です。');
    if (raw.canvas?.width !== 1200 || raw.canvas?.height !== 630) throw new Error('この版のキャンバスは1200×630pxです。');
    const elements = raw.elements.map(normalizeElement), seen = new Set();
    for (const item of elements) {
      if (seen.has(item.id)) item.id = id();
      seen.add(item.id);
    }
    return { version: VERSION, canvas: { width: 1200, height: 630 }, elements };
  }
  class History {
    constructor(doc) { this.items = [clone(doc)]; this.index = 0; }
    push(doc) {
      if (JSON.stringify(this.items[this.index]) === JSON.stringify(doc)) return false;
      this.items = this.items.slice(0, this.index + 1);
      this.items.push(clone(doc));
      if (this.items.length > 80) this.items.shift();
      this.index = this.items.length - 1;
      return true;
    }
    undo() { return this.index > 0 ? clone(this.items[--this.index]) : null; }
    redo() { return this.index < this.items.length - 1 ? clone(this.items[++this.index]) : null; }
  }
  const fontString = style => `900 ${style.size}px ${style.font === 'sans-serif' ? 'sans-serif' : JSON.stringify(style.font)}, sans-serif`;
  function layoutText(ctx, item) {
    const s = item.style, lines = item.text.split('\n').slice(0, 4);
    ctx.font = fontString(s); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const glyphs = [], lineHeight = s.size * 1.22;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    lines.forEach((line, i) => {
      const chars = typeof Intl.Segmenter === 'function'
        ? [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(line)].map(v => v.segment) : Array.from(line);
      const metrics = chars.map(ch => ctx.measureText(ch));
      const width = metrics.reduce((n, m) => n + m.width, 0) + Math.max(0, chars.length - 1) * s.spacing;
      let cursor = -width / 2;
      const y = (i - (lines.length - 1) / 2) * lineHeight + s.size * .36;
      chars.forEach((ch, j) => {
        const m = metrics[j], x = cursor + m.width / 2;
        glyphs.push({ ch, x, y }); cursor += m.width + s.spacing;
        left = Math.min(left, x - (m.actualBoundingBoxLeft ?? m.width / 2));
        right = Math.max(right, x + (m.actualBoundingBoxRight ?? m.width / 2));
        top = Math.min(top, y - (m.actualBoundingBoxAscent ?? s.size));
        bottom = Math.max(bottom, y + (m.actualBoundingBoxDescent ?? 0));
      });
    });
    if (!glyphs.length) { left = -40; right = 40; top = -s.size / 2; bottom = s.size / 2; }
    const edge = s.inWidth + s.outWidth;
    left -= edge; top -= edge; right += edge + s.shadow + (s.shadow ? 4 : 0); bottom += edge + s.shadow + (s.shadow ? 4 : 0);
    if (s.shadow) { left -= 4; top -= 4; }
    const fit = Math.min(1, 1040 / Math.max(1, right - left), 490 / Math.max(1, bottom - top));
    return { glyphs, fit, left: left * fit, top: top * fit, right: right * fit, bottom: bottom * fit };
  }
  function bounds(ctx, item) {
    if (item.type === 'text') return layoutText(ctx, item);
    return { left: -item.radius, right: item.radius, top: -item.radius * 1.7, bottom: item.radius * 1.7 };
  }
  function transform(ctx, item) { ctx.translate(item.x, item.y); ctx.rotate(item.rotation * Math.PI / 180); ctx.scale(item.scale, item.scale); }
  function renderElement(ctx, item) {
    ctx.save(); transform(ctx, item);
    if (item.type === 'sparkle') {
      const r = item.radius; ctx.fillStyle = item.fill;
      ctx.beginPath(); ctx.moveTo(0, -r * 1.7);
      ctx.quadraticCurveTo(r*.22,-r*.22,r,0); ctx.quadraticCurveTo(r*.22,r*.22,0,r*1.7);
      ctx.quadraticCurveTo(-r*.22,r*.22,-r,0); ctx.quadraticCurveTo(-r*.22,-r*.22,0,-r*1.7); ctx.fill();
    } else {
      const layout = layoutText(ctx, item), s = item.style;
      ctx.scale(layout.fit, layout.fit); ctx.font = fontString(s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      const pass = (fill, width, offset = 0) => {
        ctx.strokeStyle = fill; ctx.fillStyle = fill; ctx.lineWidth = width;
        // Stroke all glyphs before filling any: adjacent outlines cannot cut into a previous fill.
        if (width) for (const g of layout.glyphs) ctx.strokeText(g.ch, g.x + offset, g.y + offset);
        for (const g of layout.glyphs) ctx.fillText(g.ch, g.x + offset, g.y + offset);
      };
      if (s.shadow) pass('#25204e', 2 * (s.inWidth + s.outWidth) + 8, s.shadow);
      pass(s.outer, 2 * (s.inWidth + s.outWidth)); pass(s.inner, 2 * s.inWidth);
      // Gradients follow each line, as in the original editor.
      for (const g of layout.glyphs) {
        const grad = ctx.createLinearGradient(0, g.y - s.size * .86, 0, g.y + s.size * .19);
        grad.addColorStop(0, s.top); grad.addColorStop(1, s.bottom); ctx.fillStyle = grad; ctx.fillText(g.ch, g.x, g.y);
      }
    }
    ctx.restore();
  }
  function render(ctx, doc) {
    ctx.clearRect(0, 0, doc.canvas.width, doc.canvas.height);
    for (const item of doc.elements) if (item.visible) renderElement(ctx, item);
  }
  function localPoint(item, x, y) {
    const a = -item.rotation * Math.PI / 180, dx = x - item.x, dy = y - item.y;
    return { x: (dx * Math.cos(a) - dy * Math.sin(a)) / item.scale, y: (dx * Math.sin(a) + dy * Math.cos(a)) / item.scale };
  }
  function hitTest(ctx, doc, x, y) {
    return [...doc.elements].reverse().find(item => {
      if (!item.visible) return false;
      const p = localPoint(item, x, y), b = bounds(ctx, item);
      return p.x >= b.left - 6 && p.x <= b.right + 6 && p.y >= b.top - 6 && p.y <= b.bottom + 6;
    }) || null;
  }
  const api = { VERSION, presets, clone, textElement, sparkle, createDocument, parseDocument, History, fontString, bounds, render, hitTest, transform, localPoint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PopLogo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
