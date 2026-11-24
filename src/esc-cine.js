/* Cámara de cine: graba el tren desde fuera y va cambiando de plano sola (travelín a su lado, por delante, grúa, teleobjetivo,
   a pie de vía, la boca de un túnel…). Trabaja en coordenadas de la maqueta y sin DOM.
   En cada corte se prueban muchos planos: se simula por dónde irá el tren mientras dure y se queda el que mejor lo ve. */
import {lerp, clamp, sstep} from './kit.js';
import {atM, kindAt, KT, KB, BW, BD} from './esc-vias.js';
import {V} from './esc-tren.js';

const mod = (x, L) => ((x % L) + L) % L, io = u => u * u * (3 - 2 * u), G = 180 / Math.PI;
const ALTO = (r, h) => h || clamp(r * 1.7, 2.6, 11);                 // altura que se le supone a lo que ocupa un círculo de radio r

export class Cine {
  constructor() {this.p = [0, 0, 0]; this.l = [0, 0, 0]; this.fov = 36; this.vistos = []; this.pl = null; this.t = 0; this.tipo = ''; this.num = 0}
  empieza(M, {aspecto = 1.7, delante = false} = {}) {this.M = M; this.T = M.T; this.as = aspecto; this.vistos = []; this.ult = null; this.elige(delante); this.corte = false; this.tT = 0}
  /* punto de la vía a la distancia s, desplazado lat hacia un lado y up hacia arriba; el rumbo se promedia para que no dé tirones */
  en(s, lat = 0, up = 0, suave = 0) {
    const T = this.T, q = atM(T, mod(s, T.L)); let a = q.a, x = q.x, y = q.y, z = q.z;
    if (suave) {let c = 0, d = 0, X = 0, Y = 0, Z = 0; for (let k = -3; k <= 3; k++) {const w = atM(T, mod(s + k * suave / 3, T.L)); c += Math.cos(w.a); d += Math.sin(w.a); X += w.x; Y += w.y; Z += w.z} a = Math.atan2(d, c); x = X / 7; y = Y / 7; z = Z / 7}
    return [x - Math.sin(a) * lat, y + up, z + Math.cos(a) * lat];
  }
  s(t = 0) {return this.M.tren.s + V * t}
  enTunel(s) {return kindAt(this.T, mod(s, this.T.L)) === KT}
  /* el túnel en el que está la máquina o en el que entra antes de max: distancia (con signo) a la boca de entrada y largo */
  tunel(s0, max) {let d = 0; if (this.enTunel(s0)) {while (d > -90 && this.enTunel(s0 + d - .5)) d -= .5} else {while (d < max && !this.enTunel(s0 + d)) d += .5; if (d >= max) return null} let n = d + 1; while (n < d + 90 && this.enTunel(s0 + n)) n += .5; return {e: d, f: n}}
  /* distancia hasta la próxima salida de túnel y hasta el próximo puente (o null) */
  salida(s0, max) {for (let d = 0; d < max; d += .5) if (this.enTunel(s0 + d) && !this.enTunel(s0 + d + .5)) return d; return null}
  puente(s0, max) {for (let d = 4; d < max; d += 1) if (kindAt(this.T, mod(s0 + d, this.T.L)) === KB && kindAt(this.T, mod(s0 + d + 6, this.T.L)) === KB) return d + 3; return null}
  suelo(x, z) {return this.M.gy(clamp(x, -BW, BW), clamp(z, -BD, BD))}
  planos() {
    const r = Math.random, L = [], s0 = this.s(), vert = this.as < .8, k = vert ? 1.28 : 1, f = vert ? 1.34 : 1, sg = () => r() < .5 ? 1 : -1, obj = (at = -5, up = 2.6, lead = 0) => t => this.en(s0 + V * t + at + lead, 0, up + (vert ? 2.6 : 0), 3);
    for (let i = 0; i < 6; i++) {const q = sg(), lat = lerp(18, 27, r()) * k, h = lerp(3, 8.5, r()), a = lerp(-16, -4, r()), b = a + lerp(8, 18, r()), dur = lerp(6, 8, r()); L.push({tipo: 'lado', bono: .55, dur, cam: t => this.en(s0 + V * t + lerp(a, b, io(t / dur)) + (vert ? 8 : 0), lat * q * (vert ? 1.35 : 1), h * (vert ? 1.4 : 1), 10), obj: obj(vert ? -3 : -8), fov: () => 36 * f})}
    for (let i = 0; i < 4; i++) {const q = sg(), lat = lerp(4.2, 8, r()) * k, h = lerp(2.6, 5.4, r()), a = lerp(17, 23, r()) * k, b = a + lerp(-5, 5, r()), dur = lerp(5.5, 7, r()); L.push({tipo: 'delante', bono: .5, dur, cam: t => this.en(s0 + V * t + lerp(a, b, io(t / dur)), lat * q, h, 10), obj: obj(-4), fov: () => 33 * f})}
    for (let i = 0; i < 3; i++) {const q = sg(), dur = lerp(6, 7.5, r()), lat = lerp(9, 14, r()) * k, h = lerp(9, 13, r()); L.push({tipo: 'cola', bono: .2, dur, suj: -22, cam: t => this.en(s0 + V * t - lerp(50, 40, io(t / dur)) * k, lat * q, h, 12), obj: obj(-20, 2), fov: () => 36 * f})}
    for (let i = 0; i < 7; i++) {const q = sg(), dur = lerp(5.5, 7, r()), fr = lerp(.66, .84, r()) + (vert ? .12 : 0), c = this.en(s0 + V * dur * fr, lerp(vert ? 8 : 6, vert ? 12 : 10, r()) * q * k, 0), y = Math.max(this.suelo(c[0], c[2]), c[1] - 3) + lerp(1.3, 2.8, r()); c[1] = y; L.push({tipo: 'fija', bono: .6, dur, fijo: 1, cam: () => c, obj: obj(-3.5, 2.4), fov: t => {const o = this.en(s0 + V * t - 3, 0, 2), d = Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]); return clamp(2 * Math.atan(8.4 * k / d) * G, 20, 56) * (vert ? 1.15 : 1)}})}
    for (let i = 0; i < 4; i++) {const q = sg(), dur = lerp(6.5, 8, r()), lat = lerp(22, 32, r()) * q * k, c = this.en(s0 + V * dur * .5, lat, 0, 10), y0 = this.suelo(c[0], c[2]), h0 = lerp(17, 24, r()) * k, h1 = lerp(6, 10, r()), dx = lerp(-6, 6, r()); L.push({tipo: 'grua', bono: .35, dur, cam: t => {const u = io(t / dur); return [c[0] + dx * u, y0 + lerp(h0, h1, u), c[2]]}, obj: obj(vert ? -4 : -8), fov: () => 38 * f})}
    for (const [x, z] of [[-BW + 6, BD + 12], [BW - 6, BD + 12], [0, BD + 22], [-BW - 8, 4], [BW + 8, 4]]) {const h = lerp(13, 21, r()), dur = lerp(5.5, 7, r()), c = [x, Math.max(0, this.suelo(x, z)) + h, z], dx = lerp(-4, 4, r()); L.push({tipo: 'tele', bono: .1, dur, fijo: 1, cam: t => [c[0] + dx * t / dur, c[1], c[2]], obj: obj(-9), fov: t => {const o = this.en(s0 + V * t - 8, 0, 2), d = Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]); return clamp(2 * Math.atan(13 * k / d) * G, 11, vert ? 46 : 34) * (vert ? 1.2 : 1)}})}
    {const w0 = r() * 6.28, dur = 6.5, w = (r() < .5 ? -1 : 1) * .1; L.push({tipo: 'dron', bono: vert ? -.5 : .05, dur, cam: t => {const o = this.en(s0 + V * t - 12, 0, 0, 12), a = w0 + w * t; return [o[0] + Math.cos(a) * 11, o[1] + 25 * k, o[2] + Math.sin(a) * 11]}, obj: obj(vert ? -6 : -12, 1), fov: () => 38 * f})}
    const tu = this.tunel(s0, 26), tcola = tu ? (tu.e + this.M.tren.len - 4) / V : 0, d = this.salida(s0, 34); if (d !== null && d > 1 && (d < 10.5 || tcola < 1.2)) {const e = s0 + d, b = this.en(e, 0, 2.6); for (const q of [-1, 1]) for (const av of [15, 20]) {const c = this.en(e + av, lerp(4.4, 6.5, r()) * q * k, 0); c[1] = Math.max(this.suelo(c[0], c[2]), c[1] - 2) + lerp(1.8, 3.4, r()); const dur = clamp((d + av + 6) / V, 4, 8.5); L.push({tipo: 'boca', bono: 1.1, dur, fijo: 1, boca: 1, cam: () => c, obj: t => {const s = s0 + V * t - 2.5; return s < e ? b : this.en(s, 0, 2.6, 3)}, fov: t => lerp(34, 46, io(t / dur)) * f})}}
    // la máquina ya está dentro (o a punto de entrar): se graba cómo se van metiendo los vagones
    if (tu) {const fin = Math.min((tu.f - 9) / V, tcola); if (fin > 1.6) for (let i = 0; i < 8; i++) {const q = sg(), dur = clamp(Math.min(fin, lerp(5.5, 8, r())), 1.6, 8), av = lerp(8, 24, r()), lat = lerp(7, 15, r()) * q * k, c = this.en(s0 + tu.e - av, lat, 0), y = Math.max(this.suelo(c[0], c[2]), c[1] - 3) + lerp(1.8, 7, r()), g = this.en(s0 + tu.e - av + lerp(-5, 5, r()), lat, 0), tope = tu.e - 5.5; L.push({tipo: 'entrada', bono: 1.2, dur, fijo: 1, libre: 1, cam: t => {const u = io(t / dur); return [lerp(c[0], g[0], u), y, lerp(c[2], g[2], u)]}, obj: t => this.en(s0 + Math.min(tope, V * t - 2.5), 0, 2.6, 3), fov: () => 40 * f})}}
    const pu = this.puente(s0, 40); if (pu !== null) for (const q of [-1, 1]) {const dur = clamp(pu / V + 3.5, 5, 8), c = this.en(s0 + pu, lerp(14, 19, r()) * q * k, 0), y = this.suelo(c[0], c[2]); L.push({tipo: 'puente', bono: .8, dur, cam: t => [c[0], Math.max(y + 1.5, c[1] - 3.5) + t * .18, c[2]], obj: obj(vert ? -4 : -8, 2), fov: () => 36 * f})}
    // los planos que van con la máquina acaban al meterse en el túnel
    if (tu && tu.e > 0) {const te = tu.e / V + .5; for (const p of L) if (!p.libre && !p.boca && p.tipo !== 'cola') {if (te < 2.4) p.bono -= 4; else p.dur = Math.min(p.dur, te)}}
    return L;
  }
  /* ¿cae ese punto dentro de la obra de un puente? (arcos y pilas, del tablero al suelo) */
  viaducto(x, y, z, r) {if (Math.abs(x) > BW || Math.abs(z) > BD) return false; const v = this.M.m.near(x, z, 5); return v.i >= 0 && v.d < r && this.T.k[v.i] === KB && y < this.T.y[v.i] + .4}
  /* se libra de meterse bajo el suelo */
  alza(c) {const g = this.suelo(c[0], c[2]) + 1.1; return c[1] < g ? [c[0], g, c[2]] : c}
  tapada(c, o) {const dx = o[0] - c[0], dy = o[1] - c[1], dz = o[2] - c[2], D = Math.hypot(dx, dz) || 1; for (let j = 1; j < 14; j++) {const u = j / 14, x = c[0] + dx * u, y = c[1] + dy * u, z = c[2] + dz * u; if (Math.abs(x) < BW && Math.abs(z) < BD && y < this.M.gy(x, z) + .35) return true; if (this.viaducto(x, y, z, 1.9) && Math.hypot(o[0] - x, o[2] - z) > 5) return true}
    for (const [x, z, r, h] of this.M.taken) {const u = clamp(((x - c[0]) * dx + (z - c[2]) * dz) / (D * D), 0, 1); if (u < .03 || u > .93) continue; if (Math.hypot(c[0] + dx * u - x, c[2] + dz * u - z) < r * .75 && c[1] + dy * u < this.M.gy(x, z) + ALTO(r, h) * .8) return true} return false}
  nota(p, delante) {
    const K = 9, s0 = this.s(); let ve = 0, mal = 0, ant = null, ini = 0; for (let i = 0; i < K; i++) {
      const t = p.dur * i / (K - 1), c = this.alza(p.cam(t)), o = p.obj(t), tun = this.enTunel(s0 + V * t + (p.suj || -3)); if (Math.abs(c[0]) > BW + 30 || c[2] < -BD + 1.5 || c[2] > BD + 40) return -9;
      const d = Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]); if (d < 5 || d > 150) mal += .5; if (ant && !p.fijo && Math.hypot(c[0] - ant[0], c[1] - ant[1], c[2] - ant[2]) > V * 2.4 * p.dur / (K - 1) + 1.5) mal += 1; ant = c;
      if (Math.abs(c[0]) < BW && Math.abs(c[2]) < BD) {const v = this.M.m.near(c[0], c[2], 8); if (v && v.d < 3.2 && c[1] < this.suelo(c[0], c[2]) + 11) mal += .9; if (this.viaducto(c[0], c[1], c[2], 3.4)) mal += 1.2}
      for (const [x, z, r, h] of this.M.taken) {const D = Math.hypot(c[0] - x, c[2] - z); if (D > r + 5 || c[1] > this.M.gy(x, z) + ALTO(r, h) + 1) continue; if (D < r + .9) {mal += .8; break} if (((x - c[0]) * (o[0] - c[0]) + (z - c[2]) * (o[2] - c[2])) / D / d > .8) {mal += .45; break}}
      const b = (p.boca && tun) || ((p.libre || !tun) && !this.tapada(c, o)); if (b) ve++; if (i < 2 && b) ini++;
    }
    let n = 4.4 * ve / K - 3 * mal / K + p.bono + Math.random() * .75 + (ini === 2 ? .5 : -1.2) - (!p.boca && !p.libre && this.enTunel(s0 + (p.suj || -3)) ? 3 : 0); const a = this.vistos; if (a[0] === p.tipo) n -= 2.6; if (a[1] === p.tipo) n -= 1.1; if (a[2] === p.tipo) n -= .4;
    const c0 = this.alza(p.cam(0)), o0 = p.obj(0), dir = Math.atan2(o0[2] - c0[2], o0[0] - c0[0]); if (this.ult !== null && this.ult !== undefined) {let da = Math.abs(dir - this.ult) % 6.283; if (da > Math.PI) da = 6.283 - da; if (da < .5) n -= 1.3} if (delante) {n += c0[2] > o0[2] + 4 ? 1.6 : -2; if (p.tipo === 'cola' || p.tipo === 'dron') n -= 2; if (p.tipo === 'lado' || p.tipo === 'grua') n += .5} return n;
  }
  elige(delante) {let best = null, bn = -1e9; for (const p of this.planos()) {const n = this.nota(p, delante); if (n > bn) {bn = n; best = p}} this.pl = best; this.tipo = best.tipo; this.num++; this.vistos.unshift(best.tipo); if (this.vistos.length > 4) this.vistos.pop(); this.t = 0; this.mal = 0; this.corte = true; this.pone(0)}
  pone(dt) {const p = this.pl, t = Math.min(this.t, p.dur), c = this.alza(p.cam(t)), o = p.obj(t), n = dt === 0 ? 1 : 1 - Math.exp(-7 * dt), m = dt === 0 ? 1 : 1 - Math.exp(-9 * dt); const w = this.tT || 0, hx = Math.sin(w * .83) * .05 + Math.sin(w * 1.9) * .02, hy = Math.sin(w * 1.07 + 1) * .04; for (let i = 0; i < 3; i++) {this.p[i] = lerp(this.p[i], c[i], n); this.l[i] = lerp(this.l[i], o[i], m)} this.pv = [this.p[0] + hx, this.p[1] + hy, this.p[2]]; this.fov = p.fov(t)}
  /* un fotograma: deja p, l y fov; corte = este fotograma empieza otro plano */
  paso(dt, aspecto) {
    this.as = aspecto; this.corte = false; this.t += dt; this.tT = (this.tT || 0) + dt; const p = this.pl, o = p.obj(this.t), c = this.p; this.ult = Math.atan2(o[2] - c[2], o[0] - c[0]);
    // si el tren se ha perdido de vista, no se espera al final del plano
    this.ck = (this.ck || 0) + dt; if (this.ck > .25) {this.ck = 0; const tun = !p.libre && this.enTunel(this.s() + (p.suj || -3)), mal = p.boca ? false : tun || this.tapada(this.p, o); this.mal = mal ? this.mal + .25 : 0}
    if (this.t >= p.dur || (this.mal > 1 && this.t > 1.6)) this.elige(false); else this.pone(dt); return this;
  }
}
