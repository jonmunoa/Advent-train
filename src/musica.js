/* Sonido: la música lofi (lofi.js), el tren (sonido-tren.js), el fuego y el viento, y los efectos sueltos de la calle y las escenas.
   De lejos todo se oye apagado, como al otro lado del cristal; al acercarse al escaparate se aclara (setCerca). */
import {Lofi, LISTA, fuego, viento as vientoB, sala} from './lofi.js';
import {SonidoTren} from './sonido-tren.js';
import {LOWQ} from './kit.js';

const store = {get(k) {try {return localStorage.getItem(k)} catch (e) {return null}}, set(k, v) {try {localStorage.setItem(k, v)} catch (e) {}}};
let ac = null, acP = null, sfx = store.get('advx-sonido') !== '0', cerca = 0, callado = false, N = null, alCambiar = null;
/* volúmenes, de 0 a 1 */
const VOL = {musica: .8, tren: .75, amb: .3}; try {const v = JSON.parse(store.get('advx-vol') || '{}'); for (const k in VOL) if (v[k] >= 0 && v[k] <= 1) VOL[k] = v[k]} catch (e) {}
const nuevo = () => {try {return new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'playback'})} catch (e) {return null}};
/* el contexto tarda ~80 ms en crearse: se hace antes de tocar nada, parado */
export function prepAu() {setTimeout(() => {if (!ac && !acP) acP = nuevo()}, 60)}
function au() {if (!ac) ac = acP || nuevo(); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return ac}

/* ---------- mezcla ---------- */
const inicio = () => {const g = parseInt(store.get('advx-lofi'), 10); if (g >= 0 && g < LISTA.length) return (g + 1) % LISTA.length; const d = new Date(); return (d.getDate() * 7 + d.getMonth() * 3) % LISTA.length};
let prim = null; const primera = () => (prim ??= inicio());
function monta() {
  if (N || !ac) return N; const g = v => {const x = ac.createGain(); x.gain.value = v; return x}, lp = f => {const x = ac.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = f; x.Q.value = .3; return x};
  const master = g(.8), comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = .012; comp.release.value = .28; const lim = ac.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .12; master.connect(comp); comp.connect(lim); lim.connect(ac.destination);
  const fx = g(.9); fx.connect(master); const mus = g(0), musF = lp(1600); mus.connect(musF); musF.connect(master); const tren = g(0), trF = lp(900); tren.connect(trF); trF.connect(master); const amb = g(0), ambF = lp(6000); amb.connect(ambF); ambF.connect(master);
  const ir = sala(ac, LOWQ ? 1.3 : 2.1), rev = ac.createConvolver(); rev.buffer = ir; rev.connect(tren);
  N = {master, comp: lim, fx, mus, musF, tren, trF, amb, ambF, rev, apaga: 0}; N.lofi = new Lofi(ac, mus, {i: primera(), ligera: LOWQ, sala: ir, cambia: (p, a) => {store.set('advx-lofi', String(p.i)); if (a) {N.ton = a.ton; N.menor = a.menor; if (N.st) {N.st.ton = a.ton; N.st.menor = a.menor}} if (alCambiar) alCambiar(p)}}); N.lofi.out.gain.value = 1;
  N.st = new SonidoTren(ac, tren, rev); N.it = N.st.hace(); return N;
}
/* bucles de ambiente: se hacen la primera vez que hacen falta, a trozos */
function ambiente() {if (N.fl === 0 || VOL.amb <= 0 || N.it) return; N.fl ??= [[fuego(ac), .8], [vientoB(ac), .5]]; const [g, v] = N.fl[0], q = g.next(); if (!q.done) return; const s = ac.createBufferSource(), k = ac.createGain(); s.buffer = q.value; s.loop = true; s.loopEnd = q.value.fin; k.gain.value = v; s.connect(k); k.connect(N.amb); s.start(); N.fl.shift(); if (!N.fl.length) N.fl = 0}
/* en la portada, con el contexto aún parado, se van haciendo las primeras muestras para que al empezar no haya nada que calcular */
let prev = false; export const calientaSonido = () => {prev = true};
function previa() {if (!sfx || document.hidden || !acP) return; if (!ac) {ac = acP; return} if (!N) {monta(); return} if (!N.lofi.adelanta()) return; if (N.it && N.it.next().done) N.it = null}
function tic() {
  if (prev && (!ac || ac.state === 'suspended') && !(N && N.lofi.on)) {previa(); return}
  if (!ac || ac.state !== 'running') return; if (!N) {if (!sfx) return; monta()}
  const t = ac.currentTime, H = document.hidden ? 2.2 : .35, pon = (p, v, k) => p.setTargetAtTime(v, t, k);
  pon(N.mus.gain, sfx && !callado ? VOL.musica * .64 * (.5 + .5 * cerca) : 0, .6); pon(N.musF.frequency, 1300 + 17500 * Math.pow(cerca, 1.4), .5); pon(N.tren.gain, sfx && !callado ? VOL.tren * 2.3 : 0, .3); pon(N.trF.frequency, 650 + 13000 * Math.pow(cerca, 2.2), .4); pon(N.amb.gain, sfx ? VOL.amb * (callado ? .6 : 1) : 0, .8);
  if (!sfx) {if (N.lofi.on && t > N.apaga) N.lofi.para(); return} N.apaga = t + 1.2;
  if (!N.lofi.on && VOL.musica > 0) N.lofi.empieza(); if (N.it && N.lofi.cola.length < 6 && N.it.next().done) N.it = null; ambiente();
  N.lofi.hor = H; N.lofi.tic(); N.st.tic(x => N.lofi.rejilla(x), H);
}
setInterval(tic, 90); document.addEventListener('visibilitychange', () => {if (document.hidden) tic(); else if (ac && ac.state === 'suspended' && sfx && N) ac.resume().catch(() => {})});

