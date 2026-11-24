/* Piezas de geometría para levantar la calle sin conexión: cajas con el canto matado, molduras, arcos, tubos… Unidades: 45 = 1 m.
   Todo acaba en un saco de triángulos con su material (y un tinte por pieza). */
import * as THREE from 'three';
export {THREE};
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const rng = s => () => {s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296};
const h2 = (x, y) => {const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s)};
export const vnoise = (x, y) => {const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = h2(xi, yi), b = h2(xi, yi + 1); return (a + (h2(xi + 1, yi) - a) * u) * (1 - v) + (b + (h2(xi + 1, yi + 1) - b) * u) * v};
export const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.07 + 5, y * 2.07) * .28 + vnoise(x * 4.3, y * 4.3 + 9) * .17;
export const sstep = (a, b, x) => {const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)}, lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function saco(P, N) {const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g}
/* caja con los cantos matados: las caras grandes siguen planas y el canto coge brillo */
export function caja(w, h, d, c = .6) {
  c = Math.min(c, w * .45, h * .45, d * .45); const P = [], N = [], H = [w / 2, h / 2, d / 2], F = {};
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {const u = (a + 1) % 3, v = (a + 2) % 3, q = []; for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {const p = [0, 0, 0]; p[a] = s * H[a]; p[u] = i * (H[u] - c); p[v] = j * (H[v] - c); q.push(p)} F[a + '' + s] = {q, a, s, u, v, n: [a === 0 ? s : 0, a === 1 ? s : 0, a === 2 ? s : 0]}}
  const tri = (p, n) => {const A = V(...p[0]), B = V(...p[1]), C = V(...p[2]), g = B.clone().sub(A).cross(C.clone().sub(A)), m = V(...n[0]).add(V(...n[1])).add(V(...n[2])); const o = g.dot(m) < 0 ? [0, 2, 1] : [0, 1, 2]; for (const i of o) {P.push(...p[i]); N.push(...n[i])}};
  const quad = (p, n) => {tri([p[0], p[1], p[2]], [n[0], n[1], n[2]]); tri([p[0], p[2], p[3]], [n[0], n[2], n[3]])};
  for (const k in F) {const f = F[k]; quad(f.q, [f.n, f.n, f.n, f.n])}
  if (c > .02) {
    const vt = (a, s, sig) => {const p = [0, 0, 0]; for (let i = 0; i < 3; i++) p[i] = sig[i] * (i === a ? H[i] : H[i] - c); const n = [0, 0, 0]; n[a] = s; return [p, n]};
    for (let e = 0; e < 3; e++) {const a = (e + 1) % 3, b = (e + 2) % 3; for (const sa of [-1, 1]) for (const sb of [-1, 1]) {const s0 = [0, 0, 0], s1 = [0, 0, 0]; s0[e] = -1; s1[e] = 1; s0[a] = s1[a] = sa; s0[b] = s1[b] = sb; const A = vt(a, sa, s0), B = vt(b, sb, s0), C = vt(b, sb, s1), D = vt(a, sa, s1); quad([A[0], B[0], C[0], D[0]], [A[1], B[1], C[1], D[1]])}}
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {const s = [x, y, z], A = vt(0, x, s), B = vt(1, y, s), C = vt(2, z, s); tri([A[0], B[0], C[0]], [A[1], B[1], C[1]])}
  }
  return saco(P, N);
}
/* moldura: perfil [[z, y], …] (de abajo arriba o como sea, hacia fuera = +z) recorrido a lo largo de x; tapas a los lados. suave: ángulo máximo que se redondea */
export function moldura(perfil, L, {suave = 40, tapas = true} = {}) {
  const P = [], N = [], n = perfil.length, sg = []; for (let i = 0; i < n - 1; i++) {const dz = perfil[i + 1][0] - perfil[i][0], dy = perfil[i + 1][1] - perfil[i][1], l = Math.hypot(dz, dy) || 1; sg.push([dy / l, -dz / l])}   // normal (z, y)
  const nv = (i, s) => {const a = sg[s], o = i === s ? sg[s - 1] : sg[s + 1]; if (!o || a[0] * o[0] + a[1] * o[1] < Math.cos(suave * Math.PI / 180)) return a; const z = a[0] + o[0], y = a[1] + o[1], l = Math.hypot(z, y) || 1; return [z / l, y / l]};
  for (let i = 0; i < n - 1; i++) {const [z0, y0] = perfil[i], [z1, y1] = perfil[i + 1], a = nv(i, i), b = nv(i + 1, i); for (const [x, z, y, m] of [[-L / 2, z0, y0, a], [L / 2, z0, y0, a], [L / 2, z1, y1, b], [-L / 2, z0, y0, a], [L / 2, z1, y1, b], [-L / 2, z1, y1, b]]) {P.push(x, y, z); N.push(0, m[1], m[0])}}
  if (tapas) {const pts = perfil.map(([z, y]) => new THREE.Vector2(z, y)); for (const f of THREE.ShapeUtils.triangulateShape(pts, [])) for (const s of [-1, 1]) for (const i of s > 0 ? f : [f[0], f[2], f[1]]) {P.push(s * L / 2, pts[i].y, pts[i].x); N.push(s, 0, 0)}
    // el sentido de las tapas depende del giro del perfil: se comprueba
    const g = saco(P, N); arregla(g); return g}
  const g = saco(P, N); arregla(g); return g;
}
/* deja cada triángulo mirando hacia donde dice su normal */
export function arregla(g) {const p = g.attributes.position, n = g.attributes.normal, a = V(), b = V(), c = V(), m = V(); for (let i = 0; i < p.count; i += 3) {a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1).sub(a); c.fromBufferAttribute(p, i + 2).sub(a); b.cross(c); m.set(n.getX(i) + n.getX(i + 1) + n.getX(i + 2), n.getY(i) + n.getY(i + 1) + n.getY(i + 2), n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)); if (b.dot(m) < 0) for (const at of [p, n]) {const x = [at.getX(i + 1), at.getY(i + 1), at.getZ(i + 1)]; at.setXYZ(i + 1, at.getX(i + 2), at.getY(i + 2), at.getZ(i + 2)); at.setXYZ(i + 2, ...x)}} return g}
export const plano = g => g.index ? g.toNonIndexed() : g;
export const cil = (r0, r1, h, n = 16, abierto = false) => plano(new THREE.CylinderGeometry(r0, r1, h, n, 1, abierto)), esf = (r, a = 16, b = 12) => plano(new THREE.SphereGeometry(r, a, b)), toro = (R, r, n = 20, m = 8, arco = 6.2832) => plano(new THREE.TorusGeometry(R, r, m, n, arco)), torno = (pts, n = 20) => plano(new THREE.LatheGeometry((pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts).map(([r, y]) => new THREE.Vector2(r, y)), n)), cono = (r, h, n = 16) => plano(new THREE.ConeGeometry(r, h, n));
export const tubo = (pts, r, seg = 24, n = 8) => plano(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), seg, r, n));
export const hoja = (w, h) => plano(new THREE.PlaneGeometry(w, h));
/* chapa con forma (contorno [[x, y], …]) y grosor, con canto */
export function silueta(pts, d, {c = .3, curvas = 8, huecos = []} = {}) {const s = new THREE.Shape(pts.map(p => new THREE.Vector2(...p))); huecos.forEach(h => s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(...p))))); const g = new THREE.ExtrudeGeometry(s, {depth: d, bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: 1, curveSegments: curvas}); g.translate(0, 0, -d / 2); return plano(g)}
/* placa de nieve posada: bordes redondos, encima ondulada y caída por delante */
export function nieveEn(w, d, h, sem = 1, paso = 4) {
  const nx = Math.max(6, Math.round(w / paso)), nz = Math.max(5, Math.round(d / Math.min(paso, d / 4))), r = Math.min(d * .42, w * .4, h * 1.4), P = [], al = (x, z) => {const a = Math.max(0, Math.abs(x) - (w / 2 - r)), b = Math.max(0, Math.abs(z) - (d / 2 - r)), e = Math.min(1, Math.hypot(a, b) / r); return h * Math.sqrt(Math.max(0, 1 - e * e)) * (.72 + .5 * fbm(x * .06 + sem * 7, z * .11 + sem))};
  const at = (i, j) => {const x = (i / nx - .5) * w, z = (j / nz - .5) * d, k = al(x, z); return V(x + (vnoise(x * .2 + sem, z * .3) - .5) * .8, k, z + (z > 0 ? 1 : 0) * k * .12)};
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (const T of [[[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 1], [1, 0]]]) {const q = T.map(([a, b]) => at(i + a, j + b)); if (Math.max(...q.map(p => p.y)) < h * .04) continue; for (const p of q) P.push(p.x, p.y, p.z)}
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); suaviza(g); return g;
}
/* normales suaves por posición */
export function suaviza(g, corte = 180) {const p = g.attributes.position, m = new Map(), a = V(), b = V(), c = V(), fn = []; for (let i = 0; i < p.count; i += 3) {a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1).sub(a); c.fromBufferAttribute(p, i + 2).sub(a); const n = V().crossVectors(b, c); fn.push(n); for (let k = 0; k < 3; k++) {const key = [p.getX(i + k), p.getY(i + k), p.getZ(i + k)].map(v => Math.round(v * 200)).join(); if (!m.has(key)) m.set(key, []); m.get(key).push(i / 3)}} const N = new Float32Array(p.count * 3), cc = Math.cos(corte * Math.PI / 180); for (let i = 0; i < p.count; i++) {const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 200)).join(), f0 = fn[i / 3 | 0], n = V(), u0 = f0.clone().normalize(); for (const t of m.get(key)) if (corte >= 180 || fn[t].clone().normalize().dot(u0) >= cc) n.add(fn[t]); n.normalize(); N.set([n.x, n.y, n.z], i * 3)} g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return g}

