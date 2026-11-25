/* La gente de las maquetas: figuritas pintadas con proporciones de persona (cazadora o abrigo, pantalón, botas, bufanda, gorro, cara, pelo) en
   varias posturas. Cada grupo son dos mallas instanciadas hermanas: lo que lleva el color de cada uno (jm) y el resto, con color por vértice (rm).
   Todos miran hacia +X; miden unas 2,1 u de alto. */
import {THREE, mergeGeometries, LOWQ, M, geoOnly, BX, CY as CY0, TOR as TOR0, SPH as SPH0, JACKETS, rng} from './kit.js';
import {AC, acaba} from './esc-acabado.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), N = LOWQ ? 5 : 9, SPH = LOWQ ? (r, a, b) => SPH0(r, Math.min(a, 8), Math.min(b, 5)) : SPH0, TOR = LOWQ ? (r, t, n) => new THREE.TorusGeometry(r, t, 4, Math.min(n, 8)) : TOR0, CY = LOWQ ? (a, b, h, n) => new THREE.CylinderGeometry(a, b, h, n, 1, true) : CY0, UP = V(0, 1, 0), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _c = new THREE.Color();
acaba(M.person, AC.fieltro, 0);
const pinta = (g, c) => {g = geoOnly(g); const n = g.attributes.position.count, a = new Float32Array(n * 3); _c.set(c ?? 0xffffff); for (let i = 0; i < n; i++) a.set([_c.r, _c.g, _c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g};
/* miembro de a hasta b con radios ra y rb y los extremos redondos */
function miembro(a, b, ra, rb, tapas = true) {const d = b.clone().sub(a), l = d.length(), L = [CY(rb, ra, l, N).translate(0, l / 2, 0)]; if (tapas) L.push(SPH(ra, N, LOWQ ? 2 : 5)); L.push(SPH(rb, N, LOWQ ? 2 : 5).translate(0, l, 0)); const g = mergeGeometries(L.map(geoOnly), false); _q.setFromUnitVectors(UP, d.normalize()); g.applyQuaternion(_q); g.translate(a.x, a.y, a.z); return g}
/* tronco: anillos elípticos [y, rx (fondo), rz (ancho), x] */
function tronco(R, n = N + (LOWQ ? 3 : 5)) {const P = [], I = [], U = []; R.forEach(([y, rx, rz, x = 0], j) => {for (let i = 0; i <= n; i++) {const t = i / n * Math.PI * 2; P.push(x + Math.cos(t) * rx, y, Math.sin(t) * rz); U.push(i / n, j)} if (j) for (let i = 0; i < n; i++) {const a = (j - 1) * (n + 1) + i, b = a + n + 1; I.push(a, b, a + 1, a + 1, b, b + 1)}}); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g}
/* quiebra el tronco hacia delante desde la cadera */
const inclina = (g, a, y0 = .9) => g.translate(0, -y0, 0).rotateZ(-a).translate(0, y0, 0);

/* postura: 'pie', 'paso' (andando), 'paso2', 'ski', 'cuña' (esquí, aprendiz), 'skate', 'sit', 'alza' (brazo en alto), 'nino'; falda: abrigo largo */
export function figura(pose, {falda = false, casco = false, sem = 0} = {}) {
  const J = [], R = [], r = rng(7 + sem), sk = pose === 'ski' || pose === 'cuña', cu = pose === 'cuña', sit = pose === 'sit', pt = pose === 'skate', inc = pose === 'ski' ? .55 : cu ? .28 : pt ? .3 : sit ? .02 : pose.startsWith('paso') ? .06 : 0, po = (g, c) => R.push(pinta(g, c)), pant = falda ? 0x2b2a30 : [0x2a3140, 0x3a3038, 0x26322c][sem % 3], bota = sk ? 0x22242c : 0x3a281c, guante = [0x2a2a30, 0x7a1420, 0xe8e2d4][sem % 3], piel = 0xeebf9d, pelo = [0x4a2e1c, 0x2a1c14, 0x9a6a34, 0x6a4a30][sem % 4], lana = [0xf2efe8, 0xd9c9a4, 0xb8202e, 0x2a5aa8][sem % 4];
  const X = (y, x = 0) => x + (y > .9 ? Math.sin(inc) * (y - .9) : 0), Y = y => y > .9 ? .9 + Math.cos(inc) * (y - .9) : y, T = (x, y, z) => {const c = Math.cos(inc), s = Math.sin(inc), d = y - .9; return d > 0 ? V(x * c + d * s, .9 + d * c - x * s, z) : V(x, y, z)};
  // piernas: cadera, rodilla, tobillo
  for (const s of [-1, 1]) {
    const z = s * .115; let h = V(0, .92, z), k, t; if (sit) {h = V(0, .9, z); k = V(.46, .88, z * 1.2); t = V(.5, .46, z * 1.2)} else if (pose === 'ski') {h = V(-.08, .88, z); k = V(.2, .55, z * 1.15); t = V(.02, .2, z * 1.15)} else if (cu) {h = V(-.04, .9, z); k = V(.16, .54, z * 1.7); t = V(0, .2, z * 2.1)} else if (pt) {k = s > 0 ? V(.2, .52, z) : V(-.06, .56, z * 1.3); t = s > 0 ? V(.06, .16, z) : V(-.42, .4, z * 2)} else if (pose.startsWith('paso')) {const d = (pose === 'paso' ? 1 : -1) * s; k = V(.13 * d + .05, .52, z); t = V(.26 * d - .04, d > 0 ? .13 : .19, z)} else {k = V(.02, .52, z * 1.06); t = V(-.01, .14, z * 1.1)}
    po(miembro(h, k, .125, .1), pant); po(miembro(k, t, .1, .078), pant); const pie = t.clone(); if (!LOWQ || !falda) po(SPH(.1, N, 6).scale(1.65, .82, .95).translate(pie.x + .06, pie.y - .05, pie.z), bota); if (!LOWQ) po(CY(.092, .1, .16, N).translate(pie.x, pie.y + .03, pie.z), bota);
    if (sk) {const y = .045, zz = pie.z, g = BX(1.5, .03, .105).translate(.1, 0, 0), q = BX(.2, .028, .1).rotateZ(.5).translate(.93, .05, 0); for (const b of [g, q]) {b.rotateY(cu ? s * .17 : 0); b.translate(pie.x, y, zz); po(b, [0xc8182c, 0x1f6fd6, 0xf0b93c, 0x1b6b48][sem % 4])} po(BX(.34, .06, .09).translate(pie.x + .04, .09, zz), 0x17181d)}
    if (pt) {po(BX(.36, .07, .025).translate(pie.x + .05, pie.y - .13, pie.z), 0xd8e0ec); po(BX(.3, .03, .1).translate(pie.x + .05, pie.y - .09, pie.z), 0x2a2a30)}
    // brazos: hombro, codo, mano
    let c, m; const ho = T(0, 1.42, s * .235); if (pose === 'ski') {c = T(.2, 1.2, s * .36); m = T(.42, 1.12, s * .36)} else if (cu) {c = T(.06, 1.14, s * .44); m = T(.32, 1.06, s * .5)} else if (pt) {c = T(s * -.16, 1.2, s * .4); m = T(s * -.36, 1.12, s * .58)} else if (sit) {c = V(.1, 1.14, s * .33); m = V(.36, 1.06, s * .24)} else if (pose === 'alza' && s > 0) {c = V(.08, 1.6, s * .42); m = V(.1, 1.95, s * .42)} else if (pose.startsWith('paso')) {const d = (pose === 'paso' ? 1 : -1) * -s; c = T(.1 * d - .03, 1.16, s * .31); m = T(.24 * d + .08, .98, s * .29)} else {c = V(-.02, 1.16, s * .33); m = V(.08, .93, s * .31)}
    J.push(geoOnly(miembro(ho, c, .098, .085))); J.push(geoOnly(miembro(c, m, .085, .07, false))); po(SPH(.074, N, 5).scale(1.15, 1, .9).translate(m.x, m.y, m.z), guante); if (!LOWQ) po(CY(.078, .078, .06, N).translate(0, 0, 0).applyMatrix4(_m.makeRotationFromQuaternion(_q.setFromUnitVectors(UP, m.clone().sub(c).normalize()))).translate(m.x + (c.x - m.x) * .22, m.y + (c.y - m.y) * .22, m.z + (c.z - m.z) * .22), guante);
    if (sk) {const a = m.clone(), b = cu ? V(m.x - .1, .03, m.z + s * .12) : V(m.x - .95, .22, m.z + s * .06); po(miembro(a, b, .014, .012, false), 0x8a8e98); po(CY(.05, .05, .012, 7).translate(b.x * .9 + a.x * .1, b.y * .9 + a.y * .1, b.z), 0x22242c)}
  }
  // cazadora o abrigo, con cuello, cremallera y bolsillos
  const cu0 = falda ? [[.42, .27, .3], [.5, .275, .305], [.8, .2, .235], [.98, .168, .212]] : [[.84, .165, .205], [.86, .2, .232], [.95, .192, .228], [1.02, .18, .22]]; J.push(geoOnly(inclina(tronco([...cu0, [1.2, .19, .235], [1.36, .18, .255], [1.46, .145, .225], [1.53, .1, .13], [1.56, .075, .08]]), inc)));
  if (!LOWQ) {po(inclina(BX(.02, falda ? .86 : .6, .022).translate(.192, falda ? 1.02 : 1.16, 0).rotateZ(0), inc), 0x17181d); for (const s of [-1, 1]) po(inclina(BX(.03, .03, .13).translate(.188, 1.0, s * .12), inc), 0x1c1d22)} if (falda) po(inclina(TOR(.2, .022, N + 5).rotateX(Math.PI / 2).scale(.86, 1, 1.06).translate(0, 1.0, 0), inc), 0x2a1c14);
  // bufanda con su punta
  {const b = T(0, 1.57, 0); po(TOR(.105, .05, N + 2).rotateX(Math.PI / 2).rotateZ(-inc).translate(b.x, b.y, b.z), lana); const q = T(.17, 1.4, .09); po(BX(.035, .32, .1).rotateZ(-.12 - inc).translate(q.x, q.y, q.z), lana); if (pose === 'ski' || pt) {const f = T(-.32, 1.56, -.02); po(BX(.46, .03, .1).rotateZ(.14).translate(f.x, f.y, f.z), lana)}}
  // cabeza
  const c0 = T(.02, 1.77, 0), al = pose === 'ski' ? .3 : 0, pon = (g, c, x, y, z) => po(g.rotateZ(-inc * .35 + al * .0).translate(c0.x + x, c0.y + y, c0.z + z), c); pon(SPH(.16, N + 4, LOWQ ? 7 : 10).scale(1, 1.2, .9), piel, 0, 0, 0); pon(SPH(.03, 6, 5).scale(1, .9, .8), 0xe5a684, .163, -.02, 0); for (const s of [-1, 1]) {pon(LOWQ ? BX(.03, .034, .03) : SPH(.017, 5, 4), 0x1c1410, .147, .035, s * .056); if (!LOWQ) {pon(SPH(.036, 6, 5).scale(.4, .8, 1), 0xe59a84, .132, -.045, s * .08); pon(SPH(.035, 6, 5).scale(.7, 1, .5), piel, -.005, 0, s * .146)}} if (!LOWQ) pon(BX(.012, .012, .06), 0xb85a50, .15, -.085, 0);
  if (!casco) pon(SPH(.16, N, 7).scale(.96, 1.08, .98), pelo, -.035, .012, 0); if (falda) {pon(SPH(.13, N, 6).scale(.8, 1.2, 1.1), pelo, -.09, -.09, 0)}
  if (casco) {const g = new THREE.SphereGeometry(.185, N + 4, LOWQ ? 5 : 8, 0, 6.2832, 0, 1.75).scale(1.06, 1.12, 1).rotateZ(.1 - inc * .3).translate(c0.x - .01, c0.y + .045, 0); J.push(geoOnly(g)); pon(SPH(.1, N, 5).scale(.45, .5, 1.32), 0x14161c, .125, .05, 0); pon(SPH(.09, N, 5).scale(.45, .42, 1.2), 0xd98a2a, .138, .05, 0); pon(TOR(.172, .018, N + 4).rotateX(Math.PI / 2).rotateZ(-.1), 0x14161c, -.005, .055, 0)}
  else {J.push(geoOnly(new THREE.SphereGeometry(.178, N + 4, LOWQ ? 4 : 7, 0, 6.2832, 0, 1.55).scale(1, 1.18, .95).rotateZ(.14 - inc * .3).translate(c0.x - .015, c0.y + .075, 0))); pon(TOR(.163, .038, N + 4).rotateX(Math.PI / 2).rotateZ(.14), lana, -.008, .08, 0); pon(SPH(.062, 7, 6), lana, -.04, .3, 0)}
  const j = mergeGeometries(J, false), q = mergeGeometries(R, false); if (sit) {j.translate(0, -.92, 0); q.translate(0, -.92, 0)} return {j, r: q};
}
const HECHAS = new Map(), hecha = (p, o) => {const k = p + JSON.stringify(o); if (!HECHAS.has(k)) HECHAS.set(k, figura(p, o)); return HECHAS.get(k)};
/* n personas en una postura; devuelve pon(i, matriz) */
export function grupo(pose, n, par, o = {}, cols = JACKETS) {
  const g = hecha(pose, o), jm = new THREE.InstancedMesh(g.j.clone(), M.person, n), rm = new THREE.InstancedMesh(g.r.clone(), M.personV, n); for (let i = 0; i < n; i++) jm.setColorAt(i, _c.set(cols[(i * 3 + pose.length + (o.sem || 0)) % cols.length])); jm.instanceColor.needsUpdate = true; jm.userData.con = [rm]; for (const m of [jm, rm]) {m.castShadow = m.receiveShadow = true; m.frustumCulled = false; par.add(m)}
  return {jm, rm, n, pon(i, m) {jm.setMatrixAt(i, m); rm.setMatrixAt(i, m)}, listo() {jm.instanceMatrix.needsUpdate = rm.instanceMatrix.needsUpdate = true}};
}
/* como crowd() de kit.js (mismo uso), repartida en un par de figuras distintas para que no sean todas iguales */
export function crowd(pose, n, par) {
  const V2 = pose === 'pie' ? [{sem: 0}, {sem: 1, falda: true}, {sem: 2}] : pose === 'skate' ? [{sem: 1}, {sem: 2, falda: true}] : pose === 'ski' ? [{sem: 0, casco: true}, {sem: 1, casco: true}] : [{sem: 3}], k = Math.min(V2.length, Math.max(1, Math.ceil(n / 3))), G = V2.slice(0, k).map((o, a) => grupo(pose, Math.ceil((n - a) / k), par, o)), S = f => ({setMatrixAt(i, m) {G[i % k][f].setMatrixAt(i / k | 0, m)}, instanceMatrix: {set needsUpdate(v) {G.forEach(g => {g[f].instanceMatrix.needsUpdate = v})}}});
  return {jm: S('jm'), rm: S('rm'), n, G};
}
/* en la portada: las figuras que usan casi todas las maquetas, de una en una */
export function* calientaFiguras() {for (const [p, o] of [['pie', {sem: 0}], ['pie', {sem: 1, falda: true}], ['pie', {sem: 2}], ['skate', {sem: 1}], ['skate', {sem: 2, falda: true}], ...[0, 1, 2, 3].flatMap(k => [['paso', {sem: k, falda: false}], ['paso2', {sem: k, falda: false}], ['paso', {sem: k, falda: true}], ['paso2', {sem: k, falda: true}]])]) {hecha(p, o); yield}}
