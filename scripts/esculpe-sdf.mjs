/* Superficies implícitas: primitivas, rejilla de resolución variable y mallado (surface nets) con proyección sobre la superficie */
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k, sstep = (a, b, v) => {const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)}, gauss = (d, s) => Math.exp(-(d * d) / (s * s));
export const sabs = z => Math.sqrt(z * z + 2.5e-6);
export const smin = (a, b, k) => {const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25}, smax = (a, b, k) => -smin(-a, -b, k);
export const sph = (x, y, z, r) => Math.sqrt(x * x + y * y + z * z) - r;
export const ell = (x, y, z, a, b, c) => {const u = x / a, v = y / b, w = z / c, k0 = Math.sqrt(u * u + v * v + w * w), u2 = u / a, v2 = v / b, w2 = w / c, k1 = Math.sqrt(u2 * u2 + v2 * v2 + w2 * w2); return k1 < 1e-9 ? -Math.min(a, b, c) : k0 * (k0 - 1) / k1};
/* cápsula de a (r1) a b (r2) */
export const cap = (x, y, z, a, b, r1, r2 = r1) => {const px = x - a[0], py = y - a[1], pz = z - a[2], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], t = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1); return Math.hypot(px - bx * t, py - by * t, pz - bz * t) - (r1 + (r2 - r1) * t)};
/* distancia a una polilínea; devuelve [d, t] con t 0–1 */
export const poli = (x, y, z, P) => {let m = 1e9, tt = 0; for (let i = 0; i < P.length - 1; i++) {const a = P[i], b = P[i + 1], px = x - a[0], py = y - a[1], pz = z - a[2], bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], t = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1), d = Math.hypot(px - bx * t, py - by * t, pz - bz * t); if (d < m) {m = d; tt = (i + t) / (P.length - 1)}} return [m, tt]};
export const grad = (f, x, y, z, e = 4e-4) => {const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l, l / (2 * e)]};
export const azar = s => () => {s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296};

/* un eje con más muestras donde denso(v) es mayor */
const eje = (a, b, h, denso) => {const o = [a]; let v = a; while (v < b) {const d = denso ? denso(v) : 1; v += h / d; o.push(v)} return Float64Array.from(o)};
export const rejilla = (caja, h, denso = []) => caja.map(([a, b], i) => eje(a, b, h, denso[i]));

