// ui.js — 정책 버튼, 안내 문구, 변화 알림, 통계 카드, 결과 화면 (DOM)
// 전역 game 객체(sketch.js)를 읽고 화면을 갱신한다.

const LEVEL_NAMES = {
  mask: ['해제', '권고', '의무'],
  dist: ['해제', '약', '중', '강'],
  vax: ['중단', '소규모', '중간', '대규모'],
};

function buildControls() {
  document.getElementById('btn-bed').onclick = buyBed;
  fillSegment('mask', LEVEL_NAMES.mask);
  fillSegment('dist', LEVEL_NAMES.dist);
  fillSegment('vax', LEVEL_NAMES.vax);
  for (const k of ['mask', 'dist', 'vax', 'bed']) {
    document.getElementById('desc-' + k).textContent = POLICY_INFO[k].desc;
  }
  document.querySelectorAll('.speed').forEach(b => {
    b.onclick = () => setSpeed(Number(b.dataset.speed));
  });
  document.getElementById('btn-help').onclick = () => document.getElementById('guide').classList.remove('hidden');
  document.getElementById('btn-map').onclick = mapToggle;
  document.getElementById('btn-auto').onclick = toggleAuto;
  buildPolicyMenu();
  buildCompare();
  buildLearn();
  buildMedical();
  buildRecords();
  document.getElementById('btn-guide-start').onclick = () => document.getElementById('guide').classList.add('hidden');
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

// 짧은 알림(토스트) + 사건 기록에 함께 남긴다
let toastTimer = null;
function notify(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  addLog(game.st.day, msg);
}

function addLog(day, msg) {
  const ol = document.getElementById('log');
  const li = document.createElement('li');
  li.textContent = `${day}일차 · ${msg}`;
  ol.prepend(li);
  while (ol.children.length > 60) ol.lastChild.remove();
}

function setPolicy(key, val) {
  if (game.ended) return;
  const r = applyAction(game, { t: 'set', key, v: val });
  if (r.msg) notify(r.msg);
  if (r.ok && typeof policyConcept === 'function') policyConcept(key, val);
  renderAll();
}

// 정책 변경의 전후 수치를 한 줄로 설명한다
function changeText(key, before, after) {
  const day = game.st.day;
  const b0 = effectiveBeta(before, day), b1 = effectiveBeta(after, day);
  const c0 = dailyCost(before), c1 = dailyCost(after);
  const costPart = `하루 비용 ${c0.toFixed(1)}억 → ${c1.toFixed(1)}억`;
  const name = POLICY_INFO[key].name;
  if (key === 'vax') {
    const r0 = VAX_RATE[before.vax] * 100, r1 = VAX_RATE[after.vax] * 100;
    return `${name} ${LEVEL_NAMES.vax[after.vax]}: 하루 접종 ${r0.toFixed(2)}% → ${r1.toFixed(2)}% · ${costPart}`;
  }
  const label = key === 'mask' ? `마스크 ${LEVEL_NAMES.mask[after.mask]}` : `거리두기 ${LEVEL_NAMES.dist[after.dist]}`;
  const pct = Math.round((b1 / b0 - 1) * 100);
  const change = pct === 0 ? '변화 없음' : pct < 0 ? `${-pct}% 낮아짐` : `${pct}% 높아짐`;
  return `${label}: 다음 날부터 전파율 ${b0.toFixed(2)} → ${b1.toFixed(2)} (${change}) · ${costPart}`;
}

function toggleAuto() {
  if (game.ended) return;
  applyAction(game, { t: 'auto', on: !game.auto });
  notify(game.auto
    ? '자동 조절을 켰습니다. 감염자 비율에 따라 거리두기가 매일 바뀝니다.'
    : '자동 조절을 껐습니다. 거리두기를 직접 고를 수 있습니다.');
  renderAll();
}

function setSpeed(s) {
  if (game.ended || game.pending) return;
  game.speed = s;
  renderAll();
}

function buyBed() {
  if (game.ended) return;
  const r = applyAction(game, { t: 'bed' });
  if (r.msg) notify(r.msg);
  if (r.ok && typeof policyConcept === 'function') policyConcept('bed', game.set.bed);
  renderAll();
}

function markActive(container, level) {
  [...container.children].forEach(b => b.classList.toggle('on', Number(b.dataset.level) === level));
}

function renderAll() {
  const set = game.set;
  markActive(document.getElementById('seg-mask'), set.mask);
  document.querySelectorAll('#seg-mask button').forEach(b => { b.disabled = game.ended; });

  markActive(document.getElementById('seg-dist'), set.dist);
  document.querySelectorAll('#seg-dist button').forEach(b => { b.disabled = game.auto || game.ended; });
  const autoBtn = document.getElementById('btn-auto');
  autoBtn.textContent = game.auto ? '자동 조절: 켜짐 (끄기)' : '자동 조절: 꺼짐 (켜기)';
  autoBtn.classList.toggle('on', game.auto);
  autoBtn.disabled = game.ended;
  markActive(document.getElementById('seg-vax'), set.vax);

  const bedCost = bedUpgradeCost(set.bed);
  const bedBtn = document.getElementById('btn-bed');
  bedBtn.textContent = bedCost === null ? '확충 완료 (최대)' : `병상 확충 (${bedCost}억 원)`;
  bedBtn.disabled = bedCost === null || game.ended;

  document.querySelectorAll('.speed').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.speed) === game.speed);
  });
  const rd = realDate(game.st.day);
  document.getElementById('day-label').textContent = `${game.st.day}일차 / ${DAYS}일` + (rd ? ` · 실제 ${rd}경` : '');
  document.getElementById('day-label').title = '게임용 압축 타임라인: 게임 1일 ≈ 실제 약 4일';
  renderNow();
  renderStats();
  renderNextStep();
  renderPolicies();
  renderMedical();
  renderMissions();
  renderEventBar();
}

