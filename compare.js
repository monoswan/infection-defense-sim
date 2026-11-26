// compare.js — 정책 효과 비교(반사실 시뮬레이션) 계산
// 같은 국가·같은 초기조건·같은 난수(이벤트 일정과 선택, 도박 결과가 기록에 고정됨)에서 정책 선택만 바꿔 다시 계산한다.
// ★ 실제 역사에서 일어나지 않은 가정 상황이며, 게임이 가정한 효과 수치로 계산한 것이다. 실제 정책 효과가 입증된 것이 아니다.

// 정책 id → 그 정책에 해당하는 행동인지
function isPolicyAction(a, key) {
  if (key === 'bed') return a.t === 'bed' || a.t === 'staff';
  if (NEW_POLICIES.includes(key)) return a.t === 'pol' && a.key === key;
  return (a.t === 'set' && a.key === key) || (key === 'dist' && a.t === 'auto');   // 자동 거리두기도 거리두기 조작으로 본다
}

function policyMaxLevel(key) {
  if (key === 'mask') return 2;
  if (key === 'dist' || key === 'vax') return 3;
  return POLICY_FX[key].levels.length - 1;
}

// 행동 기록을 바꿔서 대안 시나리오의 기록을 만든다. spec: {mode, key, days, delta, level}
//  mode: 'remove' 시행하지 않음 / 'shift' days일 앞당김(음수)·늦춤(양수) / 'level' delta단계 조정 / 'add' 0일차부터 level 단계로 시행
function transformLog(log, spec) {
  const { mode, key } = spec;
  const items = log.map((a, i) => ({ a: { ...a }, i }));
  let out = items;
  if (mode === 'remove') {
    out = items.filter(x => !isPolicyAction(x.a, key));
  } else if (mode === 'shift') {
    items.forEach(x => { if (isPolicyAction(x.a, key)) x.a.day = Math.max(0, x.a.day + spec.days); });
  } else if (mode === 'level') {
    const max = policyMaxLevel(key);
    items.forEach(x => { if (isPolicyAction(x.a, key) && x.a.v !== undefined) x.a.v = clamp(x.a.v + spec.delta, 0, max); });
  } else if (mode === 'add') {
    const add = key === 'bed' ? { t: 'bed', day: 0 }
      : NEW_POLICIES.includes(key) ? { t: 'pol', key, v: spec.level, day: 0 } : { t: 'set', key, v: spec.level, day: 0 };
    out = [{ a: add, i: -1 }, ...items];   // 새로 넣은 행동은 그날의 맨 앞
  }
  // 날짜순으로 정렬하되 같은 날 안에서는 원래 순서를 유지한다
  return out.sort((x, y) => x.a.day - y.a.day || x.i - y.i).map(x => x.a);
}

// 같은 기록으로 만든 '실제' 결과(A)와 대안 결과(B). until: 비교할 마지막 날 (기본: 지금까지)
function compareRun(spec, until = game.st.day) {
  const A = replayWorld(game.log, until);
  const altLog = transformLog(game.log, spec);
  const B = replayWorld(altLog, until);
  return { A, B, spec, until, logA: game.log, logB: altLog };
}

// 지표 요약 (표에 쓴다). better: 값이 클수록 좋은지(true)/작을수록 좋은지(false)
function summarizeWorld(w) {
  const h = w.hist, st = w.st;
  return {
    cum: st.cumInf, cum100k: per100k(st.cumInf), dead: st.D, dead100k: per100k(st.D),
    peakNew: Math.max(...h.map(p => p.newInf)), overflowDays: w.overflowDays, peakBed: Math.max(...h.map(p => p.bedUse)),
    econ: w.econ, budget: w.budget, trust: w.trust, equity: w.equity,
  };
}

const COMPARE_ROWS = [
  { k: 'cum', label: '누적 확진자', fmt: v => fmtNum(v) + '명', better: false },
  { k: 'cum100k', label: '누적 확진자(10만 명당)', fmt: v => v.toFixed(0) + '명', better: false },
  { k: 'dead', label: '누적 사망자', fmt: v => fmtNum(v) + '명', better: false },
  { k: 'dead100k', label: '누적 사망자(10만 명당)', fmt: v => v.toFixed(1) + '명', better: false },
  { k: 'peakNew', label: '하루 최대 신규 감염자', fmt: v => fmtNum(v) + '명', better: false },
  { k: 'overflowDays', label: '병상 초과 일수', fmt: v => v + '일', better: false },
  { k: 'peakBed', label: '최고 병상 사용률', fmt: v => (v * 100).toFixed(0) + '%', better: false },
  { k: 'econ', label: '경제지수', fmt: v => v.toFixed(1), better: true },
  { k: 'budget', label: '남은 정부 예산', fmt: v => fmtNum(v) + '억', better: true },
  { k: 'trust', label: '시민 만족도(정부 신뢰)', fmt: v => v.toFixed(1), better: true },
  { k: 'equity', label: '사회적 형평성', fmt: v => v.toFixed(1), better: true },
];

// 정책 하나를 뺐을 때의 영향 (결과 화면의 정책별 효과·비용 대비 효과에 쓴다). 사용한 정책만 계산한다.
function policyImpact(key, until = game.st.day) {
  const spec = { mode: 'remove', key };
  const used = game.log.some(a => isPolicyAction(a, key));
  if (!used) return null;
  const { A, B } = compareRun(spec, until);
  const a = summarizeWorld(A), b = summarizeWorld(B);
  return { key, a, b, deathsAverted: b.dead - a.dead, infectionsAverted: b.cum - a.cum, econGain: a.econ - b.econ,
    trustGain: a.trust - b.trust, equityGain: a.equity - b.equity, cost: policyCostOf(key, A) };
}

// 그 정책에 쓴 돈(억): 시행 비용과 유지비 (예산이 바닥나 자동으로 꺼진 경우는 반영하지 않은 추정치)
function policyCostOf(key, w) {
  if (key === 'bed' || key === 'mask' || key === 'dist' || key === 'vax') return policyCosts(w.timeline, w.set.bed, 0)[key];
  const def = POLICY_FX[key];
  const acts = w.log.filter(a => a.t === 'pol' && a.key === key);
  let lv = 0, idx = 0, spend = 0;
  for (let d = 0; d < w.timeline.length; d++) {
    while (idx < acts.length && acts[idx].day <= d) {
      spend += Math.max(0, def.setup[acts[idx].v] - def.setup[lv]);   // 단계를 올릴 때 한 번 내는 비용
      lv = acts[idx++].v;
    }
    spend += def.daily[lv];                                          // 하루 유지비
  }
  return spend;
}
