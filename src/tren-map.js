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
export const TUN_DY = 7, BR_DY = 6;          // túnel si la montaña queda TUN_DY por encima; puente si el suelo queda BR_DY por debajo (si no, loma de tierra)
export const HOUSE_OFF = 9.4;

/* ================= el paisaje ================= */
export const F = {
  plaza: {x: -47, z: 60, r: 9},
  lake: {x: 48, z: 44, rx: 23, rz: 15},
  hill: {x: -4, z: -22, rx: 30, rz: 24, h: 19, k: 1.4},
  tm: {x: -110, z: -70, rx: 60, rz: 54, h: 56, k: 1.6},
  sm: {x: 92, z: -112, rx: 78, rz: 90, h: 86, k: 1.75},
  range: [[-150, -180, 46, 72], [-98, -186, 42, 96], [-46, -176, 40, 66], [6, -186, 48, 104], [60, -178, 40, 74], [118, -186, 48, 90], [164, -174, 40, 70]],
  creek: [[48, 56], [52, 76], [57, 96], [62, 124]],
  gorge: [[38, -70], [34, -40], [40, -12], [46, 14], [48, 32]],
  piste: [[92, -112], [85, -96], [95, -82], [90, -66]],  // de arriba abajo
  lift: [[109, -64], [106, -114]],                         // telesilla: de abajo arriba
  brook: [[-96, -30], [-80, 8], [-76, 40], [-82, 80], [-80, 124]],   // arroyo del pueblo
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
  h -= 4.6 * Math.exp(-((segD(x, z, F.creek) / 3.6) ** 2)) + 4.2 * Math.exp(-((segD(x, z, F.brook) / 4) ** 2));
  h -= 8 * Math.exp(-((segD(x, z, F.gorge) / 5.5) ** 2)) * sstep(30, 10, z) * lerp(0.44, 1, sstep(20, -40, z));
  const e = lakeE(x, z); if (e < 1.4) h = lerp(h, -1.1, sstep(1.4, 1.0, e));
  return h;
}

/* ================= la vía, por etapas ================= */
export const STAGE_NAMES = ['El pueblo', 'El lago helado', 'La montaña', 'La estación de esquí'];
/* La vía es un ocho: sale del pueblo a ras (LOW), cruza por debajo, sube por el otro lóbulo y vuelve a pasar por
   el mismo cruce por encima (HIGH), sobre un puente. Cada etapa alarga los lóbulos hacia nuevas zonas.
   Puntos de control [x, z, y, taller]: el que lleva taller=1 es s = 0 (ahí se cargan los regalos). */
