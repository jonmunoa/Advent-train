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
    this.lf = ac.createBiquadFilter(); this.lf.type = 'lowpass'; this.lf.frequency.value = 5600; this.lg = g(1); this.lp = pan(); this.lf.connect(this.lg); this.lg.connect(this.lp); this.lp.connect(this.out); this.lg.connect(this.rs);
    this.vg = g(1); this.vg.connect(this.out); this.vr = g(.35); this.vg.connect(this.vr); this.vr.connect(this.rs);
    this.ult = new Map(); this.sig = 0; this.nivel = 0; this.gl = 0; this.sube = 0; this.k = 0; this.silb = -99; this.camp = -99; this.valv = 0; this.tunel = false; this.clase = 'vapor'; this.ton = 0; this.menor = false; this.listo = false; this.hor = .25;
  }
  /* las muestras se hacen de una en una (cada una, menos de 10 ms) */
  *hace() {
    const ac = this.ac, sr = 24000;
    // resoplido: el golpe del escape en la chimenea (formantes graves), el aire, y el «fff» del vapor que se va quedando atrás
    this.chuf = []; for (let k = 0; k < 4; k++) {this.chuf.push(haz(ac, sr, .62, (o, sr) => {
      const F = [[88 + k * 5, .34, 1.15 - k * .12], [184 + k * 9, .3, 1], [338 + k * 16, .34, .95], [640 + k * 30, .5, .62], [1180 + k * 60, .75, .34]].map(([f, q, g]) => [svf(f, q, sr), g]), h = svf(2900 + k * 150, .9, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, e = (1 - Math.exp(-t * 130)) * Math.exp(-t * (9.4 + k * .5)), v = (1 - Math.exp(-t * 34)) * Math.exp(-t * 5.4), x = ruido(); let y = 0; for (const [f, g] of F) y += f(x * e)[1] * g; o[i] = y + h(x)[1] * (.14 * e + .06 * v)} for (let i = 0; i < 1600; i++) o[o.length - 1 - i] *= i / 1600}, .8)); yield}
    // junta del carril: «ta» seco y «tán» que resuena, más el golpe en la traviesa
    this.riel = []; this.riel2 = []; for (let k = 0; k < 3; k++) {
      this.riel.push(haz(ac, 32000, .16, (o, sr) => {reson(o, sr, [[112 + k * 6, .16, 40], [214 + k * 9, .36, 46], [455 + k * 21, 1, 52], [860 + k * 40, .75, 70], [1640 + k * 70, .3, 120]], golpecillo(70, 16)); const b = svf(1500, .7, sr); for (let i = 0; i < 700; i++) o[i] += b(ruido())[1] * .5 * Math.exp(-i / 120)}, .72)); yield;
      this.riel2.push(haz(ac, 32000, .34, (o, sr) => {reson(o, sr, [[92 + k * 5, .18, 28], [172 + k * 8, .42, 30], [372 + k * 17, 1, 30], [702 + k * 33, .75, 38], [1240 + k * 50, .34, 52], [2160 + k * 90, .1, 70]], golpecillo(90, 24)); const b = svf(1100, .7, sr); for (let i = 0; i < 700; i++) o[i] += b(ruido())[1] * .35 * Math.exp(-i / 140)}, .75)); yield;
    }
    this.hueco = []; for (let k = 0; k < 3; k++) {this.hueco.push(haz(ac, 32000, .4, (o, sr) => {reson(o, sr, [[104 + k * 7, .3, 16], [221 + k * 11, .8, 19], [498 + k * 30, 1, 26], [960 + k * 40, .4, 50]], golpecillo(140, 40))}, .78)); yield}
    // biela: un tintineo de hierro engrasado a mitad de cada resoplido
    this.biela = []; for (let k = 0; k < 3; k++) this.biela.push(haz(ac, 32000, .16, (o, sr) => {reson(o, sr, [[430 + k * 24, 1, 42], [790 + k * 50, .8, 52], [1460 + k * 80, .35, 80]], golpecillo(50, 9)); for (let i = 0; i < 120; i++) o[i] *= i / 120}, .5)); yield;
    // rodar de las ruedas sobre el acero, con un vaivén que no se repite igual
    this.bRodar = bucle(ac, 16000, 7, (o, sr) => {let y = 0, z = 0, w = 0; const a = svf(150, .7, sr), b = svf(420, .7, sr), c = svf(950, .8, sr), d = svf(1650, .9, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, x = ruido(); w += .0008 * (ruido() - w); const m = 1 + 9 * w; y += .05 * (x - y); z += .006 * (y - z); o[i] = (y - z) * 1.1 + a(x)[1] * .16 * m + (b(x)[1] * .13 + c(x)[1] * .075 + d(x)[1] * .03) * m * (1 + .22 * Math.sin(TAU * t / P / 2))}}, .8); yield;
    this.bVapor = bucle(ac, 24000, 5, (o, sr) => {const b = svf(3400, .85, sr), g = svf(1300, .9, sr); let l = 0; for (let i = 0; i < o.length; i++) {const t = i / sr, x = ruido(); l += .0006 * (ruido() - l); o[i] = (b(x)[1] + .35 * g(x)[1]) * (.8 + 4 * Math.abs(l)) * (.85 + .15 * Math.sin(TAU * t * .8))}}, .6); yield;
    this.bValv = haz(ac, 24000, 2.6, (o, sr) => {const b = svf(3100, .7, sr), l = svf(700, .9, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, e = Math.min(1, t * 9) * (t < .9 ? 1 : Math.exp(-(t - .9) * 2.6)); const x = ruido(); o[i] = (b(x)[1] + .4 * l(x)[1]) * e}}, .6); yield;
    this.bCamp = haz(ac, 32000, 2.4, (o, sr) => {reson(o, sr, [[660, 1, 2.2], [1322, .55, 3.2], [1782, .42, 4.2], [2680, .25, 6.5], [3905, .12, 10]], golpecillo(40, 10))}, .6); yield;
    // motor diésel (ralentí grave y redondo) y zumbido eléctrico
    this.bMotor = bucle(ac, 16000, 4, (o, sr) => {const a = svf(120, .6, sr), b = svf(310, .8, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, f = 15.5, u = (t * f) % 1, e = Math.exp(-u * 5.5), x = ruido(); o[i] = e * (Math.sin(TAU * 62 * t) * .6 + Math.sin(TAU * 93 * t) * .34 + a(x)[0] * .5) + b(x)[1] * .1 * (.5 + e)}}, .7); yield;
    this.bElec = bucle(ac, 16000, 4, (o, sr) => {const a = svf(900, 1.2, sr); for (let i = 0; i < o.length; i++) {const t = i / sr, v = 1 + .06 * Math.sin(TAU * t * .5); o[i] = Math.sin(TAU * 100 * t) * .5 + Math.sin(TAU * 200 * t) * .34 + Math.sin(TAU * 300 * t) * .12 + Math.sin(TAU * 466 * t + 2 * Math.sin(TAU * t * .25)) * .1 * v + a(ruido())[1] * .03}}, .5); yield;
    const lz = (b, d) => {const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.loopEnd = b.fin; const g = ac.createGain(); g.gain.value = 0; s.connect(g); g.connect(d); s.start(); return g}; this.gRodar = lz(this.bRodar, this.vg); this.gVapor = lz(this.bVapor, this.lf); this.gMotor = lz(this.bMotor, this.lf); this.gElec = lz(this.bElec, this.lf); this.listo = true;
  }
  suelta(b, t, v, destino, {rate = 1, p = 0} = {}) {const ac = this.ac, s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = v; s.connect(g); let n = g; if (p && ac.createStereoPanner) {n = ac.createStereoPanner(); n.pan.value = p; g.connect(n)} n.connect(destino); s.start(Math.max(t, ac.currentTime)); s.onended = () => {g.disconnect(); if (n !== g) n.disconnect()}}
  /* silbato de tres tonos, afinado con la canción que suena */
  silbato(fuerte = 1, largo = 1, destino = this.lf) {
    if (!this.listo) return; if (this.clase !== 'vapor' && destino === this.lf) {this.bocina(fuerte); return} const ac = this.ac, t = ac.currentTime + .05; this.silb = t; const base = 60 + this.ton - (this.ton > 6 ? 12 : 0), N = this.menor ? [base, base + 3, base + 7] : [base, base + 4, base + 9], pat = largo > 1 ? [[0, 1.1], [1.35, .45], [2.05, 1.7]] : [[0, .5], [.72, 1.35]], d = ac.createGain(); d.gain.value = .5 * fuerte; d.connect(destino); if (destino !== this.lf) d.connect(this.rs);
    for (const [t0, L] of pat) for (const [i, n] of N.entries()) {const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = 440 * Math.pow(2, (n + 12 - 69) / 12), a = t + t0 + i * .012; o.type = 'triangle'; o2.type = 'sine'; for (const [q, m] of [[o, 1], [o2, 2.005]]) {q.frequency.setValueAtTime(f * m * .955, a); q.frequency.exponentialRampToValueAtTime(f * m, a + .11); q.frequency.setValueAtTime(f * m, a + L); q.frequency.exponentialRampToValueAtTime(f * m * .93, a + L + .22)} const g2 = ac.createGain(); g2.gain.value = .22; g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(.085, a + .09); g.gain.setValueAtTime(.085, a + L); g.gain.exponentialRampToValueAtTime(.0004, a + L + .3); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(d); for (const q of [o, o2]) {q.start(a); q.stop(a + L + .35)} if (!i) {const s = ac.createBufferSource(), sg = ac.createGain(); s.buffer = this.bVapor; s.loop = true; sg.gain.setValueAtTime(0, a); sg.gain.linearRampToValueAtTime(.09, a + .05); sg.gain.setValueAtTime(.06, a + L); sg.gain.linearRampToValueAtTime(0, a + L + .18); s.connect(sg); sg.connect(d); s.start(a, rn() * 3); s.stop(a + L + .25)}}
  }
  /* bocina de dos tonos (diésel) o timbre (eléctrico) */
  bocina(fuerte = 1) {const ac = this.ac, t = ac.currentTime + .05; this.silb = t; if (this.clase === 'electrico') {this.campana(3); return} const base = 48 + this.ton - (this.ton > 6 ? 12 : 0), f = ac.createBiquadFilter(), d = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 1100; d.gain.value = .5 * fuerte; f.connect(d); d.connect(this.lf); d.connect(this.rs); for (const [t0, L] of [[0, .7], [.95, 1.2]]) for (const n of this.menor ? [base + 12, base + 15, base + 19] : [base + 12, base + 16, base + 19]) {const o = ac.createOscillator(), g = ac.createGain(), a = t + t0; o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (n - 69) / 12); g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(.06, a + .05); g.gain.setValueAtTime(.055, a + L); g.gain.linearRampToValueAtTime(0, a + L + .12); o.connect(g); g.connect(f); o.start(a); o.stop(a + L + .2)} setTimeout(() => {f.disconnect(); d.disconnect()}, 4000)}
  campana(n = 5) {if (!this.listo) return; const t = this.ac.currentTime + .05; this.camp = t; const r = Math.pow(2, ((this.ton + 4) % 12 - 4 + 7) / 12 - .6); for (let i = 0; i < n; i++) this.suelta(this.bCamp, t + i * P * 2, .16 * (i % 2 ? .7 : 1), this.lf, {rate: clampa(r, .7, 1.5)})}
  /* un fotograma. o: {T, s, w, off, c: [x, y, z] cámara, d: [x, z] lado derecho de la cámara, nivel: 0–1} */
  paso(o) {
    if (!this.listo) return; const ac = this.ac, t = ac.currentTime, {T, s, off, c} = o, q = atM(T, s), dx = q.x - c[0], dy = q.y + 3 - c[1], dz = q.z - c[2], d = Math.hypot(dx, dy, dz), lado = d > 1 ? (dx * o.d[0] + dz * o.d[1]) / d : 0; this.o = o; this.tO = t; this.nivel = o.nivel;
    this.out.gain.setTargetAtTime(o.nivel, t, .35); this.gl = 1 / (1 + Math.pow(d / 24, 1.7)); const tn = kindAt(T, (s + T.L) % T.L) === KT; this.lg.gain.setTargetAtTime(this.gl * (tn ? .5 : 1), t, .15); if (this.lp.pan) this.lp.pan.setTargetAtTime(clampa(lado, -1, 1) * .7, t, .15); if (tn !== this.tunel) {this.tunel = tn; this.lf.frequency.setTargetAtTime(tn ? 620 : 5600, t, .25); this.rs.gain.setTargetAtTime(tn ? .7 : .12, t, .3)}
    // rodar: del vagón más cercano
    let dm = 1e9; for (let i = 0; i < off.length; i++) {const p = atM(T, (s + off[i] + T.L * 2) % T.L); dm = Math.min(dm, Math.hypot(p.x - c[0], p.y + 1 - c[1], p.z - c[2]))} this.gRodar.gain.setTargetAtTime(.1 / (1 + Math.pow(dm / 15, 1.8)), t, .25); this.clase = o.clase || 'vapor'; const va = this.clase === 'vapor'; this.gVapor.gain.setTargetAtTime(va ? .05 : 0, t, .3); this.gMotor.gain.setTargetAtTime(this.clase === 'diesel' ? .34 : 0, t, .3); this.gElec.gain.setTargetAtTime(this.clase === 'electrico' ? .1 : 0, t, .3);
    const a = atM(T, (s + 4) % T.L); this.sube = clampa((a.y - q.y) / 4, -.12, .12);
    // juntas de los carriles bajo cada bogie
    const hor = t + this.hor; for (let i = 0; i < off.length; i++) for (const b of [-2.45, 2.45]) {const u = o.w + off[i] + b, n = Math.ceil(u / J), dt = (n * J - u) / V, k = i * 2 + (b > 0 ? 1 : 0); if (t + dt > hor || this.ult.get(k) === n) continue; this.ult.set(k, n); const sp = (s + off[i] + b + V * dt + T.L * 2) % T.L, p = atM(T, sp), ex = p.x - c[0], ez = p.z - c[2], e = Math.hypot(ex, p.y - c[1], ez), g = 1 / (1 + Math.pow(e / 19, 2)); if (g < .07) continue; const pu = kindAt(T, sp) === KB, tu = kindAt(T, sp) === KT, v = g * (tu ? .6 : 1.0) * (pu ? 1.1 : 1), pn = clampa((ex * o.d[0] + ez * o.d[1]) / Math.max(1, e), -1, 1) * .8; for (const [h, w, B] of [[0, .78, pu ? this.hueco : this.riel], [1 / V, 1, pu ? this.hueco : this.riel2]]) this.suelta(B[Math.floor(rn() * B.length)], t + dt + h, v * w * (.85 + rn() * .3), this.vg, {rate: .95 + rn() * .1, p: pn})}
    // silbato antes de los túneles, campana al salir y de vez en cuando, válvula
    const dent = kindAt(T, (s + 20) % T.L) === KT, ya = kindAt(T, (s + 3) % T.L) === KT; if (dent && !ya && t - this.silb > 38 && o.nivel > .5) this.silbato(.8, rn() < .4 ? 2 : 1); if (!this.prox) this.prox = t + 16 + rn() * 20; if (t > this.prox && !tn) {this.prox = t + 38 + rn() * 45; if (o.nivel > .5) {if (t - this.silb > 30 && rn() < .55) this.silbato(.65, 1); else if (t - this.camp > 30) this.campana(4 + Math.floor(rn() * 3))}} if (t > this.valv) {if (this.valv && va) this.suelta(this.bValv, t, .13 + rn() * .07, this.lf, {rate: .9 + rn() * .2}); this.valv = t + 24 + rn() * 32}
  }
  /* resoplidos: media vuelta de rueda cada uno, a la vez que las corcheas de la música (sigue aunque la pestaña esté escondida) */
  tic(rejilla, hor) {
    if (!this.listo || this.nivel < .01) return; const ac = this.ac, t = ac.currentTime; this.hor = hor; if (this.clase !== 'vapor') {this.sig = 0; return} let n = rejilla(Math.max(this.sig, t + .02)); while (n < t + hor) {const k = this.k++ % 4, v = [1, .6, .8, .62][k] * (.92 + rn() * .16) * (1 + this.sube * 3.2); this.suelta(this.chuf[(k + (rn() < .3 ? 1 : 0)) % 4], n + (rn() - .5) * .006, 1.0 * v, this.lf, {rate: (.94 + rn() * .1) * (1 - this.sube * .8)}); if (this.gl > .22) this.suelta(this.biela[k % 3], n + P * .5 + (rn() - .5) * .01, .07 * (k % 2 ? 1 : .7), this.lf, {rate: .96 + rn() * .08}); this.sig = n + P * .5; n = rejilla(this.sig)}
  }
  /* sin fotogramas (pestaña escondida o en la calle lejos) baja solo */
  fuera() {this.nivel = 0; this.out.gain.setTargetAtTime(0, this.ac.currentTime, .4)}
}
