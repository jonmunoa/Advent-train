// Pruebas de la maqueta (src/tren-map.js) y del calendario, las marcas y la partida (src/tren-eco.js), sin navegador.
//   node tests/tren.test.mjs
import {strict as assert} from 'node:assert';
import {STAGES, MAXSTAGE, KT, KB, KG, mapOf, atM, H0, F, BOARD, lakeE, pisteD, nearTrack, otherNear, TUN_DY} from '../src/tren-map.js';
import {DAYS, WAGON_MAX, MAXLIGHTS, PLAN, newWorld, parseWorld, saveOf, planOf, rewardText, dayOf, daysToEve, isoDay, autoRoute, marcasDe, askText, cleanText, cleanUrl} from '../src/tren-eco.js';
import {MARCAS, PRECIO_DIA, PRECIO_VAGON} from '../src/tren-marcas.js';

let fails = 0;
const ok = (name, fn) => {try {fn(); console.log('  ok   ' + name)} catch (e) {fails++; console.log('  FALLO ' + name + '\n        ' + e.message)}};

/* ---------- la maqueta ---------- */
ok('cada etapa es más larga que la anterior y todas caben en el tablero', () => {
  let L0 = 0;
  for (let k = 0; k <= MAXSTAGE; k++) {const {T} = mapOf(k); assert.ok(T.L > L0 + 60, `etapa ${k}: ${T.L}`); L0 = T.L;
    for (let i = 0; i < T.N; i += 5) assert.ok(T.x[i] > BOARD.x0 + 8 && T.x[i] < BOARD.x1 - 8 && T.z[i] > BOARD.z0 + 30 && T.z[i] < BOARD.z1 - 8, `etapa ${k} se sale en ${i}`)}
});
ok('las pendientes son de tren de juguete (menos del 10 %) y el taller está a ras', () => {
  for (let k = 0; k <= MAXSTAGE; k++) {const {T} = mapOf(k); for (let i = 0; i < T.N; i++) assert.ok(Math.abs(Math.tan(T.p[i])) < 0.1, `etapa ${k}, muestra ${i}`);
    for (let s = -8; s <= 14; s++) assert.equal(T.k[((Math.round(s / T.ds)) % T.N + T.N) % T.N], KG)}
});
ok('hay túnel desde el primer día, puentes desde el segundo y más túneles y puentes al final', () => {
  const runs = k => mapOf(k).T.runs, has = (k, kk) => runs(k).filter(r => r.k === kk).length;
  assert.ok(has(0, KT) >= 1); assert.ok(has(1, KB) >= 2); assert.ok(has(MAXSTAGE, KT) >= 2 && has(MAXSTAGE, KB) >= 3, JSON.stringify(runs(MAXSTAGE)));
  for (let k = 0; k <= MAXSTAGE; k++) for (const r of runs(k)) assert.ok(r.n * mapOf(k).T.ds >= (r.k === KT ? 16 : 6), `tramo corto en la etapa ${k}`);
});
ok('el terreno se adapta a la vía: a ras queda a la altura de los carriles y en los túneles la montaña los cubre', () => {
  for (let k = 0; k <= MAXSTAGE; k++) {const M = mapOf(k), T = M.T;
    for (let i = 0; i < T.N; i += 7) {const h = M.h(T.x[i], T.z[i]);
      const abut = [-12, -6, 6, 12].some(q => T.k[(i + q + T.N) % T.N] === KB);   // junto a un puente lo tapa el estribo de piedra
      if (T.k[i] === KG && !abut) assert.ok(Math.abs(h - T.y[i]) < 0.6, `etapa ${k}, ${i}: suelo ${h.toFixed(2)} y vía ${T.y[i].toFixed(2)}`);
      const inner = [-2, -1, 1, 2].every(q => T.k[(i + q + T.N) % T.N] === KT);   // en la boca, la tapa la fachada de piedra
      if (inner) assert.ok(h > T.y[i] + 6.4, `etapa ${k}, ${i}: túnel sin techo`)}}
});
ok('los huecos de casas no pisan la vía, el lago, la pista ni la plaza, y están separados', () => {
  for (let k = 0; k <= MAXSTAGE; k++) {const M = mapOf(k);
    assert.ok(M.SL.length >= (k ? 25 : 14), `etapa ${k}: ${M.SL.length} huecos`);
    for (const s of M.SL) {assert.ok(nearTrack(M.G, s.x, s.z, 12).d > 8.5); assert.ok(lakeE(s.x, s.z) > 1.5 && pisteD(s.x, s.z) > 11 && Math.hypot(s.x - F.plaza.x, s.z - F.plaza.z) > F.plaza.r + 6);
      assert.ok(M.SL.every(o => o === s || Math.hypot(o.x - s.x, o.z - s.z) >= 12.5)); assert.ok(Math.abs(M.h(s.x, s.z) - s.y) < 0.05, 'el solar está allanado')}}
});
ok('la vía es un ocho: se cruza a sí misma con 7 m de hueco por debajo y sin curvas demasiado cerradas', () => {
  for (let k = 0; k <= MAXSTAGE; k++) {const {T} = mapOf(k), far = Math.round(40 / T.ds); let crosses = 0, minR = 1e9;
    for (let i = 0; i < T.N; i += 2) for (let j = i + far; j < T.N; j += 2) {if (T.N - j + i < far) continue;
      if (Math.hypot(T.x[i] - T.x[j], T.z[i] - T.z[j]) < 5) {crosses++; assert.ok(Math.abs(T.y[i] - T.y[j]) > 7, `etapa ${k}: cruce sin hueco (${T.y[i].toFixed(1)} / ${T.y[j].toFixed(1)})`)}}
    for (let i = 0; i < T.N; i++) {const w = 8, da = Math.abs(((T.a[(i + w) % T.N] - T.a[(i - w + T.N) % T.N] + Math.PI * 3) % (Math.PI * 2)) - Math.PI); minR = Math.min(minR, 2 * w * T.ds / Math.max(da, 1e-6))}
    assert.ok(crosses > 0, `etapa ${k}: sin cruce`); assert.ok(minR > 10, `etapa ${k}: radio ${minR.toFixed(1)}`)}
});
ok('atM interpola posición, altura y rumbo a lo largo de la vía (y da la vuelta)', () => {
  const {T} = mapOf(2), a = atM(T, 10), b = atM(T, 10 + T.L);
  assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6); assert.ok(Math.hypot(atM(T, 11).x - a.x, atM(T, 11).z - a.z) > 0.9);
});

