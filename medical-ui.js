// medical-ui.js — 의료자원 관리 화면: 병상 사용률, 의료인력 상태, 14일 예측, 병상 확충·의료인력 지원

// 지금 정책을 그대로 유지한다고 가정하고 앞으로 14일의 중증 환자 수를 미리 계산한다 (이벤트·새 정책 선택은 반영하지 않음)
function forecastBeds(days = 14) {
  let st = game.st;
  const set = { ...game.set };
  const cap = bedCapacity(set);
  let peak = st.I2, overDay = null;
  for (let d = 1; d <= days; d++) {
    st = stepDay(st, set);
    peak = Math.max(peak, st.I2);
    if (overDay === null && st.I2 > cap) overDay = d;
  }
  return { peak, overDay, cap };
}

function barHtml(v, color) {
  return `<div class="bar"><i style="width:${Math.round(clamp(v, 0, 100))}%;background:${color}"></i></div>`;
}

function renderMedical() {
  if (document.getElementById('medical').classList.contains('hidden')) return;
  const set = game.set, cap = bedCapacity(set), st = game.st;
  const use = st.I2 / cap * 100, f = forecastBeds();
  const lm = lawOf(set);
  const useCol = use < 70 ? '#86efac' : use < 100 ? '#fde68a' : '#f87171';
  const medCol = game.med >= 60 ? '#86efac' : game.med >= 40 ? '#fde68a' : '#f87171';
  const bedCost = bedUpgradeCost(set.bed);
  const warn = f.overDay !== null ? `<p class="warn">⚠ 지금 정책이 계속되면 약 ${f.overDay}일 뒤 중증 환자(${fmtNum(f.peak)}명)가 병상(${fmtNum(f.cap)}개)을 넘을 것으로 예상됩니다. (현재 정책 유지 가정의 추정)</p>`
    : `<p class="summary">앞으로 14일 동안은 병상이 버틸 것으로 예상됩니다 (중증 최대 ${fmtNum(f.peak)}명 / 병상 ${fmtNum(f.cap)}개, 현재 정책 유지 가정).</p>`;
  document.getElementById('medical-body').innerHTML = `
    ${warn}
    <div class="metric"><div class="metric-head"><b>🛏 병상 사용률</b><span style="color:${useCol}">${use.toFixed(1)}% (중증 ${fmtNum(st.I2)} / 병상 ${fmtNum(cap)})</span></div>${barHtml(use, useCol)}
      <div class="metric-note">기본 병상 ${fmtNum(BASE_BEDS)}개 + 확충 ${set.bed}단계(+${fmtNum(BED_STEP * set.bed)}개) ${lm.beds ? `+ 이벤트 효과 ${lm.beds > 0 ? '+' : ''}${fmtNum(lm.beds)}개` : ''} × 의료인력 반영 ${Math.round(lm.bedMul * 100)}%</div></div>
    <div class="metric"><div class="metric-head"><b>🩺 의료인력 상태</b><span style="color:${medCol}">${Math.round(game.med)} / 100</span></div>${barHtml(game.med, medCol)}
      <div class="metric-note">병상이 넘치면 의료진이 소진되어 떨어지고, 안정되면 조금씩 회복됩니다. 상태가 나쁘면 병상을 다 쓰지 못합니다 (쓸 수 있는 병상 ${Math.round(lm.bedMul * 100)}%).</div></div>
    <canvas id="med-chart" class="cmp-canvas"></canvas>
    <div class="cmp-controls">
      <button id="med-bed" class="big" ${bedCost === null || game.ended ? 'disabled' : ''}>${bedCost === null ? '병상 확충 완료' : `병상 확충 (${bedCost}억 원, +${fmtNum(BED_STEP)}개)`}</button>
      <button id="med-staff" class="big" ${game.staffBought >= STAFF_MAX || game.ended ? 'disabled' : ''}>의료인력 지원 (${STAFF_COST}억 원, 의료 상태 +${STAFF_GAIN}) · ${game.staffBought}/${STAFF_MAX}회</button>
    </div>
    <p class="hint">남은 예산 ${fmtNum(game.budget)}억 원. 병상은 위기 전에 미리 늘려야 하고(Preparedness), 의료인력이 버텨야 체계가 무너지지 않습니다(Resilience). 효과 수치는 게임 가정입니다.</p>`;
  document.getElementById('med-bed').onclick = () => { buyBed(); };
  document.getElementById('med-staff').onclick = () => {
    const r = applyAction(game, { t: 'staff' });
    if (r.msg) notify(r.msg);
    if (r.ok) setConceptCard(`${CONCEPTS.resilience.icon} <b>${CONCEPTS.resilience.name}</b> — ${CONCEPTS.resilience.short}. 의료인력에 투자해 병상이 실제로 쓰일 수 있게 만드는 선택입니다.`);
    renderAll();
  };
  const hist = game.hist.slice(-60);
  drawCompareChart(document.getElementById('med-chart'), '병상 사용률(%) — 최근 60일', hist.map(p => p.bedUse * 100), [], [], [], v => Math.round(v) + '%', 130);
}

function buildMedical() {
  const close = () => document.getElementById('medical').classList.add('hidden');
  document.getElementById('btn-medical').onclick = () => { document.getElementById('medical').classList.remove('hidden'); renderMedical(); };
  document.getElementById('medical-close').onclick = close;
  document.getElementById('medical').onclick = e => { if (e.target.id === 'medical') close(); };
}
