// model.js — 감염병 확산 모형 (S, E1, E2, I1, I2, R, D)
// 흐름: S → E1 → E2 → I1 → (R 또는 I2), I2 → (R 또는 D)
// 하루를 SUB번 나눠(0.25일 단위) 오일러 방식으로 계산한다.

const POP = 1000000;   // 도시 인구
const DAYS = 180;      // 게임 기간 (일)
const SUB = 4;         // 하루를 나누는 횟수
const DT = 1 / SUB;

const PARAM = {
  beta: 0.42,      // 정책이 없을 때의 하루 전파율
  s1: 0.5,         // E1 → E2 진행률 (평균 2일 잠복)
  s2: 0.5,         // E2 → I1 진행률 (평균 2일 잠복)
  rec1: 0.2,       // I1 이탈률 (평균 5일): 회복 또는 중증 악화
  pSevere: 0.1,    // I1에서 중증(I2)으로 악화되는 비율
  rec2: 0.1,       // I2 이탈률 (평균 10일): 회복 또는 사망
  fatal: 0.05,     // 병상이 충분할 때 중증 환자의 사망 비율
  i2Weight: 0.7,   // 중증 환자의 전파력 (입원하면 접촉이 줄어듦)
};

const MASK_EFF = 0.3;                        // 마스크: 전파율 30% 감소
const DIST_EFF = [0, 0.15, 0.3, 0.45];       // 거리두기 단계별 전파율 감소
const VAX_RATE = [0, 0.001, 0.0025, 0.005];  // 백신 단계별 하루 접종률 (S의 비율)
const BASE_BEDS = 3000;                      // 기본 병상 수
const BED_STEP = 2000;                       // 확충 1단계당 병상 증가
const ZERO_SET = { mask: 0, dist: 0, vax: 0, bed: 0 };

// 정책 선택: { mask: 0|1, dist: 0~3, vax: 0~3, bed: 0~3 }
function initialState() {
  return { S: POP - 250, E1: 200, E2: 0, I1: 50, I2: 0, R: 0, D: 0, cumInf: 0, day: 0 };
}

function effectiveBeta(set) {
  const mask = set.mask ? 1 - MASK_EFF : 1;
  return PARAM.beta * mask * (1 - DIST_EFF[set.dist]);
}

function bedCapacity(set) {
  return BASE_BEDS + BED_STEP * set.bed;
}

function activeCount(st) {
  return st.E1 + st.E2 + st.I1 + st.I2;
}

// 하루치 계산. 입력 상태는 바꾸지 않고 새 상태를 돌려준다.
function stepDay(st, set) {
  let { S, E1, E2, I1, I2, R, D, cumInf } = st;
  const beta = effectiveBeta(set);
  const cap = bedCapacity(set);
  const vr = VAX_RATE[set.vax];
  for (let k = 0; k < SUB; k++) {
    const N = S + E1 + E2 + I1 + I2 + R;
    const infl = beta * (I1 + PARAM.i2Weight * I2) / N * S * DT; // 새 감염
    const vac = vr * S * DT;                                     // 백신 접종 (S → R)
    const f1 = PARAM.s1 * E1 * DT;                               // E1 → E2
    const f2 = PARAM.s2 * E2 * DT;                               // E2 → I1
    const out1 = PARAM.rec1 * I1 * DT;                           // I1 이탈
    const sev = out1 * PARAM.pSevere;                            // I1 → I2
    const out2 = PARAM.rec2 * I2 * DT;                           // I2 이탈
    const q = Math.min(0.5, PARAM.fatal * (I2 > cap ? 2 : 1));   // 병상 부족 시 사망률 2배
    const die = out2 * q;                                        // I2 → D

    S -= infl + vac;
    E1 += infl - f1;
    E2 += f1 - f2;
    I1 += f2 - out1;
    I2 += sev - out2;
    R += (out1 - sev) + (out2 - die) + vac;
    D += die;
    cumInf += infl;
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
