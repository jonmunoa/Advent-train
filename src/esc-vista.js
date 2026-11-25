/* Cámara de dentro del escaparate. Trabaja en coordenadas de la maqueta y al final pasa al mundo con la matriz del escaparate.
   Un dedo (o arrastrar) gira alrededor de lo que hay en el centro; dos dedos (o el botón derecho, el central o Mayús) mueven, con el punto del
   suelo que agarras pegado al dedo; el pellizco o la rueda acercan hacia donde apuntas y girar dos dedos gira. Tocar un coche lo sigue.
   Los gestos se aplican una vez por fotograma, siempre sobre la cámara que se ve. La cámara no se mete en lomas ni en edificios (libra). */
import {THREE, coarse, REDUCED, lerp, clamp, sstep} from './kit.js';
import {atM, BW, BD, KT} from './esc-vias.js';
import {Cine} from './esc-cine.js';
import {TW, TH} from './esc-techo.js';

const V3 = () => new THREE.Vector3(), wrapA = a => {while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a}, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const FOVD = 42; const MIND = 7, ELMAX = 1.45, tanH = Math.tan(FOVD * Math.PI / 360);
const mod = (x, L) => ((x % L) + L) % L;

/* opc: {camera, canvas, pick(x, y, margen), over(x, y), onFocus(f), onHint(), onCine(v), cut(v)} */
export function Vista({camera, canvas, pick, over, onFocus, onHint, onCine, cut, techo}) {
  const cine = new Cine(), cp2 = new THREE.Vector3(); let cineOn = false;
  let on = false, M = null, W = null; const Wi = new THREE.Matrix4(), up = V3();
  const CTR = new THREE.Vector3(0, 8.5, -8), cam = {az: Math.PI / 2, el: .5, d: 100, tgt: CTR.clone(), azT: null, vx: 0, vz: 0, vaz: 0, vel: 0, sube: 0, corta: 1, yaw: null, focus: null, faz: Math.PI / 2, fel: .3, fd: 17, fdT: 17, back: null};
  const cp = V3(), cl = V3(), dir = V3(), t1 = V3(), t2 = V3();                    // cp, cl: cámara que se ve (posición y punto al que mira, en la maqueta)
  const pp = V3(), ll = V3(), bl = {t: 1, dur: .8, p: V3(), az: 0, el: 0, hop: 0, su: false, fov: FOVD};      // vuelo entre dos vistas: sale siempre de lo que se ve
  const zm = {on: false, l: 0, A: V3(), x: -1e4, y: 0}, ptrs = new Map(), rq = {a: 0, e: 0, A: 0, E: 0}, gs = {moved: false, drag: false, far: false, G: V3(), hist: [], lastMove: 0}, pn = {A: V3()};
  let lastIn = 0, tap = null, lastTap = {t: -1e9, x: 0, y: 0}, touched = false, hov = null, cutK = 0, cutOp = 0;
  const now = () => performance.now(), portrait = () => camera.aspect < .8, gy = (x, z) => M.gy(x, z);
  const fitD = () => Math.max((BW - 3) / (tanH * camera.aspect) + 41, (BD * .9 + 16) / tanH) * 1.12, maxD = () => clamp(fitD() * 1.06, 150, 360), defD = () => clamp(fitD() * (portrait() ? .4 : .42), 60, portrait() ? 104 : 130), homeEl = () => portrait() ? .44 : .25;
  const elMin = () => lerp(.05, .3, sstep(12, 90, cp.y)), effD = () => cp.y / Math.max(.3, Math.sin(cam.el));
  const RC = new THREE.Raycaster(), ND = new THREE.Vector2(), R = new THREE.Ray();
  /* al soltar la cámara de cine se vuela a una vista de mapa; mientras dura, los gestos se aplican a la vista de destino (vc) */
  const vc = new THREE.PerspectiveCamera(FOVD, 1, .1, 900), suelta = () => bl.su && bl.t < 1;
  function vcPose() {vc.aspect = camera.aspect; vc.updateProjectionMatrix(); vc.up.copy(up); vc.position.copy(pp).applyMatrix4(W); vc.lookAt(t2.copy(ll).applyMatrix4(W)); vc.updateMatrixWorld()}
  function ray(sx, sy) {ND.set(sx / innerWidth * 2 - 1, 1 - sy / innerHeight * 2); RC.setFromCamera(ND, suelta() ? vc : camera); R.copy(RC.ray).applyMatrix4(Wi); R.direction.normalize(); return R}
  /* distancia hasta el suelo a lo largo del rayo (marcha sobre la rejilla de alturas y afina por bisección) */
  function groundT(r, max = 700) {const o = r.origin, d = r.direction; if (o.y < gy(o.x, o.z)) return 0; let t = 0, st = .7; while (t < max) {t += st; const y = o.y + d.y * t; if (y < gy(o.x + d.x * t, o.z + d.z * t)) {let a = t - st, b = t; for (let k = 0; k < 14; k++) {const m = (a + b) / 2; if (o.y + d.y * m < gy(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m} return (a + b) / 2} if (y < -6 && d.y < 0) return null; st = Math.max(.7, t * .012)} return null}
  const groundPt = (sx, sy, out) => {const r = ray(sx, sy), t = groundT(r); return r.at(Math.min(t || 1e9, 2.6 * cam.d), out)};
  function bounds() {const k = .8 * sstep(.66, 1, effD() / maxD()), f = (a, c) => lerp(a, c, k); return {x0: f(-BW + 8, CTR.x), x1: f(BW - 8, CTR.x), z0: f(-BD + 8, CTR.z), z1: f(BD - 4, CTR.z)}}
  const rubber = (v, lo, hi) => {const o = v < lo ? v - lo : v > hi ? v - hi : 0; if (!o) return v; const D = .22 * cam.d; return (o < 0 ? lo : hi) + o * D * .55 / (D + .55 * Math.abs(o))};
  function moveTgt(x, z) {const b = bounds(); cam.tgt.x = rubber(x, b.x0, b.x1); cam.tgt.z = rubber(z, b.z0, b.z1)}
  function stop() {cam.vx = cam.vz = cam.vaz = cam.vel = 0; rq.a = rq.e = 0; cam.azT = null; zm.on = false}
  const look = () => dir.copy(cl).sub(cp).normalize();
  /* el centro de giro pasa a ser el suelo del centro de la pantalla, sin mover la cámara */
  function anchor() {if (suelta()) return; const fly = bl.t < 1; look(); if (fly) {bl.t = 1; cam.el = Math.asin(clamp(-dir.y, -1, 1)); cam.az = Math.atan2(-dir.z, -dir.x)} let t = groundT(ray(innerWidth / 2, innerHeight / 2)); t = t === null ? cam.d : clamp(t, 4, maxD() * 1.2); cam.tgt.copy(cp).addScaledVector(look(), t); cam.d = t}
  function blend(dur = -1) {look(); bl.p.copy(cp); bl.az = Math.atan2(-dir.z, -dir.x); bl.el = Math.asin(clamp(-dir.y, -1, 1)); bl.t = 0; bl.hop = -1; bl.fix = dur; bl.su = false}
  function grab(sx, sy) {const r = ray(sx, sy), t = groundT(r); gs.far = !t || t > Math.max(3.2 * cam.d, 60); if (!gs.far) r.at(t, gs.G); gs.hist.length = 0}
  function dragTo(sx, sy, dx, dy) {let mx, mz; if (gs.far) {const k = 2 * cam.d * tanH / innerHeight, kf = k / Math.max(.35, Math.sin(cam.el)), s = Math.sin(cam.az), c = Math.cos(cam.az); mx = -s * dx * k - c * dy * kf; mz = c * dx * k - s * dy * kf} else {const r = ray(sx, sy), tm = Math.max(4.2 * cam.d, 80); let t = (gs.G.y - r.origin.y) / r.direction.y; if (!(t > 0) || t > tm) t = tm; r.at(t, t1); mx = gs.G.x - t1.x; mz = gs.G.z - t1.z} moveTgt(cam.tgt.x + mx, cam.tgt.z + mz)}
  /* girar: lo que pide el dedo se suaviza unas centésimas; más allá de los topes cede cada vez menos */
  function rotate(dx, dy) {const k = 2.9 / clamp(innerWidth, 360, 760), a = dx * k, e = dy * k * .78; rq.a += a; rq.e += e; rq.A += a; rq.E += e}
  const cede = (v, d, lo, hi) => {const o = v < lo && d < 0 ? lo - v : v > hi && d > 0 ? v - hi : 0; return v + d / (1 + o * 16)};
  function gira(dt) {if (!rq.a && !rq.e) return; const f = dt > 0 ? 1 - Math.exp(-36 * dt) : 0; let a = rq.a * f, e = rq.e * f; if (Math.abs(rq.a) + Math.abs(rq.e) < 2e-4) {a = rq.a; e = rq.e} rq.a -= a; rq.e -= e; if (cam.focus) {cam.faz += a; cam.fel = cede(cam.fel, e, .06, 1.3)} else {cam.az += a; cam.el = cede(cam.el, e, elMin(), ELMAX)}}
  /* el centro de giro baja (o sube) al suelo que se ve en el centro, si está cerca de donde estaba */
  function pivote() {if (suelta() || cam.focus) return; const t = groundT(ray(innerWidth / 2, innerHeight / 2)); if (t !== null && t > cam.d * .6 && t < cam.d * 1.5) {cam.tgt.copy(cp).addScaledVector(look(), t); cam.d = t}}
  const dolly = (A, k) => {cam.tgt.sub(A).multiplyScalar(k).add(A); cam.d *= k};
  const zoomLim = (A, l) => clamp(l, Math.min(0, Math.log(MIND / Math.max(1, cp.distanceTo(A)))), Math.max(0, Math.log(maxD() / effD())));
  function zoomAt(sx, sy, f) {toca(); setCine(false); if (cam.focus) {cam.fdT *= f; if (cam.fdT > 66 && f > 1) setFocus(null, true); else {cam.fdT = clamp(cam.fdT, 6, 80); return}} if (suelta()) {cam.d = clamp(cam.d * f, 18, maxD()); return} if (!zm.on || Math.hypot(sx - zm.x, sy - zm.y) > 14 || bl.t < 1) {anchor(); groundPt(sx, sy, zm.A); zm.x = sx; zm.y = sy; if (!zm.on) zm.l = 0} cam.vx = cam.vz = 0; zm.on = true; zm.l = zoomLim(zm.A, zm.l + Math.log(f))}
  function tiltAbout(A, a) {if (A) {t1.set(Math.sin(cam.az), 0, -Math.cos(cam.az)); cam.tgt.sub(A).applyAxisAngle(t1, -a).add(A)} cam.el += a}
  function toca() {touched = true; lastIn = now(); if (onHint) onHint()}
  function home(all) {setCine(false); cam.back = null; if (cam.focus) setFocus(null); blend(); stop(); cam.tgt.copy(CTR); cam.d = all ? Math.min(maxD(), fitD()) : defD(); cam.el = homeEl() + (all ? .16 : 0); cam.az = Math.PI / 2; lastIn = now()}
  function pinchStart() {setCine(false); const [a, b] = [...ptrs.values()]; Object.assign(pn, {d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ax: a.x, ay: a.y, bx: b.x, by: b.y, mode: null, rot: 0}); pn.d0 = pn.d; pn.a0 = pn.ang; if (!cam.focus) {anchor(); groundPt(pn.mx, pn.my, pn.A)}}
  /* dos dedos: pellizcar, girar y mover a la vez, o inclinar si los dos suben o bajan juntos */
  function pinchMove() {
    const [a, b] = [...ptrs.values()], d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (!pn.mode) {if (Math.abs(d - pn.d0) > 7 || Math.abs(wrapA(ang - pn.a0)) > .08 || Math.hypot(mx - pn.mx, my - pn.my) > 7) pn.mode = 'pin'; else return; pn.d = d; pn.ang = ang; pn.mx = mx; pn.my = my; if (!cam.focus) groundPt(mx, my, pn.A); return}
    const k = pn.d / d; let tw = wrapA(ang - pn.ang); pn.rot += tw; if (Math.abs(pn.rot) < .12 && !pn.turn) tw = 0; else pn.turn = true;
    if (cam.focus) {rotate((mx - pn.mx) * .6, (my - pn.my) * .6); cam.fd = cam.fdT = clamp(cam.fd * k, 6, 80); cam.faz -= tw; if (cam.fd > 66 && k > 1) {setFocus(null, true); groundPt(mx, my, pn.A)}}
    else {const lo = cp.distanceTo(pn.A) < MIND && k < 1, hi = effD() > maxD() && k > 1; dolly(pn.A, lo || hi ? Math.pow(k, .3) : k); if (tw) {cam.az -= tw; const x = cam.tgt.x - pn.A.x, z = cam.tgt.z - pn.A.z, c = Math.cos(-tw), s = Math.sin(-tw); cam.tgt.x = pn.A.x + x * c - z * s; cam.tgt.z = pn.A.z + x * s + z * c} freePose(); if (suelta()) vcPose(); else put(pp, ll); gs.G.copy(pn.A); gs.far = false; dragTo(mx, my, mx - pn.mx, my - pn.my)}
    pn.d = d; pn.ang = ang; pn.mx = mx; pn.my = my;
  }
  function gesture() {if (!gs.moved || !ptrs.size) return; gs.moved = false; if (ptrs.size > 1) {if (ptrs.size === 2) pinchMove(); return} const q = ptrs.values().next().value, dx = q.x - q.px, dy = q.y - q.py; if (!gs.drag || q.nada) return; q.px = q.x; q.py = q.y; if (cam.focus || q.rot) rotate(dx, dy); else dragTo(q.x, q.y, dx, dy); gs.hist.push({t: now(), x: cam.tgt.x, z: cam.tgt.z, az: rq.A, el: rq.E}); if (gs.hist.length > 8) gs.hist.shift()}
  function startDrag() {setCine(false); const q = ptrs.values().next().value; gs.drag = true; q.px = q.x; q.py = q.y; gs.hist.length = 0; if (onHint) onHint(); if (cam.focus) return; if (bl.t < 1) anchor(); if (q.rot) pivote(); else grab(q.x, q.y)}
  /* al soltar, sigue con la velocidad que llevaba el dedo */
  function throwIt(q) {const H = gs.hist, n = now(); if (H.length < 2 || n - gs.lastMove > 70) return; const b = H[H.length - 1], a = H.find(h => b.t - h.t < 110) || H[0], T0 = (b.t - a.t) / 1000; if (T0 < .012) return; if (cam.focus || q.rot) {cam.vaz = clamp((b.az - a.az) / T0, -4.5, 4.5); cam.vel = clamp((b.el - a.el) / T0, -2.4, 2.4)} else {const vm = 2.2 * cam.d; let vx = (b.x - a.x) / T0, vz = (b.z - a.z) / T0; const v = Math.hypot(vx, vz); if (v > vm) {vx *= vm / v; vz *= vm / v} cam.vx = vx; cam.vz = vz}}
  canvas.addEventListener('pointerdown', e => {if (!on) return; try {canvas.setPointerCapture(e.pointerId)} catch (_) {} update(0); toca(); stop(); gs.moved = false; ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, rot: !(e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey || e.metaKey)}); tap = ptrs.size === 1 && e.button === 0 ? {id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp} : null; gs.drag = false; if (!cam.focus && !cineOn && bl.t < 1) anchor(); if (ptrs.size === 2) pinchStart(); else if (e.button === 1) e.preventDefault(); canvas.classList.add('dr')});
  canvas.addEventListener('pointermove', e => {if (!on) return; const q = ptrs.get(e.pointerId); if (!q) {if (e.pointerType === 'mouse') hov = {x: e.clientX, y: e.clientY}; return} q.x = e.clientX; q.y = e.clientY; lastIn = gs.lastMove = now(); gs.moved = true; if (ptrs.size === 1 && !gs.drag && !q.nada) {if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < (e.pointerType === 'touch' ? 9 : 4)) return; tap = null; startDrag()}});
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => {const q = ptrs.get(e.pointerId); if (!q) return; const was = on && ev === 'pointerup' && tap && tap.id === e.pointerId && e.timeStamp - tap.t < 550; if (on) update(0); const n = ptrs.size; ptrs.delete(e.pointerId); tap = null; lastIn = now(); if (!ptrs.size) canvas.classList.remove('dr'); if (!on) return;
    if (n === 2) {pn.turn = false; if (!cam.focus && pn.mode === 'pin') {const l = Math.log(effD() > maxD() ? maxD() / effD() : cp.distanceTo(pn.A) < MIND ? MIND / cp.distanceTo(pn.A) : 1); if (l) {zm.on = true; zm.l = l; zm.A.copy(pn.A); zm.x = -1e4}} for (const o of ptrs.values()) o.nada = true; gs.drag = false} else if (n === 1) {if (gs.drag && ev === 'pointerup') throwIt(q); gs.drag = false}
    if (was && !pick(e.clientX, e.clientY, e.pointerType === 'touch' ? 22 : 6)) {const dbl = e.timeStamp - lastTap.t < 340 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 32; lastTap = {t: dbl ? -1e9 : e.timeStamp, x: e.clientX, y: e.clientY}; if (dbl) zoomAt(e.clientX, e.clientY, .5)}});
  canvas.addEventListener('lostpointercapture', e => ptrs.delete(e.pointerId));
  canvas.addEventListener('wheel', e => {if (!on) return; e.preventDefault(); const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? innerHeight : 1); zoomAt(e.clientX, e.clientY, Math.exp(e.ctrlKey ? clamp(px, -40, 40) * .011 : clamp(px, -160, 160) * .0021))}, {passive: false});
  const tapa = (G, x, z) => {const i = Math.round(x + TW / 2 - .5), j = Math.round(z + TH / 2 - .5); return i < 0 || j < 0 || i >= TW || j >= TH ? -1e3 : G[j * TW + i]};
  const pos = (el, d) => {const ce = Math.cos(el); return pp.set(cam.tgt.x + Math.cos(cam.az) * ce * d, cam.tgt.y + Math.sin(el) * d, cam.tgt.z + Math.sin(cam.az) * ce * d)};
  /* sube por encima de las lomas que tapan el centro y se acerca si donde caería la cámara hay algo */
  function libra(dt) {
    const G = techo(M); let nec = cam.el; const h = Math.cos(cam.el) * cam.d, c = Math.cos(cam.az), s = Math.sin(cam.az); for (let k = 2; k <= 8; k++) {const u = k / 8, g = gy(cam.tgt.x + c * h * u, cam.tgt.z + s * h * u) + (k === 8 ? 1.9 : .5); nec = Math.max(nec, Math.atan2(g - cam.tgt.y, h * u))}
    const q = clamp(nec - cam.el, 0, 1.2); if (dt > 0) cam.sube = lerp(cam.sube, q, 1 - Math.exp(-(q > cam.sube ? 12 : 2.6) * dt)); const el = Math.min(Math.max(ELMAX, cam.el), cam.el + cam.sube);
    let u = 1; for (; u > .16; u -= .02) {pos(el, cam.d * u); if (pp.y > tapa(G, pp.x, pp.z)) break} if (dt > 0) cam.corta = lerp(cam.corta, u, 1 - Math.exp(-(u < cam.corta ? 18 : 4) * dt)); return el;
  }
  function freePose(dt = 0) {const el = libra(dt); pos(el, cam.d * cam.corta); const g = gy(pp.x, pp.z) + 1.3; if (pp.y < g) pp.y = g; ll.copy(cam.tgt)}
  /* pone la cámara (en coordenadas de la maqueta) */
  function put(p, l) {cp.copy(p); cl.copy(l); camera.up.copy(up); camera.position.copy(p).applyMatrix4(W); camera.lookAt(t2.copy(l).applyMatrix4(W)); camera.updateMatrixWorld()}
  function freeStep(dt) {
    gira(dt);
    if (zm.on) {const q = zm.l * (1 - Math.exp(-13 * dt)); zm.l -= q; dolly(zm.A, Math.exp(q)); freePose(); put(pp, ll); anchor(); if (Math.abs(zm.l) < .0015) zm.on = false}
    const b = bounds(), t = cam.tgt, out = t.x < b.x0 || t.x > b.x1 || t.z < b.z0 || t.z > b.z1;
    if (!ptrs.size) {if (cam.vx || cam.vz) {t.x += cam.vx * dt; t.z += cam.vz * dt; const f = Math.exp(-(out ? 16 : 4.2) * dt); cam.vx *= f; cam.vz *= f; if (Math.hypot(cam.vx, cam.vz) < .01 * cam.d) cam.vx = cam.vz = 0} if (cam.vaz || cam.vel) {cam.az += cam.vaz * dt; cam.el = cede(cam.el, cam.vel * dt, elMin(), ELMAX); const f = Math.exp(-3.4 * dt); cam.vaz *= f; cam.vel *= Math.exp(-5 * dt); if (Math.abs(cam.vaz) + Math.abs(cam.vel) < .004) cam.vaz = cam.vel = 0} if (out) {const s = 1 - Math.exp(-9 * dt); t.x = lerp(t.x, clamp(t.x, b.x0, b.x1), s); t.z = lerp(t.z, clamp(t.z, b.z0, b.z1), s)}}
    if (cam.azT !== null) {cam.az += wrapA(cam.azT - cam.az) * (1 - Math.exp(-9 * dt)); if (Math.abs(wrapA(cam.azT - cam.az)) < .002) cam.azT = null}
    const em = elMin(); if (cam.el < em && !(ptrs.size === 1 && gs.drag)) tiltAbout(zm.on ? zm.A : ptrs.size === 2 && pn.mode === 'pin' ? pn.A : null, (em - cam.el) * (1 - Math.exp(-8 * dt))); if (cam.el > ELMAX) cam.el = lerp(cam.el, ELMAX, 1 - Math.exp(-10 * dt));
    if (!touched && !REDUCED && bl.t >= 1) cam.az = Math.PI / 2 + Math.sin((now() - lastIn) * .00012) * .5;   // se balancea sola hasta que la tocas por primera vez
    freePose(dt);
  }
  /* dentro de un túnel: se ve venir la máquina por la galería; si la máquina ya ha salido, se espera al tren en la boca */
  const tunel = s => {const T = M.T; for (const r of T.runs) if (r.k === KT) {const a = r.i * T.ds, u = mod(s - a, T.L); if (u < r.n * T.ds) return {a, len: r.n * T.ds, u}} return null};
  function update(dt) {
    if (!on) return; gesture(); const tr = M.tren, fc = cam.focus ? tr.cars[cam.focus.car] : null; let inT = null;
    if (fc) {gira(dt); if (!ptrs.size && (cam.vaz || cam.vel)) {cam.faz += cam.vaz * dt; cam.fel = clamp(cam.fel + cam.vel * dt, .02, 1.35); const f = Math.exp(-3.6 * dt); cam.vaz *= f; cam.vel *= f} if (!ptrs.size) cam.fel = lerp(cam.fel, clamp(cam.fel, .06, 1.3), 1 - Math.exp(-9 * dt)); cam.yaw = cam.yaw === null ? -fc.rotation.y : cam.yaw + wrapA(-fc.rotation.y - cam.yaw) * (1 - Math.exp(-(ptrs.size ? 1.2 : 2.6) * dt)); const yaw = cam.yaw; cam.fd = lerp(cam.fd, cam.fdT, 1 - Math.exp(-11 * dt)); t1.set(fc.position.x, fc.position.y + 2.7, fc.position.z); cam.tgt.lerp(t1, 1 - Math.exp(-14 * dt)); const a = yaw + cam.faz, ce = Math.cos(cam.fel); pp.set(cam.tgt.x + Math.cos(a) * ce * cam.fd, cam.tgt.y + Math.sin(cam.fel) * cam.fd, cam.tgt.z + Math.sin(a) * ce * cam.fd); ll.copy(cam.tgt); const g = gy(pp.x, pp.z) + 1.3; if (pp.y < g) pp.y = g; inT = tunel(tr.carS(cam.focus.car) + 2) || tunel(tr.carS(cam.focus.car) - 2)} else if (cineOn) {if (dt > 0) cine.paso(dt, camera.aspect); pp.fromArray(cine.pv); ll.fromArray(cine.l); if (cine.corte) {bl.t = 1; cine.corte = false; camera.fov = cine.fov} else camera.fov = lerp(camera.fov, cine.fov, bl.t < 1 ? 1 - Math.exp(-3 * dt) : 1 - Math.exp(-9 * dt)); camera.updateProjectionMatrix()} else freeStep(dt);
    cutK = !fc ? 0 : inT ? Math.min(1, cutK + dt / .5) : Math.max(0, cutK - dt / .5); const dentro = fc && cutK >= .5 && inT;
    if (dentro) {bl.t = 1; const s0 = tr.carS(0), lo = tunel(s0 + 3); if (lo && mod(lo.a - inT.a, M.T.L) < 1) {const sc = lo.a + clamp(lo.u + 12, 4, lo.len - 3.5), q = atM(M.T, sc), k = atM(M.T, s0 - 2); pp.set(q.x - Math.sin(q.a) * 1.5, q.y + 4.2, q.z + Math.cos(q.a) * 1.5); ll.set(k.x, k.y + 2.6, k.z)} else {const fin = inT.a + inT.len; let gap = 1e9; for (const r of M.T.runs) if (r.k === KT) gap = Math.min(gap, mod(r.i * M.T.ds - fin - .5, M.T.L)); const av = clamp(gap * .5, 4, 14), q = atM(M.T, fin + av), k = atM(M.T, fin), sd = Math.sin(cam.faz) >= 0 ? 1 : -1, lat = av < 12 ? 12 : 7.5; pp.set(q.x - Math.sin(q.a) * lat * sd, q.y + (av < 12 ? 8 : 5), q.z + Math.cos(q.a) * lat * sd); const g = gy(pp.x, pp.z) + 1.4; if (pp.y < g) pp.y = g; ll.set(k.x, k.y + 2.6, k.z)} put(pp, ll)}
    else {
      if (suelta()) vcPose(); if (bl.t < 1) {if (bl.hop < 0) {const D = bl.p.distanceTo(pp); bl.dur = REDUCED ? .001 : bl.fix > 0 ? bl.fix : clamp(.5 + D / 220, .55, 1.15); bl.hop = bl.fix > 0 ? 0 : Math.min(14, D * .1)} bl.t = Math.min(1, bl.t + dt / bl.dur); const e = bl.su ? 1 - Math.pow(1 - bl.t, 3) : ease(bl.t); if (bl.su) {camera.fov = lerp(bl.fov, FOVD, e); camera.updateProjectionMatrix()} dir.copy(pp).sub(ll); const az = Math.atan2(dir.z, dir.x), el = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), a = bl.az + wrapA(az - bl.az) * e, l = lerp(bl.el, el, e); pp.lerpVectors(bl.p, pp, e); pp.y += bl.hop * Math.sin(Math.PI * e); const g = gy(pp.x, pp.z) + 1.3; if (pp.y < g) pp.y = g; ll.set(pp.x - Math.cos(a) * Math.cos(l), pp.y - Math.sin(l), pp.z - Math.sin(a) * Math.cos(l))}
      put(pp, ll);
    }
    const op = Math.round(Math.min(1, (1 - Math.abs(2 * cutK - 1)) * 1.6) * 50) / 50; if (op !== cutOp) {cutOp = op; cut(op)}
    if (hov && !ptrs.size) {canvas.classList.toggle('pt', !!over(hov.x, hov.y)); hov = null}
  }
  /* cámara de cine: enciende (volando desde lo que se ve) o la suelta justo donde está */
  function setCine(v, dur = 1.3) {
    if (!!v === cineOn || !on) return; if (v) {if (cam.focus) {cam.focus = null; cam.vaz = cam.vel = 0; if (onFocus) onFocus(null)} blend(dur); stop(); cineOn = true; cine.empieza(M, {aspecto: camera.aspect})}
    else {
      // de la toma a una vista de mapa desde el mismo lado: sube, se aparta lo justo y deja el tren en el centro
      cineOn = false; look(); const L = cine.l, D = Math.hypot(cp.x - L[0], cp.y - L[1], cp.z - L[2]), el = Math.asin(clamp(-dir.y, -1, 1)), b = bounds(); blend(REDUCED ? .001 : .55); bl.su = true; bl.fov = camera.fov; stop(); cam.az = Math.atan2(-dir.z, -dir.x); cam.el = clamp(el + .16, .36, .95); cam.d = clamp(D * 1.5, portrait() ? 58 : 54, Math.max(60, defD())); cam.tgt.set(clamp(L[0], b.x0, b.x1), 0, clamp(L[2], b.z0, b.z1)); cam.tgt.y = gy(cam.tgt.x, cam.tgt.z) + 2; touched = true; freePose(); vcPose();
    }
    if (onCine) onCine(cineOn);
  }
  /* pegada a un coche (car: 0 máquina, 1 ténder, 2… furgones; chase: desde atrás) o libre */
  function setFocus(f, keep) {
    const was = cam.focus, deCine = cineOn; if (f && cineOn) {cineOn = false; if (onCine) onCine(false)} if (f) {const c = M.tren.cars[f.car]; if (!c) return; const yaw = -c.rotation.y, ca = Math.atan2(cp.z - c.position.z, cp.x - c.position.x); if (!was) cam.back = deCine ? 'cine' : {x: cam.tgt.x, y: cam.tgt.y, z: cam.tgt.z, d: cam.d, az: cam.az, el: cam.el}; blend(); stop(); if (f.chase) {cam.faz = Math.PI - .42; cam.fel = .34; cam.fdT = 24} else {cam.faz = Math.sin(ca - yaw) >= 0 ? Math.PI / 2 : -Math.PI / 2; cam.fel = .26; cam.fdT = f.car >= 2 && f.car < M.tren.cars.length - 1 ? clamp(4.9 / (tanH * camera.aspect), 12, 46) : 18} cam.fd = cam.fdT; cam.tgt.set(c.position.x, c.position.y + 2.7, c.position.z)}
    else if (was) {cam.vaz = cam.vel = 0; if (keep) {bl.t = 0; cam.focus = null; cam.d = cam.fd; anchor()} else if (cam.back === 'cine') {cam.focus = null; cam.back = null; setCine(true); if (onFocus) onFocus(null); return} else {blend(); const b = cam.back; if (b) {cam.tgt.set(b.x, b.y, b.z); cam.d = b.d; cam.az = b.az; cam.el = b.el} else {cam.tgt.copy(CTR); cam.d = defD(); cam.el = homeEl(); cam.az = Math.PI / 2}}}
    cam.focus = f || null; cam.yaw = null; cam.sube = 0; cam.corta = 1; rq.a = rq.e = 0; lastIn = now(); if (onFocus) onFocus(cam.focus);
  }
  const turn = a => {toca(); setCine(false); if (cam.focus) {cam.vaz = a * 3.6; return} anchor(); cam.vaz = 0; cam.azT = (cam.azT === null ? cam.az : cam.azT) + a};
  function nudge(dx, dy) {toca(); setCine(false); if (cam.focus) return rotate(-dx * 1.2, -dy); if (bl.t < 1) anchor(); const k = 2.1 * cam.d * tanH / innerHeight, s = Math.sin(cam.az), c = Math.cos(cam.az), v = 6; cam.vx = clamp(cam.vx + (s * dx + c * dy) * k * v, -1.4 * cam.d, 1.4 * cam.d); cam.vz = clamp(cam.vz + (-c * dx + s * dy) * k * v, -1.4 * cam.d, 1.4 * cam.d)}
  const toLocal = v => v.applyMatrix4(Wi);
  return {
    get on() {return on}, get cam() {return cam}, get ptrs() {return ptrs}, get flying() {return bl.t < 1}, get soltando() {return suelta()}, get inT() {return cutK >= .5}, get cine() {return cineOn}, get plano() {return cineOn ? cine.tipo : ''}, get planoN() {return cine.num}, get apunta() {return cineOn ? cp2.fromArray(cine.l).applyMatrix4(W) : null}, setCine,
    /* entra en la maqueta m desde la cámara que se ve (o desde delante del cristal) */
    entra(m, {desde, dur = 1.5, cine: conCine = false} = {}) {cineOn = false; M = m; m.g.updateMatrixWorld(true); W = m.g.matrixWorld; Wi.copy(W).invert(); up.set(0, 1, 0).transformDirection(W); on = true; ptrs.clear(); touched = false; cutK = 0; cam.focus = null; cam.sube = 0; cam.corta = 1; stop(); cam.tgt.copy(CTR); cam.d = defD(); cam.el = homeEl(); cam.az = Math.PI / 2; lastIn = now(); if (desde) {cp.copy(desde.p); cl.copy(desde.l)} else {camera.getWorldDirection(dir); cp.copy(camera.position); cl.copy(cp).add(dir); toLocal(cp); toLocal(cl)} blend(dur); if (conCine) {cineOn = true; cine.empieza(M, {aspecto: camera.aspect, delante: true})} if (onFocus) onFocus(null); if (onCine) onCine(cineOn)},
    sale() {on = false; cineOn = false; if (onCine) onCine(false); ptrs.clear(); zm.on = false; cam.focus = null; cutK = 0; cutOp = 0; cut(0); canvas.classList.remove('dr'); camera.up.set(0, 1, 0); if (onFocus) onFocus(null)},
    update, setFocus, zoomAt, home, turn, nudge, ray, groundT, stop, toca,
    /* el coche bajo el dedo: el que se toca de lleno o, si no, el más cercano a menos de «slop» píxeles */
    hitCar(sx, sy, slop) {const r = ray(sx, sy), tg = groundT(r) || 1e9, px = 2 * tanH / innerHeight, inv = new THREE.Matrix4(), q = new THREE.Ray(), bx = new THREE.Box3(); let bt = 1e9, bc = -1, nd = 1e9, nc = -1; M.tren.cars.forEach((c, i) => {inv.copy(c.matrix).invert(); q.copy(r).applyMatrix4(inv); const L = c.userData.len / 2; bx.min.set(-L, .3, -1.7); bx.max.set(L, c.userData.top || 4.8, 1.7); const p = q.intersectBox(bx, t2); if (p) {const t = p.applyMatrix4(c.matrix).distanceTo(r.origin); if (t < bt && t < tg + 1) {bt = t; bc = i}} else if (slop) {const e = slop * px * c.position.distanceTo(r.origin); bx.expandByScalar(e); const h = q.intersectBox(bx, t2); if (h) {const t = h.applyMatrix4(c.matrix).distanceTo(r.origin), dd = r.distanceToPoint(t1.copy(c.position)); if (t < tg + 1 + 2 * e && dd < nd) {nd = dd; nc = i}}}}); return bc >= 0 ? bc : nc},
    under(sx, sy) {const r = ray(sx, sy), t = groundT(r); return t === null ? null : r.at(t, V3())},
    screen(x, y, z) {const v = new THREE.Vector3(x, y, z).applyMatrix4(W).project(camera); return {x: (v.x * .5 + .5) * innerWidth, y: (.5 - v.y * .5) * innerHeight}},
    info: () => ({p: cp.toArray().map(v => +v.toFixed(2)), l: cl.toArray().map(v => +v.toFixed(2)), d: +cam.d.toFixed(2), az: +cam.az.toFixed(3), el: +cam.el.toFixed(3), focus: cam.focus, eff: +effD().toFixed(1), max: +maxD().toFixed(1)}),
    look(p) {setCine(false); cam.back = null; setFocus(null); stop(); Object.assign(cam, {az: p.az ?? cam.az, el: p.el ?? cam.el, d: p.d ?? cam.d}); if (p.t) cam.tgt.set(...p.t); touched = true; bl.t = 1; cam.sube = 0; cam.corta = 1; for (let i = 0; i < 12; i++) libra(.1); update(0)},
    get pos() {return cp}, get dir() {return look()}, local: toLocal, maxD, effD,
  };
}
