/* Caras esculpidas (m/gente, scripts/esculpe.mjs): piel con algo de dispersión, ojos con iris y córnea, párpados que giran y
   gestos por morphs. Cada Cara es un grupo con el origen en la base del cuello. */
import {THREE, LOWQ, lerp, clamp} from './kit.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {MEDIDAS} from './esc-medidas.js';

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); const PZ = {};
/* carga las piezas esculpidas y deja sus geometrías listas */
export async function cargaGente(L) {
  await Promise.all(L.map(async id => {const g = await loader.loadAsync(`m/gente/${id}.glb`), o = {}; g.scene.updateMatrixWorld(true); g.scene.traverse(m => {if (m.isMesh) o[m.name] = geo(m)}); PZ[id] = o}));
}
/* deja la geometría en metros y en floats (los morphs cuantizados van en la misma escala que la posición) */
function geo(m) {
  const g0 = m.geometry, g = new THREE.BufferGeometry(), M = m.matrixWorld, n = g0.attributes.position.count, f = (a, s, fn) => {const o = new Float32Array(n * s); for (let i = 0; i < n; i++) fn(a, i, o); return new THREE.BufferAttribute(o, s)}, v = new THREE.Vector3(), N3 = new THREE.Matrix3().getNormalMatrix(M), L3 = new THREE.Matrix3().setFromMatrix4(M);
  g.setAttribute('position', f(g0.attributes.position, 3, (a, i, o) => {v.fromBufferAttribute(a, i).applyMatrix4(M); o.set([v.x, v.y, v.z], i * 3)})); g.setAttribute('normal', f(g0.attributes.normal, 3, (a, i, o) => {v.fromBufferAttribute(a, i).applyMatrix3(N3).normalize(); o.set([v.x, v.y, v.z], i * 3)})); g.setAttribute('mk', f(g0.attributes.color, 4, (a, i, o) => o.set([a.getX(i), a.getY(i), a.getZ(i), a.getW(i)], i * 4))); if (g0.attributes.uv) g.setAttribute('uv', f(g0.attributes.uv, 2, (a, i, o) => o.set([a.getX(i), a.getY(i)], i * 2)));
  if (g0.index) g.setIndex(g0.index); if (g0.morphAttributes.position) {g.morphAttributes.position = g0.morphAttributes.position.map(p => f(p, 3, (a, i, o) => {v.fromBufferAttribute(a, i).applyMatrix3(L3); o.set([v.x, v.y, v.z], i * 3)})); g.morphAttributes.normal = g0.morphAttributes.normal.map(p => f(p, 3, (a, i, o) => {v.fromBufferAttribute(a, i); o.set([v.x, v.y, v.z], i * 3)})); g.morphTargetsRelative = true; g.userData.morphs = m.morphTargetDictionary}
  return g;
}
export const pieza3 = (id, n) => PZ[id] && PZ[id][n];

