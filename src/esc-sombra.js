/* Sombra del sol de las maquetas en el móvil. Lo quieto (árboles, casas, lomas, puentes) se dibuja una sola vez por maqueta desde el sol en un
   trozo de una textura de profundidad; el tren va en otra aparte que se rehace cada dos fotogramas. Con eso un punto sabe si le da el sol
   con un par de lecturas, sin los mapas de sombras de three (que costaban otro dibujo entero en cada fotograma). */
import {THREE, LOWQ} from './kit.js';
import {BW, BD} from './esc-vias.js';
import {ULZ} from './esc-luz.js';
import {corrientes} from './esc-nivel.js';

const W = 1024, H = 512, FW = 2048, FH = 1024, SOL = new THREE.Vector3(-82, 64, 78).normalize();
const mapa = (w, h) => {const d = new THREE.DepthTexture(w, h, THREE.UnsignedShortType); d.compareFunction = THREE.LessEqualCompare; d.minFilter = d.magFilter = THREE.LinearFilter; const t = new THREE.WebGLRenderTarget(w, h, {format: THREE.RedFormat, type: THREE.UnsignedByteType, depthTexture: d, stencilBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false}); t.scissorTest = true; return t};
let fijo = null, movil = null, mal = false; const dueño = [null, null, null, null], esc = new THREE.Scene(), cam = new THREE.Camera(); esc.matrixWorldAutoUpdate = false; cam.matrixAutoUpdate = cam.matrixWorldAutoUpdate = false;
const ciego = o => new THREE.MeshBasicMaterial({colorWrite: false, side: THREE.DoubleSide, fog: false, ...o}), LISO = ciego({}), INST = ciego({}), CALADO = new Map();
/* de la maqueta a la imagen del sol (0–1 en x, y y fondo) */
function base(tilt) {
  const L = SOL.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -tilt), x = new THREE.Vector3(0, 1, 0).cross(L).normalize(), y = L.clone().cross(x), a = [x, y, L].map(() => [1e9, -1e9]), p = new THREE.Vector3(); for (const px of [-BW - 1, BW + 1]) for (const pz of [-BD - 1, BD + 1]) for (const py of [-9, 34]) {p.set(px, py, pz); [x, y, L].forEach((v, i) => {const q = v.dot(p); a[i][0] = Math.min(a[i][0], q); a[i][1] = Math.max(a[i][1], q)})}
  const [X, Y, Z] = a, sx = 1 / (X[1] - X[0]), sy = 1 / (Y[1] - Y[0]), sz = -1 / (Z[1] - Z[0]); ULZ.shM.value.set(x.x * sx, x.y * sx, x.z * sx, -X[0] * sx, y.x * sy, y.y * sy, y.z * sy, -Y[0] * sy, L.x * sz, L.y * sz, L.z * sz, -Z[1] * sz, 0, 0, 0, 1);
  cam.projectionMatrix.makeTranslation(-1, -1, -1).multiply(new THREE.Matrix4().makeScale(2, 2, 2)).multiply(ULZ.shM.value); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}
function reparte(root, no) {
  const G = new Map(), pon = (m, o) => {if (!G.has(m)) G.set(m, []); G.get(m).push(o)}; const ve = o => {if (no.includes(o)) return; const m = o.material; if (o.isMesh && m && !m.transparent && m.visible !== false && !o.userData.sinSombra) {if (m.alphaTest && m.map) {const k = m.map.uuid + (o.isInstancedMesh ? 'i' : ''); if (!CALADO.has(k)) CALADO.set(k, ciego({map: m.map, alphaTest: m.alphaTest})); pon(CALADO.get(k), o)} else pon(o.isInstancedMesh ? INST : LISO, o)} o.children.forEach(ve)}; ve(root); return [...G];
}
function pinta(renderer, rt, x, y, w, h, grupos, m) {
  const r0 = renderer.getRenderTarget(), ac = renderer.autoClear; cam.matrixWorld.copy(m.g.matrixWorld); cam.matrixWorldInverse.copy(m.g.matrixWorld).invert(); rt.viewport.set(x, y, w, h); rt.scissor.set(x, y, w, h); renderer.setRenderTarget(rt); renderer.autoClear = false; renderer.clear(true, true, false); for (const [mat, l] of grupos) {const H = []; for (const o of l) if (o.children.length) {H.push([o, o.children]); o.children = []} esc.overrideMaterial = mat; esc.children = l; corrientes(l, () => renderer.render(esc, cam)); for (const [o, c] of H) o.children = c} esc.children = []; renderer.autoClear = ac; renderer.setRenderTarget(r0);
}
/* al arrancar: las dos texturas, vacías (sin ellas los sombreadores no tendrían de dónde leer) */
export function preparaSombras(renderer, tilt) {
  if (!LOWQ) return; fijo = mapa(FW * 2, FH * 2); movil = mapa(W, H); base(tilt); const r0 = renderer.getRenderTarget(); for (const t of [fijo, movil]) {t.scissorTest = false; renderer.setRenderTarget(t); renderer.clear(true, true, false); t.scissorTest = true} renderer.setRenderTarget(r0); ULZ.shT.value = fijo.depthTexture; ULZ.shD.value = movil.depthTexture;
}
/* antes de dibujar: L son las maquetas a la vista; m, la del tren que se mira */
let turno = 0;
export function sombras(renderer, L, m) {
  if (!LOWQ || mal || !fijo) return; try {
    for (const q of L) {const t = q.i % 4; if (dueño[t] === q) continue; dueño[t] = q; q.g.updateMatrixWorld(true); pinta(renderer, fijo, t % 2 * FW, (t >> 1) * FH, FW, FH, reparte(q.g, [q.tren.g, ...(q.mas || []).map(x => x.g), q.caja, q.domo, q.frente].filter(Boolean)), q); ULZ.shK.value.setComponent(t, 1); break}
    if (m && (turno++ & 1)) {const l = m.somT ||= [m.tren, ...(m.mas || [])].flatMap(t => reparte(t.g, [])); pinta(renderer, movil, 0, 0, W, H, l, m); ULZ.shDc.value = m.i % 8} else if (!m) ULZ.shDc.value = -9;
  } catch (e) {mal = true; ULZ.shK.value.set(0, 0, 0, 0); ULZ.shDc.value = -9}
}
/* la maqueta se tira o se rehace: su trozo deja de valer */
export function olvida(m) {const t = dueño.indexOf(m); if (t >= 0) {dueño[t] = null; ULZ.shK.value.setComponent(t, 0)}}
