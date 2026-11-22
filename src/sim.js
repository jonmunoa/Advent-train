/* Adviento Express · simulación compartida (navegador y Edge Function de Supabase).
   Solo depende de three para la curva del circuito. No toca el DOM ni WebGL.
   Si cambias este archivo, ejecuta `node scripts/sync-shared.mjs` para copiarlo a
   supabase/functions/_shared/sim.js (el e2e falla si difieren). */
import {CatmullRomCurve3, Vector3} from 'three';

/* ================= constantes de física ================= */
export const SEASON = 2026;
export const STEP = 0.5, VMAX = 30, ACC = 6.4, BRAKE = 9, HARD = 13, DRAG = 0.25, ALAT = 6.6, TAIL = 16;
export const PEN_GIFT = 2, SLIP_V = 0.75, SLIP_T = 0.7, BELL_BONUS = 0.5;
export const VS_CAP = 40; // tope del límite lateral: en recta no hay curva que frene, solo VMAX (o VTURBO con turbo)
/* turbo: se carga apurando curvas (cerca de vs sin pasarse) y da un empujón con el vapor pisado */
export const VTURBO = 35, TURBO_ACC = 9, TURBO_DUR = 2.5, TURBO_KICK = 4, TURBO_FILL = 3, VDECAY = 3;
export const turboCharging = (vsN, v) => vsN < 0.8 * VMAX && v >= 0.88 * vsN && v <= 1.03 * vsN;
export const STFR = [0.2, 0.52, 0.8];
export const GDT = 0.1, VQ = 0.15; // fantasma: una velocidad media cada 0,1 s, en pasos de 0,15 m/s
export const bellBonus = c => BELL_BONUS * Math.min(2, 1 + 0.25 * (c - 1));

/* ================= utilidades ================= */
export const rng = seed => () => {seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296};
export const wrapA = a => {while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a};
const lerp = (a, b, t) => a + (b - a) * t;
export const seedOf = d => d * 7919 + 11;

/* ================= circuitos ================= */
export const DAY1 = [[180, 300], [500, 190], [820, 300], [870, 600], [770, 900], [580, 870], [470, 1020], [220, 970], [130, 640]].map(([x, y]) => [(x - 500) * 0.32, (y - 600) * 0.32]);
export function trackPts(d, r) {
  if (d === 1) return DAY1;
  const n = 8 + Math.floor(r() * 5), R = 82 + r() * 30, sx = 0.9 + r() * 0.35, rot = r() * Math.PI * 2;
  let rad = Array.from({length: n}, () => R * (0.6 + 0.55 * r()));
  rad = rad.map((v, i) => 0.55 * v + 0.225 * (rad[(i + n - 1) % n] + rad[(i + 1) % n]));
  return rad.map((v, i) => {const th = (i + (r() - .5) * 0.45) / n * Math.PI * 2 + rot; return [Math.cos(th) * v * sx, Math.sin(th) * v]});
}
/* Samplea la Catmull-Rom cerrada cada STEP m: posición, rumbo, velocidad segura por curvatura (vs)
   y envolvente (ve): máximo para que morro y cola vayan bajo vs y dé tiempo a frenar soltando. */
