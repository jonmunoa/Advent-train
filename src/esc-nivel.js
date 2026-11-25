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
function geo(t) {const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.BufferAttribute(t.pos, 3)); h.setAttribute('normal', new THREE.BufferAttribute(t.nor, 4, true)); h.setAttribute('uv', new THREE.BufferAttribute(t.uv, 2)); h.setAttribute('color', new THREE.BufferAttribute(t.col, 4, true)); h.setAttribute('capa', new THREE.BufferAttribute(t.capa, 4)); h.setAttribute('piv', new THREE.BufferAttribute(t.piv, 2)); h.setIndex(new THREE.BufferAttribute(t.idx, 1)); h.boundingSphere = new THREE.Sphere(new THREE.Vector3(...t.c), t.r); t.mu ? h.setDrawRange(t.R[1][0], t.R[2][0] - t.R[1][0]) : h.setDrawRange(...t.R[0]); return h}
/* manda una malla; celda: tamaño de las casillas (0: entera) */
export function nivela1(o, niv, celda = 0, lotes = null) {
  if (!niv || !obrero()) return; const g = o.geometry, A = g.attributes, n = A.position.count, q = {id: ++nid, celda, mu: !!celda, E: ERR, pos: llano(A.position, n, 3), nor: llano(A.normal, n, 3), uv: llano(A.uv, n, 2), col: A.color.array.slice(0, n * 4), capa: A.capa.array.slice(0, n * 4), piv: A.piv.array.slice(0, n * 2), idx: g.index ? new Uint32Array(g.index.array) : null};
  let tren = false; for (let P = o; P; P = P.parent) if (P.userData.esTren) tren = true; niv.p++; pend.set(q.id, T => {
    niv.p--; if (!T || !T.length || niv.fuera) return; const p = o.parent; if (T[0].mu) {if (p) {lote(niv, p, T[0], lotes, tren); p.remove(o); o.geometry.dispose()} return} const pon = (me, t) => {let e = 1; if (me.isInstancedMesh) {const a = me.instanceMatrix.array; for (let i = 0; i < me.count * 16; i += 16) e = Math.max(e, Math.hypot(a[i], a[i + 1], a[i + 2]), Math.hypot(a[i + 4], a[i + 5], a[i + 6]))} niv.L.push({o: me, R: t.R, c: new THREE.Vector3(...t.c), h: t.h, r: t.r + Math.hypot(...t.c) * (me.isInstancedMesh ? 1 : 0), e, k: 0, f: tren ? .4 : 1})};
    const vieja = o.geometry; o.geometry = geo(T[0]); pon(o, T[0]); vieja.dispose();
  });
  hilo.postMessage(q, [q.pos.buffer, q.nor.buffer, q.uv.buffer, q.col.buffer, q.capa.buffer, q.piv.buffer, ...(q.idx ? [q.idx.buffer] : [])]);
}
/* una sola llamada para todas las casillas a la vista (multiDraw): three la hace con las mallas «por lotes» */
function lote(niv, p, t, material, tren) {
  const me = new THREE.Mesh(geo(t), material), nc = t.B.length / 6; me.matrixAutoUpdate = false; me.updateMatrix(); me.userData.ligera = true; p.add(me);
  Object.assign(me, {isBatchedMesh: true, _multiDrawInstances: null, _colorsTexture: null, colorTexture: null, _multiDrawStarts: new Int32Array(nc), _multiDrawCounts: new Int32Array(nc), _multiDrawCount: 0}); const q = {o: me, R: t.R, B: t.B, nc, K: new Uint8Array(nc), e: 1, f: tren ? .4 : 1, by: t.idx.BYTES_PER_ELEMENT}; niv.L.push(q); entero(q);
}
/* lo mismo con una malla por fundir: se mandan sus trozos según salen (los junta el otro hilo) y al volver se ponen las mallas en su grupo;
   si falla, falla() la hace aquí */
