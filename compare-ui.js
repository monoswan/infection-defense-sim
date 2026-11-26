// compare-ui.js — 정책 효과 비교 화면: 정책·대안 선택, 지표 표, 두 시나리오의 감염곡선 그래프(정책 선택 시점 표시)

const CMP_A = '#60a5fa', CMP_B = '#fb923c';
let cmp = { key: 'dist', mode: 'remove', days: 14, level: 1 };

const CMP_MODES = [
  ['remove', '이 정책을 시행하지 않았다면'],
  ['early', '일찍 시행했다면 (며칠 앞당김)'],
  ['late', '늦게 시행했다면 (며칠 늦춤)'],
  ['down', '한 단계 약하게 시행했다면'],
  ['up', '한 단계 강하게 시행했다면'],
  ['add', '처음부터(0일차) 이 단계로 시행했다면'],
];

function cmpUsedKeys() {
  return ALL_POLICIES.filter(k => game.log.some(a => isPolicyAction(a, k)));
}

function openCompare() {
  if (game.st.day < 1) return notify('게임을 며칠 진행한 뒤에 비교할 수 있습니다.');
  const used = cmpUsedKeys();
  if (!used.includes(cmp.key)) cmp.key = used[0] || cmp.key;
  document.getElementById('compare').classList.remove('hidden');
  renderCompare();
}

function cmpSpec() {
  const { key, mode } = cmp;
  if (mode === 'remove') return { mode: 'remove', key };
  if (mode === 'early') return { mode: 'shift', key, days: -cmp.days };
  if (mode === 'late') return { mode: 'shift', key, days: cmp.days };
  if (mode === 'down') return { mode: 'level', key, delta: -1 };
  if (mode === 'up') return { mode: 'level', key, delta: 1 };
  return { mode: 'add', key, level: cmp.level };
}

function cmpDescribe(spec) {
  const n = POLICY_META[spec.key].name;
  if (spec.mode === 'remove') return `${n}을(를) 시행하지 않았다면`;
  if (spec.mode === 'shift') return `${n}을(를) ${Math.abs(spec.days)}일 ${spec.days < 0 ? '일찍' : '늦게'} 시행했다면`;
  if (spec.mode === 'level') return `${n}을(를) 한 단계 ${spec.delta < 0 ? '약하게' : '강하게'} 시행했다면`;
  return `${n}을(를) 처음부터 ${spec.key === 'bed' ? '1단계 확충' : levelNames(spec.key)[spec.level]} 단계로 시행했다면`;
}

