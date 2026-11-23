// El tren de Navidad (prototipo, nombre provisional): economía y comunidad simulada, sin DOM.
// Un solo tren para todo el mundo. En cada aguja la gente vota, con un toque, por qué camino va; entre los que votan
// sale el maquinista, que lleva su nombre en la locomotora hasta la aguja siguiente. Los votos de todos suman al
// objetivo común del día; al cumplirlo pasa el día y el tren recibe una mejora: un tramo nuevo de vía (etapa de
// tren-map.js), otro vagón o más luces. Los jugadores ponen su casa junto a la vía. En el prototipo los demás
// jugadores están simulados (online, crowdVotes, nombres).
import {MAXSTAGE, slotsOf} from './tren-map.js';

export const TKEY = 'advx-tren', TV = 4, DAYS = 24;
export const MAXLIGHTS = 3, WAGON_MAX = 10, CAP = 5;
export const DAY_SEC = 200;                 // en la demo, un día de Adviento dura unos 3 minutos
export const BID_MIN = 5, BID_STEP = 1, MSG_PRICE = 3, CLOSE_H = 21;
const nice = x => {if (x < 100) return Math.round(x); const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p};

export const sacoOf = w => Math.round(10 * 1.5 ** w.lights * 2 ** w.stage);   // regalos por casa y vuelta

/* comunidad simulada */
export const online = t => Math.max(12, Math.round(110 + 55 * Math.sin(t / 240) + 18 * Math.sin(t / 37 + 1)));
const dayK = d => 1 + 0.1 * (d - 1);
export const VOTE_K = 0.008;
export const crowdVotes = (t, day) => online(t) * VOTE_K * dayK(day);      // votos por segundo del resto
export const goalFor = w => nice(110 * VOTE_K * dayK(w.day) * DAY_SEC);
export const NAMES = ['Ane', 'Iker', 'Lucía', 'Mateo', 'Martina', 'Hugo', 'Leire', 'Unai', 'Sara', 'Pablo', 'Noa', 'Aitor', 'Carmen', 'Javi', 'Irene', 'Marcos', 'Nerea', 'Álvaro', 'Paula', 'Amaia'];
export const BIZ = ['Bar Txoko', 'Floristería Lirio', 'Taller Mendi', 'Academia Lur', 'Librería Itsaso', 'Panadería Ogi'];

export function newWorld(now = Date.now()) {
  const w = {v: TV, day: 1, stage: 0, wagons: 3, lights: 0, houses: 3, mine: -1, myName: '',
    today: 0, goal: 0, total: 18430, myGifts: 0, votes: 0, wins: 0, drives: 0, sinceDrive: 0, t: now};
  w.goal = goalFor(w);
  return w;
}
/* votos de hoy entre todos: devuelve true si se cumple el objetivo del día */
export function addVotes(w, x) {w.today += x; return w.day <= DAYS && w.today >= w.goal}

/* una votación: n[0] son los votos del camino de la izquierda y n[1], los de la derecha */
export const newPoll = (rnd = Math.random) => ({n: [0, 0], mine: -1, ph: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.3});
/* votos del resto: k votos repartidos con una tendencia que cambia y un empujón al que va perdiendo (suele haber pelea hasta el final) */
export function crowdVote(p, k, t) {
  const tot = p.n[0] + p.n[1], q = Math.min(0.9, Math.max(0.1, 0.5 + p.tilt + 0.1 * Math.sin(t * 0.21 + p.ph) + 0.35 * (p.n[1] - p.n[0]) / (tot + 8)));
  p.n[0] += k * q; p.n[1] += k * (1 - q);
}
/* tu voto: uno por aguja, y se puede cambiar hasta que se cierra. Devuelve 'nuevo', 'cambio' o null si no cambia nada */
export function castVote(p, side) {
  if ((side !== 0 && side !== 1) || p.mine === side) return null;
  const was = p.mine; if (was >= 0) p.n[was]--;
  p.n[side]++; p.mine = side; return was < 0 ? 'nuevo' : 'cambio';
}
export const votesOf = p => [Math.floor(p.n[0] + 1e-6), Math.floor(p.n[1] + 1e-6)];
/* gana quien tenga más votos; en un empate decide tu voto (en la demo) y, si no has votado, la suerte */
export const winnerOf = (p, rnd = Math.random) => {const [a, b] = votesOf(p); return a > b ? 0 : b > a ? 1 : p.mine >= 0 ? p.mine : rnd() < 0.5 ? 0 : 1};
/* ¿te toca ser el maquinista? Solo si has votado; en la demo sale a menudo, y como tarde al tercer voto */
export function drawDriver(w, voted, rnd = Math.random) {
  if (!voted) return false;
  w.sinceDrive++;
  if (w.sinceDrive < 3 && rnd() >= 0.4) return false;
  w.sinceDrive = 0; w.drives++; return true;
}
/* recompensa del día cumplido: los días impares crece la vía (hasta la última etapa); los demás, otro vagón o más luces */
export function rewardOf(w) {
  if (w.stage < MAXSTAGE && w.day % 2 === 1) return 'via';
  if (w.lights < MAXLIGHTS && w.day % 4 === 0) return 'luces';
  if (w.wagons < WAGON_MAX) return 'vagon';
  if (w.lights < MAXLIGHTS) return 'luces';
  return w.stage < MAXSTAGE ? 'via' : null;
}
/* pasa al día siguiente: aplica la recompensa y la devuelve */
export function nextDay(w) {
  const r = w.day < DAYS ? rewardOf(w) : null;
  if (r === 'via') w.stage++; else if (r === 'vagon') w.wagons++; else if (r === 'luces') w.lights++;
  w.day = Math.min(DAYS, w.day + 1); w.today = 0; w.goal = goalFor(w);
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
  for (const k of ['today', 'total', 'myGifts', 'votes', 'wins', 'drives', 'sinceDrive']) w[k] = num(o[k], 0, 1e15, 0);
  w.myName = cleanText(o.myName, 14);
  if (w.mine >= 0 && !w.myName) w.mine = -1;
  w.goal = num(o.goal, 1, 1e15, 0) || goalFor(w);
  return w;
}
