/* El bloque de calle que se repite (tres tiendas, su acera, la calzada y las tres casas de enfrente): x de -170 a 850, z de -130 a 560.
   Devuelve los triángulos por pieza, las luces, las ventanas, las bombillas y por dónde van las guirnaldas. */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {THREE, V, Obra, rng, fbm, vnoise, sstep, lerp, clamp, caja, cil, esf, toro, torno, tubo, moldura, nieveEn, silueta, suaviza, T} from './geo.mjs';
import {fachada, casa, PASO} from './edificios.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PER = PASO * 3, X0 = -170, ZF = 420;

class Calle extends Obra {
  constructor() {super(); this.bombillas = []; this.guirnaldas = []; this.coronas = []; this.rotulos = []; this.ventanas = []}
  ventana({x, y, z, w, h, on, r}) {const p = V(x, y, z).applyMatrix4(this.M), n = V(0, 0, 1).transformDirection(this.M); this.ventanas.push({p: p.toArray(), w, h, on, r, s: Math.sign(n.z)}); if (on) this.luces.push({t: 'panel', p: p.toArray(), w, h, n: n.toArray(), u: V(1, 0, 0).transformDirection(this.M).toArray(), c: on === 2 ? [4.4, 3.2, 2.1] : [1.8, 1.26, .74]})}
}
/* geometría de un modelo, con su uv; s: escala; devuelve {p, n, uv} por material */
async function modelo(nombre) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(join(root, 'assets-src/ciudad', nombre + '.glb')), out = [];
  for (const node of doc.getRoot().listNodes()) {const me = node.getMesh(); if (!me) continue; const M = new THREE.Matrix4().fromArray(node.getWorldMatrix()), N3 = new THREE.Matrix3().getNormalMatrix(M); for (const pr of me.listPrimitives()) {const P = pr.getAttribute('POSITION'), N = pr.getAttribute('NORMAL'), U = pr.getAttribute('TEXCOORD_0'), I = pr.getIndices(), c = I.getCount(), p = new Float32Array(c * 3), n = new Float32Array(c * 3), uv = new Float32Array(c * 2), v = V(), e = [0, 0, 0]; for (let i = 0; i < c; i++) {const k = I.getScalar(i); P.getElement(k, e); v.set(...e).applyMatrix4(M); p.set([v.x, v.y, v.z], i * 3); N.getElement(k, e); v.set(...e).applyMatrix3(N3).normalize(); n.set([v.x, v.y, v.z], i * 3); if (U) {U.getElement(k, e); uv.set([e[0], e[1]], i * 2)}} out.push({p, n, uv, mat: pr.getMaterial()?.getName() || ''})}}
  const b = new THREE.Box3(); for (const o of out) for (let i = 0; i < o.p.length; i += 3) b.expandByPoint(V(o.p[i], o.p[i + 1], o.p[i + 2])); return {piezas: out, b};
}
/* suelo: rejilla con altura y máscara de nieve en el color (r: tinte, g: pisado/mojado, a: nieve) */
function suelo(O, mat, x0, x1, z0, z1, paso, f) {
  const nx = Math.round((x1 - x0) / paso), nz = Math.max(2, Math.round((z1 - z0) / paso)), at = (i, j) => {const x = lerp(x0, x1, i / nx), z = lerp(z0, z1, j / nz); return f(x, z)}, P = [], N = [], C = [], pt = (i, j) => {const x = lerp(x0, x1, i / nx), z = lerp(z0, z1, j / nz), q = f(x, z); return [x, q.y, z, q]}, nm = (x, z) => {const e = 1.2; return V(f(x - e, z).y - f(x + e, z).y, 2 * e, f(x, z - e).y - f(x, z + e).y).normalize()};
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j), alt = (i + j) & 1; for (const t of alt ? [[a, b, d], [b, c, d]] : [[a, b, c], [a, c, d]]) for (const [x, y, z, q] of t) {P.push(x, y, z); const n = nm(x, z); N.push(n.x, n.y, n.z); C.push(q.t ?? 1, q.h ?? 0, 0, q.s)}}
  O.P.push({p: new Float32Array(P), n: new Float32Array(N), c: new Float32Array(C), mat, t: null});
}
/* en x el dibujo se repite cada PER para que los bloques casen */
const per = (f, x, z) => {const u = ((x - X0) / PER) % 1, k = u < 0 ? u + 1 : u, w = sstep(.82, 1, k); const X = X0 + k * PER; return w > 0 ? lerp(f(X, z), f(X - PER, z), w) : f(X, z)};
const nz = (x, z, e, s = 0) => per((a, b) => fbm(a * e + s, b * e + s * 1.7), x, z);
export const aceraF = (x, z) => {const n = nz(x, z, .028, 3), n2 = nz(x, z, .11, 9), m = nz(x, z, .05, 17), pared = sstep(20, -2, z + (n - .5) * 14) * (2.6 + 5 * n2), bord = sstep(98, 122, z + (n - .5) * 26) * (1.6 + 7.4 * n2 * n), pis = sstep(.4, .62, m * .7 + n2 * .3 + sstep(40, 8, Math.abs(z - 62)) * -.06), s = pared + bord + pis * .9 * (.4 + n2); return {y: s * .86 - .06, s: clamp(s / 1.05, 0, 1), h: sstep(.5, .3, m), t: .9 + .2 * n}};
export const acera2F = (x, z) => {const q = aceraF(x * 1.3 + 77, 0), n = nz(x, z, .03, 23), n2 = nz(x, z, .1, 31), m = nz(x, z, .05, 41), pared = sstep(396, 424, z + (n - .5) * 16) * (2.4 + 5 * n2), bord = sstep(362, 338, z + (n - .5) * 22) * (1.6 + 7 * n2 * n), pis = sstep(.4, .6, m * .7 + n2 * .3), s = pared + bord + pis * (.4 + n2); return {y: s * .86 - .06, s: clamp(s / 1.05, 0, 1), h: sstep(.5, .3, m), t: .9 + .2 * n}};
export const calzadaF = (x, z) => {const n = nz(x, z, .022, 51), n2 = nz(x, z, .09, 61), n3 = nz(x, z, .3, 71), wob = (n - .5) * 12, rod = Math.min(...[176, 208, 258, 290].map(c => Math.abs(z - c + wob))), surco = sstep(15, 6, rod), medio = sstep(.36, .6, n2 * .6 + n * .4) * (1.6 + 1.6 * n2), cunA = sstep(152, 138, z + (n2 - .5) * 16) * (3 + 8 * n2), cunB = sstep(314, 328, z + (n2 - .5) * 16) * (3 + 8 * n2), s = Math.max(cunA, cunB, medio * (1 - surco) + surco * .25 * n3 * sstep(.5, .7, n2)), co = 1.6 * (1 - ((z - 232) / 98) ** 2); return {y: -6.4 + co + s * .8 - surco * .35, s: clamp(s / 1.3, 0, 1), h: Math.max(surco, sstep(.46, .3, n)), t: .86 + .24 * n}};

