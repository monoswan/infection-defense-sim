// records.js — 게임 결과 저장(localStorage)과 국가별 기록 비교 화면
// 비교는 두 가지로 구분한다: ① 동일 조건 비교(같은 나라의 여러 판, 점수를 직접 비교 가능)
//                           ② 실제 국가 시나리오 비교(나라마다 초기조건이 달라 점수를 단순 비교하면 안 되므로 '정책 없음' 대비 상대 효과로 본다)

const REC_KEY = 'ftc-covid-records-v1';
let recTab = 'same', recCountry = null;

function loadRecords() {
  try { return JSON.parse(localStorage.getItem(REC_KEY) || '[]'); } catch (e) { return []; }
}
function writeRecords(list) {
  try { localStorage.setItem(REC_KEY, JSON.stringify(list.slice(-60))); } catch (e) { /* 저장 공간이 없으면 무시 */ }
}

// 한 판의 결과를 저장한다 (게임이 끝났을 때 한 번)
function saveRecord(w, res, missions, achievements) {
  const strat = strategyAnalysis(w, res);
  const b = res.base;
  const rec = {
    id: w.seed >>> 0, ts: Date.now(), country: SCN.id, days: w.st.day,
    total: res.total, ending: res.ending.title, collapse: res.collapse,
    metrics: res.metrics.map(m => Math.round(m.value)),
    cum100k: per100k(w.st.cumInf), dead100k: per100k(w.st.D), overflowDays: w.overflowDays,
    econ: w.econ, trust: w.trust, equity: w.equity, satisfaction: satisfactionOf(w), spent: BUDGET - w.budget,
    base: { cum100k: per100k(b.st.cumInf), dead100k: per100k(b.st.D) },
    strategy: strat.best, missionsOk: missions.filter(m => m.ok).length, missionsAll: missions.length,
    achievements: achievements.map(a => a.id),
  };
  const list = loadRecords().filter(r => r.id !== rec.id);   // 같은 판을 두 번 저장하지 않는다
  list.push(rec);
  writeRecords(list);
  return rec;
}

const fmtTs = ts => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const cname = id => { const c = COUNTRY_BY_ID[id]; return c ? `${c.flag} ${c.name}` : id; };

