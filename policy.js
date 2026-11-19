// policy.js — 정책 비용, 예산, 점수, 정책 효과 계산 (model.js에 의존)

const BUDGET = 2000;                // 총 예산 (억 원)
const MASK_COST = 1;                // 마스크 하루 비용
const DIST_COST = [0, 2, 4, 7];     // 거리두기 단계별 하루 비용
const VAX_COST = [0, 1.5, 3, 5];    // 백신 단계별 하루 비용
const BED_UPKEEP = 0.5;             // 병상 확충 1단계당 하루 유지비
const BED_BUY = [0, 80, 100, 120];  // 해당 단계에 도달할 때 1회 비용 (인덱스 = 도달 단계)
const BED_MAX = 3;

const POLICY_INFO = {
  mask: {
    name: '마스크 착용',
    desc: '전파력 30% 감소. 하루 1억 원.',
    lesson: '싸고 쉬운 방법이지만 혼자로는 효과가 제한적입니다. 다른 정책과 함께 쓸 때 효과가 큽니다.',
  },
  dist: {
    name: '사회적 거리두기',
    desc: '단계별 전파력 0 / 15 / 30 / 45% 감소. 하루 0 / 2 / 4 / 7억 원.',
    lesson: '전파를 가장 크게 줄이는 정책입니다. 다만 하루 비용이 크고 시민 생활에 불편을 줍니다.',
  },
  vax: {
    name: '백신 접종',
    desc: '하루 접종률 0 / 0.1 / 0.25 / 0.5%. 하루 0 / 1.5 / 3 / 5억 원.',
    lesson: '면역 인구를 늘려 집단면역에 가까워지게 합니다. 일찍 시작할수록 누적 감염이 줄어듭니다.',
  },
  bed: {
    name: '병상 확충',
    desc: '기본 병상 3,000개, 단계마다 +2,000개(최대 3단계). 확충 80 / 100 / 120억 원, 단계당 하루 유지비 0.5억 원.',
    lesson: '사망을 직접 막지는 않지만 중증 환자가 병상을 넘으면 사망률이 두 배가 됩니다.',
  },
};

// 그날의 정책 유지비 합계 (억 원)
function dailyCost(set) {
  return (set.mask ? MASK_COST : 0) + DIST_COST[set.dist] + VAX_COST[set.vax] + BED_UPKEEP * set.bed;
}

// 다음 병상 단계로 올릴 때 드는 1회 비용 (최대 단계면 null)
function bedUpgradeCost(level) {
  return level >= BED_MAX ? null : BED_BUY[level + 1];
}

// 정책별 누적 지출 (억 원): 기록된 선택 일지와 최종 병상 단계 기준
function policyCosts(timeline, finalBed) {
  const c = { mask: 0, dist: 0, vax: 0, bed: 0 };
  timeline.forEach(s => {
    if (s.mask) c.mask += MASK_COST;
    c.dist += DIST_COST[s.dist];
    c.vax += VAX_COST[s.vax];
    c.bed += BED_UPKEEP * s.bed;
  });
  for (let l = 1; l <= finalBed; l++) c.bed += BED_BUY[l];
  return c;
}

// 건강 점수(최대 800) + 예산 점수(최대 200)
function calcScore(final, budgetLeft) {
  const deathRate = final.D / POP;
  const infRate = final.cumInf / POP;
  const health = Math.round(800 * Math.max(0, 1 - deathRate * 10 - infRate * 0.5));
  const money = Math.round(200 * Math.max(0, budgetLeft) / BUDGET);
  const total = health + money;
  const grade = total >= 900 ? 'S' : total >= 750 ? 'A' : total >= 600 ? 'B' : total >= 400 ? 'C' : 'D';
  return { health, money, total, grade };
}

// 같은 선택 기록으로 다시 계산해서 정책 하나씩의 효과를 본다.
// effects[key] = 그 정책을 뺐을 때 늘어나는 사망·감염 수
function evaluatePolicies(timeline) {
  const setOf = d => (timeline.length ? timeline[Math.min(d, timeline.length - 1)] : ZERO_SET);
  const actual = simulate(setOf);
  const none = simulate(() => ZERO_SET);
  const effects = {};
  for (const key of ['mask', 'dist', 'vax', 'bed']) {
    const off = simulate(d => ({ ...setOf(d), [key]: 0 }));
    effects[key] = { deaths: off.D - actual.D, infections: off.cumInf - actual.cumInf };
  }
  return { actual, none, effects };
}