export function buildTrack(pts) {
  const curve = new CatmullRomCurve3(pts.map(p => new Vector3(p[0], 0, p[1])), true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / STEP), sp = curve.getSpacedPoints(N), ds = L / N;
  const x = new Float32Array(N), z = new Float32Array(N), a = new Float32Array(N), vs0 = new Float32Array(N), vs = new Float32Array(N);
  for (let i = 0; i < N; i++) {x[i] = sp[i].x; z[i] = sp[i].z}
  for (let i = 0; i < N; i++) {const p = (i - 1 + N) % N, q = (i + 1) % N; a[i] = Math.atan2(z[q] - z[p], x[q] - x[p])}
  const w = Math.round(6 / ds); for (let i = 0; i < N; i++) {const k = Math.abs(wrapA(a[(i + w) % N] - a[(i - w + N) % N])) / (2 * w * ds); vs0[i] = Math.min(VS_CAP, Math.sqrt(ALAT / Math.max(k, 1e-5)))}
  const m = Math.round(8 / ds); for (let i = 0; i < N; i++) {let v = VS_CAP; for (let j = -m; j <= m; j += 2) v = Math.min(v, vs0[(i + j + N) % N]); vs[i] = v}
  const tl = Math.round(TAIL / ds), ve = new Float32Array(N); for (let i = 0; i < N; i++) ve[i] = Math.min(vs[i], vs[(i - tl + N) % N]);
  for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) {const j = (i + 1) % N; ve[i] = Math.min(ve[i], Math.sqrt(ve[j] * ve[j] + 2 * BRAKE * ds))}
  return {x, z, a, vs, ve, N, L, ds};
}
export const trackFor = d => buildTrack(trackPts(d, rng(seedOf(d))));
export const idxT = (T, s) => Math.floor((((s % T.L) + T.L) % T.L) / T.ds) % T.N;
export const atT = (T, s) => {s = ((s % T.L) + T.L) % T.L; const f = s / T.ds, i = Math.floor(f) % T.N, j = (i + 1) % T.N, t = f - Math.floor(f); return {x: lerp(T.x[i], T.x[j], t), z: lerp(T.z[i], T.z[j], t), a: T.a[i] + wrapA(T.a[j] - T.a[i]) * t}};
export const vsAtT = (T, s) => T.vs[idxT(T, s)];
export const veAtT = (T, s) => T.ve[idxT(T, s)];
/* velocidad límite de morro y cola: por encima de 1,03× sube el stress */
export const vsNow = (T, s) => Math.min(vsAtT(T, s), vsAtT(T, s - TAIL));
/* aceleración del vapor (más el turbo si está activo) */
export const accel = (v, on) => ACC * (1 - 0.5 * Math.min(v, VMAX) / VMAX) + (on ? TURBO_ACC : 0);
/* ¿merece la pena gastar el turbo aquí? Hay margen en la envolvente durante todo el empujón */
export function turboGood(T, s, v) {
  let m = VS_CAP; for (let d = 0; d <= 20; d += 2) m = Math.min(m, veAtT(T, s + d));
  return m >= v + TURBO_KICK + 1;
}
/* campanas: posición s y velocidad mínima para que suenen */
export function bellsFor(T) {
  const st = STFR.map(f => f * T.L), out = [], nb = Math.max(10, Math.round(T.L / 52));
  for (let i = 0; i < nb; i++) {
    const s = (i + 0.5) / nb * T.L; if (st.some(x => Math.abs(x - s) < 12) || s < 25 || s > T.L - 20) continue;
    let vm = VMAX; for (let q = -12; q <= 12; q += 2) vm = Math.min(vm, vsAtT(T, s + q));
    const kmh = Math.max(25, Math.floor(Math.min(19, vm * 0.88) * 3.6 / 5) * 5); out.push({s, v: kmh / 3.6, kmh});
  }
  return out;
}
export const curvesOf = T => {let n = 0, inC = false; for (let i = 0; i < T.N; i += 4) {const c = T.vs[i] < 15.5; if (c && !inC) n++; inC = c} return n};

/* ================= maquinista ideal (medallas) ================= */
export function medals(T, bells, {turbo = true} = {}) {
  let v = 9, dist = 0, t = 0, bonus = 0, combo = 0, bi = 0, tb = 0, tt = 0, nT = 0; const dt = 1 / 60; // «salida perfecta», siempre a la envolvente y turbo en cuanto renta
  for (let k = 0; k < 60000 && dist < T.L; k++) {
    if (turbo && tb >= 1 && tt <= 0 && turboGood(T, dist, v)) {tt = TURBO_DUR; tb = 0; v = Math.min(VTURBO, v + TURBO_KICK); nT++}
    const on = tt > 0, cap = on ? VTURBO : VMAX;
    if (v < Math.min(veAtT(T, dist), cap)) v = Math.min(cap, v + accel(v, on) * dt); else v -= BRAKE * dt;
    if (on) tt -= dt;
    v -= DRAG * dt; if (v > cap) v = Math.max(cap, v - VDECAY * dt); v = Math.max(0, v); dist += v * dt; t += dt;
    if (!on && turboCharging(vsNow(T, dist), v)) tb = Math.min(1, tb + dt / TURBO_FILL);
    while (bi < bells.length && dist >= bells[bi].s) {if (v >= bells[bi].v) {combo++; bonus += bellBonus(combo)} else combo = 0; bi++}
  }
  const ideal = t - bonus, r1 = x => Math.round(x * 10) / 10;
  return {ideal, turbos: nT, g: r1(ideal * MEDAL_K[0]), s: r1(ideal * MEDAL_K[1]), b: r1(ideal * MEDAL_K[2])};
}
export const MEDAL_K = [1.08, 1.22, 1.40];