function sameTabHtml(list) {
  const countries = [...new Set(list.map(r => r.country))];
  if (!countries.length) return '';
  if (!countries.includes(recCountry)) recCountry = countries[0];
  const sel = `<div class="seg learn-seg">${countries.map(id => `<button data-rc="${id}" class="${id === recCountry ? 'on' : ''}">${cname(id)} (${list.filter(r => r.country === id).length}판)</button>`).join('')}</div>`;
  const runs = list.filter(r => r.country === recCountry).sort((a, b) => b.total - a.total);
  const rows = runs.map((r, i) => `<tr class="${i === 0 ? 'best' : ''}"><td>${i === 0 ? '🏅' : i + 1}</td><td>${fmtTs(r.ts)}</td><td><b>${r.total}</b></td><td>${esc(r.ending)}</td>
    <td>${r.cum100k.toFixed(0)}</td><td>${r.dead100k.toFixed(1)}</td><td>${r.overflowDays}일</td><td>${r.econ.toFixed(0)}</td><td>${Math.round(r.trust)}</td><td>${Math.round(r.equity)}</td><td>${esc(CONCEPTS[r.strategy].name.split(' ')[0])}</td></tr>`).join('');
  return `${sel}<p class="summary">같은 나라(${cname(recCountry)})는 인구와 초기조건이 같으므로 <b>총점을 직접 비교할 수 있습니다.</b> 다만 이벤트 일정과 난수 시드는 판마다 다를 수 있습니다.</p>
    <div class="table-wrap"><table><thead><tr><th>순위</th><th>일시</th><th>종합</th><th>엔딩</th><th>감염(10만 명당)</th><th>사망(10만 명당)</th><th>병상 초과</th><th>경제</th><th>신뢰</th><th>형평성</th><th>전략</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function crossTabHtml(list) {
  const best = COUNTRIES.map(c => list.filter(r => r.country === c.id).sort((a, b) => b.total - a.total)[0]).filter(Boolean);
  if (!best.length) return '';
  const rows = best.map(r => {
    const c = COUNTRY_BY_ID[r.country];
    const dI = r.base.cum100k - r.cum100k, dD = r.base.dead100k - r.dead100k;
    const pctI = r.base.cum100k ? dI / r.base.cum100k * 100 : 0, pctD = r.base.dead100k ? dD / r.base.dead100k * 100 : 0;
    return `<tr><td>${cname(r.country)}</td><td>${(c.pop / 1e6).toFixed(1)}백만 · 65세+ ${c.aged65}%</td><td>${c.bedsPer100k}</td><td>${fmtNum(c.budget)}</td>
      <td>${r.cum100k.toFixed(0)}</td><td>${r.dead100k.toFixed(1)}</td><td>${r.base.cum100k.toFixed(0)} / ${r.base.dead100k.toFixed(1)}</td>
      <td class="good">${dI.toFixed(0)} (${pctI.toFixed(0)}%)</td><td class="good">${dD.toFixed(1)} (${pctD.toFixed(0)}%)</td></tr>`;
  }).join('');
  return `<p class="warn">⚠ 나라마다 인구·고령 비율·병상·예산·해외 유입 위험이 달라 <b>총점이나 감염자 수를 그대로 비교하면 안 됩니다.</b> 아래는 각 나라 시나리오에서의 <b>내 최고 기록</b>을 인구 10만 명당 지표로 보여 주고, 같은 나라의 '정책을 하나도 쓰지 않았을 때'(같은 이벤트 선택) 결과와 비교한 <b>정책 기여도</b>를 함께 보여 줍니다. 모두 게임 가정에 따른 결과이며 실제 국가의 성적표가 아닙니다.</p>
    <div class="table-wrap"><table><thead><tr><th>나라</th><th>인구 · 고령 비율</th><th>병상/10만</th><th>예산</th><th>감염/10만 명</th><th>사망/10만 명</th><th>정책 없음 시 (감염 / 사망)</th><th>정책으로 줄인 감염</th><th>정책으로 줄인 사망</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function allTabHtml(list) {
  const rows = [...list].reverse().map(r => `<tr><td>${fmtTs(r.ts)}</td><td>${cname(r.country)}</td><td>${r.total}</td><td>${esc(r.ending)}</td><td>${r.missionsOk}/${r.missionsAll}</td><td>${r.achievements.length}개</td></tr>`).join('');
  const done = new Set(list.flatMap(r => r.achievements));
  const ach = ACHIEVEMENTS.map(a => `<span class="chip ${done.has(a.id) ? 'done' : 'locked'}" title="${esc(a.desc)}">${a.icon} ${esc(a.title)}</span>`).join(' ');
  return `<h3>🏆 업적 ${done.size}/${ACHIEVEMENTS.length}</h3><p>${ach}</p>
    <div class="table-wrap"><table><thead><tr><th>일시</th><th>나라</th><th>종합</th><th>엔딩</th><th>미션</th><th>업적</th></tr></thead><tbody>${rows}</tbody></table></div>
    <button id="rec-clear">기록 모두 삭제</button>`;
}

function renderRecords() {
  const list = loadRecords();
  document.getElementById('records-tabs').innerHTML = [['same', '동일 조건 비교'], ['cross', '실제 국가 시나리오 비교'], ['all', '기록·업적']]
    .map(([k, t]) => `<button data-rt="${k}" class="${k === recTab ? 'on' : ''}">${t}</button>`).join('');
  const body = document.getElementById('records-body');
  body.innerHTML = !list.length ? '<p class="hint">아직 저장된 기록이 없습니다. 게임을 끝까지 플레이하면 결과가 자동으로 저장됩니다.</p>'
    : recTab === 'same' ? sameTabHtml(list) : recTab === 'cross' ? crossTabHtml(list) : allTabHtml(list);
  const clr = document.getElementById('rec-clear');
  if (clr) clr.onclick = () => { if (confirm('저장된 기록을 모두 지울까요?')) { writeRecords([]); renderRecords(); } };
}

function openRecords(tab) {
  if (tab) recTab = tab;
  document.getElementById('records').classList.remove('hidden');
  renderRecords();
}

function buildRecords() {
  const close = () => document.getElementById('records').classList.add('hidden');
  document.getElementById('records-close').onclick = close;
  document.getElementById('records').onclick = e => { if (e.target.id === 'records') close(); };
  document.getElementById('records-tabs').onclick = e => { const b = e.target.closest('button[data-rt]'); if (b) { recTab = b.dataset.rt; renderRecords(); } };
  document.getElementById('records-body').onclick = e => { const b = e.target.closest('button[data-rc]'); if (b) { recCountry = b.dataset.rc; renderRecords(); } };
  document.getElementById('menu-records').onclick = () => openRecords();
}
