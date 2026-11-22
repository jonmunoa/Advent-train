/* submit-run: recibe {ghost, device, leagues?}, valida el fantasma repitiendo la carrera y guarda
   la mejor marca del dispositivo en public.runs. Escribe con la service role (RLS no deja
   escribir a anon). JS plano para poder probarlo con Node (tests/edge.test.mjs). */
import {decodeGhost, validateRun, cleanName, SEASON} from '../_shared/sim.js';

const HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[zr][A-Za-z0-9_-]+$/, LEAGUE = /^[a-z0-9]{6}$/;
const RATE_MS = 10000;

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function makeHandler({env, fetch: f = globalThis.fetch, now = () => new Date()}) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const salt = env.RUN_SALT || '';
  const origins = String(env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  const season = +(env.SEASON || SEASON);
  const anyDay = env.ALLOW_ANY_DAY === '1';
  const db = (path, init = {}) => f(`${base}/${path}`, {...init, headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {})}});

  return async req => {
    const origin = req.headers.get('origin') || '';
    const allow = origins.includes('*') ? '*' : origins.includes(origin) ? origin : origins[0] || '';
    const H = {'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Content-Type': 'application/json; charset=utf-8'};
    const out = (status, body) => new Response(JSON.stringify(body), {status, headers: H});
    if (req.method === 'OPTIONS') return new Response('ok', {headers: H});
    if (req.method !== 'POST') return out(405, {error: 'método'});
    if (!origins.includes('*') && origin && !origins.includes(origin)) return out(403, {error: 'origen'});
    if (!key || !salt) return out(500, {error: 'configuración'});

    let body; try {body = await req.json()} catch {return out(400, {error: 'json'})}
    const {ghost, device} = body || {}, leagues = Array.isArray(body && body.leagues) ? [...new Set(body.leagues.filter(c => typeof c === 'string' && LEAGUE.test(c)))].slice(0, 5) : [];
    if (typeof ghost !== 'string' || ghost.length > 4000 || !CODE.test(ghost)) return out(400, {error: 'fantasma'});
    if (typeof device !== 'string' || !HEX.test(device)) return out(400, {error: 'dispositivo'});
    let g; try {g = await decodeGhost(ghost)} catch {return out(400, {error: 'fantasma'})}

    const r = validateRun(g, {now: now(), season, allowAnyDay: anyDay});
    if (!r.ok) return out(422, {error: 'rechazado', motivos: r.errs});

    const hash = await sha256(device + salt), total_ms = Math.round(r.total * 1000), t = now();
    const q = await db(`runs?select=id,total_ms,updated_at&season=eq.${season}&day=eq.${g.day}&device_hash=eq.${hash}`);
    if (!q.ok) return out(502, {error: 'db'});
    const [prev] = await q.json();
    if (prev && t - new Date(prev.updated_at) < RATE_MS) return out(429, {error: 'espera'});

    let id = prev ? prev.id : null, best = prev ? prev.total_ms : Infinity;
    const mejor = total_ms < best;
    if (mejor) {
      const row = {season, day: g.day, name: cleanName(g.name), total_ms, raw_ms: Math.round(g.raw * 1000), bells: r.bells, gifts_lost: g.lost, turbos: g.turbos, ghost, device_hash: hash, updated_at: t.toISOString()};
      const w = await db('runs?on_conflict=season,day,device_hash', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=representation'}, body: JSON.stringify(row)});
      if (!w.ok) return out(502, {error: 'db'});
      id = (await w.json())[0].id; best = total_ms;
    } else {
      // no mejora: conserva la marca y su fantasma, pero actualiza el nombre y la hora del último envío
      const w = await db(`runs?id=eq.${id}`, {method: 'PATCH', body: JSON.stringify({name: cleanName(g.name), updated_at: t.toISOString()})});
      if (!w.ok) return out(502, {error: 'db'});
    }
    // ligas de amigos: el dispositivo entra (o sigue) en las ligas que manda el navegador
    if (leagues.length) {
      const w = await db('league_members?on_conflict=league,device_hash', {method: 'POST', headers: {Prefer: 'resolution=ignore-duplicates,return=minimal'}, body: JSON.stringify(leagues.map(league => ({league, device_hash: hash})))});
      if (!w.ok) return out(502, {error: 'db'});
    }
    const c = await db(`runs?select=id&season=eq.${season}&day=eq.${g.day}&total_ms=lt.${best}`, {headers: {Prefer: 'count=exact', Range: '0-0'}});
    const rank = 1 + (parseInt((c.headers.get('content-range') || '*/0').split('/')[1], 10) || 0);
    return out(200, {id, total_ms: best, rank, mejor});
  };
}
