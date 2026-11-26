// events-ui.js — 위기 이벤트 엔진: 일정(실제 사건은 실제 시기에 편성), 뽑기, 선택 창, 선택 기록
// game.eventPlan([{day, id}] 앞으로 나올 이벤트), game.pending(지금 결정 중인 이벤트), game.evSeen(이미 나온 이벤트).
// 선택의 효과 계산은 world.js의 applyAction이 맡는다 (반사실 비교에서 같은 기록을 다시 계산하기 위해).

const EVENTS_ON = !/[?&]events=off/.test(location.search);   // 점검용: ?events=off 이면 이벤트 없음
let rngOverride = null;                                      // 점검할 때 난수를 고정하는 용도
const rng = () => (rngOverride || (typeof game !== 'undefined' && game && game.rand) || Math.random)();
const EVENT_LAST_DAY = DAYS - 4;                             // 끝나기 직전에는 새 이벤트를 내지 않는다
const EVENT_FIRST_DAY = 10, EVENT_MIN_GAP = 15, REAL_FIRST_DAY = 6;

// 데이터 정리 (한 번만): 일반 이벤트는 '가상 시나리오'로 표시하고, 예산 압박을 위해 예산 증감을 키운다(지출 2.5배, 수입 2배)
function finalizeEvents() {
  const scaleB = f => { if (f && f.budget) f.budget = Math.round(f.budget * (f.budget < 0 ? 2.5 : 2) / 5) * 5; if (f && f.mod && f.mod.cost) f.mod.cost *= 2; };
  EVENTS.forEach(e => {
    if (e._done) return;
    e._done = true;
    if (!e.real && !e.virtual) e.virtual = true;
    e.choices.forEach(c => { scaleB(c.fx); if (c.risk) scaleB(c.risk.fx); });
  });
}

// 이번 판 이벤트 일정: 한 판에 5~6번. 이 나라의 실제 사건 2~3개는 실제 시기(압축 타임라인)에 편성하고 나머지는 무작위 시점.
function drawEventPlan(rand = rng) {
  const n = 5 + Math.floor(rand() * 2);
  const real = EVENTS.filter(e => e.country === SCN.id && e.atReal)
    .map(e => ({ id: e.id, day: dayOfDate(e.atReal) + Math.floor(rand() * 7) - 3 }))
    .filter(x => x.day >= REAL_FIRST_DAY && x.day <= EVENT_LAST_DAY - 1)
    .sort(() => rand() - 0.5);
  const want = Math.min(real.length, 2 + Math.floor(rand() * 2));
  const plan = [];
  for (const x of real) {
    if (plan.length >= want) break;
    if (plan.every(p => Math.abs(p.day - x.day) >= EVENT_MIN_GAP)) plan.push(x);
  }
  for (let tries = 0; plan.length < n && tries < 2000; tries++) {
    const day = EVENT_FIRST_DAY + Math.floor(rand() * (EVENT_LAST_DAY - EVENT_FIRST_DAY - 4));
    if (plan.every(p => Math.abs(p.day - day) >= EVENT_MIN_GAP)) plan.push({ id: null, day });
  }
  for (let d = EVENT_FIRST_DAY; plan.length < n && d < EVENT_LAST_DAY; d += 3) {   // 드문 실패 대비
    if (plan.every(p => Math.abs(p.day - d) >= EVENT_MIN_GAP)) plan.push({ id: null, day: d });
  }
  return plan.sort((a, b) => a.day - b.day);
}

