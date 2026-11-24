/* Música lofi de Navidad, sin ficheros de audio: los instrumentos se sintetizan una vez (muestras cada 6 semitonos) y el
   secuenciador va tocando la partitura de lofi-temas.js con el reloj de audio. Todo pasa por una «cinta» (vaivén, saturación y
   agudos suaves) y una sala pequeña; el bombo aparta un poco los acordes. */
import {LISTA, partitura, azar, P} from './lofi-temas.js';
export {P, LISTA, azar};

/* ---------- instrumentos ---------- */
const f0 = n => 440 * Math.pow(2, (n - 69) / 12), TAU = Math.PI * 2;
/* suma parciales que se apagan: [múltiplo, amplitud, caída por segundo] (resonadores de dos multiplicaciones por muestra) */
function parciales(o, f, sr, L) {for (const [m, a, k] of L) {const w = TAU * f * m / sr; if (w > 2.9) continue; const r = Math.exp(-k / sr), c = 2 * r * Math.cos(w), r2 = r * r; let y2 = 0, y1 = a * r * Math.sin(w); o[1] += y1; for (let i = 2; i < o.length; i++) {const y = c * y1 - r2 * y2; o[i] += y; y2 = y1; y1 = y}}}
const rn = azar(99), ruido = () => rn() * 2 - 1;
const ataque = (o, sr, s) => {const n = Math.max(1, Math.floor(s * sr)); for (let i = 0; i < n && i < o.length; i++) o[i] *= i / n};
const cola = (o, sr, s) => {const n = Math.floor(s * sr); for (let i = 0; i < n && i < o.length; i++) o[o.length - 1 - i] *= i / n};
const paso = (o, sr, fc) => {const a = 1 - Math.exp(-TAU * fc / sr); let y = 0; for (let i = 0; i < o.length; i++) {y += a * (o[i] - y); o[i] = y} return o};
const norma = (o, g) => {let m = 1e-6; for (let i = 0; i < o.length; i++) m = Math.max(m, Math.abs(o[i])); for (let i = 0; i < o.length; i++) o[i] *= g / m; return o};

