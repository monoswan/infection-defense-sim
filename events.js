// events.js — 무작위 위기 결정 이벤트 (1/2). 모든 수치는 게임 가정이며 실제 효과가 아님.
// fx 필드 (모두 선택):
//   infect : 즉시 새로 노출되는 사람 수      budget : 예산 증감(억 원, 음수면 지출)
//   econ   : 경제지수 즉시 증감               trust / equity / med : 신뢰·형평성·의료 안정성 즉시 증감
//   mod    : { days, beta, contact (배수), beds, vax (더하기), cost (하루 비용), econ (하루 경제) } 며칠간 지속
//   risk   : { p, text, fx } 확률 p로 추가 효과가 터진다 (결과를 미리 알 수 없는 도박)
// ok(g): 이 이벤트가 나올 수 있는 조건, w(g): 뽑힐 가중치

const EVENTS = [];

EVENTS.push(
  {
    id: 'variant', icon: '🧬', title: '변이 바이러스 등장',
    text: '해외에서 전파력이 더 강한 변이 바이러스가 유입됐다는 보고가 올라왔습니다. 어떻게 대응하시겠습니까?',
    ok: g => g.st.day >= 10, w: () => 1.2,
    choices: [
      { label: 'A. 입국 전면 통제 + 시설 격리', note: '유입을 막지만 교역·관광이 타격을 입습니다.',
        fx: { budget: -15, econ: -5, trust: 2, mod: { days: 30, beta: 1.04 } } },
      { label: 'B. 검사·역학조사 대폭 강화', note: '국경은 열어 두고 국내에서 추적합니다. 비용이 큽니다.',
        fx: { budget: -40, mod: { days: 30, beta: 0.93 }, infect: 60 } },
      { label: 'C. 상황을 지켜본다', note: '비용은 없지만 변이가 퍼지면 되돌리기 어렵습니다.',
        fx: { infect: 300, mod: { days: 40, beta: 1.28 }, trust: -2 },
        risk: { p: 0.3, text: '변이가 생각보다 빨리 퍼졌습니다!', fx: { infect: 800, trust: -4 } } },
    ],
  },
  {
    id: 'hospital', icon: '🏥', title: '병원 집단감염',
    text: '대형 병원에서 집단감염이 발생해 병동이 일부 폐쇄됐습니다. 의료 현장이 흔들립니다.',
    ok: g => g.st.I1 + g.st.I2 > 150 * PS(), w: g => 1 + (g.st.I2 > 0.5 * bedCapacity(g.set) ? 1 : 0),
    choices: [
      { label: 'A. 병원 코호트 격리 + 대체 병상 확보', note: '확산을 막지만 일시적으로 병상이 줄고 예산이 듭니다.',
        fx: { budget: -30, infect: 80, med: -3, mod: { days: 14, beds: -300 } } },
      { label: 'B. 전국 병원 면회·외래 제한', note: '추가 감염은 막지만 일반 환자의 불편과 불만이 커집니다.',
        fx: { econ: -2, trust: -4, equity: -3, mod: { days: 14, beta: 0.97 } } },
      { label: 'C. 감염 관리 수칙만 재강조', note: '비용은 없지만 의료진 소진 위험이 큽니다.',
        fx: { infect: 250, med: -10, mod: { days: 14, beds: -800 } } },
    ],
  },
  {
    id: 'strike', icon: '🩺', title: '의료진 파업',
    text: '과로와 보상 문제로 의료진 단체가 파업을 예고했습니다. 중환자 병상 운영에 차질이 생길 수 있습니다.',
    ok: g => g.st.day >= 20, w: g => 1 + (g.st.I2 > 0.4 * bedCapacity(g.set) ? 0.8 : 0),
    choices: [
      { label: 'A. 수당·인력 대폭 증원 약속', note: '의료체계가 안정되지만 예산이 크게 듭니다.',
        fx: { budget: -60, med: 10, trust: 4, mod: { days: 30, beds: 400, cost: 0.5 } } },
      { label: 'B. 군 의료인력 투입 + 강경 대응', note: '병상은 일부 유지하지만 의료계와 시민이 반발합니다.',
        fx: { budget: -15, med: -8, trust: -10, mod: { days: 15, beds: -400 } } },
      { label: 'C. 협상 지연', note: '비용은 아끼지만 병상 운영이 크게 줄어듭니다.',
        fx: { med: -15, trust: -4, mod: { days: 15, beds: -1500 } },
        risk: { p: 0.35, text: '파업이 길어져 중환자 관리에 구멍이 났습니다.', fx: { med: -10, infect: 150 } } },
    ],
  },
  {
    id: 'vaxshort', icon: '💉', title: '백신 공급 부족',
    text: '제약사의 생산 차질로 계약한 백신이 제때 들어오지 않습니다. 접종 일정이 흔들립니다.',
    ok: g => g.set.vax > 0, w: () => 1,
    choices: [
      { label: 'A. 고가 긴급 구매', note: '접종 속도를 지키지만 예산을 크게 씁니다.',
        fx: { budget: -70, mod: { days: 20, vax: 0.001 } } },
      { label: 'B. 고령·고위험군 우선, 나머지 연기', note: '공정성은 지키지만 전체 접종은 늦어집니다.',
        fx: { equity: 6, trust: 2, mod: { days: 20, vax: -0.0006 } } },
      { label: 'C. 일정 유지·선착순 접종', note: '빠르게 보이지만 취약계층이 뒤로 밀립니다.',
        fx: { equity: -7, trust: -3, mod: { days: 20, vax: -0.0002 } } },
    ],
  },
  {
    id: 'church', icon: '⛪', title: '대규모 종교행사',
    text: '수만 명이 모이는 종교행사가 열릴 예정입니다. 행사 측은 "신앙의 자유"를 주장합니다.',
    ok: g => g.st.day >= 8, w: () => 1,
    choices: [
      { label: 'A. 행사 금지 명령', note: '확산 위험을 줄이지만 종교계와 갈등하고 일부는 몰래 모입니다.',
        fx: { trust: -6, equity: -2, infect: 40 },
        risk: { p: 0.3, text: '일부가 비공개로 모여 소규모 집단감염이 났습니다.', fx: { infect: 300, trust: -3 } } },
      { label: 'B. 인원 제한·방역수칙 조건부 허용', note: '타협안입니다. 감염은 일부 감수합니다.',
        fx: { infect: 300, budget: -10, trust: 1 } },
      { label: 'C. 자율에 맡김', note: '시민의 자유를 존중하지만 감염 위험이 가장 큽니다.',
        fx: { infect: 1500, trust: 2, econ: 1 } },
    ],
  },
  {
    id: 'recession', icon: '📉', title: '경기 침체',
    text: '장기간의 방역으로 자영업 폐업이 늘고 경기가 급격히 얼어붙고 있습니다.',
    ok: g => g.econ < 90 || g.st.day >= 40, w: g => 1 + (g.econ < 70 ? 1 : 0),
    choices: [
      { label: 'A. 대규모 재정 지원', note: '경제와 취약계층을 지키지만 예산이 크게 줄어듭니다.',
        fx: { budget: -80, econ: 6, equity: 4, trust: 3 } },
      { label: 'B. 영업 제한 완화', note: '경제는 살지만 감염 위험이 올라갑니다.',
        fx: { econ: 5, trust: 2, equity: -3, mod: { days: 25, beta: 1.12 } } },
      { label: 'C. 긴축으로 예산 확보', note: '예산을 아끼지만 경제와 형평성이 나빠집니다.',
        fx: { budget: 40, econ: -8, equity: -5, trust: -4 } },
    ],
  },
  {
    id: 'fakenews', icon: '📱', title: '가짜뉴스 확산',
    text: '"마스크가 오히려 해롭다"는 가짜뉴스가 SNS를 타고 빠르게 퍼지고 있습니다.',
    ok: g => g.st.day >= 12, w: () => 1,
    choices: [
      { label: 'A. 강력한 단속·법적 제재', note: '확산은 막지만 표현의 자유 침해 논란이 생깁니다.',
        fx: { trust: -6, equity: -2, mod: { days: 20, beta: 0.98 } } },
      { label: 'B. 공식 팩트체크 + 홍보 캠페인', note: '시간이 걸리지만 신뢰를 쌓습니다.',
        fx: { budget: -25, trust: 4, mod: { days: 20, beta: 0.99 } } },
      { label: 'C. 방치', note: '비용은 없지만 방역 수칙 준수율이 떨어질 수 있습니다.',
        fx: { trust: -5, mod: { days: 20, beta: 1.1 } },
        risk: { p: 0.3, text: '가짜뉴스가 반백신 시위로 번졌습니다.', fx: { trust: -5, infect: 300 } } },
    ],
  },
  {
    id: 'protest', icon: '📢', title: '방역 반대 시민 시위',
    text: '장기간의 제한에 지친 시민들이 도심에서 방역 정책 반대 시위를 벌이고 있습니다.',
    ok: g => g.set.dist >= 2 || g.trust < 60 || g.st.day >= 45, w: g => 1 + (g.set.dist === 3 ? 0.8 : 0),
    choices: [
      { label: 'A. 강경 해산', note: '단기 질서는 잡지만 신뢰가 크게 깎입니다.',
        fx: { trust: -10, equity: -3, infect: 40 } },
      { label: 'B. 대화 후 일부 방역 완화', note: '신뢰는 얻지만 확산 위험이 올라갑니다.',
        fx: { trust: 5, mod: { days: 20, beta: 1.08 } } },
      { label: 'C. 허용하되 방역 요원 배치', note: '시위할 권리를 존중하며 방역을 지원합니다. 비용이 들지만 형평성과 감염 관리는 B보다 낫습니다.',
        fx: { budget: -20, infect: 120, trust: 2, equity: 2 } },
    ],
  },
  {
    id: 'school', icon: '🏫', title: '학교 폐쇄 여부',
    text: '확진자가 급증하고 있습니다. 모든 학교를 폐쇄하시겠습니까?',
    ok: g => g.st.I1 + g.st.I2 > 400 * PS(), w: g => 1 + (g.st.I1 + g.st.I2 > 3000 * PS() ? 1 : 0),
    choices: [
      { label: 'A. 전면 폐쇄', note: '접촉이 크게 줄지만 교육 손실과 시민 불만, 돌봄 부담이 커집니다.',
        fx: { econ: -3, equity: -6, trust: -5, mod: { days: 30, contact: 0.86, beta: 0.9 } } },
      { label: 'B. 부분 등교', note: '중간 수준의 방역 효과와 중간 수준의 부작용입니다.',
        fx: { econ: -1, equity: -2, trust: -1, mod: { days: 30, contact: 0.94, beta: 0.96 } } },
      { label: 'C. 정상 운영', note: '교육과 경제 활동을 유지하지만 감염 위험이 올라갑니다.',
        fx: { infect: 100, trust: 2, mod: { days: 30, beta: 1.08 } } },
    ],
  },
);
