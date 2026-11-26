// concepts.js — 재난관리 개념(8개): 정책 시행·이벤트 선택과 연결한 짧은 설명, 종료 후 전략 분석

const CONCEPTS = {
  mitigation: { name: 'Mitigation (완화)', icon: '🛡', short: '피해가 커지기 전에 위험 자체를 줄이는 활동' },
  preparedness: { name: 'Preparedness (대비)', icon: '🧰', short: '위기가 오기 전에 자원과 역량을 미리 갖춰 두는 것' },
  response: { name: 'Response (대응)', icon: '🚒', short: '위기가 벌어진 뒤 즉시 피해를 줄이는 행동' },
  recovery: { name: 'Recovery (복구)', icon: '🌱', short: '피해를 입은 사람과 경제를 회복시키는 활동' },
  risk: { name: 'Risk Management (위험 관리)', icon: '🎲', short: '불확실성과 가능한 손실을 따져 선택하는 것' },
  vulnerability: { name: 'Vulnerability (취약성)', icon: '🧓', short: '같은 재난에도 더 큰 피해를 입는 사람·지역의 조건' },
  resilience: { name: 'Resilience (회복탄력성)', icon: '🏥', short: '충격을 견디고 빠르게 회복하는 체계의 능력' },
  tradeoff: { name: 'Trade-off (상충 관계)', icon: '⚖', short: '하나를 얻으면 다른 하나를 잃는 선택' },
};

// 정책 → 관련 개념 (카드에 표시)
const POLICY_CONCEPT = {
  mask: ['mitigation'], dist: ['mitigation', 'tradeoff'], school: ['tradeoff', 'vulnerability'], test: ['preparedness', 'mitigation'],
  isolate: ['response', 'vulnerability'], bed: ['preparedness', 'resilience'], border: ['risk', 'mitigation'],
  support: ['recovery', 'vulnerability'], vax: ['preparedness', 'mitigation'],
};

// 정책을 시행했을 때 플레이어의 선택과 연결한 설명 (정책마다 한 줄)
const POLICY_NOTE = {
  mask: '낮은 비용으로 감염 위험을 줄이는 대표적인 완화 정책입니다. 효과는 제한적이라 다른 정책과 함께 쓸 때 커집니다.',
  dist: '감염은 크게 줄이지만 경제와 시민 신뢰를 깎습니다. 단계를 올릴수록 얻는 것과 잃는 것이 함께 커지는 상충 관계입니다.',
  school: '접촉은 줄지만 교육 손실이 저소득 가정과 아이들에게 더 크게 돌아갑니다. 같은 정책이 집단마다 다른 피해를 주는 취약성의 문제입니다.',
  test: '검사·추적 역량은 위기가 오기 전에 갖춰 둘수록 효과가 큽니다. 지금 선택은 미래 확산을 막는 대비에 투자하는 것입니다.',
  isolate: '확진자를 격리·치료하는 것은 이미 벌어진 감염에 대한 대응입니다. 격리 대상의 생계를 돕지 않으면 취약계층이 더 힘들어집니다.',
  bed: '병상과 인력은 환자가 몰리기 전에 미리 늘려야 의미가 있습니다. 위기가 와도 체계가 무너지지 않게 하는 회복탄력성을 키웁니다.',
  border: '외부에서 들어오는 위험의 통로를 줄이는 위험 관리입니다. 이미 퍼진 지역 감염에는 효과가 작고 경제 비용이 따릅니다.',
  support: '피해를 입은 가계와 기업을 돕는 복구 정책입니다. 감염을 직접 줄이지는 않지만 취약계층을 보호하고 방역 이행을 돕습니다.',
  vax: '백신은 미리 확보할수록 유리한 대비이면서 감염을 줄이는 완화 수단입니다. 승인 전에는 선택할 수 없고, 초기에는 공급이 제한됩니다.',
};

function resetConceptCard() {
  const el = document.getElementById('concept-note');
  if (el) { el.innerHTML = ''; el.classList.add('hidden'); }
}

function setConceptCard(html) {
  const el = document.getElementById('concept-note');
  if (el) { el.innerHTML = html; el.classList.remove('hidden'); }
}

