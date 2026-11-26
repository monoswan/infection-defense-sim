// result-ui.js — 최종 평가 화면: 엔딩, 성적표, 정책별 효과·비용 대비 효과, 의사결정 장단점, 실제 역사와의 구분 비교, 전략 분석, 미션·업적

function buildReasons(a) {
  const r = [];
  const infPct = (a.cumInf / POP) * 100, deathPct = (a.D / POP) * 100;
  if (game.overflowDays > 0) r.push(`중증 환자가 병상을 넘은 날이 ${game.overflowDays}일 있었습니다. 그동안 사망률이 2배였습니다.`);
  if (game.budgetOutDay !== null) r.push(`${game.budgetOutDay}일차에 예산이 바닥나 정책이 자동으로 꺼졌습니다.`);
  if (infPct >= 50) r.push(`인구의 ${infPct.toFixed(1)}%가 감염되었습니다. 집단 확산을 막지 못했습니다.`);
  else if (infPct >= 10) r.push(`인구의 ${infPct.toFixed(1)}%가 감염되었습니다. 확산을 늦췄지만 완전히 막지는 못했습니다.`);
  else r.push(`감염이 인구의 ${infPct.toFixed(1)}%에 머물렀습니다. 확산을 잘 막았습니다.`);
  if (deathPct >= 1) r.push(`사망자가 인구의 ${deathPct.toFixed(2)}%입니다. 1%를 넘으면 피해가 큽니다.`);
  return r;
}

function scoreCardHtml(w) {
  const st = w.st;
  const rows = [
    ['누적 확진자', `${fmtNum(st.cumInf)}명`, `10만 명당 ${fmtPer100k(st.cumInf)}명`],
    ['누적 사망자', `${fmtNum(st.D)}명`, `10만 명당 ${per100k(st.D).toFixed(1)}명`],
    ['병상 초과 기간', `${w.overflowDays}일`, `최고 병상 사용률 ${(Math.max(...w.hist.map(p => p.bedUse)) * 100).toFixed(0)}%`],
    ['경제적 피해', `경제지수 ${w.econ.toFixed(1)}`, `시작 대비 −${(ECON_START - w.econ).toFixed(1)}`],
    ['시민 만족도', satisfactionOf(w).toFixed(1), '신뢰·경제·형평성을 합친 체감 지표 (게임 가정)'],
    ['정부 신뢰도', Math.round(w.trust), `시작 ${SCN.trust}`],
    ['취약계층의 피해', `형평성 ${Math.round(w.equity)}`, `낮을수록 취약계층 피해가 큼 (시작 ${SCN.equity})`],
    ['예산', `${fmtNum(BUDGET - w.budget)}억 사용`, `남은 예산 ${fmtNum(w.budget)}억`],
  ];
  return `<h3>📋 ${COUNTRY_BY_ID[SCN.id].name} 위기관리 성적표</h3><div class="table-wrap"><table><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td class="hint">${r[2]}</td></tr>`).join('')}</tbody></table></div>`;
}

function policiesTableHtml(w) {
  const rows = [];
  for (const key of ALL_POLICIES) {
    const imp = policyImpact(key, w.st.day);
    if (!imp) continue;
    const days = levelSeries(w, key).filter(v => v > 0).length;
    const per = imp.cost > 0 ? imp.infectionsAverted / imp.cost * 100 : Infinity;   // 예산 100억당 줄인 감염자
    rows.push({ key, days, imp, per });
  }
  if (!rows.length) return '<p class="hint">이번 게임에서는 정책을 시행하지 않았습니다.</p>';
  const ranked = rows.filter(r => r.imp.infectionsAverted > 0).sort((a, b) => b.per - a.per);
  const best = ranked[0] && ranked[0].key;
  const worst = [...rows].sort((a, b) => a.per - b.per)[0].key;
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v));
  const body = rows.map(r => `<tr class="${r.key === best ? 'best' : ''}"><td>${POLICY_META[r.key].icon} ${esc(POLICY_META[r.key].name)} ${r.key === best ? '🏅 가장 성공적' : r.key === worst && rows.length > 1 ? '⚠ 개선 필요' : ''}</td>
    <td>${r.days}일</td><td>${fmtNum(r.imp.cost)}억</td><td>${sgn(r.imp.deathsAverted)}명</td><td>${sgn(r.imp.infectionsAverted)}명</td>
    <td>${r.imp.econGain >= 0 ? '+' : '−'}${Math.abs(r.imp.econGain).toFixed(1)}</td><td>${r.per === Infinity ? '비용 없음' : fmtNum(r.per) + '명'}</td></tr>`).join('');
  return `<p class="hint">각 정책만 뺐을 때(나머지 선택·이벤트·시드 동일) 달라지는 결과입니다. 게임 가정에 따른 반사실 계산이며 실제 정책의 효과가 입증된 것이 아닙니다. 정책끼리 효과가 겹치므로 합이 전체 효과와 같지는 않습니다.</p>
    <div class="table-wrap"><table><thead><tr><th>정책</th><th>시행 기간</th><th>지출</th><th>줄인 사망</th><th>줄인 감염</th><th>경제지수 영향</th><th>100억당 줄인 감염</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function decisionList(w) {
  if (!w.decisions.length) return '<p class="hint">이번 게임에서는 위기 이벤트가 발생하지 않았습니다.</p>';
  const chip = (ch, e) => eventTags(ch, e).map(t => `<span class="tag ${t.good ? 'good' : 'bad'}">${t.name} ${t.text}</span>`).join('');
  return '<ul class="declist">' + w.decisions.map(d => {
    const e = EVENTS.find(x => x.id === d.id);
    if (!e) return '';
    const ch = e.choices[d.i];
    const others = e.choices.filter((_, k) => k !== d.i).map(o => `${esc(o.label)} ${chip(o, e)}`).join('<br>');
    return `<li>${d.day}일차 ${e.icon} <b>${esc(e.title)}</b> <small>${e.real ? '📜 실제 사건' : '🎭 가상 시나리오'}</small><br>
      선택 → <b>${esc(ch.label)}</b> ${chip(ch, e)}${d.bad ? `<br><span class="bad-note">⚠ 위험이 현실이 됨: ${esc(d.bad)}</span>` : ''}
      <details><summary>다른 선택지와 비교</summary><small>${others}</small></details></li>`;
  }).join('') + '</ul>';
}

