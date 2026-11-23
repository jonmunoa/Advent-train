/* El tren de Navidad · la maqueta alpina, sin DOM ni WebGL (la usan tren.js y las pruebas).
   Un tablero con un pueblo y su plaza, una colina con túnel, un lago helado con su arroyo, la montaña
   del túnel grande, la montaña de esquí (pista y telesilla) y una cordillera al fondo.
   La vía crece por etapas: cada etapa es un circuito cerrado con su propia altura. El terreno se adapta
   a la vía: desmonte o terraplén donde va a ras, túnel donde la montaña queda muy por encima y puente
   donde el suelo queda muy por debajo. Unidades: metros de maqueta, Y hacia arriba. */
import {CatmullRomCurve3, Vector3} from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)};
export function hash2(x, y) {const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s)}
export function vnoise(x, y) {const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v)}
export const fbm = (x, y) => vnoise(x, y) * 0.6 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.12;
const ridged = (x, y) => {const a = 1 - Math.abs(2 * vnoise(x, y) - 1), b = 1 - Math.abs(2 * vnoise(x * 2.3 + 5, y * 2.3) - 1); return a * a * 0.65 + b * b * 0.35};

export const STEP = 0.5, GAUGE = 1.24;
export const TRAIN_V = 5.5;                  // el tren va despacio y siempre igual: así se leen los vagones
export const BOARD = {x0: -160, x1: 160, z0: -192, z1: 116};
export const CORR = GAUGE + 2.6, FALL = 9;   // la vía allana el terreno a ±CORR y lo funde hasta CORR+FALL
export const TUN_DY = 7, BR_DY = 2.6;        // túnel si la montaña queda TUN_DY por encima; puente si el suelo queda BR_DY por debajo
export const HOUSE_OFF = 9.4;

/* ================= el paisaje ================= */
export const F = {
  plaza: {x: -38, z: 22, r: 12},
  lake: {x: 48, z: 44, rx: 23, rz: 15},
  hill: {x: -4, z: -22, rx: 30, rz: 24, h: 19, k: 1.4},
  tm: {x: -110, z: -70, rx: 60, rz: 54, h: 56, k: 1.6},
  sm: {x: 92, z: -112, rx: 78, rz: 90, h: 86, k: 1.75},
  range: [[-150, -180, 46, 72], [-98, -186, 42, 96], [-46, -176, 40, 66], [6, -186, 48, 104], [60, -178, 40, 74], [118, -186, 48, 90], [164, -174, 40, 70]],
  creek: [[48, 56], [52, 76], [57, 96], [62, 124]],
  gorge: [[38, -70], [34, -40], [40, -12], [46, 14], [48, 32]],
  piste: [[90, -94], [83, -76], [93, -60], [88, -44]],   // de arriba abajo
  lift: [[106, -42], [105, -96]],                          // telesilla: de abajo arriba
};
function bump(x, z, M) {
  const u = Math.hypot((x - M.x) / M.rx, (z - M.z) / M.rz); if (u >= 1) return 0;
  return M.h * Math.pow(1 - u, M.k || 1.6);
}
function segD(x, z, P) {
  let m = 1e9;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return m;
}
export const pisteD = (x, z) => segD(x, z, F.piste);
export const lakeE = (x, z) => Math.hypot((x - F.lake.x) / F.lake.rx, (z - F.lake.z) / F.lake.rz);
export const LAKE_Y = -0.75;
/* relieve natural, antes de que la vía lo toque */
export function H0(x, z) {
  let h = (fbm(x * 0.018 + 7, z * 0.018) - 0.45) * 2.4;
  const rg = 0.86 + 0.26 * ridged(x * 0.03, z * 0.03), det = (vnoise(x * 0.16, z * 0.16) - 0.5) * 1.4;
  const hill = bump(x, z, F.hill), tm = bump(x, z, F.tm);
  let sm = bump(x, z, F.sm);
  if (sm > 0) {const w = 1 - sstep(5, 10, pisteD(x, z)); sm = lerp(sm * rg + det * Math.min(1, sm / 8), sm * 0.96 - 0.6, w)}
  h += hill * (0.9 + 0.2 * rg) + (tm * rg + det * Math.min(1, tm / 8)) + sm;
  {const fade = sstep(BOARD.z0, BOARD.z0 + 34, z);   // la cordillera baja hasta el canto de atrás del tablero
   if (fade > 0) for (const [cx, cz, r, hh] of F.range) {const u = Math.hypot(x - cx, (z - cz) * 1.25) / r; if (u < 1) h += hh * Math.pow(1 - u, 1.5) * rg * fade}}
  h -= 4.6 * Math.exp(-((segD(x, z, F.creek) / 3.6) ** 2));
  h -= 8 * Math.exp(-((segD(x, z, F.gorge) / 5.5) ** 2)) * sstep(30, 10, z) * lerp(0.44, 1, sstep(20, -40, z));
  const e = lakeE(x, z); if (e < 1.4) h = lerp(h, -1.1, sstep(1.4, 1.0, e));
  return h;
}