// 무작위로 뽑을 수 있는 이벤트: 이 나라 전용 가상 이벤트 + 모든 나라 공통 이벤트 (실제 사건은 일정에 따라서만 나온다)
function pickEvent() {
  const ok = e => (!e.country || e.country === SCN.id) && !e.atReal && e.ok(game);
  let pool = EVENTS.filter(e => !game.evSeen.includes(e.id) && ok(e));
  if (!pool.length) { game.evSeen = []; pool = EVENTS.filter(ok); }
  if (!pool.length) return null;
  const ws = pool.map(e => Math.max(0.1, e.w(game) * (e.country ? 1.5 : 1)));   // 이 나라 전용 이벤트가 조금 더 자주 나온다
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// 하루가 끝날 때 sketch.js의 advanceDay가 부른다
function tickEvents() {
  if (!EVENTS_ON || game.ended || game.pending) return;
  if (!game.eventPlan.length || game.st.day < game.eventPlan[0].day) return;
  const item = game.eventPlan.shift();
  const ev = item.id ? EVENTS.find(e => e.id === item.id) : pickEvent();
  if (!ev) return;
  game.pending = ev;
  game.evSeen.push(ev.id);
  game.prevSpeed = game.speed;
  game.speed = 0;
  addLog(game.st.day, `${ev.icon} 위기 발생: ${ev.title}`);
  showEvent(ev);
}

// ── 선택지 옆에 붙이는 장단점 표시 (실제 fx 값에서 계산하므로 문구와 어긋나지 않는다) ──
function fxOf(ch) { return ch.fx; }

function arrows(v, big, small, goodUp) {
  const n = Math.abs(v) >= big ? 2 : Math.abs(v) >= small ? 1 : 0;
  if (!n) return null;
  const up = v > 0;
  return { text: (up ? '▲' : '▼').repeat(n), good: up === goodUp };
}

function eventTags(ch, ev) {
  const fx = fxOf(ch), m = fx.mod || {}, d = (m.days || 0) / 30;
  const inf = ((m.beta || 1) - 1) * 10 * d + ((m.contact || 1) - 1) * 6 * d + (fx.infect || 0) / 400
    - (m.detect || 0) * 8 * d + ((m.imp || 1) - 1) * 2 * d + ((m.fatal || 1) - 1) * 4 * d;
  const eco = (fx.econ || 0) + (m.econ || 0) * (m.days || 0);
  const bud = (fx.budget || 0) - (m.cost || 0) * (m.days || 0);
  const defs = [
    ['감염 위험', arrows(inf, 1.5, 0.4, false)],
    ['경제', arrows(eco, 6, 1.5, true)],
    ['예산', arrows(bud, 50, 10, true)],
    ['신뢰', arrows(fx.trust || 0, 6, 2, true)],
    ['형평성', arrows(fx.equity || 0, 6, 2, true)],
    ['의료체계', arrows((fx.med || 0) + (m.beds || 0) / 150, 6, 2, true)],
    ['접종', arrows((m.vax || 0) * 1000, 1.5, 0.2, true)],
  ];
  const tags = defs.filter(([, a]) => a).map(([name, a]) => ({ name, ...a }));
  // 비용이 드는 다른 선택지가 있을 때, 비용 없는 선택지의 장점(예산 절약)을 보여 준다
  if (ev && !tags.some(t => t.name === '예산') && (fx.budget || 0) >= 0 && ev.choices.some(o => (o.fx.budget || 0) <= -10)) tags.push({ name: '예산 절약', text: '', good: true });
  return tags;
}

// 실제 사건인지 가상 시나리오인지 표시
function eventBadge(ev) {
  if (ev.real) {
    const src = ev.real.source ? ` · <a href="${esc(ev.real.source.url)}" target="_blank" rel="noopener noreferrer">출처: ${esc(ev.real.source.label)}</a>` : '';
    return `<p class="ev-badge real">📜 실제 사건 · ${esc(ev.real.when)}${src}</p>`;
  }
  return '<p class="ev-badge virtual">🎭 가상 시나리오 — 실제 사례를 참고해 만든 가상의 상황입니다</p>';
}

function showEvent(ev) {
  const box = document.getElementById('event-box');
  const btns = ev.choices.map((ch, i) => {
    const fx = fxOf(ch);
    const short = game.budget + (fx.budget || 0) < 0;
    const tags = eventTags(ch, ev).map(t => `<span class="tag ${t.good ? 'good' : 'bad'}">${t.name} ${t.text}</span>`).join('');
    const risk = ch.risk ? `<p class="risk">⚠ 위험: ${Math.round(ch.risk.p * 100)}% 확률로 나쁜 일이 더 생길 수 있습니다.</p>` : '';
    return `<button class="choice" data-i="${i}" ${short ? 'disabled' : ''}>
      <b>${esc(ch.label)}</b> <span class="cost">${fx.budget ? (fx.budget < 0 ? '−' : '+') + Math.abs(fx.budget) + '억' : ''}</span>${short ? ' <i>(예산 부족)</i>' : ''}
      <span class="choice-note">${esc(ch.note)}</span>
      <span class="tags">${tags}</span>${risk}</button>`;
  }).join('');
  box.innerHTML = `<h2>${ev.icon} ${esc(ev.title)}</h2>${eventBadge(ev)}
    <p class="event-day">${game.st.day}일차 · 예산 ${fmtNum(game.budget)}억 · 신뢰 ${Math.round(game.trust)} · 경제 ${game.econ.toFixed(0)}</p>
    <p>${esc(ev.text)}</p><div class="choices">${btns}</div>
    <p class="hint">▲▼는 이 선택의 대략적인 방향이며 게임이 가정한 값입니다. 정답은 없고, 어떤 선택이든 무언가를 잃습니다.</p>`;
  box.querySelectorAll('.choice').forEach(b => { b.onclick = () => chooseEvent(Number(b.dataset.i)); });
  document.getElementById('event').classList.remove('hidden');
  renderAll();
}

function chooseEvent(i) {
  const ev = game.pending;
  if (!ev || !ev.choices[i]) return;
  const ch = ev.choices[i];
  if (game.budget + (fxOf(ch).budget || 0) < 0) return notify('예산이 부족해 이 선택은 할 수 없습니다.');
  const r = applyAction(game, { t: 'ev', id: ev.id, i, u: rng() });   // 난수는 여기서 한 번만 뽑아 기록한다
  game.pending = null;
  document.getElementById('event').classList.add('hidden');
  notify(`결정: ${ch.label}${r.bad ? ' — ' + r.bad : ''}`);
  if (typeof conceptNote === 'function') conceptNote(ch);
  game.speed = game.prevSpeed || 0;
  renderAll();
}

// 지금 진행 중인 이벤트 효과를 한 줄로 보여 준다
function renderEventBar() {
  const el = document.getElementById('active-events');
  const day = game.st.day;
  const list = (game.activeEv || []).filter(e => day < e.until);
  el.innerHTML = list.map(e => `<span class="chip">${esc(e.name)} · ${e.until - day}일 남음</span>`).join('');
  el.classList.toggle('hidden', !list.length);
}
