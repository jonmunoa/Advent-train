// El tren de Navidad (prototipo, nombre provisional): economía y comunidad simulada, sin DOM.
// Un solo tren para todo el mundo. Cada jugador manda regalos a sus amigos por el tren: el regalo viaja en el
// vagón de regalos hasta la casa del amigo, y al amigo le llega un enlace para verlo llegar (y mandar otro).
// Los regalos enviados por todos suman al objetivo común del día; al cumplirlo pasa el día y el tren recibe una
// mejora: un tramo nuevo de vía (etapa de tren-map.js), otro vagón o más luces. Los jugadores ponen su casa junto a
// la vía. En el prototipo los demás jugadores están simulados (online, crowdGifts, nombres).
import {MAXSTAGE, slotsOf} from './tren-map.js';

export const TKEY = 'advx-tren', TV = 3, DAYS = 24;
export const MAXLIGHTS = 3, WAGON_MAX = 10, CAP = 5, FREE_GIFTS = 3;
export const DAY_SEC = 200;                 // en la demo, un día de Adviento dura unos 3 minutos
export const BID_MIN = 5, BID_STEP = 1, MSG_PRICE = 3, CLOSE_H = 21;
const nice = x => {if (x < 100) return Math.round(x); const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p};

export const sacoOf = w => Math.round(10 * 1.5 ** w.lights * 2 ** w.stage);   // regalos por casa y vuelta

/* comunidad simulada */
export const online = t => Math.max(12, Math.round(110 + 55 * Math.sin(t / 240) + 18 * Math.sin(t / 37 + 1)));
const dayK = d => 1 + 0.1 * (d - 1);
export const crowdGifts = (t, day) => online(t) * 0.055 * dayK(day);      // regalos por segundo que manda el resto
export const goalFor = w => nice(110 * 0.055 * dayK(w.day) * DAY_SEC);
export const NAMES = ['Ane', 'Iker', 'Lucía', 'Mateo', 'Martina', 'Hugo', 'Leire', 'Unai', 'Sara', 'Pablo', 'Noa', 'Aitor', 'Carmen', 'Javi', 'Irene', 'Marcos', 'Nerea', 'Álvaro', 'Paula', 'Amaia'];
export const PROVS = ['Bizkaia', 'Gipuzkoa', 'Álava', 'Navarra', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Asturias', 'Cantabria', 'Málaga', 'Zaragoza', 'A Coruña', 'Murcia', 'Granada'];
export const KIN = ['su abuela', 'su abuelo', 'su madre', 'su padre', 'su hermana', 'su hermano', 'su mejor amiga', 'su mejor amigo', 'su prima', 'su tía'];
export const BIZ = ['Bar Txoko', 'Floristería Lirio', 'Taller Mendi', 'Academia Lur', 'Librería Itsaso', 'Panadería Ogi'];
export const WRAP_NAMES = ['Rojo con lunares', 'Verde con estrellas', 'Rayas de caramelo', 'Dorado con rombos', 'Azul nevado', 'Morado con lunares'];

export function newWorld(now = Date.now()) {
  const w = {v: TV, day: 1, stage: 0, wagons: 3, lights: 0, houses: 3, mine: -1, prov: -1, myName: '', myProv: '',
    today: 0, goal: 0, total: 18430, myGifts: 0, sent: 0, sDay: 1, sToday: 0, t: now};
  w.goal = goalFor(w);
  return w;
}
/* regalos enviados hoy por todos: devuelve true si se cumple el objetivo del día */
export function addSent(w, x) {w.today += x; return w.day <= DAYS && w.today >= w.goal}
export const giftsLeft = w => w.sDay === w.day ? Math.max(0, FREE_GIFTS - w.sToday) : FREE_GIFTS;
/* gasta uno de tus regalos del día; false si ya no te quedan */
export function sendGift(w) {
  if (w.sDay !== w.day) {w.sDay = w.day; w.sToday = 0}
  if (w.sToday >= FREE_GIFTS) return false;
  w.sToday++; w.sent++; return true;
}
/* recompensa del día cumplido: los días impares crece la vía (hasta la última etapa); los demás, otro vagón o más luces */
export function rewardOf(w) {
  if (w.stage < MAXSTAGE && w.day % 2 === 1) return 'via';
  if (w.lights < MAXLIGHTS && w.day % 4 === 0) return 'luces';
  if (w.wagons < WAGON_MAX) return 'vagon';
  if (w.lights < MAXLIGHTS) return 'luces';
  return w.stage < MAXSTAGE ? 'via' : null;
}
/* pasa al día siguiente: aplica la recompensa y devuelve los regalos gratis del día; devuelve la recompensa */
export function nextDay(w) {
  const r = w.day < DAYS ? rewardOf(w) : null;
  if (r === 'via') w.stage++; else if (r === 'vagon') w.wagons++; else if (r === 'luces') w.lights++;
  w.day = Math.min(DAYS, w.day + 1); w.today = 0; w.goal = goalFor(w); w.sDay = w.day; w.sToday = 0;
  return r;
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

/* regalo que viaja en un enlace (#regalo-…): de, para, papel y dedicatoria, en base32 (solo letras y números,
   para que pase tal cual en el # de cualquier enlace). Al abrirlo se valida todo otra vez. */
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
export const GIFT_MAX = {name: 14, msg: 80};
export function cleanGift(g) {
  if (!g || typeof g !== 'object') return null;
  const d = cleanText(g.d, GIFT_MAX.name), p = cleanText(g.p, GIFT_MAX.name), m = cleanText(g.m, GIFT_MAX.msg), w = Math.floor(+g.w);
  if (!d || !p || !(w >= 0 && w < WRAP_NAMES.length)) return null;
  return {d, p, w, m};
}
export function encodeGift(g) {
  const c = cleanGift(g); if (!c) return null;
  const bytes = new TextEncoder().encode(JSON.stringify({v: 1, ...c})); let out = '', bits = 0, val = 0;
  for (const b of bytes) {val = ((val << 8) | b) & 0xffff; bits += 8; while (bits >= 5) {out += B32[(val >>> (bits - 5)) & 31]; bits -= 5}}
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function decodeGift(s) {
  s = String(s || '').toLowerCase().replace(/^#?regalo-/, ''); if (!s || s.length > 700) return null;
  const out = []; let bits = 0, val = 0;
  for (const ch of s) {const v = B32.indexOf(ch); if (v < 0) return null; val = ((val << 5) | v) & 0xffff; bits += 5; if (bits >= 8) {out.push((val >>> (bits - 8)) & 255); bits -= 8}}
  try {const o = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(new Uint8Array(out))); return o && o.v === 1 ? cleanGift(o) : null} catch (e) {return null}
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
  w.mine = num(o.mine, -1, w.houses - 1, -1); w.prov = num(o.prov, -1, w.houses - 1, -1);   // prov: la casa provisional a la que te llegó un regalo
  for (const k of ['today', 'total', 'myGifts', 'sent']) w[k] = num(o[k], 0, 1e15, 0);
  w.sDay = num(o.sDay, 1, DAYS, w.day); w.sToday = num(o.sToday, 0, FREE_GIFTS, 0);
  w.myName = cleanText(o.myName, 14); w.myProv = cleanText(o.myProv, 20);
  if (w.mine >= 0 && !w.myName) w.mine = -1;
  w.goal = num(o.goal, 1, 1e15, 0) || goalFor(w);
  return w;
}
