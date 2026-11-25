/* Niveles de detalle de las maquetas en el móvil: las mallas fundidas se mandan a un hilo aparte (esc-obrero.js) y vuelven partidas en
   casillas y con varios niveles; en cada fotograma se elige el más ligero que no se aparta ni un píxel de la forma entera.
   Si el hilo no arranca, se ve todo con la malla entera. */
import {THREE} from './kit.js';

export const ERR = [.006, .02, .038, .07, .13, .25, .5]; const TOL = 1.05;
let hilo = null, nid = 0; const pend = new Map();
function obrero() {if (hilo === null) try {hilo = new Worker(new URL('./esc-obrero.js', import.meta.url), {type: 'module'}); hilo.onmessage = ({data}) => {const f = pend.get(data.id); pend.delete(data.id); if (data.mal && !window.__nivMal) {window.__nivMal = data.mal; console.warn('niveles', data.mal)} if (f) f(data.mal ? null : data.T)}; hilo.onerror = () => {hilo = false; for (const f of [...pend.values()]) f(null); pend.clear()}} catch (e) {hilo = false} return hilo}
export const enciende = () => {obrero()};
export const nuevoNiv = () => ({L: [], p: 0, fuera: false});
const llano = (a, n, w) => {if (a.array.constructor === Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) return a.array.slice(0, n * w); const f = new Float32Array(n * w); for (let i = 0; i < n; i++) for (let c = 0; c < w; c++) f[i * w + c] = a.getComponent(i, c); return f};
function geo(t) {const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.BufferAttribute(t.pos, 3)); h.setAttribute('normal', new THREE.BufferAttribute(t.nor, 4, true)); h.setAttribute('uv', new THREE.BufferAttribute(t.uv, 2)); h.setAttribute('color', new THREE.BufferAttribute(t.col, 4, true)); h.setAttribute('capa', new THREE.BufferAttribute(t.capa, 4)); h.setAttribute('piv', new THREE.BufferAttribute(t.piv, 2)); h.setIndex(new THREE.BufferAttribute(t.idx, 1)); h.boundingSphere = new THREE.Sphere(new THREE.Vector3(...t.c), t.r); h.setDrawRange(...t.R[0]); return h}
/* manda una malla; celda: tamaño de las casillas (0: entera) */
export function nivela1(o, niv, celda = 0) {
  if (!niv || !obrero()) return; const g = o.geometry, A = g.attributes, n = A.position.count, q = {id: ++nid, celda, E: ERR, pos: llano(A.position, n, 3), nor: llano(A.normal, n, 3), uv: llano(A.uv, n, 2), col: A.color.array.slice(0, n * 4), capa: A.capa.array.slice(0, n * 4), piv: A.piv.array.slice(0, n * 2), idx: g.index ? new Uint32Array(g.index.array) : null};
  let tren = false; for (let P = o; P; P = P.parent) if (P.userData.esTren) tren = true; niv.p++; pend.set(q.id, T => {
    niv.p--; if (!T || !T.length || niv.fuera) return; const p = o.parent, pon = (me, t) => {let e = 1; if (me.isInstancedMesh) {const a = me.instanceMatrix.array; for (let i = 0; i < me.count * 16; i += 16) e = Math.max(e, Math.hypot(a[i], a[i + 1], a[i + 2]), Math.hypot(a[i + 4], a[i + 5], a[i + 6]))} niv.L.push({o: me, R: t.R, c: new THREE.Vector3(...t.c), h: t.h, r: t.r + Math.hypot(...t.c) * (me.isInstancedMesh ? 1 : 0), e, k: 0, f: tren ? .4 : 1})};
    const vieja = o.geometry; o.geometry = geo(T[0]); pon(o, T[0]); if (p) for (const t of T.slice(1)) {const me = new THREE.Mesh(geo(t), o.material); me.matrixAutoUpdate = false; me.matrix.copy(o.matrix); me.matrixWorldNeedsUpdate = true; me.renderOrder = o.renderOrder; Object.assign(me.userData, o.userData); p.add(me); pon(me, t); if (niv.nueva) niv.nueva(me)} vieja.dispose(); if (niv.nueva) niv.nueva(o);
  });
  hilo.postMessage(q, [q.pos.buffer, q.nor.buffer, q.uv.buffer, q.col.buffer, q.capa.buffer, q.piv.buffer, ...(q.idx ? [q.idx.buffer] : [])]);
}
/* espera (cediendo) a que vuelva todo: solo cuando se monta a trozos */
export function* espera(niv) {for (const t0 = performance.now(); niv.p > 0 && performance.now() - t0 < 3000;) yield 'W'}
const v = new THREE.Vector3(), mi = new THREE.Matrix4();
/* elige el nivel de cada malla; kpx: píxeles que mide un metro a un metro de la cámara */
export function nivela(niv, camera, kpx) {
  for (const q of niv.L) {
    const o = q.o, W = o.matrixWorld.elements, s = Math.hypot(W[0], W[1], W[2]) * q.e; let d;
    if (o.isInstancedMesh) {mi.copy(o.matrixWorld).invert(); v.copy(camera.position).applyMatrix4(mi); const a = o.instanceMatrix.array, X = v.x, Y = v.y, Z = v.z; let b = 1e12; for (let i = 12, n = o.count * 16; i < n; i += 16) {const x = a[i] - X, y = a[i + 1] - Y, z = a[i + 2] - Z, e = x * x + y * y + z * z; if (e < b) b = e} d = (Math.sqrt(b) * s / q.e) - q.r * s} else {v.copy(camera.position).applyMatrix4(mi.copy(o.matrixWorld).invert()).sub(q.c); const x = Math.max(0, Math.abs(v.x) - q.h[0]), y = Math.max(0, Math.abs(v.y) - q.h[1]), z = Math.max(0, Math.abs(v.z) - q.h[2]); d = Math.hypot(x, y, z) * s}
    const t = TOL * q.f * Math.max(d, 1.5) / kpx / s; let k = q.R.length - 1; while (k > 0 && ERR[k] > t * (k <= q.k ? 1.12 : 1)) k--; if (k !== q.k) {q.k = k; o.geometry.setDrawRange(q.R[k][0], q.R[k][1])}
  }
}
