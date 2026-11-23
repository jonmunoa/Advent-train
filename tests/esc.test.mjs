// Pruebas de los escaparates: circuitos (src/esc-vias.js) y marcas (src/esc-eco.js), sin navegador.
//   node tests/esc.test.mjs
import {strict as assert} from 'node:assert';
import {MAPS, mapaOf, atM, BW, BD, KG, KT, KB, pondE, pisteD} from '../src/esc-vias.js';
import {marcasEsc, pedirTexto, sitioDe, FACH, ESC, VAGONES} from '../src/esc-eco.js';
import {N, DIAS, EXTRAS, ULTIMO, estado, previa, pedido, falta, tope, ropaDe} from '../src/esc-historia.js';
import {readFileSync} from 'node:fs';
import {MARCAS, PRECIO_ROTULO, PRECIO_VAGON} from '../src/esc-marcas.js';

let fails = 0;
const ok = (name, fn) => {try {fn(); console.log('  ok   ' + name)} catch (e) {fails++; console.log('  FALLO ' + name + '\n        ' + e.message)}};
const ALL = MAPS.map((_, i) => mapaOf(i)), GRANDES = [1, 4, 8, 10, 13, 17, 22, 24].map(d => ALL[d - 1]);

ok('hay 24 circuitos, cerrados y dentro del tablero', () => {
  assert.equal(MAPS.length, 24); assert.equal(new Set(MAPS.map(m => m.id)).size, 24);
  for (const M of ALL) {const {T} = M; assert.ok(T.L > 380, `${M.id}: ${T.L}`); for (let i = 0; i < T.N; i++) {assert.ok(Math.abs(T.x[i]) < BW - 3.5 && Math.abs(T.z[i]) < BD - 3.5, `${M.id} se sale en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)}`); const j = (i + 1) % T.N; assert.ok(Math.hypot(T.x[j] - T.x[i], T.y[j] - T.y[i], T.z[j] - T.z[i]) < T.ds * 1.3)}}
});
ok('curvas suaves y cuestas de tren de juguete', () => {
  for (const M of ALL) {const {T} = M; for (let i = 0; i < T.N; i++) {const w = 8, da = Math.abs(((T.a[(i + w) % T.N] - T.a[(i - w + T.N) % T.N] + Math.PI * 3) % (Math.PI * 2)) - Math.PI); assert.ok(2 * w * T.ds / Math.max(da, 1e-6) > 9, `${M.id}: curva cerrada en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)}`); assert.ok(Math.abs(Math.tan(T.p[i])) < .11, `${M.id}: cuesta en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)}`)}}
});
ok('los circuitos tienen túnel o puentes, y los grandes casi todos las dos cosas', () => {for (const M of ALL) assert.ok(M.T.k.includes(KG), M.id); assert.ok(ALL.filter(M => M.T.runs.length).length >= 23); assert.ok(GRANDES.filter(M => M.T.runs.some(r => r.k === KT) && M.T.runs.some(r => r.k === KB)).length >= 7)});
ok('donde la vía se cruza a sí misma pasa con hueco de sobra', () => {
  let cruces = 0; for (const M of ALL) {const {T} = M, far = Math.round(40 / T.ds); for (let i = 0; i < T.N; i += 2) for (let j = i + far; j < T.N; j += 2) {if (T.N - j + i < far) continue; if (Math.hypot(T.x[i] - T.x[j], T.z[i] - T.z[j]) < 4.6) {cruces++; assert.ok(Math.abs(T.y[i] - T.y[j]) > 6.8, M.id)}}} assert.ok(cruces > 0);
});
ok('el suelo llega a los raíles a ras, deja hueco bajo los puentes y cubre los túneles', () => {
  for (const M of ALL) {const {T} = M; for (let i = 0; i < T.N; i += 5) {const h = M.h(T.x[i], T.z[i]), near = [-10, -5, 5, 10].some(q => T.k[(i + q + T.N) % T.N] !== T.k[i]); if (near) continue; if (T.k[i] === KG) assert.ok(Math.abs(h - T.y[i]) < .9, `${M.id}: suelo ${h.toFixed(1)}, vía ${T.y[i].toFixed(1)}`); if (T.k[i] === KT) assert.ok(h > T.y[i] + 5.2, `${M.id}: túnel sin techo en ${T.x[i].toFixed(0)}, ${T.z[i].toFixed(0)} (${(h - T.y[i]).toFixed(1)})`); if (T.k[i] === KB) assert.ok(h < T.y[i] - .8)}}
});
ok('el estanque y la pista de esquí no los pisa la vía a ras', () => {for (const M of ALL) for (let i = 0; i < M.T.N; i += 3) if (M.T.k[i] === KG) {assert.ok(pondE(M, M.T.x[i], M.T.z[i]) > 1.02, M.id); assert.ok(pisteD(M, M.T.x[i], M.T.z[i]) > 5, M.id)}});
ok('las tres fachadas se reparten los escaparates: siempre hay una cerca y cada una cae en los suyos', () => {
  for (let x = -600; x < 9000; x += 37) {const n = Array.from({length: FACH}, (_, k) => sitioDe(k, x, 340)); n.forEach((q, k) => {assert.equal(((q % FACH) + FACH) % FACH, k); assert.ok(Math.abs(q * 340 - x) <= 340 * 1.5 + 1)}); assert.equal(new Set(n).size, 3)}
});
ok('el calendario: se enciende uno al día a las 18:00 y el 24 están todos', () => {
  const e = (...a) => estado(new Date(...a)); assert.equal(e(2026, 10, 24).temporada, false); assert.equal(e(2026, 11, 1, 10).abiertos, 0); assert.equal(e(2026, 11, 1, 18).abiertos, 1); assert.equal(e(2026, 11, 7, 17, 59).abiertos, 6); assert.equal(e(2026, 11, 7, 18).abiertos, 7); assert.equal(e(2026, 11, 24, 12).abiertos, 23); assert.equal(e(2026, 11, 24, 18).abiertos, 24); assert.equal(e(2026, 11, 28).abiertos, 24); assert.equal(e(2026, 11, 28).proximo, null); assert.equal(e(2026, 11, 31, 20).extra, 'campanadas'); assert.equal(e(2027, 0, 5, 19).extra, 'cabalgata'); assert.equal(e(2027, 0, 6, 9).extra, 'reyes'); assert.equal(e(2027, 0, 20).temporada, false);
  const p = e(2026, 11, 7, 12).proximo; assert.equal(p.getDate(), 7); assert.equal(p.getHours(), 18); assert.equal(e(2026, 11, 7, 19).proximo.getDate(), 8); assert.equal(e(2026, 10, 24).proximo.getMonth(), 11);
});
ok('cuánto falta se dice con palabras y la vista previa no se sale del calendario', () => {
  const h = new Date(2026, 11, 7, 18); assert.equal(falta(h, new Date(2026, 11, 7, 17, 48)), 'en 12 min'); assert.equal(falta(h, new Date(2026, 11, 7, 9)), 'hoy a las 18:00'); assert.equal(falta(h, new Date(2026, 11, 6, 20)), 'mañana a las 18:00'); assert.equal(falta(h, new Date(2026, 10, 24)), 'el 7 de diciembre'); assert.equal(falta(h, new Date(2026, 11, 8)), 'ahora');
  assert.equal(previa(7).abiertos, 7); assert.equal(previa(0).abiertos, 1); assert.equal(previa(99).extra, 'reyes'); assert.equal(previa(26).extra, 'cabalgata'); assert.equal(pedido('?dia=7', ''), 7); assert.equal(pedido('', '#dia-27'), 27); assert.equal(pedido('?dia=99', ''), 0); assert.equal(pedido('', '#otra'), 0); assert.equal(tope(0), 0); assert.equal(tope(7), 7); assert.equal(tope(24), 23);
});
ok('la ropa cuenta la historia: guantes hasta el 5, abrigo rojo hasta el 15 y la bufanda del niño desde el 17', () => {
  assert.ok(ropaDe(5).guantes && !ropaDe(6).guantes && ropaDe(6).manoplas); assert.ok(ropaDe(15).abrigo && !ropaDe(16).abrigo && !ropaDe(24).abrigo); assert.ok(ropaDe(16).bufandaNino && !ropaDe(17).bufandaNino && ropaDe(17).bufandaRoja); assert.ok(!ropaDe(14).botas && ropaDe(15).botas);
});
ok('cada día tiene escaparate, tema y escena; los días clave van sin marca', () => {
  const es = readFileSync(new URL('../src/esc-escenas.js', import.meta.url), 'utf8'), di = readFileSync(new URL('../src/esc-dias.js', import.meta.url), 'utf8'); assert.equal(DIAS.length, N); assert.equal(ULTIMO, N + Object.keys(EXTRAS).length); for (let d = 1; d <= N; d++) assert.ok(es.includes(`*d${d}()`), `escena ${d}`); for (const x of Object.values(EXTRAS)) assert.ok(es.includes(`*${x}()`), x); for (const m of MAPS) if (!['pueblo', 'esqui', 'polo'].includes(m.id)) assert.ok(di.includes(`  ${m.id}: T(`) && di.includes(`  ${m.id}() {`), m.id); assert.deepEqual(DIAS.filter(d => d.sinMarca).map(d => d.d), [18, 20, 24]);
});
ok('las marcas salen solo en sus fechas y en sitios que existen, y una línea mal escrita no rompe nada', () => {
  const L = [{escaparate: 1, sitio: 'rotulo', desde: '2026-12-05', hasta: '2026-12-06', texto: 'Panadería <b>Ogi</b>', url: 'panaderiaogi.es', img: 'm/marcas/ogi.png', fondo: '#1d3a78'}, {escaparate: 2, sitio: 4, desde: '2026-12-05', texto: 'Un día', fondo: 'rojo'}, {escaparate: 25, sitio: 1, desde: '2026-12-05', texto: 'No existe'}, {escaparate: 2, sitio: 9, desde: '2026-12-05', texto: 'No existe'}, {escaparate: 3, sitio: 1, desde: '2026-12-05', texto: '', img: 'https://otra/x.png'}, null, 7, {escaparate: 3, sitio: 2, desde: '2026-12-05', texto: 'Raro', url: 'javascript:alert(1)'}];
  const d = marcasEsc(L, '2026-12-05'); assert.deepEqual(Object.keys(d[1]), ['rotulo']); assert.deepEqual(Object.keys(d[2]), ['4']); assert.deepEqual(Object.keys(d[3]), ['2']); assert.equal(d[3][2].url, ''); assert.equal(d[2][4].bg, '#7a1020'); assert.equal(d[1].rotulo.url, 'https://panaderiaogi.es/'); assert.ok(!/[<>]/.test(d[1].rotulo.text));
  const vacio = Object.fromEntries(Array.from({length: ESC}, (_, i) => [i + 1, {}])); assert.equal(ESC, N); assert.deepEqual(marcasEsc(L, '2026-12-07'), vacio); assert.deepEqual(marcasEsc(undefined, 'x'), vacio); assert.equal(VAGONES, MAPS[0].wagons);
});
ok('el fichero de marcas está bien escrito y la petición lleva los datos', () => {
  assert.ok(Array.isArray(MARCAS) && PRECIO_ROTULO > 0 && PRECIO_VAGON > 0); for (const m of MARCAS) assert.ok(Object.values(marcasEsc([m], m.desde)).some(e => Object.keys(e).length), 'línea que no sale nunca: ' + JSON.stringify(m));
  const t = pedirTexto({text: 'Ogi', sub: 'Roscón', url: 'https://ogi.es/', bg: '#1d3a78', img: 'x'}, 'rotulo', 2, 10); for (const q of ['rótulo', 'escaparate 2', '10 €', 'Ogi', 'Roscón', 'https://ogi.es/', 'adjunto']) assert.ok(t.includes(q), q);
});
console.log(fails ? `\n${fails} fallos` : '\nTodo OK'); process.exit(fails ? 1 : 0);