function renderCompare() {
  const used = cmpUsedKeys();
  const box = document.getElementById('compare-box');
  const keyOpts = ALL_POLICIES.map(k => `<option value="${k}" ${k === cmp.key ? 'selected' : ''}>${POLICY_META[k].icon} ${POLICY_META[k].name}${used.includes(k) ? ' ✔ 사용함' : ''}</option>`).join('');
  const modes = CMP_MODES.filter(([m]) => !(cmp.key === 'bed' && (m === 'down' || m === 'up')));
  if (!modes.some(([m]) => m === cmp.mode)) cmp.mode = 'remove';
  const modeOpts = modes.map(([m, t]) => `<option value="${m}" ${m === cmp.mode ? 'selected' : ''}>${t}</option>`).join('');
  const lvOpts = levelNames(cmp.key).map((n, i) => i ? `<option value="${i}" ${i === cmp.level ? 'selected' : ''}>${esc(n)}</option>` : '').join('');
  const param = cmp.mode === 'early' || cmp.mode === 'late'
    ? `<label>며칠 <input type="number" id="cmp-days" min="1" max="90" value="${cmp.days}"></label>`
    : cmp.mode === 'add' && cmp.key !== 'bed' ? `<label>단계 <select id="cmp-level">${lvOpts}</select></label>` : '';
  box.innerHTML = `<div class="laws-head"><h2>🔬 정책 효과 비교 (반사실 시뮬레이션)</h2><button id="cmp-close">닫기 ✕</button></div>
    <p class="warn">⚠ 같은 국가·같은 초기조건·같은 난수(이벤트 일정과 선택, 도박 결과 고정)에서 <b>정책 선택만 바꿔 다시 계산</b>한 가상 시나리오입니다. 실제 역사에서 일어나지 않은 상황이며, 게임이 가정한 효과 수치로 계산했으므로 <b>실제 정책의 효과가 입증된 것이 아닙니다.</b></p>
    <div class="cmp-controls"><label>정책 <select id="cmp-key">${keyOpts}</select></label>
      <label>만약 <select id="cmp-mode">${modeOpts}</select></label>${param}
      <button id="cmp-run" class="big">비교 실행</button></div>
    <p class="hint">${SCN.unlock ? '실제 역사에서 시행할 수 없던 시점(백신 승인 전 등)으로는 앞당길 수 없어, 그 경우 해당 행동은 무시됩니다. ' : ''}비교 구간: 0~${game.st.day}일차 (같은 시드 ${game.seed >>> 0})</p>
    <div id="cmp-result"></div>`;
  box.querySelector('#cmp-close').onclick = () => document.getElementById('compare').classList.add('hidden');
  box.querySelector('#cmp-key').onchange = e => { cmp.key = e.target.value; cmp.level = 1; renderCompare(); };
  box.querySelector('#cmp-mode').onchange = e => { cmp.mode = e.target.value; renderCompare(); };
  const d = box.querySelector('#cmp-days'); if (d) d.onchange = e => { cmp.days = clamp(Number(e.target.value) || 14, 1, 90); };
  const l = box.querySelector('#cmp-level'); if (l) l.onchange = e => { cmp.level = Number(e.target.value); };
  box.querySelector('#cmp-run').onclick = runCompare;
  runCompare();
}

