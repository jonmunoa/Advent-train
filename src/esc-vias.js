/* Los 24 circuitos de los escaparates (uno por día), sin DOM ni WebGL: relieve, vía (con su altura), túneles, puentes y suelo adaptado.
   Cada maqueta es un tablero de 176 × 84 (x: izquierda-derecha, z: fondo-cristal, y: altura). El cristal queda en z = +42. */
import {CatmullRomCurve3, Vector3} from 'three';
import {atM, kindAt, idxM, vnoise, fbm, sstep} from './tren-map.js';
export {atM, kindAt, idxM};

const lerp = (a, b, t) => a + (b - a) * t;
export const BW = 88, BD = 42, STEP = 0.5, ICE_Y = -0.9;
export const KG = 0, KT = 1, KB = 2;                 // a ras, túnel, puente
export const CORR = 3.4, FALL = 6.5, TUN = 6.6, BR = 3.4;   // la vía allana ±CORR y funde hasta CORR+FALL; túnel si el monte queda TUN por encima y puente si el suelo queda BR por debajo
const bump = (x, z, [cx, cz, rx, rz, h, k]) => {const u = Math.hypot((x - cx) / rx, (z - cz) / rz); return u >= 1 ? 0 : h * Math.pow(1 - u, k)};
function segD(x, z, P) {
  let m = 1e9;
  for (let i = 0; i < P.length - 1; i++) {const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t))}
  return m;
}
const ell = (x, z, [cx, cz, rx, rz]) => Math.hypot((x - cx) / rx, (z - cz) / rz);
const soft = (x, z, a = 1) => (fbm(x * 0.03 + 11, z * 0.03) - 0.45) * 2 * a;
/* la nieve se dobla un poco hacia el canto del tablero y sube en rampa hacia el fondo, para que todo se vea desde el cristal */
const rake = (z, h) => sstep(16, -40, z) * h;