export function abre(niv, p, material, celda, falla) {
  if (!niv || niv.sinc || !obrero()) return 0; const id = ++nid; niv.p++; let tren = false; for (let P = p; P; P = P.parent) if (P.userData.esTren) tren = true;
  pend.set(id, T => {niv.p--; if (niv.fuera) return; if (!T) {falla(); return} for (const t of T) lote(niv, p, t, material, tren)});
  hilo.postMessage({id, celda, E: ERR, abre: true, mu: true}); return id;
}
export function manda(id, g) {const A = g.attributes, n = A.position.count, f = (a, w) => a.array.constructor === Float32Array && !a.isInterleavedBufferAttribute && !a.normalized && a.array.length === n * w ? a.array : llano(a, n, w), q = {id, parte: true, pos: f(A.position, 3), nor: f(A.normal, 3), uv: f(A.uv, 2), col: A.color.array, capa: A.capa.array, piv: A.piv.array, idx: g.index ? g.index.array : null}; hilo && hilo.postMessage(q, [q.col.buffer, q.capa.buffer, q.piv.buffer])}
export const cierra = id => {hilo && hilo.postMessage({id, cierra: true})};
/* espera (cediendo) a que vuelva todo: solo cuando se monta a trozos */
export function* espera(niv) {for (const t0 = performance.now(); niv.p > 0 && performance.now() - t0 < 3000;) yield 'W'}
/* todas las casillas, al nivel k (para dibujar desde otra cámara) */
function entero(q, k = 1) {const o = q.o; for (let j = 0; j < q.nc; j++) {o._multiDrawStarts[j] = q.R[k][j * 2] * q.by; o._multiDrawCounts[j] = q.R[k][j * 2 + 1]} o._multiDrawCount = q.nc}
export const todas = niv => {if (niv) for (const q of niv.L) if (q.B) entero(q)};
/* dibuja algo con las mallas por lotes como mallas corrientes (sombras, altura): otro material no sabría qué hacer con ellas */
export function corrientes(L, f) {const B = L.filter(o => o.isBatchedMesh); for (const o of B) o.isBatchedMesh = false; f(); for (const o of B) o.isBatchedMesh = true}
const fr = new THREE.Frustum(), pm = new THREE.Matrix4(), pv = new THREE.Matrix4();
/* casillas a la vista, cada una con su nivel */
function casillas(q, camera, kpx) {
  const o = q.o, W = o.matrixWorld.elements, s = Math.hypot(W[0], W[1], W[2]), B = q.B; fr.setFromProjectionMatrix(pm.multiplyMatrices(pv, o.matrixWorld)); v.copy(camera.position).applyMatrix4(mi.copy(o.matrixWorld).invert()); const X = v.x, Y = v.y, Z = v.z, C = TOL * q.f / kpx; let n = 0;
  for (let j = 0, i = 0; j < q.nc; j++, i += 6) {
    let ve = true; for (let p = 0; p < 6; p++) {const {normal: N, constant: c} = fr.planes[p]; if (N.x * B[i] + N.y * B[i + 1] + N.z * B[i + 2] + c + Math.abs(N.x) * B[i + 3] + Math.abs(N.y) * B[i + 4] + Math.abs(N.z) * B[i + 5] < 0) {ve = false; break}} if (!ve) continue;
    const x = Math.max(0, Math.abs(X - B[i]) - B[i + 3]), y = Math.max(0, Math.abs(Y - B[i + 1]) - B[i + 4]), z = Math.max(0, Math.abs(Z - B[i + 2]) - B[i + 5]), t = C * Math.max(Math.hypot(x, y, z), 1.5 / s); let k = q.R.length - 1; while (k > 0 && ERR[k] > t * (k <= q.K[j] ? 1.12 : 1)) k--; q.K[j] = k; const c = q.R[k][j * 2 + 1]; if (c) {o._multiDrawStarts[n] = q.R[k][j * 2] * q.by; o._multiDrawCounts[n++] = c}
  }
  o._multiDrawCount = n;
}
const v = new THREE.Vector3(), mi = new THREE.Matrix4(); let turno = 0;
/* elige el nivel de cada malla; kpx: píxeles que mide un metro a un metro de la cámara */
export function nivela(niv, camera, kpx) {
  pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); turno++;
  for (const q of niv.L) {
    if (q.B) {casillas(q, camera, kpx); continue} if (turno & 1) continue;
    const o = q.o, W = o.matrixWorld.elements, s = Math.hypot(W[0], W[1], W[2]) * q.e; let d;
    if (o.isInstancedMesh) {mi.copy(o.matrixWorld).invert(); v.copy(camera.position).applyMatrix4(mi); const a = o.instanceMatrix.array, X = v.x, Y = v.y, Z = v.z; let b = 1e12; for (let i = 12, n = o.count * 16; i < n; i += 16) {const x = a[i] - X, y = a[i + 1] - Y, z = a[i + 2] - Z, e = x * x + y * y + z * z; if (e < b) b = e} d = (Math.sqrt(b) * s / q.e) - q.r * s} else {v.copy(camera.position).applyMatrix4(mi.copy(o.matrixWorld).invert()).sub(q.c); const x = Math.max(0, Math.abs(v.x) - q.h[0]), y = Math.max(0, Math.abs(v.y) - q.h[1]), z = Math.max(0, Math.abs(v.z) - q.h[2]); d = Math.hypot(x, y, z) * s}
    const t = TOL * q.f * Math.max(d, 1.5) / kpx / s; let k = q.R.length - 1; while (k > 0 && ERR[k] > t * (k <= q.k ? 1.12 : 1)) k--; if (k !== q.k) {q.k = k; o.geometry.setDrawRange(q.R[k][0], q.R[k][1])}
  }
}
