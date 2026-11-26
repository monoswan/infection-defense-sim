// missions.js — 국가별 미션(교육용 게임 목표)과 업적
// ★ 승리 조건은 실제 국가에 대한 역사적 평가가 아니라 교육용 게임 목표이다.
// 각 미션: { title, desc, test(w) → {ok, now} } — now는 지금 상태를 보여 주는 짧은 문구

const lvDays = (w, key, min = 1) => levelSeries(w, key).filter(v => v >= min).length;
const cumPct = w => w.st.cumInf / POP * 100;

const MISSIONS = {
  kr: [
    { title: '대규모 확산 억제', desc: '누적 감염을 인구의 10% 미만으로 막으세요.', test: w => ({ ok: cumPct(w) < 10, now: `지금 ${cumPct(w).toFixed(1)}%` }) },
    { title: '추적·격리 역량 유지', desc: '검사·접촉자 추적 강화(1단계 이상)를 100일 이상 유지하세요.', test: w => ({ ok: lvDays(w, 'test') >= 100, now: `지금 ${lvDays(w, 'test')}일` }) },
    { title: '신뢰 지키기', desc: '정부 신뢰도를 65 이상으로 마치세요.', test: w => ({ ok: w.trust >= 65, now: `지금 ${Math.round(w.trust)}` }) },
  ],
  us: [
    { title: '의료체계 부담 최소화', desc: '중증 환자가 병상을 넘은 날을 3일 이하로 막으세요.', test: w => ({ ok: w.overflowDays <= 3, now: `지금 ${w.overflowDays}일` }) },
    { title: '경제적 피해 최소화', desc: '경제지수를 80 이상으로 지키세요.', test: w => ({ ok: w.econ >= 80, now: `지금 ${w.econ.toFixed(0)}` }) },
    { title: '접종 격차 줄이기', desc: '백신 접종을 시행하면서 사회적 형평성을 55 이상으로 지키세요.', test: w => ({ ok: w.equity >= 55 && levelSeries(w, 'vax').some(v => v > 0), now: `형평성 ${Math.round(w.equity)}` }) },
  ],
  uk: [
    { title: 'NHS 붕괴 방지', desc: '중증 환자가 병상을 넘은 날이 하루도 없게 하세요.', test: w => ({ ok: w.overflowDays === 0, now: `지금 ${w.overflowDays}일` }) },
    { title: '의료진 지키기', desc: '의료인력 상태를 55 이상으로 유지하세요.', test: w => ({ ok: w.med >= 55, now: `지금 ${Math.round(w.med)}` }) },
    { title: '일자리 보호', desc: '경제 지원(1단계 이상)을 30일 이상 유지하세요.', test: w => ({ ok: lvDays(w, 'support') >= 30, now: `지금 ${lvDays(w, 'support')}일` }) },
  ],
  de: [
    { title: '의료체계 안정성 확보', desc: '병상 초과를 2일 이하로 막고 의료체계 점수를 70 이상으로 지키세요.', test: w => ({ ok: w.overflowDays <= 2 && calcMedical(w) >= 70, now: `초과 ${w.overflowDays}일, 의료 ${Math.round(calcMedical(w))}` }) },
    { title: '조정 지연 극복', desc: '행정 조정 지연이 있어도 첫 30일 안에 방역 정책 3개 이상을 시행하세요.', test: w => ({ ok: earlyPolicyCount(w, 30) >= 3, now: `지금 ${earlyPolicyCount(w, 30)}개` }) },
    { title: '지역 간 형평성', desc: '사회적 형평성을 75 이상으로 지키세요.', test: w => ({ ok: w.equity >= 75, now: `지금 ${Math.round(w.equity)}` }) },
  ],
  nz: [
    { title: '지역사회 감염 억제', desc: '누적 감염을 인구의 3% 미만으로 막으세요.', test: w => ({ ok: cumPct(w) < 3, now: `지금 ${cumPct(w).toFixed(2)}%` }) },
    { title: '국경 통제 유지', desc: '국경 통제(1단계 이상)를 80일 이상 유지하세요.', test: w => ({ ok: lvDays(w, 'border') >= 80, now: `지금 ${lvDays(w, 'border')}일` }) },
    { title: '경제 지키기', desc: '경제지수를 70 이상으로 지키세요.', test: w => ({ ok: w.econ >= 70, now: `지금 ${w.econ.toFixed(0)}` }) },
  ],
};