const C8 = [-16, 22], LOW = 0.4, HIGH = 7.9;   // en el cruce: 7,5 m entre las dos vías (el tren mide 5,3)
const E8 = {a: 66, b: 52, u: [0.439, -0.898]};   // lemniscata del primer día: un lóbulo con la colina y otro con el pueblo
function e8(t) {const {a, b, u} = E8, v = [-u[1], u[0]], xp = a * Math.cos(t), zp = b * Math.sin(2 * t) / 2; return [C8[0] + xp * u[0] + zp * v[0], C8[1] + xp * u[1] + zp * v[1]]}
const arc = (t0, t1, n, yf) => Array.from({length: n}, (_, i) => {const t = t0 + (i + 1) / (n + 1) * (t1 - t0), [x, z] = e8(t); return [x, z, yf(t)]});
const HALF = Math.PI / 2;
/* lóbulo del pueblo (de bajada desde el cruce alto hasta el cruce bajo), con el taller */
const LOBE_V = (() => {const l = arc(HALF, 3 * HALF, 9, t => LOW + (HIGH - LOW) * Math.max(0, 1 - (t - HALF) / (0.8 * Math.PI))); l[7][3] = 1; return l})();
/* lóbulo de la colina: sube despacio, cruza la colina por un túnel y vuelve al cruce por arriba */
const LOBE_H = [[-20, 2, 0.8], [-12, -20, 1.4], [2, -40, 2.3], [22, -42, 3.3], [34, -26, 4.5], [30, -4, 5.8], [14, 12, 7]];
const XL = [...C8, LOW], XH = [...C8, HIGH];
export const STAGES_RAW = [
  [XL, ...LOBE_H, XH, ...LOBE_V],
  // + el lago: túnel en la colina, puente sobre el río, la orilla este y puente sobre el arroyo
  [XL, [-20, 2, 0.8], [-12, -20, 1.2], [2, -40, 2], [24, -42, 3], [42, -30, 4], [62, -20, 4], [78, 0, 3], [82, 26, 2.5], [80, 54, 2.2], [66, 78, 2.6], [42, 88, 3], [18, 80, 4], [4, 58, 5.6], [2, 36, 7.2], XH, ...LOBE_V],
  // + la montaña del túnel grande: el pueblo sube por la ladera, entra en la montaña y baja por un viaducto
  [XL, [-20, 2, 0.8], [-12, -20, 1.2], [2, -40, 2], [24, -42, 3], [42, -30, 4], [62, -20, 4], [78, 0, 3], [82, 26, 2.5], [80, 54, 2.2], [66, 78, 2.6], [42, 88, 3], [18, 80, 4], [4, 58, 5.6], [2, 36, 7.2], XH,
    [-36, 30, 8.4], [-58, 22, 9], [-76, 2, 9.8], [-86, -22, 11], [-94, -42, 12.4], [-110, -52, 13.4], [-128, -46, 13], [-142, -26, 11.6], [-144, 2, 9.4], [-134, 30, 6.8], [-114, 56, 4], [-92, 78, 1.8], [-66, 90, 0.5, 1], [-40, 92, 0.4], [-24, 72, 0.4], [-18, 46, 0.4]],
  // + la estación de esquí: puente alto sobre el río, la falda de la montaña de esquí y vuelta por el lago
  [XL, [-20, 2, 0.8], [-12, -20, 1.2], [0, -42, 2.2], [20, -52, 3.4], [38, -54, 4.8], [58, -56, 6.4], [80, -50, 8], [104, -46, 8.2], [124, -24, 7], [130, 8, 5.6], [118, 40, 4.2], [96, 62, 3.4], [70, 84, 3], [42, 90, 3.2], [18, 80, 4], [4, 58, 5.6], [2, 36, 7.2], XH,
    [-36, 30, 8.4], [-58, 22, 9], [-76, 2, 9.8], [-86, -22, 11], [-94, -42, 12.4], [-110, -52, 13.4], [-128, -46, 13], [-142, -26, 11.6], [-144, 2, 9.4], [-134, 30, 6.8], [-114, 56, 4], [-92, 78, 1.8], [-66, 90, 0.5, 1], [-40, 92, 0.4], [-24, 72, 0.4], [-18, 46, 0.4]],
];
/* cada etapa empieza en el taller */
export const STAGES = STAGES_RAW.map(l => {const i = Math.max(0, l.findIndex(p => p[3])); return [...l.slice(i), ...l.slice(0, i)].map(p => p.slice(0, 3))});
export const KG = 0, KT = 1, KB = 2;       // a ras, túnel, puente

/* Agujas: en cada una la gente vota entre seguir por la vía principal o por un ramal que vuelve a ella más adelante.
   from y to son puntos [x, z] de la vía principal (se toma la muestra más cercana) y pts, los del ramal [x, z, y]. */
