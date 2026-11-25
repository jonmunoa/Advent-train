/* Personas realistas (MakeHuman, CC0): cabeza con gestos, pelo y ropa simulada sin conexión (scripts/personas). Se montan sobre el
   mismo esqueleto que usan las escenas (Figura.huesos). Cada figura lleva sus materiales porque cada una recoge su luz (sondas). */
import {THREE, LOWQ, lerp, clamp} from './kit.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {matOjos, sss, VIDRIO} from './esc-cara.js';

const PM = {}, T = new THREE.TextureLoader(), TX = {}; let cargador = null;
const tx = (f, srgb) => TX[f] ||= (() => {const t = T.load('m/gente2/' + f); t.flipY = false; t.anisotropy = LOWQ ? 2 : 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t})();
/* aRatos: convierte una pieza cada vez, para no parar la imagen */
export async function cargaPersonas(ids, aRatos = false) {
  cargador ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); await Promise.all(ids.map(async id => {if (PM[id]) return; const g = await cargador.loadAsync(`m/gente2/${id}${LOWQ && !id.endsWith('_l') ? '_m' : ''}.glb`), o = {m: {}, x: g.scene.userData.D ? g.scene.userData : g.userData}; g.scene.updateMatrixWorld(true); const L = []; g.scene.traverse(m => {if (m.isMesh) L.push(m)}); for (const m of L) {o.m[m.name] = plana(m); if (aRatos) await new Promise(r => setTimeout(r, 12))} PM[id] = o}));
}
export const persona = id => PM[id];
export const trozo = (id, n) => PM[id] && PM[id].m[n];
/* geometría en metros y en floats, para que huesos y gestos vayan en la misma escala */
function plana(m) {
  const g0 = m.geometry, g = new THREE.BufferGeometry(), M = m.matrixWorld, n = g0.attributes.position.count, v = new THREE.Vector3(), L3 = new THREE.Matrix3().setFromMatrix4(M), f = (a, s, fn) => {const o = new Float32Array(n * s); for (let i = 0; i < n; i++) fn(a, i, o); return new THREE.BufferAttribute(o, s)};
  g.setAttribute('position', f(g0.attributes.position, 3, (a, i, o) => {v.fromBufferAttribute(a, i).applyMatrix4(M); o.set([v.x, v.y, v.z], i * 3)})); g.setAttribute('normal', f(g0.attributes.normal, 3, (a, i, o) => {v.fromBufferAttribute(a, i).normalize(); o.set([v.x, v.y, v.z], i * 3)})); g.setAttribute('uv', f(g0.attributes.uv, 2, (a, i, o) => o.set([a.getX(i), a.getY(i)], i * 2))); if (g0.attributes.color) g.setAttribute('color', f(g0.attributes.color, 4, (a, i, o) => o.set([a.getX(i), a.getY(i), a.getZ(i), a.getW(i)], i * 4)));
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), A = g0.attributes.skinIndex, B = g0.attributes.skinWeight; for (let i = 0; i < n; i++) {si.set([A.getX(i), A.getY(i), A.getZ(i), A.getW(i)], i * 4); const w = [B.getX(i), B.getY(i), B.getZ(i), B.getW(i)], s = w[0] + w[1] + w[2] + w[3] || 1; sw.set(w.map(q => q / s), i * 4)} g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setIndex(g0.index);
  if (g0.morphAttributes.position) {g.morphAttributes.position = g0.morphAttributes.position.map(p => f(p, 3, (a, i, o) => {v.fromBufferAttribute(a, i).applyMatrix3(L3); o.set([v.x, v.y, v.z], i * 3)})); g.morphAttributes.normal = g0.morphAttributes.normal.map(p => f(p, 3, (a, i, o) => {v.fromBufferAttribute(a, i); o.set([v.x, v.y, v.z], i * 3)})); g.morphTargetsRelative = true; g.userData.morphs = m.morphTargetDictionary} return g;
}
/* ---------- materiales ---------- */
/* luz de las sondas: armónicos de orden 1 (irradiancia) que cada figura recibe donde está */
export const SONDA_G = 'uniform vec3 shS[4];uniform float shK;vec3 luzSonda(vec3 n){vec3 w=normalize((vec4(n,0.)*viewMatrix).xyz);return max(vec3(0.),shS[0]*.25+(shS[1]*w.x+shS[2]*w.y+shS[3]*w.z)*.5)*shK;}';
const conSonda = (s, U) => {Object.assign(s.uniforms, U); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + SONDA_G).replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\nirradiance+=luzSonda(normal);')};
const vidrio = s => {s.uniforms.uVid = VIDRIO; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uVid;varying float vAp;').replace('#include <project_vertex>', 'vec4 wPv=modelMatrix*vec4(transformed,1.);float pen=max(0.,uVid-wPv.z);vAp=clamp(pen*.9,0.,1.);wPv.z=max(wPv.z,uVid);vec4 mvPosition=viewMatrix*wPv;gl_Position=projectionMatrix*mvPosition;')};
const RUIDO = 'float hQ(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}float nQ(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hQ(i),hQ(i+vec2(1,0)),f.x),mix(hQ(i+vec2(0,1)),hQ(i+vec2(1,1)),f.x),f.y);}';
/* tela: color, oclusión horneada en el alfa del vértice, relieve de paño o de punto y pelusilla en los bordes */
function tela(U, c, {tipo = 'paño', raya = null, nor = null, dos = true} = {}) {
  const m = new THREE.MeshStandardMaterial({color: c, roughness: .95, vertexColors: true, side: dos ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: .25});
  m.onBeforeCompile = s => {
    conSonda(s, U); s.uniforms.cR = {value: new THREE.Color(raya ?? c)}; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTu;').replace('#include <uv_vertex>', 'vTu=uv;').replace('#include <color_vertex>', 'vColor=color;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vTu;uniform vec3 cR;${RUIDO}
float nit(vec2 u){vec2 w=fwidth(u);return 1.-smoothstep(.22,.62,max(w.x,w.y)*${tipo === 'punto' ? '150.' : tipo === 'canale' ? '62.' : '420.'});}
float alto(vec2 u){${tipo === 'punto' ? 'vec2 q=u*vec2(150.,118.);float c=floor(q.x),x=fract(q.x)-.5;float y=q.y+abs(x)*1.15;float f=fract(y);float lz=1.-pow(abs(f-.5)*2.,2.);float hb=sqrt(max(0.,1.-pow((abs(x)-.25)/.25,2.)));return hb*(.45+.55*lz)+.18*nQ(u*900.);' : tipo === 'canale' ? 'float x=fract(u.x*62.)-.5;float r=sqrt(max(0.,1.-pow(abs(x)*2.2,2.)));return r+.12*nQ(u*700.)+.2*sqrt(max(0.,1.-pow((fract(u.y*110.)-.5)*2.,2.)))*r;' : tipo === 'cuero' ? 'return nQ(u*380.)*.3+nQ(u*900.)*.2+nQ(u*70.)*.25;' : tipo === 'pana' ? 'return nQ(u*vec2(420.,900.))*.5+nQ(u*1500.)*.4;' : 'return nQ(u*vec2(520.,300.))*.45+nQ(u.yx*vec2(600.,260.)+9.)*.4+nQ(u*1300.)*.3+nQ(u*90.)*.5;'}}`)
      .replace('#include <color_fragment>', `float aoV=vColor.a;float rj=step(vColor.r,.5);diffuseColor.rgb=mix(diffuse,cR,rj);{float nk=nit(vTu),a=mix(${tipo === 'punto' ? '.46' : tipo === 'canale' ? '.62' : '.62'},alto(vTu),nk),b=nQ(vTu*38.),e=nQ(vTu*7.);diffuseColor.rgb*=${tipo === 'punto' || tipo === 'canale' ? '(.55+.5*a)' : '(.8+.3*a)'}*(.9+.14*b+.1*e);}${tipo === 'paño' ? '{float me=nQ(vTu*vec2(640.,900.)),mf=nQ(vTu*23.+5.);float lm=dot(diffuseColor.rgb,vec3(.4,.4,.2));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(lm*1.15),.04+.12*me*nit(vTu*.6));diffuseColor.rgb*=.9+.2*mf;}' : ''}diffuseColor.rgb*=mix(.38,1.,aoV);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor=${tipo === 'cuero' ? '.42+.2*nQ(vTu*60.)' : '.96'};`)
      .replace('#include <normal_fragment_maps>', `{float dV=length(vViewPosition),kk=nit(vTu)*${tipo === 'punto' ? '.0042' : tipo === 'canale' ? '.006' : tipo === 'cuero' ? '.0007' : '.0008'}*smoothstep(${tipo === 'punto' || tipo === 'canale' ? '320.,60.' : '150.,30.'},dV);if(kk>1e-5){vec2 dx=dFdx(vTu),dy=dFdy(vTu);float h0=alto(vTu),hx=alto(vTu+dx)-h0,hy=alto(vTu+dy)-h0;vec3 sx=dFdx(-vViewPosition)/45.,sy=dFdy(-vViewPosition)/45.,R1=cross(sy,normal),R2=cross(normal,sx);float dt=dot(sx,R1);vec3 g=sign(dt)*(hx*R1+hy*R2)*kk;normal=normalize(abs(dt)*normal-g);}}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{float rm=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),2.6);totalEmissiveRadiance+=(diffuseColor.rgb*.9+.01)*rm*luzSonda(normalize(normal+vec3(0.,0.,-.6)))*${tipo === 'cuero' ? '.04' : '.22'}*aoV;}`)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(.3,1.,aoV);reflectedLight.directDiffuse*=mix(.55,1.,aoV);');
  }; m.customProgramCacheKey = () => 'telaP' + tipo + dos; return m;
}
function piel(U, id, tinte) {
  const m = LOWQ ? new THREE.MeshStandardMaterial({roughness: .5}) : new THREE.MeshPhysicalMaterial({roughness: .5, sheen: .3, sheenRoughness: .5, sheenColor: new THREE.Color(0xffb9a0), envMapIntensity: .35, specularIntensity: .7}); m.vertexColors = true; m.map = tx(id + '_piel_d.webp', true); m.normalMap = tx(id + '_piel_n.webp'); m.normalScale = new THREE.Vector2(.9, .9); m.color.set(tinte || 0xffffff);
  m.onBeforeCompile = s => {sss(s); vidrio(s); conSonda(s, U); s.uniforms.frio = U.frio; s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAp;uniform float frio;' + RUIDO).replace('#include <map_fragment>', '#include <map_fragment>\n{vec3 b=diffuseColor.rgb;float l=dot(b,vec3(.3,.6,.1));diffuseColor.rgb=mix(vec3(l),b,1.3)*vec3(.92,.84,.8);diffuseColor.rgb*=.9+.14*nQ(vMapUv*340.)+.04*nQ(vMapUv*900.);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.78,.72),vAp*.6);}').replace('#include <color_fragment>', 'float aoP=vColor.a;diffuseColor.rgb*=mix(vec3(.74,.62,.58),vec3(1.),smoothstep(0.,.8,aoP));').replace('#include <roughnessmap_fragment>', 'float roughnessFactor=roughness*(.82+.36*nQ(vMapUv*420.));').replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(.4,1.,aoP);reflectedLight.directDiffuse*=mix(.72,1.,aoP);{float w=.5*aoP;vec3 sd=luzSonda(normalize(normal*.4+vec3(0.,0.,.3)))*BRDF_Lambert(diffuseColor.rgb)*vec3(.34,.12,.07)*w;reflectedLight.indirectDiffuse+=sd;}')}; m.customProgramCacheKey = () => 'pielP'; return m;
}
function pelo(U, id, c) {
  const m = new THREE.MeshStandardMaterial({color: c, map: tx(id + '_pelo.webp', true), alphaTest: LOWQ ? .4 : .28, alphaToCoverage: !LOWQ, side: THREE.DoubleSide, roughness: .6, envMapIntensity: .2, vertexColors: true});
  m.onBeforeCompile = s => {conSonda(s, U); s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', 'float aoH=vColor.a;diffuseColor.rgb*=mix(.3,1.,aoH);').replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(.35,1.,aoH);'); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + RUIDO).replace('#include <map_fragment>', '#ifdef USE_MAP\nvec4 tP=texture2D(map,vMapUv);float lp=dot(tP.rgb,vec3(.33))*2.1;float fd=1.-smoothstep(.3,1.2,fwidth(vMapUv.x)*620.);float he=mix(.5,nQ(vMapUv*vec2(620.,9.))*.5+nQ(vMapUv*vec2(1500.,14.))*.5,fd);diffuseColor.rgb*=(.28+.95*lp)*(.7+.6*he);diffuseColor.a*=tP.a*1.15;\n#endif').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{vec3 dw=(viewMatrix*vec4(0.,-1.,0.,0.)).xyz,Tg=dw-normal*dot(dw,normal);float lt=length(Tg);if(lt>.05){Tg/=lt;vec3 V=normalize(vViewPosition);Tg=normalize(Tg+normal*(he-.5)*.55);for(int k=0;k<2;k++){vec3 Lw=k==0?normalize(shS[1].ggg*vec3(1.,0.,0.)+shS[2].ggg*vec3(0.,1.,0.)+shS[3].ggg*vec3(0.,0.,1.)+vec3(0.,.02,0.)):vec3(-.3,.9,-.3);vec3 L=(viewMatrix*vec4(normalize(Lw),0.)).xyz;float th=dot(Tg,normalize(L+V)),ks=sqrt(max(0.,1.-th*th)),nl=smoothstep(-.1,.6,dot(normal,L));totalEmissiveRadiance+=(diffuseColor.rgb*1.6+.012)*(pow(ks,90.)*.3+pow(ks,14.)*.07)*aoH*nl*luzSonda(normalize(L))*(k==0?1.:.6);}}}')}; m.customProgramCacheKey = () => 'peloP'; return m;
}
const plano = (U, o) => {const m = new THREE.MeshStandardMaterial(o); m.onBeforeCompile = s => conSonda(s, U); m.customProgramCacheKey = () => 'planoP' + (o.map ? 1 : 0); return m};

/* gesto → pesos de los morphs y apertura de los párpados */
const GESTOS = {son: {son: .42}, risa: {son: .95, abre: .5, cejaAlza: .35, parp: .12}, o: {o: .5, cejaAlza: .6}, seria: {cejaFrunce: .12, triste: .12}, triste: {triste: .8, cejaPena: .9, parp: .18}, duerme: {son: .25, parp: 1}, pena: {triste: .5, cejaPena: .8, parp: .25}};
export class CaraP {
  constructor(id, mallas, U, iris) {
    const x = PM[id].x, {E, R} = x.ojos; this.mallas = mallas; this.malla = mallas[0]; this.g = new THREE.Group(); this.mo = matOjos(iris); const u = this.mo.userData.u; u.ri.value = id === 'nino' ? .62 : .56; u.pup.value = .44; u.brillo.value = .7; const f0 = this.mo.onBeforeCompile; this.mo.onBeforeCompile = s => {f0(s); s.fragmentShader = s.fragmentShader.replace('vec3 sc=vec3(.9,.875,.85)', 'vec3 sc=vec3(.62,.59,.57)').replace('vec3(.86,.66,.6)', 'vec3(.6,.42,.38)').replace('ic*mi*.26', 'ic*mi*.1'); conSonda(s, U)}; this.mo.customProgramCacheKey = () => 'ojosP';
    const r = R * .80, P = [], D = [], I = []; let b = 0; for (const s of [-1, 1]) {const g = new THREE.SphereGeometry(1, 30, 22).rotateZ(-Math.PI / 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) {P.push(E[0] + p.getX(i) * r, E[1] + p.getY(i) * r, s * E[2] + p.getZ(i) * r); D.push(p.getX(i), p.getY(i), p.getZ(i))} for (const i of g.index.array) I.push(i + b); b += p.count} const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(D, 3)); g.setAttribute('dir', new THREE.Float32BufferAttribute(D, 3)); g.setIndex(I); this.ojos = new THREE.Mesh(g, this.mo); this.ojos.position.y = -x.D.cuello; this.g.add(this.ojos); this.par = this.ojos; this.w = {}; this.parp = 0; this.pon('son'); this.y = this.p = 0; this.paso(1, 0);
  }
  pon(g) {this.gesto = g; this.obj = GESTOS[g] || GESTOS.son}
  paso(dt, y = 0, p = 0, guino = 1) {
    const k = 1 - Math.exp(-7 * dt), e = 1 - Math.exp(-22 * dt); this.y = lerp(this.y, clamp(y, -.55, .55), e); this.p = lerp(this.p, clamp(p, -.4, .34), e); const cp = Math.cos(this.p); this.mo.userData.u.gz.value.set(Math.cos(this.y) * cp, Math.sin(this.p), -Math.sin(this.y) * cp);
    for (const n of ['son', 'abre', 'o', 'cejaAlza', 'cejaFrunce', 'triste', 'cejaPena']) this.w[n] = lerp(this.w[n] || 0, this.obj[n] || 0, k); this.parp = lerp(this.parp, this.obj.parp || 0, k); this.w.parp = clamp(Math.max(this.parp, 1 - guino), 0, 1); this.w.abajo = clamp(-this.p * 2.2, 0, 1) * (1 - this.w.parp); this.w.arriba = clamp(this.p * 2.2, 0, 1) * (1 - this.w.parp);
    for (const m of this.mallas) {const d = m.morphTargetDictionary, q = m.morphTargetInfluences; if (d) for (const n in d) q[d[n]] = this.w[n] || 0}
  }
}
/* ---------- versiones ligeras (móvil y gente lejana): un sombreador propio, sin las luces de three ---------- */
/* luz común a todas: la del escaparate más cercano (punto), el relleno de las escenas (dirección) y el ambiente */
export const LUZP = {pl: {value: new THREE.Vector3()}, plc: {value: new THREE.Color(0, 0, 0)}, rd: {value: new THREE.Vector3(0, 1, 0)}, rdc: {value: new THREE.Color(0, 0, 0)}, am: {value: new THREE.Color(.07, .075, .09)}};
const VS = (extra = '', proj = '#include <project_vertex>') => `varying vec2 vTu;varying vec3 vN,vV,vW;${extra}
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
void main(){vTu=uv;
#ifdef CONCOL
vCo=color;
#endif
#include <beginnormal_vertex>
#include <morphnormal_vertex>
#include <skinbase_vertex>
#include <skinnormal_vertex>
#include <defaultnormal_vertex>
vN=transformedNormal;
#include <begin_vertex>
#include <morphtarget_vertex>
#include <skinning_vertex>
${proj}
vV=-mvPosition.xyz;vW=(modelMatrix*vec4(transformed,1.)).xyz;
#include <fog_vertex>
}`, FS = `varying vec2 vTu;varying vec3 vN,vV,vW;uniform vec3 pl,plc,rd,rdc,am;
#include <common>
#include <fog_pars_fragment>
${RUIDO}${SONDA_G}
vec3 luzN(vec3 n,float en){vec3 w=normalize((vec4(n,0.)*viewMatrix).xyz),d=pl-vW;float l=length(d);return luzSonda(n)+am*(.75+.25*w.y)+plc*clamp((dot(w,d/l)+en)/(1.+en),0.,1.)/pow(max(l,1.),1.3)+rdc*clamp((dot(w,rd)+en)/(1.+en),0.,1.);}`;
const FOGU = {fogColor: {value: new THREE.Color()}, fogNear: {value: 1}, fogFar: {value: 2}}, FIN = `
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
function ropaM(U, cols, raya) {
  const m = new THREE.ShaderMaterial({fog: true, side: THREE.DoubleSide, defines: {CONCOL: 1}, vertexColors: true, uniforms: {...U, ...LUZP, ...FOGU, cols: {value: cols}, cR: {value: new THREE.Color(raya)}}, vertexShader: VS('varying vec4 vCo;'), fragmentShader: FS + `varying vec4 vCo;uniform vec3 cols[10],cR;
void main(){int id=int(vCo.r*255.+.5)/16;vec3 c=vCo.g>.5?cR:cols[id];float ao=vCo.a,w=max(fwidth(vTu.x),fwidth(vTu.y));vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;
if(id==2){float k=1.-smoothstep(.22,.62,w*150.);vec2 q=vTu*vec2(150.,118.);float x=fract(q.x)-.5,f=fract(q.y+abs(x)*1.15),lz=1.-pow(abs(f-.5)*2.,2.),hb=sqrt(max(0.,1.-pow((abs(x)-.25)/.25,2.)));c*=.55+.5*mix(.46,hb*(.45+.55*lz),k);}
else if(id==3){float k=1.-smoothstep(.22,.62,w*62.),x=fract(vTu.x*62.)-.5;c*=.55+.5*mix(.62,sqrt(max(0.,1.-pow(abs(x)*2.2,2.))),k);}
else if(id<2||id==4||id==9){float k=1.-smoothstep(.3,1.,w*420.);c*=.84+.2*mix(.5,nQ(vTu*vec2(520.,300.)),k)+.12*nQ(vTu*23.);}
vec3 irr=luzN(n,.1)*mix(.36,1.,ao),o=c*mix(.38,1.,ao)*irr*.31831;if(id<5||id==9){float rm=pow(1.-clamp(dot(normalize(vV),n),0.,1.),2.6);o+=(c*.9+.01)*rm*luzSonda(normalize(n+vec3(0.,0.,-.6)))*.2*ao;}else if(id>=5){vec3 V=normalize(vV),w2=(viewMatrix*vec4(normalize(pl-vW),0.)).xyz;float sp=pow(max(dot(n,normalize(V+w2)),0.),id==6?40.:22.);o+=(id==6?c:vec3(.05))*sp*irr*(id==6?1.4:.6);}
gl_FragColor=vec4(o,1.);` + FIN}); m.userData.solo = true; return m;
}
function pielM(U, id, tinte) {
  const m = new THREE.ShaderMaterial({fog: true, defines: {CONCOL: 1}, vertexColors: true, uniforms: {...U, ...LUZP, ...FOGU, map: {value: tx(id + '_piel_d.webp', true)}, ti: {value: new THREE.Color(tinte || 0xffffff)}, uVid: VIDRIO}, vertexShader: VS('varying vec4 vCo;uniform float uVid;varying float vAp;', 'vec4 wPv=modelMatrix*vec4(transformed,1.);float pen=max(0.,uVid-wPv.z);vAp=clamp(pen*.9,0.,1.);wPv.z=max(wPv.z,uVid);vec4 mvPosition=viewMatrix*wPv;gl_Position=projectionMatrix*mvPosition;'), fragmentShader: FS + `varying vec4 vCo;varying float vAp;uniform sampler2D map;uniform vec3 ti;
void main(){vec3 b=texture2D(map,vTu).rgb*ti;float l=dot(b,vec3(.3,.6,.1));b=mix(vec3(l),b,1.3)*vec3(.92,.84,.8);b=mix(b,vec3(.86,.78,.72),vAp*.6);float ao=vCo.a;b*=mix(vec3(.74,.62,.58),vec3(1.),smoothstep(0.,.8,ao));vec3 n=normalize(vN),V=normalize(vV);
vec3 i0=luzN(n,.12),i1=luzN(n,.55);vec3 irr=vec3(mix(i0.r,i1.r,.5),mix(i0.g,i1.g,.22),mix(i0.b,i1.b,.14))*mix(.46,1.,ao);vec3 o=b*irr*.31831;o+=b*vec3(.34,.12,.07)*luzSonda(normalize(n*.4+vec3(0.,0.,.3)))*.16*ao;
vec3 L=(viewMatrix*vec4(normalize(pl-vW),0.)).xyz,H=normalize(V+L);float nh=max(dot(n,H),0.),F=.028+.3*pow(1.-max(dot(n,V),0.),5.);o+=irr*F*(pow(nh,18.)*.55+pow(nh,60.)*.35)*ao;gl_FragColor=vec4(o,1.);` + FIN}); m.userData.solo = true; return m;
}
function peloM(U, id, c) {
  const m = new THREE.ShaderMaterial({fog: true, side: THREE.DoubleSide, defines: {CONCOL: 1}, vertexColors: true, uniforms: {...U, ...LUZP, ...FOGU, map: {value: tx(id + '_pelo.webp', true)}, c0: {value: new THREE.Color(c)}}, vertexShader: VS('varying vec4 vCo;'), fragmentShader: FS + `varying vec4 vCo;uniform sampler2D map;uniform vec3 c0;
void main(){vec4 t=texture2D(map,vTu);if(t.a<.36)discard;float lp=dot(t.rgb,vec3(.33))*2.1,ao=vCo.a,he=nQ(vTu*vec2(300.,9.));vec3 c=c0*(.28+.95*lp)*(.75+.5*he)*mix(.3,1.,ao),n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 irr=luzN(n,.2)*mix(.35,1.,ao),o=c*irr*.31831,V=normalize(vV),dw=(viewMatrix*vec4(0.,-1.,0.,0.)).xyz,Tg=normalize(dw-n*dot(dw,n)+n*(he-.5)*.5),L=(viewMatrix*vec4(normalize(pl-vW+vec3(0.,60.,0.)),0.)).xyz;float th=dot(Tg,normalize(L+V)),ks=sqrt(max(0.,1.-th*th));o+=(c*1.6+.012)*(pow(ks,70.)*.3+pow(ks,14.)*.07)*ao*luzSonda(L);gl_FragColor=vec4(o,1.);` + FIN}); m.userData.solo = true; return m;
}
/* monta la persona sobre una figura ya con esqueleto: devuelve sus mallas */
export function monta(f, id0, R) {
  const id = id0.replace('_l', '');
  const P = PM[id0], U = f.U = {shS: {value: [0, 1, 2, 3].map(() => new THREE.Vector3())}, shK: {value: .5}, frio: {value: 0}}, M = P.m, out = [], hay = n => M[n], lig = !!M.ropa, mk = (n, mat, o = {}) => {if (!hay(n)) return null; if (typeof mat === 'function') mat = mat(); const s = new THREE.SkinnedMesh(M[n], mat); s.frustumCulled = false; s.name = n; f.g.add(s); s.bind(f.esq, new THREE.Matrix4()); if (M[n].userData.morphs) {s.morphTargetDictionary = M[n].userData.morphs; s.morphTargetInfluences = new Array(M[n].morphAttributes.position.length).fill(0)} if (o.sombra !== false && !LOWQ) {s.castShadow = s.receiveShadow = true} if (o.orden) s.renderOrder = o.orden; out.push(s); return s};
  const caras = [mk('piel', () => lig ? pielM(U, id, R.tez) : piel(U, id, R.tez)), mk('pestanas', plano(U, {map: tx(id + '_pestanas.webp', true), color: id === 'nino' ? 0x3a281c : 0x1a100a, alphaTest: id === 'nino' ? .5 : .3, alphaToCoverage: !LOWQ, side: THREE.DoubleSide, roughness: .8}), {sombra: false}), mk('cejas', plano(U, {map: tx(id + '_cejas.webp', true), color: R.ceja ?? 0x6a4a30, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}), {sombra: false, orden: 1}), mk('dientes', plano(U, {color: 0xd8d0c4, roughness: .28}), {sombra: false}), mk('lengua', plano(U, {color: 0x8a3a3a, roughness: .4}), {sombra: false})].filter(Boolean);
  mk('pelo', () => lig ? peloM(U, id, R.pelo) : pelo(U, id, R.pelo)); const C = c => new THREE.Color(c); if (lig) mk('ropa', () => ropaM(U, [R.abrigo, R.pant ?? 0x2a2c36, R.bufanda || R.abrigo, R.gorroC ?? 0xa81c2a, R.boina || R.abrigo, 0x3a2415, 0xb98a3a, 0x241610, 0x8a5a2c, 0xf2ece2].map(C), R.bufanda2 || R.bufanda || 0xffffff));
  mk('abrigo', tela(U, R.abrigo)); mk('pantalon', tela(U, R.pant, {tipo: 'pana'})); if (R.barba) mk('pelaje', tela(U, 0xf2ece2, {tipo: 'pana'})); if (R.bufanda) mk('bufanda', tela(U, R.bufanda || R.abrigo, {tipo: 'punto', raya: R.bufanda2})); mk('gorro', tela(U, R.gorroC ?? 0xa81c2a, {tipo: 'canale'})); mk('boina', tela(U, R.boina || R.abrigo)); mk('cuero', tela(U, 0x3a2415, {tipo: 'cuero'})); mk('metal', plano(U, {color: 0xb98a3a, metalness: .9, roughness: .34})); mk('boton', plano(U, {color: 0x241610, roughness: .35})); mk('madera', plano(U, {color: 0x8a5a2c, roughness: .6})); 
  f.mallasP = out; if (id0 === id) {f.ca = new CaraP(id, caras, U, R.ojos || P.x.iris); f.head.add(f.ca.g)} return out;
}
