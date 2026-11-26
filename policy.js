// policy.js — 정책 비용, 예산, 점수, 정책 효과 계산 (model.js에 의존)

let BUDGET = 2000;                  // 총 예산 (억 원, 국가 시나리오가 바꾼다)
const MASK_COST = [0, 0.5, 1];      // 마스크 해제 / 권고 / 의무의 하루 비용
const DIST_COST = [0, 2, 4, 7];     // 거리두기 단계별 하루 비용
const VAX_COST = [0, 1.5, 3, 5];    // 백신 단계별 하루 비용
const BED_UPKEEP = 0.5;             // 병상 확충 1단계당 하루 유지비
const BED_BUY = [0, 80, 100, 120];  // 해당 단계에 도달할 때 1회 비용 (인덱스 = 도달 단계)
const BED_MAX = 3;

const POLICY_INFO = {
  mask: {
    name: '마스크 착용',
    desc: '권고 15% / 의무 30% 감소. 하루 0.5 / 1억 원.',
    lesson: '싸고 쉬운 방법이지만 혼자로는 효과가 제한적입니다. 다른 정책과 함께 쓸 때 효과가 큽니다.',
  },
  dist: {
    name: '사회적 거리두기',
    desc: '단계별 접촉 10 → 8.5 / 7 / 5.5명/일 (전파력 0/15/30/45% 감소). 하루 0/2/4/7억 원.',
    lesson: '전파를 가장 크게 줄이는 정책입니다. 다만 하루 비용이 크고 시민 생활에 불편을 줍니다.',
  },
  vax: {
    name: '백신 접종',
    desc: '하루 접종률 0 / 0.1 / 0.25 / 0.5%. 하루 0 / 1.5 / 3 / 5억 원.',
    lesson: '면역 인구를 늘려 집단면역에 가까워지게 합니다. 일찍 시작할수록 누적 감염이 줄어듭니다.',
  },
  law: {
    name: '신규 정책·이벤트 효과 (게임 가정)',
    desc: '학교·검사·격리·국경·경제지원 정책과 위기 이벤트. 효과 수치는 게임 가정치입니다.',
    lesson: '방역 강도를 높일수록 감염은 줄지만 경제지수가 떨어집니다. 지원 정책은 경제를 지켜 주지만 예산을 씁니다. 효과 수치는 실제 측정값이 아니라 게임 가정입니다.',
  },
  bed: {
    name: '병상 확충',
    desc: '기본 병상 3,000개, 단계마다 +2,000개(최대 3단계). 확충 80 / 100 / 120억 원, 단계당 하루 유지비 0.5억 원.',
    lesson: '사망을 직접 막지는 않지만 중증 환자가 병상을 넘으면 사망률이 두 배가 됩니다.',
  },
};

// 자동 거리두기: 현재 감염자 비율로 단계를 정한다
function autoDistLevel(st) {
  const share = (st.I1 + st.I2) / POP;
  if (share < 0.0005) return 0;
  if (share < 0.002) return 1;
  if (share < 0.01) return 2;
  return 3;
}

// 그날의 정책 유지비 합계 (억 원)
function dailyCost(set) {
  return MASK_COST[set.mask] + DIST_COST[set.dist] + VAX_COST[set.vax] + BED_UPKEEP * set.bed + lawOf(set).cost;
}

// 다음 병상 단계로 올릴 때 드는 1회 비용 (최대 단계면 null)
function bedUpgradeCost(level) {
  return level >= BED_MAX ? null : BED_BUY[level + 1];
}

// 정책별 누적 지출 (억 원): 기록된 선택 일지와 최종 병상 단계 기준
function policyCosts(timeline, finalBed, lawUpfront = 0) {
  const c = { mask: 0, dist: 0, vax: 0, bed: 0, law: lawUpfront };
  timeline.forEach(s => {
    c.mask += MASK_COST[s.mask];
    c.dist += DIST_COST[s.dist];
    c.vax += VAX_COST[s.vax];
    c.bed += BED_UPKEEP * s.bed;
    c.law += lawOf(s).cost;
  });
  for (let l = 1; l <= finalBed; l++) c.bed += BED_BUY[l];
  return c;
}

// 같은 선택 기록으로 다시 계산해서 정책 하나씩의 효과를 본다.
// effects[key] = 그 정책을 뺐을 때 늘어나는 사망·감염 수
function evaluatePolicies(timeline) {
  const setOf = d => (timeline.length ? timeline[Math.min(d, timeline.length - 1)] : ZERO_SET);
  const actual = simulate(setOf);
  const none = simulate(() => ZERO_SET);
  const effects = {};
  for (const key of ['mask', 'dist', 'vax', 'bed', 'law']) {
    // 'law'는 법률·정책 보정값 전체를 뺀다
    const off = simulate(d => (key === 'law' ? { ...setOf(d), lawMod: undefined } : { ...setOf(d), [key]: 0 }));
    effects[key] = { deaths: off.D - actual.D, infections: off.cumInf - actual.cumInf };
  }
  return { actual, none, effects };
}
