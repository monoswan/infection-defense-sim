// map.js — 도시 지도. 점 1개는 약 2,500명이고, 상태별 점 수는 모형의 그날 수치를 따른다.
// 점의 움직임과 접촉선은 이해를 돕기 위한 표현이며, 개인 단위 시뮬레이션이 아니다.
// p5와 별개로 Canvas 2D로 그린다.

const MAP_DOTS = 400;
const perDot = () => POP / MAP_DOTS;   // 점 1개가 나타내는 인구 (국가마다 다르다)
const LINK_MS = 900;      // 접촉선이 사라지는 시간
const LINK_RANGE = 160;   // 이 거리 안의 감염자에게서만 접촉선을 그린다
const MAP_STYLE = {
  S:  { color: [148, 163, 184], label: '건강' },
  E:  { color: [250, 204, 21],  label: '잠복' },
  I1: { color: [249, 115, 22],  label: '감염' },
  I2: { color: [239, 68, 68],   label: '중증' },
  R:  { color: [96, 165, 250],  label: '회복·접종' },
  D:  { color: [17, 24, 39],    label: '사망' },
};
const CATS = Object.keys(MAP_STYLE);

const mapState = { canvas: null, ctx: null, w: 0, h: 0, on: true, dots: [], links: [], lastT: 0 };

// 상태별 점 수. 0명이 아니면 최소 1개로 보여 준다.
function targetCounts(st) {
  const groups = { S: st.S, E: st.E1 + st.E2, I1: st.I1, I2: st.I2, R: st.R, D: st.D };
  const out = {};
  let sum = 0;
  for (const k of CATS) {
    out[k] = groups[k] > 0 ? Math.max(1, Math.round((groups[k] / POP) * MAP_DOTS)) : 0;
    sum += out[k];
  }
  out.S = Math.max(0, out.S + (MAP_DOTS - sum));
  return out;
}

function mapInit() {
  mapState.canvas = document.getElementById('map-canvas');
  mapState.ctx = mapState.canvas.getContext('2d');
  mapResize();
  mapLegend();
}

function mapResize() {
  mapState.w = Math.min(780, window.innerWidth - 56);
  mapState.h = 280;
  mapState.canvas.width = mapState.w;
  mapState.canvas.height = mapState.h;
}

function newDot(cat) {
  const dir = Math.random() * Math.PI * 2;
  return {
    x: Math.random() * mapState.w,
    y: Math.random() * mapState.h,
    dir,
    sp: 0.6 + Math.random() * 0.4,   // 한 프레임당 이동 거리(px)
    cat,
  };
}

// 처음 상태(또는 재시작)에 맞춰 점을 배치한다
function mapReset(st) {
  mapState.links = [];
  mapState.dots = [];
  const target = targetCounts(st);
  for (const k of CATS) {
    for (let i = 0; i < target[k]; i++) mapState.dots.push(newDot(k));
  }
}

