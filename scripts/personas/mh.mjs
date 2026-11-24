/* MakeHuman (CC0) sin Blender: carga la malla base, aplica deformaciones (edad, sexo, peso, cara, gestos), ajusta pelo, ojos y demás
   a la persona y la deja en la pose de las figuras (brazos caídos, mirando a +X, metros). Datos en assets-src/makehuman (fuera de git). */
import {readFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), MH = join(ROOT, 'assets-src/makehuman'), DAT = join(MH, 'mpfb/mpfb2-master/src/mpfb/data'), SYS = join(MH, 'sys'), FU = join(MH, 'fu/targets/faceunits');

export function obj(f) {
  const v = [], vt = [], F = [], G = {}; let g = ''; for (const l of readFileSync(f, 'utf8').split('\n')) {const p = l.trim().split(/\s+/); if (p[0] === 'v') v.push(+p[1], +p[2], +p[3]); else if (p[0] === 'vt') vt.push(+p[1], +p[2]); else if (p[0] === 'g') g = p.slice(1).join(' '); else if (p[0] === 'f') {const q = p.slice(1).map(s => s.split('/').map(n => n ? +n - 1 : -1)); F.push({g, v: q.map(s => s[0]), t: q.map(s => s[1] ?? -1)}); (G[g] ||= new Set()); q.forEach(s => G[g].add(s[0]))}} return {v: Float64Array.from(v), vt, F, G};
}
export const BASE = obj(join(DAT, '3dobjs/base.obj'));
const TC = new Map();
export function target(f) {if (TC.has(f)) return TC.get(f); const t = (f.endsWith('.gz') ? gunzipSync(readFileSync(f)) : readFileSync(f)).toString('utf8'), o = []; for (const l of t.split('\n')) {if (!l || l[0] === '#' || l[0] === '"') continue; const p = l.trim().split(/\s+/); if (p.length >= 4) o.push([+p[0], +p[1], +p[2], +p[3]])} TC.set(f, o); return o}
const suma = (v, f, w) => {if (!w) return; for (const [i, x, y, z] of target(f)) {v[i * 3] += x * w; v[i * 3 + 1] += y * w; v[i * 3 + 2] += z * w}};
const T = (...p) => join(DAT, 'targets', ...p);
/* edad en años; genero 0 mujer – 1 hombre; peso y musculo 0–1 (0,5 normal); altura −1…1; extra: {'nose/nose-hump-decr': .4, …} */
export function persona({edad, genero, peso = .5, musculo = .5, altura = 0, propor = .6, extra = {}}) {
  const v = Float64Array.from(BASE.v), a = edad < 10 ? (edad - 1) / 9 * .1875 : edad < 25 ? .1875 + (edad - 10) / 15 * .3125 : .5 + (edad - 25) / 65 * .5, E = a < .5 ? (() => {const y = Math.max(0, (a - .1875) * 3.2); return {baby: Math.max(0, 1 - a * 5.333), young: y, child: Math.max(0, Math.min(1, 5.333 * a) - y), old: 0}})() : {baby: 0, child: 0, old: a * 2 - 1, young: 2 - a * 2};
  const S = {male: genero, female: 1 - genero}, tri = (x, b) => x < .5 ? {['min' + b]: 1 - x * 2, ['average' + b]: x * 2} : {['average' + b]: 2 - x * 2, ['max' + b]: x * 2 - 1}, M = tri(musculo, 'muscle'), W = tri(peso, 'weight');
  for (const s in S) for (const e in E) {const w = S[s] * E[e]; if (w < 1e-3) continue; suma(v, T('macrodetails', `caucasian-${s}-${e}.target.gz`), w); for (const m in M) for (const p in W) {const q = w * M[m] * W[p]; if (q < 1e-3) continue; const u = T('macrodetails', `universal-${s}-${e}-${m}-${p}.target.gz`); if (existsSync(u)) suma(v, u, q); if (altura) {const h = T('macrodetails/height', `${s}-${e}-${m}-${p}-${altura > 0 ? 'max' : 'min'}height.target.gz`); if (existsSync(h)) suma(v, h, q * Math.abs(altura))} const pr = T('macrodetails/proportions', `${s}-${e}-${m}-${p}-${propor >= .5 ? 'ideal' : 'uncommon'}proportions.target.gz`); if (existsSync(pr)) suma(v, pr, q * Math.abs(propor - .5) * 2)}}
  for (const k in extra) {const f = T(k + '.target.gz'); if (!existsSync(f)) {console.warn('falta', k); continue} suma(v, f, extra[k])} return v;
}
/* suma de gestos (ARKit) como desplazamientos sobre la malla base */
export function gesto(mez) {const d = new Float64Array(BASE.v.length); for (const k in mez) {const f = join(FU, k + '.target'); if (!existsSync(f)) {console.warn('falta gesto', k); continue} suma(d, f, mez[k])} return d}

