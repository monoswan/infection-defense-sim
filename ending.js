// ending.js — 신뢰·형평성·의료 안정성 변화, 5개 지표 평가, 엔딩 5종 (모든 계수는 게임 가정)

const SOCIAL_START = { trust: 70, equity: 70, med: 80 };
const COLLAPSE_OVERFLOW_DAYS = 25;   // 중증 환자가 병상을 넘은 날이 이만큼이면 의료체계 붕괴

const clamp100 = v => Math.min(100, Math.max(0, v));

// 하루가 끝난 뒤 호출: 신뢰·형평성·의료 안정성의 하루 변화 (정책이 주는 하루 변화 lm.trust·lm.equity 포함)
function updateSocial(w, set, st) {
  const lm = lawOf(set);
  const share = (st.I1 + st.I2) / POP;
  const over = st.I2 > bedCapacity(set);
  let t = lm.trust, q = lm.equity, m = 0;
  if (over) { t -= 0.35; q -= 0.15; m -= 1.2; } else { m += 0.12; }   // 병상 초과: 시민 불안, 취약계층 치료 지연, 의료진 소진
  if (set.dist === 3) { t -= 0.12; q -= 0.08; }                       // 강한 거리두기가 길어지면 피로감과 취약계층 부담
  else if (set.dist === 2) t -= 0.03;
  if (share > 0.01) t -= 0.08;                                        // 유행이 크면 불안
  if (share < 0.001) t += 0.05;                                       // 안정되면 신뢰 회복
  q -= 0.02;                                                          // 아무것도 하지 않으면 격차는 조금씩 벌어진다
  w.trust = clamp100(w.trust + t);
  w.equity = clamp100(w.equity + q);
  w.med = clamp100(w.med + m);
}

// 방역 성과 점수 (0~100): 사망과 누적 감염이 적을수록 높다
const outbreakScore = w => 100 * Math.max(0, 1 - (w.st.D / POP) * 30 - (w.st.cumInf / POP) * 1.2);
const WEIGHTS_DEFAULT = [0.27, 0.18, 0.18, 0.13, 0.13, 0.11];   // 방역·경제·의료·신뢰·형평성·비용 대비 효과 (국가마다 countries.js에서 다르게 둔다)

// 정책을 하나도 쓰지 않았다면(이벤트 선택은 그대로) 어떻게 되었을지 — 정책의 비용 대비 효과와 국가 간 공정 비교에 쓴다
function noPolicyWorld(g) {
  return replayWorld(g.log.filter(a => a.t === 'ev'), g.st.day);
}

// 체감 만족도(게임 가정): 신뢰·경제·형평성을 종합한 지표
const satisfactionOf = g => 0.4 * g.trust + 0.35 * g.econ + 0.25 * g.equity;

function calcResult(g) {
  const st = g.st;
  const outbreak = outbreakScore(g);
  const medical = clamp100(0.6 * g.med + 0.4 * (100 - Math.min(100, g.overflowDays * 3)));
  const base = noPolicyWorld(g);
  const gain = outbreak - outbreakScore(base);                       // 정책으로 지켜 낸 방역 점수
  const spentPct = (BUDGET - g.budget) / BUDGET * 100;
  const efficiency = clamp100(gain <= 0 ? 0 : gain / Math.max(5, spentPct) * 35);   // 예산 1%당 지켜 낸 방역 점수
  const W = SCN.weights || WEIGHTS_DEFAULT;
  const metrics = [
    { name: '감염 억제 성과', value: outbreak, w: W[0], note: `누적 감염 ${fmtNum(st.cumInf)}명, 사망 ${fmtNum(st.D)}명 (10만 명당 ${fmtPer100k(st.cumInf)}명 / ${per100k(st.D).toFixed(1)}명)` },
    { name: '경제적 피해', value: g.econ, w: W[1], note: `경제지수 ${g.econ.toFixed(1)} (높을수록 피해가 적음)` },
    { name: '의료체계 안정성', value: medical, w: W[2], note: `병상 초과 ${g.overflowDays}일, 의료진 상태 ${Math.round(g.med)}` },
    { name: '정부 신뢰도', value: g.trust, w: W[3], note: `신뢰도 ${Math.round(g.trust)}` },
    { name: '사회적 형평성', value: g.equity, w: W[4], note: `형평성 ${Math.round(g.equity)} (취약계층 보호)` },
    { name: '정책의 비용 대비 효과', value: efficiency, w: W[5], note: `정책 없이는 방역 점수 ${Math.round(outbreakScore(base))} → 실제 ${Math.round(outbreak)}, 예산 ${spentPct.toFixed(0)}% 사용` },
  ];
  const total = metrics.reduce((s, m) => s + m.value * m.w, 0);
  const collapse = g.overflowDays >= COLLAPSE_OVERFLOW_DAYS || medical < 25;
  return { metrics, total: Math.round(total), ending: pickEnding(total, collapse), collapse, base, outbreak, medical, efficiency, spentPct };
}