function nearestInfectious(dot) {
  let best = null, bd = Infinity;
  for (const o of mapState.dots) {
    if (o.cat !== 'I1' && o.cat !== 'I2') continue;
    const d = Math.hypot(o.x - dot.x, o.y - dot.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best && bd < LINK_RANGE ? { src: best, t: performance.now(), dst: dot } : null;
}

// 점의 상태를 바꾼다. 건강 → 잠복이면 가까운 감염자와 접촉선을 남긴다.
function setCat(dot, cat) {
  if (dot.cat === 'S' && cat === 'E') {
    const link = nearestInfectious(dot);
    if (link) mapState.links.push(link);
  }
  dot.cat = cat;
}

// 그날의 새 감염 수와 모형 수치에 맞춰 점을 바꾼다 (sketch.js의 advanceDay에서 호출)
function syncDots(st, newInf) {
  const target = targetCounts(st);
  // 1) 새로 감염된 사람만큼 건강한 점을 잠복 상태로 바꾼다
  const k = Math.round(newInf / perDot());
  const healthy = mapState.dots.filter(d => d.cat === 'S');
  for (let i = 0; i < k && healthy.length; i++) {
    const j = Math.floor(Math.random() * healthy.length);
    setCat(healthy[j], 'E');
    healthy.splice(j, 1);
  }
  // 2) 나머지는 상태별 점 수가 모형과 같아지도록 옮긴다
  const count = {};
  CATS.forEach(c => { count[c] = 0; });
  mapState.dots.forEach(d => { count[d.cat]++; });
  const from = [], to = [];
  for (const c of CATS) {
    const diff = count[c] - target[c];
    for (let i = 0; i < diff; i++) from.push(c);
    for (let i = 0; i < -diff; i++) to.push(c);
  }
  for (let i = 0; i < Math.min(from.length, to.length); i++) {
    const pool = mapState.dots.filter(d => d.cat === from[i]);
    if (pool.length) setCat(pool[Math.floor(Math.random() * pool.length)], to[i]);
  }
}

// running: 시뮬레이션이 도는 중인지, set: 정책 선택 (거리두기가 강하면 점이 덜 움직인다)
function mapDraw(running, set) {
  if (!mapState.on || !mapState.ctx) return;
  const ctx = mapState.ctx, w = mapState.w, h = mapState.h;
  const now = performance.now();
  const dt = Math.min(64, now - (mapState.lastT || now)) / 16.7;
  mapState.lastT = now;
  const mv = running ? Math.max(0.3, 1 - distEff(set.dist) * 1.5) : 0;

  // 배경과 도로 격자
  ctx.fillStyle = '#0b1222';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(148,163,184,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 56) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // 움직임 (사망자는 멈추고, 중증 환자는 천천히 움직인다)
  for (const d of mapState.dots) {
    if (d.cat === 'D' || mv === 0) continue;
    const f = d.cat === 'I2' ? 0.3 : 1;
    d.dir += (Math.random() - 0.5) * 0.08;
    d.x += Math.cos(d.dir) * d.sp * f * mv * dt;
    d.y += Math.sin(d.dir) * d.sp * f * mv * dt;
    if (d.x < 6) { d.x = 6; d.dir = Math.PI - d.dir; }
    if (d.x > w - 6) { d.x = w - 6; d.dir = Math.PI - d.dir; }
    if (d.y < 6) { d.y = 6; d.dir = -d.dir; }
    if (d.y > h - 6) { d.y = h - 6; d.dir = -d.dir; }
  }

  // 접촉선 (감염이 일어난 순간에 잠깐 보인다)
  mapState.links = mapState.links.filter(l => now - l.t < LINK_MS);
  for (const l of mapState.links) {
    const a = 1 - (now - l.t) / LINK_MS;
    ctx.strokeStyle = `rgba(239,68,68,${0.85 * a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(l.src.x, l.src.y);
    ctx.lineTo(l.dst.x, l.dst.y);
    ctx.stroke();
  }

  // 점
  for (const d of mapState.dots) {
    const [r, g, b] = MAP_STYLE[d.cat].color;
    if (d.cat === 'I2') {
      ctx.fillStyle = 'rgba(239,68,68,0.25)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (d.cat === 'D') {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function mapToggle() {
  mapState.on = !mapState.on;
  document.getElementById('map-wrap').style.display = mapState.on ? '' : 'none';
  document.getElementById('map-legend').style.display = mapState.on ? '' : 'none';
  document.getElementById('btn-map').textContent = mapState.on ? '지도 끄기' : '지도 켜기';
}

// 범례: 점 1개가 나타내는 인구는 국가마다 다르다
function mapLegend() {
  document.getElementById('map-legend').innerHTML =
    CATS.map(k => `<span class="lg"><i style="background:rgb(${MAP_STYLE[k].color.join(',')})"></i>${MAP_STYLE[k].label}</span>`).join('') +
    `<span class="lg-note">점 1개 ≈ ${fmtNum(Math.round(perDot()))}명 · 점 움직임은 이해를 돕기 위한 표현</span>`;
}