/* ================= fantasma: codec v1 =================
   Cabecera: versión, temporada-2000, día, flags, nombre (UTF-8), tiempo bruto (ms),
   total declarado (ms), campanas, regalos perdidos, turbos, nº de muestras.
   Muestras: velocidad media de cada ventana de 0,1 s en pasos de VQ, en deltas zigzag
   (255 = escape seguido del valor absoluto). La última ventana puede ser parcial:
   dura raw − (n−1)·0,1 s. Todo va comprimido con deflate-raw y en base64url,
   con prefijo 'z' (comprimido) o 'r' (sin comprimir, navegadores sin CompressionStream). */
const u32 = x => [x & 255, (x >>> 8) & 255, (x >>> 16) & 255, (x >>> 24) & 255];
const rd32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const b64u = u8 => {let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')};
const ub64u = s => {s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u};
async function flate(u8, on) {const st = new Blob([u8]).stream().pipeThrough(on ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(st).arrayBuffer())}

export const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16);
export async function encodeGhost(g) {
  const name = new TextEncoder().encode(cleanName(g.name)).slice(0, 64), q = g.v.map(v => Math.max(0, Math.min(255, Math.round(v / VQ)))), n = q.length;
  const out = [1, (g.season || SEASON) - 2000, g.day, 0, name.length, ...name, ...u32(Math.round(g.raw * 1000)), ...u32(Math.round(g.total * 1000)), g.bells | 0, g.lost | 0, g.turbos | 0, n & 255, n >> 8];
  let prev = 0; for (const x of q) {const d = x - prev, zz = d >= 0 ? d * 2 : -d * 2 - 1; if (zz < 255) out.push(zz); else out.push(255, x); prev = x}
  const raw = Uint8Array.from(out);
  if (typeof CompressionStream === 'undefined') return 'r' + b64u(raw);
  return 'z' + b64u(await flate(raw, true));
}
export async function decodeGhost(code) {
  const kind = code[0]; let b = ub64u(code.slice(1));
  if (kind === 'z') b = await flate(b, false); else if (kind !== 'r') throw new Error('formato');
  if (b[0] !== 1) throw new Error('versión');
  let o = 5; const nl = b[4], name = new TextDecoder().decode(b.slice(o, o + nl)); o += nl;
  const g = {season: 2000 + b[1], day: b[2], name, raw: rd32(b, o) / 1000, total: rd32(b, o + 4) / 1000, bells: b[o + 8], lost: b[o + 9], turbos: b[o + 10]}; const n = b[o + 11] | b[o + 12] << 8; o += 13;
  const v = new Float32Array(n); let prev = 0;
  for (let i = 0; i < n; i++) {if (o >= b.length) throw new Error('corto'); const zz = b[o++]; let x; if (zz === 255) x = b[o++]; else x = prev + (zz & 1 ? -(zz + 1) / 2 : zz / 2); v[i] = x * VQ; prev = x}
  if (g.day < 1 || g.day > 24 || n < 2) throw new Error('datos');
  g.v = v; g.cum = ghostCum(v, g.raw); return g;
}
/* distancia acumulada al final de cada ventana: cum[0]=0 … cum[n] = distancia total */
export function ghostCum(v, raw) {
  const n = v.length, cum = new Float32Array(n + 1), last = Math.max(0, raw - (n - 1) * GDT);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + v[i] * (i === n - 1 ? last : GDT);
  return cum;
}
export function ghostDist(g, t) {const c = g.cum, n = c.length - 1, f = t / GDT, i = Math.floor(f); if (i >= n - 1) {const last = g.raw - (n - 1) * GDT; return i >= n || last <= 0 ? c[n] : lerp(c[n - 1], c[n], Math.min(1, (t - (n - 1) * GDT) / last))} return lerp(c[i], c[i + 1], f - i)}
export function ghostTime(g, d) {
  const c = g.cum, n = c.length - 1; if (d >= c[n]) return g.raw; let lo = 0, hi = n;
  while (hi - lo > 1) {const m = (lo + hi) >> 1; if (c[m] < d) lo = m; else hi = m}
  const f = c[hi] === c[lo] ? 0 : (d - c[lo]) / (c[hi] - c[lo]), dur = hi === n ? g.raw - (n - 1) * GDT : GDT;
  return lo * GDT + f * dur;
}

