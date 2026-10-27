/* "우리" 탭 (10/27) — api/together.js 의 화면. app.js 와 따로 둡니다 (app.js 가 3,000줄이 넘어서).
   오늘의 질문 · 콕 찌르기 · 1년 전 오늘 · 사진 일기/앨범 · 버킷리스트 · 가계부 · 맛집/문화 · 지도(장소·서로 위치).
   지도는 열 때만 Leaflet 과 OpenStreetMap 타일을 불러옵니다 (키·비용 없음). 문구는 한국어·영어. */
(() => {
  if (!document.body || !document.body.appendChild) return;  // screen-test.mjs 의 가짜 DOM 에는 body 가 없다
  const KO =(document.documentElement.lang || navigator.language || '').startsWith('ko');
  const T = KO ? {
    title: '우리', today: '오늘', diary: '일기', bucket: '버킷', ledger: '가계부', log: '기록', map: '지도',
    question: '오늘의 질문', answer: '답하기', yours: '내 답', theirs: '상대 답', waiting: '상대가 아직 답하지 않았어요',
    locked: '내가 답하면 상대 답이 열려요', theyDone: '상대는 답했어요 — 내가 답하면 볼 수 있어요',
    nudge: '콕 찌르기 💗', nudgesLeft: (n) => `오늘 ${n}번 남음`, nudgeSent: '보냈어요', memory: '1년 전 오늘',
    add: '추가', title_: '제목', memo: '메모', amount: '금액', day: '날짜', photo: '사진', save: '저장', del: '삭제',
    food: '맛집', culture: '문화', total: '합계', empty: '아직 없어요', close: '닫기',
    share: '내 위치 공유', shareOff: '공유 끄기', shareNote: '둘 다 켜야 서로 보여요. 마지막 위치 하나만 우리 DB에 남고, 끄면 지워져요.',
    tapMap: '지도를 눌러 장소를 추가하세요', placeName: '장소 이름', me: '나', them: '상대', theyOff: '상대는 위치 공유를 꺼 두었어요',
  } : {
    title: 'Us', today: 'Today', diary: 'Diary', bucket: 'Bucket', ledger: 'Money', log: 'Log', map: 'Map',
    question: 'Question of the day', answer: 'Answer', yours: 'You', theirs: 'Them', waiting: 'They haven’t answered yet',
    locked: 'Answer to see theirs', theyDone: 'They answered — answer to see it',
    nudge: 'Nudge 💗', nudgesLeft: (n) => `${n} left today`, nudgeSent: 'Sent', memory: 'A year ago today',
    add: 'Add', title_: 'Title', memo: 'Note', amount: 'Amount', day: 'Date', photo: 'Photo', save: 'Save', del: 'Delete',
    food: 'Food', culture: 'Culture', total: 'Total', empty: 'Nothing yet', close: 'Close',
    share: 'Share my location', shareOff: 'Stop sharing', shareNote: 'You see each other only when both share. Only the last spot is kept in your own database, and turning it off deletes it.',
    tapMap: 'Tap the map to add a place', placeName: 'Place name', me: 'Me', them: 'Them', theyOff: 'They are not sharing their location',
  };
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let data = null, tab = 'today', map = null, layer = null, watch = null, lastSent = 0;

  async function call(method, body, query = '') {
    const r = await fetch('/api/together' + query, {
      method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status });
    data = j;
    return j;
  }
  const item = (b) => call('POST', { action: 'item', ...b }).then(render);
  const patch = (id, b) => call('PATCH', { action: 'item', id, ...b }).then(render);
  const remove = (id) => call('DELETE', null, '?id=' + encodeURIComponent(id)).then(render);

  /* ── 틀 ── */
  const root = document.createElement('section');
  root.id = 'together';
  root.className = 'together';
  root.hidden = true;
  root.innerHTML = `
    <header class="tg-head"><h2>${T.title}</h2><button class="icon-btn tg-close" type="button" aria-label="${T.close}">✕</button></header>
    <nav class="tg-tabs">${['today', 'diary', 'bucket', 'ledger', 'log', 'map'].map((k) => `<button type="button" data-tab="${k}">${T[k]}</button>`).join('')}</nav>
    <div class="tg-body"></div>`;
  document.body.appendChild(root);
  $('.tg-close', root).onclick = () => { root.hidden = true; stopWatch(); };
  root.querySelectorAll('.tg-tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; render(); }; });

  const btn = document.createElement('button');
  btn.id = 'open-together';
  btn.className = 'icon-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', T.title);
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  const settingsBtn = $('#open-settings');
  if (settingsBtn) settingsBtn.before(btn);
  btn.onclick = async () => {
    root.hidden = false;
    try { await call('GET'); } catch (e) { if (e.status === 401) { root.hidden = true; return; } }
    render();
  };

  /* ── 탭마다 ── */
  function render() {
    if (!data || root.hidden) return;
    root.querySelectorAll('.tg-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('.tg-body', root);
    const items = (k) => data.items.filter((i) => i.kind === k);
    if (tab === 'today') body.innerHTML = todayView();
    else if (tab === 'diary') body.innerHTML = diaryView(items('diary'));
    else if (tab === 'bucket') body.innerHTML = listView('bucket', items('bucket'), { check: true });
    else if (tab === 'ledger') body.innerHTML = ledgerView(items('ledger'));
    else if (tab === 'log') body.innerHTML = listView('food', items('food'), { heading: T.food }) + listView('culture', items('culture'), { heading: T.culture });
    else if (tab === 'map') body.innerHTML = mapView();
    wire(body);
    if (tab === 'map') drawMap();
  }

  function todayView() {
    const q = data.question;
    const answered = q.mine !== null;
    const yearAgo = new Date(Date.parse(q.day) - 365 * 864e5).toISOString().slice(0, 10);
    const memories = data.items.filter((i) => i.kind === 'diary' && i.day === yearAgo);
    return `
      <div class="tg-card"><h3>${T.question}</h3><p class="tg-q">${esc(q.text)}</p>
        ${answered ? `<p><b>${T.yours}</b> ${esc(q.mine)}</p>
          <p><b>${T.theirs}</b> ${q.theirs !== null ? esc(q.theirs) : `<span class="muted">${T.waiting}</span>`}</p>`
        : `<p class="muted">${q.theyAnswered ? T.theyDone : T.locked}</p>
          <form data-form="answer"><textarea name="text" rows="3" required maxlength="1000"></textarea><button class="btn primary">${T.answer}</button></form>`}
      </div>
      <div class="tg-card"><button class="btn primary" data-act="nudge" ${data.nudgesLeft ? '' : 'disabled'}>${T.nudge}</button>
        <span class="muted">${T.nudgesLeft(data.nudgesLeft)}</span></div>
      ${memories.length ? `<div class="tg-card"><h3>${T.memory}</h3>${memories.map(diaryEntry).join('')}</div>` : ''}`;
  }

  const photoUrl = (id) => '/api/photos/' + encodeURIComponent(id);
  const diaryEntry = (i) => `<article class="tg-entry"><div class="tg-date">${esc(i.day || '')}</div>
    ${i.photoId ? `<img src="${photoUrl(i.photoId)}" alt="" loading="lazy">` : ''}${i.title ? `<h4>${esc(i.title)}</h4>` : ''}<p>${esc(i.memo)}</p>
    <button class="link" data-del="${i.id}">${T.del}</button></article>`;

  function diaryView(list) {
    const album = list.filter((i) => i.photoId);
    return `<form class="tg-card" data-form="diary">
        <input name="day" type="date" value="${data.question.day}" required>
        <input name="title" placeholder="${T.title_}" maxlength="120">
        <textarea name="memo" rows="3" placeholder="${T.memo}" maxlength="2000"></textarea>
        <label class="btn">${T.photo}<input name="photo" type="file" accept="image/*" hidden></label>
        <button class="btn primary">${T.save}</button></form>
      ${album.length ? `<div class="tg-album">${album.map((i) => `<img src="${photoUrl(i.photoId)}" alt="" loading="lazy">`).join('')}</div>` : ''}
      ${list.length ? list.map(diaryEntry).join('') : `<p class="muted">${T.empty}</p>`}`;
  }

  function listView(kind, list, { check = false, heading = '' } = {}) {
    return `${heading ? `<h3>${heading}</h3>` : ''}
      <form class="tg-row" data-form="item" data-kind="${kind}"><input name="title" placeholder="${T.title_}" required maxlength="120">
        <input name="memo" placeholder="${T.memo}" maxlength="2000"><button class="btn primary">${T.add}</button></form>
      <ul class="tg-list">${list.map((i) => `<li class="${i.done ? 'done' : ''}">
        ${check ? `<input type="checkbox" data-done="${i.id}" ${i.done ? 'checked' : ''}>` : ''}
        <span><b>${esc(i.title)}</b> ${i.memo ? `<span class="muted">${esc(i.memo)}</span>` : ''}</span>
        <button class="link" data-del="${i.id}">${T.del}</button></li>`).join('') || `<li class="muted">${T.empty}</li>`}</ul>`;
  }

  function ledgerView(list) {
    const sum = list.reduce((s, i) => s + (i.amount || 0), 0);
    return `<form class="tg-row" data-form="item" data-kind="ledger">
        <input name="day" type="date" value="${data.question.day}"><input name="title" placeholder="${T.title_}" required maxlength="120">
        <input name="amount" type="number" inputmode="numeric" placeholder="${T.amount}" required><button class="btn primary">${T.add}</button></form>
      <p class="tg-total">${T.total} <b>${sum.toLocaleString()}</b></p>
      <ul class="tg-list">${list.map((i) => `<li><span class="muted">${esc(i.day || '')}</span> <span>${esc(i.title)}</span>
        <b>${(i.amount || 0).toLocaleString()}</b><button class="link" data-del="${i.id}">${T.del}</button></li>`).join('') || `<li class="muted">${T.empty}</li>`}</ul>`;
  }

  function mapView() {
    const loc = data.location;
    return `<div class="tg-card"><button class="btn ${loc.on ? '' : 'primary'}" data-act="share">${loc.on ? T.shareOff : T.share}</button>
        <p class="muted">${T.shareNote}</p>${loc.on && !loc.theyOn ? `<p class="muted">${T.theyOff}</p>` : ''}</div>
      <div id="tg-map" class="tg-map"></div><p class="muted">${T.tapMap}</p>
      <ul class="tg-list">${data.items.filter((i) => i.kind === 'place').map((i) => `<li><span>📍 ${esc(i.title)}</span><button class="link" data-del="${i.id}">${T.del}</button></li>`).join('')}</ul>`;
  }

  /* ── 동작 ── */
  function wire(body) {
    body.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => remove(b.dataset.del); });
    body.querySelectorAll('[data-done]').forEach((c) => { c.onchange = () => patch(c.dataset.done, { done: c.checked }); });
    body.querySelectorAll('form[data-form]').forEach((f) => {
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        if (f.dataset.form === 'answer') return call('POST', { action: 'answer', text: v.text }).then(render);
        if (f.dataset.form === 'item') return item({ kind: f.dataset.kind, title: v.title, memo: v.memo || '', amount: v.amount, day: v.day });
        if (f.dataset.form === 'diary') {
          const file = f.photo.files[0];
          const photoId = file ? await upload(file) : null;
          return item({ kind: 'diary', title: v.title, memo: v.memo, day: v.day, photoId });
        }
      };
    });
    const nudge = $('[data-act="nudge"]', body);
    if (nudge) nudge.onclick = () => call('POST', { action: 'nudge' }).then(() => { nudge.textContent = T.nudgeSent; setTimeout(render, 1200); }).catch(render);
    const share = $('[data-act="share"]', body);
    if (share) share.onclick = () => (data.location.on ? call('POST', { action: 'location', on: false }).then(() => { stopWatch(); render(); }) : startWatch());
  }

  /** 사진: 긴 변 1280px webp 로 줄여 /api/photos 에 올리고 id 를 받습니다 */
  async function upload(file) {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/webp', 0.82);
    const mime = url.startsWith('data:image/webp') ? 'image/webp' : 'image/png';
    const r = await fetch('/api/photos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mime, data: url.split(',')[1], purpose: 'diary' }) });
    if (!r.ok) throw new Error('upload');
    return (await r.json()).id;
  }

  /* ── 위치: 켜 둔 동안 이 화면이 열려 있으면 1분에 한 번만 올립니다 ── */
  function startWatch() {
    if (!navigator.geolocation) return;
    watch = navigator.geolocation.watchPosition((p) => {
      if (Date.now() - lastSent < 60000 && data.location.on) return;
      lastSent = Date.now();
      call('POST', { action: 'location', on: true, lat: p.coords.latitude, lng: p.coords.longitude }).then(render);
    }, () => {}, { enableHighAccuracy: false, maximumAge: 60000 });
  }
  function stopWatch() { if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null; }

  /* ── 지도: Leaflet 을 처음 열 때만 불러옵니다 ── */
  let leaflet = null;
  function loadLeaflet() {
    if (leaflet) return leaflet;
    leaflet = new Promise((ok, fail) => {
      const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
      const js = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', onload: ok, onerror: fail });
      document.head.append(css, js);
    });
    return leaflet;
  }
  async function drawMap() {
    await loadLeaflet();
    const el = $('#tg-map', root);
    if (!el) return;
    if (map) { map.remove(); map = null; }
    map = L.map(el);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    layer = L.featureGroup().addTo(map);
    data.items.filter((i) => i.kind === 'place' && i.lat != null).forEach((i) => L.marker([i.lat, i.lng]).bindPopup(esc(i.title)).addTo(layer));
    const loc = data.location;
    if (loc.me) L.circleMarker([loc.me.lat, loc.me.lng], { radius: 9, color: '#d96570' }).bindPopup(T.me).addTo(layer);
    if (loc.them) L.circleMarker([loc.them.lat, loc.them.lng], { radius: 9, color: '#4a6fa5' }).bindPopup(T.them).addTo(layer);
    if (layer.getLayers().length) map.fitBounds(layer.getBounds().pad(0.3), { maxZoom: 15 });
    else map.setView([37.5665, 126.978], 11);
    map.on('click', (e) => {
      const name = window.prompt(T.placeName);
      if (name) item({ kind: 'place', title: name, lat: e.latlng.lat, lng: e.latlng.lng });
    });
  }
})();