const calcMedical = w => clamp100(0.6 * w.med + 0.4 * (100 - Math.min(100, w.overflowDays * 3)));
function earlyPolicyCount(w, day) {
  const keys = ['mask', 'dist', 'school', 'test', 'isolate', 'border', 'support', 'bed'];
  return keys.filter(k => levelSeries(w, k).slice(0, day).some(v => v > 0)).length;
}

function missionStatus(w) {
  return (MISSIONS[SCN.id] || []).map(m => ({ title: m.title, desc: m.desc, ...m.test(w) }));
}

// 대시보드의 미션 현황
function renderMissions() {
  const el = document.getElementById('mission-bar');
  if (!el) return;
  const list = missionStatus(game);
  const c = COUNTRY_BY_ID[SCN.id];
  el.innerHTML = `<b>🎯 ${c ? c.name : ''} 미션</b> <span class="hint">(교육용 게임 목표 · 역사적 평가 아님)</span> ` +
    list.map(m => `<span class="chip ${m.ok ? 'done' : ''}" title="${esc(m.desc)}">${m.ok ? '✔' : '○'} ${esc(m.title)} · ${esc(m.now)}</span>`).join('');
}

const ACHIEVEMENTS = [
  { id: 'first', icon: '🚀', title: '첫 걸음', desc: '정책을 하나 이상 시행했다.', test: (w) => w.log.some(a => a.t === 'set' || a.t === 'pol' || a.t === 'bed') },
  { id: 'early', icon: '⚡', title: '선제 대응', desc: '20일 안에 방역 정책 2개 이상을 시행했다.', test: (w) => earlyPolicyCount(w, 20) >= 2 },
  { id: 'nhs', icon: '🏥', title: '한 번도 넘지 않은 병상', desc: '병상 초과가 하루도 없었다.', test: (w) => w.overflowDays === 0 },
  { id: 'fair', icon: '🤝', title: '공정한 리더', desc: '사회적 형평성 70 이상으로 마쳤다.', test: (w) => w.equity >= 70 },
  { id: 'frugal', icon: '💰', title: '알뜰 살림', desc: '예산을 40% 이상 남겼다.', test: (w) => w.budget >= BUDGET * 0.4 },
  { id: 'gamble', icon: '🎲', title: '운이 따른 모험가', desc: '위험(도박) 선택을 하고도 나쁜 일이 생기지 않았다.', test: (w) => w.decisions.some(d => { const e = EVENTS.find(x => x.id === d.id); return e && e.choices[d.i].risk && !d.bad; }) },
  { id: 'low', icon: '🛡', title: '방역 달인', desc: '누적 감염을 인구의 5% 미만으로 막았다.', test: (w) => cumPct(w) < 5 },
  { id: 'balance', icon: '⚖', title: '균형 잡힌 지도자', desc: '모든 평가 항목이 50점 이상이었다.', test: (w, res) => res.metrics.every(m => m.value >= 50) },
  { id: 'scholar', icon: '🎓', title: '재난관리 학습왕', desc: '퀴즈에서 5점 만점을 받았다.', test: () => Number(localStorage.getItem('ftc-quiz-best') || 0) >= 5 },
  { id: 'traveler', icon: '🌍', title: '세계 일주', desc: '서로 다른 3개 나라를 플레이했다.', test: () => new Set([...loadRecords().map(r => r.country), SCN.id]).size >= 3 },
];

function evaluateAchievements(w, res) {
  return ACHIEVEMENTS.filter(a => a.test(w, res));
}