/* ---------- piel ---------- */
const poros = (() => {const n = 128, d = new Uint8Array(n * n * 4), h = new Float32Array(n * n); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let q = 0; q < 900; q++) {const cx = r() * n, cy = r() * n, R = 1.6 + r() * 2.4, a = -.5 - r(); for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {const e = Math.hypot(x, y) / R; if (e < 1) h[((cy + y + n | 0) % n) * n + ((cx + x + n | 0) % n)] += a * (1 - e * e)}} const H = (x, y) => h[((y + n) % n) * n + ((x + n) % n)]; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {const dx = (H(x + 1, y) - H(x - 1, y)) * .55, dy = (H(x, y + 1) - H(x, y - 1)) * .55, l = Math.hypot(dx, dy, 1); d.set([(-dx / l * .5 + .5) * 255, (-dy / l * .5 + .5) * 255, (1 / l * .5 + .5) * 255, 255], (y * n + x) * 4)} const t = new THREE.DataTexture(d, n, n); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.repeat.set(13, 7); t.needsUpdate = true; return t})();
/* luz que entra y sale por otro sitio: el borde de la sombra se ablanda y se vuelve rojizo */
export const sss = s => {s.fragmentShader = s.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;', 'float dnl = dot( geometryNormal, directLight.direction );\n\tfloat dotNL = saturate( dnl );\n\tvec3 irradiance = dotNL * directLight.color;\n\tvec3 wr = vec3(.3,.16,.11)*vSub; vec3 dif = saturate((vec3(dnl)+wr)/(1.+wr)); dif = mix(dif, dif*dif, .35*vSub);').replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', 'reflectedLight.directDiffuse += dif * directLight.color * BRDF_Lambert( material.diffuseColor );')).replace('#include <common>', '#include <common>\nfloat vSub = 1.;')};
export const piel = LOWQ ? new THREE.MeshStandardMaterial({vertexColors: true, roughness: .54}) : new THREE.MeshPhysicalMaterial({vertexColors: true, roughness: .5, normalMap: poros, normalScale: new THREE.Vector2(.34, .34), sheen: .35, sheenRoughness: .55, sheenColor: new THREE.Color(0xffb9a0), envMapIntensity: .35});
/* el cristal: lo que de la cara pasaría de esa z se aplasta contra él (y se queda pálido) */
export const VIDRIO = {value: -1e5};
piel.onBeforeCompile = s => {sss(s); s.uniforms.uVid = VIDRIO; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float mt;varying float vMt,vAp;varying vec3 vPc;uniform float uVid;').replace('#include <project_vertex>', 'vec4 wPv=modelMatrix*vec4(transformed,1.);float pen=max(0.,uVid-wPv.z);vAp=clamp(pen*.9,0.,1.);if(pen>0.){vec4 nz=modelMatrix*vec4(.17,.058,0.,1.);vec2 dn=wPv.xy-nz.xy;wPv.xy+=dn*min(.9,pen*.8)*exp(-dot(dn,dn)*.5);wPv.z=uVid;}vec4 mvPosition=viewMatrix*wPv;gl_Position=projectionMatrix*mvPosition;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvMt=mt;vPc=position;'); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMt,vAp;varying vec3 vPc;float hP(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}float nP3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hP(i),hP(i+vec3(1,0,0)),f.x),mix(hP(i+vec3(0,1,0)),hP(i+vec3(1,1,0)),f.x),f.y),mix(mix(hP(i+vec3(0,0,1)),hP(i+vec3(1,0,1)),f.x),mix(hP(i+vec3(0,1,1)),hP(i+vec3(1,1,1)),f.x),f.y),f.z);}float peca(vec2 p){vec2 i=floor(p),f=fract(p);float o=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y);float h=hP(vec3(i+g,3.)),h2=hP(vec3(i+g,9.)),h3=hP(vec3(i+g,17.));if(h3<.42)continue;vec2 c=g+vec2(h,h2)*.8+.1-f;o=max(o,smoothstep(.26+.16*h3,.06,length(c))*(.45+.55*h));}return o;}').replace('#include <color_fragment>', '#include <color_fragment>\n{float pl=step(vMt,.33),a=nP3(vPc*42.),b=nP3(vPc*150.+7.),c=nP3(vPc*520.);diffuseColor.rgb*=1.+pl*((a-.5)*vec3(.03,.085,.1)+(b-.5)*vec3(.035,.06,.065)+(c-.5)*.045);float pe=clamp(vMt*4.,0.,1.)*pl*step(.02,vPc.x);if(pe>.01)diffuseColor.rgb*=1.-pe*peca(vec2(vPc.z,vPc.y)*215.)*vec3(.2,.36,.44);float lb=step(.34,vMt)*step(vMt,.48);float di=step(.46,vMt)*step(vMt,.58),zd=abs(vPc.z),td=abs(fract((zd<.0042?zd/.0084:(zd-.0042)/.0068)+(zd<.0042?.5:0.))-.5);diffuseColor.rgb*=1.-di*.34*(zd<.0042?smoothstep(.06,0.,abs(vPc.z)/.0084):smoothstep(.42,.5,td));diffuseColor.rgb*=1.+lb*(nP3(vec3(vPc.x*300.,vPc.y*160.,vPc.z*1100.))-.5)*.2;}\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.04,1.,.98)+.05,vAp*.7);').replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize(mix(normal,(viewMatrix*vec4(0.,0.,-1.,0.)).xyz,vAp*.75));').replace('#include <roughnessmap_fragment>', 'float roughnessFactor=vMt<.33?roughness+(nP3(vPc*90.)-.5)*.16:vMt<.412?.3:vMt<.45?.6:vMt<.55?.16:vMt<.62?.22:.72;').replace('#include <lights_physical_fragment>', 'vSub=step(vMt,.5);\n#include <lights_physical_fragment>'+(LOWQ?'':'\nmaterial.sheenColor*=step(vMt,.35);')).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{float rm=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),3.);totalEmissiveRadiance+=diffuseColor.rgb*step(.46,vMt)*step(vMt,.58)*.1;totalEmissiveRadiance+=diffuseColor.rgb*rm*vec3(.5,.42,.62)*.28;totalEmissiveRadiance+=diffuseColor.rgb*vec3(.17,.105,.07)*vSub;}')};
const _c = new THREE.Color(), _a = new THREE.Color(), RUB = new THREE.Color(), LAB = new THREE.Color();
/* colores por vértice a partir de las máscaras */
export function tinta(g0, {piel: p, pelo, labio, rubor = 1, pecas = 0}) {
  const g = g0.clone(), k = g.attributes.mk, n = k.count, c = new Float32Array(n * 3), mt = new Float32Array(n), P = new THREE.Color(p), H = new THREE.Color(pelo), L = new THREE.Color(labio ?? 0xc4615c), hsl = P.getHSL({}), osc = hsl.l < .4; RUB.copy(P).lerp(_a.set(osc ? 0x8a2f26 : 0xe2524a), osc ? .4 : .62); LAB.copy(P).lerp(L, osc ? .5 : .68);
  for (let i = 0; i < n; i++) {
    const ao = k.getX(i), rb = k.getY(i), lb = k.getZ(i), m = k.getW(i), x = g.attributes.position.getX(i), y = g.attributes.position.getY(i), z = g.attributes.position.getZ(i); let r = 0;
    if (m < .12) {_c.copy(P).lerp(RUB, Math.min(.92, rb * .74 * rubor)).lerp(LAB, lb); if (pecas) {const e = Math.exp(-(((y - .0705) / .0165) ** 2)) * Math.exp(-((Math.max(0, Math.abs(z) - .03) / .024) ** 2)) * (x > .03 ? 1 : 0); r = .25 * Math.min(1, pecas * e)} const A = Math.pow(ao, .8); _c.r *= Math.pow(A, .34); _c.g *= Math.pow(A, .7); _c.b *= Math.pow(A, .78); r = lb > .35 ? .4 : r}
    else if (m < .4) {_c.set(0x6e181d).multiplyScalar(lb > .6 ? 1.5 : .8 * ao); if (m < .24) _c.lerp(LAB, clamp(1 - m / .25, 0, 1) * .8); r = .42} else if (m < .6) {_c.set(0xf6f1e8).multiplyScalar(.95 * ao); r = .5} else if (m < .9) {_c.copy(H).lerp(P, .12).multiplyScalar((.85 + rb * .5) * ao); r = .8} else {_c.set(0x140d0a); r = 1}
    c.set([_c.r, _c.g, _c.b], i * 3); mt[i] = r;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('mt', new THREE.BufferAttribute(mt, 1)); g.deleteAttribute('mk'); return g;
}
/* ---------- ojos: el iris se pinta en el sombreador según hacia dónde mira ---------- */
const FIB = (() => {const n = 256, d = new Uint8Array(n * 4); let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, a = Array.from({length: n}, r); for (let i = 0; i < n; i++) {const v = (a[i] * .5 + a[(i + 1) % n] * .3 + a[(i + 2) % n] * .2); d.set([v * 255, a[(i * 7) % n] * 255, a[(i * 3) % n] * 255, 255], i * 4)} const t = new THREE.DataTexture(d, n, 1); t.wrapS = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t})();
export function matOjos(color = 0x5a3216) {
  const u = {gz: {value: new THREE.Vector3(1, 0, 0)}, iris: {value: new THREE.Color(color)}, fib: {value: FIB}, pup: {value: .5}, ri: {value: .6}, brillo: {value: 1}}, m = new THREE.MeshStandardMaterial({roughness: .07, color: 0xffffff, envMapIntensity: .9}); m.userData.u = u; m.customProgramCacheKey = () => 'ojos';
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, u); s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 dir;varying vec3 vD;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvD=dir;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vD;uniform vec3 gz,iris;uniform sampler2D fib;uniform float pup,ri,brillo;uniform mat3 normalMatrix;').replace('#include <color_fragment>', `
vec3 D=normalize(vD),G=normalize(gz);float dg=dot(D,G);vec3 T=D-G*dg;float rr=length(T);vec3 Vl=normalize(vViewPosition)*normalMatrix;Vl=normalize(Vl);vec3 Vt=Vl-G*dot(Vl,G);
float ins=step(0.,dg);vec3 ex=normalize(cross(vec3(0.,1.,0.),G)),ey=cross(G,ex);vec3 Tp=T-Vt*.13*smoothstep(ri,0.,rr);vec2 q=vec2(dot(Tp,ex),dot(Tp,ey));float ra=length(q),an=atan(q.y,q.x);
float f1=texture2D(fib,vec2(an*.6366,.5)).r,f2=texture2D(fib,vec2(an*1.2732+.3,.5)).g;float k=ra/ri;
float f3=texture2D(fib,vec2(an*2.6+.7,.5)).b;vec3 ic=iris*(.75+1.5*f1*smoothstep(.2,.9,k)+.5*(f3-.5));ic=mix(ic,iris*vec3(2.1,1.75,1.2)+.025,(.35+.5*f2)*smoothstep(.82,.5,k)*smoothstep(.36,.52,k));ic*=.62+1.35*smoothstep(.55,-.75,q.y/ri)*smoothstep(1.05,.55,k);ic*=1.-.86*smoothstep(.74,.98,k);
float pu=smoothstep(pup+.035,pup-.035,k);ic=mix(ic,vec3(.006,.005,.005),pu);
vec3 sc=vec3(.9,.875,.85);sc=mix(sc,vec3(.86,.66,.6),.22*smoothstep(.45,.98,abs(D.z)));
float mi=smoothstep(ri+.018,ri-.018,rr)*ins;vec3 oc=mix(sc,ic,mi);float som=smoothstep(.95,.18,D.y)*smoothstep(-1.1,-.35,D.y);oc*=mix(.5,1.,som)*mix(.62,1.,smoothstep(.98,.5,abs(D.z)));diffuseColor.rgb=oc;`).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{vec3 Gv=normalize(normalMatrix*G);float b=smoothstep(.66,.2,rr)*ins;normal=normalize(mix(normal,normalize(normal+(normal-Gv)*.75),b));}').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{vec3 V=normalize(vViewPosition),N=normalize(normal),Rf=reflect(-V,N);float h1=smoothstep(.955,.972,dot(Rf,normalize(vec3(-.36,.52,.78)))),h2=smoothstep(.97,.996,dot(Rf,normalize(vec3(.42,-.3,.86))));totalEmissiveRadiance+=vec3(1.,.98,.95)*(h1*1.5+h2*.32)*brillo;totalEmissiveRadiance+=ic*mi*.26*(1.-pu);float ag=smoothstep(-.4,-.48,D.y)*smoothstep(-.62,-.5,D.y)*smoothstep(.95,.6,abs(D.z));totalEmissiveRadiance+=vec3(.55,.5,.5)*ag*.12*brillo;}`);
  };
  return m;
}
const geoOjos = {};
function ojosGeo(id) {if (geoOjos[id]) return geoOjos[id]; const {E, R, yaw = 0} = MEDIDAS[id], P = [], D = [], I = [], ca = Math.cos(yaw * .72), sa = Math.sin(yaw * .72); let b = 0; for (const s of [-1, 1]) {const g = new THREE.SphereGeometry(1, 30, 22).rotateZ(-Math.PI / 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) {P.push(E[0] + p.getX(i) * R, E[1] + p.getY(i) * R, s * E[2] + p.getZ(i) * R); D.push(p.getX(i) * ca + p.getZ(i) * s * sa, p.getY(i), p.getZ(i) * ca - p.getX(i) * s * sa)} for (const i of g.index.array) I.push(i + b); b += p.count} const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(D, 3)); g.setAttribute('dir', new THREE.Float32BufferAttribute(D, 3)); g.setIndex(I); return geoOjos[id] = g}

