/* Juntar geometría quieta en pocas mallas: los materiales lisos (sin textura) pasan a color por vértice y se reparten en
   tres cubos (mate, satinado y metal) más uno sin luz; los que llevan textura o algo especial se quedan como están. */
import {uvFoto} from './esc-real.js';
import {THREE, mergeGeometries, geoOnly, LOWQ, cutMat} from './kit.js';
import {conLuz} from './esc-luz.js';

const CUBO = {
  mate: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .92}), satin: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .42}), metal: new THREE.MeshStandardMaterial({vertexColors: true, roughness: .34, metalness: .72}), luz: new THREE.MeshBasicMaterial({vertexColors: true}),
};
for (const k in CUBO) cutMat(CUBO[k], .62, .82);   // lo que se cruza entre la cámara y el coche que se sigue no lo tapa
export const CUBOS = CUBO;
const liso = m => !m.map && !m.normalMap && !m.alphaMap && !m.vertexColors && !m.transparent && m.side === THREE.FrontSide && !m.userData.solo;
export function cubo(m) {
  if (!liso(m)) return null; if (m.isMeshBasicMaterial) return 'luz';
  if (!m.isMeshStandardMaterial || (m.emissive && m.emissive.getHex() !== 0) || (m.isMeshPhysicalMaterial && m.clearcoat > .3 && !LOWQ)) return null;
  return m.metalness > .4 ? 'metal' : m.roughness < .62 ? 'satin' : 'mate';
}
/* lista de [geometría, material] → mallas en «par» */
export function juntar(list, par, o) {const it = juntarG(list, par, o); for (;;) {const r = it.next(); if (r.done) return r.value}}
/* lo mismo repartido: cede cada pocas piezas */
export function* juntarG(list, par, {sombra = true} = {}) {
  const by = new Map(); let n = 0;
  for (let [g0, m] of list) {
    const nv = g0.attributes.position.count; if ((n += nv + 60) > 6000) {n = 0; yield} if (m.userData.fotoJ) g0 = uvFoto(g0, m.userData.fotoJ, m.userData.giro);
    const k = cubo(m), vc = m.vertexColors && g0.attributes.color && (g0.index ? g0.toNonIndexed().attributes.color : g0.attributes.color), g = geoOnly(g0); if (vc) g.setAttribute('color', vc); if (k) {const n = g.attributes.position.count, a = new Float32Array(n * 3), {r, g: gg, b} = m.color; for (let i = 0; i < n; i++) {a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b} g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv')}
    const key = k ? CUBO[k] : m; if (!by.has(key)) by.set(key, []); by.get(key).push(g);
  }
  const out = []; for (const [m, gs] of by) {yield; const me = new THREE.Mesh(mergeGeometries(gs, false), m); me.castShadow = sombra && m !== CUBO.luz && !m.isMeshBasicMaterial; me.receiveShadow = sombra && me.castShadow; me.matrixAutoUpdate = false; me.updateMatrix(); me.userData.fijo = true; par.add(me); out.push(me)}
  return out;
}
/* Un material no puede ir a la vez en dos escenas (otras luces) ni en mallas normales, instanciadas o con huesos: three
   volvería a buscar su programa en cada fotograma. Cada mezcla lleva su copia (con el mismo programa y texturas). */
const BASE = new WeakMap(), COPIAS = new WeakMap();
const firma = (o, sitio) => sitio + (o.isInstancedMesh ? (o.instanceColor ? ' ic' : ' i') : '') + (o.isSkinnedMesh ? ' h' : '') + (o.geometry.morphAttributes.position ? ' m' + o.geometry.morphAttributes.position.length : '') + (o.geometry.attributes.color && o.geometry.attributes.color.itemSize === 4 ? ' a' : '');
export function separa(root, sitio) {
  root.traverse(o => {
    const m = o.material; if (!o.isMesh || !m || Array.isArray(m) || m.userData.noSepara) return; const b = BASE.get(m) || m, f = firma(o, sitio); let q = COPIAS.get(b); if (!q) COPIAS.set(b, q = new Map());
    let c = q.get(f); if (!c) {
      const o0 = b.lz0 || {f: b.onBeforeCompile, k: b.customProgramCacheKey}; c = b; if (q.size) {c = b.clone(); c.onBeforeCompile = o0.f; c.customProgramCacheKey = o0.k; c.userData = b.userData; BASE.set(c, b)}
      if (sitio === 'dentro') {c.lz0 = c.lz0 || o0; conLuz(c)} q.set(f, c)} o.material = c;
  });
}