const OPT = {
  tunel: {n: 'Túnel', art: 'el túnel'}, bosque: {n: 'Bosque', art: 'el bosque'},
  orilla: {n: 'Orilla', art: 'la orilla'}, puente: {n: 'Puente', art: 'el puente del lago'}, pistas: {n: 'Pistas', art: 'las pistas de esquí'}, lago: {n: 'Lago', art: 'el lago'},
  monte: {n: 'Montaña', art: 'la montaña'}, valle: {n: 'Valle', art: 'el valle'},
};
const F_HILL = {id: 'colina', from: [-19.5, 3], to: [17, -43.2], opts: ['tunel', 'bosque'], pts: [[-25, -12, 1.2], [-33, -27, 1.6], [-32, -44, 2], [-19, -57, 2.3], [-3, -58, 2.5], [8, -49, 2.7]]};
const F_HILL3 = {...F_HILL, to: [22, -52], pts: [[-25, -12, 1.2], [-33, -27, 1.6], [-34, -46, 2], [-22, -61, 2.4], [-4, -65, 2.8], [10, -59, 3.2]]};
const F_LAKE = {id: 'lago', from: [60, -21], to: [14, 77], opts: ['orilla', 'puente'], pts: [[68, -11, 3.8], [66, 3, 3.6], [56, 14, 3.5], [49, 27, 3.4], [45.5, 41, 3.4], [44, 55, 3.4], [43, 67, 3.5], [38, 78, 3.6], [29, 83.5, 3.8]]};
const F_LAKE3 = {id: 'lago', from: [50, -56], to: [14, 77], opts: ['pistas', 'lago'], pts: [[63, -50, 5.6], [70, -38, 5], [70, -22, 4.4], [66, -5, 3.8], [57, 12, 3.5], [49, 27, 3.4], [45.5, 41, 3.4], [44, 55, 3.4], [43, 67, 3.5], [38, 78, 3.6], [29, 83.5, 3.8]]};
const F_MONT = {id: 'monte', from: [-57, 23], to: [-91, 79], opts: ['monte', 'valle'], pts: [[-71, 19.5, 8.3], [-85, 22, 7.3], [-97, 31, 6.1], [-104, 44, 4.9], [-104, 58, 3.6], [-98, 70, 2.5]]};
export const FORKS = [[F_HILL], [F_HILL, F_LAKE], [F_HILL, F_LAKE, F_MONT], [F_HILL3, F_LAKE3, F_MONT]];