function runCompare() {
  const spec = cmpSpec();
  const res = compareRun(spec);
  const a = summarizeWorld(res.A), b = summarizeWorld(res.B);
  const same = JSON.stringify(res.logA) === JSON.stringify(res.logB);
  const rows = COMPARE_ROWS.map(r => {
    const d = b[r.k] - a[r.k];
    const good = Math.abs(d) < 1e-9 ? '' : ((d > 0) === r.better ? 'good' : 'bad');   // 대안이 더 좋으면 good
    const sign = d > 0 ? '+' : d < 0 ? '−' : '';
    return `<tr><td>${r.label}</td><td>${r.fmt(a[r.k])}</td><td>${r.fmt(b[r.k])}</td><td class="${good}">${sign}${r.fmt(Math.abs(d))}</td></tr>`;
  }).join('');
  const dd = b.dead - a.dead, di = b.cum - a.cum, de = b.econ - a.econ;
  const word = v => (v > 0 ? '더 많았' : '더 적었');
  const summary = same ? '이 정책은 사용한 기록이 없어 두 시나리오가 같습니다. "처음부터 시행했다면"으로 비교해 보세요.'
    : `이 가정에서는 누적 사망자가 ${fmtNum(Math.abs(dd))}명 ${word(dd)}고, 누적 확진자는 ${fmtNum(Math.abs(di))}명 ${word(di)}으며, 경제지수는 ${Math.abs(de).toFixed(1)}포인트 ${de > 0 ? '높았' : '낮았'}습니다. (게임 가정에 따른 결과)`;
  const sel = (log, k) => log.filter(x => isPolicyAction(x, k) && x.t !== 'ev').map(x => x.day);
  document.getElementById('cmp-result').innerHTML = `
    <p class="legend"><i style="background:${CMP_A}"></i> <b>실제 내 선택</b> &nbsp; <i style="background:${CMP_B}"></i> <b>가정: ${esc(cmpDescribe(spec))}</b></p>
    <p class="summary">${summary}</p>
    <canvas id="cmp-main" class="cmp-canvas main"></canvas>
    <p class="hint">점선은 이 정책을 선택·변경한 날입니다 (파랑: 실제, 주황: 가정).</p>
    <div class="cmp-grid">${['cum', 'dead', 'bed', 'econ', 'budget', 'trust', 'equity'].map(k => `<canvas id="cmp-${k}" class="cmp-canvas"></canvas>`).join('')}</div>
    <div class="table-wrap"><table><thead><tr><th>지표</th><th>실제 내 선택</th><th>가정 시나리오</th><th>차이 (가정−실제)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const mA = sel(res.logA, spec.key), mB = sel(res.logB, spec.key);
  const S = (w, f) => w.hist.map(f);
  const draw = (id, title, f, fmt, h, zero = true) => drawCompareChart(document.getElementById(id), title, S(res.A, f), S(res.B, f), id === 'cmp-main' ? mA : [], id === 'cmp-main' ? mB : [], fmt, h, zero);
  draw('cmp-main', '일별 신규 감염자 (감염곡선)', p => p.newInf, fmtNum, 240);
  draw('cmp-cum', '누적 확진자', p => p.cum, fmtNum, 130);
  draw('cmp-dead', '누적 사망자', p => p.dead, fmtNum, 130);
  draw('cmp-bed', '병상 사용률(%)', p => p.bedUse * 100, v => (v < 10 ? v.toFixed(1) : Math.round(v)) + '%', 130);
  draw('cmp-econ', '경제지수', p => p.econ, v => v.toFixed(0), 130, false);
  draw('cmp-budget', '정부 예산(억)', p => p.budget, fmtNum, 130, false);
  draw('cmp-trust', '시민 만족도(신뢰)', p => p.trust, v => v.toFixed(0), 130, false);
  draw('cmp-equity', '사회적 형평성', p => p.equity, v => v.toFixed(0), 130, false);
  return res;
}

// 두 시나리오의 선 그래프 (Canvas 2D)
function drawCompareChart(cv, title, A, B, mkA, mkB, fmt, h, zero = true) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 300;
  cv.width = W * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, W, h);
  const L = 50, R = 10, T = 24, Bt = 20, pw = W - L - R, ph = h - T - Bt;
  const all = A.concat(B), n = Math.max(A.length, B.length, 2);
  let lo = zero ? Math.min(...all, 0) : Math.min(...all), hi = Math.max(...all);
  if (!zero) lo -= (hi - lo) * 0.05 + 0.5;
  if (hi - lo < 1e-9) hi = lo + 1;
  hi += (hi - lo) * 0.05;
  const X = i => L + (i / (n - 1)) * pw, Y = v => T + ph - ((v - lo) / (hi - lo)) * ph;
  ctx.font = '11px "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'left'; ctx.fillText(title, L, 14);
  ctx.strokeStyle = '#334155'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const v = lo + (hi - lo) * g / 3, y = Y(v);
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
    ctx.fillText(fmt(v), L - 4, y + 4);
  }
  ctx.textAlign = 'center';
  [0, Math.round((n - 1) / 2), n - 1].forEach(i => ctx.fillText(i + '일', X(i), h - 5));
  const line = (arr, color) => { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); arr.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke(); };
  line(B, CMP_B); line(A, CMP_A);
  const marks = (days, color) => { ctx.strokeStyle = color; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; days.forEach(d => { ctx.beginPath(); ctx.moveTo(X(d), T); ctx.lineTo(X(d), T + ph); ctx.stroke(); }); ctx.setLineDash([]); };
  marks(mkB, CMP_B); marks(mkA, CMP_A);
}

function buildCompare() {
  document.getElementById('btn-compare').onclick = openCompare;
  document.getElementById('compare').onclick = e => { if (e.target.id === 'compare') e.target.classList.add('hidden'); };
}
