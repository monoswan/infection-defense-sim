// scenario.js — 선택한 국가의 조건을 공통 엔진에 적용한다 (엔진: model.js, 국가 데이터: countries.js)

function applyScenario(sc) {
  SCN = deriveScenario(sc);
  POP = SCN.pop;
  BASE_BEDS = Math.round(SCN.bedsPer100k * POP / 1e5);
  BED_STEP = Math.round(BASE_BEDS * 2 / 3);                        // 확충 1단계 = 기본 병상의 2/3 (기존 3,000 → +2,000과 같은 비율)
  PARAM.pSevere = PARAM_BASE.pSevere * SCN.ageMul;                 // 고령 인구가 많을수록 중증화가 늘어난다 (게임 가정)
  PARAM.fatal = PARAM_BASE.fatal * Math.sqrt(SCN.ageMul);          // 사망 위험은 완만하게 늘어난다 (게임 가정)
  BUDGET = SCN.budget;
  refreshPolicyInfo();
}

// 인구 10만 명당 값
function per100k(v) { return v / POP * 1e5; }
function fmtPer100k(v) { return per100k(v) >= 100 ? fmtNum(per100k(v)) : per100k(v).toFixed(1); }

// 압축 타임라인: 게임 1일 = 실제 약 4일. 게임 날짜를 실제 날짜로 환산한다.
const TIME_RATIO = 4;
function realDate(day, sc = SCN) {
  if (!sc.realStart) return '';
  const d = new Date(Date.parse(sc.realStart + 'T00:00:00Z') + day * TIME_RATIO * 864e5);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

// 국가 조건이 반영된 정책 설명 (효과 수치는 게임 가정)
function refreshPolicyInfo() {
  const m = Math.round(maskEff(2) * 100);
  const d = [1, 2, 3].map(l => Math.round(distEff(l) * 100));
  const c = [1, 2, 3].map(l => (CONTACT_BASE * (1 - distEff(l))).toFixed(1));
  POLICY_INFO.mask.desc = `권고 ${Math.round(maskEff(1) * 100)}% / 의무 ${m}% 감소. 하루 0.5 / 1억 원.`;
  POLICY_INFO.dist.desc = `단계별 접촉 10 → ${c.join(' / ')}명/일 (전파력 0/${d.join('/')}% 감소). 하루 0/2/4/7억 원.`;
  POLICY_INFO.bed.desc = `기본 병상 ${fmtNum(BASE_BEDS)}개, 단계마다 +${fmtNum(BED_STEP)}개(최대 3단계). 확충 80 / 100 / 120억 원, 단계당 하루 유지비 0.5억 원.`;
  for (const k of ['mask', 'dist', 'bed']) {
    const el = document.getElementById('desc-' + k);
    if (el) el.textContent = POLICY_INFO[k].desc;
  }
}
