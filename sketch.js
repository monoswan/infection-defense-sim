// sketch.js — 게임 루프와 진행 (p5.js). 계산은 world.js, 화면 그리기는 chart.js, 버튼·문구는 ui.js

const BASE_MS = 600;   // 1배속일 때 하루가 지나가는 시간(ms)
let game;
let lastT = 0;
let acc = 0;

// 새 게임: 순수 월드(world.js)에 화면용 상태를 덧붙인다.
function newGame() {
  const seed = (Math.random() * 2 ** 32) >>> 0;   // 이벤트 선택·도박 결과를 정하는 난수 시드 (반사실 비교에서 같은 시드를 쓴다)
  const rand = mulberry32(seed);
  game = Object.assign(newWorld(), {
    live: true,
    seed,
    rand,
    speed: 0,           // 0: 일시정지, 1·2·4: 배속
    ended: false,
    pending: null,      // 지금 결정 중인 이벤트
    prevSpeed: 0,
    evSeen: [],
  });
  game.eventPlan = drawEventPlan(rand);   // 이번 판에 위기 이벤트가 나올 날짜 5~6개 (실제 사건은 실제 시기에 맞춰 편성)
  mapReset(game.st);
  if (typeof resetConceptCard === 'function') resetConceptCard();
}

// 화면 너비에 맞춰 캔버스 크기를 정한다 (모바일에서는 글자가 잘 보이도록 세로로 쌓는다)
function canvasSize() {
  const w = Math.min(780, windowWidth - 32);
  return [w, w < 500 ? 600 : 700];
}

function setup() {
  const [w, h] = canvasSize();
  const c = createCanvas(w, h);
  c.parent(document.getElementById('chart-slot'));
  textFont('"Noto Sans KR", "Malgun Gothic", sans-serif');
  finalizeEvents();
  mapInit();
  newGame();
  buildControls();
  buildScreens();   // 메인 메뉴부터 시작. 국가를 고르고 브리핑을 본 뒤에야 게임이 시작된다
  renderAll();
  lastT = performance.now();
}

function windowResized() {
  const [w, h] = canvasSize();
  resizeCanvas(w, h);
  mapResize();
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
  mapDraw(game.speed > 0 && !game.ended, game.set);
  drawCharts(game.hist);
}

function restartGame() {
  document.getElementById('result').classList.add('hidden');
  document.getElementById('event').classList.add('hidden');
  document.getElementById('log').innerHTML = '';
  acc = 0;
  newGame();
  renderAll();
  notifyStart();
}

function notifyStart() {
  const c = COUNTRY_BY_ID[SCN.id];
  notify(`${c ? c.flag + ' ' + c.name + ': ' : ''}새 게임을 시작했습니다. 사회적 거리두기 "약"부터 눌러 보세요.`);
}

// 하루 진행: 계산은 worldDay, 여기서는 알림과 화면 갱신, 종료·이벤트 판단만 한다
function advanceDay() {
  const before = game.st;
  const r = worldDay(game);
  r.notes.forEach(notify);
  r.logs.forEach(m => addLog(game.st.day, m));
  syncDots(game.st, game.st.cumInf - before.cumInf);
  if (worldEnded(game)) {
    endGame();
  } else {
    tickEvents();   // 위기 이벤트가 나오면 게임이 멈추고 선택 창이 뜬다
  }
  renderAll();
}

function endGame() {
  game.ended = true;
  game.speed = 0;
  addLog(game.st.day, activeCount(game.st) < 5 * PS() ? '감염병이 사라졌습니다. 게임 종료!' : `${DAYS}일이 지났습니다. 게임 종료!`);
  showResult();
}
