// countries.js — 국가별 시나리오 데이터 (엔진 model.js와 분리). 5개국.
// 각 숫자의 근거(basis): 'ref' = 실제 코로나19 초기 상황·통계를 참고한 값, 'game' = 게임 밸런스를 위해 정한 가상 값.
// 값이 엔진에서 하는 일은 FIELDS의 effect에 적어 두었다. 모든 효과 수치는 단순화한 교육용 가정이다.

// 화면에 보여 줄 항목 설명 (키 → 이름, 단위, 근거, 엔진에서의 역할)
const FIELDS = [
  { key: 'pop', label: '인구', fmt: v => (v / 1e6).toFixed(1) + '백만 명', basis: 'ref', src: ['세계은행 인구 통계 (2020년경)', 'https://data.worldbank.org/indicator/SP.POP.TOTL'], effect: '시뮬레이션 인구 규모' },
  { key: 'density', label: '인구밀도', fmt: v => v + '명/km²', basis: 'ref', src: ['세계은행 인구밀도 통계', 'https://data.worldbank.org/indicator/EN.POP.DNST'], effect: '밀도가 높을수록 기본 전파율이 올라감' },
  { key: 'aged65', label: '65세 이상 비율', fmt: v => v + '%', basis: 'ref', src: ['세계은행 65세 이상 인구 비율', 'https://data.worldbank.org/indicator/SP.POP.65UP.TO.ZS'], effect: '비율이 높을수록 중증화·사망 위험이 올라감' },
  { key: 'seedPer100k', label: '초기 감염자(10만 명당)', fmt: v => v + '명', basis: 'game', effect: '게임 시작 시점의 감염자 수' },
  { key: 'importPer100kDay', label: '해외 유입(10만 명당/일)', fmt: v => v + '명', basis: 'game', effect: '국경을 통해 매일 들어오는 감염자 (국경 통제 정책으로 줄일 수 있음)' },
  { key: 'bedsPer100k', label: '중증 병상(10만 명당)', fmt: v => v + '개', basis: 'game', note: '국가 간 상대적 순서만 실제 중환자 병상 규모를 참고함 (OECD 보건 통계)', src: ['OECD 보건 통계', 'https://www.oecd.org/health/health-data.htm'], effect: '병상 수용 능력. 초과하면 중증 사망률 2배' },
  { key: 'budget', label: '초기 예산', fmt: v => fmtNum(v) + '억 (게임 단위)', basis: 'game', effect: '쓸 수 있는 총 예산' },
  { key: 'trust', label: '정부 신뢰도(시작)', fmt: v => v + '/100', basis: 'game', effect: '시민 신뢰의 시작값. 낮으면 엔딩에 불리' },
  { key: 'equity', label: '사회적 형평성(시작)', fmt: v => v + '/100', basis: 'game', effect: '취약계층 보호 수준의 시작값' },
  { key: 'econFragility', label: '경제 충격 취약성', fmt: v => '×' + v, basis: 'game', effect: '방역 제한·감염으로 인한 경제 피해에 곱해짐' },
  { key: 'testBase', label: '검사·역학조사 역량', fmt: v => Math.round(v * 100) + '%', basis: 'game', effect: '정책이 없어도 이 비율만큼 감염자를 찾아 격리해 전파를 막음' },
  { key: 'distMul', label: '거리두기 효과 배율', fmt: v => '×' + v, basis: 'game', effect: '행정·문화 조건에 따라 거리두기가 실제로 먹히는 정도' },
  { key: 'maskMul', label: '마스크 효과 배율', fmt: v => '×' + v, basis: 'game', effect: '착용률·인식 차이에 따른 마스크 효과' },
  { key: 'lawEff', label: '법률·정책 집행력', fmt: v => '×' + v, basis: 'game', effect: '법률·정책 카드 효과에 곱해짐 (연방제 등 조정 비용 반영)' },
  { key: 'borderMul', label: '국경 통제 효과 배율', fmt: v => '×' + v, basis: 'game', effect: '지리·행정 조건(섬나라, 열린 국경 등)에 따라 국경 통제 정책이 해외 유입을 줄이는 정도' },
  { key: 'supportMul', label: '경제 지원 효과 배율', fmt: v => '×' + v, basis: 'game', effect: '고용 유지 제도 등 기존 제도에 따라 경제 지원이 경제지수를 지키는 정도' },
  { key: 'lawDelay', label: '법률·정책 시행 지연', fmt: v => '+' + v + '일', basis: 'game', effect: '법률·정책이 효과를 내기까지 늘어나는 일수' },
];

// 최종 평가 가중치 순서: 감염 억제 · 경제 · 의료체계 · 정부 신뢰 · 형평성 · 비용 대비 효과 (국가별 목표를 반영한 교육용 기준)
const METRIC_NAMES = ['감염 억제 성과', '경제적 피해', '의료체계 안정성', '정부 신뢰도', '사회적 형평성', '정책의 비용 대비 효과'];