// 정책을 시행했을 때 (ui.js·policy-ui.js가 부른다)
function policyConcept(key, level) {
  if (level === 0 && key !== 'bed') return;
  const ids = POLICY_CONCEPT[key];
  const c = CONCEPTS[ids[0]];
  const t = `${c.icon} <b>${c.name}</b> — ${c.short}. ${esc(POLICY_NOTE[key])}`;
  setConceptCard(t);
  addLog(game.st.day, `📘 ${c.name}: ${POLICY_META[key].name}`);
}

// 이벤트 선택 결과에서 가장 알맞은 개념과 설명을 고른다 (선택의 실제 효과를 보고 판단)
function conceptsOf(ch) {
  const fx = ch.fx, m = fx.mod || {};
  const tags = eventTags(ch);
  const goods = tags.filter(t => t.good).map(t => t.name), bads = tags.filter(t => !t.good).map(t => t.name);
  if (ch.risk) return ['risk', `${Math.round(ch.risk.p * 100)}% 확률로 나쁜 일이 더 생길 수 있는 불확실한 선택을 했습니다. 기대 이익과 최악의 손실을 함께 따지는 것이 위험 관리입니다.`];
  if ((fx.equity || 0) < -1) return ['vulnerability', `이 선택은 형평성을 낮춥니다. 같은 조치도 소득·나이·거주 조건이 다른 사람에게 다르게 닿는다는 점을 보여 줍니다.`];
  if (goods.length && bads.length) return ['tradeoff', `${goods.join('·')}을(를) 얻는 대신 ${bads.join('·')}을(를) 내주는 선택입니다. 모든 것을 동시에 지킬 수는 없습니다.`];
  if ((m.beds || 0) > 0 || (fx.med || 0) > 0) return ['resilience', '의료체계가 충격을 견디는 힘을 키우는 선택입니다. 위기 때 체계가 무너지지 않게 하는 능력이 회복탄력성입니다.'];
  if ((fx.econ || 0) > 0 || (fx.equity || 0) > 1) return ['recovery', '피해를 입은 사람과 경제의 회복을 돕는 선택입니다.'];
  if ((m.days || 0) >= 20 && goods.includes('감염 위험')) return ['mitigation', '오래 지속되는 방식으로 감염 위험 자체를 낮추는 완화 선택입니다.'];
  return ['response', '위기가 벌어진 뒤 바로 피해를 줄이려는 대응 선택입니다.'];
}

function conceptNote(ch) {
  const [id, why] = conceptsOf(ch);
  const c = CONCEPTS[id];
  setConceptCard(`${c.icon} <b>${c.name}</b> — ${c.short}. 당신의 선택 "${esc(ch.label)}": ${esc(why)}`);
  addLog(game.st.day, `📘 ${c.name}: ${ch.label}`);
}

// ── 종료 후 전략 분석: 기록(log)과 결과로 8개 개념 점수(0~100)를 만든다 ──
function levelSeries(w, key) {
  if (key === 'mask' || key === 'dist' || key === 'vax' || key === 'bed') return w.timeline.map(s => s[key] || 0);
  const acts = w.log.filter(a => a.t === 'pol' && a.key === key);
  let lv = 0, i = 0;
  return w.timeline.map((_, d) => { while (i < acts.length && acts[i].day <= d) lv = acts[i++].v; return lv; });
}
const avgFrac = (w, key) => {
  const s = levelSeries(w, key), mx = key === 'bed' ? 3 : policyMaxLevel(key);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length / mx : 0;
};

