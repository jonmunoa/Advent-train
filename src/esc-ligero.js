/* Las maquetas en el móvil: todo lo que es un color liso o una foto conocida se funde por grupo y lleva un solo material barato
   (sol, cielo, luz local y faro calculados aquí, sin las luces de three). Lo raro (agua, terreno, ramas, rótulos) se queda como está. */
import {THREE, CUT, T3R, RUIDO3} from './kit.js';
import {ULZ, LUZ_GLSL, LUZ_VERT, SOL_GLSL} from './esc-luz.js';
import {ACABADO_GLSL} from './esc-acabado.js';
import {nivela1, abre, manda, cierra} from './esc-nivel.js';

const P = 512, MAXC = 30; let nCapas = 0; const capaDe = new Map(), cola = [];
const tFotos = new THREE.DataArrayTexture(null, P, P, MAXC); tFotos.format = THREE.RGBAFormat; tFotos.type = THREE.UnsignedByteType; tFotos.colorSpace = THREE.SRGBColorSpace; tFotos.wrapS = tFotos.wrapT = THREE.RepeatWrapping; tFotos.magFilter = THREE.LinearFilter; tFotos.minFilter = THREE.LinearMipmapLinearFilter; tFotos.generateMipmaps = true; tFotos.anisotropy = 4; tFotos.source.dataReady = false; tFotos.needsUpdate = true;
/* nieve que se posa: umbrales de cada tipo */
const NV = [new THREE.Vector4(2, 3, 0, 0)], nvDe = new Map();
/* luz de dentro (la pone ambienta() en escaparates.js): hacia el sol, su color y el cielo */
export const LDEN = {dl: {value: new THREE.Vector3(0, 1, 0)}, dlc: {value: new THREE.Color()}, hs: {value: new THREE.Color()}, hg: {value: new THREE.Color()}};
const UNI = {t3R: T3R, ...ULZ, ...LDEN, tF: {value: tFotos}, nv: {value: Array.from({length: 8}, () => new THREE.Vector4(2, 3, 0, 1))}, cutA: CUT.a, cutB: CUT.b, cutR: CUT.r, fogColor: {value: new THREE.Color()}, fogNear: {value: 1}, fogFar: {value: 2}};
const RUIDO = RUIDO3;
const crea = (o = {}) => {const m = new THREE.ShaderMaterial({fog: true, ...o, uniforms: {}, vertexShader: `attribute vec3 color;attribute vec4 capa;attribute vec2 piv;varying vec2 vU,vPv;varying vec3 vN,vC,vPo,vOb;flat varying ivec4 vK;uniform vec3 cutA,cutB;uniform float cutR;uniform mat4 lzI;uniform float lzF,lzP;varying vec3 vLz,vLw;varying float vLc;
#include <common>
#include <fog_pars_vertex>
void main(){vec3 transformed=position,n=normal;vPo=vOb=position;vC=color*color*4.;vPv=vec2(piv.x/255.,piv.y/256.);vK=ivec4(capa+.5);
#ifdef USE_INSTANCING
n=mat3(instanceMatrix)*n;vPo=(instanceMatrix*vec4(position,1.)).xyz;
#endif
#ifdef USE_INSTANCING_COLOR
if((vK.y&4)==0)vC*=instanceColor;
#endif
vN=mat3(modelMatrix)*n;vU=uv;vec4 mvPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
#endif
mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;
${LUZ_VERT}
/* lo que se cruza entre la cámara y el coche que se sigue se aparta (se manda fuera del fondo) */
if(cutR>.01){vec3 ab=cutB-cutA;float t=clamp(dot(vLw-cutA,ab)/dot(ab,ab),0.,1.);if(t<.82&&length(vLw-cutA-ab*t)<cutR*.62*(.25+.75*t))gl_Position.z=gl_Position.w*1.5;}
#include <fog_vertex>
}`, fragmentShader: `precision highp sampler2DArray;uniform sampler2DArray tF,lzT;uniform vec4 nv[8];uniform vec3 dl,dlc,hs,hg;uniform float lzK;uniform vec4 faP;uniform vec3 faD;varying vec2 vU,vPv;varying vec3 vN,vC,vPo,vOb,vLz,vLw;flat varying ivec4 vK;varying float vLc;
#include <fog_pars_fragment>
${RUIDO}
${ACABADO_GLSL}
${SOL_GLSL}
${LUZ_GLSL}
void main(){vec3 c=vC;if(vK.x>0)c*=texture(tF,vec3(vU,float(vK.x-1)),-.6).rgb;if((vK.y&1)==1){gl_FragColor=vec4(c,1.);
#include <fog_fragment>
return;}
vec3 n=normalize(vN);
#ifdef DOBLE
if(!gl_FrontFacing)n=-n;
#endif
float ru=float(vK.z)/255.;if((vK.y&8)==8){float a=nR(vOb*2.3),b=nR(vOb*vec3(9.,2.2,9.)),z=clamp((1.-smoothstep(.7,3.1,vOb.y+(a-.5)*1.1))*.42+smoothstep(.62,.9,b)*.14,0.,1.);c=mix(c*(.92+.14*a),vec3(.085,.07,.06),z*.62);ru=min(1.,ru+z*.5);}{int ka=vK.y>>4;if(ka>0){float m0=0.;acabado(ka,vOb,n,length(fwidth(vOb)),c,ru,m0);}if(vPv.x>.004){float sn=nieveAc(vPo,n,vPv.x,vPv.y);c=mix(c,vec3(.84,.885,.96)*(.95+.07*nR(vPo*5.)),sn);ru=mix(ru,.84,sn);}}if(vK.w>0){vec4 q=nv[vK.w];float s=smoothstep(q.x,q.y,n.y+(nR(vPo*1.9)-.5)*.3)*q.z;c=mix(c,vec3(.84,.885,.96)*(.96+.06*nR(vPo*5.)),s);ru=mix(ru,.84,s);}
{/* la nieve lisa, con grano y bultos */float w=smoothstep(.5,.62,min(c.r,min(c.g,c.b)));if(w>.01){float a=nR(vPo*2.1),b=nR(vPo*6.7+3.);c*=mix(1.,.93+.09*a+.05*b,w);n=normalize(n+(vec3(nR(vPo*3.3),.5,nR(vPo*3.3+21.))-.5)*.07*w);}}
float nl=max(dot(n,dl),0.);if(nl>.01)nl*=solS(vLz,n,vLc);vec3 irr=mix(hg,hs,.5*n.y+.5)+dlc*nl,o=c*(irr*.31831+luzLocal(n,vLz,vLw,vLc));if(ru<.7){vec3 V=normalize(cameraPosition-vLw),H=normalize(V+dl);float e=mix(120.,8.,ru*1.4),me=(vK.y&2)==2?1.:0.;o+=mix(vec3(.05),c,me)*dlc*pow(max(dot(n,H),0.),e)*nl*(1.-ru)*(me>.5?2.2:1.4)+mix(vec3(.04),c*.5,me)*hs*pow(1.-max(dot(n,V),0.),4.)*(1.-ru);}
gl_FragColor=vec4(o,1.);
#include <fog_fragment>
}`}); Object.assign(m.uniforms, UNI); m.userData.solo = m.userData.noSepara = true; return m};
export const MATE = {n: crea(), i: crea(), c: crea(), d: crea({side: THREE.DoubleSide, defines: {DOBLE: 1}}), m: crea(), md: crea({side: THREE.DoubleSide, defines: {DOBLE: 1}})};
/* todas las que esperan, de golpe (al arrancar o al saltar a otra maqueta) */
export function subeTodas(renderer) {for (let k = 0; k < 60 && cola.length; k++) {const n = cola.length; sube1(renderer); if (cola.length === n) break}}

