// policy-ui.js — 정책 관리 화면: 공통 정책 9개 카드(단계 선택·효과·비용·지연·잠금), 실제 역사 사례, 현재 시행 중인 정책 목록
// 효과 수치는 모두 게임 가정이다. 실제 법률·조치 사례(history-*.js)는 사실 설명이며 효과 수치와 분리해서 보여 준다.

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const POLICY_META = {
  mask: { name: '마스크 착용 권고·의무화', icon: '😷', side: '의무화는 단속 부담과 반발이 따르고, 경제 부담이 조금 있습니다.' },
  dist: { name: '사회적 거리두기', icon: '🚶', side: '경제 활동이 줄고, 오래 유지하면 시민 피로와 취약계층 부담이 커집니다.' },
  school: { name: '학교·다중이용시설 운영 제한', icon: '🏫', side: '교육 손실과 돌봄 부담이 생겨 형평성과 신뢰가 떨어집니다.' },
  test: { name: '검사 및 접촉자 추적 강화', icon: '🧪', side: '비용이 크고, 대규모 추적은 사생활 우려로 신뢰가 조금 떨어집니다.' },
  isolate: { name: '확진자 격리 및 치료', icon: '🛌', side: '격리 대상의 생계 부담이 생깁니다. 경제 지원이 없으면 형평성이 더 떨어집니다.' },
  bed: { name: '병상 및 의료인력 확충', icon: '🛏', side: '비용이 크고, 의료인력 상태가 나쁘면 병상을 다 쓰지 못합니다.' },
  border: { name: '국경 통제와 입국자 관리', icon: '🛂', side: '교역·관광이 타격을 받고, 이미 퍼진 지역 감염에는 효과가 제한적입니다.' },
  support: { name: '경제적 피해 지원', icon: '💶', side: '재정이 크게 들고 감염을 직접 줄이지는 않습니다(접촉 감소는 약간).' },
  vax: { name: '백신 확보 및 접종', icon: '💉', side: '승인 직후에는 공급이 적고, 접종 격차와 거부 문제가 따를 수 있습니다.' },
};

const SETUP_COST = { mask: [0, 0, 0], dist: [0, 0, 0, 0], vax: [0, 0, 0, 0] };
const DAILY_OF = { mask: MASK_COST, dist: DIST_COST, vax: VAX_COST };

function polChangeText(key, v, pay) {
  const def = POLICY_FX[key];
  const d = def.delay + SCN.lawDelay;
  return `${POLICY_META[key].name}: ${def.levels[v]} · 시행 비용 ${pay}억, 하루 ${def.daily[v]}억` + (v > 0 ? ` · 효과는 ${d}일 뒤부터` : '');
}

// 단계 이름·효과·비용을 정책별로 모은다 (국가 조건이 반영된 값)
function levelNames(key) {
  if (key === 'bed') return ['확충 안 함', '1단계', '2단계', '3단계'];
  return key === 'mask' ? LEVEL_NAMES.mask : key === 'dist' ? LEVEL_NAMES.dist : key === 'vax' ? LEVEL_NAMES.vax : POLICY_FX[key].levels;
}

function effectText(key, v) {
  if (v === 0) return '효과 없음';
  if (key === 'mask') return `전파력 −${Math.round(maskEff(v) * 100)}%`;
  if (key === 'dist') return `접촉 ${dailyContacts({ dist: v, lawMod: null }).toFixed(1)}명/일, 전파력 −${Math.round(distEff(v) * 100)}%`;
  if (key === 'vax') return `하루 접종 ${(VAX_RATE[v] * 100).toFixed(2)}% (승인 후 45일에 걸쳐 공급이 늘어남)`;
  const f = POLICY_FX[key].fx[v], t = [];
  if (f.contact) t.push(`접촉 −${Math.round(Math.min(0.9, f.contact * SCN.lawEff) * 100)}%`);
  if (f.detect) t.push(`발견·격리율 +${Math.round(f.detect * (key === 'test' ? SCN.testMul : 1) * 100)}%p`);
  if (f.impCut) t.push(`해외 유입 −${Math.round(Math.min(0.95, f.impCut * SCN.borderMul) * 100)}%`);
  if (f.fatal) t.push(`중증 사망 −${Math.round((1 - f.fatal) * 100)}%`);
  if (f.sever) t.push(`중증화 −${Math.round((1 - f.sever) * 100)}%`);
  const e = f.econ || 0;
  if (e) t.push(`경제 ${e > 0 ? '+' : '−'}${Math.abs(e * (e < 0 ? SCN.econFragility : key === 'support' ? SCN.supportMul : 1)).toFixed(3)}/일`);
  if (f.equity) t.push(`형평성 ${f.equity > 0 ? '+' : '−'}${Math.abs(f.equity)}/일`);
  if (f.trust) t.push(`신뢰 ${f.trust > 0 ? '+' : '−'}${Math.abs(f.trust)}/일`);
  return t.join(', ');
}

