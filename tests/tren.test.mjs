// Pruebas de la economía y la comunidad simulada del tren compartido (src/tren-eco.js), sin navegador.
//   node tests/tren.test.mjs
import {strict as assert} from 'node:assert';
import {STAGES, ECO, slotsOf} from '../src/idle-eco.js';
import {DAYS, BID_MIN, CLOSE_H, newWorld, nextUp, upCost, addPot, addGifts, nextDay, rateOf, goalFor, closeAt, showDay, minBid, cleanText, parseWorld, online, crowdRate} from '../src/tren-eco.js';

let fails = 0;
const ok = (name, fn) => {try {fn(); console.log('  ok   ' + name)} catch (e) {fails++; console.log('  FALLO ' + name + '\n        ' + e.message)}};

ok('la partida empieza con tren, casas de otros y huecos libres', () => {
  const w = newWorld(0);
  assert.ok(w.wagons >= 2 && w.houses < slotsOf(0).length, 'quedan huecos');
  assert.equal(w.mine, -1); assert.ok(w.goal > 0 && rateOf(w) > 0);
});
ok('el bote compra las mejoras por turnos, cada vez más caras, y sobra lo justo', () => {
  const w = newWorld(0), seen = []; let last = 0;
  for (let i = 0; i < 8; i++) {const c = upCost(w); assert.ok(c > last, `coste ${c} tras ${last}`); last = c; seen.push(...addPot(w, c))}
  assert.deepEqual(seen.slice(0, 4), ['vagon', 'loco', 'vagon', 'luces']);
  assert.equal(w.n, 8); assert.ok(w.pot < upCost(w));
  const big = newWorld(0); const got = addPot(big, 1e6); assert.ok(got.length > 3, 'varias de golpe'); assert.ok(big.pot < upCost(big) || !nextUp(big));
});
ok('las mejoras al máximo se saltan y al final no queda ninguna', () => {
  const w = newWorld(0); w.wagons = ECO.wagonMax; assert.notEqual(nextUp(w), 'vagon');
  w.loco = ECO.locoMax; w.lights = 3; assert.equal(nextUp(w), null); assert.deepEqual(addPot(w, 1e9), []);
});
ok('cumplir el objetivo del día abre un tramo de vía hasta la última etapa', () => {
  const w = newWorld(0); let grown = 0;
  for (let d = 1; d < DAYS; d++) {assert.ok(addGifts(w, w.goal), `día ${d}`); const g0 = w.goal; if (nextDay(w)) {grown++; assert.ok(w.goal > g0, 'el objetivo crece con la vía')}}
  assert.equal(grown, STAGES.length - 1); assert.equal(w.stage, STAGES.length - 1); assert.equal(w.day, DAYS);
  assert.equal(addGifts(w, 1), false, 'sin objetivo a medias');
});
ok('el objetivo del día cuesta unos minutos con la gente que hay', () => {
  const w = newWorld(0), sec = w.goal / rateOf(w); assert.ok(sec > 90 && sec < 400, `${Math.round(sec)} s`); assert.equal(goalFor(w), w.goal);
});
ok('la comunidad simulada siempre echa carbón', () => {
  for (let t = 0; t < 3600; t += 7) {assert.ok(online(t) >= 12); assert.ok(crowdRate(t) > 0)}
});
ok(`la subasta cierra a las ${CLOSE_H}:00 y el vagón sale el día siguiente`, () => {
  const am = new Date(2026, 11, 3, 10, 0).getTime(), pm = new Date(2026, 11, 3, 22, 30).getTime();
  assert.equal(new Date(closeAt(am)).getDate(), 3); assert.equal(new Date(closeAt(am)).getHours(), CLOSE_H);
  assert.equal(new Date(closeAt(pm)).getDate(), 4);
  assert.equal(new Date(showDay(am)).getDate(), 4); assert.equal(new Date(showDay(pm)).getDate(), 5);
  assert.equal(minBid(0), BID_MIN); assert.equal(minBid(41), 42);
});
ok('el texto de los jugadores se limpia y se acota', () => {
  assert.equal(cleanText('  Ane  <b>\n</b> ', 14), 'Ane b /b'); assert.equal(cleanText('x'.repeat(40), 14).length, 14); assert.equal(cleanText(null, 5), '');
});
ok('el guardado roto o manipulado no rompe la partida', () => {
  assert.equal(parseWorld(null), null); assert.equal(parseWorld('{'), null); assert.equal(parseWorld('{"v":9}'), null);
  const w = parseWorld(JSON.stringify({v: 1, stage: 99, wagons: 0, houses: 999, mine: 3, myName: '', lights: 'x', pot: -4, day: 40}));
  assert.equal(w.stage, STAGES.length - 1); assert.equal(w.wagons, 1); assert.equal(w.houses, slotsOf(w.stage).length);
  assert.equal(w.mine, -1, 'sin nombre no hay casa propia'); assert.equal(w.lights, 0); assert.equal(w.pot, 0); assert.equal(w.day, DAYS);
  const a = newWorld(5); a.mine = 2; a.myName = 'Jon'; a.pot = 123; a.stage = 1; a.houses = 7; assert.deepEqual(parseWorld(JSON.stringify(a)), a);
});

console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo OK');
process.exit(fails ? 1 : 0);
