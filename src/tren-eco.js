// El tren de Navidad (prototipo, nombre provisional): economía y comunidad simulada, sin DOM.
// Un solo tren para todo el mundo. Cada día se esconden 5 duendes por la maqueta y los que encuentra cada
// jugador suman al objetivo común del día. Al cumplirlo pasa el día y el tren recibe una mejora: un tramo
// nuevo de vía (etapa de tren-map.js), otro vagón o más luces. Los jugadores ponen su casa junto a la vía y
// el tren les reparte regalos. En el prototipo los demás jugadores están simulados (online, crowdElves, nombres).
import {MAXSTAGE, slotsOf} from './tren-map.js';

export const TKEY = 'advx-tren', TV = 2, DAYS = 24;
export const MAXLIGHTS = 3, WAGON_MAX = 10, CAP = 5, ELVES = 5;
export const DAY_SEC = 200;                 // en la demo, un día de Adviento dura unos 3 minutos
export const BID_MIN = 5, BID_STEP = 1, MSG_PRICE = 3, CLOSE_H = 21;
const nice = x => {if (x < 100) return Math.round(x); const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p};

export const sacoOf = w => Math.round(10 * 1.5 ** w.lights * 2 ** w.stage);   // regalos por casa y vuelta

/* comunidad simulada */
export const online = t => Math.max(12, Math.round(110 + 55 * Math.sin(t / 240) + 18 * Math.sin(t / 37 + 1)));
const dayK = d => 1 + 0.1 * (d - 1);
export const crowdElves = (t, day) => online(t) * 0.055 * dayK(day);      // duendes por segundo que encuentra el resto
export const goalFor = w => nice(110 * 0.055 * dayK(w.day) * DAY_SEC);
export const NAMES = ['Ane', 'Iker', 'Lucía', 'Mateo', 'Martina', 'Hugo', 'Leire', 'Unai', 'Sara', 'Pablo', 'Noa', 'Aitor', 'Carmen', 'Javi', 'Irene', 'Marcos', 'Nerea', 'Álvaro', 'Paula', 'Amaia'];
export const PROVS = ['Bizkaia', 'Gipuzkoa', 'Álava', 'Navarra', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Asturias', 'Cantabria', 'Málaga', 'Zaragoza', 'A Coruña', 'Murcia', 'Granada'];
export const BIZ = ['Bar Txoko', 'Floristería Lirio', 'Taller Mendi', 'Academia Lur', 'Librería Itsaso', 'Panadería Ogi'];

export function newWorld(now = Date.now()) {
  const w = {v: TV, day: 1, stage: 0, wagons: 3, lights: 0, houses: 3, mine: -1, myName: '', myProv: '',
    today: 0, goal: 0, total: 18430, myGifts: 0, myElves: 0, eDay: 1, eMask: 0, t: now};
  w.goal = goalFor(w);
  return w;
}
/* duendes encontrados (por ti o por el resto): devuelve true si se cumple el objetivo del día */
export function addElves(w, x) {w.today += x; return w.day <= DAYS && w.today >= w.goal}
export const foundCount = w => {if (w.eDay !== w.day) return 0; let n = 0; for (let i = 0; i < ELVES; i++) if (w.eMask >> i & 1) n++; return n};
/* marca el duende i de hoy como encontrado; false si ya lo estaba */
export function elfFound(w, i) {
  if (w.eDay !== w.day) {w.eDay = w.day; w.eMask = 0}
  if (!(i >= 0 && i < ELVES) || w.eMask >> i & 1) return false;
  w.eMask |= 1 << i; w.myElves++; return true;
}
/* recompensa del día cumplido: los días impares crece la vía (hasta la última etapa); los demás, otro vagón o más luces */
export function rewardOf(w) {
  if (w.stage < MAXSTAGE && w.day % 2 === 1) return 'via';
  if (w.lights < MAXLIGHTS && w.day % 4 === 0) return 'luces';
  if (w.wagons < WAGON_MAX) return 'vagon';
  if (w.lights < MAXLIGHTS) return 'luces';
  return w.stage < MAXSTAGE ? 'via' : null;
}
/* pasa al día siguiente: aplica la recompensa y esconde 5 duendes nuevos; devuelve la recompensa */
export function nextDay(w) {
  const r = w.day < DAYS ? rewardOf(w) : null;
  if (r === 'via') w.stage++; else if (r === 'vagon') w.wagons++; else if (r === 'luces') w.lights++;
  w.day = Math.min(DAYS, w.day + 1); w.today = 0; w.goal = goalFor(w); w.eDay = w.day; w.eMask = 0;
  return r;
}

/* escondites de los duendes: cinco al día, los mismos para todo el mundo (en los días impares, uno va en el tren) */
export const ELF_SPOTS = ['vagon', 'tunel', 'tejado', 'plaza', 'taller', 'lago', 'esqui', 'telesilla', 'cumbre', 'bosque', 'puente'];
export const ELF_HINT = {vagon: 'va subido en un vagón del tren', tunel: 'se asoma junto a la boca de un túnel', tejado: 'está en el tejado de una casa',
  plaza: 'está entre los regalos de la plaza', taller: 'ayuda en el taller de Papá Noel', lago: 'patina en el lago helado', esqui: 'está en la pista de esquí',
  telesilla: 'va sentado en el telesilla', cumbre: 'saluda desde la cima de la montaña del túnel', bosque: 'se esconde entre los abetos', puente: 'está debajo de un puente'};
export function elfKinds(day, stage) {
  let s = (day * 2654435761) >>> 0;
  const r = () => {s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296};
  const pool = ELF_SPOTS.filter(k => k !== 'vagon' && (k !== 'puente' || stage >= 1)), out = day % 2 ? ['vagon'] : [];
  while (out.length < ELVES) {const k = pool[Math.floor(r() * pool.length)]; if (!out.includes(k)) out.push(k)}
  return out;
}

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
/* enlace de una marca: solo http(s), con dominio y sin usuario ni contraseña; sin protocolo se le pone https://.
   Devuelve '' si está vacío y null si no vale. */
export function cleanUrl(s) {
  s = String(s || '').trim(); if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !/\.[a-z]{2,}$/i.test(u.hostname) || u.username || u.password) return null;
    return u.href.length > 200 ? null : u.href;
  } catch (e) {return null}
}