/* ================= la vía, por etapas ================= */
export const STAGE_NAMES = ['El pueblo', 'El lago helado', 'La montaña', 'La estación de esquí'];
/* puntos de control [x, z, y]; el primero es el taller de Papá Noel (s = 0) */
export const STAGES = [
  [[-52, 62, 0], [-18, 64, 0], [10, 52, 0], [22, 28, 0.5], [16, 4, 1.2], [2, -22, 1.5], [-18, -42, 1.5], [-44, -36, 1], [-56, -14, 0.5], [-78, -2, 0.3], [-88, 22, 0], [-80, 48, 0]],
  [[-52, 62, 0], [-14, 66, 0], [20, 72, 0.6], [52, 74, 2.6], [80, 64, 1], [86, 40, 0.5], [74, 18, 0.5], [46, 12, 0.8], [22, 0, 1.4], [2, -22, 1.5], [-18, -42, 1.5], [-50, -40, 1], [-76, -18, 0.5], [-84, 16, 0], [-78, 46, 0]],
  [[-52, 62, 0], [-14, 66, 0], [20, 72, 0.6], [52, 74, 2.6], [80, 64, 1], [86, 40, 0.5], [74, 18, 0.5], [46, 12, 0.8], [22, 0, 1.4], [2, -22, 1.5], [-20, -46, 2], [-50, -58, 3], [-80, -66, 4.5], [-110, -72, 5.5], [-136, -48, 3], [-134, -12, 1], [-114, 24, 0.5], [-94, 52, 0], [-74, 64, 0]],
  [[-52, 62, 0], [-14, 66, 0], [20, 72, 0.6], [52, 74, 2.6], [84, 70, 1.5], [108, 48, 1], [118, 16, 0.8], [112, -14, 1], [96, -30, 1.4], [72, -34, 1.8], [52, -30, 2.4], [36, -26, 2.8], [18, -24, 2], [2, -22, 1.5], [-20, -46, 2], [-50, -58, 3], [-80, -66, 4.5], [-110, -72, 5.5], [-136, -48, 3], [-134, -12, 1], [-114, 24, 0.5], [-94, 52, 0], [-74, 64, 0]],
];
export const KG = 0, KT = 1, KB = 2;       // a ras, túnel, puente

function buildTrack3(pts) {
  const curve = new CatmullRomCurve3(pts.map(p => new Vector3(p[0], p[2], p[1])), true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / STEP), sp = curve.getSpacedPoints(N), ds = L / N;
  const x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N), a = new Float32Array(N), p = new Float32Array(N), k = new Uint8Array(N);
  for (let i = 0; i < N; i++) {x[i] = sp[i].x; y[i] = sp[i].y; z[i] = sp[i].z}
  for (let i = 0; i < N; i++) {const q = (i + 1) % N, b = (i - 1 + N) % N, dx = x[q] - x[b], dz = z[q] - z[b]; a[i] = Math.atan2(dz, dx); p[i] = Math.atan2(y[q] - y[b], Math.hypot(dx, dz))}
  // túnel, puente o a ras según lo lejos que quede el relieve natural
  for (let i = 0; i < N; i++) {const d = H0(x[i], z[i]) - y[i]; k[i] = d > TUN_DY ? KT : d < -BR_DY ? KB : KG}
  const runs = () => {const out = []; let s = 0; while (s < N && k[s] === k[(s - 1 + N) % N]) s++; if (s >= N) return [{k: k[0], i: 0, n: N}];
    for (let c = 0; c < N;) {const i = (s + c) % N, kk = k[i]; let n = 0; while (n < N - c && k[(i + n) % N] === kk) n++; out.push({k: kk, i, n}); c += n} return out};
  const minLen = {[KT]: 16 / ds, [KB]: 8 / ds};
  for (const r of runs()) if (r.k !== KG && r.n < minLen[r.k]) for (let j = 0; j < r.n; j++) k[(r.i + j) % N] = KG;
  for (const r of runs()) if (r.k === KG && r.n < 6 / ds) {const prev = k[(r.i - 1 + N) % N], next = k[(r.i + r.n) % N]; if (prev === next && prev !== KG) for (let j = 0; j < r.n; j++) k[(r.i + j) % N] = prev}
  for (let j = -20; j <= 30; j++) k[(j + N) % N] = KG; // el taller siempre a ras
  const T = {x, y, z, a, p, k, N, L, ds};
  T.runs = runs().filter(r => r.k !== KG);
  return T;
}
const wrapA = a => {while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a};
export const idxM = (T, s) => Math.floor((((s % T.L) + T.L) % T.L) / T.ds) % T.N;
export const atM = (T, s) => {s = ((s % T.L) + T.L) % T.L; const f = s / T.ds, i = Math.floor(f) % T.N, j = (i + 1) % T.N, t = f - Math.floor(f);
  return {x: lerp(T.x[i], T.x[j], t), y: lerp(T.y[i], T.y[j], t), z: lerp(T.z[i], T.z[j], t), a: T.a[i] + wrapA(T.a[j] - T.a[i]) * t, p: lerp(T.p[i], T.p[j], t), k: T.k[i]}};