/* gesto → pesos de los morphs y apertura de los párpados */
const GESTOS = {
  son: {son: .66, cierra: 1, parp: .96}, risa: {son: 1, abre: .86, cejaAlza: .45, parp: .86}, o: {o: .8, abre: .58, cejaAlza: .85, parp: 1.0}, seria: {cejaFrunce: .12, triste: .18, cierra: 1, parp: .92}, triste: {triste: .95, cejaPena: 1, cierra: 1, parp: .74}, duerme: {son: .3, cierra: 1, parp: .02}, pena: {triste: .55, cejaPena: .8, cierra: 1, parp: .62},
};
export class Cara {
  constructor(id, col) {
    const M = this.M = MEDIDAS[id]; this.g = new THREE.Group(); const g0 = pieza3(id, 'cara'), gc = tinta(g0, col); gc.morphTargetsRelative = true; const m = this.malla = new THREE.Mesh(gc, piel); this.dic = g0.userData.morphs; m.morphTargetInfluences = new Array(gc.morphAttributes.position.length).fill(0); m.morphTargetDictionary = this.dic; this.g.add(m);
    this.mo = matOjos(col.ojos); this.mo.userData.u.ri.value = M.ri || .6; this.ojos = new THREE.Mesh(ojosGeo(id), this.mo); this.g.add(this.ojos); const gp = tinta(pieza3(id, 'parpados'), col); gp.translate(-M.E[0], -M.E[1], 0); this.par = new THREE.Mesh(gp, piel); this.par.position.set(M.E[0], M.E[1], 0); this.g.add(this.par);
    this.aa = Math.asin(Math.min(.95, M.au)) - .03; this.ac = -Math.asin(Math.min(.95, M.al)) * .8; this.w = {}; this.parp = .97; this.pon('son'); this.y = this.p = 0; this.paso(1, 0);
  }
  pon(g) {this.gesto = g; this.obj = GESTOS[g] || GESTOS.son}
  /* y, p: hacia dónde miran los ojos respecto a la cabeza; guino: 1 abierto, 0 cerrado */
  paso(dt, y = 0, p = 0, guino = 1) {
    const k = 1 - Math.exp(-7 * dt), d = this.dic, inf = this.malla.morphTargetInfluences; for (const n in d) inf[d[n]] = this.w[n] = lerp(this.w[n] || 0, this.obj[n] || 0, k); this.parp = lerp(this.parp, this.obj.parp, k);
    const e = 1 - Math.exp(-22 * dt); this.y = lerp(this.y, clamp(y, -.62, .62), e); this.p = lerp(this.p, clamp(p, -.5, .42), e); const cp = Math.cos(this.p); this.mo.userData.u.gz.value.set(Math.cos(this.y) * cp, Math.sin(this.p), -Math.sin(this.y) * cp);
    const ab = clamp(this.parp, -.1, 1.1) * guino; this.par.rotation.z = lerp(this.ac, this.aa, ab) + this.p * .42 * Math.max(0, ab);
  }
}
