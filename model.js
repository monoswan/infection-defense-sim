// model.js — 모든 국가가 함께 쓰는 감염병 확산 엔진 (S, E1, E2, I1, I2, R, D)
// 흐름: S → E1(잠복, 전염력 없음) → E2(증상 전, 전염력 있음) → I1(경증) → (R 또는 I2), I2 → (R 또는 D)
// 하루를 SUB번 나눠(0.25일 단위) 오일러 방식으로 계산한다.
// 국가별 차이는 SCN(시나리오)으로만 들어온다. 국가 데이터는 countries.js, 적용은 scenario.js.

let POP = 1000000;     // 인구 (시나리오가 바꾼다)
const DAYS = 180;      // 게임 기간 (일)
const SUB = 4;         // 하루를 나누는 횟수
const DT = 1 / SUB;

// R0 = beta × (E2 전염 기간×e2Weight + I1 기간 + 중증 비율×I2 기간×i2Weight) 가 이전 모형(2.39)과 같도록 beta를 맞췄다.
const PARAM_BASE = {
  beta: 0.368,     // 정책이 없을 때의 하루 전파율
  s1: 0.5,         // E1 → E2 진행률 (평균 2일 잠복)
  s2: 0.5,         // E2 → I1 진행률 (평균 2일, 이 기간에도 전염력이 있음)
  rec1: 0.2,       // I1 이탈률 (평균 5일): 회복 또는 중증 악화
  pSevere: 0.1,    // I1에서 중증(I2)으로 악화되는 비율
  rec2: 0.1,       // I2 이탈률 (평균 10일): 회복 또는 사망
  fatal: 0.05,     // 병상이 충분할 때 중증 환자의 사망 비율
  i2Weight: 0.7,   // 중증 환자의 전파력 (입원하면 접촉이 줄어듦)
  e2Weight: 0.4,   // 증상 전 감염자(E2)의 전파력 (증상이 없어 접촉이 줄지 않지만 전염력은 조금 낮다고 가정)
};
const PARAM = { ...PARAM_BASE };   // 국가 조건(고령 비율 등)이 반영된 값

const MASK_LEVEL_EFF = [0, 0.15, 0.30];      // 마스크: 해제 / 권고(전파율 15% 감소) / 의무(30% 감소)
const DIST_EFF = [0, 0.15, 0.3, 0.45];       // 거리두기 단계별 전파율 감소
const VAX_RATE = [0, 0.001, 0.0025, 0.005];  // 백신 단계별 하루 접종률 (S의 비율)
let BASE_BEDS = 3000;                        // 기본 병상 수 (시나리오가 바꾼다)
let BED_STEP = 2000;                         // 확충 1단계당 병상 증가
const ZERO_SET = { mask: 0, dist: 0, vax: 0, bed: 0 };

// 법률·정책·이벤트 보정값 (effects.js의 computeLawMod가 만든다). set.lawMod가 없으면 보정 없음.
//  beta·contact: 배수, beds·vax: 더하기, detect: 조기 발견·격리율 더하기,
//  sever·fatal·imp: 중증화·사망·해외유입 배수, cost·econ: 하루 비용·경제 변화, trust·equity: 하루 신뢰도·형평성 변화,
//  bedMul: 의료인력 상태에 따른 병상 사용 가능 비율, vaxMul: 백신 공급 증가 속도
const LAW_NEUTRAL = { beta: 1, contact: 1, beds: 0, vax: 0, cost: 0, econ: 0, count: 0, detect: 0, sever: 1, fatal: 1, imp: 1, trust: 0, equity: 0, bedMul: 1, vaxMul: 1 };
function lawOf(set) { return set.lawMod || LAW_NEUTRAL; }

// ── 시나리오(국가 조건) ─────────────────────────────
const DEFAULT_SCN = {
  id: 'default', pop: 1000000, seedPer100k: 25, bedsPer100k: 300, budget: 2000, trust: 70, equity: 70,
  econFragility: 1, density: 0, aged65: 17, importPer100kDay: 0, testBase: 0,
  distMul: 1, maskMul: 1, lawEff: 1, lawDelay: 0, borderMul: 1, supportMul: 1, realStart: '', unlock: null, limits: null,
};
function deriveScenario(sc) {
  const full = { ...DEFAULT_SCN, ...sc };
  // 인구밀도가 높을수록 접촉이 잦다고 가정: 밀도 20→0.93, 270→1.04, 530→1.07 (게임 가정)
  full.betaMul = full.density ? Math.min(1.15, Math.max(0.85, 0.80 + 0.10 * Math.log10(full.density))) : 1;
  full.ageMul = full.aged65 / 17;                                // 고령 인구 비율 (기준 17%)
  full.importPerDay = full.importPer100kDay * full.pop / 1e5;    // 하루 해외 유입 감염자 수
  full.testMul = 0.8 + 3 * full.testBase;                        // 검사·추적 강화 정책의 효과 배율 (기본 검사 역량이 높은 나라일수록 크다)
  return full;
}
let SCN = deriveScenario(DEFAULT_SCN);

const PS = () => POP / 1e6;                  // 인구 규모 배율 (이벤트 효과 등을 100만 명 기준에서 환산)
const bedScale = () => BASE_BEDS / 3000;     // 병상 규모 배율

const CONTACT_BASE = 10;   // 거리두기가 없을 때 하루 평균 접촉 수(명). 거리두기 감소율만큼 줄어든다

// 국가의 행정·문화 조건이 거리두기·마스크의 실제 효과를 키우거나 줄인다 (게임 가정)
function distEff(level) { return Math.min(0.8, DIST_EFF[level] * SCN.distMul); }
function maskEff(level = 2) { return Math.min(0.6, MASK_LEVEL_EFF[level] * SCN.maskMul); }

