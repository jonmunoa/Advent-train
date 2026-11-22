// Pruebas de la validación antitrampas y de la Edge Function submit-run, sin navegador.
//   npm i && node tests/edge.test.mjs
// Simula carreras con la misma física que race() en src/main.js, las codifica como fantasma,
// las valida y las envía al handler con un PostgREST en memoria.
import {strict as assert} from 'node:assert';
import {
  routesFor, vsNow, veAtT, envelope, accel, turboCharging, turboGood, bellBonus, encodeGhost, decodeGhost, validateRun, dayOpen, medalsFor,
  VMAX, VTURBO, BRAKE, VDECAY, TURBO_DUR, TURBO_KICK, PEN_GIFT, SLIP_T, SLIP_V, GDT, SEASON, DROP_TOL, DROP_BONUS, F_SHORTCUT,
} from '../supabase/functions/_shared/sim.js';
import {makeHandler} from '../supabase/functions/submit-run/handler.js';

let fails = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => console.log('  ok   ' + name), e => {fails++; console.log('  FALLO ' + name + '\n        ' + e.message)});

/* carrera simulada con la física del juego (60 Hz): ruta, reparto, turbo, regalos y campanas */
function simulateRun(day, {k = 0.97, turbo = true, overspeed = false, name = 'Bot', route = 0, deliver = true} = {}) {
  const R = routesFor(day)[route], {T, bells, drops} = R, P = T.phys, env = deliver && drops.length ? envelope(T, drops) : T.ve, dt = 1 / 60, gv = [];
  let v = 9, dist = 0, t = 0, tb = 0, tt = 0, turbos = 0, stress = 0, slip = 0, lost = 0, bonus = 0, combo = 0, bi = 0, di = 0, hits = 0, nd = 0, gAcc = 0, gLast = 0;
  while (dist < T.L) {
    t += dt;
    if (turbo && tb >= 1 && tt <= 0 && turboGood(T, dist, v, env)) {tt = TURBO_DUR; tb = 0; turbos++; v = Math.min(VTURBO, v + TURBO_KICK)}
    const on = tt > 0, cap = on ? VTURBO : VMAX, thr = overspeed || v < Math.min(veAtT(T, dist, env), cap) * k;
    if (slip > 0) slip -= dt;
    if (thr) {if (slip <= 0 && v < cap) v = Math.min(cap, v + accel(v, on, P) * dt)} else v -= BRAKE * dt;
    if (on) tt -= dt;
    v -= P.drag * dt; if (v > cap) v = Math.max(cap, v - VDECAY * dt); v = Math.max(0, v);
    dist += v * dt; gAcc += dt; while (gAcc >= GDT) {gAcc -= GDT; const dB = dist - v * gAcc; gv.push((dB - gLast) / GDT); gLast = dB}
    const vs = vsNow(T, dist), over = v / vs - 1;
    if (!(tt > 0) && tb < 1 && turboCharging(vs, v)) tb = Math.min(1, tb + dt / P.fill);
    if (over > 0.03) stress += over * 3.6 * dt; else stress = Math.max(0, stress - dt);
    if (stress >= 1) {lost++; tb = 0; tt = 0; slip = SLIP_T; stress = 0.4; v = Math.min(v, vs * SLIP_V)}
    while (bi < bells.length && dist >= bells[bi].s) {if (v >= bells[bi].v) {combo++; hits++; bonus += bellBonus(combo)} else combo = 0; bi++}
    while (di < drops.length && dist >= drops[di].s) {if (v <= drops[di].v + DROP_TOL) {nd++; bonus += DROP_BONUS} di++}
  }
  if (gAcc > 1e-4) gv.push((dist - gLast) / gAcc);
  return {day, name, raw: t, total: t + PEN_GIFT * lost - bonus, bells: hits, drops: nd, lost, turbos, flags: route ? F_SHORTCUT : 0, v: gv};
}
const roundTrip = async run => decodeGhost(await encodeGhost(run));
const opts = {allowAnyDay: true};