export const INST = {
  /* piano eléctrico: dos parejas de FM, cuerpo y lengüeta */
  ep: {r: [42, 84], sr: 24000, s: 2.9, g: .5, hz(o, n, sr) {const f = f0(n), w = TAU * f / sr, br = Math.max(.25, 1 - (n - 48) / 60); for (let i = 0; i < o.length; i++) {const t = i / sr, e = Math.exp(-t * (1.1 + (n - 48) * .016)), m = Math.exp(-t * 3.4), q = Math.exp(-t * 11); o[i] = e * (Math.sin(w * i + (.28 + 1.05 * m) * br * Math.sin(w * i + .3)) + .2 * Math.sin(w * i + .55 * q * br * Math.sin(w * 14.02 * i)) + .12 * Math.sin(w * .5 * i) * m)}}},
  /* piano con fieltro */
  piano: {r: [36, 84], sr: 24000, s: 3, g: .5, hz(o, n, sr) {const f = f0(n), L = []; for (let k = 1; k < 13; k++) {const m = k * Math.sqrt(1 + .00035 * k * k), a = Math.pow(k, -1.45) * Math.exp(-k * k * f / 42000) * (1 + .35 * Math.sin(k * 1.9)); L.push([m * 1.0004, a * .6, .8 + .55 * k + f / 900], [m * .9995, a * .4, .35 + .3 * k + f / 1400])} parciales(o, f, sr, L); let y = 0; for (let i = 0; i < sr * .05; i++) {y += .12 * (ruido() - y); o[i] += y * .3 * Math.exp(-i / sr * 70)}}},
  /* guitarra de nailon (cuerda pulsada) */
  guitarra: {r: [40, 82], sr: 24000, s: 2.6, g: .5, hz(o, n, sr) {const f = f0(n), N = sr / f - .5, k = Math.floor(N), fr = N - k, b = new Float32Array(k + 1); let y = 0; for (let i = 0; i < k; i++) {y += .42 * (ruido() - y); b[i] = y} const pk = Math.max(1, Math.floor(k * .18)), c = b.slice(); for (let i = 0; i < k; i++) b[i] = c[i] - .7 * c[(i + pk) % k]; let j = 0, l1 = 0, ap = 0, xa = 0; const da = Math.exp(-(1.5 + (n - 48) * .05) * 0.69 / f), C = (1 - fr) / (1 + fr); for (let i = 0; i < o.length; i++) {const x = b[j]; o[i] = x; const lp = .5 * x + .5 * l1; l1 = x; const v = lp * da, a = C * v + xa - C * ap; xa = v; ap = a; b[j] = a; j = (j + 1) % k} paso(o, sr, 3600)}},
  vibra: {r: [58, 94], sr: 32000, s: 3.2, g: .42, hz(o, n, sr) {parciales(o, f0(n), sr, [[1, 1, 1.15], [3.98, .3, 5.5], [9.6, .06, 15], [1.002, .25, 1.4]]); for (let i = 0; i < o.length; i++) o[i] *= 1 - .22 * (.5 - .5 * Math.cos(TAU * 4.6 * i / sr)) * Math.min(1, i / sr * 4)}},
  /* caja de música */
  caja: {r: [64, 100], sr: 32000, s: 2.5, g: .36, hz(o, n, sr) {parciales(o, f0(n), sr, [[1, 1, 2.1], [2.003, .16, 4], [5.42, .22, 9], [8.9, .06, 18], [.999, .3, 1.7]]); for (let i = 0; i < sr * .006; i++) o[i] += ruido() * .12 * (1 - i / (sr * .006))}},
  celesta: {r: [64, 98], sr: 32000, s: 2.1, g: .38, hz(o, n, sr) {parciales(o, f0(n), sr, [[1, 1, 2.3], [2, .22, 4.2], [4.08, .12, 8], [6.1, .04, 14]])}},
  /* flauta de cinta (mellotron) */
  flauta: {r: [58, 86], sr: 24000, s: 3.8, g: .34, hz(o, n, sr) {const f = f0(n), w = TAU * f / sr; let y = 0, fs = 0; for (let i = 0; i < o.length; i++) {const t = i / sr, vb = 1 + .0042 * Math.sin(TAU * 4.9 * t) * Math.min(1, t * 1.6) + .0012 * Math.sin(TAU * .7 * t); fs += w * vb; y += .25 * (ruido() - y); o[i] = (Math.sin(fs) + .3 * Math.sin(2 * fs + .4) + .1 * Math.sin(3 * fs) + .03 * Math.sin(4 * fs)) * (1 + .05 * Math.sin(TAU * 4.9 * t)) + y * (.05 + .2 * Math.exp(-t * 16))} ataque(o, sr, .075); cola(o, sr, .3)}},
  /* cuerdas de cinta, para el fondo */
  cuerdas: {r: [46, 78], sr: 24000, s: 5, g: .3, hz(o, n, sr) {const f = f0(n); for (const [d, g, p] of [[.9962, 1, 0], [1, 1, 2], [1.0041, 1, 4]]) for (let k = 1; k < 9; k++) {const w = TAU * f * d * k / sr, a = g * Math.pow(k, -1.35) / (1 + Math.pow(f * k / 1500, 2)); if (w > 2.6) break; const c = 2 * Math.cos(w); let y1 = Math.sin(p * k), y2 = Math.sin(p * k - w); for (let i = 0; i < o.length; i++) {const y = c * y1 - y2; o[i] += a * y; y2 = y1; y1 = y}} for (let i = 0; i < o.length; i++) o[i] *= 1 + .08 * Math.sin(TAU * 5.1 * i / sr + n); ataque(o, sr, .55); cola(o, sr, .7)}},
  bajo: {r: [28, 48], sr: 16000, s: 2.4, g: .72, hz(o, n, sr) {const w = TAU * f0(n) / sr; for (let i = 0; i < o.length; i++) {const t = i / sr, e = Math.exp(-t * 1.15); o[i] = Math.tanh(1.25 * e * (Math.sin(w * i) + .42 * Math.exp(-t * 1.6) * Math.sin(2 * w * i) + .2 * Math.exp(-t * 3) * Math.sin(3 * w * i)))} ataque(o, sr, .007); cola(o, sr, .25)}},
};
/* percusión: una muestra de cada */
export const PERC = {
  bombo: {s: .5, g: .62, hz(o, sr) {let fs = 0; for (let i = 0; i < o.length; i++) {const t = i / sr; fs += TAU * (44 + 78 * Math.exp(-t * 26)) / sr; o[i] = Math.tanh(1.5 * Math.sin(fs) * Math.exp(-t * 8.5)) + ruido() * .05 * Math.exp(-t * 160)} paso(o, sr, 2600); ataque(o, sr, .002); cola(o, sr, .05)}},
  tarola: {s: .36, g: .62, hz(o, sr) {let y = 0, z = 0; for (let i = 0; i < o.length; i++) {const t = i / sr, x = ruido(); y += .5 * (x - y); z += .09 * (y - z); o[i] = (y - z) * Math.exp(-t * 15) * .9 + Math.sin(TAU * 186 * t) * Math.exp(-t * 26) * .55} paso(o, sr, 5200); ataque(o, sr, .0015)}},
  escoba: {s: .5, g: .55, hz(o, sr) {let y = 0, z = 0; for (let i = 0; i < o.length; i++) {const t = i / sr, x = ruido(); y += .42 * (x - y); z += .12 * (y - z); o[i] = (y - z) * (Math.exp(-t * 9) * (1 - Math.exp(-t * 90)) + .5 * Math.exp(-t * 60))} paso(o, sr, 5600)}},
  aro: {s: .14, g: .5, hz(o, sr) {for (let i = 0; i < o.length; i++) {const t = i / sr; o[i] = (Math.sin(TAU * 1640 * t) * .6 + Math.sin(TAU * 820 * t) * .5 + ruido() * .25 * Math.exp(-t * 260)) * Math.exp(-t * 62)} paso(o, sr, 4200)}},
  charles: {s: .12, g: .42, hz(o, sr) {let y = 0; for (let i = 0; i < o.length; i++) {const t = i / sr, x = ruido(); y += .62 * (x - y); o[i] = (x - y) * Math.exp(-t * 60)} paso(o, sr, 8200)}},
  charlesA: {s: .42, g: .4, hz(o, sr) {let y = 0; for (let i = 0; i < o.length; i++) {const t = i / sr, x = ruido(); y += .6 * (x - y); o[i] = (x - y) * Math.exp(-t * 11)} paso(o, sr, 8000)}},
  cascabel: {s: .4, g: .5, hz(o, sr) {const F = [3120, 3890, 4710, 5560, 6480, 7420, 8300]; for (let i = 0; i < o.length; i++) {const t = i / sr; let y = 0; for (let k = 0; k < F.length; k++) y += Math.sin(TAU * F[k] * t + k * 1.7) / (1 + k * .22); const tr = .5 + .5 * Math.sin(TAU * 33 * t); o[i] = (y * .16 + ruido() * .25) * Math.exp(-t * 13) * (.45 + .55 * tr)} paso(o, sr, 9000); ataque(o, sr, .004)}},
};
const buf = (ac, sr, s) => ac.createBuffer(1, Math.floor(sr * s), sr);
function muestra(ac, id, n) {const I = INST[id], b = buf(ac, I.sr, I.s), o = b.getChannelData(0); I.hz(o, n, I.sr); if (id !== 'cuerdas' && id !== 'flauta') cola(o, I.sr, .35); norma(o, I.g); return b}
function golpe(ac, id) {const p = PERC[id], sr = 32000, b = buf(ac, sr, p.s), o = b.getChannelData(0); p.hz(o, sr); norma(o, p.g); return b}