export function malla(f, [X, Y, Z], vale) {
  const nx = X.length, ny = Y.length, nz = Z.length, D = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  // primero una pasada basta: lejos de la superficie no hace falta evaluar cada nodo
  const Q = 4; for (let k = 0; k < nz; k += Q) for (let j = 0; j < ny; j += Q) for (let i = 0; i < nx; i += Q) {
    const i2 = Math.min(i + Q, nx - 1), j2 = Math.min(j + Q, ny - 1), k2 = Math.min(k + Q, nz - 1), cx = (X[i] + X[i2]) / 2, cy = (Y[j] + Y[j2]) / 2, cz = (Z[k] + Z[k2]) / 2, d = f(cx, cy, cz), r = Math.hypot(X[i2] - X[i], Y[j2] - Y[j], Z[k2] - Z[k]) / 2, lejos = Math.abs(d) > r * 3 + .008;
    for (let c = k; c < Math.min(k + Q, nz); c++) for (let b = j; b < Math.min(j + Q, ny); b++) for (let a = i; a < Math.min(i + Q, nx); a++) D[id(a, b, c)] = lejos ? d : f(X[a], Y[b], Z[c]);
  }
  const V = new Int32Array(nx * ny * nz).fill(-1), P = []; const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], c8 = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0; for (let q = 0; q < 8; q++) {const d = D[id(i + (q & 1), j + (q >> 1 & 1), k + (q >> 2))]; c8[q] = d; if (d < 0) m |= 1 << q} if (m === 0 || m === 255) continue;
    let x = 0, y = 0, z = 0, n = 0; for (const [a, b] of E) if ((m >> a & 1) !== (m >> b & 1)) {const t = c8[a] / (c8[a] - c8[b]); x += lerp(a & 1, b & 1, t); y += lerp(a >> 1 & 1, b >> 1 & 1, t); z += lerp(a >> 2, b >> 2, t); n++} x /= n; y /= n; z /= n;
    let px = lerp(X[i], X[i + 1], x), py = lerp(Y[j], Y[j + 1], y), pz = lerp(Z[k], Z[k + 1], z); const lim = Math.min(X[i + 1] - X[i], Y[j + 1] - Y[j], Z[k + 1] - Z[k]) * .6; let mv = 0;
    for (let q = 0; q < 3; q++) {const d = f(px, py, pz), g = grad(f, px, py, pz, 3e-4); if (g[3] < .2) break; const s = clamp(d / Math.max(.6, g[3]), -lim + mv, lim - mv); px -= g[0] * s; py -= g[1] * s; pz -= g[2] * s; mv += Math.abs(s); if (Math.abs(s) < 1e-5 || mv > lim) break}
    V[id(i, j, k)] = P.length / 3; P.push(px, py, pz);
  }
  const ix = [], quad = (a, b, c, d, inv) => {if (a < 0 || b < 0 || c < 0 || d < 0) return; if (inv) ix.push(a, c, b, a, d, c); else ix.push(a, b, c, a, c, d)};
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = D[id(i, j, k)] < 0; if (s0 !== D[id(i + 1, j, k)] < 0) quad(V[id(i, j - 1, k - 1)], V[id(i, j, k - 1)], V[id(i, j, k)], V[id(i, j - 1, k)], !s0);
    if (s0 !== D[id(i, j + 1, k)] < 0) quad(V[id(i - 1, j, k - 1)], V[id(i - 1, j, k)], V[id(i, j, k)], V[id(i, j, k - 1)], !s0);
    if (s0 !== D[id(i, j, k + 1)] < 0) quad(V[id(i - 1, j - 1, k)], V[id(i, j - 1, k)], V[id(i, j, k)], V[id(i - 1, j, k)], !s0);
  }
  let M = {p: Float32Array.from(P), ix: Uint32Array.from(ix)}; if (vale) {const o = []; for (let t = 0; t < M.ix.length; t += 3) {let ok = false; for (let q = 0; q < 3; q++) {const v = M.ix[t + q] * 3; if (vale(M.p[v], M.p[v + 1], M.p[v + 2])) ok = true} if (ok) o.push(M.ix[t], M.ix[t + 1], M.ix[t + 2])} M.ix = Uint32Array.from(o); M = compacta(M)} return M;
}
/* quita los vértices sin usar */
export function compacta(M) {
  const n = M.p.length / 3, re = new Int32Array(n).fill(-1); let k = 0; for (const i of M.ix) if (re[i] < 0) re[i] = k++; const o = {ix: Uint32Array.from(M.ix, i => re[i])};
  for (const [q, s] of [['p', 3], ['n', 3], ['c', 4], ['uv', 2]]) if (M[q]) {const a = new Float32Array(k * s); for (let i = 0; i < n; i++) if (re[i] >= 0) for (let c = 0; c < s; c++) a[re[i] * s + c] = M[q][i * s + c]; o[q] = a} return o;
}
export function normales(f, M, e) {const n = M.p.length / 3, N = M.n = new Float32Array(n * 3); for (let i = 0; i < n; i++) {const g = grad(f, M.p[i * 3], M.p[i * 3 + 1], M.p[i * 3 + 2], e); N.set([g[0], g[1], g[2]], i * 3)}}
/* normales por triángulos (para los morphs) */
export function normalesTri(p, ix) {const N = new Float32Array(p.length); for (let t = 0; t < ix.length; t += 3) {const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2], x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; for (const q of [a, b, c]) {N[q] += x; N[q + 1] += y; N[q + 2] += z}} for (let i = 0; i < N.length; i += 3) {const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l} return N}
/* oclusión: cuánto tapa la propia forma (y otras) alrededor del punto */
export function oclusion(f, x, y, z, nx, ny, nz, R = .03) {
  let s = 0, w = 0; const tx = Math.abs(nx) < .8 ? [1, 0, 0] : [0, 1, 0], ux = ny * tx[2] - nz * tx[1], uy = nz * tx[0] - nx * tx[2], uz = nx * tx[1] - ny * tx[0], ul = Math.hypot(ux, uy, uz), a = [ux / ul, uy / ul, uz / ul], b = [ny * a[2] - nz * a[1], nz * a[0] - nx * a[2], nx * a[1] - ny * a[0]];
  for (let q = 0; q < 9; q++) {const th = q ? (q - 1) / 8 * 6.2832 : 0, ti = q ? .95 : 0, c = Math.cos(ti), si = Math.sin(ti), dx = nx * c + (a[0] * Math.cos(th) + b[0] * Math.sin(th)) * si, dy = ny * c + (a[1] * Math.cos(th) + b[1] * Math.sin(th)) * si, dz = nz * c + (a[2] * Math.cos(th) + b[2] * Math.sin(th)) * si; let oc = 0, ww = 0; for (const t of [.12, .28, .55, 1]) {const h = R * t, d = f(x + dx * h, y + dy * h, z + dz * h), k = 1 / (1 + t * 1.6); oc += clamp((h * c - d) / h, 0, 1) * k; ww += k} s += oc / ww * (q ? 1 : 1.5); w += q ? 1 : 1.5}
  return clamp(1 - s / w * 1.25, 0, 1);
}
/* tubo que sigue una polilínea suavizada; perfil(t) da [radio ancho, radio alto]; arr(t) es la normal «arriba» aproximada */
export function tubo(P, perfil, {lados = 6, seg = 10, arr = [0, 1, 0], color = () => [1, 0, 0, .75], tapas = true} = {}) {
  const cr = (u) => {const n = P.length - 1, x = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), t = x - i, g = k => P[clamp(k, 0, n)], a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2), o = []; for (let q = 0; q < 3; q++) o.push(.5 * (2 * b[q] + (c[q] - a[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * t * t + (3 * b[q] - a[q] - 3 * c[q] + d[q]) * t * t * t)); return o};
  const M = {p: [], n: [], c: [], uv: [], ix: []}, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nor = v => {const l = Math.hypot(...v) || 1; return v.map(q => q / l)};
  for (let i = 0; i <= seg; i++) {const u = i / seg, c = cr(u), T = nor(sub(cr(Math.min(1, u + .02)), cr(Math.max(0, u - .02)))), up = typeof arr === 'function' ? arr(c, u) : arr, S = nor(cross(T, up)), U = nor(cross(S, T)), [rw, rh] = perfil(u); for (let k = 0; k <= lados; k++) {const a = k / lados * 6.2832, ca = Math.cos(a), sa = Math.sin(a); M.p.push(c[0] + S[0] * ca * rw + U[0] * sa * rh, c[1] + S[1] * ca * rw + U[1] * sa * rh, c[2] + S[2] * ca * rw + U[2] * sa * rh); const nn = nor([S[0] * ca / rw + U[0] * sa / rh, S[1] * ca / rw + U[1] * sa / rh, S[2] * ca / rw + U[2] * sa / rh]); M.n.push(...nn); M.c.push(...color(u, a, c)); M.uv.push(k / lados, u)}}
  const w = lados + 1; for (let i = 0; i < seg; i++) for (let k = 0; k < lados; k++) {const a = i * w + k, b = a + 1, c = a + w, d = c + 1; M.ix.push(a, c, b, b, c, d)} return M;
}