export const volumen = (k, v) => {if (v !== undefined) {VOL[k] = Math.min(1, Math.max(0, v)); store.set('advx-vol', JSON.stringify(VOL)); if (v > 0 && !sfx) setSonido(true); if (k === 'musica' && N && VOL.musica === 0) N.lofi.para(); tic()} return VOL[k]};
export const pista = () => N ? N.lofi.pista : LISTA[primera()];
export const otraPista = d => {if (!au() || !monta()) return; if (!sfx) setSonido(true); if (VOL.musica === 0) volumen('musica', .6); N.lofi.salta(d)};
export const onPista = f => {alCambiar = f};
/* el tren: un fotograma, o ya no se oye */
export const oyeTren = o => {if (N && sfx) N.st.paso(o)};
export const callaTren = () => {if (N && N.st.nivel) N.st.fuera()};
export const motor = () => N;

/* ---------- efectos sueltos ---------- */
const sale = () => {monta(); return N ? N.fx : ac.destination};
function tone(f, d, type, g, when) {if (!sfx || !ac) return; const t = ac.currentTime + (when || 0), o = ac.createOscillator(), v = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f; v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(v); v.connect(sale()); o.start(t); o.stop(t + d + 0.05)}
let nbuf = null; function nb() {if (!nbuf) {const n = ac.sampleRate; nbuf = ac.createBuffer(1, n, n); const a = nbuf.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1} return nbuf}
function noise(d, g, fc, type) {if (!sfx || !ac) return; nb(); const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain(); s.buffer = nbuf; f.type = type || 'lowpass'; f.frequency.value = fc; v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(v); v.connect(sale()); s.start(t, Math.random() * 0.5, d + 0.05)}
const PENTA = [1047, 1175, 1319, 1568, 1760, 2093]; let lastChime = 0;
const chime = () => {const n = performance.now(); if (n - lastChime < 70) return; lastChime = n; tone(PENTA[Math.floor(Math.random() * PENTA.length)], 0.5, 'sine', 0.035); tone(PENTA[Math.floor(Math.random() * PENTA.length)] * 2, 0.25, 'sine', 0.012, 0.02)};
const bells = () => [1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.8, 'sine', 0.06, i * 0.08));
const whistle = () => {if (N && N.st.listo && sfx) N.st.silbato(1.25, 1, N.fx); else {tone(740, 1.1, 'triangle', 0.07); tone(932, 1.1, 'triangle', 0.05); tone(1109, 1.1, 'triangle', 0.03)}};
export const pasos = k => {if (!sfx || !ac) return; noise(.09, .028 * k, 1900, 'bandpass'); noise(.05, .018 * k, 5200, 'highpass')};
export const setCerca = v => {cerca = v};
/* efectos de las escenas */
export const silencio = v => {callado = v};
export const campana = (n = 1) => {for (let i = 0; i < n; i++) [392, 588, 784, 1046].forEach((f, k) => tone(f, 1.8, 'sine', .06 / (k + 1), i * .75))};
export const suave = () => {[784, 988, 1175].forEach((f, i) => tone(f, .9, 'sine', .035, i * .11))};
export const viento = () => {if (!sfx || !ac) return; noise(3.4, .05, 520); noise(3.8, .03, 900, 'bandpass')};
export const clac = () => {noise(.06, .16, 3200, 'bandpass'); noise(.05, .1, 900)};
export const chuf = () => {noise(.2, .05, 900)};
export const trenSuena = () => {for (let i = 0; i < 6; i++) setTimeout(() => noise(.18, .06, 700), i * 260)};
export const sonidoOn = () => sfx;
export function setSonido(on) {sfx = on; store.set('advx-sonido', on ? '1' : '0'); if (on) au(); tic()}
export {au, tone, noise, chime, bells, whistle};