const ENDINGS = [
  { id: 'best', icon: '🏆', title: '최우수 위기관리', pass: true,
    text: '감염을 막으면서 경제, 의료, 신뢰, 형평성을 모두 지켜 냈습니다. 어려운 선택마다 균형을 잡은 드문 결과입니다.' },
  { id: 'good', icon: '🎉', title: '성공적인 방역', pass: true,
    text: '위기를 대체로 잘 넘겼습니다. 일부 영역에서 희생이 있었지만 사회는 무너지지 않았습니다.' },
  { id: 'mixed', icon: '😐', title: '불완전한 대응', pass: false,
    text: '방역과 사회 안정 중 어느 한쪽이 크게 흔들렸습니다. 선택의 대가가 쌓여 상처가 남았습니다.' },
  { id: 'crisis', icon: '😵', title: '심각한 사회적 위기', pass: false,
    text: '감염, 경제, 신뢰 중 여러 곳이 무너졌습니다. 시민들은 정부의 대응을 믿지 못하고 있습니다.' },
  { id: 'collapse', icon: '🚨', title: '의료체계 붕괴', pass: false,
    text: '중환자 병상과 의료진이 한계를 넘었습니다. 치료받지 못한 환자가 늘어 의료체계가 무너졌습니다.' },
];

function pickEnding(total, collapse) {
  if (collapse) return ENDINGS[4];
  if (total >= 86) return ENDINGS[0];
  if (total >= 78) return ENDINGS[1];
  if (total >= 62) return ENDINGS[2];
  return ENDINGS[3];
}

function metricComment(v) {
  return v >= 80 ? '매우 좋음' : v >= 60 ? '양호' : v >= 40 ? '불안' : '심각';
}

function endingHtml(res) {
  const bars = res.metrics.map(m => {
    const c = m.value >= 60 ? '#86efac' : m.value >= 40 ? '#fde68a' : '#f87171';
    return `<div class="metric"><div class="metric-head"><b>${m.name}</b><span style="color:${c}">${Math.round(m.value)}점 · ${metricComment(m.value)}</span></div>
      <div class="bar"><i style="width:${Math.round(m.value)}%;background:${c}"></i></div>
      <div class="metric-note">${m.note} · 비중 ${Math.round(m.w * 100)}%</div></div>`;
  }).join('');
  const e = res.ending;
  return `<p class="outcome ${e.pass ? 'pass' : 'fail'}">${e.icon} ${e.title}</p>
    <div class="grade">${res.total}<span>/ 100점</span></div>
    <p>${e.text}</p>${res.collapse && e.id === 'collapse' ? '<p class="hint">종합 점수와 관계없이, 병상 초과가 오래 이어지면 의료체계 붕괴 엔딩이 됩니다.</p>' : ''}
    <h3>${res.metrics.length}가지 평가</h3>${bars}`;
}

function decisionsHtml() {
  if (!game.decisions.length) return '<p class="hint">이번 게임에서는 위기 이벤트가 발생하지 않았습니다.</p>';
  return '<ul>' + game.decisions.map(d =>
    `<li>${d.day}일차 ${d.icon} <b>${esc(d.title)}</b> → ${esc(d.label)}${d.bad ? ` <span class="bad-note">(${esc(d.bad)})</span>` : ''}</li>`).join('') + '</ul>';
}