const BASE = [
  /* ================= 1 · el pueblo de Navidad ================= */
  {
    id: 'pueblo', nombre: 'El pueblo de Navidad', wagons: 4,
    hills: [[52, -31, 36, 25, 27, 1.15], [-82, -36, 26, 20, 12, 1.3]],
    river: [[10, -46], [4, -26], [8, -8], [18, 6], [27, 16]], pond: [33, 21, 19, 8.5], plaza: [-28, 24, 11],
    pts: [[-46, 35.5, 1], [-4, 36.5, 1], [40, 35.5, 1], [69, 27.5, 1.8], [81, 8, 3], [76, -14, 4.6], [58, -28, 5.8], [34, -34, 6.8], [6, -34, 7.6], [-24, -35, 8.4], [-54, -33, 9], [-76, -18, 9.4], [-78, 0, 9.4], [-63, 12.5, 9.4], [-36, 11, 9.2], [-8, 8, 9], [20, 9, 8.6], [40, 9.5, 7.8], [54, 5, 7], [58, -5, 6.4], [51, -14, 5.8], [34, -17.5, 5.2], [12, -15.5, 4.6], [-12, -12, 3.8], [-36, -13, 3], [-56, -8, 2.2], [-70, 3, 1.6], [-79, 14, 1.3], [-79, 26, 1.1], [-69, 34, 1]],
    h0(x, z) {
      let h = soft(x, z, 0.7) + rake(z, 6); for (const b of this.hills) h = Math.max(h, 0) + bump(x, z, b) * 0.92;
      h -= 7 * Math.exp(-((segD(x, z, this.river) / 4.2) ** 2));
      const e = ell(x, z, this.pond); if (e < 1.35) h = lerp(h, -1.3, sstep(1.35, 0.98, e));
      const d = Math.hypot(x - this.plaza[0], z - this.plaza[1]); if (d < this.plaza[2] + 6) h = lerp(h, 0.5, sstep(this.plaza[2] + 6, this.plaza[2], d));
      return h;
    },
  },
  /* ================= 2 · la estación de esquí ================= */
  {
    id: 'esqui', nombre: 'La montaña nevada', wagons: 4,
    hills: [[0, -33, 48, 42, 60, 1.22], [-63, -36, 33, 30, 38, 1.15], [62, -38, 36, 32, 42, 1.15]], gorges: [[-34, -46, -30, 12], [35, -46, 31, 12]],
    pond: [14, 19, 27, 9.5], piste: [[3, -33], [-9, -22], [9, -11], [-4, 1], [4, 9]], lift: [[-25, 7], [-6, -27]],
    pts: [[-56, 36, 1], [-10, 37, 1], [36, 36, 1.2], [67, 28, 2.6], [81, 6, 4.8], [75, -16, 6.8], [55, -29, 8.6], [30, -30, 10], [4, -27, 11], [-20, -28, 10.8], [-44, -32, 9.8], [-66, -27, 8], [-81, -9, 5.7], [-82, 13, 3.5], [-74, 30, 1.7]],
    h0(x, z) {
      const n = vnoise(x * 0.11, z * 0.11) - 0.5; let h = 0; for (const b of this.hills) {const q = bump(x, z, b); const r1 = 1 - Math.abs(2 * vnoise(x * 0.09 + 5, z * 0.09) - 1), k = sstep(5, 22, q); h = Math.max(h, q * (0.9 + 0.16 * n) + k * ((r1 - 0.5) * 5 + (vnoise(x * 0.34, z * 0.34) - 0.5) * 2.2))}
      h += soft(x, z, 0.7) + rake(z, 4);
      for (const [x0, z0, x1, z1] of this.gorges) h -= 17 * Math.exp(-((segD(x, z, [[x0, z0], [x1, z1]]) / 5.2) ** 2)) * sstep(16, -8, z);
      const w = 1 - sstep(3.2, 6.5, segD(x, z, this.piste)), base = bump(x, z, this.hills[0]); if (w > 0 && base > 0) h = lerp(h, base * 0.95 + 1.5, w);
      const e = ell(x, z, this.pond); if (e < 1.3) h = lerp(h, -1.3, sstep(1.3, 0.98, e));
      return Math.max(h, -4.5);
    },
  },
  /* ================= 3 · el Polo Norte y la fábrica de juguetes ================= */
  {
    id: 'polo', nombre: 'La fábrica de Papá Noel', wagons: 4,
    hills: [[58, -29, 33, 26, 32, 1.05], [-86, 4, 14, 22, 7, 1.4]], pond: [36, 13, 21, 10], fab: [-8, -27, 24, 11],
    pts: [[-58, 35, 1], [-24, 29, 1], [8, 36, 1], [44, 35, 1.2], [73, 27, 2.2], [82, 5, 4], [75, -18, 5.8], [54, -31, 7.2], [32, -24, 8.2], [23, -6, 8.8], [6, 8, 8.8], [-16, 9, 8.6], [-34, -2, 8.2], [-42, -20, 7.4], [-57, -34, 6.4], [-77, -25, 5], [-83, -3, 3.4], [-82, 18, 1.8], [-74, 30, 1.1]],
    h0(x, z) {
      const n = vnoise(x * 0.14 + 3, z * 0.14); let h = soft(x, z, 0.6) + rake(z, 3.4); for (const b of this.hills) {const q = bump(x, z, b); h += q * (0.9 + 0.2 * n)}
      const e = ell(x, z, this.pond); if (e < 1.35) h = lerp(h, -1.3, sstep(1.35, 0.98, e));
      const [fx, fz, rx, rz] = this.fab, d = Math.max(Math.abs(x - fx) / rx, Math.abs(z - fz) / rz); if (d < 1.35) h = lerp(h, 3.2, sstep(1.35, 1, d));
      return h;
    },
  },
];

