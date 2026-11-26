// screens.js — 메인 메뉴 → 국가 선택 → 국가별 브리핑 → 게임. 화면 전환과 국가 시작(startCountry)

let pickedCountry = null;

function showScreen(name) {
  for (const id of ['menu', 'select', 'brief']) {
    document.getElementById('screen-' + id).classList.toggle('hidden', id !== name);
  }
  document.getElementById('game-view').classList.toggle('hidden', name !== 'game');
  document.getElementById('toast').classList.remove('show');
  if (name !== 'game') {
    for (const id of ['result', 'event', 'laws', 'guide', 'compare', 'learn', 'medical', 'records']) document.getElementById(id).classList.add('hidden');
  } else {
    windowResized();   // 숨겨져 있던 캔버스 크기를 다시 맞춘다
  }
  window.scrollTo(0, 0);
}

// 국기: 이미지(Windows 등에서 이모지 국기가 글자로 보이는 문제를 피함). 이미지를 못 불러오면 이모지로 대신한다.
function flagHtml(c) {
  return `<img class="flag-img" src="https://flagcdn.com/w80/${c.code}.png" alt="${c.name} 국기" ` +
    `onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'flag-emoji',textContent:'${c.flag}'}))">`;
}

const diffLabel = d => (d <= 2 ? '쉬움' : d === 3 ? '보통' : '어려움');
const stars = d => '★'.repeat(d) + '☆'.repeat(5 - d);

function renderCountryGrid() {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = COUNTRIES.map(c => `
    <button class="country-card ${pickedCountry === c.id ? 'on' : ''}" data-country="${c.id}">
      <span class="flag">${flagHtml(c)}</span>
      <span class="cname">${c.name}</span>
      <span class="cdiff">난이도 <b>${stars(c.difficulty)}</b> ${diffLabel(c.difficulty)}</span>
      <span class="ctag">${esc(c.tagline)}</span>
      <span class="cchips">${c.chips.map(t => `<i>${esc(t)}</i>`).join('')}</span>
      <span class="crow"><b>방역 여건</b> ${esc(c.card.control)}</span>
      <span class="crow"><b>의료체계</b> ${esc(c.card.health)}</span>
      <span class="crow"><b>경제</b> ${esc(c.card.economy)}</span>
    </button>`).join('');
  grid.querySelectorAll('.country-card').forEach(b => {
    b.onclick = () => { pickedCountry = b.dataset.country; renderCountryGrid(); };
  });
  document.getElementById('btn-pick').disabled = !pickedCountry;
}

function fieldRow(c, f) {
  const badge = f.basis === 'ref'
    ? '<span class="basis ref">참고 자료</span>' : '<span class="basis game">게임 가정</span>';
  const link = f.src ? ` <a href="${esc(f.src[1])}" target="_blank" rel="noopener noreferrer">출처: ${esc(f.src[0])}</a>` : '';
  const note = f.note ? `<br><small>${esc(f.note)}</small>` : '';
  return `<tr><td>${esc(f.label)}</td><td><b>${esc(f.fmt(c[f.key]))}</b></td><td>${badge}</td><td>${esc(f.effect)}${note}${link}</td></tr>`;
}

// 실제 역사에서 그 시점 이후에야 가능했던 정책 (게임에서는 잠금)
function unlockLines(c) {
  const day = d => Math.max(0, Math.ceil((Date.parse(d) - Date.parse(c.realStart)) / (TIME_RATIO * 864e5)));
  const L = [
    ['vax', '백신 접종', `실제 접종 시작 ${dotDate(c.unlock.vax)}경`],
    ['support', '경제적 피해 지원', `관련 지원 제도 ${dotDate(c.unlock.support)}경`],
    ['school2', '학교 전면 제한', `전국 휴교 ${dotDate(c.unlock.school2)}경`],
  ];
  const lines = L.map(([k, n, t]) => `${n}: ${t} → 게임 ${day(c.unlock[k])}일차부터 선택 가능`);
  if (c.limits) Object.keys(c.limits).forEach(k => lines.push(c.limitNote[k]));
  return lines;
}