function heads(x, y, z, a, p, N) {for (let i = 0; i < N; i++) {const q = (i + 1) % N, b = (i - 1 + N) % N, dx = x[q] - x[b], dz = z[q] - z[b]; a[i] = Math.atan2(dz, dx); p[i] = Math.atan2(y[q] - y[b], Math.hypot(dx, dz))}}
function runsOf(k, N) {
  const out = []; let s = 0; while (s < N && k[s] === k[(s - 1 + N) % N]) s++; if (s >= N) return [{k: k[0], i: 0, n: N}];
  for (let c = 0; c < N;) {const i = (s + c) % N, kk = k[i]; let n = 0; while (n < N - c && k[(i + n) % N] === kk) n++; out.push({k: kk, i, n}); c += n} return out;
}
/* túnel, puente o a ras según lo lejos que quede el relieve natural */
function classify(x, y, z, N, ds) {
  const k = new Uint8Array(N), wet = new Uint8Array(N);
  for (let i = 0; i < N; i++) {const g = H0(x[i], z[i]), d = g - y[i]; k[i] = d > TUN_DY ? KT : d < -BR_DY ? KB : KG; wet[i] = g < LAKE_Y - 0.3 && d < -1.2 ? 1 : 0}
  // sobre el agua siempre hay puente (un puentecito sobre el arroyo), con 4 m de estribo a cada lado
  for (let i = 0; i < N; i++) if (wet[i]) for (let q = -8; q <= 8; q++) {const j = (i + q + N) % N; if (k[j] === KG) k[j] = KB}
  const minLen = {[KT]: 16 / ds, [KB]: 6 / ds};
  for (const r of runsOf(k, N)) if (r.k !== KG && r.n < minLen[r.k]) for (let j = 0; j < r.n; j++) k[(r.i + j) % N] = KG;
  for (const r of runsOf(k, N)) if (r.k === KG && r.n < 6 / ds) {const prev = k[(r.i - 1 + N) % N], next = k[(r.i + r.n) % N]; if (prev === next && prev !== KG) for (let j = 0; j < r.n; j++) k[(r.i + j) % N] = prev}
  return k;
}
function buildTrack3(pts) {
  const curve = new CatmullRomCurve3(pts.map(p => new Vector3(p[0], p[2], p[1])), true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / STEP), sp = curve.getSpacedPoints(N), ds = L / N;
  const x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N), a = new Float32Array(N), p = new Float32Array(N);
  for (let i = 0; i < N; i++) {x[i] = sp[i].x; y[i] = sp[i].y; z[i] = sp[i].z}
  heads(x, y, z, a, p, N);
  const k = classify(x, y, z, N, ds);
  for (let j = -20; j <= 30; j++) k[(j + N) % N] = KG; // el taller siempre a ras
  return {x, y, z, a, p, k, N, L, ds, runs: runsOf(k, N).filter(r => r.k !== KG)};
}
/* ramal de una aguja: sale y entra pegado a la vía principal (comparte los primeros y los últimos metros) */
function buildAlt(T, f) {
  const near = ([px, pz]) => {let m = 1e9, bi = 0; for (let i = 0; i < T.N; i++) {const d = Math.hypot(T.x[i] - px, T.z[i] - pz); if (d < m) {m = d; bi = i}} return bi};
  const i0 = near(f.from), i1 = near(f.to), P = i => new Vector3(T.x[i], T.y[i], T.z[i]), m = s => Math.round(s / T.ds);
  // curva por los puntos, remuestreada cada 3 m y suavizada (energía de flexión) con los extremos clavados en la vía principal
  const c0 = new CatmullRomCurve3([P(i0 - m(9)), P(i0), ...f.pts.map(p => new Vector3(p[0], p[2], p[1])), P(i1), P(i1 + m(9))], false, 'centripetal'), n0 = f.pts.length + 3, M0 = 600, W = [], al = [0];
  for (let q = 0; q <= M0; q++) {W.push(c0.getPoint((1 + (n0 - 2) * q / M0) / n0)); if (q) al.push(al[q - 1] + W[q].distanceTo(W[q - 1]))}
  const nC = Math.round(al[M0] / 3), C = [P(i0 - m(9)), P(i0 - m(6)), P(i0 - m(3)), P(i0), P(i0 + m(3))];
  for (let i = 2, q = 0; i <= nC - 2; i++) {const s = i / nC * al[M0]; while (al[q + 1] < s) q++; C.push(W[q].clone().lerp(W[q + 1], (s - al[q]) / (al[q + 1] - al[q])))}
  C.push(P(i1 - m(3)), P(i1), P(i1 + m(3)), P(i1 + m(6)), P(i1 + m(9)));
  for (let it = 0; it < 1600; it++) {const D = C.map(v => v.clone()); for (let i = 5; i < C.length - 5; i++) for (const k of ['x', 'y', 'z']) C[i][k] = D[i][k] - 0.06 * (D[i - 2][k] - 4 * D[i - 1][k] + 6 * D[i][k] - 4 * D[i + 1][k] + D[i + 2][k])}
  const ctrl = C.slice(2, -2), c = new CatmullRomCurve3(ctrl, false, 'centripetal'), n = ctrl.length - 1, Q = [], t0 = 1 / n, t1 = (n - 1) / n, K = 1600, acc = [0];
  for (let q = 0; q <= K; q++) {Q.push(c.getPoint(t0 + (t1 - t0) * q / K)); if (q) acc.push(acc[q - 1] + Q[q].distanceTo(Q[q - 1]))}
  const N = Math.round(acc[K] / T.ds), x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N);
  for (let i = 0, q = 0; i < N; i++) {const s = i / N * acc[K]; while (acc[q + 1] < s) q++; const t = (s - acc[q]) / (acc[q + 1] - acc[q]); x[i] = lerp(Q[q].x, Q[q + 1].x, t); y[i] = lerp(Q[q].y, Q[q + 1].y, t); z[i] = lerp(Q[q].z, Q[q + 1].z, t)}
  return {i0, i1, N, x, y, z, k: null};
}
/* una vuelta completa: la vía principal, cambiada por el ramal en las agujas del bit a 1 */
function buildRoute(T, alts, bits) {
  if (!bits) return Object.assign(T, {bits: 0, fs: alts.map(A => A.i0 * T.ds), ms: alts.map(A => A.i1 * T.ds), alt: alts.map(() => null)});
  const src = [], fs = [], ms = [], alt = [];   // [tramo: -1 principal o nº de aguja, muestra]
  for (let i = 0; i < T.N;) {const f = alts.findIndex(A => A.i0 === i); if (f < 0) {src.push([-1, i++]); continue}
    const A = alts[f]; fs[f] = src.length; if (bits >> f & 1) {alt[f] = src.length; for (let q = 0; q < A.N; q++) src.push([f, q])} else {alt[f] = null; for (let q = A.i0; q < A.i1; q++) src.push([-1, q])}
    ms[f] = src.length; i = A.i1}
  const N = src.length, pick = key => {const o = new Float32Array(N); src.forEach(([f, i], j) => {o[j] = (f < 0 ? T : alts[f])[key][i]}); return o}, x = pick('x'), y = pick('y'), z = pick('z'), a = new Float32Array(N), p = new Float32Array(N), k = new Uint8Array(N);
  heads(x, y, z, a, p, N);
  // el tipo de cada tramo no cambia según por dónde se llegue: se calcula una vez por tramo
  if (alts.some((A, f) => bits >> f & 1 && !A.k)) {const kk = classify(x, y, z, N, T.ds); alts.forEach((A, f) => {if (bits >> f & 1 && !A.k) A.k = kk.slice(alt[f], alt[f] + A.N)})}
  src.forEach(([f, i], j) => {k[j] = (f < 0 ? T : alts[f]).k[i]});
  return {x, y, z, a, p, k, N, L: N * T.ds, ds: T.ds, bits, fs: fs.map(i => i * T.ds), ms: ms.map(i => i * T.ds), alt: alt.map(i => i === null ? null : i * T.ds), runs: runsOf(k, N).filter(r => r.k !== KG)};
}
const wrapA = a => {while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a};
export const idxM = (T, s) => Math.floor((((s % T.L) + T.L) % T.L) / T.ds) % T.N;
export const atM = (T, s) => {s = ((s % T.L) + T.L) % T.L; const f = s / T.ds, i = Math.floor(f) % T.N, j = (i + 1) % T.N, t = f - Math.floor(f);
  return {x: lerp(T.x[i], T.x[j], t), y: lerp(T.y[i], T.y[j], t), z: lerp(T.z[i], T.z[j], t), a: T.a[i] + wrapA(T.a[j] - T.a[i]) * t, p: lerp(T.p[i], T.p[j], t), k: T.k[i]}};
