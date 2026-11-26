// effects.js — 공통 정책 9개 중 새 정책 5개의 효과표, 경제지수, 정책 단계·지연·잠금, 정책 보정값 계산
// ★ 모든 효과 수치는 게임에서 가정한 값이며 실제 정책 효과를 측정한 값이 아니다.
// 마스크·거리두기·백신·병상은 model.js·policy.js의 기존 표를 쓰고, 여기서는 나머지 5개를 다룬다.
// 정책은 '단계(level)'가 하나로 정해지므로 같은 정책을 겹쳐 적용하거나 효과를 무한히 쌓을 수 없다.
//
// fx 필드: contact(하루 접촉 감소율) detect(감염자 발견·격리율 증가) impCut(해외 유입 감소율) fatal·sever(사망·중증화 배수)
//          econ(하루 경제지수 변화) trust·equity(하루 신뢰도·형평성 변화)
// setup: 단계를 올릴 때 한 번 내는 비용(이미 낸 단계는 차액만), daily: 시행 중 하루 유지비, delay: 효과가 나타날 때까지 일수

const NEW_POLICIES = ['school', 'test', 'isolate', 'border', 'support'];
const ALL_POLICIES = ['mask', 'dist', 'school', 'test', 'isolate', 'bed', 'border', 'support', 'vax'];

const POLICY_FX = {
  school: { levels: ['해제', '부분 제한', '전면 제한'], setup: [0, 10, 25], daily: [0, 1.5, 3.5], delay: 2,
    fx: [{}, { contact: 0.08, econ: -0.03, trust: -0.01, equity: -0.01 }, { contact: 0.18, econ: -0.10, trust: -0.03, equity: -0.04 }] },
  test: { levels: ['기본', '검사·추적 강화', '대규모 검사·추적'], setup: [0, 40, 90], daily: [0, 3, 6], delay: 5,
    fx: [{}, { detect: 0.08, econ: -0.005 }, { detect: 0.16, econ: -0.01, trust: -0.02 }] },
  isolate: { levels: ['자율 격리', '시설 격리·치료 지원', '의무 격리·치료·생활 지원'], setup: [0, 20, 45], daily: [0, 1.5, 3], delay: 3,
    fx: [{}, { detect: 0.03, fatal: 0.95, econ: -0.005, equity: -0.01 }, { detect: 0.06, fatal: 0.88, sever: 0.95, econ: -0.015, equity: -0.03, trust: -0.01 }] },
  border: { levels: ['개방', '검사·격리 강화', '전면 통제'], setup: [0, 15, 30], daily: [0, 1, 2.5], delay: 1,
    fx: [{}, { impCut: 0.5, econ: -0.04 }, { impCut: 0.9, econ: -0.12, trust: -0.01 }] },
  support: { levels: ['없음', '선별 지원', '보편 지원'], setup: [0, 40, 100], daily: [0, 3, 6.5], delay: 2,
    fx: [{}, { econ: 0.10, equity: 0.03, contact: 0.02, trust: 0.01 }, { econ: 0.20, equity: 0.05, contact: 0.04, trust: 0.02 }] },
};

// 여러 정책을 함께 써도 효과가 무한히 쌓이지 않게 하는 하한·상한 (게임 가정)
const LAW_BETA_FLOOR = 0.35;     // 새 정책들만으로는 전파율을 최대 65%까지만 줄임
const LAW_CONTACT_FLOOR = 0.2;   // 접촉은 최대 80%까지만 줄임
const POLICY_DETECT_CAP = 0.35;  // 새 정책이 더하는 발견·격리율의 상한

function newPol() {
  const p = {};
  NEW_POLICIES.forEach(k => { p[k] = { level: 0, since: 0, prev: 0 }; });
  return p;
}

// 실제로 효과를 내고 있는 단계: 단계를 올린 직후에는 지연 기간 동안 이전 단계가 유지되고, 내릴 때는 바로 적용된다.
function effLevel(key, p, day) {
  if (p.level <= p.prev) return p.level;
  return day >= p.since + POLICY_FX[key].delay + SCN.lawDelay ? p.level : p.prev;
}

// 선택한 단계(g.set 또는 g.pol)를 정책 id로 읽는다
function polLevel(g, key) {
  return NEW_POLICIES.includes(key) ? g.pol[key].level : (g.set[key] || 0);
}