function renderBrief(id) {
  const c = COUNTRY_BY_ID[id];
  document.getElementById('brief-box').innerHTML = `
    <h2>${flagHtml(c)} ${c.name} — 상황 브리핑 <span class="cdiff">난이도 <b>${stars(c.difficulty)}</b></span></h2>
    <section class="fact"><h4>📖 역사적 배경 <small>실제 있었던 일</small></h4><p>${esc(c.history)}</p></section>
    <section class="assume"><h4>⏱ 게임용 압축 타임라인</h4>
      <p>게임 1일 ≈ 실제 약 ${TIME_RATIO}일입니다. 게임 시작은 실제 ${realDate(0, c)}, 180일차는 실제 ${realDate(179, c)}쯤에 해당합니다. 실제로는 2년 가까운 기간을 180일로 압축한 것입니다.</p></section>
    <h3>초기 조건과 정책 여건</h3>
    <p class="hint">'참고 자료'는 실제 상황이나 통계를 참고한 값, '게임 가정'은 게임 균형을 위해 정한 가상 값입니다. 모든 효과 수치는 단순화한 교육용 가정입니다.</p>
    <div class="table-wrap"><table class="fields"><thead><tr><th>항목</th><th>값</th><th>근거</th><th>게임에서의 역할</th></tr></thead>
      <tbody>${FIELDS.map(f => fieldRow(c, f)).join('')}</tbody></table></div>
    <h3>행정·법적 제약과 강점 <small class="hint">(게임 가정)</small></h3>
    <ul>${c.constraints.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>🔒 시점에 따라 열리는 정책 <small class="hint">(실제 역사에서 그 시점 이후에야 가능했던 정책은 게임에서도 잠겨 있습니다)</small></h3>
    <ul>${unlockLines(c).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>📊 최종 평가 기준 <small class="hint">(교육용 · 나라마다 가중치가 다름)</small></h3>
    <p>${METRIC_NAMES.map((n, i) => `${n} <b>${Math.round(c.weights[i] * 100)}%</b>`).join(' · ')}</p>
    <ul>${(MISSIONS[c.id] || []).map(m => `<li>미션: <b>${esc(m.title)}</b> — ${esc(m.desc)}</li>`).join('')}</ul>
    <section class="goal-box"><h4>🎯 이번 시나리오의 목표</h4>
      <p><b>${esc(c.goal.title)}</b></p><p>${esc(c.goal.text)}</p>
      <p class="hint">이 목표는 교육용 게임 목표이며, 실제 국가의 대응에 대한 역사적 평가가 아닙니다.</p></section>
    <div class="screen-actions">
      <button id="btn-brief-back">← 국가 선택</button>
      <button id="btn-brief-start" class="big">게임 시작</button>
    </div>`;
  document.getElementById('btn-brief-back').onclick = () => showScreen('select');
  document.getElementById('btn-brief-start').onclick = () => startCountry(id);
}

// 선택한 국가의 조건으로 새 게임을 시작한다
function startCountry(id) {
  const c = COUNTRY_BY_ID[id];
  if (!c) return;
  applyScenario(c);
  for (const m of ['result', 'event', 'compare']) document.getElementById(m).classList.add('hidden');
  document.getElementById('log').innerHTML = '';
  acc = 0;
  newGame();
  mapLegend();
  document.getElementById('country-label').innerHTML = `${flagHtml(c)} ${esc(c.name)}`;
  renderAll();
  showScreen('game');
  notifyStart();
}

function goToSelect() {
  if (game && !game.ended && game.st.day > 0 && !confirm('진행 중인 게임이 사라집니다. 국가 선택 화면으로 갈까요?')) return;
  game.speed = 0;
  renderCountryGrid();
  showScreen('select');
}

function buildScreens() {
  document.getElementById('menu-start').onclick = () => { renderCountryGrid(); showScreen('select'); };
  document.getElementById('menu-howto').onclick = () => document.getElementById('guide').classList.remove('hidden');
  document.getElementById('btn-select-back').onclick = () => showScreen('menu');
  document.getElementById('btn-pick').onclick = () => { if (pickedCountry) { renderBrief(pickedCountry); showScreen('brief'); } };
  document.getElementById('btn-change-country').onclick = goToSelect;
  showScreen('menu');
}
