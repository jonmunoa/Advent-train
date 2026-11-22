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
/* reparto: pasar por la parada a ≤ DROP_KMH lanza un regalo a la chimenea y descuenta DROP_BONUS */
export const DROP_KMH = 40, DROP_V = DROP_KMH / 3.6, DROP_TOL = 0.3, DROP_BONUS = 2;
/* rebufo: ir entre DRAFT_MIN y DRAFT_MAX m detrás del fantasma carga el turbo (DRAFT_RATE de la carga normal, también en recta) */
export const DRAFT_MIN = 3, DRAFT_MAX = 16, DRAFT_RATE = 0.6;
export const STFR = [0.2, 0.52, 0.8];
export const GDT = 0.1, VQ = 0.15; // fantasma: una velocidad media cada 0,1 s, en pasos de 0,15 m/s
export const bellBonus = c => BELL_BONUS * Math.min(2, 1 + 0.25 * (c - 1));

/* ================= modificadores por día (el nombre de la puerta es la mecánica) ================= */
export const MODS = {3: 'hielo', 19: 'hielo', 11: 'ventisca', 17: 'ventisca', 14: 'tunel', 23: 'noche', 24: 'noche', 12: 'viento', 22: 'viento'};
export const MOD_INFO = {
  hielo: {n: 'Hielo', t: 'Hay tramos helados: en ellos las curvas aguantan menos.'},
  ventisca: {n: 'Ventisca', t: 'Viento de cara y poca visibilidad: cuesta más acelerar.'},
  tunel: {n: 'Túnel', t: 'Un túnel a oscuras: dentro solo te alumbra el faro.'},
  noche: {n: 'Noche cerrada', t: 'Casi sin luz: guíate por las farolas y las señales.'},
  viento: {n: 'Viento de cola', t: 'El viento empuja: el turbo se carga antes.'},
};
export const modOf = d => MODS[d] || null;
export const ICE_K = 0.8;
export const physOf = mod => ({drag: mod === 'ventisca' ? 0.6 : DRAG, acc: mod === 'ventisca' ? 0.92 : mod === 'viento' ? 1.04 : 1, fill: mod === 'viento' ? 2 : TURBO_FILL});
/* agujas: estos días tienen un atajo (más corto, más cerrado y sin algunas campanas) */
export const SHORTCUT_DAYS = [6, 8, 9, 13, 16, 20, 21, 24];

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
/* A partir de muestras equiespaciadas (circuito cerrado): rumbo, velocidad segura por curvatura (vs)
   y envolvente (ve): máximo para que morro y cola vayan bajo vs y dé tiempo a frenar soltando. */