export const kindAt = (T, s) => T.k[idxM(T, s)];

/* ================= el suelo con la vía: rejilla de muestras para buscar la vía más cercana ================= */
const GC = 8;
function sampleGrid(T) {
  const g = new Map();
  for (let i = 0; i < T.N; i += 2) {const key = Math.floor(T.x[i] / GC) * 8192 + Math.floor(T.z[i] / GC); let l = g.get(key); if (!l) g.set(key, l = []); l.push(i)}
  return g;
}
/* distancia a la vía más cercana (de cualquier tipo) y su índice */
export function nearTrack(G, x, z, rmax = 16) {
  const T = G.T, cx = Math.floor(x / GC), cz = Math.floor(z / GC), R = Math.ceil(rmax / GC); let m = rmax * rmax, bi = -1;
  for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {const l = G.grid.get((cx + a) * 8192 + cz + b); if (l) for (const i of l) {const dx = T.x[i] - x, dz = T.z[i] - z, d = dx * dx + dz * dz; if (d < m) {m = d; bi = i}}}
  return {d: bi < 0 ? rmax : Math.sqrt(m), i: bi};
}
const RMAX = CORR + FALL;
function groundH(G, x, z) {
  const T = G.T, cx = Math.floor(x / GC), cz = Math.floor(z / GC); let dg = RMAX * RMAX, dt = RMAX * RMAX, ig = -1;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {const l = G.grid.get((cx + a) * 8192 + cz + b); if (!l) continue;
    for (const i of l) {const dx = T.x[i] - x, dz = T.z[i] - z, d = dx * dx + dz * dz; const kk = T.k[i]; if (kk === KG) {if (d < dg) {dg = d; ig = i}} else if (kk === KT && d < dt) dt = d}}
  let h = H0(x, z);
  if (ig >= 0 && dg <= dt) {const w = 1 - sstep(CORR, RMAX, Math.sqrt(dg)); h = lerp(h, T.y[ig] - 0.06, w)}
  for (const p of G.pads) {const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 5) h = lerp(h, p.y, 1 - sstep(p.r, p.r + 5, d))}
  return h;
}

/* huecos para casas junto a la vía: a ras, lejos del resto de la vía, del lago, de la pista y de la plaza */
function slotsFor(T, G, gap) {
  const out = []; let side = 1;
  const okRun = s => {for (let q = -7; q <= 7; q += 1) if (kindAt(T, s + q) !== KG) return false; return true};
  for (let s = 30; s <= T.L - 24; s += gap) {
    if (!okRun(s)) continue;
    const p = atM(T, s), nx = -Math.sin(p.a), nz = Math.cos(p.a);
    for (const sd of [side, -side]) {
      const x = p.x + nx * HOUSE_OFF * sd, z = p.z + nz * HOUSE_OFF * sd;
      if (nearTrack(G, x, z, 12).d < HOUSE_OFF - 0.6) continue;
      if (lakeE(x, z) < 1.55 || pisteD(x, z) < 12 || Math.hypot(x - F.plaza.x, z - F.plaza.z) < F.plaza.r + 7) continue;
      if (Math.abs(H0(x, z) - p.y) > 3.5 || out.some(o => Math.hypot(o.x - x, o.z - z) < 12.5)) continue;
      out.push({s, x, z, y: p.y, a: p.a, nx: nx * sd, nz: nz * sd, side: sd}); side = -side; break;
    }
  }
  return out;
}

export const MAXSTAGE = STAGES.length - 1;
const cache = {};
/* todo lo de una etapa: vía, huecos de casas, plaza, taller y la función de altura del suelo */
export function mapOf(k) {
  if (cache[k]) return cache[k];
  const T = buildTrack3(STAGES[k]), G = {T, grid: sampleGrid(T), pads: []};
  const p0 = atM(T, 0), sx = -Math.sin(p0.a), sz = Math.cos(p0.a);
  const st = {x: p0.x - sx * 8.2, z: p0.z - sz * 8.2, y: p0.y, a: p0.a, nx: -sx, nz: -sz};   // taller al lado del pueblo (al norte de la vía)
  G.pads.push({x: st.x, z: st.z, r: 11, y: p0.y}, {x: F.plaza.x, z: F.plaza.z, r: F.plaza.r, y: H0(F.plaza.x, F.plaza.z) * 0.3});
  const SL = slotsFor(T, G, 19);
  for (const s of SL) G.pads.push({x: s.x, z: s.z, r: 5.4, y: s.y});
  const m = {k, T, G, SL, st, h: (x, z) => groundH(G, x, z)};
  return cache[k] = m;
}
export const trackOf = k => mapOf(k).T;
export const slotsOf = k => mapOf(k).SL;
