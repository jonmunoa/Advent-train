// Pruebas de los escaparates: circuitos (src/esc-vias.js) y marcas (src/esc-eco.js), sin navegador.
//   node tests/esc.test.mjs
import {strict as assert} from 'node:assert';
import {MAPS, mapaOf, atM, BW, BD, KG, KT, KB, pondE, pisteD} from '../src/esc-vias.js';
import {marcasEsc, pedirTexto, tiendaDe, sitioDe, VAGONES} from '../src/esc-eco.js';
import {MARCAS, PRECIO_ROTULO, PRECIO_VAGON} from '../src/esc-marcas.js';

let fails = 0;
const ok = (name, fn) => {try {fn(); console.log('  ok   ' + name)} catch (e) {fails++; console.log('  FALLO ' + name + '\n        ' + e.message)}};
const ALL = [0, 1, 2].map(mapaOf);

ok('hay tres circuitos distintos, cerrados y dentro del tablero', () => {
  assert.equal(MAPS.length, 3); assert.equal(new Set(MAPS.map(m => m.id)).size, 3); assert.equal(new Set(MAPS.map(m => m.nombre)).size, 3);
  for (const M of ALL) {const {T} = M; assert.ok(T.L > 380, `${M.id}: ${T.L}`); for (let i = 0; i < T.N; i++) {assert.ok(Math.abs(T.x[i]) < BW - 3.5 && Math.abs(T.z[i]) < BD - 3.5, `${M.id} se sale en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)}`); const j = (i + 1) % T.N; assert.ok(Math.hypot(T.x[j] - T.x[i], T.y[j] - T.y[i], T.z[j] - T.z[i]) < T.ds * 1.3)}}
});
ok('curvas suaves y cuestas de tren de juguete', () => {
  for (const M of ALL) {const {T} = M; for (let i = 0; i < T.N; i++) {const w = 8, da = Math.abs(((T.a[(i + w) % T.N] - T.a[(i - w + T.N) % T.N] + Math.PI * 3) % (Math.PI * 2)) - Math.PI); assert.ok(2 * w * T.ds / Math.max(da, 1e-6) > 9, `${M.id}: curva cerrada en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)}`); assert.ok(Math.abs(Math.tan(T.p[i])) < .105, `${M.id}: cuesta en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)}`)}}
});
ok('cada circuito tiene túnel, puentes y tramos a ras', () => {for (const M of ALL) {const k = new Set(M.T.k); assert.ok(k.has(KG) && M.T.runs.some(r => r.k === KT && r.n * M.T.ds > 20) && M.T.runs.filter(r => r.k === KB).length >= 2, M.id)}});
ok('donde la vía se cruza a sí misma pasa con hueco de sobra', () => {
  let cruces = 0; for (const M of ALL) {const {T} = M, far = Math.round(40 / T.ds); for (let i = 0; i < T.N; i += 2) for (let j = i + far; j < T.N; j += 2) {if (T.N - j + i < far) continue; if (Math.hypot(T.x[i] - T.x[j], T.z[i] - T.z[j]) < 4.6) {cruces++; assert.ok(Math.abs(T.y[i] - T.y[j]) > 6.8, M.id)}}} assert.ok(cruces > 0);
});
ok('el suelo llega a los raíles a ras, deja hueco bajo los puentes y cubre los túneles', () => {
  for (const M of ALL) {const {T} = M; for (let i = 0; i < T.N; i += 5) {const h = M.h(T.x[i], T.z[i]), near = [-10, -5, 5, 10].some(q => T.k[(i + q + T.N) % T.N] !== T.k[i]); if (near) continue; if (T.k[i] === KG) assert.ok(Math.abs(h - T.y[i]) < .9, `${M.id}: suelo ${h.toFixed(1)}, vía ${T.y[i].toFixed(1)}`); if (T.k[i] === KT) assert.ok(h > T.y[i] + 5.2, `${M.id}: túnel sin techo en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)} (${(h - T.y[i]).toFixed(1)})`); if (T.k[i] === KB) assert.ok(h < T.y[i] - .8)}}
});
ok('el estanque y la pista de esquí no los pisa la vía a ras', () => {for (const M of ALL) for (let i = 0; i < M.T.N; i += 3) if (M.T.k[i] === KG) {assert.ok(pondE(M, M.T.x[i], M.T.z[i]) > 1.02, M.id); assert.ok(pisteD(M, M.T.x[i], M.T.z[i]) > 5, M.id)}});
ok('la calle da la vuelta: siempre hay una copia de cada tienda cerca de quien pasea', () => {
  assert.deepEqual([-4, -1, 0, 1, 2, 3, 7].map(tiendaDe), [2, 2, 0, 1, 2, 0, 1]);
  for (let x = -5000; x < 5000; x += 37) {const s = [0, 1, 2].map(k => sitioDe(k, x, 340)); s.forEach((p, k) => {assert.ok(Math.abs(p - x) <= 340 * 1.5 + 1); assert.equal(tiendaDe(Math.round(p / 340)), k)}); assert.equal(new Set(s).size, 3)}
});
ok('las marcas salen solo en sus fechas y en sitios que existen, y una línea mal escrita no rompe nada', () => {
  const L = [{escaparate: 1, sitio: 'rotulo', desde: '2026-12-05', hasta: '2026-12-06', texto: 'Panadería <b>Ogi</b>', url: 'panaderiaogi.es', img: 'm/marcas/ogi.png', fondo: '#1d3a78'}, {escaparate: 2, sitio: 4, desde: '2026-12-05', texto: 'Un día', fondo: 'rojo'}, {escaparate: 4, sitio: 1, desde: '2026-12-05', texto: 'No existe'}, {escaparate: 2, sitio: 9, desde: '2026-12-05', texto: 'No existe'}, {escaparate: 3, sitio: 1, desde: '2026-12-05', texto: '', img: 'https://otra/x.png'}, null, 7, {escaparate: 3, sitio: 2, desde: '2026-12-05', texto: 'Raro', url: 'javascript:alert(1)'}];
  const d = marcasEsc(L, '2026-12-05'); assert.deepEqual(Object.keys(d[1]), ['rotulo']); assert.deepEqual(Object.keys(d[2]), ['4']); assert.deepEqual(Object.keys(d[3]), ['2']); assert.equal(d[3][2].url, ''); assert.equal(d[2][4].bg, '#7a1020'); assert.equal(d[1].rotulo.url, 'https://panaderiaogi.es/'); assert.ok(!/[<>]/.test(d[1].rotulo.text));
  assert.deepEqual(marcasEsc(L, '2026-12-07'), {1: {}, 2: {}, 3: {}}); assert.deepEqual(marcasEsc(undefined, 'x'), {1: {}, 2: {}, 3: {}}); assert.equal(VAGONES, MAPS[0].wagons);
});
ok('el fichero de marcas está bien escrito y la petición lleva los datos', () => {
  assert.ok(Array.isArray(MARCAS) && PRECIO_ROTULO > 0 && PRECIO_VAGON > 0); for (const m of MARCAS) assert.ok(Object.values(marcasEsc([m], m.desde)).some(e => Object.keys(e).length), 'línea que no sale nunca: ' + JSON.stringify(m));
  const t = pedirTexto({text: 'Ogi', sub: 'Roscón', url: 'https://ogi.es/', bg: '#1d3a78', img: 'x'}, 'rotulo', 2, 10); for (const q of ['rótulo', 'escaparate 2', '10 €', 'Ogi', 'Roscón', 'https://ogi.es/', 'adjunto']) assert.ok(t.includes(q), q);
});
console.log(fails ? `\n${fails} fallos` : '\nTodo OK'); process.exit(fails ? 1 : 0);