const COUNTRIES = [
  {
    id: 'kr', code: 'kr', flag: '🇰🇷', name: '대한민국', difficulty: 3, realStart: '2020-01-20',
    tagline: '검사·추적·치료(3T)로 봉쇄 없이 대응',
    chips: ['3T 방역', '역학조사', '사회적 거리두기'],
    card: { control: '높은 검사·추적 역량. 강제 이동 제한은 어려움', health: '인구 대비 중증 병상이 중간 수준', economy: '자영업 비중이 커 영업 제한에 민감' },
    history: '2020년 1월 20일 첫 확진자가 확인됐습니다. 2015년 메르스를 겪은 뒤 진단검사와 역학조사 체계를 갖춰 두었고, 2월 말 대구·경북 대규모 집단감염 때 대규모 검사와 접촉자 추적으로 대응했습니다. 전면 봉쇄 대신 사회적 거리두기 단계제를 운영했습니다.',
    goal: { title: '대규모 확산 억제와 추적·격리 역량 유지', text: '검사·추적 역량을 살려 대규모 확산을 막되, 병상과 신뢰도를 지키세요.' },
    constraints: ['법적으로 지역 봉쇄(이동 금지) 같은 강한 조치는 어렵습니다 → 거리두기 효과 배율 ×0.95', '검사·역학조사 역량이 강점입니다 → 기본 발견·격리율 16%'],
    borderMul: 0.9, supportMul: 0.9, unlock: { vax: '2021-02-26', support: '2020-03-17', school2: '2020-03-02' }, limits: { border: 1 }, limitNote: { border: '한국은 입국 전면 금지를 시행하지 않고 검역 강화·격리 중심으로 대응했습니다(게임 가정).' },
    weights: [0.30, 0.16, 0.14, 0.13, 0.12, 0.15],
    pop: 51780000, density: 527, aged65: 15.7, seedPer100k: 12, importPer100kDay: 0.02, bedsPer100k: 210, budget: 2000,
    trust: 65, equity: 65, econFragility: 1.1, testBase: 0.16, distMul: 0.95, maskMul: 1.15, lawEff: 1.0, lawDelay: 0,
  },
  {
    id: 'us', code: 'us', flag: '🇺🇸', name: '미국', difficulty: 4, realStart: '2020-01-21',
    tagline: '연방·주 분권, 큰 인구와 정치적 갈등',
    chips: ['CARES Act', '주정부별 조치', '백신 접종 확대'],
    card: { control: '주마다 정책이 달라 연방 정책이 약해짐', health: '병상은 많지만 인구가 매우 큼', economy: '대규모 재정 지원 여력, 신뢰도는 낮음' },
    history: '2020년 1월 21일 워싱턴주에서 첫 확진자가 확인됐습니다. 방역은 연방정부와 50개 주정부가 나누어 맡았고, 주마다 자택 대피령과 영업 제한 시기가 달랐습니다. 3월 말 대규모 경기부양법(CARES Act)이 제정됐고 마스크 착용은 정치적 논쟁이 됐습니다.',
    goal: { title: '의료체계 부담과 경제적 피해 최소화', text: '병상 초과를 막으면서 경제지수를 지키세요. 주 단위 조정 문제를 다루는 것이 열쇠입니다.' },
    constraints: ['연방·주 조정 문제로 법률·정책 효과가 약해집니다 → 집행력 ×0.7, 시행 지연 +4일', '마스크·거리두기 준수가 주마다 달라 효과가 줄어듭니다 → 배율 ×0.75', '초기 검사 역량이 낮았습니다 → 기본 발견·격리율 4%'],
    borderMul: 0.7, supportMul: 1.0, unlock: { vax: '2020-12-14', support: '2020-03-27', school2: '2020-03-16' },
    weights: [0.22, 0.24, 0.22, 0.12, 0.10, 0.10],
    pop: 331000000, density: 36, aged65: 16.8, seedPer100k: 15, importPer100kDay: 0.03, bedsPer100k: 300, budget: 2300,
    trust: 50, equity: 48, econFragility: 1.0, testBase: 0.04, distMul: 0.75, maskMul: 0.75, lawEff: 0.7, lawDelay: 4,
  },
  {
    id: 'uk', code: 'gb', flag: '🇬🇧', name: '영국', difficulty: 4, realStart: '2020-01-31',
    tagline: 'NHS 의료체계 압박, 전국 봉쇄와 단계적 완화',
    chips: ['Coronavirus Act 2020', '전국 봉쇄', 'NHS 대응'],
    card: { control: '중앙정부가 강한 조치를 빠르게 시행 가능', health: '중증 병상이 적어 NHS가 쉽게 한계에 이름', economy: '휴직 지원(furlough)으로 일자리 보호' },
    history: '2020년 1월 31일 첫 확진자가 확인됐습니다. 3월 23일 전국 봉쇄가 발표됐고 3월 25일 Coronavirus Act 2020이 제정됐습니다. 이후 몇 차례의 봉쇄와 완화가 이어졌고, 2020년 12월에는 대규모 백신 접종이 시작됐습니다. 의료 서비스(NHS)의 압박이 핵심 쟁점이었습니다.',
    goal: { title: 'NHS 의료체계 붕괴 방지', text: '중증 병상이 한계를 넘지 않도록 하면서 사회 불만을 관리하세요.' },
    constraints: ['중앙정부가 법률로 강한 조치를 시행할 수 있습니다 → 집행력 ×1.0, 시행 지연 +2일', '중증 병상이 적어 병상 초과 위험이 큽니다 → 병상 10만 명당 150개', '초기 검사 역량이 낮았습니다 → 기본 발견·격리율 5%'],
    borderMul: 0.8, supportMul: 1.1, unlock: { vax: '2020-12-08', support: '2020-03-20', school2: '2020-03-20' },
    weights: [0.24, 0.16, 0.28, 0.12, 0.10, 0.10],
    pop: 67100000, density: 275, aged65: 18.7, seedPer100k: 15, importPer100kDay: 0.03, bedsPer100k: 150, budget: 2200,
    trust: 60, equity: 58, econFragility: 1.05, testBase: 0.05, distMul: 1.0, maskMul: 0.95, lawEff: 1.0, lawDelay: 2,
  },
  {
    id: 'de', code: 'de', flag: '🇩🇪', name: '독일', difficulty: 3, realStart: '2020-01-27',
    tagline: '연방·주 협력, 탄탄한 의료체계, 고령 사회',
    chips: ['Infektionsschutzgesetz', '접촉 제한', '주정부 협력'],
    card: { control: '연방과 주의 조정에 시간이 걸림', health: '병상 여유가 크고 검사 역량도 갖춤', economy: '조업단축수당(Kurzarbeit)으로 충격 완화' },
    history: '2020년 1월 27일 바이에른주에서 첫 확진자가 확인됐습니다. 감염보호법(Infektionsschutzgesetz)을 바탕으로 연방정부와 16개 주가 협의해 조치를 정했고, 3월 하순 접촉 제한에 합의했습니다. 중환자 병상 규모가 커서 초기 의료 부담이 상대적으로 작았지만 고령 인구 비율이 높습니다.',
    goal: { title: '지역 간 방역 협력과 의료체계 안정성 확보', text: '주 간 조정 지연을 감안해 선제적으로 움직이고, 병상 여유를 지키세요.' },
    constraints: ['연방·주 합의에 시간이 걸립니다 → 법률·정책 집행력 ×0.85, 시행 지연 +5일', '고령 인구 비율이 높아 중증화 위험이 큽니다 → 65세 이상 21.7%', '병상 여유와 검사 역량이 비교적 좋습니다 → 병상 10만 명당 330개'],
    borderMul: 0.7, supportMul: 1.2, unlock: { vax: '2020-12-27', support: '2020-03-13', school2: '2020-03-16' },
    weights: [0.24, 0.15, 0.22, 0.10, 0.17, 0.12],
    pop: 83200000, density: 237, aged65: 21.7, seedPer100k: 12, importPer100kDay: 0.025, bedsPer100k: 330, budget: 2400,
    trust: 70, equity: 70, econFragility: 0.9, testBase: 0.08, distMul: 0.95, maskMul: 1.0, lawEff: 0.85, lawDelay: 5,
  },
  {
    id: 'nz', code: 'nz', flag: '🇳🇿', name: '뉴질랜드', difficulty: 2, realStart: '2020-02-28',
    tagline: '국경 통제와 강한 봉쇄로 바이러스 박멸 시도',
    chips: ['국경 통제', '관리 격리', '단계별 경보'],
    card: { control: '작은 섬나라. 강한 조치의 집행력이 높음', health: '병상이 적어 확산되면 위험', economy: '관광 의존이 커 경제 충격에 취약' },
    history: '2020년 2월 28일 첫 확진자가 확인됐습니다. 3월 19일 비거주 외국인의 입국이 막혔고, 3월 21일 4단계 경보 체계가 발표돼 3월 25일 가장 강한 4단계 봉쇄가 시작됐습니다. 2020년 5월에는 COVID-19 Public Health Response Act 2020이 제정됐습니다. 박멸(elimination) 전략을 택했습니다.',
    goal: { title: '지역사회 감염 억제와 국경·경제 문제 해결', text: '지역사회 감염을 막으면서 국경 개방과 관광업 피해 사이에서 균형을 잡으세요.' },
    constraints: ['인구가 작고 정부 집행력이 높습니다 → 법률·정책 집행력 ×1.1, 거리두기 배율 ×1.1', '해외 유입 위험이 가장 큽니다 → 10만 명당 0.06명/일 (국경 통제로 줄일 수 있음)', '관광 의존으로 경제 충격에 취약합니다 → 경제 취약성 ×1.25', '병상이 적습니다 → 병상 10만 명당 120개'],
    borderMul: 1.25, supportMul: 1.1, unlock: { vax: '2021-02-20', support: '2020-03-17', school2: '2020-03-25' },
    weights: [0.30, 0.22, 0.12, 0.12, 0.10, 0.14],
    pop: 5080000, density: 19, aged65: 16, seedPer100k: 3, importPer100kDay: 0.06, bedsPer100k: 120, budget: 1700,
    trust: 76, equity: 66, econFragility: 1.25, testBase: 0.10, distMul: 1.1, maskMul: 1.0, lawEff: 1.1, lawDelay: 0,
  },
];

const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