/* sube una foto o un lienzo a su capa cuando está listo */
export function sube1(renderer) {
  if (!cola.length) return; const k = cola.findIndex(q => {const im = q.im(); return im && (im.complete === undefined || im.complete) && im.width}); if (k < 0) return; const {im: f, c, flip} = cola.splice(k, 1)[0], im = f(); let s = im; if (im.width !== P || im.height !== P || flip) {s = document.createElement('canvas'); s.width = s.height = P; const g = s.getContext('2d'); if (flip) {g.translate(0, P); g.scale(1, -1)} g.drawImage(im, 0, 0, P, P)}
  renderer.initTexture(tFotos); const gl = renderer.getContext(), t = renderer.properties.get(tFotos).__webglTexture; renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, c, P, P, 1, gl.RGBA, gl.UNSIGNED_BYTE, s); if (!cola.length) gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
}
function capa(t) {const k = t.source.uuid; if (capaDe.has(k)) return capaDe.get(k); if (nCapas >= MAXC) return -1; const c = nCapas++; capaDe.set(k, c); cola.push({im: () => t.source.data, c, flip: t.flipY}); return c}
/* qué se puede pasar a este material */
const POR = /^(cut|nieve|gas|juguete|onBeforeCompile)/;
function apto(m) {
  if (!m || m.transparent || m.alphaTest || m.side === THREE.BackSide || (m.side === THREE.DoubleSide && m.map) || m.userData.vivo || m.isShaderMaterial) return false; const b = m.isMeshBasicMaterial; if (!b && !m.isMeshStandardMaterial) return false; if (!POR.test(String(m.customProgramCacheKey()).trim())) return false;
  if (!b && m.emissive && m.emissive.getHex() && m.emissiveIntensity > .3 && m.emissive.r + m.emissive.g + m.emissive.b > .3) return false; if (m.map) {if (b && !m.userData.comun) return false; const im = m.map.source.data; if (m.map.wrapS === THREE.MirroredRepeatWrapping) return false; if (im && im.width > P) return false; if (m.map.repeat.x !== 1 || m.map.repeat.y !== 1 || m.map.offset.x || m.map.offset.y || m.map.rotation || capa(m.map) < 0) return false} return true;
}
const cc = new THREE.Color(), ID = new THREE.Matrix4();
/* añade a una geometría el color por vértice y los datos del material (capa, marcas, rugosidad, nieve) */
function viste(g0, m, sinIndice) {
  let g = g0; if (sinIndice && g.index) g = g.toNonIndexed(); const n = g.attributes.position.count, b = m.isMeshBasicMaterial, vc = m.vertexColors && g.attributes.color, co = new Uint8Array(n * 4), q8 = x => Math.min(255, Math.sqrt(Math.max(0, x) * .25) * 255 + .5), ca = new Uint8Array(n * 4); cc.copy(m.color); if (!b && m.metalness > .5) cc.multiplyScalar(1.15); if (!b && m.emissive && m.emissive.getHex()) cc.addScaledVector ? 0 : 0; {const a = vc && !vc.isInterleavedBufferAttribute && !vc.normalized ? vc.array : null, w = vc ? vc.itemSize : 3; if (!vc) new Uint32Array(co.buffer).fill(q8(cc.r) | q8(cc.g) << 8 | q8(cc.b) << 16); else for (let i = 0; i < n; i++) {co[i * 4] = q8(cc.r * (a ? a[i * w] : vc.getX(i))); co[i * 4 + 1] = q8(cc.g * (a ? a[i * w + 1] : vc.getY(i))); co[i * 4 + 2] = q8(cc.b * (a ? a[i * w + 2] : vc.getZ(i)))}}
  let q = 0; if (m.map) q = capa(m.map) + 1; let nv = 0; const N = m.userData.nieve; if (N) {const k = N.join(); if (!nvDe.has(k) && nvDe.size < 7) {nvDe.set(k, nvDe.size + 1); UNI.nv.value[nvDe.size].set(N[0], N[1], N[2], 1)} nv = nvDe.get(k) || 0} const fl = (String(m.customProgramCacheKey()).startsWith('gas') ? 8 : 0) | (b ? 1 : 0) | (!b && m.metalness > .5 ? 2 : 0) | (b || String(m.customProgramCacheKey()).startsWith('gas') ? 0 : (m.userData.ac || 0) << 4), ru = b ? 255 : Math.round(m.roughness * 255); new Uint32Array(ca.buffer).fill(q | fl << 8 | ru << 16 | nv << 24);
  const h = new THREE.BufferGeometry(); h.setAttribute('position', g.attributes.position); h.setAttribute('normal', g.attributes.normal); h.setAttribute('uv', g.attributes.uv || new THREE.BufferAttribute(new Float32Array(n * 2), 2)); h.setAttribute('color', new THREE.BufferAttribute(co, 4, true)); h.setAttribute('capa', new THREE.BufferAttribute(ca, 4)); {const pv = new Int16Array(n * 2), A = g.attributes.ac && g.attributes.ac.array; if (A) for (let i = 0; i < n; i++) {pv[i * 2] = A[i * 3 + 1] * 255; pv[i * 2 + 1] = Math.max(-32000, Math.min(32000, A[i * 3 + 2] * 256)); ca[i * 4 + 1] |= A[i * 3] << 4} h.setAttribute('piv', new THREE.BufferAttribute(pv, 2))} if (g.index) h.setIndex(g.index); return h;
}
const junta = L => {const n = L.reduce((s, g) => s + g.attributes.position.count, 0), h = new THREE.BufferGeometry(); for (const [k, w, T] of [['position', 3, Float32Array], ['normal', 3, Float32Array], ['uv', 2, Float32Array], ['color', 4, Uint8Array], ['capa', 4, Uint8Array], ['piv', 2, Int16Array]]) {const a = new T(n * w); let o = 0; for (const g of L) {const q = g.attributes[k]; if (q.array.constructor === T && !q.isInterleavedBufferAttribute) a.set(q.array.subarray(0, q.count * w), o); else for (let i = 0; i < q.count; i++) for (let c = 0; c < w; c++) a[o + i * w + c] = q.getComponent(i, c); o += q.count * w} h.setAttribute(k, new THREE.BufferAttribute(a, w, k === 'color'))} return h};
/* funde lo fijo de cada grupo y cambia el material del resto; cede de vez en cuando */
export function* compacta(root, niv = null) {
  const pares = new Map(), otros = []; root.traverse(o => {if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || !apto(o.material) || o.geometry.morphAttributes.position) return; if (!o.isInstancedMesh && !o.children.length && o.visible && (o.userData.fijo || (o.parent === root && (o.updateMatrix(), o.matrix.equals(ID))))) {const D = o.material.side === THREE.DoubleSide ? 1 : 0, P = pares.get(o.parent) || [[], []]; pares.set(o.parent, P); P[D].push(o)} else if (o.material.side === THREE.FrontSide) otros.push(o)});
  const mueve = (o, g) => {o.updateMatrix(); const e = o.matrix.elements; if (e[12] || e[13] || e[14] || e[0] !== 1 || e[5] !== 1 || e[10] !== 1) {g.setAttribute('position', g.attributes.position.clone()); g.setAttribute('normal', g.attributes.normal.clone()); g.applyMatrix4(o.matrix)} return g}, junto = (G, dob) => {const me = new THREE.Mesh(G.length > 1 ? junta(G) : G[0], dob ? MATE.d : MATE.n); me.matrixAutoUpdate = false; me.updateMatrix(); me.userData.ligera = true; return me};
  for (const [p, LL] of pares) for (const [dob, L] of LL.entries()) {
    if (!L.length) continue; yield; const nv = L.reduce((s, o) => s + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count), 0), id = nv > 2400 ? abre(niv, p, dob ? MATE.md : MATE.m, 24, () => p.add(junto(L.map(o => mueve(o, viste(o.geometry, o.material, true))), dob))) : 0;
    if (id) {let n = 0; for (const o of L) {manda(id, mueve(o, viste(o.geometry, o.material, false))); if ((n += o.geometry.attributes.position.count) > 5000) {n = 0; yield}} cierra(id); L.forEach(o => p.remove(o)); continue}
    const G = []; for (const o of L) {G.push(mueve(o, viste(o.geometry, o.material, true))); if (G.length % 6 === 5) yield} const me = junto(G, dob); L.forEach(o => p.remove(o)); p.add(me); if (niv && nv > 2400) {yield; nivela1(me, niv, 24, dob ? MATE.md : MATE.m)}
  }
  // instancias hermanas (mismas matrices): van en una sola, y el color de instancia solo tiñe lo que lo llevaba
  const quita = new Set(); for (const o of otros) {const H = o.isInstancedMesh && o.userData.con; if (!H || quita.has(o)) continue; const L = [o, ...H].filter(q => otros.includes(q)); if (L.length < 2) continue; yield; const con = L.find(q => q.instanceColor), G = L.map(q => {const g = viste(q.geometry, q.material, true); if (con && !q.instanceColor) {const a = g.attributes.capa.array; for (let i = 1; i < a.length; i += 4) a[i] |= 4} return g}); o.geometry = junta(G); if (con && con !== o) o.instanceColor = con.instanceColor; o.material = con ? MATE.c : MATE.i; L.slice(1).forEach(q => {quita.add(q); if (q.parent) q.parent.remove(q)}); quita.add(o); if (niv) {yield; nivela1(o, niv)}}
  yield; for (const o of otros) {if (quita.has(o)) continue; o.geometry = viste(o.geometry, o.material, false); o.material = o.isInstancedMesh ? (o.instanceColor ? MATE.c : MATE.i) : MATE.n; const g = o.geometry, nt = (g.index ? g.index.count : g.attributes.position.count) / 3; if (niv && nt > 40 && nt * (o.isInstancedMesh ? o.count : 1) > 700) {yield; nivela1(o, niv)}}
}
/* lo quieto de la calle (atrezo, guirnaldas, coronas): la luz de las sondas se calcula una vez por vértice y queda pintada, así que no
   necesita luces. Lo liso va en una malla y cada foto recortada, en otra */
