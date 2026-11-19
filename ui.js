// ui.js — 정책 버튼, 통계 카드, 이벤트 기록, 결과 화면 (DOM)
// 전역 game 객체(sketch.js)를 읽고 화면을 갱신한다.

const LEVEL_NAMES = {
  dist: ['해제', '약', '중', '강'],
  vax: ['중단', '소규모', '중간', '대규모'],
};

function buildControls() {
  document.getElementById('btn-mask').onclick = () => setPolicy('mask', game.set.mask ? 0 : 1);
  document.getElementById('btn-bed').onclick = buyBed;
  fillSegment('dist', LEVEL_NAMES.dist);
  fillSegment('vax', LEVEL_NAMES.vax);
  for (const k of ['mask', 'dist', 'vax', 'bed']) {
    document.getElementById('desc-' + k).textContent = POLICY_INFO[k].desc;
  }
  document.querySelectorAll('.speed').forEach(b => {
    b.onclick = () => setSpeed(Number(b.dataset.speed));
  });
}

function fillSegment(key, names) {
  const box = document.getElementById('seg-' + key);
  box.innerHTML = '';
  names.forEach((name, i) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.dataset.level = i;
    b.onclick = () => setPolicy(key, i);
    box.appendChild(b);
  });
}

function setPolicy(key, val) {
  if (game.ended) return;
  game.set = { ...game.set, [key]: val };
  renderAll();
}

function setSpeed(s) {
  if (game.ended) return;
  game.speed = s;
  renderAll();
}

function buyBed() {
  if (game.ended) return;
  const day = game.st.day;
  const lv = game.set.bed;
  const cost = bedUpgradeCost(lv);
  if (cost === null) return addLog(day, '병상은 이미 최대 단계입니다.');
  if (game.budget < cost) return addLog(day, `예산이 부족해 병상을 확충할 수 없습니다 (${cost}억 원 필요).`);
  game.budget -= cost;
  game.set = { ...game.set, bed: lv + 1 };
  addLog(day, `병상을 확충했습니다 → 병상 ${fmtNum(bedCapacity(game.set))}개 (${cost}억 원 사용)`);
  renderAll();
}

function addLog(day, msg) {
  const ol = document.getElementById('log');
  const li = document.createElement('li');
  li.textContent = `${day}일차 · ${msg}`;
  ol.prepend(li);
  while (ol.children.length > 60) ol.lastChild.remove();
}

function markActive(container, level) {
  [...container.children].forEach(b => b.classList.toggle('on', Number(b.dataset.level) === level));
}

function renderAll() {
  const set = game.set;
  const maskBtn = document.getElementById('btn-mask');
  maskBtn.textContent = set.mask ? '마스크 끄기' : '마스크 켜기';
  maskBtn.classList.toggle('on', !!set.mask);

  markActive(document.getElementById('seg-dist'), set.dist);
  markActive(document.getElementById('seg-vax'), set.vax);

  const bedCost = bedUpgradeCost(set.bed);
  const bedBtn = document.getElementById('btn-bed');
  bedBtn.textContent = bedCost === null ? '확충 완료 (최대)' : `병상 확충 (${bedCost}억 원)`;
  bedBtn.disabled = bedCost === null || game.ended;

  document.querySelectorAll('.speed').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.speed) === game.speed);
  });
  document.getElementById('day-label').textContent = `${game.st.day}일차 / ${DAYS}일`;
  renderStats();
}

function renderStats() {
  const st = game.st, set = game.set;
  const N = st.S + st.E1 + st.E2 + st.I1 + st.I2 + st.R;
  const cap = bedCapacity(set);
  const rt = effectiveBeta(set) * (st.S / N) / PARAM.rec1;
  const cards = [
    ['현재 감염자', fmtNum(st.I1 + st.I2), '#f97316'],
    ['누적 감염자', fmtNum(st.cumInf), '#60a5fa'],
    ['사망자', fmtNum(st.D), '#f43f5e'],
    ['중증 / 병상', `${fmtNum(st.I2)} / ${fmtNum(cap)}`, st.I2 > cap ? '#ef4444' : '#a7f3d0'],
    ['남은 예산', `${fmtNum(game.budget)}억`, '#fde68a'],
    ['하루 비용', `${dailyCost(set).toFixed(1)}억`, '#c4b5fd'],
    ['실효 재생산수 (추정)', rt.toFixed(2), rt > 1 ? '#f87171' : '#86efac'],
  ];
  document.getElementById('stats').innerHTML = cards.map(([label, value, color]) =>
    `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value" style="color:${color}">${value}</div></div>`
  ).join('');
}

function showResult() {
  const ev = evaluatePolicies(game.timeline);
  const a = ev.actual;
  const score = calcScore(a, game.budget);
  const spent = policyCosts(game.timeline, game.set.bed);
  const tl = game.timeline;
  const maskDays = tl.filter(s => s.mask).length;
  const maxDist = Math.max(0, ...tl.map(s => s.dist));
  const maxVax = Math.max(0, ...tl.map(s => s.vax));
  const summary = {
    mask: `${maskDays}일 사용`,
    dist: `최고 단계: ${LEVEL_NAMES.dist[maxDist]}`,
    vax: `최고 단계: ${LEVEL_NAMES.vax[maxVax]}`,
    bed: `최종 ${game.set.bed}단계 (병상 ${fmtNum(bedCapacity(game.set))}개)`,
  };
  const sgn = v => (v > 0 ? '+' : '') + fmtNum(v);
  const rows = ['mask', 'dist', 'vax', 'bed'].map(k => {
    const e = ev.effects[k];
    return `<tr><td>${POLICY_INFO[k].name}</td><td>${summary[k]}</td><td>${fmtNum(spent[k])}억</td>` +
      `<td>${sgn(e.deaths)}명</td><td>${sgn(e.infections)}명</td></tr>`;
  }).join('');
  const lessons = ['mask', 'dist', 'vax', 'bed'].map(k =>
    `<li><b>${POLICY_INFO[k].name}</b>: ${POLICY_INFO[k].lesson}</li>`).join('');
  const box = document.getElementById('result');
  box.innerHTML = `
    <div class="result-box">
      <h2>최종 결과</h2>
      <div class="grade">${score.grade}<span>${score.total}점</span></div>
      <p class="score-detail">건강 점수 ${score.health}/800 · 예산 점수 ${score.money}/200</p>
      <p>${game.st.day}일 동안 누적 감염 <b>${fmtNum(a.cumInf)}명</b>, 사망 <b>${fmtNum(a.D)}명</b>,
         총 지출 <b>${fmtNum(BUDGET - game.budget)}억 원</b> (남은 예산 ${fmtNum(game.budget)}억 원)</p>
      <p>아무 정책도 없었다면 누적 감염 ${fmtNum(ev.none.cumInf)}명, 사망 ${fmtNum(ev.none.D)}명이었을 것입니다.</p>
      <h3>정책별 효과 (해당 정책만 뺐을 때 늘어나는 피해)</h3>
      <table>
        <thead><tr><th>정책</th><th>선택</th><th>지출</th><th>사망</th><th>감염</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h3>배운 점</h3>
      <ul>${lessons}</ul>
      <button id="btn-restart" class="big">다시 하기</button>
    </div>`;
  box.classList.remove('hidden');
  document.getElementById('btn-restart').onclick = () => location.reload();
}