// 정책 카드에 지금 실제로 적용 중인 효과를 보여 준다
function renderNow() {
  const set = game.set;
  document.getElementById('now-mask').textContent =
    set.mask ? `지금: 마스크 ${LEVEL_NAMES.mask[set.mask]} · 전파율 −${Math.round(maskEff(set.mask) * 100)}%` : '지금: 마스크 해제';
  document.getElementById('now-dist').textContent =
    set.dist ? `지금: 접촉 ${dailyContacts(set).toFixed(1)}명/일 (전파율 −${Math.round(distEff(set.dist) * 100)}%)` : '지금: 접촉 10명/일 (해제 상태)';
  document.getElementById('now-vax').textContent =
    set.vax ? `지금: 하루 접종 ${(VAX_RATE[set.vax] * 100).toFixed(2)}%` : '지금: 접종 중단';
  document.getElementById('now-bed').textContent =
    `지금: 병상 ${fmtNum(bedCapacity(set))}개 (확충 ${set.bed}/${BED_MAX}단계)`;
}

function currentRt() {
  return reproNumber(game.set, game.st.day, game.st);
}

// 지금 무엇을 하면 좋은지 한 줄로 알려 준다
function renderNextStep() {
  const el = document.getElementById('next-step');
  const st = game.st, set = game.set;
  const untouched = set.mask === 0 && set.dist === 0 && set.vax === 0 && set.bed === 0 && !game.polEver.length;
  let msg = '', cls = '';
  if (game.ended) {
    msg = '게임이 끝났습니다. 아래 결과를 확인하고 다시 시작해 보세요.';
  } else if (st.day === 0 && untouched) {
    msg = '👉 첫 행동: 사회적 거리두기 "약"을 눌러 보세요. 선택은 다음 날부터 적용됩니다.';
  } else if (st.day === 0 && game.speed === 0) {
    msg = '👉 다음 행동: ▶ 1배속을 눌러 하루를 시작하세요.';
  } else if (st.I2 > bedCapacity(set)) {
    msg = `🚨 중증 환자 ${fmtNum(st.I2)}명이 병상(${fmtNum(bedCapacity(set))}개)을 넘었습니다. 사망률이 2배입니다. 병상을 확충하거나 거리두기를 강화하세요.`;
    cls = 'alert';
  } else if (game.speed === 0) {
    msg = '⏸ 일시정지 중입니다. ▶ 를 눌러 계속하세요.';
  } else {
    const rt = currentRt();
    if (rt > 1.05) {
      msg = `⚠ 실효 재생산수 ${rt.toFixed(2)}: 1보다 커서 확산이 늘고 있습니다. 마스크나 거리두기를 켜 보세요.`;
      cls = 'alert';
    } else if (rt < 0.95) {
      msg = `✅ 실효 재생산수 ${rt.toFixed(2)}: 1 아래로 내려와 확산이 줄고 있습니다. 예산을 아끼며 유지하세요.`;
      cls = 'good';
    } else {
      msg = `➖ 실효 재생산수 ${rt.toFixed(2)}: 균형 상태입니다. 변화를 지켜보며 조정하세요.`;
    }
  }
  el.textContent = msg;
  el.className = 'next-step ' + cls;
}