/* ---------- agujas ---------- */
ok('cada etapa tiene sus agujas: dos caminos distintos, con la salida a un lado y sin curvas cerradas ni cuestas', () => {
  [1, 2, 3, 3].forEach((n, k) => {const M = mapOf(k), {T} = M; assert.equal(M.forks.length, n); assert.equal(M.R.length, 1 << n);
    for (const f of M.forks) {const A = M.alts[f.f], B = M.R[1 << f.f], i0 = Math.round(B.alt[f.f] / B.ds); let minR = 1e9, far = 0;
      assert.equal(f.opts.length, 2); assert.notEqual(f.opts[0].n, f.opts[1].n); assert.ok(f.left === 0 || f.left === 1);
      for (let j = 0; j < A.N; j++) {const q = i0 + j, w = 8, da = Math.abs(((B.a[(q + w) % B.N] - B.a[(q - w + B.N) % B.N] + Math.PI * 3) % (Math.PI * 2)) - Math.PI); minR = Math.min(minR, 2 * w * B.ds / Math.max(da, 1e-6));
        assert.ok(Math.abs(Math.tan(B.p[q])) < 0.1, `${f.id} (etapa ${k}): cuesta de ${Math.tan(B.p[q]).toFixed(3)}`);
        assert.ok(A.x[j] > BOARD.x0 + 8 && A.x[j] < BOARD.x1 - 8 && A.z[j] > BOARD.z0 + 30 && A.z[j] < BOARD.z1 - 8);
        let d = 1e9; for (let i = A.i0; i <= A.i1; i += 2) d = Math.min(d, Math.hypot(T.x[i] - A.x[j], T.z[i] - A.z[j])); far = Math.max(far, d)}
      assert.ok(minR > 10, `${f.id} (etapa ${k}): radio ${minR.toFixed(1)}`); assert.ok(far > 18, `${f.id}: los dos caminos casi no se separan (${far.toFixed(1)} m)`)}});
});
ok('un ramal solo toca la vía principal en su aguja: si la cruza, es con hueco de sobra', () => {
  for (let k = 0; k <= MAXSTAGE; k++) {const M = mapOf(k), {T} = M; M.forks.forEach((f, q) => {const A = M.alts[q];
    for (let j = 0; j < A.N; j += 2) for (let i = 0; i < T.N; i += 2) {const s = i * T.ds, e = Math.min(j, A.N - j) * T.ds; if (e < 34 && (Math.abs(s - A.i0 * T.ds) < 50 || Math.abs(s - A.i1 * T.ds) < 50)) continue;
      if (Math.hypot(T.x[i] - A.x[j], T.z[i] - A.z[j]) < 5.5) assert.ok(Math.abs(T.y[i] - A.y[j]) > 6.5, `${f.id} (etapa ${k}) roza la vía en ${s.toFixed(0)}`)}})}
});
ok('todas las vueltas posibles son continuas y salen y llegan igual; antes de una aguja no cambian según lo que se vote en ella', () => {
  for (let k = 0; k <= MAXSTAGE; k++) {const M = mapOf(k);
    for (const R of M.R) {for (let i = 0; i < R.N; i++) {const j = (i + 1) % R.N, d = Math.hypot(R.x[j] - R.x[i], R.y[j] - R.y[i], R.z[j] - R.z[i]); assert.ok(d < R.ds * 1.25, `salto de ${d.toFixed(2)} en ${i}`)}
      assert.ok(Math.hypot(R.x[0] - M.T.x[0], R.z[0] - M.T.z[0]) < 1e-6);
      M.forks.forEach((f, q) => {const O = M.R[R.bits ^ (1 << q)]; assert.ok(Math.abs(R.fs[q] - O.fs[q]) < 1e-6); for (let s = 0; s < R.fs[q]; s += 5) {const a = atM(R, s), b = atM(O, s); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-3)}
        const a = atM(R, R.ms[q] + 3), b = atM(M.T, M.T.ms[q] + 3); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.6, `${f.id}: no se juntan (${Math.hypot(a.x - b.x, a.z - b.z).toFixed(2)})`)})}}
});
ok('cada casa sabe en qué vueltas pasa el tren por delante (las de un camino, solo si gana ese camino)', () => {
  for (let k = 0; k <= MAXSTAGE; k++) {const M = mapOf(k); let a = 0, b = 0;
    for (const s of M.SL) M.R.forEach((R, bits) => {const on = s.f < 0 || (bits >> s.f & 1) === s.side1; assert.equal(s.rs[bits] >= 0, on);
      if (on) {const p = atM(R, s.rs[bits]); assert.ok(Math.abs(Math.hypot(p.x - s.x, p.z - s.z) - 9.4) < 0.8, `etapa ${k}: ${Math.hypot(p.x - s.x, p.z - s.z).toFixed(1)} m`); a++} else b++});
    assert.ok(a && b)}
});

