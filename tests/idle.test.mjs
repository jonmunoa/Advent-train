// Pruebas de la economía y el trazado del idle (src/idle-eco.js), sin navegador.
//   node tests/idle.test.mjs
import {strict as assert} from 'node:assert';
import {STAGES, ECO, TREE_R, HOUSE_OFF, START_COINS, trackOf, slotsOf, newState, ITEMS, maxed, canBuy, buy, rateOf, offlineGain, parseSave, nice} from '../src/idle-eco.js';
import {simulate} from './idle-balance.mjs';

let fails = 0;
const ok = (name, fn) => {try {fn(); console.log('  ok   ' + name)} catch (e) {fails++; console.log('  FALLO ' + name + '\n        ' + e.message)}};

ok('cada etapa tiene más vía y más huecos para casas', () => {
  for (let k = 1; k < STAGES.length; k++) {
    assert.ok(trackOf(k).L > trackOf(k - 1).L, `vía ${k + 1}`);
    assert.ok(slotsOf(k).length > slotsOf(k - 1).length, `huecos ${k + 1}`);
  }
});
ok('las casas no pisan la vía, el árbol ni otras casas, y van en orden de recorrido', () => {
  for (let k = 0; k < STAGES.length; k++) {
    const T = trackOf(k), S = slotsOf(k);
    S.forEach((a, i) => {
      let m = 1e9; for (let j = 0; j < T.N; j++) m = Math.min(m, Math.hypot(T.x[j] - a.x, T.z[j] - a.z));
      assert.ok(m > HOUSE_OFF - 0.7, `vía ${k + 1}, casa ${i}: a ${m.toFixed(1)} m de la vía`);
      assert.ok(Math.hypot(a.x, a.z) > TREE_R + 9, `vía ${k + 1}, casa ${i}: dentro del árbol`);
      S.forEach((b, j) => {if (j > i) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 12, `vía ${k + 1}: casas ${i} y ${j} juntas`)});
      if (i) assert.ok(a.s > S[i - 1].s, 'orden');
      assert.ok(a.s > 20 && a.s < T.L - 20, 'lejos del taller');
    });
  }
});
ok('los precios suben con cada compra y son redondos', () => {
  const st = newState(0); st.coins = 1e30;
  for (const k of Object.keys(ITEMS)) {
    const s = structuredClone(st); let last = 0, n = 0;
    while (!maxed(s, k) && n++ < 12) {const c = ITEMS[k].cost(s); assert.ok(c > last, `${k}: ${c} tras ${last}`); assert.equal(c, nice(c)); last = c; buy(s, k)}
  }
});
ok('la partida nueva permite comprar la primera casa', () => {const st = newState(0); assert.equal(st.coins, START_COINS); assert.ok(canBuy(st, 'casa'))});
ok('sin vagones suficientes las casas extra no cuentan', () => {
  const st = newState(0); st.houses = ECO.cap + 3; const r1 = rateOf(st); st.wagons = 2; assert.ok(rateOf(st) > r1);
  st.houses = ECO.cap; const r2 = rateOf(st); st.houses = ECO.cap + 1; st.wagons = 1; assert.equal(rateOf(st), r2);
});
ok('no se puede comprar sin monedas ni pasar del máximo', () => {
  const st = newState(0); st.coins = 0; assert.equal(buy(st, 'casa'), false);
  st.coins = 1e30; st.houses = slotsOf(0).length; assert.equal(buy(st, 'casa'), false, 'vía llena');
  st.wagons = ECO.wagonMax; assert.equal(buy(st, 'vagon'), false);
  st.stage = STAGES.length - 1; assert.equal(buy(st, 'via'), false);
});
ok('lo ganado sin conexión: 60 % del ritmo y como mucho 8 horas', () => {
  const st = newState(0); st.houses = 4; const r = rateOf(st);
  const g1 = offlineGain(st, 3600 * 1000); assert.ok(Math.abs(g1.coins - Math.floor(r * 3600 * ECO.offlineK)) <= 1, `${g1.coins}`); assert.ok(g1.gifts > 0);
  const g2 = offlineGain(st, 48 * 3600 * 1000); assert.equal(g2.sec, ECO.offlineMax);
  assert.equal(offlineGain(st, -5000).coins, 0, 'reloj hacia atrás');
});
ok('el guardado roto o manipulado no rompe la partida', () => {
  assert.equal(parseSave(null), null); assert.equal(parseSave('{'), null); assert.equal(parseSave('{"v":99}'), null);
  const st = parseSave(JSON.stringify({v: 1, coins: -5, houses: 999, wagons: 0, loco: 50, lights: 'x', stage: 42, t: 1}));
  assert.equal(st.coins, 0); assert.equal(st.stage, STAGES.length - 1); assert.equal(st.houses, slotsOf(st.stage).length);
  assert.equal(st.wagons, 1); assert.equal(st.loco, ECO.locoMax); assert.equal(st.lights, 0);
  const a = newState(5); a.coins = 123.5; a.houses = 3; a.stage = 1; const b = parseSave(JSON.stringify(a)); assert.deepEqual(b, a);
});
ok('ritmo: la segunda vía llega entre 3 y 9 minutos y la maqueta se completa en menos de una hora', () => {
  const {t, ms, st} = simulate(3 * 3600);
  const v2 = ms.find(([, m]) => m.startsWith('vía 2 ('));
  assert.ok(v2 && v2[0] > 180 && v2[0] < 540, `vía 2 a los ${v2 && v2[0]} s`);
  assert.ok(maxed(st, 'via') && maxed(st, 'casa') && t < 3600, `fin a los ${Math.round(t)} s`);
});

console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo OK');
process.exit(fails ? 1 : 0);