function costText(key, v) {
  if (key === 'bed') return `확충 80/100/120억(단계 도달 시 1회) + 단계당 하루 0.5억`;
  const daily = key in DAILY_OF ? DAILY_OF[key][v] : POLICY_FX[key].daily[v];
  const setup = key in DAILY_OF ? 0 : POLICY_FX[key].setup[v];
  return `${setup ? '시행 ' + setup + '억 + ' : ''}하루 ${daily}억`;
}

function delayText(key) {
  return NEW_POLICIES.includes(key) ? `${POLICY_FX[key].delay + SCN.lawDelay}일 (기본 ${POLICY_FX[key].delay}일 + 이 나라의 행정 지연 ${SCN.lawDelay}일)` : '다음 날부터 적용';
}

function caseHtml(c, compact) {
  const type = c.type === 'law' ? '<span class="ctype law">법률</span>' : '<span class="ctype measure">방역 조치</span>';
  if (compact) {
    const cc = COUNTRY_BY_ID[c.country];
    return `<li>${cc.flag} ${type} ${esc(c.name)} <small>(${esc(c.when)})</small></li>`;
  }
  return `<div class="hcase"><p>${type} <b>${esc(c.name)}</b></p>
    <p><b>시행 시기:</b> ${esc(c.when)}${c.basisLaw ? ` · <b>근거 법률:</b> ${esc(c.basisLaw)}` : ''}</p>
    <p><b>목적:</b> ${esc(c.purpose)}</p>
    <ul>${c.content.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <p><b>한계·부작용:</b> ${esc(c.limits)}</p>
    <p class="src"><b>공식 출처:</b> <a href="${esc(c.source.url)}" target="_blank" rel="noopener noreferrer">${esc(c.source.label)}</a></p></div>`;
}

function historyHtml(key) {
  const mine = HISTORY.filter(c => c.policy === key && c.country === SCN.id);
  const others = HISTORY.filter(c => c.policy === key && c.country !== SCN.id);
  const cc = COUNTRY_BY_ID[SCN.id];
  return `<details class="hist"><summary>📖 실제 역사 사례 보기 (${cc ? cc.name : ''} ${mine.length}건 · 다른 나라 ${others.length}건)</summary>
    <section class="fact"><h4>${cc ? cc.flag + ' ' + cc.name : ''}의 실제 사례 <small>사실 설명. 법률 자체와 법률에 근거한 방역 조치를 구분해 표시</small></h4>
      ${mine.length ? mine.map(c => caseHtml(c)).join('') : '<p class="hint">이 나라에서 이 정책과 직접 연결되는 사례는 따로 정리하지 않았습니다.</p>'}</section>
    ${others.length ? `<section class="other"><h4>다른 나라의 사례 <small>참고용. 같은 정책이라도 이 나라의 행정·사회 조건에서는 비용과 효과가 달라집니다</small></h4><ul>${others.map(c => caseHtml(c, true)).join('')}</ul></section>` : ''}</details>`;
}

function policyCardHtml(key) {
  const meta = POLICY_META[key], names = levelNames(key), cur = polLevel(game, key);
  const day = game.st.day;
  let controls = '', lockMsg = '', pending = '';
  if (key === 'bed') {
    const cost = bedUpgradeCost(game.set.bed);
    controls = `<button data-key="bed" ${cost === null || game.ended ? 'disabled' : ''}>${cost === null ? '확충 완료 (최대)' : `병상 확충 (${cost}억 원)`}</button>`;
  } else {
    controls = '<div class="seg">' + names.map((n, i) => {
      const lock = policyLock(key, i, day);
      if (lock && i > cur) lockMsg = lock;
      const dis = game.ended || (key === 'dist' && game.auto) || !!lock;
      return `<button data-key="${key}" data-v="${i}" class="${i === cur ? 'on' : ''}" ${dis ? 'disabled' : ''} title="${esc(lock)}">${esc(n)}${i > 0 && !lock && !(key in DAILY_OF) ? ` (${POLICY_FX[key].setup[i]}억)` : ''}</button>`;
    }).join('') + '</div>';
    if (NEW_POLICIES.includes(key) && cur !== effLevel(key, game.pol[key], day)) {
      pending = `<p class="pending">⏳ 효과 대기 중: ${effLevel(key, game.pol[key], day) < cur ? '아직 이전 단계가 적용됩니다.' : ''} ${game.pol[key].since + POLICY_FX[key].delay + SCN.lawDelay - day}일 뒤 ${names[cur]} 효과가 시작됩니다.</p>`;
    }
  }
  const rows = key === 'bed'
    ? `<li>현재 병상 ${fmtNum(bedCapacity(game.set))}개 (기본 ${fmtNum(BASE_BEDS)}개, 확충 ${game.set.bed}/${BED_MAX}단계), 의료인력 상태 ${Math.round(game.med)} → 쓸 수 있는 병상 ${Math.round(lawOf(game.set).bedMul * 100)}%</li><li>확충 1단계 = +${fmtNum(BED_STEP)}개</li>`
    : names.slice(1).map((n, i) => `<li><b>${esc(n)}</b>: ${esc(effectText(key, i + 1))} · ${esc(costText(key, i + 1))}</li>`).join('');
  return `<article class="law-card policy-card ${cur > 0 ? 'active' : ''}">
    <h3>${meta.icon} ${esc(meta.name)} <span class="curlvl">${key === 'bed' ? `확충 ${cur}/${BED_MAX}` : esc(names[cur])}</span>${POLICY_CONCEPT[key].map(c => `<span class="concept-chip">${CONCEPTS[c].icon} ${CONCEPTS[c].name.split(' ')[0]}</span>`).join('')}</h3>
    ${controls}${lockMsg ? `<p class="lockmsg">🔒 ${esc(lockMsg)}</p>` : ''}${pending}
    <section class="assume"><h4>🎮 게임에서의 가정 <small>실제 효과 수치가 아님 · 이 나라의 조건이 반영된 값</small></h4>
      <ul>${rows}</ul><p><b>효과가 나타나기까지:</b> ${esc(delayText(key))}</p><p><b>부작용:</b> ${esc(meta.side)}</p></section>
    ${historyHtml(key)}</article>`;
}

