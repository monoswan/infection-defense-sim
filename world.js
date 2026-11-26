// world.js — 게임 세계의 순수 계산 (DOM을 건드리지 않는다)
// 실제 게임(game)과 '반사실 비교'의 재계산이 같은 코드를 쓴다: newWorld → applyAction → worldDay.
// 플레이어의 모든 행동은 w.log에 순서대로 쌓이고, 같은 log를 다시 넣으면 같은 결과가 나온다(난수는 이벤트 선택 때 한 번만 뽑아 log에 저장).
// 행동 종류 a: {t:'set', key:'mask'|'dist'|'vax', v} {t:'bed'} {t:'pol', key, v} {t:'auto', on} {t:'ev', id, i, u}

// 시드를 주면 항상 같은 순서의 난수를 내는 난수 생성기 (같은 시드 = 같은 이벤트 일정·도박 결과)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function histPoint(w) {
  const st = w.st, set = w.set;
  return {
    active: st.I1 + st.I2, cum: st.cumInf, dead: st.D, contacts: dailyContacts(set), newInf: 0,
    bedUse: st.I2 / bedCapacity(set), econ: w.econ, budget: w.budget, trust: w.trust, equity: w.equity, med: w.med,
  };
}

function newWorld() {
  const w = {
    st: initialState(), set: { ...ZERO_SET }, pol: newPol(), auto: false, budget: BUDGET, econ: ECON_START,
    trust: SCN.trust, equity: SCN.equity, med: SOCIAL_START.med, overflowDays: 0, budgetOutDay: null,
    activeEv: [], decisions: [], timeline: [], hist: [], delta: {}, lawUpfront: 0, polEver: [], log: [], staffBought: 0,
    warnedOverflow: false, warnedTenPct: false, warnedWarmup: false, live: false,
  };
  refreshMod(w);
  w.hist.push(histPoint(w));
  return w;
}

// 오늘 적용할 정책·이벤트 보정값을 다시 계산해 set.lawMod에 넣는다
function refreshMod(w) {
  const day = w.st.day;
  w.set = { ...w.set, lawMod: computePolicyMod(w.pol, day, w.activeEv.filter(e => day < e.until).map(e => e.mod), w.med) };
}

const EARLY_END_DAY = 90;
const AUTO_LAG_DAYS = 7;   // 자동 거리두기가 반응하기까지 걸리는 일수
const STAFF_COST = 40, STAFF_GAIN = 12, STAFF_MAX = 4;   // 의료인력 지원: 비용(억), 의료 상태 증가, 최대 횟수 (게임 가정)
const MOD_KEYS = ['beta', 'contact', 'beds', 'vax', 'cost', 'econ', 'detect', 'imp', 'sever', 'fatal'];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 이벤트 선택의 효과를 세계에 적용한다
function applyFx(w, fx, ev) {
  if (fx.infect) {
    const n = Math.min(fx.infect * PS(), w.st.S);
    w.st = { ...w.st, S: w.st.S - n, E1: w.st.E1 + n, cumInf: w.st.cumInf + n };
  }
  if (fx.budget) w.budget = Math.max(0, w.budget + fx.budget);
  if (fx.econ) w.econ = clamp(w.econ + fx.econ, 0, ECON_START);
  for (const k of ['trust', 'equity', 'med']) if (fx[k]) w[k] = clamp(w[k] + fx[k], 0, 100);
  if (fx.mod) {
    const mod = {};
    MOD_KEYS.forEach(k => { if (fx.mod[k] !== undefined) mod[k] = fx.mod[k]; });
    w.activeEv.push({ name: ev.title, until: w.st.day + fx.mod.days, mod });
  }
}

// 행동 하나를 적용한다. 돌려주는 값: {ok, msg, bad}. 성공한 행동은 w.log에 기록된다.
function applyAction(w, a) {
  const day = w.st.day, r = { ok: false, msg: '', bad: '' };
  if (a.t === 'set') {
    if (a.key === 'dist' && w.auto) { r.msg = '자동 조절 중에는 거리두기를 직접 고를 수 없습니다. 자동을 끄면 고를 수 있습니다.'; return r; }
    const lock = policyLock(a.key, a.v, day);
    if (lock) { r.msg = lock; return r; }
    const before = w.set;
    w.set = { ...before, [a.key]: a.v };
    r.ok = true;
    if (w.live) r.msg = changeText(a.key, before, w.set);
  } else if (a.t === 'bed') {
    const lv = w.set.bed, cost = bedUpgradeCost(lv);
    if (cost === null) { r.msg = '병상은 이미 최대 단계입니다.'; return r; }
    if (w.budget < cost) { r.msg = `예산이 부족해 병상을 확충할 수 없습니다 (${cost}억 원 필요).`; return r; }
    w.budget -= cost;
    w.set = { ...w.set, bed: lv + 1 };
    r.ok = true;
    r.msg = `병상 확충: ${fmtNum(bedCapacity(w.set))}개로 늘림 (−${cost}억 원). 중증 환자가 병상을 넘지 않게 관리하세요.`;
  } else if (a.t === 'staff') {
    if (w.staffBought >= STAFF_MAX) { r.msg = `의료인력 지원은 최대 ${STAFF_MAX}번까지 할 수 있습니다.`; return r; }
    if (w.budget < STAFF_COST) { r.msg = `예산이 부족합니다 (${STAFF_COST}억 원 필요).`; return r; }
    w.budget -= STAFF_COST;
    w.lawUpfront += STAFF_COST;
    w.staffBought++;
    w.med = clamp(w.med + STAFF_GAIN, 0, 100);
    refreshMod(w);
    r.ok = true;
    r.msg = `의료인력 지원: 의료 상태 +${STAFF_GAIN} (−${STAFF_COST}억 원). 쓸 수 있는 병상 비율이 올라갑니다.`;
  } else if (a.t === 'pol') {
    const p = w.pol[a.key], def = POLICY_FX[a.key];
    if (!p || a.v === p.level || a.v < 0 || a.v >= def.levels.length) return r;
    const lock = policyLock(a.key, a.v, day);
    if (lock) { r.msg = lock; return r; }
    const pay = Math.max(0, def.setup[a.v] - def.setup[p.level]);
    if (w.budget < pay) { r.msg = `예산이 부족해 시행할 수 없습니다 (시행 비용 ${pay}억 원 필요).`; return r; }
    p.prev = effLevel(a.key, p, day);
    p.level = a.v;
    p.since = day;
    w.budget -= pay;
    w.lawUpfront += pay;
    if (a.v > 0 && !w.polEver.includes(a.key)) w.polEver.push(a.key);
    refreshMod(w);
    r.ok = true;
    if (w.live) r.msg = polChangeText(a.key, a.v, pay);
  } else if (a.t === 'auto') {
    w.auto = !!a.on;
    r.ok = true;
  } else if (a.t === 'ev') {
    const ev = EVENTS.find(e => e.id === a.id), ch = ev && ev.choices[a.i];
    if (!ch) return r;
    applyFx(w, ch.fx, ev);
    if (ch.risk && a.u < ch.risk.p) { applyFx(w, ch.risk.fx, ev); r.bad = ch.risk.text; }
    w.decisions.push({ day, id: ev.id, icon: ev.icon, title: ev.title, label: ch.label, bad: r.bad, i: a.i });
    refreshMod(w);
    r.ok = true;
  }
  if (r.ok) w.log.push({ ...a, day });
  return r;
}