/* guardado: se valida y se acota todo; null si está roto o es de otra versión */
export function parseWorld(raw) {
  let o; try {o = JSON.parse(raw)} catch (e) {return null}
  if (!o || typeof o !== 'object' || o.v !== TV) return null;
  const num = (x, a, b, d) => Number.isFinite(+x) ? Math.min(b, Math.max(a, Math.floor(+x))) : d;
  const w = newWorld(num(o.t, 0, 9e15, Date.now()));
  w.stage = num(o.stage, 0, MAXSTAGE, 0);
  w.day = num(o.day, 1, DAYS, 1);
  w.wagons = num(o.wagons, 1, WAGON_MAX, 3);
  w.lights = num(o.lights, 0, MAXLIGHTS, 0);
  w.houses = num(o.houses, 0, slotsOf(w.stage).length, 3);
  w.mine = num(o.mine, -1, w.houses - 1, -1);
  for (const k of ['today', 'total', 'myGifts', 'myElves']) w[k] = num(o[k], 0, 1e15, 0);
  w.eDay = num(o.eDay, 1, DAYS, w.day); w.eMask = num(o.eMask, 0, (1 << ELVES) - 1, 0);
  w.myName = cleanText(o.myName, 14); w.myProv = cleanText(o.myProv, 20);
  if (w.mine >= 0 && !w.myName) w.mine = -1;
  w.goal = num(o.goal, 1, 1e15, 0) || goalFor(w);
  return w;
}