/* ================= validación antitrampas =================
   Repite la carrera a partir del fantasma: cinemática muestra a muestra, distancia,
   campanas, regalos perdidos y total. El servidor guarda SU total, no el declarado. */
/* ¿está abierta la puerta `day` en `now` (hora de Madrid)? La 1 se abre ya en noviembre para calentar. */
export function dayOpen(day, now = new Date(), season = SEASON) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now).split('-').map(Number);
  if (y > season) return true;
  if (y < season) return false;
  return m === 12 ? d >= day : day === 1 && m >= 11;
}
export function validateRun(g, {now = new Date(), season = SEASON, allowAnyDay = false} = {}) {
  const errs = [], fail = e => {if (!errs.includes(e)) errs.push(e)};
  if (g.season !== season) fail('temporada');
  if (!allowAnyDay && !dayOpen(g.day, now, season)) fail('día cerrado');
  if (!cleanName(g.name)) fail('nombre');
  const v = g.v, n = v.length, last = g.raw - (n - 1) * GDT;
  if (!(n >= 20 && last > 0 && last <= GDT + 0.002)) {fail('duración'); return {ok: false, errs}}
  const T = trackFor(g.day), bells = bellsFor(T), dur = i => i === n - 1 ? last : GDT;
  const tolV = 2 * VQ, upN = (ACC + 0.05) * GDT + tolV, upT = (ACC + TURBO_ACC + 0.05) * GDT + tolV, down = (HARD + DRAG + 0.05) * GDT + tolV;
  let dist = 0, above = 0, boost = 0, kicks = 0, drops = 0, charge = 0, stress = 0, lost = 0, combo = 0, bonus = 0, hits = 0, bi = 0;
  for (let i = 0; i < n; i++) {
    const vi = v[i], dt = dur(i), dv = i ? vi - v[i - 1] : Math.max(0, vi - 9); // la salida perfecta arranca a 9 m/s
    if (vi < 0 || vi > VTURBO + VQ) fail('velocidad');
    if (vi > VMAX + VQ) above += dt;
    if (dv > upN) {if (dv <= upT) boost += GDT; else if (dv <= upT + TURBO_KICK) kicks++; else fail('aceleración')}
    if (dv < -down) drops++;
    const vs = vsNow(T, dist);
    if (turboCharging(vs, vi)) charge += dt;
    const over = vi / vs - 1; if (over > 0.03) stress += over * 3.6 * dt; else stress = Math.max(0, stress - dt);
    if (stress >= 1) {lost++; stress = 0.4}
    const d2 = dist + vi * dt;
    while (bi < bells.length && d2 >= bells[bi].s) {if (vi >= bells[bi].v - VQ) {combo++; hits++; bonus += bellBonus(combo)} else combo = 0; bi++}
    dist = d2;
  }
  const maxTurbos = Math.floor(charge / TURBO_FILL) + 1, slack = TURBO_DUR + (VTURBO - VMAX) / VDECAY;
  if (g.turbos > maxTurbos) fail('turbos');
  if (above > g.turbos * slack + 0.5) fail('tiempo con turbo');
  if (boost > g.turbos * (TURBO_DUR + GDT) + 0.5) fail('aceleración con turbo');
  if (kicks > 2 * g.turbos + 1) fail('empujones');
  if (drops > 2 * g.lost + 2) fail('frenazos');
  if (g.lost < lost - 1) fail('regalos');
  if (dist < T.L - 1) fail('distancia');
  if (g.bells > hits + 1) fail('campanas');
  const total = g.raw + PEN_GIFT * g.lost - bonus, ideal = medals(T, bells).ideal;
  if (g.total < total - 1) fail('total');
  if (total < ideal * 0.97) fail('imposible');
  return {ok: errs.length === 0, errs, total, bells: hits, lost: g.lost, dist, ideal};
}
