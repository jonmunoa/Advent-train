/* El tren que se oye: resoplidos de vapor al compás de la música, juntas de los carriles bajo cada vagón, rodar, vapor, válvula,
   silbato y campana. Cada cosa suena según lo lejos que esté de la cámara y a qué lado; en el túnel se apaga y retumba,
   y en los puentes suena a hueco. Las posiciones van en coordenadas de la maqueta. */
import {atM, kindAt, KT, KB} from './esc-vias.js';
import {V} from './esc-tren.js';
import {P, azar} from './lofi.js';

const rn = azar(41), ruido = () => rn() * 2 - 1, TAU = Math.PI * 2, J = 24, clampa = (x, a, b) => Math.min(b, Math.max(a, x));
const haz = (ac, sr, s, fn, g = .8) => {const b = ac.createBuffer(1, Math.floor(sr * s), sr), o = b.getChannelData(0); fn(o, sr); let m = 1e-6; for (const v of o) m = Math.max(m, Math.abs(v)); for (let i = 0; i < o.length; i++) o[i] *= g / m; return b};
/* filtro de estado variable: devuelve paso bajo, banda y alto */
const svf = (fc, q, sr) => {const f = 2 * Math.sin(Math.PI * Math.min(.22, fc / sr)); let l = 0, b = 0; return x => {l += f * b; const h = x - l - q * b; b += f * h; return [l, b, h]}};
const reson = (o, sr, L, imp) => {for (const [f, a, k] of L) {const w = TAU * f / sr, r = Math.exp(-k / sr), c = 2 * r * Math.cos(w), r2 = r * r; let y1 = 0, y2 = 0; for (let i = 0; i < o.length; i++) {const y = c * y1 - r2 * y2 + (i < imp.length ? imp[i] * a * Math.sin(w) : 0); o[i] += y; y2 = y1; y1 = y}}};
const golpecillo = (n, d) => {const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = ruido() * Math.exp(-i / d); return o};
/* bucle que no se nota: el principio lleva fundido el final */
const bucle = (ac, sr, s, fn, g) => {const b = haz(ac, sr, s + .6, fn, g), o = b.getChannelData(0), n = Math.floor(sr * .6), L = o.length - n; for (let i = 0; i < n; i++) {const u = i / n; o[i] = o[i] * Math.sqrt(u) + o[L + i] * Math.sqrt(1 - u)} b.fin = L / sr; return b};