// 실제 역사의 정책 vs 내 선택: 수치 비교는 하지 않고 어떤 정책을 썼는지만 대비한다
function historyVsHtml(w) {
  const rows = ALL_POLICIES.map(key => {
    const real = HISTORY.filter(h => h.country === SCN.id && h.policy === key);
    const days = levelSeries(w, key).filter(v => v > 0).length;
    return `<tr><td>${POLICY_META[key].icon} ${esc(POLICY_META[key].name)}</td>
      <td>${real.length ? real.map(h => `${h.type === 'law' ? '⚖' : '🛠'} ${esc(h.name)} <small>(${esc(h.when)})</small>`).join('<br>') : '<span class="hint">정리한 사례 없음</span>'}</td>
      <td>${days ? `${days}일 시행` : '시행 안 함'}</td></tr>`;
  }).join('');
  return `<div class="warn">실제 역사의 결과(감염·사망 수치)는 이 게임이 재현하지 않으며, 아래 시뮬레이션 결과와 직접 비교할 수 없습니다. 아래는 <b>어떤 정책을 썼는지</b>만 나란히 놓은 것입니다. 실제 사례의 날짜와 내용은 정책 관리의 공식 출처 링크로 확인하세요.</div>
    <div class="table-wrap"><table><thead><tr><th>정책</th><th>📖 실제 역사에서 시행한 사례 (사실)</th><th>🎮 내 선택 (시뮬레이션)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function missionsHtml(missions, ach) {
  const c = COUNTRY_BY_ID[SCN.id];
  return `<h3>🎯 ${c.name} 미션 ${missions.filter(m => m.ok).length}/${missions.length}</h3>
    <p class="hint">교육용 게임 목표이며 실제 국가의 대응에 대한 역사적 평가가 아닙니다. 목표: ${esc(c.goal.title)}</p>
    <ul>${missions.map(m => `<li>${m.ok ? '✅' : '❌'} <b>${esc(m.title)}</b> — ${esc(m.desc)} <small>(${esc(m.now)})</small></li>`).join('')}</ul>
    <h3>🏆 이번에 얻은 업적</h3><p>${ach.length ? ach.map(a => `<span class="chip done" title="${esc(a.desc)}">${a.icon} ${esc(a.title)}</span>`).join(' ') : '<span class="hint">이번에는 새 업적이 없습니다.</span>'}</p>`;
}

function showResult() {
  const w = game;
  const a = w.st;
  const res = calcResult(w);
  const missions = missionStatus(w);
  const ach = evaluateAchievements(w, res);
  saveRecord(w, res, missions, ach);
  const reasons = buildReasons(a).map(t => `<li>${esc(t)}</li>`).join('');
  const box = document.getElementById('result');
  box.innerHTML = `<div class="result-box">
      ${endingHtml(res)}
      <p class="hint">이 평가 기준(가중치)은 ${COUNTRY_BY_ID[SCN.id].name} 시나리오의 교육용 목표를 반영한 것입니다. 나라마다 다릅니다.</p>
      <h3>이유</h3><ul class="reasons">${reasons}</ul>
      ${scoreCardHtml(w)}
      ${missionsHtml(missions, ach)}
      <h3>🧾 시행한 정책 목록과 효과</h3>${policiesTableHtml(w)}
      <h3>🗳 주요 의사결정의 장단점</h3>${decisionList(w)}
      ${strategyHtml(w, res)}
      <h3>📖 실제 역사 vs 내 선택</h3>${historyVsHtml(w)}
      <div class="screen-actions wrap">
        <button id="btn-cmp-open" class="big alt">🔬 정책 효과 비교 (다른 선택을 했다면?)</button>
        <button id="btn-rec-open" class="big alt">📊 국가별 기록 비교</button>
        <button id="btn-quiz-open" class="big alt">❓ 학습 퀴즈</button>
        <button id="btn-restart" class="big">같은 국가로 다시 하기</button>
        <button id="btn-other" class="big alt">다른 국가 선택</button>
      </div></div>`;
  box.classList.remove('hidden');
  document.getElementById('btn-restart').onclick = restartGame;
  document.getElementById('btn-other').onclick = () => { game.ended = true; goToSelect(); };
  document.getElementById('btn-cmp-open').onclick = openCompare;
  document.getElementById('btn-rec-open').onclick = () => openRecords('same');
  document.getElementById('btn-quiz-open').onclick = () => openLearn('quiz');
  return res;
}
