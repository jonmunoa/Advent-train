/* La cabeza de una persona: piel con gestos, pestañas, cejas, boca y pelo, en la pose y los ejes de las figuras. */
import {BASE, persona, posa, pesos, gesto, mhclo, ajusta, SYS, HU} from './mh.mjs';
import {join} from 'node:path';
import sharp from 'sharp';

export const GESTOS = {
  son: {mouthSmileLeft: .72, mouthSmileRight: .72, cheekSquintLeft: .4, cheekSquintRight: .4, mouthDimpleLeft: .2, mouthDimpleRight: .2, eyeSquintLeft: .12, eyeSquintRight: .12}, abre: {jawOpen: .62, mouthLowerDownLeft: .2, mouthLowerDownRight: .2, mouthUpperUpLeft: .22, mouthUpperUpRight: .22}, o: {jawOpen: .2, mouthFunnel: .6, mouthPucker: .25}, cejaAlza: {browInnerUp: .7, browOuterUpLeft: .75, browOuterUpRight: .75, eyeWideLeft: .45, eyeWideRight: .45}, cejaFrunce: {browDownLeft: .7, browDownRight: .7}, triste: {mouthFrownLeft: .75, mouthFrownRight: .75, mouthShrugLower: .35}, cejaPena: {browInnerUp: 1, browDownLeft: .25, browDownRight: .25}, parp: {eyeBlinkLeft: 1, eyeBlinkRight: 1}, abajo: {eyeLookDownLeft: 1, eyeLookDownRight: 1}, arriba: {eyeLookUpLeft: 1, eyeLookUpRight: 1},
};
/* de los ejes de MakeHuman a los nuestros (la cabeza no se mueve al posar) */
export function cabeza(spec) {
  const v = persona(spec.cuerpo), P = posa(v), esc = spec.esc || 1, out = [], A = p => [(p[2] * .1 - P.cx) * esc, (p[1] - P.y0) * .1 * esc, -p[0] * .1 * esc], dA = d => [d[2] * .1 * esc, d[1] * .1 * esc, -d[0] * .1 * esc];
  const GM = {}; for (const g in GESTOS) GM[g] = gesto(GESTOS[g]); const vm = {}; for (const g in GM) {const q = Float64Array.from(v); for (let i = 0; i < q.length; i++) q[i] += GM[g][i]; vm[g] = q}
  const J = Object.fromEntries(Object.entries(P.J).map(([k, p]) => [k, p.map(x => x * esc)])), yc = J.neck_01[1] - (spec.escote ?? .05) * esc;
  /* piel: caras del cuerpo por encima del cuello del abrigo */
  const alt = i => (v[i * 3 + 1] - P.y0) * .1 * esc, F = BASE.F.filter(f => f.g === 'body' && f.v.every(i => alt(i) > yc) && f.v.every(i => Math.abs(v[i * 3]) * .1 * esc < (spec.ancho ?? .13)));
  out.push(malla('piel', F, BASE.vt, i => A([v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]), i => pesos(i), g => i => dA([GM[g][i * 3], GM[g][i * 3 + 1], GM[g][i * 3 + 2]]), Object.keys(GESTOS)));
  const pieza = (nombre, dir, n, gs, filtro) => {const c = mhclo(join(SYS, dir), n), p = ajusta(c, v), m = {}; for (const g of gs) m[g] = ajusta(c, vm[g]); const FF = filtro ? c.o.F.filter(f => filtro(f, p)) : c.o.F; out.push(malla(nombre, FF, c.o.vt, i => A([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]), () => [[HU.head, 1]], g => i => dA([m[g][i * 3] - p[i * 3], m[g][i * 3 + 1] - p[i * 3 + 1], m[g][i * 3 + 2] - p[i * 3 + 2]]), gs)); return c};
  pieza('pestanas', 'eyelashes/' + spec.pestanas, spec.pestanas, ['parp', 'cejaAlza', 'son', 'abajo', 'arriba']); pieza('cejas', 'eyebrows/' + spec.cejas, spec.cejas, ['cejaAlza', 'cejaFrunce', 'cejaPena']); pieza('dientes', 'teeth/teeth_base', 'teeth_base', ['abre', 'o']); pieza('lengua', 'tongue/tongue01', 'tongue01', ['abre', 'o']); if (spec.pelo) pieza('pelo', 'hair/' + spec.pelo, spec.pelo, []);
  // ojos: centro y radio del globo
  const e = mhclo(join(SYS, 'eyes/high-poly'), 'high-poly'), pe = ajusta(e, v), pts = []; for (let i = 0; i < pe.length / 3; i++) if (pe[i * 3] < 0) pts.push(A([pe[i * 3], pe[i * 3 + 1], pe[i * 3 + 2]])); const c = [0, 1, 2].map(k => (Math.min(...pts.map(p => p[k])) + Math.max(...pts.map(p => p[k]))) / 2), R = (Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1]))) / 2;
  return {piezas: out, J, ojos: {E: c, R}, v, P, esc, A, yc, alto: Math.max(...[...BASE.G.body].map(alt))};
}
/* malla con vértices por (posición, uv), normales suaves y morphs con su normal */
export function malla(nombre, F, vt, pos, pes, morph = null, gs = []) {
  const mapa = new Map(), V = [], UV = [], IX = [], S = [], OR = []; const id = (i, t) => {const k = i + '/' + t; let q = mapa.get(k); if (q === undefined) {q = V.length; mapa.set(k, q); V.push(pos(i)); UV.push(t >= 0 ? [vt[t * 2], vt[t * 2 + 1]] : [0, 0]); S.push(pes(i)); OR.push(i)} return q};
  for (const f of F) {const q = f.v.map((i, k) => id(i, f.t[k])); for (let k = 1; k < q.length - 1; k++) IX.push(q[0], q[k], q[k + 1])}
  const D = {}; for (const g of gs) {const m = morph(g); D[g] = OR.map(m)}
  // el sentido de las caras se conserva (giro propio de los ejes)
  const N = normales(V, IX, OR), DN = {}; for (const g of gs) {const W = V.map((p, i) => p.map((x, k) => x + D[g][i][k])), n2 = normales(W, IX, OR); DN[g] = n2.map((q, i) => q.map((x, k) => x - N[i][k]))}
  return {nombre, V, N, UV, IX, S, D, DN};
}
export function normales(V, IX, OR) {const A = new Map(), k = i => OR ? OR[i] : i; for (let t = 0; t < IX.length; t += 3) {const [a, b, c] = [V[IX[t]], V[IX[t + 1]], V[IX[t + 2]]], e = [0, 1, 2].map(i => b[i] - a[i]), f = [0, 1, 2].map(i => c[i] - a[i]), n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]]; for (let j = 0; j < 3; j++) {const q = k(IX[t + j]), m = A.get(q) || [0, 0, 0]; for (let i = 0; i < 3; i++) m[i] += n[i]; A.set(q, m)}} return V.map((_, i) => {const n = A.get(k(i)) || [0, 1, 0], l = Math.hypot(...n) || 1; return n.map(x => x / l)})}
/* recorta la textura de la piel a la zona usada, la retoca y saca un relieve fino de ella */
export async function pielTex(m, fich, out, {px = 1024, mod = null, relieve = 1.6} = {}) {
  let u0 = 1, u1 = 0, v0 = 1, v1 = 0; for (const [u, v] of m.UV) {u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v)} u0 = Math.max(0, u0 - .004); v0 = Math.max(0, v0 - .004); u1 = Math.min(1, u1 + .004); v1 = Math.min(1, v1 + .004); const me = await sharp(fich).metadata(), W = me.width, H = me.height, x = Math.floor(u0 * W), y = Math.floor((1 - v1) * H), w = Math.min(W - x, Math.ceil((u1 - u0) * W)), h = Math.min(H - y, Math.ceil((v1 - v0) * H));
  m.UV.forEach(q => {q[0] = (q[0] * W - x) / w; q[1] = 1 - ((1 - q[1]) * H - y) / h}); let im = sharp(fich).extract({left: x, top: y, width: w, height: h}).removeAlpha().resize(px, px, {kernel: 'lanczos3'}); if (mod) im = im.modulate(mod); const rgb = await im.raw().toBuffer(); await sharp(rgb, {raw: {width: px, height: px, channels: 3}}).webp({quality: 84, effort: 6}).toFile(out + '_d.webp');
  const g = await sharp(rgb, {raw: {width: px, height: px, channels: 3}}).greyscale().extractChannel(0).raw().toBuffer(), bl = await sharp(g, {raw: {width: px, height: px, channels: 1}}).blur(5).extractChannel(0).raw().toBuffer(), hh = new Float32Array(px * px); for (let i = 0; i < px * px; i++) hh[i] = (g[i] - bl[i]) / 255; const nb = Buffer.alloc(px * px * 3); for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {const at = (a, b) => hh[((b + px) % px) * px + ((a + px) % px)], dx = (at(i + 1, j) - at(i - 1, j)) * relieve * 6, dy = (at(i, j + 1) - at(i, j - 1)) * relieve * 6, l = Math.hypot(dx, dy, 1); nb[(j * px + i) * 3] = (-dx / l * .5 + .5) * 255; nb[(j * px + i) * 3 + 1] = (dy / l * .5 + .5) * 255; nb[(j * px + i) * 3 + 2] = 255} await sharp(nb, {raw: {width: px, height: px, channels: 3}}).webp({quality: 80, effort: 6}).toFile(out + '_n.webp');
}
