/* Mi maqueta de Navidad (idle) · economía y trazado, sin DOM ni WebGL.
   La usan el juego (src/idle.js) y las pruebas (tests/idle.test.mjs).
   El tren da vueltas solo: carga regalos en el taller (s=0) y los reparte a las casas que
   va pasando, en orden. Cada regalo entregado da monedas de chocolate. */
import {buildTrack, atT} from './sim.js';

export const SAVE_KEY = 'advx-idle', SAVE_V = 1;
export const TREE_R = 17; // radio del faldón del árbol del centro

/* etapas de la vía: radio, ondulación, lóbulos y separación entre casas (por dentro solo si cabe) */
export const STAGES = [
  {R: 34, amp: .05, lobes: 2, gap: 24, inner: false},
  {R: 46, amp: .09, lobes: 3, gap: 21, inner: false},
  {R: 60, amp: .11, lobes: 2, gap: 19, inner: true},
  {R: 76, amp: .13, lobes: 3, gap: 17, inner: true},
  {R: 94, amp: .14, lobes: 4, gap: 16, inner: true},
  {R: 114, amp: .15, lobes: 3, gap: 15, inner: true},
];

export const ECO = {
  v0: 8, dv: 2, locoMax: 10,          // velocidad del tren (m/s) y niveles de locomotora
  cap: 5, wagonMax: 10,               // regalos por vagón y vagones como mucho
  val0: 10, lightK: 1.5, stageK: 3,   // valor de un regalo: base × luces × etapa de la vía
  offlineK: .6, offlineMax: 8 * 3600, // sin conexión: el 60 % de lo que harías, hasta 8 h
  boostK: 1.8, boostT: 5, boostCD: 25 // silbato: más velocidad durante unos segundos
};

/* ================= trazado ================= */
export function stagePts(k) {
  const S = STAGES[k], n = 12 + 4 * k, ph = k * 1.3;
  return Array.from({length: n}, (_, i) => {const th = i / n * Math.PI * 2, r = S.R * (1 + S.amp * Math.sin(S.lobes * th + ph)); return [Math.cos(th) * r * 1.08, Math.sin(th) * r]});
}
const tCache = {}, sCache = {};
export const trackOf = k => tCache[k] || (tCache[k] = buildTrack(stagePts(k)));
/* huecos para casas a lo largo de la vía: a 9,4 m del eje, por fuera (y por dentro en las etapas grandes) */
export const HOUSE_OFF = 9.4;
export function slotsOf(k) {
  if (sCache[k]) return sCache[k];
  const T = trackOf(k), S = STAGES[k], out = [];
  const clear = (x, z) => {let m = 1e9; for (let i = 0; i < T.N; i += 3) m = Math.min(m, Math.hypot(T.x[i] - x, T.z[i] - z)); return m > HOUSE_OFF - 0.6};
  let side = 1;
  for (let s = 30; s <= T.L - 24; s += S.gap) {
    const p = atT(T, s); let nx = -Math.sin(p.a), nz = Math.cos(p.a);
    if (nx * p.x + nz * p.z < 0) {nx = -nx; nz = -nz} // hacia fuera
    const tries = S.inner ? [side, -side] : [1]; side = -side;
    for (const sd of tries) {
      const x = p.x + nx * HOUSE_OFF * sd, z = p.z + nz * HOUSE_OFF * sd;
      if (sd < 0 && Math.hypot(x, z) < TREE_R + 10) continue;
      if (!clear(x, z) || out.some(o => Math.hypot(o.x - x, o.z - z) < 12)) continue;
      out.push({s, x, z, a: p.a, nx: nx * sd, nz: nz * sd, side: sd}); break;
    }
  }
  return sCache[k] = out;
}

/* ================= economía ================= */
export const START_COINS = 25; // para la primera casa nada más empezar
export const newState = (now = Date.now()) => ({v: SAVE_V, coins: START_COINS, total: 0, gifts: 0, houses: 1, wagons: 1, loco: 0, lights: 0, stage: 0, t: now, born: now});
export const speedOf = st => ECO.v0 + ECO.dv * st.loco;
export const capOf = st => ECO.cap * st.wagons;
export const valueOf = st => ECO.val0 * ECO.lightK ** st.lights * ECO.stageK ** st.stage;
export const lapOf = st => trackOf(st.stage).L / speedOf(st);
export const servedOf = st => Math.min(st.houses, capOf(st));
export const rateOf = st => servedOf(st) * valueOf(st) / lapOf(st);
/* precios redondos: dos cifras significativas */
export const nice = x => {if (x < 100) return Math.round(x); const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p};

export const ITEMS = {
  casa: {lvl: st => st.houses, max: st => slotsOf(st.stage).length, cost: st => nice(12 * 1.3 ** (st.houses - 1))},
  vagon: {lvl: st => st.wagons, max: () => ECO.wagonMax, cost: st => nice(60 * 2.6 ** (st.wagons - 1))},
  loco: {lvl: st => st.loco, max: () => ECO.locoMax, cost: st => nice(40 * 2.2 ** st.loco)},
  luces: {lvl: st => st.lights, max: () => Infinity, cost: st => nice(250 * 4.5 ** st.lights)},
  via: {lvl: st => st.stage, max: () => STAGES.length - 1, cost: st => [400, 5000, 50000, 500000, 5e6][st.stage] ?? Infinity},
};
export const maxed = (st, k) => ITEMS[k].lvl(st) >= ITEMS[k].max(st);
export const canBuy = (st, k) => !maxed(st, k) && st.coins >= ITEMS[k].cost(st);
export function buy(st, k) {
  if (!canBuy(st, k)) return false;
  st.coins -= ITEMS[k].cost(st);
  if (k === 'casa') st.houses++; else if (k === 'vagon') st.wagons++; else if (k === 'loco') st.loco++; else if (k === 'luces') st.lights++; else st.stage++;
  return true;
}
/* lo ganado mientras no estabas */
export function offlineGain(st, now = Date.now()) {
  const sec = Math.min(ECO.offlineMax, Math.max(0, (now - st.t) / 1000));
  const coins = Math.floor(rateOf(st) * sec * ECO.offlineK), gifts = Math.floor(servedOf(st) * sec * ECO.offlineK / lapOf(st));
  return {sec, coins, gifts};
}
/* guardado: valida lo que viene de localStorage (puede estar roto o ser de otra versión) */
export function parseSave(raw) {
  try {
    const o = JSON.parse(raw); if (!o || o.v !== SAVE_V) return null;
    const st = newState(+o.t || Date.now()), int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+v || 0)));
    st.coins = Math.max(0, +o.coins || 0); st.total = Math.max(0, +o.total || 0); st.gifts = int(o.gifts, 0, 1e15);
    st.stage = int(o.stage, 0, STAGES.length - 1); st.wagons = int(o.wagons, 1, ECO.wagonMax); st.loco = int(o.loco, 0, ECO.locoMax);
    st.lights = int(o.lights, 0, 99); st.houses = int(o.houses, 1, slotsOf(st.stage).length); st.born = +o.born || st.t;
    return st;
  } catch (e) {return null}
}