export async function bloque() {
  const O = new Calle(), A = (g, m, x, y, z, o) => O.a(g, m, x, y, z, o);
  for (let k = 0; k < 3; k++) O.en(T(k * PASO, 0, 0), () => fachada(O, k));
  for (let k = 0; k < 3; k++) O.en(T(k * PASO, 0, ZF, Math.PI), () => casa(O, k));
  // cierres entre módulos por arriba (por si se ve el hueco) y trasera que tapa la luz
  A(caja(PER, 470, 2, 0), 'negro', X0 + PER / 2, 235, -140); A(caja(PER, 470, 2, 0), 'negro', X0 + PER / 2, 235, ZF + 60);
  suelo(O, 'acera', X0, X0 + PER, -22, 130.4, 5.2, aceraF); suelo(O, 'calzada', X0, X0 + PER, 132, 333, 6.2, calzadaF); suelo(O, 'acera', X0, X0 + PER, 334, 424, 6.2, acera2F);
  // bordillos de granito, pieza a pieza
  const r = rng(5); for (const [z, s] of [[131.2, 1], [333.6, -1]]) for (let x = X0; x < X0 + PER - 1; x += 42.5) {A(caja(41.9, 8.4, 6.2, .9), 'granito', x + 21.2, -3.5 + (r() - .5) * .4, z, {t: .82 + r() * .3}); A(nieveEn(42.5, 5.6, .9 + r() * 1.6, 3 + x, 4), 'nieve', x + 21.2, .5, z)}
  /* farolas de hierro fundido */
  const F = await modelo('street_lamp_01'), hF = F.b.max.y - F.b.min.y, sF = 176 / hF;
  const farola = (x, y, z, ry) => {for (const q of F.piezas) pieza(O, q, /glass|vidrio|cristal|bulb|light/i.test(q.mat) ? 'lamp' : 'hierro', x, y - F.b.min.y * sF, z, sF, ry); O.luz({t: 'foco', p: [x, y + 176 * .905, z], c: [150, 110, 70], r: 5}); O.farolas.push([x, y + 176 * .905, z])};
  O.farolas = []; for (let k = 0; k < 3; k++) {farola(k * PASO - 162, 0, 122, 0); farola(k * PASO + 170 - (k === 2 ? 0 : 0), 0, 343, 0)}
  console.log('farola', F.piezas.map(q => q.mat + ':' + q.p.length / 9));
  /* atrezo escaneado */
  const pon = async (n, x, z, alto, ry = 0, y = 0, m = 'prop:' + n, sn = 0) => {const M = await modelo(n), s = alto / (M.b.max.y - M.b.min.y), c = M.b.getCenter(V()); const mt = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -M.b.min.y, -c.z)); for (const q of M.piezas) piezaM(O, q, m, mt); if (sn) {const w = (M.b.max.x - M.b.min.x) * s, d = (M.b.max.z - M.b.min.z) * s; A(nieveEn(w * .92, d * .92, sn, x * .1, 3), 'nieve', x, y + alto - .3, z, {ry})}};
  await pon('painted_wooden_bench', -124, 20, 40, 0, 0, 'prop:painted_wooden_bench', 0); A(nieveEn(44, 13, 2.2, 3, 3), 'nieve', -124, 20.6, 21);
  await pon('wine_barrel_01', 94, 16, 38, .4, 0, 'prop:wine_barrel_01', 3.2); await pon('wooden_crate_01', 340 - 100, 16, 17, .1, 0, 'prop:wooden_crate_01', 2.4); await pon('wicker_basket_01', 340 - 101, 16, 11, .5, 17.4, 'prop:wicker_basket_01');
  await pon('standing_chalkboard_01', 680 + 84, 38, 42, -.5); await pon('planter_box_01', 340 + 84, 13, 17, 0, 0, 'prop:planter_box_01', 2.6); await pon('metal_trash_can', 560, 404, 34, 1, 0, 'prop:metal_trash_can', 2.6); await pon('covered_car', 470, 298, 62, Math.PI / 2 + .02, -4.6, 'prop:covered_car'); await pon('wine_barrel_01', 150, 402, 38, 2, 0, 'prop:wine_barrel_01', 3.2); await pon('wooden_crate_01', 180, 402, 18, 2.8, 0, 'prop:wooden_crate_01', 2.4); await pon('water_manhole_cover', 110, 233, 1.6, .4, -4.9, 'prop:water_manhole_cover');
  // bolardos en los bordes
  for (let k = 0; k < 3; k++) for (const x of [-60, 30, 120]) {A(torno([[0, 0], [5, 0], [5, 3], [3.6, 5], [3, 8], [2.7, 26], [3.4, 27.4], [3.4, 29.4], [2.6, 30.6], [3.4, 33], [2.6, 36], [0, 37.4]], 16), 'hierro', k * PASO + x, 0, 121); A(nieveEn(6, 6, 2, x, 2), 'nieve', k * PASO + x, 36.6, 121)}
  /* luces colgadas de lado a lado: cables, guirnaldas de bombillas y figuras */
  O.figuras = []; const fig = (m, f) => {const n0 = O.P.length; f(); for (let i = n0; i < O.P.length; i++) O.P[i].col = 1};
  const barra = (x, y0, z0, y1, z1, g, m) => {const l = Math.hypot(z1 - z0, y1 - y0); A(cil(g, g, l, 6), m, x, (y0 + y1) / 2, (z0 + z1) / 2, {rx: Math.atan2(z1 - z0, y1 - y0)})};
  const estrella = (x, y, z, R, m) => {const p = k => {const a = Math.PI / 2 + k * Math.PI * .8; return [y + Math.sin(a) * R, z + Math.cos(a) * R]}; for (let k = 0; k < 5; k++) {const a = p(k), b = p(k + 1); barra(x, a[0], a[1], b[0], b[1], .75, m)}}, copo = (x, y, z, R, m) => {for (let k = 0; k < 3; k++) {const a = k * Math.PI / 3; barra(x, y - Math.cos(a) * R, z - Math.sin(a) * R, y + Math.cos(a) * R, z + Math.sin(a) * R, .7, m)} for (let k = 0; k < 6; k++) {const a = k * Math.PI / 3; for (const [u, l] of [[.5, .3], [.74, .22]]) for (const q of [-.8, .8]) {const y0 = y + Math.cos(a) * R * u, z0 = z + Math.sin(a) * R * u; barra(x, y0, z0, y0 + Math.cos(a + q) * R * l, z0 + Math.sin(a + q) * R * l, .6, m)}}};
  const hilos = []; for (let i = 0; i < 6; i++) {const x = X0 + PER * (i + .5) / 6, y0 = 232, sag = 34, pts = []; for (let j = 0; j <= 10; j++) {const u = j / 10; pts.push([x + Math.sin(u * 6) * 3, y0 - 4 * sag * u * (1 - u), lerp(2, ZF - 2, u)])} A(tubo(pts, .42, 30, 5), 'cable', 0, 0, 0); const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p))); for (let j = 0; j < 46; j++) {const p = c.getPoint((j + .5) / 46); O.bombillas.push([p.x, p.y - 2, p.z, (j + i) % 5 === 3 ? 0 : (j + i) % 5 === 1 ? 2 : 1])} const z = ZF / 2, yb = y0 - sag; if (i & 1) {estrella(x, yb - 34, z, 27, 'neon1'); estrella(x, yb - 34, z, 14, 'neon2'); O.luz({t: 'foco', p: [x, yb - 34, z], c: [26, 17, 7], r: 18})} else {copo(x, yb - 32, z, 25, 'neon2'); O.luz({t: 'foco', p: [x, yb - 32, z], c: [10, 15, 24], r: 18})} A(cil(.3, .3, 10, 5), 'cable', x, yb - 4, z); for (const [zz, s] of [[118, 1], [302, -1]]) {const yy = y0 - 4 * sag * (zz / ZF) * (1 - zz / ZF); (i & 1 ? copo : estrella)(x, yy - 18, zz, 11, i & 1 ? 'neon2' : 'neon1'); A(cil(.25, .25, 8, 5), 'cable', x, yy - 4, zz)}}
  // luz de los hilos de bombillas, agrupada
  const G = new Map(), PAL = [[1.9, .2, .2], [1.9, 1.25, .45], [.3, .8, 2], [.3, 1.7, .5], [1.9, 1.5, .9]]; O.bombillas.forEach(([x, y, z, c]) => {const key = [Math.round(x / 34), Math.round(y / 30), Math.round(z / 34)].join(); if (!G.has(key)) G.set(key, {n: 0, p: [0, 0, 0], c: [0, 0, 0]}); const g = G.get(key); g.n++; [x, y, z].forEach((v, i) => {g.p[i] += v}); PAL[c].forEach((v, i) => {g.c[i] += v})}); G.forEach(g => O.luces.push({t: 'foco', p: g.p.map((v, i) => v / g.n + (i === 2 ? (g.p[2] / g.n < 60 ? 2.5 : g.p[2] / g.n > 360 ? -2.5 : 0) : 0)), c: g.c.map(v => v * .11), r: 9}));
  return O;
}
function pieza(O, q, mat, x, y, z, s, ry) {piezaM(O, q, mat, new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z).multiply(new THREE.Matrix4().makeScale(s, s, s)))}
function piezaM(O, q, mat, m) {const p = new Float32Array(q.p.length), n = new Float32Array(q.n.length), v = V(), N = new THREE.Matrix3().getNormalMatrix(m); for (let i = 0; i < p.length; i += 3) {v.set(q.p[i], q.p[i + 1], q.p[i + 2]).applyMatrix4(m); p.set([v.x, v.y, v.z], i); v.set(q.n[i], q.n[i + 1], q.n[i + 2]).applyMatrix3(N).normalize(); n.set([v.x, v.y, v.z], i)} O.P.push({p, n, uv: q.uv, mat, t: null})}