function fromSamples(x, z, L, mod, ice) {
  const N = x.length, ds = L / N, a = new Float32Array(N), vs0 = new Float32Array(N), vs = new Float32Array(N);
  for (let i = 0; i < N; i++) {const p = (i - 1 + N) % N, q = (i + 1) % N; a[i] = Math.atan2(z[q] - z[p], x[q] - x[p])}
  const w = Math.round(6 / ds); for (let i = 0; i < N; i++) {const k = Math.abs(wrapA(a[(i + w) % N] - a[(i - w + N) % N])) / (2 * w * ds); vs0[i] = Math.min(VS_CAP, Math.sqrt(ALAT / Math.max(k, 1e-5)))}
  if (mod === 'hielo' && !ice) ice = iceZones(vs0, ds, L);
  for (const [s0, s1] of ice || []) for (let i = Math.floor(s0 / ds); i <= Math.ceil(s1 / ds); i++) vs0[(i + N) % N] *= ICE_K;
  const m = Math.round(8 / ds); for (let i = 0; i < N; i++) {let v = VS_CAP; for (let j = -m; j <= m; j += 2) v = Math.min(v, vs0[(i + j + N) % N]); vs[i] = v}
  const T = {x, z, a, vs, ve: null, N, L, ds, mod, phys: physOf(mod), ice: ice || []};
  T.ve = envelope(T, []);
  return T;
}
/* envolvente con restricciones puntuales extra (p. ej. paradas de reparto): [{s, v}] */
export function envelope(T, pts) {
  const {N, ds, vs} = T, tl = Math.round(TAIL / ds), ve = new Float32Array(N);
  for (let i = 0; i < N; i++) ve[i] = Math.min(vs[i], vs[(i - tl + N) % N]);
  for (const p of pts) for (let i = Math.floor((p.s - 3) / ds); i <= Math.floor((p.s + 3) / ds); i++) {const k = (i + N) % N; ve[k] = Math.min(ve[k], p.v)} // zona de ±3 m
  for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) {const j = (i + 1) % N; ve[i] = Math.min(ve[i], Math.sqrt(ve[j] * ve[j] + 2 * BRAKE * ds))}
  return ve;
}
/* hielo: dos curvas de la vuelta (la 2.ª y la 4.ª más cerradas) se congelan ±25 m */
function iceZones(vs0, ds, L) {
  const N = vs0.length, mins = [];
  for (let i = 0; i < N; i += 4) {const v = vs0[i]; if (i * ds > 55 && i * ds < L - 55 && v < 16 && v <= vs0[(i + 8) % N] && v <= vs0[(i - 8 + N) % N] && !mins.some(m => Math.abs(m.s - i * ds) < 60)) mins.push({s: i * ds, v})}
  mins.sort((p, q) => p.v - q.v);
  return [mins[1], mins[3]].filter(Boolean).map(m => [Math.max(30, m.s - 25), Math.min(L - 30, m.s + 25)]);
}
export function buildTrack(pts, mod = null) {
  const curve = new CatmullRomCurve3(pts.map(p => new Vector3(p[0], 0, p[1])), true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / STEP), sp = curve.getSpacedPoints(N);
  const x = new Float32Array(N), z = new Float32Array(N); for (let i = 0; i < N; i++) {x[i] = sp[i].x; z[i] = sp[i].z}
  return fromSamples(x, z, L, mod);
}
const trackCache = {};
export const trackFor = d => trackCache[d] || (trackCache[d] = buildTrack(trackPts(d, rng(seedOf(d))), modOf(d)));
export const idxT = (T, s) => Math.floor((((s % T.L) + T.L) % T.L) / T.ds) % T.N;
export const atT = (T, s) => {s = ((s % T.L) + T.L) % T.L; const f = s / T.ds, i = Math.floor(f) % T.N, j = (i + 1) % T.N, t = f - Math.floor(f); return {x: lerp(T.x[i], T.x[j], t), z: lerp(T.z[i], T.z[j], t), a: T.a[i] + wrapA(T.a[j] - T.a[i]) * t}};
export const vsAtT = (T, s) => T.vs[idxT(T, s)];
export const veAtT = (T, s, env) => (env || T.ve)[idxT(T, s)];
/* velocidad límite de morro y cola: por encima de 1,03× sube el stress */
export const vsNow = (T, s) => Math.min(vsAtT(T, s), vsAtT(T, s - TAIL));
/* aceleración del vapor (más el turbo si está activo); P = física del día */
export const accel = (v, on, P = physOf(null)) => ACC * P.acc * (1 - 0.5 * Math.min(v, VMAX) / VMAX) + (on ? TURBO_ACC : 0);
/* ¿merece la pena gastar el turbo aquí? Hay margen en la envolvente en los próximos 20 m */
export function turboGood(T, s, v, env) {
  let m = VS_CAP; for (let d = 0; d <= 20; d += 2) m = Math.min(m, veAtT(T, s + d, env));
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
/* paradas de reparto: en tramos rápidos (frenar cuesta), lejos de estaciones, campanas y meta */
export function dropsFor(T, bells) {
  const st = STFR.map(f => f * T.L), out = [];
  for (const f of [0.12, 0.45, 0.7]) {
    let best = null;
    for (let s = (f - 0.1) * T.L; s <= (f + 0.1) * T.L; s += 2) {
      if (s < 40 || s > T.L - 40 || st.some(x => Math.abs(x - s) < 22) || bells.some(b => Math.abs(b.s - s) < 16) || out.some(o => Math.abs(o.s - s) < 70)) continue;
      let vm = VS_CAP; for (let q = -12; q <= 12; q += 3) vm = Math.min(vm, vsAtT(T, s + q));
      if (vm >= 15 && (!best || Math.abs(s - f * T.L) < Math.abs(best - f * T.L))) best = s;
    }
    if (best !== null) out.push({s: best, v: DROP_V, kmh: DROP_KMH});
  }
  return out.sort((p, q) => p.s - q.s);
}
export const curvesOf = T => {let n = 0, inC = false; for (let i = 0; i < T.N; i += 4) {const c = T.vs[i] < 15.5; if (c && !inC) n++; inC = c} return n};

/* ================= agujas: ruta con atajo =================
   El atajo sale del circuito en s=a y vuelve en s=b por una cuerda más corta. La ruta con
   atajo es otro circuito cerrado (muestras del principal hasta a, el atajo y del principal desde b).
   Las posiciones del principal se pasan a la ruta con mapS: antes de a igual, dentro del tramo
   saltado no existen y después se desplazan delta = Ls − (b − a). */
export const TREE_MIN = 24; // radio mínimo del árbol gigante: con atajo, el árbol encoge para dejarle sitio
function shortcutFor(T, d) {
  if (!SHORTCUT_DAYS.includes(d)) return null;
  let cx = 0, cz = 0; for (let i = 0; i < T.N; i += 10) {cx += T.x[i]; cz += T.z[i]} cx /= Math.ceil(T.N / 10); cz /= Math.ceil(T.N / 10);
  const tc = [cx * 0.3, cz * 0.3], clear = TREE_MIN + 14, P = s => atT(T, s);
  let pick = null;
  // sale después de la 1.ª estación y vuelve antes de la 3.ª: puede saltarse la del medio (y su recarga de regalos)
  for (let f = 0.22; f <= 0.5 && !pick; f += 0.02) for (const span of [0.34, 0.3, 0.38, 0.26, 0.42]) {
    const a = f * T.L, b = a + span * T.L; if (a < STFR[0] * T.L + 22 || b > STFR[2] * T.L - 22) continue;
    const pa = P(a), pb = P(b), c = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    if (c < 40 || c > 0.86 * (b - a)) continue;
    // Bézier cúbica con la tangente de la vía en los dos empalmes (sin quiebros en las agujas)
    const k3 = c * 0.38, c1 = [pa.x + Math.cos(pa.a) * k3, pa.z + Math.sin(pa.a) * k3], c2 = [pb.x - Math.cos(pb.a) * k3, pb.z - Math.sin(pb.a) * k3];
    const sub = []; for (let k = 0; k <= 240; k++) {const t = k / 240, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t; sub.push(new Vector3(w0 * pa.x + w1 * c1[0] + w2 * c2[0] + w3 * pb.x, 0, w0 * pa.z + w1 * c1[1] + w2 * c2[1] + w3 * pb.z))}
    if (sub.some(p => Math.hypot(p.x - tc[0], p.z - tc[1]) < clear)) continue;
    pick = {a, b, sub}; break;
  }
  if (!pick) return null;
  const ia = Math.round(pick.a / T.ds), ib = Math.round(pick.b / T.ds), aS = ia * T.ds, bS = ib * T.ds;
  const fine = pick.sub.map(p => [p.x, p.z]), cl = [0]; for (let k = 1; k < fine.length; k++) cl.push(cl[k - 1] + Math.hypot(fine[k][0] - fine[k - 1][0], fine[k][1] - fine[k - 1][1]));
  const Ls = cl[cl.length - 1], ns = Math.max(2, Math.round(Ls / STEP)), mid = [];
  for (let k = 0, q = 0; k < ns; k++) {const t = k * Ls / ns; while (q < cl.length - 2 && cl[q + 1] < t) q++; const u = (t - cl[q]) / Math.max(1e-6, cl[q + 1] - cl[q]); mid.push([lerp(fine[q][0], fine[q + 1][0], u), lerp(fine[q][1], fine[q + 1][1], u)])}
  const xs = [], zs = [];
  for (let i = 0; i < ia; i++) {xs.push(T.x[i]); zs.push(T.z[i])}
  for (const [x, z] of mid) {xs.push(x); zs.push(z)}
  for (let i = ib; i < T.N; i++) {xs.push(T.x[i]); zs.push(T.z[i])}
  const L2 = aS + Ls + (T.L - bS), delta = Ls - (bS - aS);
  const mapS = s => s < aS ? s : s < bS ? null : s + delta;
  const ice = T.ice.map(([s0, s1]) => [mapS(s0), mapS(s1)]).filter(([s0, s1]) => s0 !== null && s1 !== null);
  const T2 = fromSamples(Float32Array.from(xs), Float32Array.from(zs), L2, T.mod, ice);
  let vmin = VS_CAP; for (let x = aS; x < aS + Ls; x += 1) vmin = Math.min(vmin, vsAtT(T2, x));
  if (vmin < 8) return null; // demasiado cerrado para un tren
  return {a: aS, b: bS, Ls, delta, mapS, T: T2, pts: mid, vmin};
}
/* rutas del día: la principal y, si hay agujas, la del atajo, con sus campanas y paradas */
const routeCache = {};
export function routesFor(d) {
  if (routeCache[d]) return routeCache[d];
  const T = trackFor(d), bells = bellsFor(T), drops = dropsFor(T, bells), sc = shortcutFor(T, d);
  const R = [{name: 'principal', T, bells, drops, sc: null}];
  if (sc) {
    const mapL = l => l.map(o => ({...o, s0: o.s, s: sc.mapS(o.s)})).filter(o => o.s !== null), T2 = sc.T;
    // el atajo tiene su propio contenido: campanas a lo largo de la cuerda y una parada si se salta alguna
    const sp = T.L / Math.max(10, Math.round(T.L / 52)), own = [];
    for (let s = sc.a + sp * 0.6; s < sc.a + sc.Ls - 20; s += sp) {let vm = VMAX; for (let q = -12; q <= 12; q += 2) vm = Math.min(vm, vsAtT(T2, s + q)); const kmh = Math.max(25, Math.floor(Math.min(19, vm * 0.88) * 3.6 / 5) * 5); own.push({s, v: kmh / 3.6, kmh, atajo: true})}
    const b2 = [...mapL(bells), ...own].sort((p, q) => p.s - q.s), d2 = mapL(drops);
    if (d2.length < drops.length) {const s = sc.a + sc.Ls / 2; if (!b2.some(o => Math.abs(o.s - s) < 16)) d2.push({s, v: DROP_V, kmh: DROP_KMH, atajo: true})}
    R.push({name: 'atajo', T: T2, bells: b2, drops: d2.sort((p, q) => p.s - q.s), sc});
  }
  return routeCache[d] = R;
}

/* ================= maquinista ideal (medallas) ================= */
/* conduce siempre a la envolvente (con o sin paradas de reparto), «salida perfecta» y turbo cuando renta */
export function idealRun(T, bells, drops, {turbo = true, deliver = true} = {}) {
  const mask = deliver === true ? (1 << drops.length) - 1 : deliver === false ? 0 : deliver, want = drops.filter((_, k) => mask >> k & 1);
  const P = T.phys, env = want.length ? envelope(T, want) : T.ve, dt = 1 / 60;
  let v = 9, dist = 0, t = 0, bonus = 0, combo = 0, bi = 0, di = 0, tb = 0, tt = 0, nT = 0, nD = 0;
  for (let k = 0; k < 60000 && dist < T.L; k++) {
    if (turbo && tb >= 1 && tt <= 0 && turboGood(T, dist, v, env)) {tt = TURBO_DUR; tb = 0; v = Math.min(VTURBO, v + TURBO_KICK); nT++}
    const on = tt > 0, cap = on ? VTURBO : VMAX;
    if (v < Math.min(veAtT(T, dist, env), cap)) v = Math.min(cap, v + accel(v, on, P) * dt); else v -= BRAKE * dt;
    if (on) tt -= dt;
    v -= P.drag * dt; if (v > cap) v = Math.max(cap, v - VDECAY * dt); v = Math.max(0, v); dist += v * dt; t += dt;
    if (!on && turboCharging(vsNow(T, dist), v)) tb = Math.min(1, tb + dt / P.fill);
    while (bi < bells.length && dist >= bells[bi].s) {if (v >= bells[bi].v) {combo++; bonus += bellBonus(combo)} else combo = 0; bi++}
    while (di < drops.length && dist >= drops[di].s) {if (v <= drops[di].v + DROP_TOL) {nD++; bonus += DROP_BONUS} di++}
  }
  return {t, bonus, ideal: t - bonus, turbos: nT, drops: nD};
}
export const MEDAL_K = [1.08, 1.22, 1.40];
const medalCache = {};
/* medallas del día: la mejor combinación de ruta y reparto del maquinista ideal */
export function medalsFor(d, {turbo = true} = {}) {
  const key = d + (turbo ? 't' : 'n'); if (medalCache[key]) return medalCache[key];
  let best = null;
  for (const r of routesFor(d)) for (let deliver = 0; deliver < 1 << r.drops.length; deliver++) {const x = idealRun(r.T, r.bells, r.drops, {turbo, deliver}); if (!best || x.ideal < best.ideal) best = {...x, route: r.name, deliver}}
  const r1 = x => Math.round(x * 10) / 10;
  return medalCache[key] = {...best, g: r1(best.ideal * MEDAL_K[0]), s: r1(best.ideal * MEDAL_K[1]), b: r1(best.ideal * MEDAL_K[2])};
}

/* ================= fantasma: codec v2 =================
   Cabecera: versión, temporada-2000, día, flags (bit0 rebufo, bit1 atajo), nombre (UTF-8),
   tiempo bruto (ms), total declarado (ms), campanas, regalos perdidos, turbos, repartos,
   nº de muestras. Muestras: velocidad media de cada ventana de 0,1 s en pasos de VQ, en
   deltas zigzag (255 = escape seguido del valor absoluto). La última ventana puede ser parcial:
   dura raw − (n−1)·0,1 s. Todo va comprimido con deflate-raw y en base64url, con prefijo
   'z' (comprimido) o 'r' (sin comprimir). Se siguen leyendo los v1 (sin repartos ni flags). */
export const F_DRAFT = 1, F_SHORTCUT = 2;
const u32 = x => [x & 255, (x >>> 8) & 255, (x >>> 16) & 255, (x >>> 24) & 255];
const rd32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const b64u = u8 => {let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')};
const ub64u = s => {s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u};
async function flate(u8, on) {const st = new Blob([u8]).stream().pipeThrough(on ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(st).arrayBuffer())}

export const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16);
export async function encodeGhost(g) {
  const name = new TextEncoder().encode(cleanName(g.name)).slice(0, 64), q = Array.from(g.v, v => Math.max(0, Math.min(255, Math.round(v / VQ)))), n = q.length;
  const out = [2, (g.season || SEASON) - 2000, g.day, (g.flags | 0) & 255, name.length, ...name, ...u32(Math.round(g.raw * 1000)), ...u32(Math.round(g.total * 1000)), g.bells | 0, g.lost | 0, g.turbos | 0, g.drops | 0, n & 255, n >> 8];
  let prev = 0; for (const x of q) {const d = x - prev, zz = d >= 0 ? d * 2 : -d * 2 - 1; if (zz < 255) out.push(zz); else out.push(255, x); prev = x}
  const raw = Uint8Array.from(out);
  if (typeof CompressionStream === 'undefined') return 'r' + b64u(raw);
  return 'z' + b64u(await flate(raw, true));
}
export async function decodeGhost(code) {
  const kind = code[0]; let b = ub64u(code.slice(1));
  if (kind === 'z') b = await flate(b, false); else if (kind !== 'r') throw new Error('formato');
  const ver = b[0]; if (ver !== 1 && ver !== 2) throw new Error('versión');
  let o = 5; const nl = b[4], name = new TextDecoder().decode(b.slice(o, o + nl)); o += nl;
  const g = {season: 2000 + b[1], day: b[2], flags: ver === 2 ? b[3] : 0, name, raw: rd32(b, o) / 1000, total: rd32(b, o + 4) / 1000, bells: b[o + 8], lost: b[o + 9], turbos: b[o + 10], drops: ver === 2 ? b[o + 11] : 0};
  o += ver === 2 ? 12 : 11; const n = b[o] | b[o + 1] << 8; o += 2;
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
   campanas, repartos, regalos perdidos y total. El servidor guarda SU total, no el declarado. */
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
  const R = routesFor(g.day), route = g.flags & F_SHORTCUT ? R[1] : R[0];
  if (!route) {fail('atajo'); return {ok: false, errs}}
  const {T, bells, drops: stops} = route, P = T.phys, dur = i => i === n - 1 ? last : GDT;
  const tolV = 2 * VQ, upN = (ACC * P.acc + 0.05) * GDT + tolV, upT = (ACC * P.acc + TURBO_ACC + 0.05) * GDT + tolV, down = (HARD + P.drag + 0.05) * GDT + tolV;
  let dist = 0, above = 0, boost = 0, kicks = 0, drops = 0, charge = 0, stress = 0, lost = 0, combo = 0, bonus = 0, hits = 0, bi = 0, di = 0, deliv = 0;
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
    const d2 = dist + vi * dt, vp = i ? v[i - 1] : vi, vn = i < n - 1 ? v[i + 1] : vi; // la media de 0,1 s difumina el instante del cruce
    while (bi < bells.length && d2 >= bells[bi].s) {if (Math.max(vp, vi, vn) >= bells[bi].v - VQ) {combo++; hits++; bonus += bellBonus(combo)} else combo = 0; bi++}
    while (di < stops.length && d2 >= stops[di].s) {if (Math.min(vp, vi, vn) <= stops[di].v + DROP_TOL + VQ) {deliv++; bonus += DROP_BONUS} di++}
    dist = d2;
  }
  const draft = g.flags & F_DRAFT ? g.raw * DRAFT_RATE : 0, maxTurbos = Math.floor((charge + draft) / P.fill) + 1, slack = TURBO_DUR + (VTURBO - VMAX) / VDECAY;
  if (g.turbos > maxTurbos) fail('turbos');
  if (above > g.turbos * slack + 0.5) fail('tiempo con turbo');
  if (boost > g.turbos * (TURBO_DUR + GDT) + 0.5) fail('aceleración con turbo');
  if (kicks > 2 * g.turbos + 1) fail('empujones');
  if (drops > 2 * g.lost + 2 * stops.length + 2) fail('frenazos');
  if (g.lost < lost - 1) fail('regalos');
  if (dist < T.L - 1) fail('distancia');
  if (g.bells > hits + 1) fail('campanas');
  if (g.drops > deliv) fail('repartos');
  const total = g.raw + PEN_GIFT * g.lost - bonus, ideal = medalsFor(g.day).ideal;
  if (g.total < total - 1) fail('total');
  if (total < ideal * 0.97) fail('imposible');
  return {ok: errs.length === 0, errs, total, bells: hits, drops: deliv, lost: g.lost, dist, ideal, route: route.name};
}