/* ---------- esqueleto y pose ---------- */
const RIG = JSON.parse(readFileSync(join(DAT, 'rigs/standard/rig.game_engine.json'))), PES = JSON.parse(readFileSync(join(DAT, 'rigs/standard/weights.game_engine.json'))).weights;
export const cubo = (v, n) => {const s = BASE.G[n], c = [0, 0, 0]; for (const i of s) for (let k = 0; k < 3; k++) c[k] += v[i * 3 + k] / s.size; return c};
const joint = (v, b, e = 'head') => {const q = RIG[b][e]; return q.strategy === 'CUBE' ? cubo(v, q.cube_name) : q.vertex_indices.reduce((c, i) => c.map((x, k) => x + v[i * 3 + k] / q.vertex_indices.length), [0, 0, 0])};
const sub = (a, b) => a.map((x, i) => x - b[i]), len = a => Math.hypot(...a), nor = a => {const l = len(a) || 1; return a.map(x => x / l)}, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/* matrices 3×4 por filas */
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], mulv = (m, p) => [0, 4, 8].map(r => m[r] * p[0] + m[r + 1] * p[1] + m[r + 2] * p[2] + m[r + 3]), mul = (a, b) => {const o = new Array(12); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0); return o};
const giro = (a, b) => {a = nor(a); b = nor(b); const v = cross(a, b), c = dot(a, b); if (c < -.9999) return [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0]; const k = 1 / (1 + c); return [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1], 0, v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0], 0, v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c, 0]};
const ejeAng = (u, a) => {u = nor(u); const c = Math.cos(a), s = Math.sin(a), k = 1 - c; return [c + u[0] * u[0] * k, u[0] * u[1] * k - u[2] * s, u[0] * u[2] * k + u[1] * s, 0, u[1] * u[0] * k + u[2] * s, c + u[1] * u[1] * k, u[1] * u[2] * k - u[0] * s, 0, u[2] * u[0] * k - u[1] * s, u[2] * u[1] * k + u[0] * s, c + u[2] * u[2] * k, 0]};
const sobre = (R, p, q) => {const t = mulv(R, p); const m = R.slice(); m[3] = q[0] - t[0]; m[7] = q[1] - t[1]; m[11] = q[2] - t[2]; return m};   // gira alrededor de p y lo lleva a q
/* huesos nuestros: índice en Figura.huesos */
export const HU = {b: 0, cad: 1, tro: 2, head: 3, armL: 4, armR: 5, anteL: 6, anteR: 7, handL: 8, handR: 9, legL: 10, legR: 11, rodL: 12, rodR: 13, pieL: 14, pieR: 15, falL: 16, falR: 17};
const MAPA = b => {const s = b.endsWith('_l') ? 'L' : 'R'; if (b === 'head') return 'head'; if (b === 'Root' || b === 'pelvis') return 'cad'; if (b.startsWith('spine') || b.startsWith('clavicle') || b === 'neck_01') return 'tro'; if (b.startsWith('upperarm')) return 'arm' + s; if (b.startsWith('lowerarm')) return 'ante' + s; if (b.startsWith('thigh')) return 'leg' + s; if (b.startsWith('calf')) return 'rod' + s; if (b.startsWith('foot') || b.startsWith('ball')) return 'pie' + s; return 'hand' + s};
/* pesos por vértice de la malla base */
const PV = (() => {const W = Array.from({length: BASE.v.length / 3}, () => []); for (const b in PES) for (const [i, w] of PES[b]) if (w > 0) W[i].push([b, w]); return W})();
export function posa(v, {abre = .1} = {}) {
  const J = {}; for (const b in RIG) J[b] = joint(v, b); const tail = b => joint(v, b, 'tail'), M = {}; for (const b in RIG) M[b] = I();
  for (const s of ['l', 'r']) {
    const sg = s === 'l' ? 1 : -1, A = 'upperarm_' + s, B = 'lowerarm_' + s, C = 'hand_' + s, dn = nor([sg * abre * .25, -1, 0]), R1 = giro(sub(J[B], J[A]), dn), m1 = sobre(R1, J[A], J[A]), el = mulv(m1, J[B]);
    // antebrazo: sigue al brazo y se endereza; la palma mira al muslo
    const d2 = mulv(R1, sub(J[C], J[B])), R2 = mul(giro(d2, nor([sg * abre * .1, -1, .0])), R1), mn = mulv(sobre(R2, J[B], el), J[C]); let nudo = sub(J['pinky_01_' + s], J['index_01_' + s]); let hd = mulv(R2, sub(J['middle_01_' + s], J[C])); let R3 = mul(giro(hd, [0, -1, 0]), R2), k = mulv(R3, nudo); const want = [0, 0, -1], ang = Math.atan2(k[0], k[2]) - Math.atan2(want[0], want[2]); R3 = mul(ejeAng([0, 1, 0], -ang), R3); const R2b = mul(ejeAng([0, 1, 0], -ang * .55), R2);
    M[A] = m1; M[B] = sobre(R2b, J[B], el); M[C] = sobre(R3, J[C], mn); for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) for (const n of ['01', '02', '03']) M[`${f}_${n}_${s}`] = M[C];
    const P = 'thigh_' + s, Q = 'calf_' + s, F = 'foot_' + s, L1 = len(sub(J[Q], J[P])), L2 = len(sub(J[F], J[Q])), Rp = giro(sub(J[Q], J[P]), [0, -1, 0]), kn = [J[P][0], J[P][1] - L1, J[P][2]], Rq = mul(giro(mulv(Rp, sub(J[F], J[Q])), [0, -1, 0]), Rp), an = [kn[0], kn[1] - L2, kn[2]]; M[P] = sobre(Rp, J[P], J[P]); M[Q] = sobre(Rq, J[Q], kn); M[F] = sobre(ejeAng([0, 1, 0], 0), J[F], an); M['ball_' + s] = M[F];
  }
  const o = new Float64Array(v.length); for (let i = 0; i < v.length / 3; i++) {const p = [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]; let x = 0, y = 0, z = 0, w = 0; for (const [b, k] of PV[i]) {const q = mulv(M[b], p); x += q[0] * k; y += q[1] * k; z += q[2] * k; w += k} if (!w) {const q = p; x = q[0]; y = q[1]; z = q[2]; w = 1} o[i * 3] = x / w; o[i * 3 + 1] = y / w; o[i * 3 + 2] = z / w}
  // al suelo y a nuestros ejes: X = adelante (z de MakeHuman), Z = −x; en metros
  let y0 = 1e9; for (const i of BASE.G.body) y0 = Math.min(y0, o[i * 3 + 1]); const J2 = {}; for (const b in RIG) J2[b] = mulv(M[b], J[b]); const ej = p => [p[2] * .1, (p[1] - y0) * .1, -p[0] * .1], R = new Float64Array(v.length); for (let i = 0; i < v.length / 3; i++) R.set(ej([o[i * 3], o[i * 3 + 1], o[i * 3 + 2]]), i * 3); for (const b in J2) J2[b] = ej(J2[b]); const E = ['joint-l-eye', 'joint-r-eye'].map(n => {const c = cubo(o, n); return ej(c)});
  // el centro de la figura, en la cadera
  const cx = (J2.thigh_l[0] + J2.thigh_r[0]) / 2; for (let i = 0; i < R.length; i += 3) R[i] -= cx; for (const b in J2) J2[b][0] -= cx; E.forEach(e => {e[0] -= cx});
  return {v: R, J: J2, ojos: E, M, aj: d => {/* gira un desplazamiento de la cara (no hay pose en la cabeza) */ return ej([d[0], d[1] + y0 / 1, d[2]])}, y0, cx};
}
/* pesos en nuestros huesos (máx. 4) para un vértice de la base */
export function pesos(i) {const q = {}; for (const [b, w] of PV[i]) {const k = MAPA(b); q[k] = (q[k] || 0) + w} const L = Object.entries(q).sort((a, b) => b[1] - a[1]).slice(0, 4), s = L.reduce((a, b) => a + b[1], 0) || 1; return L.map(([k, w]) => [HU[k], w / s])}
/* ---------- piezas ajustadas (pelo, ojos, pestañas…) ---------- */
export function mhclo(dir, nombre) {
  const f = join(dir, nombre + '.mhclo'), L = readFileSync(f, 'utf8').split('\n'), esc = {}, V = []; let of = nombre + '.obj', mat = null, en = false; for (const l of L) {const p = l.trim().split(/\s+/); if (p[0] === 'obj_file') of = p[1]; else if (p[0] === 'material') mat = p[1]; else if (/^[xyz]_scale$/.test(p[0])) esc[p[0][0]] = [+p[1], +p[2], +p[3]]; else if (p[0] === 'verts') en = true; else if (p[0] === 'delete_verts' || p[0] === 'weights') en = false; else if (en && /^\d+$/.test(p[0])) {const n = p.map(Number); V.push(n.length >= 9 ? {i: n.slice(0, 3), w: n.slice(3, 6), d: n.slice(6, 9)} : {i: [n[0], n[0], n[0]], w: [1, 0, 0], d: [0, 0, 0]})}}
  return {o: obj(join(dir, of)), V, esc, mat, dir};
}
/* ajusta sobre una malla base (en ejes de MakeHuman) */
export function ajusta(c, v) {const S = ['x', 'y', 'z'].map((k, a) => {const e = c.esc[k]; return e ? Math.abs(v[e[0] * 3 + a] - v[e[1] * 3 + a]) / e[2] : 1}), o = new Float64Array(c.V.length * 3); c.V.forEach((q, n) => {for (let a = 0; a < 3; a++) o[n * 3 + a] = v[q.i[0] * 3 + a] * q.w[0] + v[q.i[1] * 3 + a] * q.w[1] + v[q.i[2] * 3 + a] * q.w[2] + q.d[a] * S[a]}); return o}
