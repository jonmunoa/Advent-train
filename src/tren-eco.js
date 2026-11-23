// El tren de Navidad (prototipo, nombre provisional): calendario, partida y marcas, sin DOM, sin servidor y sin base de datos.
// Lo que es igual para todos sale del calendario (cada día de Adviento el tren crece: PLAN) y de un fichero que se edita
// a mano (tren-marcas.js). Lo tuyo (tu nombre, tu casa, los regalos que reparte tu tren y los caminos que has
// descubierto) se guarda solo en tu navegador.
import {MAXSTAGE, STAGE_NAMES, slotsOf} from './tren-map.js';

export const TKEY = 'advx-tren', TV = 5, DAYS = 24;
export const MAXLIGHTS = 3, WAGON_MAX = 10, CAP = 5;

export const sacoOf = w => Math.round(10 * 1.5 ** w.lights * 2 ** w.stage);   // regalos por casa y vuelta

/* ---------- calendario ---------- */
/* qué día de Adviento es: 1 a 24 en diciembre (se queda en 24 hasta Reyes) y 0 fuera de temporada */
export function dayOf(now = Date.now()) {const d = new Date(now), m = d.getMonth(), q = d.getDate(); return m === 11 ? Math.min(DAYS, q) : m === 0 && q <= 6 ? DAYS : 0}
export const daysToEve = (now = Date.now()) => {const d = new Date(now), a = new Date(d.getFullYear(), d.getMonth(), d.getDate()); let e = new Date(d.getFullYear(), 11, 24); if (a > e) e = new Date(d.getFullYear() + 1, 11, 24); return Math.round((e - a) / 864e5)};
/* qué llega cada día (del 2 al 24): un tramo de vía, un vagón, luces o casas */
export const PLAN = {2: 'vagon', 3: 'casas', 4: 'via', 5: 'vagon', 6: 'luces', 7: 'vagon', 8: 'casas', 9: 'via', 10: 'vagon', 11: 'casas', 12: 'vagon', 13: 'luces', 14: 'casas', 15: 'via', 16: 'vagon', 17: 'casas', 18: 'vagon', 19: 'casas', 20: 'luces', 21: 'casas', 22: 'casas', 23: 'casas', 24: 'nochebuena'};
/* cómo está el tren ese día: es igual para todo el mundo */
export function planOf(day) {
  const w = {day: Math.min(DAYS, Math.max(1, Math.floor(day) || 1)), stage: 0, wagons: 3, lights: 0, houses: 3};
  for (let d = 2; d <= w.day; d++) {const r = PLAN[d]; w.houses++; if (r === 'via') w.stage++; else if (r === 'vagon') w.wagons++; else if (r === 'luces') w.lights++; else if (r === 'casas') w.houses++}
  w.houses = Math.min(w.houses, slotsOf(w.stage).length - 1);   // siempre queda el hueco de tu casa
  return w;
}
export function rewardText(day) {
  const r = PLAN[day]; if (!r) return '';
  if (r === 'via') {const n = STAGE_NAMES[planOf(day).stage].toLowerCase(); return 'la vía llega ' + ('a ' + n).replace(/^a el /, 'al ')}
  return {vagon: 'otro vagón', luces: 'más luces', casas: 'casas nuevas en el pueblo', nochebuena: 'fuegos artificiales de Nochebuena'}[r];
}

/* ---------- agujas ---------- */
/* por dónde va el tren si no eliges: el camino por el que menos ha ido; si han ido igual, el contrario del de la última vez */
export const autoRoute = (ids, seen, last) => {const a = seen[ids[0]] || 0, b = seen[ids[1]] || 0; return a < b ? 0 : b < a ? 1 : last ? 0 : 1};

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

/* ---------- marcas (tren-marcas.js) ---------- */
export const isoDay = (now = Date.now()) => {const d = new Date(now), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`};
/* las de una fecha, por vagón: se valida y se limpia todo (una línea mal escrita no rompe el tren) */
export function marcasDe(list, iso, wagons = WAGON_MAX) {
  const out = {};
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== 'object') continue;
    const i = Math.floor(+m.vagon), re = /^\d{4}-\d\d-\d\d$/;
    if (!(i >= 1 && i <= wagons) || !re.test(m.desde) || !re.test(m.hasta || m.desde) || iso < m.desde || iso > (m.hasta || m.desde)) continue;
    const ad = {text: cleanText(m.texto, 32), sub: cleanText(m.sub, 40), url: cleanUrl(m.url) || '', bg: /^#[0-9a-f]{6}$/i.test(m.fondo) ? m.fondo : '#7a1020', img: /^m\/marcas\/[\w.-]+\.(png|jpe?g|webp)$/i.test(m.img) ? m.img : '', tag: i === 1 ? 'Patrocinado' : ''};
    if (ad.text || ad.img) out[i] = ad;
  }
  return out;
}
/* el texto de una petición, listo para el correo o el portapapeles */
export const askText = (ad, kind, precio) => [`Quiero ${kind === 'dia' ? 'el vagón del día' : 'un vagón'} del Tren de Navidad (${precio} €).`, '', `Texto: ${ad.text || '(solo imagen)'}`, ...(ad.sub ? [`Segunda línea: ${ad.sub}`] : []), ...(ad.url ? [`Enlace: ${ad.url}`] : []), `Color: ${ad.bg}`, ad.img ? 'Imagen: la adjunto a este mensaje.' : 'Sin imagen.', 'Día que me gustaría: '].join('\n');

/* ---------- la partida: solo lo tuyo; el resto sale del calendario ---------- */
export const newWorld = (day = 1) => ({v: TV, ...planOf(day), mine: -1, myName: '', total: 0, myGifts: 0, chosen: 0, seen: {}});
export const saveOf = w => JSON.stringify({v: TV, mine: w.mine, myName: w.myName, total: w.total, myGifts: w.myGifts, chosen: w.chosen, seen: w.seen});
/* se valida y se acota todo; null si está roto o es de otra versión */
export function parseWorld(raw, day = 1) {
  let o; try {o = JSON.parse(raw)} catch (e) {return null}
  if (!o || typeof o !== 'object' || o.v !== TV) return null;
  const num = x => Number.isFinite(+x) ? Math.min(1e15, Math.max(0, Math.floor(+x))) : 0, w = newWorld(day);
  for (const k of ['total', 'myGifts', 'chosen']) w[k] = num(o[k]);
  w.myName = cleanText(o.myName, 14); w.mine = o.mine === 0 && w.myName ? 0 : -1;
  if (o.seen && typeof o.seen === 'object') for (const k of Object.keys(o.seen).slice(0, 40)) if (/^[a-z]{2,12}$/.test(k) && num(o.seen[k])) w.seen[k] = num(o.seen[k]);
  return w;
}
