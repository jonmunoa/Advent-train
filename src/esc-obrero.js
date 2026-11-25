/* Hilo aparte (solo móvil): recibe las mallas fundidas de una maqueta y devuelve lo mismo partido en casillas, con los vértices sin repetir
   y varios niveles de detalle (cada uno, con un error máximo en metros de la maqueta). Usa el simplificador de meshoptimizer (MIT). */
import {MeshoptSimplifier as S} from './vendor/meshopt_simplifier.js';

const F = new Float32Array(1), FU = new Uint32Array(F.buffer), W = 9, fb = x => {F[0] = x; return FU[0]};
/* vértices iguales, una sola vez: devuelve cuántos hay y a cuál va cada esquina */
function unicos(q, I) {
  const n = I.length, K = new Uint32Array(n * W), U = new Uint32Array(n); let cap = 1; while (cap < n * 2) cap <<= 1; const T = new Int32Array(cap).fill(-1), V = new Uint32Array(n), k = new Uint32Array(W); let u = 0;
  for (let j = 0; j < n; j++) {
    const i = I[j]; k[0] = fb(q.pos[i * 3]); k[1] = fb(q.pos[i * 3 + 1]); k[2] = fb(q.pos[i * 3 + 2]); k[3] = (Math.round(q.nor[i * 3] * 127) & 255) | (Math.round(q.nor[i * 3 + 1] * 127) & 255) << 8 | (Math.round(q.nor[i * 3 + 2] * 127) & 255) << 16; k[4] = fb(q.uv[i * 2]); k[5] = fb(q.uv[i * 2 + 1]); k[6] = q.col[i]; k[7] = q.capa[i]; k[8] = q.piv[i];
    let h = 2166136261; for (let c = 0; c < W; c++) {h = Math.imul(h ^ k[c], 16777619); h ^= h >>> 13} h = Math.imul(h, 1540483477); h = (h ^ h >>> 15) & cap - 1;
    for (;;) {const e = T[h]; if (e < 0) {T[h] = u; K.set(k, u * W); V[u] = i; U[j] = u++; break} let c = 0; const o = e * W; while (c < W && K[o + c] === k[c]) c++; if (c === W) {U[j] = e; break} h = h + 1 & cap - 1}
  }
  return {u, U, V: V.subarray(0, u)};
}
function trozo(q, I) {
  const {u, U, V} = unicos(q, I), pos = new Float32Array(u * 3), at = new Float32Array(u * 6); for (let j = 0; j < u; j++) {const i = V[j], c = q.col[i]; for (let w = 0; w < 3; w++) {pos[j * 3 + w] = q.pos[i * 3 + w]; at[j * 6 + w] = q.nor[i * 3 + w]; at[j * 6 + 3 + w] = (c >>> w * 8 & 255) / 255}}
  /* donde se juntan dos colores o materiales, la raya se respeta */
  const re0 = S.generatePositionRemap(pos, 3), prot = new Uint8Array(u); for (let j = 0; j < u; j++) {const r = re0[j]; if (r !== j && (q.col[V[r]] !== q.col[V[j]] || q.capa[V[r]] !== q.capa[V[j]])) prot[r] = 1} for (let j = 0; j < u; j++) if (prot[re0[j]]) prot[j] = 2; for (let j = 0; j < u; j++) if (prot[j]) prot[j] = 2;
  /* niveles: cada uno sale del anterior; el peso de las normales y del color impide que se note en la luz */
  const L = [], R = []; let A = U, total = 0; for (let k = 0; k < q.E.length; k++) {const e = q.E[k], w = e * .8, x = e * 2, s = S.simplifyWithAttributes(A, pos, 3, at, 6, [w, w, w, x, x, x], prot, 0, e, ['ErrorAbsolute', 'Prune', 'Permissive'])[0]; A = k && s.length > A.length * .93 ? A : s; L.push(A)} for (const l of L) {R.push([total, l.length]); total += l.length}
  const ix = new Uint32Array(total); let o = 0; for (const l of L) {ix.set(l, o); o += l.length} if (!total) return null; const [re, n] = S.compactMesh(ix), idx = n < 65536 ? new Uint16Array(ix) : ix, P = new Float32Array(n * 3), N = new Int8Array(n * 4), T = new Float32Array(n * 2), C = new Uint32Array(n), Q = new Uint32Array(n), Z = new Uint32Array(n);
  const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (let j = 0; j < u; j++) {const d = re[j]; if (d === 0xffffffff) continue; const i = V[j]; for (let w = 0; w < 3; w++) {const x = P[d * 3 + w] = q.pos[i * 3 + w]; if (x < a[w]) a[w] = x; if (x > b[w]) b[w] = x; N[d * 4 + w] = Math.round(q.nor[i * 3 + w] * 127)} T[d * 2] = q.uv[i * 2]; T[d * 2 + 1] = q.uv[i * 2 + 1]; C[d] = q.col[i]; Q[d] = q.capa[i]; Z[d] = q.piv[i]}
  const c = a.map((x, w) => (x + b[w]) / 2); let r = 0; for (let j = 0; j < n; j++) r = Math.max(r, (P[j * 3] - c[0]) ** 2 + (P[j * 3 + 1] - c[1]) ** 2 + (P[j * 3 + 2] - c[2]) ** 2);
  return {pos: P, nor: N, uv: T, col: new Uint8Array(C.buffer), capa: new Uint8Array(Q.buffer), piv: new Int16Array(Z.buffer), idx, R, c, h: a.map((x, w) => (b[w] - x) / 2), r: Math.sqrt(r)};
}
onmessage = async ({data: q}) => {
  try {
    await S.ready; const n = q.pos.length / 3, I = q.idx || Uint32Array.from({length: n}, (_, i) => i); q.col = new Uint32Array(q.col.buffer); q.capa = new Uint32Array(q.capa.buffer); q.piv = new Uint32Array(q.piv.buffer);
    let G = [I]; if (q.celda) {const M = new Map(); for (let t = 0; t < I.length; t += 3) {const x = q.pos[I[t] * 3] + q.pos[I[t + 1] * 3] + q.pos[I[t + 2] * 3], z = q.pos[I[t] * 3 + 2] + q.pos[I[t + 1] * 3 + 2] + q.pos[I[t + 2] * 3 + 2], k = Math.floor(x / 3 / q.celda) * 4096 + Math.floor(z / 3 / q.celda); let l = M.get(k); if (!l) M.set(k, l = []); l.push(I[t], I[t + 1], I[t + 2])} G = [...M.values()].map(l => Uint32Array.from(l))}
    const T = G.map(i => trozo(q, i)).filter(Boolean); postMessage({id: q.id, T}, T.flatMap(t => [t.pos.buffer, t.nor.buffer, t.uv.buffer, t.col.buffer, t.capa.buffer, t.piv.buffer, t.idx.buffer]));
  } catch (e) {postMessage({id: q.id, mal: String(e && e.stack || e)})}
};