/* los tres de partida llevan su estilo (sem): 0 pueblo, 1 montaña, 2 polo. Los demás días salen de plantillas de vía con su tema */
BASE.forEach((m, i) => {m.sem = i});
const VIA = {
  oval: [[-56, 34.5, 1], [0, 36, 1], [56, 34.5, 1], [76, 22, 1.4], [80, 0, 2.4], [69, -21, 3.4], [40, -32, 4], [0, -34, 4.4], [-40, -32, 4], [-69, -21, 3.2], [-80, 0, 2.2], [-76, 22, 1.4]],
  seno: [[-58, 35, 1], [-24, 30, 1], [8, 35.5, 1], [44, 35, 1.1], [72, 26, 1.8], [81, 4, 2.8], [74, -18, 3.8], [50, -32, 4.6], [20, -33, 5], [-10, -27, 5], [-40, -32, 4.6], [-68, -24, 3.6], [-80, -4, 2.4], [-80, 18, 1.5], [-73, 30, 1]],
  alto: [[-54, 36, 1], [-6, 37, 1], [40, 36, 1.4], [70, 27, 3], [81, 4, 5.4], [73, -18, 7.2], [46, -31, 8.4], [10, -32, 9], [-26, -32, 9], [-58, -28, 8], [-79, -9, 5.8], [-82, 13, 3.4], [-73, 30, 1.7]],
  ocho: BASE[0].pts,
};
const ele = (x, z, e) => Math.hypot((x - e[0]) / e[2], (z - e[1]) / e[3]);
/* relieve de las maquetas de plantilla: lomas, río, estanque, plaza y fábrica opcionales */
function h0T(x, z) {
  let h = soft(x, z, this.amp ?? 0.5) + rake(z, this.rake ?? 3.4); for (const b of this.hills) h = Math.max(h, 0) + bump(x, z, b) * 0.95;
  if (this.river) h -= (this.hondo ?? 7) * Math.exp(-((segD(x, z, this.river) / 4.4) ** 2));
  if (this.pond) {const e = ele(x, z, this.pond); if (e < 1.35) h = lerp(h, -1.3, sstep(1.35, 0.98, e))}
  if (this.plaza) {const d = Math.hypot(x - this.plaza[0], z - this.plaza[1]); if (d < this.plaza[2] + 6) h = lerp(h, this.plaza[3] ?? 0.5, sstep(this.plaza[2] + 6, this.plaza[2], d))}
  if (this.fab) {const [fx, fz, rx, rz] = this.fab, d = Math.max(Math.abs(x - fx) / rx, Math.abs(z - fz) / rz); if (d < 1.35) h = lerp(h, this.fabY ?? 2.4, sstep(1.35, 1, d))}
  return h;
}
const nuevo = (id, nombre, via, o = {}) => ({id, nombre, wagons: 4, sem: 0, hills: [], pts: VIA[via], h0: h0T, ...o});
/* la misma maqueta vista en un espejo (la vía se recorre igual) */
function espejo(b, id, nombre, o = {}) {
  const n = a => a && [-a[0], ...a.slice(1)], p = l => l && l.map(n);
  return {...b, id, nombre, pts: p(b.pts).reverse(), hills: p(b.hills), river: p(b.river), pond: n(b.pond), plaza: n(b.plaza), piste: p(b.piste), lift: p(b.lift), fab: n(b.fab), gorges: b.gorges && b.gorges.map(([a, c, d, e]) => [-a, c, -d, e]), h0(x, z) {return b.h0.call(b, -x, z)}, ...o};
}
const loma = (x, z, rx, rz, h, k = 1.1) => [x, z, rx, rz, h, k];
const [PUEBLO, ESQUI, POLO] = BASE;
/* un mapa por día de diciembre (índice = día - 1) */
export const MAPS = [
  PUEBLO,
  nuevo('confiteria', 'El país de los dulces', 'seno', {pond: [30, 12, 19, 8.5], hills: [loma(-52, -24, 24, 18, 9, 1.4)]}),
  nuevo('relojeria', 'El reloj de los reyes magos', 'oval', {hills: [loma(60, -30, 34, 24, 23)], plaza: [-6, -2, 20, 1.2]}),
  ESQUI,
  nuevo('libreria', 'El libro abierto', 'oval', {plaza: [0, 2, 34, 1.4], hills: [loma(-64, -30, 30, 22, 21)]}),
  nuevo('merceria', 'El valle de lana', 'seno', {hills: [loma(54, -30, 34, 24, 24), loma(-56, -10, 22, 16, 5, 1.4)]}),
  nuevo('tiovivo', 'La feria', 'alto', {sem: 1, plaza: [-4, 2, 30, 1.2], river: [[46, -46], [42, -20], [52, 6], [60, 22]]}),
  POLO,
  nuevo('correos', 'La estafeta de las cartas', 'seno', {hills: [loma(-58, -30, 32, 23, 23)], plaza: [10, 0, 18, 1.2]}),
  nuevo('ciudad', 'La ciudad de noche', 'alto', {river: [[-12, -46], [-8, -20], [2, 4], [-6, 26], [-22, 46]], hondo: 8, rake: 1.6, amp: 0.2}),
  nuevo('panaderia', 'El molino de pan', 'oval', {hills: [loma(54, -27, 34, 24, 24)], river: [[-30, -46], [-34, -18], [-26, 6], [-34, 26], [-40, 46]], hondo: 5}),
  nuevo('fotos', 'El estudio de fotografía', 'seno', {plaza: [0, 0, 26, 1.4], hills: [loma(62, -28, 26, 20, 18)]}),
  espejo(ESQUI, 'nevada', 'La gran nevada'),
  nuevo('jugueteria', 'El cuarto de los juguetes', 'ocho', {plaza: [-28, 24, 11], hills: [loma(52, -31, 36, 25, 27, 1.15)], rake: 6, amp: 0.5, pond: [33, 21, 16, 7]}),
  nuevo('zapateria', 'La ciudad zapato', 'oval', {hills: [loma(-58, -28, 34, 24, 24)], plaza: [22, 2, 22, 1.2]}),
  nuevo('luces', 'La fábrica de luz', 'seno', {hills: [loma(58, -30, 32, 24, 23)], plaza: [-8, 0, 24, 1.2]}),
  espejo(POLO, 'estrellas', 'El túnel de las estrellas'),
  {...PUEBLO, id: 'modelismo', nombre: 'El pueblo del modelista', h0(x, z) {return PUEBLO.h0.call(PUEBLO, x, z)}},
  nuevo('orquesta', 'La orquesta mecánica', 'oval', {plaza: [0, -2, 34, 1.6], hills: [loma(66, -30, 26, 20, 18)]}),
  nuevo('sastre', 'La sastrería', 'seno', {plaza: [0, 0, 30, 1.2], hills: [loma(-62, -30, 28, 21, 20)]}),
  nuevo('sombreros', 'El bosque de sombreros', 'oval', {hills: [loma(58, -29, 32, 23, 22), loma(-60, -26, 24, 18, 8, 1.4)]}),
  espejo(PUEBLO, 'terminal', 'La estación de verdad'),
  nuevo('pinturas', 'El cuadro sin acabar', 'seno', {hills: [loma(56, -30, 33, 24, 24)], pond: [-26, 8, 18, 8]}),
  nuevo('todos', 'Todos los trenes', 'ocho', {sem: 0, hills: [loma(52, -31, 36, 25, 27, 1.15), loma(-82, -36, 26, 20, 12, 1.3)], river: [[10, -46], [4, -26], [8, -8], [18, 6], [27, 16]], pond: [33, 21, 19, 8.5], plaza: [-28, 24, 11], rake: 6, amp: 0.7}),
];

