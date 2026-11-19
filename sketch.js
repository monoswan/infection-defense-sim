// sketch.js — 게임 루프와 진행 (p5.js). 화면 그리기는 chart.js, 버튼·문구는 ui.js

const BASE_MS = 600;   // 1배속일 때 하루가 지나가는 시간(ms)
let game;
let lastT = 0;
let acc = 0;

function histPoint(st) {
  return { active: st.I1 + st.I2, cum: st.cumInf, dead: st.D };
}

function newGame() {
  game = {
    st: initialState(),
    set: { ...ZERO_SET },
    budget: BUDGET,
    speed: 0,           // 0: 일시정지, 1·2·4: 배속
    timeline: [],       // 날짜별 정책 선택 기록
    hist: [],
    maxI2: 0,
    warnedOverflow: false,
    warnedTenPct: false,
    ended: false,
  };
  game.hist.push(histPoint(game.st));
}

function setup() {
  const c = createCanvas(780, 540);
  c.parent(document.getElementById('chart-slot'));
  textFont('"Noto Sans KR", "Malgun Gothic", sans-serif');
  newGame();
  buildControls();
  renderAll();
  lastT = performance.now();
}

function draw() {
  clear();
  const now = performance.now();
  const dt = now - lastT;
  lastT = now;
  if (game.speed > 0 && !game.ended) {
    acc = Math.min(acc + dt * game.speed, BASE_MS * 5); // 탭을 오래 떠났다 와도 한꺼번에 많이 넘기지 않음
    while (acc >= BASE_MS && !game.ended) {
      acc -= BASE_MS;
      advanceDay();
    }
  }
  drawCharts(game.hist);
}

function advanceDay() {
  const day = game.st.day;
  let set = { ...game.set };
  if (game.budget < dailyCost(set) && (set.mask || set.dist || set.vax)) {
    set = { ...set, mask: 0, dist: 0, vax: 0 };
    game.set = { ...set };
    addLog(day, '예산이 바닥나 마스크·거리두기·백신 정책이 자동 중단되었습니다.');
  }
  game.budget = Math.max(0, game.budget - dailyCost(set));
  game.timeline.push(set);
  game.st = stepDay(game.st, set);
  game.hist.push(histPoint(game.st));
  checkEvents();

  const d = game.st.day;
  if (d >= DAYS || (d >= 30 && activeCount(game.st) < 5)) {
    endGame();
  }
  renderAll();
}

function checkEvents() {
  const st = game.st, day = st.day;
  game.maxI2 = Math.max(game.maxI2, st.I2);
  if (!game.warnedOverflow && st.I2 > bedCapacity(game.set)) {
    game.warnedOverflow = true;
    addLog(day, '중증 환자가 병상 수를 넘었습니다. 중증 사망률이 2배로 올라갑니다!');
  }
  if (!game.warnedTenPct && st.cumInf >= POP * 0.1) {
    game.warnedTenPct = true;
    addLog(day, '누적 감염이 인구의 10%를 넘었습니다.');
  }
  if (day % 30 === 0) {
    addLog(day, `${day}일 경과 · 현재 감염 ${fmtNum(st.I1 + st.I2)}명, 사망 ${fmtNum(st.D)}명`);
  }
}

function endGame() {
  game.ended = true;
  game.speed = 0;
  addLog(game.st.day, activeCount(game.st) < 5 ? '감염병이 사라졌습니다. 게임 종료!' : '180일이 지났습니다. 게임 종료!');
  showResult();
}
