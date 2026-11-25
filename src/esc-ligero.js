/* Las maquetas en el móvil: todo lo que es un color liso o una foto conocida se funde por grupo y lleva un solo material barato
   (sol, cielo, luz local y faro calculados aquí, sin las luces de three). Lo raro (agua, terreno, ramas, rótulos) se queda como está. */
import {THREE, CUT} from './kit.js';
import {ULZ, LUZ_GLSL, LUZ_VERT} from './esc-luz.js';

const P = 512, MAXC = 24; let nCapas = 0; const capaDe = new Map(), cola = [];
const tFotos = new THREE.DataArrayTexture(null, P, P, MAXC); tFotos.format = THREE.RGBAFormat; tFotos.type = THREE.UnsignedByteType; tFotos.colorSpace = THREE.SRGBColorSpace; tFotos.wrapS = tFotos.wrapT = THREE.RepeatWrapping; tFotos.magFilter = THREE.LinearFilter; tFotos.minFilter = THREE.LinearMipmapLinearFilter; tFotos.generateMipmaps = true; tFotos.anisotropy = 2; tFotos.source.dataReady = false; tFotos.needsUpdate = true;
/* nieve que se posa: umbrales de cada tipo */
const NV = [new THREE.Vector4(2, 3, 0, 0)], nvDe = new Map();
/* luz de dentro (la pone ambienta() en escaparates.js): hacia el sol, su color y el cielo */
export const LDEN = {dl: {value: new THREE.Vector3(0, 1, 0)}, dlc: {value: new THREE.Color()}, hs: {value: new THREE.Color()}, hg: {value: new THREE.Color()}};
const UNI = {...ULZ, ...LDEN, tF: {value: tFotos}, nv: {value: Array.from({length: 8}, () => new THREE.Vector4(2, 3, 0, 1))}, cutA: CUT.a, cutB: CUT.b, cutR: CUT.r, fogColor: {value: new THREE.Color()}, fogNear: {value: 1}, fogFar: {value: 2}};
const RUIDO = 'float hR(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}float nR(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hR(i),hR(i+vec3(1,0,0)),f.x),mix(hR(i+vec3(0,1,0)),hR(i+vec3(1,1,0)),f.x),f.y),mix(mix(hR(i+vec3(0,0,1)),hR(i+vec3(1,0,1)),f.x),mix(hR(i+vec3(0,1,1)),hR(i+vec3(1,1,1)),f.x),f.y),f.z);}';
const crea = () => {const m = new THREE.ShaderMaterial({fog: true, uniforms: {}, vertexShader: `attribute vec3 color;attribute vec4 capa;varying vec2 vU;varying vec3 vN,vC,vPo;flat varying ivec4 vK;uniform vec3 cutA,cutB;uniform float cutR;uniform mat4 lzI;uniform float lzF,lzP;varying vec3 vLz,vLw;varying float vLc;
#include <common>
#include <fog_pars_vertex>
void main(){vec3 transformed=position,n=normal;vPo=position;vC=color;vK=ivec4(capa+.5);
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
}`, fragmentShader: `precision highp sampler2DArray;uniform sampler2DArray tF,lzT;uniform vec4 nv[8];uniform vec3 dl,dlc,hs,hg;uniform float lzK;uniform vec4 faP;uniform vec3 faD;varying vec2 vU;varying vec3 vN,vC,vPo,vLz,vLw;flat varying ivec4 vK;varying float vLc;
#include <fog_pars_fragment>
${RUIDO}
${LUZ_GLSL}
void main(){vec3 c=vC;if(vK.x>0)c*=texture(tF,vec3(vU,float(vK.x-1))).rgb;if((vK.y&1)==1){gl_FragColor=vec4(c,1.);
#include <fog_fragment>
return;}
vec3 n=normalize(vN);float ru=float(vK.z)/255.;if(vK.w>0){vec4 q=nv[vK.w];float s=smoothstep(q.x,q.y,n.y+(nR(vPo*1.9)-.5)*.3)*q.z;c=mix(c,vec3(.84,.885,.96)*(.96+.06*nR(vPo*5.)),s);ru=mix(ru,.84,s);}
float nl=max(dot(n,dl),0.);vec3 irr=mix(hg,hs,.5*n.y+.5)+dlc*nl,o=c*(irr*.31831+luzLocal(n,vLz,vLw,vLc));if(ru<.7){vec3 V=normalize(cameraPosition-vLw),H=normalize(V+dl);float e=mix(120.,8.,ru*1.4),me=(vK.y&2)==2?1.:0.;o+=mix(vec3(.05),c,me)*dlc*pow(max(dot(n,H),0.),e)*nl*(1.-ru)*(me>.5?2.2:1.4)+mix(vec3(.04),c*.5,me)*hs*pow(1.-max(dot(n,V),0.),4.)*(1.-ru);}
gl_FragColor=vec4(o,1.);
#include <fog_fragment>
}`}); Object.assign(m.uniforms, UNI); m.userData.solo = m.userData.noSepara = true; return m};
export const MATE = {n: crea(), i: crea(), c: crea()};
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
  if (!m || m.transparent || m.alphaTest || m.side !== THREE.FrontSide || m.userData.vivo || m.isShaderMaterial) return false; const b = m.isMeshBasicMaterial; if (!b && !m.isMeshStandardMaterial) return false; if (!POR.test(String(m.customProgramCacheKey()).trim())) return false;
  if (!b && m.emissive && m.emissive.getHex() && m.emissiveIntensity > .3 && m.emissive.r + m.emissive.g + m.emissive.b > .3) return false; if (m.map) {const im = m.map.source.data; if (m.map.wrapS === THREE.MirroredRepeatWrapping) return false; if (im && im.width > P) return false; if (m.map.repeat.x !== 1 || m.map.repeat.y !== 1 || m.map.offset.x || m.map.offset.y || m.map.rotation) return false} return true;
}
const cc = new THREE.Color(), ID = new THREE.Matrix4();
/* añade a una geometría el color por vértice y los datos del material (capa, marcas, rugosidad, nieve) */
function viste(g0, m, sinIndice) {
  let g = g0; if (sinIndice && g.index) g = g.toNonIndexed(); const n = g.attributes.position.count, b = m.isMeshBasicMaterial, vc = m.vertexColors && g.attributes.color, co = new Float32Array(n * 3), ca = new Uint8Array(n * 4); cc.copy(m.color); if (!b && m.metalness > .5) cc.multiplyScalar(1.15); if (!b && m.emissive && m.emissive.getHex()) cc.addScaledVector ? 0 : 0; for (let i = 0; i < n; i++) {co[i * 3] = cc.r * (vc ? vc.getX(i) : 1); co[i * 3 + 1] = cc.g * (vc ? vc.getY(i) : 1); co[i * 3 + 2] = cc.b * (vc ? vc.getZ(i) : 1)}
  let q = 0; if (m.map) q = capa(m.map) + 1; let nv = 0; const N = m.userData.nieve; if (N) {const k = N.join(); if (!nvDe.has(k) && nvDe.size < 7) {nvDe.set(k, nvDe.size + 1); UNI.nv.value[nvDe.size].set(N[0], N[1], N[2], 1)} nv = nvDe.get(k) || 0} const fl = (b ? 1 : 0) | (!b && m.metalness > .5 ? 2 : 0), ru = b ? 255 : Math.round(m.roughness * 255); for (let i = 0; i < n; i++) ca.set([q, fl, ru, nv], i * 4);
  const h = new THREE.BufferGeometry(); h.setAttribute('position', g.attributes.position); h.setAttribute('normal', g.attributes.normal); h.setAttribute('uv', g.attributes.uv || new THREE.BufferAttribute(new Float32Array(n * 2), 2)); h.setAttribute('color', new THREE.BufferAttribute(co, 3)); h.setAttribute('capa', new THREE.BufferAttribute(ca, 4)); if (g.index) h.setIndex(g.index); return h;
}
const junta = L => {const n = L.reduce((s, g) => s + g.attributes.position.count, 0), h = new THREE.BufferGeometry(); for (const [k, w, T] of [['position', 3, Float32Array], ['normal', 3, Float32Array], ['uv', 2, Float32Array], ['color', 3, Float32Array], ['capa', 4, Uint8Array]]) {const a = new T(n * w); let o = 0; for (const g of L) {const q = g.attributes[k]; if (q.array.constructor === T && !q.isInterleavedBufferAttribute) a.set(q.array.subarray(0, q.count * w), o); else for (let i = 0; i < q.count; i++) for (let c = 0; c < w; c++) a[o + i * w + c] = q.getComponent(i, c); o += q.count * w} h.setAttribute(k, new THREE.BufferAttribute(a, w))} return h};
/* funde lo fijo de cada grupo y cambia el material del resto; cede de vez en cuando */
export function* compacta(root, no = () => false) {
  const pares = new Map(), otros = []; root.traverse(o => {if (!o.isMesh || o.isSkinnedMesh || no(o) || Array.isArray(o.material) || !apto(o.material) || o.geometry.morphAttributes.position) return; if (!o.isInstancedMesh && !o.children.length && o.visible && (o.userData.fijo || (o.parent === root && (o.updateMatrix(), o.matrix.equals(ID))))) {if (!pares.has(o.parent)) pares.set(o.parent, []); pares.get(o.parent).push(o)} else otros.push(o)});
  for (const [p, L] of pares) {yield; const G = []; for (const o of L) {const g = viste(o.geometry, o.material, true); o.updateMatrix(); const e = o.matrix.elements; if (e[12] || e[13] || e[14] || e[0] !== 1 || e[5] !== 1 || e[10] !== 1) {g.setAttribute('position', g.attributes.position.clone()); g.setAttribute('normal', g.attributes.normal.clone()); g.applyMatrix4(o.matrix)} G.push(g); if (G.length % 6 === 5) yield} const me = new THREE.Mesh(G.length > 1 ? junta(G) : G[0], MATE.n); me.matrixAutoUpdate = false; me.updateMatrix(); me.userData.ligera = true; L.forEach(o => p.remove(o)); p.add(me)}
  // instancias hermanas (mismas matrices): van en una sola, y el color de instancia solo tiñe lo que lo llevaba
  const quita = new Set(); for (const o of otros) {const H = o.isInstancedMesh && o.userData.con; if (!H || quita.has(o)) continue; const L = [o, ...H].filter(q => otros.includes(q)); if (L.length < 2) continue; yield; const con = L.find(q => q.instanceColor), G = L.map(q => {const g = viste(q.geometry, q.material, true); if (con && !q.instanceColor) {const a = g.attributes.capa.array; for (let i = 1; i < a.length; i += 4) a[i] |= 4} return g}); o.geometry = junta(G); if (con && con !== o) o.instanceColor = con.instanceColor; o.material = con ? MATE.c : MATE.i; L.slice(1).forEach(q => {quita.add(q); if (q.parent) q.parent.remove(q)}); quita.add(o)}
  yield; for (const o of otros) {if (quita.has(o)) continue; o.geometry = viste(o.geometry, o.material, false); o.material = o.isInstancedMesh ? (o.instanceColor ? MATE.c : MATE.i) : MATE.n}
}