/* vía cerrada: muestras cada medio metro con rumbo, pendiente y tipo de tramo */
export function buildVia(m) {
  const curve = new CatmullRomCurve3(m.pts.map(p => new Vector3(p[0], p[2], p[1])), true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / STEP), sp = curve.getSpacedPoints(N), ds = L / N, f = () => new Float32Array(N);
  const T = {x: f(), y: f(), z: f(), a: f(), p: f(), k: new Uint8Array(N), N, L, ds};
  for (let i = 0; i < N; i++) {T.x[i] = sp[i].x; T.y[i] = sp[i].y; T.z[i] = sp[i].z}
  // la altura se suaviza: nada de escalones en las pendientes
  for (let q = 0; q < 60; q++) {const y = T.y.slice(); for (let i = 0; i < N; i++) T.y[i] = (y[(i - 2 + N) % N] + y[(i - 1 + N) % N] + y[i] * 2 + y[(i + 1) % N] + y[(i + 2) % N]) / 6}
  for (let i = 0; i < N; i++) {const q = (i + 1) % N, b = (i - 1 + N) % N, dx = T.x[q] - T.x[b], dz = T.z[q] - T.z[b]; T.a[i] = Math.atan2(dz, dx); T.p[i] = Math.atan2(T.y[q] - T.y[b], Math.hypot(dx, dz));
    const d = m.h0(T.x[i], T.z[i]) - T.y[i]; T.k[i] = d > TUN ? KT : d < -BR ? KB : KG}
  const min = {[KT]: 14 / ds, [KB]: 7 / ds};
  for (let q = 0; q < 2; q++) {
    for (const r of runsOf(T)) if (r.k === KG && r.n < 5 / ds) {const a = T.k[(r.i - 1 + N) % N], b = T.k[(r.i + r.n) % N]; if (a === b && a !== KG) for (let j = 0; j < r.n; j++) T.k[(r.i + j) % N] = a}
    for (const r of runsOf(T)) if (r.k !== KG && r.n < min[r.k]) for (let j = 0; j < r.n; j++) T.k[(r.i + j) % N] = KG;
  }
  T.runs = runsOf(T).filter(r => r.k !== KG);
  // bajo los puentes el terraplén del estribo no llega a la vía: tope de suelo que baja poco a poco desde cada extremo
  T.cap = f(); for (const r of T.runs) if (r.k === KB) for (let j = 0; j < r.n; j++) {const i = (r.i + j) % N; T.cap[i] = T.y[i] - 0.06 - Math.min(1, Math.min(j, r.n - 1 - j) * ds * 0.24)}
  return T;
}
export function runsOf({k, N}) {
  const out = []; let s = 0; while (s < N && k[s] === k[(s - 1 + N) % N]) s++; if (s >= N) return [{k: k[0], i: 0, n: N}];
  for (let c = 0; c < N;) {const i = (s + c) % N, kk = k[i]; let n = 0; while (n < N - c && k[(i + n) % N] === kk) n++; out.push({k: kk, i, n}); c += n} return out;
}