/* ---------- calendario, marcas y partida ---------- */
ok('el día sale del calendario: 1 a 24 en diciembre, 24 hasta Reyes y fuera de temporada, 0', () => {
  const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
  assert.equal(dayOf(at(2026, 11, 30)), 0); assert.equal(dayOf(at(2026, 12, 1)), 1); assert.equal(dayOf(at(2026, 12, 24)), 24); assert.equal(dayOf(at(2026, 12, 31)), 24); assert.equal(dayOf(at(2027, 1, 6)), 24); assert.equal(dayOf(at(2027, 1, 7)), 0);
  assert.equal(daysToEve(at(2026, 12, 23)), 1); assert.equal(daysToEve(at(2026, 12, 24)), 0); assert.ok(daysToEve(at(2026, 12, 25)) > 360); assert.equal(isoDay(at(2026, 12, 5)), '2026-12-05');
});
ok('cada día trae algo, el tren solo crece y en Nochebuena está completo', () => {
  let a = planOf(1); assert.equal(a.stage, 0); assert.equal(a.wagons, 3);
  for (let d = 2; d <= DAYS; d++) {assert.ok(PLAN[d], `día ${d} sin nada`); assert.ok(rewardText(d).length > 5); const b = planOf(d); for (const k of ['stage', 'wagons', 'lights', 'houses']) assert.ok(b[k] >= a[k], `${k} baja el día ${d}`);
    assert.ok(b.stage > a.stage || b.wagons > a.wagons || b.lights > a.lights || b.houses > a.houses); assert.ok(b.houses < mapOf(b.stage).SL.length, `día ${d}: sin hueco para tu casa`); a = b}
  assert.equal(a.stage, MAXSTAGE); assert.equal(a.wagons, WAGON_MAX); assert.equal(a.lights, MAXLIGHTS);
  for (const x of [0, -3, 'x', undefined]) assert.equal(planOf(x).day, 1); assert.equal(planOf(99).day, DAYS); assert.deepEqual(planOf(9), planOf(9));
});
ok('si no eliges camino, el tren va por el que menos ha ido y, si empatan, alterna', () => {
  assert.equal(autoRoute(['a', 'b'], {a: 3, b: 1}, 0), 1); assert.equal(autoRoute(['a', 'b'], {b: 2}, 1), 0); assert.equal(autoRoute(['a', 'b'], {}, 0), 1); assert.equal(autoRoute(['a', 'b'], {}, 1), 0);
});
ok('todos los caminos tienen nombre, descripción corta e icono propio', () => {
  for (let k = 0; k <= MAXSTAGE; k++) for (const f of mapOf(k).forks) for (const o of f.opts) {assert.ok(o.n && o.art && o.d && o.d.length <= 22, o.id); assert.match(o.id, /^[a-z]{2,12}$/)}
});
ok('las marcas salen solo en sus fechas y en un vagón que exista, y una línea mal escrita no rompe nada', () => {
  const L = [{vagon: 1, desde: '2026-12-05', hasta: '2026-12-06', texto: 'Panadería <b>Ogi</b>', url: 'panaderiaogi.es', img: 'm/marcas/ogi.png', fondo: '#1d3a78'}, {vagon: 2, desde: '2026-12-05', texto: 'Un día', fondo: 'rojo'}, {vagon: 7, desde: '2026-12-05', texto: 'Lejos'},
    {vagon: 3, desde: '2026-12-05', hasta: '2026-12-05', texto: '', img: 'https://otra.web/x.png'}, {vagon: 'x', desde: '2026-12-05', texto: 'mal'}, {vagon: 3, desde: 'ayer', texto: 'mal'}, null, 5, {vagon: 3, desde: '2026-12-05', texto: 'Enlace raro', url: 'javascript:alert(1)'}];
  const d5 = marcasDe(L, '2026-12-05', 5), d6 = marcasDe(L, '2026-12-06', 5);
  assert.deepEqual(Object.keys(d5), ['1', '2', '3']); assert.deepEqual(Object.keys(d6), ['1']); assert.deepEqual(marcasDe(L, '2026-12-07', 5), {}); assert.deepEqual(marcasDe(undefined, '2026-12-07'), {});
  assert.equal(d5[1].url, 'https://panaderiaogi.es/'); assert.equal(d5[1].img, 'm/marcas/ogi.png'); assert.ok(!/[<>]/.test(d5[1].text)); assert.equal(d5[1].tag, 'Patrocinado'); assert.equal(d5[2].bg, '#7a1020'); assert.equal(d5[3].url, ''); assert.equal(d5[3].text, 'Enlace raro');
});
ok('el fichero de marcas está bien escrito y la petición lleva los datos', () => {
  assert.ok(Array.isArray(MARCAS) && PRECIO_DIA > 0 && PRECIO_VAGON > 0); for (const m of MARCAS) assert.ok(Object.keys(marcasDe([m], m.desde)).length, 'línea que no sale nunca: ' + JSON.stringify(m));
  const t = askText({text: 'Ogi', sub: 'Roscón', url: 'https://ogi.es/', bg: '#1d3a78', img: 'x'}, 'dia', 5); for (const q of ['vagón del día', '5 €', 'Ogi', 'Roscón', 'https://ogi.es/', 'adjunto']) assert.ok(t.includes(q), q);
});
ok('el texto de los jugadores se limpia y se acota', () => {
  assert.equal(cleanText('  Ane  <b>\n</b> ', 14), 'Ane b /b'); assert.equal(cleanText('x'.repeat(40), 14).length, 14); assert.equal(cleanText(null, 5), '');
});
ok('el enlace de una marca solo vale si es una web (http o https) con dominio', () => {
  assert.equal(cleanUrl(''), ''); assert.equal(cleanUrl('  '), '');
  assert.equal(cleanUrl('tumarca.com'), 'https://tumarca.com/'); assert.equal(cleanUrl('instagram.com/tumarca'), 'https://instagram.com/tumarca');
  assert.equal(cleanUrl('http://bar-txoko.eus/carta?x=1'), 'http://bar-txoko.eus/carta?x=1');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hola', 'mailto:a@b.es', 'localhost:3000', 'https://intranet', 'https://user:pw@tumarca.com', 'https://' + 'a'.repeat(200) + '.com']) assert.equal(cleanUrl(bad), null, bad);
});
ok('el guardado solo lleva lo tuyo, y roto o manipulado no rompe la partida', () => {
  for (const bad of [null, '', '{', '[]', '"x"', '{"v":4}']) assert.equal(parseWorld(bad, 3), null);
  const w = parseWorld(JSON.stringify({v: 5, mine: 7, myName: '', total: -4, myGifts: 'x', chosen: 1e99, stage: 3, wagons: 99, day: 24, seen: {tunel: 2, 'x y': 4, valle: -1, __proto__: 5}}), 3);
  assert.equal(w.mine, -1); assert.equal(w.total, 0); assert.equal(w.myGifts, 0); assert.deepEqual(w.seen, {tunel: 2}); assert.equal(w.day, 3); assert.equal(w.stage, planOf(3).stage); assert.equal(w.wagons, planOf(3).wagons);
  const a = newWorld(9); a.mine = 0; a.myName = 'Jon'; a.total = 120; a.myGifts = 40; a.chosen = 6; a.seen = {bosque: 3, tunel: 1};
  assert.deepEqual(parseWorld(saveOf(a), 9), a); assert.ok(!/stage|wagons|houses|day/.test(saveOf(a)));
});

console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo OK');
process.exit(fails ? 1 : 0);
