/* Esculpe las cabezas, el pelo y las manos de los personajes y las guarda en m/gente/*.glb.
   Cada pieza es una superficie implícita (SDF) que se malla a resolución variable, se proyecta, se simplifica y lleva en el
   color de los vértices sus máscaras: R oclusión, G rubor, B labios, A material (0 piel, 64 boca, 128 diente, 192 pelo).
   Los gestos van como morphs. Uso: node scripts/esculpe.mjs [pieza…] [--basto] */
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {Document, NodeIO} from '@gltf-transform/core';
import {EXTMeshoptCompression, KHRMeshQuantization} from '@gltf-transform/extensions';
import {quantize, reorder} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import {CABEZAS, OJOS} from './esculpe-cabezas.mjs';
import {manos} from './esculpe-manos.mjs';
import {juguetes} from './esculpe-juguetes.mjs';
import {rejilla, malla, compacta, normales} from './esculpe-sdf.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'm/gente'); mkdirSync(OUT, {recursive: true});
await MeshoptSimplifier.ready; await MeshoptEncoder.ready; MeshoptSimplifier.useExperimentalFeatures = true;
const args = process.argv.slice(2), BASTO = args.includes('--basto'), CUALES = args.filter(a => !a.startsWith('--'));

/* simplifica respetando normales y máscaras */
function simplifica(M, objetivo) {
  const n = M.p.length / 3, at = new Float32Array(n * 7); for (let i = 0; i < n; i++) {at.set([M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], M.c[i * 4] * .6, M.c[i * 4 + 1], M.c[i * 4 + 2] * 2.4, M.c[i * 4 + 3]], i * 7)}
  const w = [1, 1, 1, .55, .3, .9, .6], [ix] = MeshoptSimplifier.simplifyWithAttributes(M.ix, M.p, 3, at, 7, w, null, objetivo * 3, 1e-2, []);
  return compacta({...M, ix});
}
export async function guarda(nombre, mallas) {
  const doc = new Document(), buf = doc.createBuffer(), esc = doc.createScene();
  for (const [id, M] of Object.entries(mallas)) {
    const ac = (t, a) => doc.createAccessor().setType(t).setArray(a).setBuffer(buf), pr = doc.createPrimitive().setIndices(ac('SCALAR', M.p.length / 3 < 65535 ? Uint16Array.from(M.ix) : Uint32Array.from(M.ix))).setAttribute('POSITION', ac('VEC3', M.p)).setAttribute('NORMAL', ac('VEC3', M.n)).setAttribute('COLOR_0', ac('VEC4', Uint8Array.from(M.c, v => Math.round(Math.max(0, Math.min(1, v)) * 255))).setNormalized(true));
    if (M.uv) pr.setAttribute('TEXCOORD_0', ac('VEC2', M.uv));
    const me = doc.createMesh(id).addPrimitive(pr);
    if (M.morphs) {const nm = Object.keys(M.morphs); for (const k of nm) pr.addTarget(doc.createPrimitiveTarget(k).setAttribute('POSITION', ac('VEC3', M.morphs[k].p)).setAttribute('NORMAL', ac('VEC3', M.morphs[k].n))); me.setExtras({targetNames: nm}); me.setWeights(nm.map(() => 0))}
    esc.addChild(doc.createNode(id).setMesh(me));
  }
  await doc.transform(reorder({encoder: MeshoptEncoder}), quantize({quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12, quantizeColor: 8}));
  doc.createExtension(KHRMeshQuantization).setRequired(true); doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({'meshopt.encoder': MeshoptEncoder}), bin = await io.writeBinary(doc); writeFileSync(join(OUT, nombre + '.glb'), bin);
  console.log(nombre + '.glb', (bin.length / 1024).toFixed(0) + ' kB', Object.entries(mallas).map(([k, M]) => `${k} ${(M.ix.length / 3)}△`).join(' · '));
}
/* mechones: se conserva la forma y se quita lo que no se nota */
function aligera(M, tris) {const n = M.p.length / 3, at = new Float32Array(n * 5); for (let i = 0; i < n; i++) at.set([M.n[i * 3], M.n[i * 3 + 1], M.n[i * 3 + 2], M.c[i * 4], M.c[i * 4 + 1]], i * 5); const [ix] = MeshoptSimplifier.simplifyWithAttributes(M.ix, M.p, 3, at, 5, [.35, .35, .35, .1, .1], null, tris * 3, 5e-2, []); return compacta({...M, ix})}
const une = L => {const o = {p: [], n: [], c: [], uv: [], ix: []}; let b = 0; for (const M of L) {for (const k of ['p', 'n', 'c']) for (const v of M[k]) o[k].push(v); const nv = M.p.length / 3; if (M.uv) for (const v of M.uv) o.uv.push(v); else for (let i = 0; i < nv * 2; i++) o.uv.push(0); for (const i of M.ix) o.ix.push(i + b); b += nv} return {p: Float32Array.from(o.p), n: Float32Array.from(o.n), c: Float32Array.from(o.c), uv: Float32Array.from(o.uv), ix: Uint32Array.from(o.ix)}};

for (const id of Object.keys(CABEZAS)) {
  if (CUALES.length && !CUALES.includes(id)) continue; const t0 = Date.now(), H = CABEZAS[id], g = rejilla(H.caja, H.paso * (BASTO ? 1.9 : 1), H.denso);
  let M = malla(H.f, g, H.vale); normales(H.f, M, 4e-4); M.c = H.pinta(M); const bruto = M.ix.length / 3; M = simplifica(M, H.tris * (BASTO ? .6 : 1)); normales(H.f, M, 4e-4); M.c = H.pinta(M); M.uv = new Float32Array(M.p.length / 3 * 2); for (let i = 0; i < M.p.length / 3; i++) {M.uv[i * 2] = Math.atan2(M.p[i * 3 + 2], M.p[i * 3]) * 1.6; M.uv[i * 2 + 1] = M.p[i * 3 + 1] * 12}
  const cara = une([M, ...H.extras()]); cara.morphs = H.morphs(cara); const mallas = {cara, parpados: une(H.parpados())}; const pl = H.pelos(); for (const [k, L] of Object.entries(pl)) {if (k === 'hebras') continue; mallas[k] = aligera(une(L), {pelo: id === 'viejo' ? 8000 : id === 'nino' ? 13500 : id === 'madre' ? 21000 : 14500, barba: 6000, bigote: 2400}[k] || 4000); if (k === 'pelo' && pl.hebras) mallas.hebras = une(pl.hebras)}
  await guarda(id, mallas); console.log('  ', bruto, '→', M.ix.length / 3, '·', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
writeFileSync(join(ROOT, 'src/esc-medidas.js'), `/* generado por scripts/esculpe.mjs: los ojos de cada cabeza */\nexport const MEDIDAS = ${JSON.stringify(OJOS)};\n`);
for (const [grupo, hace] of [['manos', manos], ['juguetes', juguetes]]) if (!CUALES.length || CUALES.includes(grupo)) {const o = {}; for (const [id, H] of Object.entries(hace())) {const g = rejilla(H.caja, H.paso * (BASTO ? 1.7 : 1)); let M = malla(H.f, g); normales(H.f, M, 4e-4); M.c = H.pinta(M); M = simplifica(M, H.tris); normales(H.f, M, 4e-4); M.c = H.pinta(M); o[id] = une([M, ...(H.extras ? H.extras() : [])])} await guarda(grupo, o)}