export function pintaCalle(root, bloques, K = .95) {
  const L = [], H = new Float32Array(12), v = new THREE.Vector3(), n = new THREE.Vector3(); root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); root.traverse(o => {if (o.isMesh && !o.isInstancedMesh && !o.material.transparent) L.push(o)}); const grupos = new Map();
  for (const o of L) {
    const m = o.material, g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), NM = new THREE.Matrix3().getNormalMatrix(M), P = g.attributes.position, N = g.attributes.normal, n0 = P.count, vc = m.vertexColors && g.attributes.color, po = new Float32Array(n0 * 3), co = new Float32Array(n0 * 3), basic = m.isMeshBasicMaterial, em = m.emissive && !m.map ? m.emissive : null, ek = em ? m.emissiveIntensity : 0, al = m.map ? .05 : 0;
    const memo = new Map(); for (let i = 0; i < n0; i++) {v.fromBufferAttribute(P, i).applyMatrix4(M); v.toArray(po, i * 3); let r = m.color.r, gg = m.color.g, b = m.color.b; if (vc) {r *= vc.getX(i); gg *= vc.getY(i); b *= vc.getZ(i)} if (!basic) {n.fromBufferAttribute(N, i).applyMatrix3(NM).normalize(); const k = Math.round(v.x / 9) + '_' + Math.round(v.y / 9) + '_' + Math.round(v.z / 9); let h = memo.get(k); if (!h) memo.set(k, h = bloques.sonda(v.x, v.y, Math.min(400, Math.max(10, v.z)), () => 1, H).slice()); const q = c => Math.max(0, h[c] * .25 + (h[3 + c] * n.x + h[6 + c] * n.y + h[9 + c] * n.z) * .5) * K * .31831 + al, t = (c) => c > .9 ? .9 + (c - .9) * .25 : c; r = r * t(q(0)) + (em ? em.r * ek : 0); gg = gg * t(q(1)) + (em ? em.g * ek : 0); b = b * t(q(2)) + (em ? em.b * ek : 0)} co[i * 3] = r; co[i * 3 + 1] = gg; co[i * 3 + 2] = b}
    const k = m.map ? m.map.uuid : 'liso'; if (!grupos.has(k)) grupos.set(k, {m, G: []}); grupos.get(k).G.push({po, co, uv: m.map ? g.attributes.uv.array : null});
  }
  L.forEach(o => o.parent.remove(o)); for (const {m, G} of grupos.values()) {
    const n0 = G.reduce((s, q) => s + q.po.length / 3, 0), h = new THREE.BufferGeometry(), junto = (c, w) => {const a = new Float32Array(n0 * w); let o = 0; for (const q of G) {a.set(q[c], o); o += q[c].length} return new THREE.BufferAttribute(a, w)}; h.setAttribute('position', junto('po', 3)); h.setAttribute('color', junto('co', 3)); if (m.map) h.setAttribute('uv', junto('uv', 2));
    const mm = new THREE.MeshBasicMaterial({vertexColors: true, map: m.map, alphaTest: m.alphaTest, side: m.side}); if (m.map && m.alphaTest) mm.onBeforeCompile = s => {s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n{vec2 dX=dFdx(vMapUv*512.),dY=dFdy(vMapUv*512.);diffuseColor.a*=1.+.24*max(0.,.5*log2(max(dot(dX,dX),dot(dY,dY))));}')}; mm.userData.solo = mm.userData.noSepara = true; const me = new THREE.Mesh(h, mm); me.matrixAutoUpdate = false; me.updateMatrix(); root.add(me);
  }
}
