// learn-ui.js — 재난관리 학습·실제 역사 화면: 개념 8개, 국가별 실제 법률·조치·사건, 퀴즈

let learnTab = 'concepts', learnCountry = 'kr', quizState = null;

function openLearn(tab) {
  if (tab) learnTab = tab;
  document.getElementById('learn').classList.remove('hidden');
  renderLearn();
}

function renderLearn() {
  const tabs = [['concepts', '🎓 재난관리 개념'], ['history', '📖 실제 역사'], ['quiz', '❓ 퀴즈']];
  document.getElementById('learn-tabs').innerHTML = tabs.map(([k, t]) => `<button data-tab="${k}" class="${k === learnTab ? 'on' : ''}">${t}</button>`).join('');
  const box = document.getElementById('learn-body');
  box.innerHTML = learnTab === 'concepts' ? conceptsHtml() : learnTab === 'history' ? historyTabHtml() : quizHtml();
  if (learnTab === 'quiz') bindQuiz();
}

function conceptsHtml() {
  return '<p class="hint">정책을 시행하거나 위기 이벤트에서 선택할 때마다 관련 개념이 대시보드에 나타납니다. 게임이 끝나면 내가 어떤 전략을 썼는지 분석해 줍니다.</p>' +
    Object.entries(CONCEPTS).map(([id, c]) => {
      const pols = Object.entries(POLICY_CONCEPT).filter(([, ids]) => ids.includes(id)).map(([k]) => `${POLICY_META[k].icon} ${POLICY_META[k].name}`);
      return `<article class="law-card"><h3>${c.icon} ${c.name}</h3><p>${c.short}</p>
        ${pols.length ? `<p class="hint">이 게임에서 이 개념과 연결되는 정책: ${pols.join(' · ')}</p>` : '<p class="hint">이 개념은 위기 이벤트의 선택(상충 관계·불확실성·취약계층 등)에서 주로 나타납니다.</p>'}</article>`;
    }).join('');
}

function historyTabHtml() {
  const cs = COUNTRIES.map(c => `<button data-hc="${c.id}" class="${c.id === learnCountry ? 'on' : ''}">${c.flag} ${c.name}</button>`).join('');
  const c = COUNTRY_BY_ID[learnCountry];
  const cases = HISTORY.filter(h => h.country === learnCountry);
  const law = cases.filter(h => h.type === 'law'), meas = cases.filter(h => h.type !== 'law');
  const evs = EVENTS.filter(e => e.country === learnCountry);
  const evHtml = evs.map(e => e.real
    ? `<li>📜 <b>${esc(e.title)}</b> — ${esc(e.real.when)}${e.real.source ? ` · <a href="${esc(e.real.source.url)}" target="_blank" rel="noopener noreferrer">${esc(e.real.source.label)}</a>` : ''}</li>`
    : `<li>🎭 <b>${esc(e.title)}</b> — 가상 시나리오</li>`).join('');
  return `<div class="seg learn-seg">${cs}</div>
    <p class="hint">${esc(c.history)}</p>
    <p class="warn">법률(권한과 절차의 틀)과, 법률에 근거해 시행한 구체적인 방역 조치는 다릅니다. 아래에서 구분해서 보세요. 날짜와 내용은 학습용 요약이니 공식 출처 링크로 확인하세요.</p>
    <h3>⚖ 법률 ${law.length}건</h3>${law.map(h => caseHtml(h)).join('') || '<p class="hint">없음</p>'}
    <h3>🛠 법률·지침에 근거한 방역 조치 ${meas.length}건</h3>${meas.map(h => caseHtml(h)).join('')}
    <h3>📜 게임에 나오는 이 나라의 사건</h3><ul>${evHtml}</ul>`;
}

function quizHtml() {
  if (!quizState) quizState = { qs: [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 5), i: 0, score: 0, answered: -1 };
  const s = quizState;
  if (s.i >= s.qs.length) {
    const best = Math.max(Number(localStorage.getItem('ftc-quiz-best') || 0), s.score);
    localStorage.setItem('ftc-quiz-best', best);
    return `<h3>퀴즈 결과: ${s.score} / ${s.qs.length}</h3><p>최고 점수 ${best}점</p><button id="quiz-again" class="big">다시 풀기</button>`;
  }
  const q = s.qs[s.i];
  const opts = q.o.map((t, k) => {
    const cls = s.answered < 0 ? '' : k === q.a ? 'right' : k === s.answered ? 'wrong' : '';
    return `<button class="choice qopt ${cls}" data-k="${k}" ${s.answered >= 0 ? 'disabled' : ''}>${esc(t)}</button>`;
  }).join('');
  return `<p class="hint">문제 ${s.i + 1} / ${s.qs.length} · 현재 ${s.score}점</p><h3>${esc(q.q)}</h3><div class="choices">${opts}</div>
    ${s.answered >= 0 ? `<p class="summary">${s.answered === q.a ? '✅ 정답! ' : '❌ 오답. '}${esc(q.e)}</p><button id="quiz-next" class="big">${s.i + 1 < s.qs.length ? '다음 문제' : '결과 보기'}</button>` : ''}`;
}

function bindQuiz() {
  const s = quizState;
  document.querySelectorAll('.qopt').forEach(b => { b.onclick = () => { s.answered = Number(b.dataset.k); if (s.answered === s.qs[s.i].a) s.score++; renderLearn(); }; });
  const nx = document.getElementById('quiz-next'); if (nx) nx.onclick = () => { s.i++; s.answered = -1; renderLearn(); };
  const ag = document.getElementById('quiz-again'); if (ag) ag.onclick = () => { quizState = null; renderLearn(); };
}

function buildLearn() {
  const close = () => document.getElementById('learn').classList.add('hidden');
  document.getElementById('learn-close').onclick = close;
  document.getElementById('learn').onclick = e => { if (e.target.id === 'learn') close(); };
  document.getElementById('learn-tabs').onclick = e => { const b = e.target.closest('button[data-tab]'); if (b) { learnTab = b.dataset.tab; renderLearn(); } };
  document.getElementById('learn-body').onclick = e => { const b = e.target.closest('button[data-hc]'); if (b) { learnCountry = b.dataset.hc; renderLearn(); } };
  document.getElementById('btn-learn').onclick = () => openLearn();
  document.getElementById('menu-learn').onclick = () => openLearn();
}