const GC = 8, RM = CORR + FALL + 8;
function grid(T) {const g = new Map(); for (let i = 0; i < T.N; i += 2) {const k = Math.floor(T.x[i] / GC) * 8192 + Math.floor(T.z[i] / GC); let l = g.get(k); if (!l) g.set(k, l = []); l.push(i)} return g}
const cache = {};
export function mapaOf(q) {
  if (cache[q]) return cache[q];
  const m = MAPS[q], T = buildVia(m), g = grid(T), pads = [];
  const each = (x, z, R, fn) => {const cx = Math.floor(x / GC), cz = Math.floor(z / GC), n = Math.ceil(R / GC); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {const l = g.get((cx + a) * 8192 + cz + b); if (l) for (const i of l) fn(i, (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2)}};
  /* distancia a la vía más cercana (de cualquier tipo) */
  const near = (x, z, R = 16) => {let d = R * R, i = -1; each(x, z, R, (j, d2) => {if (d2 < d) {d = d2; i = j}}); return {d: i < 0 ? R : Math.sqrt(d), i}};
  /* ¿pasa otro tramo (a más de far metros por la vía) a menos de r? Para no poner pilas encima de la vía de abajo */
  const other = (i, x, z, r, far = 26) => {let hit = false; each(x, z, r, (j, d2) => {if (d2 < r * r) {let d = Math.abs(i - j); d = Math.min(d, T.N - d) * T.ds; if (d > far) hit = true}}); return hit};
  const wet = (x, z) => m.pond ? sstep(1.12, 1.5, ell(x, z, m.pond)) : 1;
  /* suelo con la vía: cada muestra a ras tira de él hacia su altura (w^6: ladera suave donde se solapan tramos a distinta altura); en los túneles no toca el monte */
  const h = (x, z) => {
    const h0 = m.h0(x, z); let dg = RM * RM, dt = RM * RM, W = 0, sw = 0, sy = 0, tope = 1e9;
    each(x, z, RM, (i, d2) => {if (T.k[i] === KT) {if (d2 < dt) dt = d2; return} if (T.k[i] === KB) {if (d2 < 20) tope = Math.min(tope, T.cap[i] + Math.max(0, Math.sqrt(d2) - CORR) * 1.4); return} if (d2 > RM * RM) return; if (d2 < dg) dg = d2;
      const up = T.y[i] - h0, w = (1 - sstep(CORR, CORR + FALL + Math.min(6, Math.max(0, up) * 1.6), Math.sqrt(d2))) * (up > 0 ? wet(x, z) : 1); if (w <= 0) return; const q6 = w ** 6; sw += q6; sy += q6 * (T.y[i] - 0.06); if (w > W) W = w});
    let y = sw > 0 && dg <= dt ? lerp(h0, sy / sw, W) : h0;
    for (const p of pads) {const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 3.5) y = lerp(y, p.y, 1 - sstep(p.r, p.r + 3.5, d))}
    return Math.min(y, tope);
  };
  return cache[q] = {...m, q, T, near, other, h, pads};
}
export const pondE = (m, x, z) => m.pond ? ell(x, z, m.pond) : 9;
export const pisteD = (m, x, z) => m.piste ? segD(x, z, m.piste) : 99;
export const riverD = (m, x, z) => m.river ? segD(x, z, m.river) : 99;