/* ---------- ruidos largos, en bucle: vinilo, fuego y viento ---------- */
export function vinilo(ac) {const sr = 24000, b = ac.createBuffer(2, sr * 9, sr); for (let c = 0; c < 2; c++) {const o = b.getChannelData(c); let y = 0; for (let i = 0; i < o.length; i++) {y += .3 * (ruido() - y); o[i] = y * .012} for (let k = 0; k < 120; k++) {const i0 = Math.floor(rn() * (o.length - 300)), a = Math.pow(rn(), 3) * .16 + .012, d = 20 + rn() * 70; for (let i = 0; i < 260; i++) o[i0 + i] += ruido() * a * Math.exp(-i / d * 3)}} return b}
export function fuego(ac) {const sr = 24000, b = ac.createBuffer(2, sr * 14, sr); for (let c = 0; c < 2; c++) {const o = b.getChannelData(c); let y = 0, z = 0; for (let i = 0; i < o.length; i++) {y += .02 * (ruido() - y); z += .004 * (y - z); o[i] = (y - z) * .6 * (1 + .4 * Math.sin(TAU * i / sr / 3.5) * Math.sin(TAU * i / sr * 2 / 14))} let t = 0; while (t < o.length - 3000) {t += Math.floor(-Math.log(1 - rn() * .999) * sr * .16); if (t >= o.length - 3000) break; const a = Math.pow(rn(), 2.6) * .55 + .03, d = sr * (.0015 + rn() * .006), w = TAU * (900 + rn() * 3200) / sr; for (let i = 0; i < 1600; i++) o[t + i] += a * Math.exp(-i / d) * (ruido() * .6 + Math.sin(w * i) * .5)} paso(o, sr, 6500); b.fin = cose(o, sr)} return b}
export function viento(ac) {const sr = 16000, b = ac.createBuffer(2, sr * 20, sr); for (let c = 0; c < 2; c++) {const o = b.getChannelData(c); let l = 0, bp = 0; for (let i = 0; i < o.length; i++) {const t = i / sr, fc = 260 + 170 * Math.sin(TAU * t / 10 + c) + 90 * Math.sin(TAU * t * 3 / 20 + c * 2), f = 2 * Math.sin(Math.PI * fc / sr), x = ruido(); l += f * bp; const h = x - l - .35 * bp; bp += f * h; o[i] = bp * .3 * (.62 + .38 * Math.sin(TAU * t / 20 * 3 + c * 1.3))} b.fin = cose(o, sr)} return b}
/* el principio lleva fundido el final: el bucle va de 0 a b.fin y no se nota */
function cose(o, sr) {const n = Math.floor(sr * .8), L = o.length - n; for (let i = 0; i < n; i++) {const u = i / n; o[i] = o[i] * Math.sqrt(u) + o[L + i] * Math.sqrt(1 - u)} return L / sr}
export function sala(ac, s = 2.2, k = 2.8) {const sr = ac.sampleRate, n = Math.floor(sr * s), b = ac.createBuffer(2, n, sr); for (let c = 0; c < 2; c++) {const o = b.getChannelData(c); let y = 0; for (let i = 0; i < n; i++) {const u = i / n, x = ruido() * Math.pow(1 - u, k) * (i < sr * .012 ? i / (sr * .012) : 1); y += (.75 - .6 * u) * (x - y); o[i] = y} for (const [d, g] of [[.011, .5], [.019, .38], [.027, .3], [.041, .22]]) o[Math.floor(sr * (d + c * .0017))] += g} return b}

