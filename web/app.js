(() => {
  'use strict';
  const E = window.PopLogo, $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const overlay = $('overlay'), ui = overlay.getContext('2d');
  let doc = E.createDocument(), selectedId = doc.elements[0].id;
  const history = new E.History(doc);
  let pending = null, drag = null, fontFamilies = [], renderToken = 0;
  const selected = () => doc.elements.find(item => item.id === selectedId);
  const message = (text, error = false) => { $('message').textContent = text; $('message').classList.toggle('error', error); };
  const styleFields = ['top', 'bottom', 'inner', 'outer', 'size', 'spacing', 'inWidth', 'outWidth', 'shadow'];
  const numericFields = ['size', 'spacing', 'inWidth', 'outWidth', 'shadow', 'x', 'y', 'scale', 'rotation', 'radius'];
  function flush() { clearTimeout(pending); pending = null; history.push(doc); updateButtons(); }
  function deferCommit() { clearTimeout(pending); pending = setTimeout(flush, 450); }
  function updateButtons() {
    $('undo').disabled = history.index === 0;
    $('redo').disabled = history.index === history.items.length - 1;
    const index = doc.elements.findIndex(item => item.id === selectedId);
    for (const key of ['remove', 'duplicate']) $(key).disabled = index < 0;
    $('forward').disabled = index < 0 || index === doc.elements.length - 1;
    $('backward').disabled = index <= 0;
    $('addText').disabled = $('addSparkle').disabled = doc.elements.length >= 40;
    $('duplicate').disabled ||= doc.elements.length >= 40;
  }
  function corners(item, b) {
    const angle = item.rotation * Math.PI / 180;
    return [[b.left,b.top],[b.right,b.top],[b.right,b.bottom],[b.left,b.bottom]].map(([x,y]) => ({
      x: item.x + item.scale * (x * Math.cos(angle) - y * Math.sin(angle)),
      y: item.y + item.scale * (x * Math.sin(angle) + y * Math.cos(angle))
    }));
  }
  function draw() {
    E.render(ctx, doc); ui.clearRect(0, 0, 1200, 630);
    const item = selected();
    if (item?.visible) {
      const b = E.bounds(ctx, item), ratio = 1200 / Math.max(1, overlay.getBoundingClientRect().width);
      ui.save(); E.transform(ui, item);
      ui.strokeStyle = '#8960d3'; ui.lineWidth = 1.5 * ratio / item.scale;
      ui.setLineDash([5 * ratio / item.scale, 4 * ratio / item.scale]);
      ui.strokeRect(b.left, b.top, b.right-b.left, b.bottom-b.top);
      ui.setLineDash([]); ui.fillStyle = '#ffffff';
      const handleSize = 9 * ratio / item.scale;
      ui.fillRect(b.right-handleSize/2,b.bottom-handleSize/2,handleSize,handleSize);
      ui.strokeRect(b.right-handleSize/2,b.bottom-handleSize/2,handleSize,handleSize);
      ui.restore();
    }
    $('overflow').hidden = !doc.elements.some(el => el.visible && corners(el, E.bounds(ctx, el)).some(p => p.x < 0 || p.x > 1200 || p.y < 0 || p.y > 630));
  }
  async function refreshFonts() {
    const token = ++renderToken;
    try {
      await Promise.all(doc.elements.filter(el => el.type === 'text').map(el => document.fonts.load(E.fontString(el.style), el.text || '日本語')));
      if (token === renderToken) draw();
    } catch { message('指定フォントを読み込めませんでした。標準フォントで表示します。', true); }
  }
  function renderLayers() {
    $('layers').replaceChildren();
    for (const item of [...doc.elements].reverse()) {
      const row = document.createElement('div'); row.className = 'layer-row'; row.classList.toggle('active', item.id === selectedId); row.setAttribute('role', 'listitem');
      const button = document.createElement('button'); button.className = 'layer-select';
      const label = `${item.type === 'text' ? 'T' : '✦'}  ${item.name || (item.type === 'text' ? item.text.slice(0, 16) : 'キラキラ')}`;
      button.textContent = label; button.title = item.type === 'text' ? item.text : label;
      button.setAttribute('aria-pressed', String(item.id === selectedId));
      button.onclick = () => { flush(); selectedId = item.id; sync(); };
      const visibility = document.createElement('button'); visibility.className = 'layer-visibility';
      visibility.textContent = item.visible ? '●' : '○'; visibility.title = item.visible ? '非表示にする' : '表示する';
      visibility.setAttribute('aria-label', `${label}を${item.visible ? '非表示' : '表示'}にする`);
      visibility.onclick = () => mutate(() => { item.visible = !item.visible; });
      row.append(button, visibility); $('layers').append(row);
    }
  }
  const aliases = { 'Meiryo': 'メイリオ', 'Yu Gothic': '游ゴシック', 'Yu Gothic UI': '游ゴシック UI', 'Yu Mincho': '游明朝', 'MS Gothic': 'ＭＳ ゴシック', 'MS PGothic': 'ＭＳ Ｐゴシック', 'MS UI Gothic': 'ＭＳ UIゴシック', 'MS Mincho': 'ＭＳ 明朝', 'MS PMincho': 'ＭＳ Ｐ明朝' };
  function fontLabel(name) { return aliases[name] ? `${aliases[name]} (${name})` : name; }
  function fontOptions() {
    const family = selected()?.style?.font || 'sans-serif', query = $('fontSearch').value.trim().toLocaleLowerCase();
    const names = [...new Set(['sans-serif', family, ...fontFamilies])];
    const select = $('font'); select.replaceChildren();
    for (const name of names) {
      const label = name === 'sans-serif' ? '標準（sans-serif）' : fontLabel(name);
      if (name !== family && name !== 'sans-serif' && !label.toLocaleLowerCase().includes(query)) continue;
      const option = document.createElement('option'); option.value = name; option.textContent = label; select.append(option);
    }
    select.value = family; select.style.fontFamily = family === 'sans-serif' ? 'sans-serif' : JSON.stringify(family);
  }
  function swatches() {
    $('swatches').replaceChildren();
    for (const key of ['top', 'bottom', 'inner', 'outer']) { const dot = document.createElement('span'); dot.style.background = selected()?.style?.[key] || '#ffffff'; $('swatches').append(dot); }
  }
  function properties() {
    const item = selected();
    $('properties').hidden = !item; $('emptySelection').hidden = !!item;
    $('selectionTitle').textContent = !item ? 'パーツを選択' : item.type === 'text' ? 'テキストを編集' : 'キラキラを編集';
    if (!item) return;
    $('textFields').hidden = item.type !== 'text'; $('sparkleFields').hidden = item.type !== 'sparkle';
    for (const key of ['name', 'x', 'y', 'rotation']) $(key).value = typeof item[key] === 'number' ? Math.round(item[key] * 100) / 100 : item[key];
    $('scale').value = Math.round(item.scale * 100);
    if (item.type === 'text') {
      $('title').value = item.text; $('preset').value = item.style.preset;
      for (const key of styleFields) { $(key).value = item.style[key]; if ($(`${key}V`)) $(`${key}V`).value = item.style[key]; }
      fontOptions(); swatches();
    } else { $('fill').value = item.fill; $('radius').value = item.radius; }
  }
  function sync() { properties(); renderLayers(); updateButtons(); draw(); }
  function mutate(fn) { flush(); fn(); history.push(doc); sync(); }
  function add(item) {
    if (doc.elements.length >= 40) { message('パーツは最大40個です。', true); return; }
    mutate(() => { doc.elements.push(item); selectedId = item.id; });
  }
  for (const key of ['name', 'title', ...styleFields, 'x', 'y', 'scale', 'rotation', 'radius', 'fill']) {
    $(key).addEventListener('input', event => {
      const item = selected(); if (!item || event.isComposing) return;
      let value = $(key).value;
      if (numericFields.includes(key)) {
        if (value === '' || !Number.isFinite(Number(value))) return;
        value = Math.min(Number($(key).max), Math.max(Number($(key).min), Number(value)));
      }
      if (key === 'title') { value = value.split('\n').slice(0, 4).join('\n'); item.text = value; if ($(key).value !== value) $(key).value = value; }
      else if (styleFields.includes(key)) item.style[key] = value;
      else item[key] = key === 'scale' ? value / 100 : value;
      if ($(`${key}V`)) $(`${key}V`).value = value;
      swatches(); renderLayers(); draw(); deferCommit();
      $('undo').disabled = false; $('redo').disabled = true;
    });
    $(key).addEventListener('change', () => { flush(); properties(); });
  }
  $('title').addEventListener('compositionend', () => $('title').dispatchEvent(new Event('input')));
  $('name').addEventListener('compositionend', () => $('name').dispatchEvent(new Event('input')));
  $('preset').onchange = () => mutate(() => {
    const item = selected(); if (item?.type !== 'text') return;
    item.style.preset = $('preset').value;
    ['top','bottom','inner','outer'].forEach((key,i) => item.style[key] = E.presets[item.style.preset][i]);
  });
  $('font').onchange = () => { mutate(() => { const item = selected(); if (item?.type === 'text') item.style.font = $('font').value; }); refreshFonts(); };
  $('fontSearch').oninput = fontOptions;
  $('fonts').onclick = async () => {
    if (!('queryLocalFonts' in window)) { $('fontStatus').textContent = 'この環境ではPC内のフォントを取得できません。Chrome / Edge の権限設定をご確認ください。'; return; }
    $('fonts').disabled = true; $('fontStatus').textContent = 'ブラウザのアクセス許可を確認中…';
    try {
      const fonts = await window.queryLocalFonts();
      fontFamilies = [...new Set(fonts.map(f => f.family))].sort((a,b) => a.localeCompare(b,'ja'));
      fontOptions(); $('fontStatus').textContent = `${fontFamilies.length}ファミリーを取得しました。既知のフォントは日本語名も表示します。`;
      refreshFonts();
    } catch (err) { $('fontStatus').textContent = `フォント取得に失敗しました (${err.name})。権限を確認して再試行できます。`; }
    finally { $('fonts').disabled = false; }
  };
  $('addText').onclick = () => {
    const item = E.textElement('初見さん大歓迎！'); item.name = 'サブタイトル'; item.style.size = 60; item.y = 465; add(item);
  };
  $('addSparkle').onclick = () => add(E.sparkle());
  $('duplicate').onclick = () => {
    const item = selected(); if (!item) return;
    const copy = E.clone(item); copy.id = E.textElement().id; copy.name += ' のコピー'; copy.x += 24; copy.y += 24; add(copy);
  };
  $('remove').onclick = () => mutate(() => {
    const index = doc.elements.findIndex(el => el.id === selectedId); if (index < 0) return;
    doc.elements.splice(index,1); selectedId = doc.elements[Math.min(index,doc.elements.length-1)]?.id || null;
  });
  for (const [button, delta] of [['forward',1],['backward',-1]]) $(button).onclick = () => mutate(() => {
    const index = doc.elements.findIndex(el => el.id === selectedId), next = index + delta;
    if (index >= 0 && next >= 0 && next < doc.elements.length) [doc.elements[index],doc.elements[next]] = [doc.elements[next],doc.elements[index]];
  });
  $('center').onclick = () => mutate(() => { const item = selected(); if (item) { item.x = 600; item.y = 315; } });
  function travel(direction) {
    flush(); const next = history[direction](); if (!next) return;
    doc = next; if (!selected()) selectedId = doc.elements.at(-1)?.id || null;
    sync(); refreshFonts(); message(direction === 'undo' ? 'ひとつ前の編集に戻しました。' : '編集をやり直しました。');
  }
  $('undo').onclick = () => travel('undo'); $('redo').onclick = () => travel('redo');
  function pointer(event) { const r = overlay.getBoundingClientRect(); return { x: (event.clientX-r.left)*1200/r.width, y: (event.clientY-r.top)*630/r.height }; }
  overlay.onpointerdown = event => {
    if (event.button !== 0 || drag) return;
    flush(); const p = pointer(event), item = selected();
    let handle = false;
    if (item?.visible) {
      const b = E.bounds(ctx, item), lp = E.localPoint(item,p.x,p.y), tolerance = 12*1200/overlay.getBoundingClientRect().width/item.scale;
      handle = Math.abs(lp.x-b.right) <= tolerance && Math.abs(lp.y-b.bottom) <= tolerance;
    }
    const hit = handle ? item : E.hitTest(ctx,doc,p.x,p.y); selectedId = hit?.id || null; sync();
    if (!hit) return;
    overlay.focus({preventScroll:true}); overlay.setPointerCapture(event.pointerId);
    drag = { pointerId:event.pointerId, item:hit, before:E.clone(hit), start:p, handle, b:E.bounds(ctx,hit) };
  };
  overlay.onpointermove = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const p = pointer(event), d = drag;
    if (d.handle) {
      const lp = E.localPoint(d.before,p.x,p.y), denom = d.b.right**2+d.b.bottom**2;
      d.item.scale = Math.max(.05,Math.min(8,d.before.scale*(lp.x*d.b.right+lp.y*d.b.bottom)/Math.max(1,denom)));
    } else { d.item.x = Math.max(-10000,Math.min(10000,d.before.x+p.x-d.start.x)); d.item.y = Math.max(-10000,Math.min(10000,d.before.y+p.y-d.start.y)); }
    properties(); draw();
  };
  function finishDrag(event, cancel = false) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const d = drag; drag = null;
    if (cancel) Object.assign(d.item,d.before); else history.push(doc);
    if (overlay.hasPointerCapture(d.pointerId)) overlay.releasePointerCapture(d.pointerId);
    sync();
  }
  overlay.onpointerup = event => finishDrag(event);
  overlay.onpointercancel = event => finishDrag(event,true);
  overlay.onlostpointercapture = event => finishDrag(event,true);
  document.addEventListener('keydown', event => {
    if (event.isComposing || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === 'Escape' && drag) { finishDrag(null,true); return; }
    if (drag) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo'); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); travel('redo'); return; }
    const item = selected(); if (!item || event.target !== overlay) return;
    const delta = event.shiftKey ? 10 : 1;
    const directions = { ArrowLeft:[-delta,0], ArrowRight:[delta,0], ArrowUp:[0,-delta], ArrowDown:[0,delta] };
    if (directions[event.key]) {
      event.preventDefault(); const [dx,dy] = directions[event.key]; item.x = Math.max(-10000,Math.min(10000,item.x+dx)); item.y = Math.max(-10000,Math.min(10000,item.y+dy)); deferCommit(); properties(); draw(); $('undo').disabled = false;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); $('remove').click(); }
  });
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
  }
  $('saveJson').onclick = () => { flush(); download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),'pop-logo-project.json'); message('編集データを保存しました。'); };
  $('save').onclick = async () => {
    $('save').disabled = true;
    try {
      // Snapshot ensures that font waits cannot mix two different editing states.
      const output = E.clone(doc);
      await Promise.all(output.elements.filter(el => el.type === 'text').map(el => document.fonts.load(E.fontString(el.style),el.text || '日本語')));
      const exported = document.createElement('canvas'); exported.width = 1200; exported.height = 630;
      E.render(exported.getContext('2d', { willReadFrequently: true }),output);
      const blob = await new Promise(resolve => exported.toBlob(resolve,'image/png'));
      if (!blob) throw new Error('画像を生成できませんでした。');
      download(blob,'pop-logo.png'); message('1200 × 630 px の透過PNGを保存しました。');
    } catch (error) { message(`PNGの保存に失敗しました: ${error.message}`,true); }
    finally { $('save').disabled = false; }
  };
  $('loadJson').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 2*1024*1024) throw new Error('ファイルサイズは2MB以下にしてください。');
      const raw = JSON.parse(await file.text()), next = E.parseDocument(raw);
      mutate(() => { doc = next; selectedId = doc.elements.at(-1)?.id || null; });
      refreshFonts(); message(raw.version == null ? '試運転版の設定を読み込みました。星は編集できるパーツに変換しました。' : '編集データを読み込みました。');
      if (doc.elements.some(el => el.type === 'text' && el.style.font !== 'sans-serif')) $('fontStatus').textContent = '保存したフォント名を復元しました。このPCに同じフォントが必要です。未インストールの場合は標準フォントで表示されます。';
    } catch (error) { message(`読み込みに失敗しました: ${error.message}`,true); }
    finally { event.target.value = ''; }
  };
  window.addEventListener('resize',draw);
  document.fonts.addEventListener('loadingdone',draw);
  sync(); refreshFonts();
})();