export const kindAt = (T, s) => T.k[idxM(T, s)];

/* ================= el suelo con la vía: rejilla de muestras para buscar la vía más cercana ================= */
const GC = 8;
/* todas las muestras sin repetir (la vía principal y los ramales); b es el tramo (0 principal, f + 1 ramal) y q, los metros desde su comienzo */
function unionOf(T, alts) {
  const N = T.N + alts.reduce((n, A) => n + A.N, 0), U = {N, ds: T.ds, L: T.L, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), k: new Uint8Array(N), b: new Uint8Array(N), q: new Float32Array(N), alts};
  let o = 0; [T, ...alts].forEach((B, b) => {for (let i = 0; i < B.N; i++, o++) {U.x[o] = B.x[i]; U.y[o] = B.y[i]; U.z[o] = B.z[i]; U.k[o] = B.k[i]; U.b[o] = b; U.q[o] = i * T.ds}});
  return U;
}
/* metros por la vía entre dos muestras (por el camino más corto) */
function alongD(U, i, j) {
  if (U.b[i] > U.b[j]) [i, j] = [j, i];
  const d = Math.abs(U.q[i] - U.q[j]);
  if (U.b[i] === U.b[j]) return U.b[i] ? d : Math.min(d, U.L - d);
  const w = x => {x = Math.abs(x); return Math.min(x, U.L - x)}, f = m => {const A = U.alts[U.b[m] - 1]; return [[A.i0 * U.ds, U.q[m]], [A.i1 * U.ds, A.N * U.ds - U.q[m]]]}, ends = f(j);
  if (!U.b[i]) return Math.min(...ends.map(([s, e]) => w(U.q[i] - s) + e));
  return Math.min(...f(i).flatMap(([s, e]) => ends.map(([s2, e2]) => w(s - s2) + e + e2)));
}
function sampleGrid(T) {
  const g = new Map();
  for (let i = 0; i < T.N; i += 2) {const key = Math.floor(T.x[i] / GC) * 8192 + Math.floor(T.z[i] / GC); let l = g.get(key); if (!l) g.set(key, l = []); l.push(i)}
  return g;
}
/* distancia a la vía más cercana (de cualquier tipo) y su índice en la unión de tramos */
export function nearTrack(G, x, z, rmax = 16) {
  const T = G.T, cx = Math.floor(x / GC), cz = Math.floor(z / GC), R = Math.ceil(rmax / GC); let m = rmax * rmax, bi = -1;
  for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {const l = G.grid.get((cx + a) * 8192 + cz + b); if (l) for (const i of l) {const dx = T.x[i] - x, dz = T.z[i] - z, d = dx * dx + dz * dz; if (d < m) {m = d; bi = i}}}
  return {d: bi < 0 ? rmax : Math.sqrt(m), i: bi};
}
/* ¿pasa otro tramo de la vía a menos de r de (x, z)? Otro = a más de far metros siguiendo la vía desde la muestra i, o del ramal de al lado */
export function otherNear(G, i, x, z, r, far = 30) {
  const T = G.T, cx = Math.floor(x / GC), cz = Math.floor(z / GC), R2 = r * r;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {const l = G.grid.get((cx + a) * 8192 + cz + b); if (l) for (const j of l) if ((T.x[j] - x) ** 2 + (T.z[j] - z) ** 2 < R2 && alongD(T, i, j) > far) return true}
  return false;
}
/* ¿hay, a la misma altura, vía de otro tramo (la de la aguja) a menos de r? Los pretiles de los puentes se abren ahí */
export function branchNear(G, b, x, y, z, r) {
  const T = G.T, cx = Math.floor(x / GC), cz = Math.floor(z / GC), R2 = r * r;
  for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {const l = G.grid.get((cx + u) * 8192 + cz + v); if (l) for (const j of l) if (T.b[j] !== b && Math.abs(T.y[j] - y) < 3 && (T.x[j] - x) ** 2 + (T.z[j] - z) ** 2 < R2) return true}
  return false;
}
const RMAX = CORR + FALL + 14;
function groundH(G, x, z) {
  // cada muestra de vía a ras cercana tira del suelo hacia su altura; donde se solapan dos tramos a distinta altura,
  // la altura se reparte con pesos muy marcados (w^6): sale una ladera suave en vez de un escalón
  const T = G.T, h0 = H0(x, z), cx = Math.floor(x / GC), cz = Math.floor(z / GC), dry = Math.min(sstep(1.15, 1.6, lakeE(x, z)), sstep(LAKE_Y - 0.6, LAKE_Y + 0.4, h0));
  let dg = RMAX * RMAX, dt = RMAX * RMAX, W = 0, sw = 0, sy = 0;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {const l = G.grid.get((cx + a) * 8192 + cz + b); if (!l) continue;
    for (const i of l) {const dx = T.x[i] - x, dz = T.z[i] - z, d2 = dx * dx + dz * dz, kk = T.k[i]; if (kk === KT) {if (d2 < dt) dt = d2; continue} if (kk !== KG || d2 > RMAX * RMAX) continue;
      if (d2 < dg) dg = d2; const up = T.y[i] - h0;
      const w = (1 - sstep(CORR, CORR + FALL + Math.min(10, Math.max(0, up) * 2.2), Math.sqrt(d2))) * (up > 0 ? dry : 1); if (w <= 0) continue;   // el agua no se rellena
      const q = w ** 6; sw += q; sy += q * (T.y[i] - 0.06); if (w > W) W = w}}
  let h = h0;
  if (sw > 0 && dg <= dt) h = lerp(h0, sy / sw, W);
  for (const p of G.pads) {const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 5) h = lerp(h, p.y, 1 - sstep(p.r, p.r + 5, d))}
  return h;
}