function dailyContacts(set) {
  return CONTACT_BASE * (1 - distEff(set.dist)) * lawOf(set).contact;
}

// 감염자 발견·격리 비율: 이 비율만큼의 전파가 차단된다 (검사·추적 역량 + 정책)
// 감염자가 많아지면 추적·격리 역량이 포화되어 효율이 떨어진다 (게임 가정): 전염 가능한 사람이 인구의 0.3%이면 절반
const TRACE_CAP_SHARE = 0.003;
function detectRate(set, st = null) {
  const raw = SCN.testBase + lawOf(set).detect;
  const load = st ? (st.E2 + st.I1 + st.I2) / POP : 0;
  return Math.min(0.85, raw / (1 + load / TRACE_CAP_SHARE));
}

// 정책 선택: { mask: 0|1, dist: 0~3, vax: 0~3, bed: 0~3 }
function initialState() {
  const seed = SCN.seedPer100k * POP / 1e5;
  return { S: POP - seed, E1: seed * 0.8, E2: 0, I1: seed * 0.2, I2: 0, R: 0, D: 0, cumInf: 0, day: 0 };
}

const WARMUP_DAYS = 14;     // 처음 2주는 감염이 천천히 퍼져서 규칙을 익힐 시간을 준다
const WARMUP_FACTOR = 0.6;

function effectiveBeta(set, day = 0) {
  const mask = set.mask ? 1 - maskEff(set.mask) : 1;
  const warm = day < WARMUP_DAYS ? WARMUP_FACTOR : 1;
  return PARAM.beta * SCN.betaMul * warm * mask * (1 - distEff(set.dist)) * lawOf(set).beta;
}

// 지금 정책이 계속될 때 감염자 1명이 평균 몇 명을 감염시키는지 (실효 재생산수)
function reproNumber(set, day, st) {
  const N = st.S + st.E1 + st.E2 + st.I1 + st.I2 + st.R;
  const dI = detectRate(set, st), dE = dI * 0.5;
  const pSev = Math.min(0.5, PARAM.pSevere * lawOf(set).sever);
  const infectiousDays = PARAM.e2Weight * (1 - dE) / PARAM.s2 + (1 - dI) / PARAM.rec1 + pSev * PARAM.i2Weight / PARAM.rec2;
  return effectiveBeta(set, day) * (st.S / N) * infectiousDays;
}

function bedCapacity(set) {
  const lm = lawOf(set);
  return Math.max(0.17 * BASE_BEDS, (BASE_BEDS + BED_STEP * set.bed + lm.beds) * lm.bedMul);   // 파업 등으로 줄어도 최소치 유지, 의료인력이 부족하면 쓸 수 있는 병상이 준다
}

function activeCount(st) {
  return st.E1 + st.E2 + st.I1 + st.I2;
}

// 하루치 계산. 입력 상태는 바꾸지 않고 새 상태를 돌려준다.
function stepDay(st, set) {
  let { S, E1, E2, I1, I2, R, D, cumInf } = st;
  const lm = lawOf(set);
  const beta = effectiveBeta(set, st.day);
  const cap = bedCapacity(set);
  const vr = Math.max(0, VAX_RATE[set.vax] * lm.vaxMul + lm.vax);
  const pSev = Math.min(0.5, PARAM.pSevere * lm.sever);
  const fatal = PARAM.fatal * lm.fatal;
  const imp = SCN.importPerDay * lm.imp * DT;                   // 해외 유입 (S → E1)
  for (let k = 0; k < SUB; k++) {
    const N = S + E1 + E2 + I1 + I2 + R;
    const dI = detectRate(set, { E2, I1, I2 }), dE = dI * 0.5;   // 발견·격리된 감염자는 전파하지 않는다. 증상 전(E2)은 절반만 찾는다고 가정. 감염자가 많으면 역량이 포화됨
    const force = PARAM.e2Weight * (1 - dE) * E2 + (1 - dI) * I1 + PARAM.i2Weight * I2;
    const infl = beta * force / N * S * DT;                      // 새 감염
    const vac = vr * S * DT;                                     // 백신 접종 (S → R)
    const imported = Math.min(imp, Math.max(0, S - infl - vac)); // 해외 유입은 남은 미감염자 수를 넘지 않는다
    const f1 = PARAM.s1 * E1 * DT;                               // E1 → E2
    const f2 = PARAM.s2 * E2 * DT;                               // E2 → I1
    const out1 = PARAM.rec1 * I1 * DT;                           // I1 이탈
    const sev = out1 * pSev;                                     // I1 → I2
    const out2 = PARAM.rec2 * I2 * DT;                           // I2 이탈
    const q = Math.min(0.5, fatal * (I2 > cap ? 2 : 1));         // 병상 부족 시 사망률 2배
    const die = out2 * q;                                        // I2 → D

    S -= infl + vac + imported;
    E1 += infl + imported - f1;
    E2 += f1 - f2;
    I1 += f2 - out1;
    I2 += sev - out2;
    R += (out1 - sev) + (out2 - die) + vac;
    D += die;
    cumInf += infl + imported;
  }
  return {
    S: Math.max(0, S), E1: Math.max(0, E1), E2: Math.max(0, E2),
    I1: Math.max(0, I1), I2: Math.max(0, I2), R: Math.max(0, R),
    D: Math.max(0, D), cumInf, day: st.day + 1,
  };
}

// setOfDay(d) → 그날의 정책 선택. 전체 기간을 한 번에 계산한다.
function simulate(setOfDay) {
  let st = initialState();
  for (let d = 0; d < DAYS; d++) st = stepDay(st, setOfDay(d));
  return st;
}