function buildPolicyMenu() {
  document.getElementById('btn-laws').onclick = openPolicies;
  document.getElementById('btn-laws-close').onclick = closePolicies;
  document.getElementById('laws').onclick = e => { if (e.target.id === 'laws') closePolicies(); };
  document.getElementById('laws-list').onclick = e => {
    const b = e.target.closest('button[data-key]');
    if (!b || b.disabled) return;
    const key = b.dataset.key, v = Number(b.dataset.v);
    if (key === 'bed') buyBed();
    else if (NEW_POLICIES.includes(key)) setNewPolicy(key, v);
    else setPolicy(key, v);
  };
  renderPolicies();
}
const openPolicies = () => { document.getElementById('laws').classList.remove('hidden'); renderPolicies(); };
const closePolicies = () => document.getElementById('laws').classList.add('hidden');

function setNewPolicy(key, v) {
  if (game.ended) return;
  const r = applyAction(game, { t: 'pol', key, v });
  if (r.msg) notify(r.msg);
  if (r.ok && typeof policyConcept === 'function') policyConcept(key, v);
  renderAll();
}

// 현재 시행 중인 정책 목록 (대시보드)
function activePolicyList() {
  const out = [];
  for (const key of ALL_POLICIES) {
    const lv = polLevel(game, key);
    if (key === 'dist' && game.auto) { out.push(`${POLICY_META.dist.icon} 거리두기 자동(${LEVEL_NAMES.dist[game.set.dist]})`); continue; }
    if (lv > 0) out.push(`${POLICY_META[key].icon} ${key === 'bed' ? '병상 확충 ' + lv + '단계' : POLICY_META[key].name.split(' ')[0] + ' ' + levelNames(key)[lv]}`);
  }
  return out;
}

function renderPolicies() {
  const n = activePolicyList().length;
  const open = document.getElementById('btn-laws');
  open.textContent = n ? `📜 정책 관리 (${n}개 시행 중)` : '📜 정책 관리';
  open.classList.toggle('on', n > 0);
  const bar = document.getElementById('active-policies');
  const list = activePolicyList();
  bar.innerHTML = list.length ? '<b>시행 중:</b> ' + list.map(t => `<span class="chip pol">${esc(t)}</span>`).join('') : '<b>시행 중인 정책 없음</b> — 정책 관리에서 정책을 시행해 보세요.';
  if (document.getElementById('laws').classList.contains('hidden')) return;
  const c = COUNTRY_BY_ID[SCN.id];
  document.getElementById('laws-title').textContent = c ? `📜 ${c.flag} ${c.name} 정책 관리` : '📜 정책 관리';
  document.getElementById('laws-budget').textContent = `남은 예산 ${fmtNum(game.budget)}억 원 · 하루 비용 ${dailyCost(game.set).toFixed(1)}억 원 · ${game.st.day}일차`;
  const list2 = document.getElementById('laws-list');
  const top = list2.scrollTop;
  const openKeys = [...list2.querySelectorAll('details[open]')].map(d => d.closest('article').dataset.key);
  list2.innerHTML = ALL_POLICIES.map(k => policyCardHtml(k).replace('<article ', `<article data-key="${k}" `)).join('');
  list2.querySelectorAll('article').forEach(a => { if (openKeys.includes(a.dataset.key)) a.querySelector('details').open = true; });
  list2.scrollTop = top;
}