/* huecos para casas junto a la vía: a ras, lejos del resto de la vía, del lago, de la pista y de la plaza */
function slotsFor(T, G, gap, s0 = 30, s1 = T.L - 24, out = []) {
  const n0 = out.length; let side = 1;
  const okRun = s => {for (let q = -7; q <= 7; q += 1) if (kindAt(T, s + q) !== KG) return false; return true};
  for (let s = s0; s <= s1; s += gap) {
    if (!okRun(s)) continue;
    const p = atM(T, s), nx = -Math.sin(p.a), nz = Math.cos(p.a);
    for (const sd of [side, -side]) {
      const x = p.x + nx * HOUSE_OFF * sd, z = p.z + nz * HOUSE_OFF * sd;
      if (nearTrack(G, x, z, 12).d < HOUSE_OFF - 0.6) continue;
      if (lakeE(x, z) < 1.55 || pisteD(x, z) < 12 || Math.hypot(x - F.plaza.x, z - F.plaza.z) < F.plaza.r + 7) continue;
      if (Math.abs(groundH(G, x, z) - p.y) > 3 || out.some(o => Math.hypot(o.x - x, o.z - z) < 12.5)) continue;
      out.push({s, x, z, y: p.y, a: p.a, nx: nx * sd, nz: nz * sd, side: sd}); side = -side; break;
    }
  }
  return out.slice(n0);
}