console.log('validación');
const days = [1, 5, 9, 14, 19, 24], clean = {};
for (const d of days) clean[d] = simulateRun(d);
await ok('con atajo (día 13), la carrera por la ruta corta también pasa', async () => {
  const run = simulateRun(13, {route: 1}), r = validateRun(await roundTrip(run), opts); assert.ok(r.ok && r.route === 'atajo', String(r.errs)); assert.ok(run.drops >= 1, 'reparte');
});
await ok('declarar el atajo en un día sin agujas se rechaza', async () => {
  const r = validateRun(await roundTrip({...clean[5], flags: F_SHORTCUT}), opts); assert.ok(!r.ok, 'debería fallar');
});
await ok('declarar repartos que no se hicieron se rechaza', async () => {
  const run = simulateRun(14, {deliver: false}), r = validateRun(await roundTrip({...run, drops: 3, total: run.total - 6}), opts); assert.ok(r.errs.includes('repartos'), String(r.errs));
});
await ok('el maquinista simulado reparte y queda cerca del ideal', () => {
  for (const d of days) {const m = medalsFor(d); assert.ok(clean[d].total < m.g + 1.5, `día ${d}: ${clean[d].total.toFixed(1)} frente a oro ${m.g}`)}
});
await ok('carreras limpias de 6 días pasan la validación', async () => {
  for (const d of days) {const g = await roundTrip(clean[d]), r = validateRun(g, opts); assert.ok(r.ok, `día ${d}: ${r.errs}`); assert.ok(Math.abs(r.total - clean[d].total) < 1, `día ${d}: total ${r.total} vs ${clean[d].total}`)}
});
await ok('una carrera a fondo (con regalos perdidos) también pasa si los declara', async () => {
  const run = simulateRun(1, {overspeed: true}); assert.ok(run.lost >= 2, 'debería perder regalos');
  const r = validateRun(await roundTrip(run), opts); assert.ok(r.ok, String(r.errs));
});
await ok('esconder regalos perdidos se detecta', async () => {
  const run = simulateRun(1, {overspeed: true}); const r = validateRun(await roundTrip({...run, lost: 0, total: run.total - PEN_GIFT * run.lost}), opts);
  assert.ok(!r.ok && (r.errs.includes('regalos') || r.errs.includes('frenazos')), String(r.errs));
});
await ok('declarar un total 5 s mejor se rechaza', async () => {
  const r = validateRun(await roundTrip({...clean[1], total: clean[1].total - 5}), opts); assert.deepEqual(r.errs, ['total']);
});
await ok('inflar las campanas se rechaza', async () => {
  const r = validateRun(await roundTrip({...clean[5], bells: clean[5].bells + 4}), opts); assert.ok(r.errs.includes('campanas'), String(r.errs));
});
await ok('un pico de velocidad se rechaza', async () => {
  const v = [...clean[9].v]; v[120] += 9; const r = validateRun(await roundTrip({...clean[9], v}), opts); assert.ok(!r.ok, 'debería fallar');
});
await ok('ir siempre por encima de VMAX sin turbos se rechaza', async () => {
  const v = clean[14].v.map(x => Math.min(VTURBO, x * 1.12)); const r = validateRun(await roundTrip({...clean[14], v, turbos: 0}), opts); assert.ok(!r.ok, 'debería fallar');
});
await ok('recortar el recorrido se rechaza', async () => {
  const n = Math.floor(clean[19].v.length * 0.9), v = clean[19].v.slice(0, n), raw = n * GDT;
  const r = validateRun(await roundTrip({...clean[19], v, raw, total: raw - 5}), opts); assert.ok(r.errs.includes('distancia'), String(r.errs));
});
await ok('acelerar con turbo sin haberlo cargado se rechaza', async () => {
  const run = simulateRun(24, {turbo: false}), v = [...run.v]; for (let i = 0; i < v.length; i++) if (i && v[i] > v[i - 1]) v[i] = Math.min(VMAX, v[i - 1] + (v[i] - v[i - 1]) * 2.4);
  const r = validateRun(await roundTrip({...run, v, turbos: 0}), opts); assert.ok(!r.ok, 'debería fallar: ' + r.errs);
});
await ok('puertas: la 1 se abre en noviembre, la 2 no hasta el 2 de diciembre', () => {
  assert.ok(dayOpen(1, new Date('2026-11-22T12:00:00Z')));
  assert.ok(!dayOpen(2, new Date('2026-11-22T12:00:00Z')));
  assert.ok(!dayOpen(2, new Date('2026-12-01T22:30:00Z')), '23:30 en Madrid del día 1');
  assert.ok(dayOpen(2, new Date('2026-12-01T23:30:00Z')), '00:30 en Madrid del día 2');
});
await ok('una carrera de un día cerrado se rechaza sin allowAnyDay', async () => {
  const r = validateRun(await roundTrip(clean[5]), {now: new Date('2026-12-02T10:00:00Z')}); assert.ok(r.errs.includes('día cerrado'), String(r.errs));
});