function strategyAnalysis(w, res) {
  const n = w.timeline.length || 1;
  const early = key => { const s = levelSeries(w, key).slice(0, 60); return s.length ? s.filter(v => v > 0).length / s.length : 0; };
  const evs = w.decisions.map(d => EVENTS.find(e => e.id === d.id)).filter(Boolean).map((e, i) => e.choices[w.decisions[i].i]);
  const tagsOf = ch => eventTags(ch);
  const resp = evs.length ? evs.filter(ch => tagsOf(ch).some(t => t.good && (t.name === '감염 위험' || t.name === '의료체계'))).length / evs.length : 0.5;
  const gambles = evs.filter(ch => ch.risk).length;
  const mit = (avgFrac(w, 'mask') + avgFrac(w, 'dist') + avgFrac(w, 'school')) / 3;
  const prep = (early('test') + early('bed') + (levelSeries(w, 'bed').slice(-1)[0] > 0 ? 1 : 0)) / 3;
  const recov = (avgFrac(w, 'support') * 2 + (evs.length ? evs.filter(ch => tagsOf(ch).some(t => t.good && (t.name === '경제' || t.name === '형평성'))).length / evs.length : 0.5)) / 3;
  const score = {
    mitigation: Math.min(100, mit * 160),
    preparedness: prep * 100,
    response: resp * 100,
    recovery: Math.min(100, recov * 130),
    risk: Math.max(0, 100 - gambles * 25 - (w.budgetOutDay !== null ? 30 : 0)) * 0.6 + 40 * Math.min(1, w.budget / (BUDGET * 0.3)),
    vulnerability: w.equity,
    resilience: res.metrics[2].value,
    tradeoff: Math.max(0, 100 - 2.5 * Math.sqrt(res.metrics.reduce((s, m) => s + (m.value - res.total) ** 2, 0) / res.metrics.length)),
  };
  const order = Object.keys(score).sort((a, b) => score[b] - score[a]);
  return { score, best: order[0], worst: order[order.length - 1], order };
}

const STRATEGY_STYLE = {
  mitigation: '강한 방역 중심형: 감염 자체를 낮추는 데 힘을 실었습니다.',
  preparedness: '선제 대비형: 위기 전에 검사·병상 같은 역량을 갖추는 데 투자했습니다.',
  response: '현장 대응형: 터진 위기마다 감염과 의료 부담을 줄이는 쪽으로 결정했습니다.',
  recovery: '회복 중시형: 경제와 생계, 형평성을 지키는 쪽으로 무게를 뒀습니다.',
  risk: '신중한 위험 관리형: 도박을 피하고 예산 여유를 남겼습니다.',
  vulnerability: '취약계층 보호형: 형평성을 지키는 데 신경 썼습니다.',
  resilience: '체계 안정형: 의료체계가 버티는 힘을 지켰습니다.',
  tradeoff: '균형형: 한쪽에 치우치지 않고 여러 가치를 함께 지켰습니다.',
};
const STRATEGY_GAP = {
  mitigation: '방역 강도가 낮았습니다. 거리두기·마스크·학교 제한을 더 적극적으로 쓸 여지가 있었습니다.',
  preparedness: '대비가 늦었습니다. 위기 전에 검사 강화와 병상 확충에 먼저 투자해 보세요.',
  response: '이벤트에서 감염·의료 부담을 줄이는 선택이 적었습니다.',
  recovery: '경제 지원과 회복 정책이 부족했습니다.',
  risk: '위험한 선택을 자주 했거나 예산 여유가 없었습니다.',
  vulnerability: '형평성이 낮았습니다. 지원과 취약계층 보호 정책이 필요했습니다.',
  resilience: '의료체계가 흔들렸습니다. 병상과 의료인력을 더 일찍 지켜야 했습니다.',
  tradeoff: '결과가 한쪽에 치우쳤습니다. 지표 사이의 균형을 맞춰 보세요.',
};

function strategyHtml(w, res) {
  const a = strategyAnalysis(w, res);
  const bars = a.order.map(k => {
    const v = Math.round(a.score[k]), col = v >= 60 ? '#86efac' : v >= 40 ? '#fde68a' : '#f87171';
    return `<div class="metric"><div class="metric-head"><b>${CONCEPTS[k].icon} ${CONCEPTS[k].name}</b><span style="color:${col}">${v}점</span></div><div class="bar"><i style="width:${v}%;background:${col}"></i></div><div class="metric-note">${CONCEPTS[k].short}</div></div>`;
  }).join('');
  return `<h3>🎓 나의 재난관리 전략 분석</h3>
    <p><b>${esc(STRATEGY_STYLE[a.best])}</b></p><p class="hint">개선할 점: ${esc(STRATEGY_GAP[a.worst])}</p>${bars}
    <p class="hint">점수는 내 정책 사용 기록과 이벤트 결정을 바탕으로 게임이 가정한 기준으로 계산한 학습용 지표입니다.</p>`;
}