export class SonidoTren {
  constructor(ac, salida, rev) {
    this.ac = ac; const g = v => {const x = ac.createGain(); x.gain.value = v; return x}, pan = () => ac.createStereoPanner ? ac.createStereoPanner() : g(1);
    this.out = g(0); this.out.connect(salida); this.rs = g(.12); this.rs.connect(rev);
    // máquina: filtro (túnel), posición y sala
    this.lf = ac.createBiquadFilter(); this.lf.type = 'lowpass'; this.lf.frequency.value = 9000; this.lg = g(1); this.lp = pan(); this.lf.connect(this.lg); this.lg.connect(this.lp); this.lp.connect(this.out); this.lg.connect(this.rs);
    this.vg = g(1); this.vg.connect(this.out); this.vr = g(.35); this.vg.connect(this.vr); this.vr.connect(this.rs);
    this.ult = new Map(); this.sig = 0; this.nivel = 0; this.gl = 0; this.sube = 0; this.k = 0; this.silb = -99; this.camp = -99; this.valv = 0; this.tunel = false; this.ton = 0; this.menor = false; this.listo = false; this.hor = .25;
  }
  /* las muestras se hacen de una en una (cada una, menos de 10 ms) */
  *hace() {
    const ac = this.ac, sr = 24000; this.chuf = []; for (let k = 0; k < 4; k++) {this.chuf.push(haz(ac, sr, .42, (o, sr) => {const a = svf(430 + k * 40, .55, sr), h = svf(2700, .9, sr), c = svf(120, .7, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, e = (1 - Math.exp(-t * 95)) * Math.exp(-t * (8.2 + k * .6)), x = ruido(); o[i] = a(x)[1] * e * 1.15 + h(x)[1] * .16 * (1 - Math.exp(-t * 40)) * Math.exp(-t * 11) + c(x)[0] * e * .9} for (let i = 0; i < 900; i++) o[o.length - 1 - i] *= i / 900}, .8)); yield}
    this.riel = []; for (let k = 0; k < 4; k++) {this.riel.push(haz(ac, 32000, .2, (o, sr) => {reson(o, sr, [[168 + k * 9, 1, 30], [402 + k * 21, .85, 46], [1080 + k * 70, .16, 85], [2350 + k * 120, .06, 120]], golpecillo(90, 26))}, .7)); yield}
    this.hueco = []; for (let k = 0; k < 3; k++) {this.hueco.push(haz(ac, 32000, .34, (o, sr) => {reson(o, sr, [[104 + k * 7, 1, 17], [233 + k * 11, .75, 24], [520 + k * 30, .3, 40], [1300, .1, 90]], golpecillo(140, 40))}, .75)); yield}
    this.bRodar = bucle(ac, 16000, 7, (o, sr) => {let y = 0, z = 0; const b = svf(340, .8, sr), h = svf(1500, .8, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, x = ruido(); y += .05 * (x - y); z += .006 * (y - z); o[i] = (y - z) * 2.2 + b(x)[1] * .1 * (1 + .25 * Math.sin(TAU * t / P / 2)) + h(x)[1] * .008}}, .8); yield;
    this.bVapor = bucle(ac, 24000, 5, (o, sr) => {const b = svf(3600, .9, sr); let l = 0; for (let i = 0; i < o.length; i++) {const t = i / sr; l += .0006 * (ruido() - l); o[i] = b(ruido())[1] * (.8 + 4 * Math.abs(l)) * (.85 + .15 * Math.sin(TAU * t * .8))}}, .6); yield;
    this.bValv = haz(ac, 24000, 2.6, (o, sr) => {const b = svf(3100, .7, sr), l = svf(700, .9, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, e = Math.min(1, t * 9) * (t < .9 ? 1 : Math.exp(-(t - .9) * 2.6)); const x = ruido(); o[i] = (b(x)[1] + .4 * l(x)[1]) * e}}, .6); yield;
    this.bCamp = haz(ac, 32000, 2.4, (o, sr) => {reson(o, sr, [[660, 1, 2.2], [1322, .55, 3.2], [1782, .42, 4.2], [2680, .25, 6.5], [3905, .12, 10]], golpecillo(40, 10))}, .6); yield;
    const lz = (b, d) => {const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.loopEnd = b.fin; const g = ac.createGain(); g.gain.value = 0; s.connect(g); g.connect(d); s.start(); return g}; this.gRodar = lz(this.bRodar, this.vg); this.gVapor = lz(this.bVapor, this.lf); this.listo = true;
  }
  suelta(b, t, v, destino, {rate = 1, p = 0} = {}) {const ac = this.ac, s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = v; s.connect(g); let n = g; if (p && ac.createStereoPanner) {n = ac.createStereoPanner(); n.pan.value = p; g.connect(n)} n.connect(destino); s.start(Math.max(t, ac.currentTime)); s.onended = () => {g.disconnect(); if (n !== g) n.disconnect()}}
  /* silbato de tres tonos, afinado con la canción que suena */
  silbato(fuerte = 1, largo = 1, destino = this.lf) {
    if (!this.listo) return; const ac = this.ac, t = ac.currentTime + .05; this.silb = t; const base = 60 + this.ton - (this.ton > 6 ? 12 : 0), N = this.menor ? [base, base + 3, base + 7] : [base, base + 4, base + 9], pat = largo > 1 ? [[0, 1.1], [1.35, .45], [2.05, 1.7]] : [[0, .5], [.72, 1.35]], d = ac.createGain(); d.gain.value = .5 * fuerte; d.connect(destino); if (destino !== this.lf) d.connect(this.rs);
    for (const [t0, L] of pat) for (const [i, n] of N.entries()) {const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = 440 * Math.pow(2, (n + 12 - 69) / 12), a = t + t0 + i * .012; o.type = 'triangle'; o2.type = 'sine'; for (const [q, m] of [[o, 1], [o2, 2.005]]) {q.frequency.setValueAtTime(f * m * .955, a); q.frequency.exponentialRampToValueAtTime(f * m, a + .11); q.frequency.setValueAtTime(f * m, a + L); q.frequency.exponentialRampToValueAtTime(f * m * .93, a + L + .22)} const g2 = ac.createGain(); g2.gain.value = .22; g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(.085, a + .09); g.gain.setValueAtTime(.085, a + L); g.gain.exponentialRampToValueAtTime(.0004, a + L + .3); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(d); for (const q of [o, o2]) {q.start(a); q.stop(a + L + .35)} if (!i) {const s = ac.createBufferSource(), sg = ac.createGain(); s.buffer = this.bVapor; s.loop = true; sg.gain.setValueAtTime(0, a); sg.gain.linearRampToValueAtTime(.09, a + .05); sg.gain.setValueAtTime(.06, a + L); sg.gain.linearRampToValueAtTime(0, a + L + .18); s.connect(sg); sg.connect(d); s.start(a, rn() * 3); s.stop(a + L + .25)}}
  }
  campana(n = 5) {if (!this.listo) return; const t = this.ac.currentTime + .05; this.camp = t; const r = Math.pow(2, ((this.ton + 4) % 12 - 4 + 7) / 12 - .6); for (let i = 0; i < n; i++) this.suelta(this.bCamp, t + i * P * 2, .16 * (i % 2 ? .7 : 1), this.lf, {rate: clampa(r, .7, 1.5)})}
  /* un fotograma. o: {T, s, w, off, c: [x, y, z] cámara, d: [x, z] lado derecho de la cámara, nivel: 0–1} */
  paso(o) {
    if (!this.listo) return; const ac = this.ac, t = ac.currentTime, {T, s, off, c} = o, q = atM(T, s), dx = q.x - c[0], dy = q.y + 3 - c[1], dz = q.z - c[2], d = Math.hypot(dx, dy, dz), lado = d > 1 ? (dx * o.d[0] + dz * o.d[1]) / d : 0; this.o = o; this.tO = t; this.nivel = o.nivel;
    this.out.gain.setTargetAtTime(o.nivel, t, .35); this.gl = 1 / (1 + Math.pow(d / 24, 1.7)); const tn = kindAt(T, (s + T.L) % T.L) === KT; this.lg.gain.setTargetAtTime(this.gl * (tn ? .5 : 1), t, .15); if (this.lp.pan) this.lp.pan.setTargetAtTime(clampa(lado, -1, 1) * .7, t, .15); if (tn !== this.tunel) {this.tunel = tn; this.lf.frequency.setTargetAtTime(tn ? 620 : 9000, t, .25); this.rs.gain.setTargetAtTime(tn ? .7 : .12, t, .3)}
    // rodar: del vagón más cercano
    let dm = 1e9; for (let i = 0; i < off.length; i++) {const p = atM(T, (s + off[i] + T.L * 2) % T.L); dm = Math.min(dm, Math.hypot(p.x - c[0], p.y + 1 - c[1], p.z - c[2]))} this.gRodar.gain.setTargetAtTime(.075 / (1 + Math.pow(dm / 15, 1.8)), t, .25); this.gVapor.gain.setTargetAtTime(.022, t, .3);
    const a = atM(T, (s + 4) % T.L); this.sube = clampa((a.y - q.y) / 4, -.12, .12);
    // juntas de los carriles bajo cada bogie
    const hor = t + this.hor; for (let i = 0; i < off.length; i++) for (const b of [-2.45, 2.45]) {const u = o.w + off[i] + b, n = Math.ceil(u / J), dt = (n * J - u) / V, k = i * 2 + (b > 0 ? 1 : 0); if (t + dt > hor || this.ult.get(k) === n) continue; this.ult.set(k, n); const sp = (s + off[i] + b + V * dt + T.L * 2) % T.L, p = atM(T, sp), ex = p.x - c[0], ez = p.z - c[2], e = Math.hypot(ex, p.y - c[1], ez), g = 1 / (1 + Math.pow(e / 13, 2)); if (g < .03) continue; const pu = kindAt(T, sp) === KB, tu = kindAt(T, sp) === KT, B = pu ? this.hueco : this.riel, v = g * (tu ? .6 : .95) * (pu ? 1.1 : 1), pn = clampa((ex * o.d[0] + ez * o.d[1]) / Math.max(1, e), -1, 1) * .8; for (const [h, w] of [[0, 1], [1 / V, .72]]) this.suelta(B[Math.floor(rn() * B.length)], t + dt + h, v * w * (.85 + rn() * .3), this.vg, {rate: .94 + rn() * .12, p: pn})}
    // silbato antes de los túneles, campana al salir y de vez en cuando, válvula
    const dent = kindAt(T, (s + 20) % T.L) === KT, ya = kindAt(T, (s + 3) % T.L) === KT; if (dent && !ya && t - this.silb > 38 && o.nivel > .5) this.silbato(.8, rn() < .4 ? 2 : 1); if (!this.prox) this.prox = t + 16 + rn() * 20; if (t > this.prox && !tn) {this.prox = t + 38 + rn() * 45; if (o.nivel > .5) {if (t - this.silb > 30 && rn() < .55) this.silbato(.65, 1); else if (t - this.camp > 30) this.campana(4 + Math.floor(rn() * 3))}} if (t > this.valv) {if (this.valv) this.suelta(this.bValv, t, .13 + rn() * .07, this.lf, {rate: .9 + rn() * .2}); this.valv = t + 24 + rn() * 32}
  }
  /* resoplidos: media vuelta de rueda cada uno, a la vez que las corcheas de la música (sigue aunque la pestaña esté escondida) */
  tic(rejilla, hor) {
    if (!this.listo || this.nivel < .01) return; const ac = this.ac, t = ac.currentTime; this.hor = hor; let n = rejilla(Math.max(this.sig, t + .02)); while (n < t + hor) {const k = this.k++ % 4, v = [1, .62, .82, .58][k] * (.92 + rn() * .16) * (1 + this.sube * 3.2); this.suelta(this.chuf[(k + (rn() < .3 ? 1 : 0)) % 4], n + (rn() - .5) * .006, .8 * v, this.lf, {rate: (.94 + rn() * .1) * (1 - this.sube * .8)}); this.sig = n + P * .5; n = rejilla(this.sig)}
  }
  /* sin fotogramas (pestaña escondida o en la calle lejos) baja solo */
  fuera() {this.nivel = 0; this.out.gain.setTargetAtTime(0, this.ac.currentTime, .4)}
}