function worldEnded(w) {
  return w.st.day >= DAYS || (w.st.day >= EARLY_END_DAY && activeCount(w.st) < 5 * PS());   // 감염이 사라져도 90일 전에는 끝나지 않는다 (방역 유지 비용을 치르게 하기 위해)
}

// 하루를 진행한다. 돌려주는 값: {notes: 알림 문구, logs: 사건 기록 문구} (replay에서는 쓰지 않음)
function worldDay(w) {
  const notes = [], logs = [];
  const day = w.st.day, before = w.st, budgetBefore = w.budget, econBefore = w.econ;
  refreshMod(w);
  let set = { ...w.set };
  if (w.auto) {
    const lag = w.hist[Math.max(0, w.hist.length - 1 - AUTO_LAG_DAYS)];   // 행정 지연: 며칠 전의 감염 상황을 보고 단계를 정한다 (게임 가정)
    const lvl = autoDistLevel({ I1: lag.active, I2: 0 });
    if (lvl !== set.dist && w.live) notes.push(`자동 조절: 거리두기 ${LEVEL_NAMES.dist[lvl]} (하루 접촉 ${dailyContacts({ dist: lvl }).toFixed(1)}명)`);
    set = { ...set, dist: lvl };
    w.set = { ...set };
  }
  if (w.budget < dailyCost(set) && (set.mask || set.dist || set.vax || lawOf(set).count)) {
    NEW_POLICIES.forEach(k => { w.pol[k] = { level: 0, since: day, prev: 0 }; });
    w.set = { ...w.set, mask: 0, dist: 0, vax: 0 };
    refreshMod(w);
    set = { ...w.set };
    if (w.budgetOutDay === null) w.budgetOutDay = day;
    notes.push('예산이 바닥나 마스크·거리두기·백신·신규 정책이 자동으로 꺼졌습니다.');
  }
  w.budget = Math.max(0, w.budget - dailyCost(set));
  w.timeline.push(set);
  w.econ = nextEcon(w.econ, set, w.st);
  w.st = stepDay(w.st, set);
  updateSocial(w, set, w.st);
  const h = histPoint(w);
  h.contacts = dailyContacts(set);
  h.newInf = w.st.cumInf - before.cumInf;
  w.hist.push(h);
  w.delta = {
    active: (w.st.I1 + w.st.I2) - (before.I1 + before.I2), cum: h.newInf, dead: w.st.D - before.D,
    budget: w.budget - budgetBefore, econ: w.econ - econBefore,
  };
  const st = w.st, d = st.day;
  if (st.I2 > bedCapacity(set)) w.overflowDays++;
  if (!w.warnedOverflow && st.I2 > bedCapacity(set)) {
    w.warnedOverflow = true;
    notes.push('중증 환자가 병상을 넘었습니다. 중증 사망률이 2배로 올라갑니다!');
  }
  if (!w.warnedTenPct && st.cumInf >= POP * 0.1) {
    w.warnedTenPct = true;
    notes.push('누적 감염이 인구의 10%를 넘었습니다.');
  }
  if (!w.warnedWarmup && d === WARMUP_DAYS) {
    w.warnedWarmup = true;
    notes.push(`${WARMUP_DAYS}일차부터 감염이 본래 속도로 퍼집니다.`);
  }
  if (d % 30 === 0) logs.push(`${d}일 경과 · 현재 감염 ${fmtNum(st.I1 + st.I2)}명, 사망 ${fmtNum(st.D)}명`);
  return { notes, logs };
}

// 기록(log)을 처음부터 다시 계산한다. until일까지 (기본: 끝까지)
function replayWorld(log, until = DAYS) {
  const w = newWorld();
  let i = 0;
  while (!worldEnded(w) && w.st.day < until) {
    while (i < log.length && log[i].day <= w.st.day) applyAction(w, log[i++]);
    worldDay(w);
  }
  while (i < log.length && log[i].day <= w.st.day) applyAction(w, log[i++]);
  return w;
}
