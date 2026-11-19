// chart.js — 날짜별 감염자·사망자 그래프 (p5.js로 그림)

const COL = {
  active: [249, 115, 22],
  cum: [96, 165, 250],
  dead: [244, 63, 94],
  grid: [51, 65, 85],
  text: [148, 163, 184],
};

function fmtNum(v) {
  return Math.round(v).toLocaleString('ko-KR');
}

// 눈금 최댓값을 보기 좋은 값으로 올림 (예: 880,000 → 1,000,000)
function niceMax(v) {
  const m = Math.max(v, 100);
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  return Math.ceil(m / p) * p;
}

// series: [{ values: [day0, day1, ...], color: [r,g,b], label }]
function drawPlot(x, y, w, h, title, series, yMax) {
  noStroke();
  fill(30, 41, 59);
  rect(x, y, w, h, 12);

  fill(226, 232, 240);
  textSize(15);
  textAlign(LEFT, TOP);
  text(title, x + 16, y + 12);

  // 범례 (오른쪽 위)
  textSize(12);
  textAlign(LEFT, CENTER);
  let lx = x + w - 16;
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i];
    const tw = textWidth(s.label);
    lx -= tw;
    fill(...COL.text);
    text(s.label, lx, y + 20);
    lx -= 18;
    fill(...s.color);
    rect(lx, y + 14, 12, 12, 3);
    lx -= 14;
  }

  const px = x + 62, py = y + 44;
  const pw = w - 62 - 18, ph = h - 44 - 34;

  // 가로 눈금선과 세로 축 숫자
  textSize(11);
  for (let i = 0; i <= 4; i++) {
    const gy = py + ph - (ph * i) / 4;
    stroke(...COL.grid);
    strokeWeight(1);
    line(px, gy, px + pw, gy);
    noStroke();
    fill(...COL.text);
    textAlign(RIGHT, CENTER);
    text(fmtNum((yMax * i) / 4), px - 8, gy);
  }

  // 날짜 눈금
  noStroke();
  fill(...COL.text);
  textAlign(CENTER, TOP);
  for (let d = 0; d <= DAYS; d += 30) {
    text(d + '일', px + (pw * d) / DAYS, py + ph + 8);
  }

  // 선 그래프 (values[i]는 i일차 값)
  series.forEach(s => {
    if (s.values.length < 2) return;
    stroke(...s.color);
    strokeWeight(2.5);
    noFill();
    beginShape();
    s.values.forEach((v, i) => {
      vertex(px + (pw * i) / DAYS, py + ph - ph * Math.min(v / yMax, 1));
    });
    endShape();
  });
}

// hist: [{ active, cum, dead }] (0일차부터)
function drawCharts(hist) {
  const last = hist[hist.length - 1];
  const infMax = niceMax(last.cum);
  const deadMax = niceMax(Math.max(100, last.dead));
  const col = key => hist.map(h => h[key]);

  drawPlot(0, 0, 780, 260, '감염자 추이 (날짜별)', [
    { values: col('active'), color: COL.active, label: '현재 감염자' },
    { values: col('cum'), color: COL.cum, label: '누적 감염자' },
  ], infMax);

  drawPlot(0, 270, 780, 260, '사망자 추이 (날짜별)', [
    { values: col('dead'), color: COL.dead, label: '사망자' },
  ], deadMax);
}