// ── 시점·국가 조건에 따른 잠금 (실제 역사에서 그 시점에 시행할 수 없었던 정책) ──
function dayOfDate(dateStr) {
  return Math.max(0, Math.ceil((Date.parse(dateStr) - Date.parse(SCN.realStart)) / (TIME_RATIO * 864e5)));
}
const UNLOCK_KEY = { vax: 'vax', support: 'support', school: 'school2' };   // 정책 → 국가 데이터의 unlock 키
function unlockDay(key) {
  const k = UNLOCK_KEY[key];
  return k && SCN.unlock && SCN.unlock[k] ? dayOfDate(SCN.unlock[k]) : 0;
}
const dotDate = s => s.replaceAll('-', '.');
// 이 단계를 지금 선택할 수 없으면 이유를 돌려준다 (가능하면 '')
function policyLock(key, level, day) {
  if (level <= 0) return '';
  if (SCN.limits && SCN.limits[key] !== undefined && level > SCN.limits[key]) return (SCN.limitNote && SCN.limitNote[key]) || '이 나라에서는 시행하지 않았거나 시행할 수 없는 단계입니다.';
  const k = UNLOCK_KEY[key];
  const needLevel = key === 'school' ? 2 : 1;
  if (k && SCN.unlock && SCN.unlock[k] && level >= needLevel && day < unlockDay(key)) {
    const what = key === 'vax' ? '백신이 승인·보급되기 전이라' : key === 'support' ? '관련 지원 법·제도가 마련되기 전이라' : '전국 휴교가 시행되기 전이라';
    return `${what} 아직 선택할 수 없습니다 (실제 ${dotDate(SCN.unlock[k])}경부터, 게임 ${unlockDay(key)}일차 이후).`;
  }
  return '';
}

// ── 경제지수 (게임 가정) ─────────────────────────────────────────
// 100에서 시작. 하루 변화 = −(마스크·거리두기 부담) −(감염자 비율 × 계수) + (정책·이벤트 econ 합)
const ECON_START = 100;
const ECON_MASK = 0.005;                    // 마스크 의무의 하루 경제 부담
const ECON_DIST = [0, 0.05, 0.14, 0.28];    // 거리두기 단계별 하루 경제 부담
const ECON_INFECT = 6;                      // 현재 감염자가 인구의 1%이면 하루 −0.06

function econDelta(set, st) {
  const drag = (set.mask === 2 ? ECON_MASK : 0) + ECON_DIST[set.dist] + ECON_INFECT * (st.I1 + st.I2) / POP;
  return lawOf(set).econ - drag * SCN.econFragility;
}
function nextEcon(econ, set, st) {
  return Math.min(ECON_START, Math.max(0, econ + econDelta(set, st)));
}

// pol: 새 정책 상태, evs: 진행 중인 이벤트 효과 목록, med: 의료 상태(0~100) → 그날 적용할 보정값 하나로 합친다
function computePolicyMod(pol, day, evs = [], med = 100) {
  const m = { ...LAW_NEUTRAL };
  let contactMul = 1, detect = 0;
  const supported = effLevel('support', pol.support, day) >= 1;   // 지원이 있으면 제한 정책의 형평성 부담이 줄어든다
  for (const key of NEW_POLICIES) {
    const p = pol[key], def = POLICY_FX[key];
    m.cost += def.daily[p.level];                    // 비용은 효과 지연과 관계없이 선택한 날부터 나간다
    if (p.level > 0) m.count++;
    const f = def.fx[effLevel(key, p, day)];
    const raw = def.fx[p.level];                     // 경제·사회 부담은 선택한 단계 기준으로 바로 나타난다 (지연 없음)
    const e = raw.econ || 0;
    m.econ += e < 0 ? e * SCN.econFragility : e * (key === 'support' ? SCN.supportMul : 1);
    m.trust += raw.trust || 0;
    m.equity += (raw.equity || 0) * ((raw.equity || 0) < 0 && supported ? 0.5 : 1);
    if (f.contact) contactMul *= 1 - Math.min(0.9, f.contact * SCN.lawEff);
    if (f.detect) detect += f.detect * (key === 'test' ? SCN.testMul : 1);
    if (f.impCut) m.imp *= 1 - Math.min(0.95, f.impCut * SCN.borderMul);
    if (f.fatal) m.fatal *= f.fatal;
    if (f.sever) m.sever *= f.sever;
  }
  m.beta = Math.max(LAW_BETA_FLOOR, contactMul);
  m.contact = Math.max(LAW_CONTACT_FLOOR, contactMul);
  m.detect = Math.min(POLICY_DETECT_CAP, detect);
  // 백신: 승인 직후에는 공급이 적어 접종이 천천히 늘어난다 (게임 가정)
  const u = unlockDay('vax');
  m.vaxMul = SCN.unlock && SCN.unlock.vax ? (day < u ? 0 : Math.min(1, 0.25 + 0.75 * (day - u) / 45)) : 1;
  // 의료인력 상태가 나쁘면 쓸 수 있는 병상이 줄어든다 (게임 가정)
  m.bedMul = 0.7 + 0.3 * Math.min(100, Math.max(0, med)) / 100;
  // 위기 이벤트의 지속 효과: 배수는 곱하고 나머지는 더한다
  for (const e of evs) {
    m.beta *= e.beta || 1;
    m.contact *= e.contact || 1;
    m.beds += (e.beds || 0) * bedScale();
    m.vax += e.vax || 0;
    m.cost += e.cost || 0;
    m.econ += e.econ || 0;
    m.detect += e.detect || 0;
    m.imp *= e.imp || 1;
    m.sever *= e.sever || 1;
    m.fatal *= e.fatal || 1;
  }
  m.beta = Math.min(2, m.beta);
  m.contact = Math.min(1.5, m.contact);
  m.detect = Math.min(0.5, m.detect);
  return m;
}
