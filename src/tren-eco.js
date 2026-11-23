// Tren compartido (prototipo, nombre provisional): economía y comunidad simulada, sin DOM.
// Un solo tren para todo el mundo. Las paladas de carbón de todos llenan un bote común que compra
// la siguiente mejora (vagón, máquina, luces). Cumplir el objetivo de regalos del día abre un tramo
// nuevo de vía (un día de Adviento). Los jugadores ponen su casa junto a la vía y el tren les reparte.
// En el prototipo los demás jugadores están simulados (online, crowdRate, nombres).
import {STAGES, ECO, slotsOf, trackOf, nice} from './idle-eco.js';

export const TKEY = 'advx-tren', TV = 1, DAYS = 24;
export const MAXLIGHTS = 3;
export const DAY_SEC = 170;                 // en la demo, un día de Adviento dura unos 3 minutos de reparto
export const UP_ORDER = ['vagon', 'loco', 'vagon', 'luces'];
export const BID_MIN = 5, BID_STEP = 1, MSG_PRICE = 3, CLOSE_H = 21;

export const speedOf = (w, heat = 0) => (ECO.v0 + ECO.dv * w.loco) * (1 + 0.6 * Math.min(1, Math.max(0, heat)));
export const capOf = w => w.wagons * ECO.cap;
export const sacoOf = w => Math.round(10 * ECO.lightK ** w.lights * ECO.stageK ** w.stage);  // regalos por casa y vuelta
export const lapOf = w => trackOf(w.stage).L / speedOf(w);
export const rateOf = w => Math.min(w.houses, capOf(w)) * sacoOf(w) / lapOf(w);
export const goalFor = w => nice(Math.max(rateOf({...w, houses: Math.max(w.houses, 4)}), 1) * DAY_SEC);

export function newWorld(now = Date.now()) {
  const w = {v: TV, day: 1, stage: 0, wagons: 3, loco: 1, lights: 0, houses: 5, mine: -1, myName: '', myProv: '',
    pot: 0, n: 0, today: 0, total: 18430, goal: 0, myCoal: 0, myGifts: 0, t: now};
  w.goal = goalFor(w);
  return w;
}

/* mejoras que compra el bote común, por turnos; las que están al máximo se saltan */
const upMaxed = (w, k) => k === 'vagon' ? w.wagons >= ECO.wagonMax : k === 'loco' ? w.loco >= ECO.locoMax : w.lights >= MAXLIGHTS;
export function nextUp(w) {
  for (let i = 0; i < UP_ORDER.length; i++) {const k = UP_ORDER[(w.n + i) % UP_ORDER.length]; if (!upMaxed(w, k)) return k}
  return null;
}
export const upCost = w => nice(400 * 1.3 ** w.n);
function applyUp(w, k) {if (k === 'vagon') w.wagons++; else if (k === 'loco') w.loco++; else w.lights++; w.n++}
/* añade paladas al bote y devuelve las mejoras que se han comprado */
export function addPot(w, x) {
  w.pot += x; const done = [];
  for (let k = nextUp(w); k && w.pot >= upCost(w); k = nextUp(w)) {w.pot -= upCost(w); applyUp(w, k); done.push(k)}
  if (!nextUp(w)) w.pot = Math.min(w.pot, 1e9);
  return done;
}
/* regalos repartidos: devuelve true si se ha cumplido el objetivo del día */
export function addGifts(w, x) {w.today += x; w.total += x; return w.day <= DAYS && w.today >= w.goal}
/* pasa al día siguiente; devuelve true si la vía crece */
export function nextDay(w) {
  const grow = w.stage < STAGES.length - 1;
  if (grow) w.stage++;
  w.day = Math.min(DAYS, w.day + 1); w.today = 0; w.goal = goalFor(w);
  return grow;
}

/* comunidad simulada */
export const online = t => Math.max(12, Math.round(110 + 55 * Math.sin(t / 240) + 18 * Math.sin(t / 37 + 1)));
export const crowdRate = t => online(t) * 0.3;   // paladas por segundo del resto de jugadores
export const NAMES = ['Ane', 'Iker', 'Lucía', 'Mateo', 'Martina', 'Hugo', 'Leire', 'Unai', 'Sara', 'Pablo', 'Noa', 'Aitor', 'Carmen', 'Javi', 'Irene', 'Marcos', 'Nerea', 'Álvaro', 'Paula', 'Amaia'];
export const PROVS = ['Bizkaia', 'Gipuzkoa', 'Álava', 'Navarra', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Asturias', 'Cantabria', 'Málaga', 'Zaragoza', 'A Coruña', 'Murcia', 'Granada'];
export const BIZ = ['Bar Txoko', 'Floristería Lirio', 'Taller Mendi', 'Academia Lur', 'Librería Itsaso', 'Panadería Ogi'];

/* subasta del vagón del día: cierra a las 21:00 y el ganador sale de 00:00 a 24:00 del día siguiente */
export function closeAt(now = Date.now()) {
  const d = new Date(now); d.setHours(CLOSE_H, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}
export const showDay = (now = Date.now()) => {const d = new Date(closeAt(now)); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d.getTime()};
export const minBid = top => Math.max(BID_MIN, Math.floor(top || 0) + BID_STEP);

/* texto de usuario: sin saltos ni espacios de más, y con longitud máxima */
export const cleanText = (s, max) => String(s || '').replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/* guardado: se valida y se acota todo; null si está roto o es de otra versión */
export function parseWorld(raw) {
  let o; try {o = JSON.parse(raw)} catch (e) {return null}
  if (!o || typeof o !== 'object' || o.v !== TV) return null;
  const num = (x, a, b, d) => Number.isFinite(+x) ? Math.min(b, Math.max(a, Math.floor(+x))) : d;
  const w = newWorld(num(o.t, 0, 9e15, Date.now()));
  w.stage = num(o.stage, 0, STAGES.length - 1, 0);
  w.day = num(o.day, 1, DAYS, 1);
  w.wagons = num(o.wagons, 1, ECO.wagonMax, 3);
  w.loco = num(o.loco, 0, ECO.locoMax, 1);
  w.lights = num(o.lights, 0, MAXLIGHTS, 0);
  const slots = slotsOf(w.stage).length;
  w.houses = num(o.houses, 0, slots, 5);
  w.mine = num(o.mine, -1, w.houses - 1, -1);
  for (const k of ['pot', 'n', 'today', 'total', 'myCoal', 'myGifts']) w[k] = num(o[k], 0, 1e15, 0);
  w.myName = cleanText(o.myName, 14); w.myProv = cleanText(o.myProv, 20);
  if (w.mine >= 0 && !w.myName) w.mine = -1;
  w.goal = num(o.goal, 1, 1e15, 0) || goalFor(w);
  return w;
}
