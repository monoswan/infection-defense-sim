// chart.js — 날짜별 감염자·사망자 그래프 (p5.js로 그림)

const COL = {
  active: [249, 115, 22],
  cum: [96, 165, 250],
  dead: [244, 63, 94],
  contact: [45, 212, 191],
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
function drawPlot(x, y, w, h, title, series, yMax, refs = []) {
  noStroke();
  fill(30, 41, 59);
  rect(x, y, w, h, 12);

  fill(226, 232, 240);
  textSize(15);
  textAlign(LEFT, TOP);
  text(title, x + 16, y + 12);

  // 범례 (좁은 화면에서는 제목 아래 줄에 둔다)
  textSize(12);
  textAlign(LEFT, CENTER);
  let lx = x + w - 16;
  const legendY = w < 500 ? y + 32 : y + 20;
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i];
    const tw = textWidth(s.label);
    lx -= tw;
    fill(...COL.text);
    text(s.label, lx, legendY);
    lx -= 18;
    fill(...s.color);
    rect(lx, legendY - 6, 12, 12, 3);
    lx -= 14;
  }

  const px = x + 62, py = y + (w < 500 ? 58 : 44);
  const pw = w - 62 - 18, ph = h - (py - y) - 34;

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

  // 기준선 (점선, 예: 거리두기 단계별 접촉 수)
  refs.forEach(r => {
    const ry = py + ph - ph * Math.min(r.value / yMax, 1);
    stroke(...COL.text);
    strokeWeight(1);
    drawingContext.setLineDash([5, 5]);
    line(px, ry, px + pw, ry);
    drawingContext.setLineDash([]);
    noStroke();
    fill(...COL.text);
    textAlign(RIGHT, BOTTOM);
    text(r.label, px + pw - 4, ry - 2);
  });

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

  const gap = 10;
  const ph = (height - gap * 2) / 3;   // 감염자, 사망자, 접촉 수: 세 그래프
  drawPlot(0, 0, width, ph, '감염자 추이 (날짜별)', [
    { values: col('active'), color: COL.active, label: '현재 감염자' },
    { values: col('cum'), color: COL.cum, label: '누적 감염자' },
  ], infMax);

  drawPlot(0, ph + gap, width, ph, '사망자 추이 (날짜별)', [
    { values: col('dead'), color: COL.dead, label: '사망자' },
  ], deadMax);

  const contactRefs = [0, 1, 2, 3].map(i => ({
    value: CONTACT_BASE * (1 - distEff(i)),
    label: LEVEL_NAMES.dist[i],
  }));
  drawPlot(0, 2 * (ph + gap), width, ph, '하루 평균 접촉 수 (명)', [
    { values: col('contacts'), color: COL.contact, label: '하루 접촉 수' },
  ], CONTACT_BASE + 2, contactRefs);
}