export const MAXSTAGE = STAGES.length - 1;
const cache = {};
/* todo lo de una etapa: vía principal (T), ramales, vueltas posibles (R, por bits de agujas), agujas, huecos de casas, plaza, taller y la altura del suelo */
export function mapOf(k) {
  if (cache[k]) return cache[k];
  const T = buildTrack3(STAGES[k]), alts = FORKS[k].map(f => buildAlt(T, f)), nR = 1 << alts.length, R = [buildRoute(T, alts, 0)];
  alts.forEach((A, f) => {R[1 << f] = buildRoute(T, alts, 1 << f)});
  for (let b = 1; b < nR; b++) if (!R[b]) R[b] = buildRoute(T, alts, b);
  const U = unionOf(T, alts), G = {T: U, grid: sampleGrid(U), pads: []};
  const p0 = atM(T, 0), sx = -Math.sin(p0.a), sz = Math.cos(p0.a);
  const out = Math.hypot(p0.x + sx * 8 - F.plaza.x, p0.z + sz * 8 - F.plaza.z) < Math.hypot(p0.x - sx * 8 - F.plaza.x, p0.z - sz * 8 - F.plaza.z) ? 1 : -1;
  const st = {x: p0.x + sx * out * 8.2, z: p0.z + sz * out * 8.2, y: p0.y, a: p0.a, nx: sx * out, nz: sz * out};   // taller por dentro del lóbulo del pueblo, mirando a la plaza
  G.pads.push({x: st.x, z: st.z, r: 11, y: p0.y}, {x: F.plaza.x, z: F.plaza.z, r: F.plaza.r, y: H0(F.plaza.x, F.plaza.z) * 0.3});
  // huecos de casas: en la vía principal y en los ramales, mezclados para que el pueblo crezca por todas partes
  const all = [], groups = [slotsFor(T, G, 15, 30, T.L - 24, all)];
  groups[0].forEach(s => {s.f = alts.findIndex(A => s.s > A.i0 * T.ds && s.s < A.i1 * T.ds); s.side1 = 0});
  alts.forEach((A, f) => {const B = R[1 << f], g = slotsFor(B, G, 15, B.alt[f] + 16, B.alt[f] + A.N * T.ds - 16, all); g.forEach(s => {s.f = f; s.side1 = 1}); groups.push(g)});
  const SL = groups.flatMap(g => g.map((s, i) => [(i + 0.5) / g.length, s])).sort((a, b) => a[0] - b[0]).map(q => q[1]);
  // s de cada hueco en cada vuelta posible (-1 si esa vuelta no pasa por él)
  for (const sl of SL) sl.rs = R.map(q => {if (sl.f >= 0 && (q.bits >> sl.f & 1) !== sl.side1) return -1; if (sl.side1) return q.alt[sl.f] + (sl.s - R[1 << sl.f].alt[sl.f]);
    let s = sl.s; alts.forEach((A, f) => {if (A.i1 * T.ds <= sl.s && q.bits >> f & 1) s += (A.N - (A.i1 - A.i0)) * T.ds}); return s});
  for (const s of SL) G.pads.push({x: s.x, z: s.z, r: 5.4, y: s.y});
  // agujas: nombres, y si el ramal sale a la izquierda o a la derecha
  const forks = alts.map((A, f) => {const B = R[1 << f], s = A.i0 * T.ds, m = atM(T, s + 24), a = atM(B, B.alt[f] + 24), p = atM(T, s);
    const right = (a.x - m.x) * -Math.sin(p.a) + (a.z - m.z) * Math.cos(p.a) > 0;
    return {f, id: FORKS[k][f].id, x: p.x, y: p.y, z: p.z, a: p.a, opts: FORKS[k][f].opts.map(o => ({id: o, ...OPT[o]})), left: right ? 0 : 1, len: [(A.i1 - A.i0) * T.ds, A.N * T.ds]}});
  const m = {k, T, R, alts, forks, U, G, SL, st, h: (x, z) => groundH(G, x, z)};
  return cache[k] = m;
}
export const trackOf = k => mapOf(k).T;
export const slotsOf = k => mapOf(k).SL;