/* ---------- el tocadiscos ---------- */
export class Lofi {
  /* ac: contexto; salida: nodo; opc.i: pista por la que empieza; opc.cambia(pista): cuando empieza otra */
  constructor(ac, salida, {i = 0, cambia = null, ligera = false, sala: sl = null} = {}) {
    this.ac = ac; this.i = i; this.cambia = cambia; this.on = false; this.hor = .4; this.M = new Map(); this.G = new Map(); this.vivas = new Set(); this.cola = [];
    const g = (v = 1) => {const x = ac.createGain(); x.gain.value = v; return x}; this.out = g(0); this.ac_ = g(.62); this.so = g(1.0); this.pad = g(.42); this.ba = g(.21); this.pe = g(.4);
    // lo que apaga el bombo
    this.duck = g(1); this.ac_.connect(this.duck); this.pad.connect(this.duck);
    // cinta: vaivén lento y temblor, saturación y agudos suaves
    const cinta = this.cinta = ac.createDelay(.06); cinta.delayTime.value = .014; for (const [f, a] of [[.37, .0011], [5.3, .00007]]) {const o = ac.createOscillator(), q = g(a); o.frequency.value = f; o.connect(q); q.connect(cinta.delayTime); o.start()}
    const sat = ac.createWaveShaper(), cv = new Float32Array(1025); for (let k = 0; k < 1025; k++) {const x = k / 512 - 1; cv[k] = Math.tanh(1.35 * x + .06) - Math.tanh(.06)} sat.curve = cv; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7600; lp.Q.value = .3; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; const cal = ac.createBiquadFilter(); cal.type = 'peaking'; cal.frequency.value = 220; cal.Q.value = .7; cal.gain.value = 1.6;
    this.mez = g(.62); this.duck.connect(this.mez); this.so.connect(this.mez); this.mez.connect(cinta); cinta.connect(sat); this.ba.connect(sat); this.pe.connect(sat); sat.connect(cal); cal.connect(hp); hp.connect(lp); lp.connect(this.out); this.out.connect(salida);
    // eco de corchea con puntillo en la melodía, y sala
    this.eco = ac.createDelay(1.5); this.eco.delayTime.value = P * 3; const re = g(.24), ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2400; const es = g(.2); this.so.connect(es); es.connect(this.eco); this.eco.connect(ef); ef.connect(re); re.connect(this.eco); ef.connect(this.mez);
    this.rev = ac.createConvolver(); this.rev.buffer = sl || sala(ac, ligera ? 1.5 : 2.2); const rs = g(.34), ra = g(.2), rp = g(.3), rr = g(.6); this.so.connect(rs); this.ac_.connect(ra); this.pad.connect(rp); rs.connect(this.rev); ra.connect(this.rev); rp.connect(this.rev); this.rev.connect(rr); rr.connect(lp);
    this.vn = g(0); this.vn.connect(this.out);
  }
  /* muestras: se hacen al vuelo, nota a nota, sin parar el dibujo */
  clave(id, n) {const [a, b] = INST[id].r, q = Math.max(a, Math.min(b, a + Math.round((n - a) / 6) * 6)); return q}
  pide(p) {const L = [], S = new Set(); for (const e of p.ev) {if (INST[e.k]) {const q = this.clave(e.k, e.n), c = e.k + q; if (!this.M.has(c) && !S.has(c)) {S.add(c); L.push([e.k, q, c, e.t])}} else if (!this.G.has(e.k) && !S.has(e.k)) {S.add(e.k); L.push([e.k, 0, e.k, e.t])}} return L.sort((a, b) => a[3] - b[3])}
  hazUna() {const q = this.cola.shift(); if (!q) return false; if (INST[q[0]]) {if (!this.M.has(q[2])) this.M.set(q[2], muestra(this.ac, q[0], q[1]))} else if (!this.G.has(q[2])) this.G.set(q[2], golpe(this.ac, q[0])); return true}
  prepara(i) {const p = partitura(LISTA[i]); this.cola.push(...this.pide(p)); return p}
  /* empieza a tocar desde la pista i */
  empieza(t0) {
    if (this.on) return; this.on = true; this.act = this.prepara(this.i); this.ini = t0 ?? this.ac.currentTime + .5; this.k = 0; this.sig = null; if (!this.vb) {this.vb = this.ac.createBufferSource(); this.vb.buffer = vinilo(this.ac); this.vb.loop = true; this.vb.connect(this.vn); this.vb.start()} this.vn.gain.setTargetAtTime(.5, this.ac.currentTime, 1.5); if (this.cambia) this.cambia(LISTA[this.i], this.act)
  }
  para() {if (!this.on) return; this.on = false; this.calla(.25); this.vn.gain.setTargetAtTime(0, this.ac.currentTime, .3)}
  calla(s = .3) {const t = this.ac.currentTime; for (const v of this.vivas) {try {v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, s / 3); v.s.stop(t + s + .05)} catch (e) {}} this.vivas.clear()}
  salta(d) {const n = LISTA.length; this.i = (this.i + d + n) % n; if (!this.on) {if (this.cambia) this.cambia(LISTA[this.i], null); return} this.calla(.5); this.cola.length = 0; this.act = this.prepara(this.i); this.sig = null; this.k = 0; this.ini = this.ac.currentTime + .75; if (this.cambia) this.cambia(LISTA[this.i], this.act)}
  /* el compás va con el tren: hora del próximo golpe de corchea a partir de t */
  rejilla(t) {const o = (this.org ??= this.ac.currentTime); return o + Math.ceil((t - o) / P - 1e-6) * P}
  nota(e, t) {
    const ac = this.ac; let b, rate = 1; if (INST[e.k]) {const q = this.clave(e.k, e.n); b = this.M.get(e.k + q); rate = Math.pow(2, (e.n - q) / 12)} else b = this.G.get(e.k); if (!b) return;
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.playbackRate.value = rate; const v = e.v * (INST[e.k] ? 1 : 1), per = !INST[e.k];
    if (per) {g.gain.value = v; s.connect(g); g.connect(this.pe); s.start(t); if (e.k === 'bombo') {const d = this.duck.gain; d.setTargetAtTime(.72, t, .012); d.setTargetAtTime(1, t + .09, .13)}}
    else {const d = Math.min(e.d, b.duration / rate - .02), fin = e.k === 'cuerdas' ? .6 : e.k === 'flauta' ? .12 : .22; g.gain.setValueAtTime(e.k === 'cuerdas' ? 0 : v, t); if (e.k === 'cuerdas') g.gain.linearRampToValueAtTime(v, t + .3); g.gain.setValueAtTime(v, Math.max(t + .31, t + d)); g.gain.setTargetAtTime(0, Math.max(t + .32, t + d), fin / 3); s.connect(g); g.connect(e.k === 'bajo' ? this.ba : e.bus === 'pad' ? this.pad : e.bus === 'so' ? this.so : this.ac_); s.start(t); s.stop(t + Math.max(.4, d) + fin * 2)}
    const q = {s, g}; this.vivas.add(q); s.onended = () => {this.vivas.delete(q); g.disconnect()};
  }
  /* se llama a menudo: hace muestras y programa lo que suena en el próximo rato */
  tic() {
    if (!this.on) return; const ac = this.ac, t = ac.currentTime; const t0 = performance.now(); while (this.cola.length && performance.now() - t0 < 6) this.hazUna();
    const list = () => {const n = this.act.ev[this.k]; return n ? this.ini + n.t : Infinity};
    // la primera vez espera a tener las muestras del principio
    if (this.k === 0) {if (this.cola.length && this.cola[0][3] < 6) {if (this.ini < t + .4) this.ini = t + .5; return} if (!this.ali) {this.ini = this.rejilla(Math.max(this.ini, t + .25)); this.ali = true} if (this.ini < t) this.ini = this.rejilla(t + .2)}
    const hor = t + this.hor; while (list() < hor) {const e = this.act.ev[this.k++], h = this.ini + e.t; if (h > t - .05) this.nota(e, Math.max(h, t))}
    if (!this.sig && this.ini + this.act.dur - t < 25) {this.sig = this.prepara((this.i + 1) % LISTA.length)}
    if (this.k >= this.act.ev.length && t > this.ini + this.act.dur - .3) {this.i = (this.i + 1) % LISTA.length; this.ini = this.rejilla(Math.max(t + .2, this.ini + this.act.dur)); this.act = this.sig || this.prepara(this.i); this.sig = null; this.k = 0; this.ali = true; if (this.cambia) this.cambia(LISTA[this.i], this.act)}
  }
  get pista() {return LISTA[this.i]}
  /* lo que lleva y lo que dura, en segundos */
  get hora() {return this.on ? Math.max(0, this.ac.currentTime - this.ini) : 0}
}