// 하루 전과 비교한 변화. upIsBad: 값이 오르는 것이 나쁜지 여부
function deltaHtml(key, upIsBad) {
  const d = (game.delta || {})[key];
  if (!d || Math.abs(d) < 0.5) return '';
  const up = d > 0;
  const bad = up === upIsBad;
  return `<div class="stat-delta ${bad ? 'bad' : 'good'}">${up ? '▲' : '▼'} ${fmtNum(Math.abs(d))} (어제 대비)</div>`;
}

// 경제지수는 하루 변화가 작아서 소수점으로 보여 준다
function econDeltaHtml() {
  const d = (game.delta || {}).econ;
  if (d === undefined || Math.abs(d) < 0.005) return '<div class="stat-note">100에서 시작, 낮을수록 경제 타격</div>';
  return `<div class="stat-delta ${d < 0 ? 'bad' : 'good'}">${d < 0 ? '▼' : '▲'} ${Math.abs(d).toFixed(2)} (어제 대비)</div>`;
}

function renderStats() {
  const st = game.st, set = game.set;
  const cap = bedCapacity(set);
  const cards = [
    ['현재 감염자', fmtNum(st.I1 + st.I2), '#f97316', deltaHtml('active', true)],
    ['누적 감염자', fmtNum(st.cumInf), '#60a5fa', deltaHtml('cum', true) + `<div class="stat-note">10만 명당 ${fmtPer100k(st.cumInf)}명</div>`],
    ['사망자', fmtNum(st.D), '#f43f5e', deltaHtml('dead', true) + `<div class="stat-note">10만 명당 ${per100k(st.D).toFixed(1)}명</div>`],
    ['중증 / 병상', `${fmtNum(st.I2)} / ${fmtNum(cap)}`, st.I2 > cap ? '#ef4444' : '#a7f3d0',
      st.I2 > cap ? '<div class="stat-delta bad">⚠ 병상 초과</div>' : ''],
    ['남은 예산', `${fmtNum(game.budget)}억`, '#fde68a', deltaHtml('budget', false)],
    ['하루 비용', `${dailyCost(set).toFixed(1)}억`, '#c4b5fd', ''],
    ['경제지수', game.econ.toFixed(1), game.econ < 50 ? '#f87171' : '#86efac', econDeltaHtml()],
    ['시민 신뢰', Math.round(game.trust), game.trust < 40 ? '#f87171' : '#86efac', '<div class="stat-note">낮으면 엔딩에 불리</div>'],
    ['형평성', Math.round(game.equity), game.equity < 40 ? '#f87171' : '#86efac', '<div class="stat-note">취약계층 보호</div>'],
    ['의료 안정성', Math.round(game.med), game.med < 40 ? '#f87171' : '#86efac', '<div class="stat-note">병상 초과 시 하락</div>'],
    ['하루 접촉 수', `${dailyContacts(set).toFixed(1)}명`, '#5eead4', ''],
    ['실효 재생산수 (추정)', currentRt().toFixed(2), currentRt() > 1 ? '#f87171' : '#86efac',
      '<div class="stat-note">1 넘으면 확산, 1 아래면 감소</div>'],
  ];
  document.getElementById('stats').innerHTML = cards.map(([label, value, color, extra]) =>
    `<div class="stat"><div class="stat-label">${label}</div>` +
    `<div class="stat-value" style="color:${color}">${value}</div>${extra}</div>`
  ).join('');
}