/* saco de piezas con materiales */
export class Obra {
  constructor() {this.P = []; this.luces = []; this.M = new THREE.Matrix4()}
  /* añade geometría con material; pos, giro y tinte opcionales */
  a(g, mat, x = 0, y = 0, z = 0, {rx = 0, ry = 0, rz = 0, s = 1, t = null} = {}) {g = plano(g).clone(); const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), Array.isArray(s) ? V(...s) : V(s, s, s)); g.applyMatrix4(m).applyMatrix4(this.M); if (this.M.determinant() * m.determinant() < 0) {for (const k of ['position', 'normal']) {const A = g.attributes[k]; for (let i = 0; i < A.count; i += 3) {const q = [A.getX(i + 1), A.getY(i + 1), A.getZ(i + 1)]; A.setXYZ(i + 1, A.getX(i + 2), A.getY(i + 2), A.getZ(i + 2)); A.setXYZ(i + 2, ...q)}}} this.P.push({p: g.attributes.position.array, n: g.attributes.normal.array, mat, t}); return this}
  en(m, f) {const o = this.M.clone(); this.M.multiply(m); f(); this.M.copy(o)}
  /* luz: posición, color (radiancia), radio; tipo 'foco' o 'panel' */
  luz(l) {const p = V(...l.p).applyMatrix4(this.M); this.luces.push({...l, p: [p.x, p.y, p.z], n: l.n ? V(...l.n).transformDirection(this.M).toArray() : null, u: l.u ? V(...l.u).transformDirection(this.M).toArray() : null})}
}
export const T = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