console.log('submit-run');
/* PostgREST en memoria: lo justo para las llamadas del handler */
function fakeDb() {
  const rows = [], members = []; let seq = 0;
  const parse = url => {const u = new URL(url), f = {}; for (const [k, v] of u.searchParams) if (!['select', 'on_conflict'].includes(k)) {const [op, val] = v.split(/\.(.*)/s); f[k] = [op, val]} return {path: u.pathname, f}};
  const match = (r, f) => Object.entries(f).every(([k, [op, val]]) => op === 'eq' ? String(r[k]) === val : op === 'lt' ? r[k] < +val : true);
  const fetch = async (url, init = {}) => {
    const {f} = parse(url), m = init.method || 'GET', H = init.headers || {};
    assert.equal(H.apikey, 'service', 'usa la service role');
    if (m === 'GET') {const res = rows.filter(r => match(r, f)); if (H.Prefer === 'count=exact') return new Response('[]', {headers: {'content-range': res.length ? `0-0/${res.length}` : '*/0'}}); return new Response(JSON.stringify(res))}
    const body = JSON.parse(init.body);
    if (m === 'POST' && url.includes('/league_members')) {for (const x of body) if (!members.some(y => y.league === x.league && y.device_hash === x.device_hash)) members.push(x); return new Response(null, {status: 201})}
    if (m === 'POST') {let r = rows.find(x => x.season === body.season && x.day === body.day && x.device_hash === body.device_hash); if (r) Object.assign(r, body); else rows.push(r = {id: ++seq, ...body}); return new Response(JSON.stringify([r]), {status: 201})}
    if (m === 'PATCH') {rows.filter(r => match(r, f)).forEach(r => Object.assign(r, body)); return new Response(null, {status: 204})}
  };
  return {rows, members, fetch};
}
let clock = new Date('2026-12-05T10:00:00Z');
const env = {SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', RUN_SALT: 'sal', ALLOWED_ORIGINS: 'https://adviento.test', SEASON: String(SEASON)};
const DB = fakeDb(), handle = makeHandler({env, fetch: DB.fetch, now: () => clock});
const post = (body, origin = 'https://adviento.test') => handle(new Request('http://fn.test/submit-run', {method: 'POST', headers: {origin, 'content-type': 'application/json'}, body: JSON.stringify(body)}));
const dev1 = '11111111-2222-4333-8444-555555555555', dev2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const code1 = await encodeGhost({...clean[1], name: 'Ane'});

await ok('CORS: preflight y origen no permitido', async () => {
  const p = await handle(new Request('http://fn.test/submit-run', {method: 'OPTIONS', headers: {origin: 'https://adviento.test'}}));
  assert.equal(p.headers.get('access-control-allow-origin'), 'https://adviento.test');
  assert.equal((await post({ghost: code1, device: dev1}, 'https://malo.test')).status, 403);
});
await ok('rechaza entradas mal formadas', async () => {
  assert.equal((await post({ghost: 'xx', device: dev1})).status, 400);
  assert.equal((await post({ghost: code1, device: 'yo'})).status, 400);
  assert.equal((await post({ghost: 'zAAAA', device: dev1})).status, 400);
});
await ok('guarda una carrera válida con el total del servidor y la posición', async () => {
  const r = await post({ghost: code1, device: dev1}), j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.rank, 1); assert.ok(j.mejor);
  const row = DB.rows[0]; assert.equal(row.name, 'Ane'); assert.equal(row.day, 1); assert.ok(Math.abs(row.total_ms / 1000 - clean[1].total) < 1); assert.ok(!('device' in row) && row.device_hash.length === 64);
});
await ok('límite de un envío cada 10 s por dispositivo', async () => {
  clock = new Date(clock.getTime() + 3000);
  assert.equal((await post({ghost: code1, device: dev1})).status, 429);
});
await ok('una carrera peor no pisa la marca ni el fantasma', async () => {
  clock = new Date(clock.getTime() + 20000);
  const worse = await encodeGhost({...simulateRun(1, {k: 0.85}), name: 'Ane'}), before = DB.rows[0].ghost;
  const j = await (await post({ghost: worse, device: dev1})).json();
  assert.equal(j.mejor, false); assert.equal(DB.rows[0].ghost, before); assert.equal(DB.rows.length, 1);
});
await ok('otro dispositivo más lento queda segundo', async () => {
  const slow = await encodeGhost({...simulateRun(1, {k: 0.85}), name: 'Leire'});
  const j = await (await post({ghost: slow, device: dev2})).json();
  assert.equal(j.rank, 2); assert.equal(DB.rows.length, 2);
});
await ok('una carrera manipulada devuelve 422 con los motivos', async () => {
  clock = new Date(clock.getTime() + 20000);
  const bad = await encodeGhost({...clean[1], name: 'Trampas', total: clean[1].total - 6});
  const r = await post({ghost: bad, device: dev2}), j = await r.json();
  assert.equal(r.status, 422); assert.ok(j.motivos.includes('total'));
});
await ok('las ligas válidas se apuntan y las inválidas se ignoran', async () => {
  clock = new Date(clock.getTime() + 20000);
  const g = await encodeGhost({...simulateRun(1, {k: 0.8}), name: 'Leire'});
  const r = await post({ghost: g, device: dev2, leagues: ['fam123', 'MAL', 'fam123', 'trab99', 7]});
  assert.equal(r.status, 200);
  assert.deepEqual(DB.members.map(m => m.league).sort(), ['fam123', 'trab99']);
  assert.ok(DB.members.every(m => m.device_hash.length === 64));
});
await ok('un día que aún no se ha abierto devuelve 422', async () => {
  const later = await encodeGhost({...clean[24], name: 'Ane'});
  const j = await (await post({ghost: later, device: dev1})).json(); assert.ok(j.motivos && j.motivos.includes('día cerrado'), JSON.stringify(j));
});

console.log(fails ? `FALLO (${fails})` : 'OK');
process.exit(fails ? 1 : 0);
