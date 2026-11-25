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
/* números de un atributo (también si viene comprimido o entrelazado) */
function sueltos(a, w = a.itemSize) {
  const n = a.count, o = new Float32Array(n * w), B = a.isInterleavedBufferAttribute, src = B ? a.data.array : a.array, st = B ? a.data.stride : a.itemSize, of = B ? a.offset : 0, k = !a.normalized || src instanceof Float32Array ? 1 : 1 / (src instanceof Int8Array ? 127 : src instanceof Uint8Array ? 255 : src instanceof Int16Array ? 32767 : 65535);
  for (let i = 0, p = of, q = 0; i < n; i++, p += st) for (let c = 0; c < w; c++) {const v = src[p + c] * k; o[q++] = v < -1 && k !== 1 ? -1 : v} return o;
}
function plana(m) {
  const g0 = m.geometry, g = new THREE.BufferGeometry(), e = m.matrixWorld.elements, at = g0.attributes, n = at.position.count, pon = (k, a, w) => g.setAttribute(k, new THREE.BufferAttribute(a, w)), mueve = (a, t) => {for (let i = 0; i < a.length; i += 3) {const x = a[i], y = a[i + 1], z = a[i + 2]; a[i] = e[0] * x + e[4] * y + e[8] * z + t * e[12]; a[i + 1] = e[1] * x + e[5] * y + e[9] * z + t * e[13]; a[i + 2] = e[2] * x + e[6] * y + e[10] * z + t * e[14]} return a};
  pon('position', mueve(sueltos(at.position), 1), 3); const N = sueltos(at.normal); for (let i = 0; i < N.length; i += 3) {const q = 1 / (Math.hypot(N[i], N[i + 1], N[i + 2]) || 1); N[i] *= q; N[i + 1] *= q; N[i + 2] *= q} pon('normal', N, 3); pon('uv', sueltos(at.uv), 2); if (at.color) pon('color', sueltos(at.color, 4), 4);
  const si = Uint16Array.from(sueltos(at.skinIndex)), sw = sueltos(at.skinWeight); for (let i = 0; i < sw.length; i += 4) {const q = 1 / (sw[i] + sw[i + 1] + sw[i + 2] + sw[i + 3] || 1); sw[i] *= q; sw[i + 1] *= q; sw[i + 2] *= q; sw[i + 3] *= q} g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); pon('skinWeight', sw, 4); g.setIndex(g0.index); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .8, 0), 2);
  if (g0.morphAttributes.position) {g.morphAttributes.position = g0.morphAttributes.position.map(p => new THREE.BufferAttribute(mueve(sueltos(p), 0), 3)); g.morphAttributes.normal = g0.morphAttributes.normal.map(p => new THREE.BufferAttribute(sueltos(p), 3)); g.morphTargetsRelative = true; g.userData.morphs = m.morphTargetDictionary} return g;
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
/* brillo de la piel con la luz que llega sobre todo de un lado (la dirección dominante de las sondas): dos lóbulos, el graso y el ancho */
const BRILLO = `vec3 brilloPiel(vec3 n,vec3 V,float ru,vec3 L,vec3 E){vec3 H=normalize(L+V);float nh=clamp(dot(n,H),0.,1.),nl=clamp(dot(n,L),0.,1.),vh=clamp(dot(V,H),0.,1.);float a1=ru*ru*ru*ru,a2=min(1.,ru*ru*ru*ru*5.);float q1=nh*nh*(a1-1.)+1.,q2=nh*nh*(a2-1.)+1.;float D=.6*a1/(3.1416*q1*q1)+.4*a2/(3.1416*q2*q2);float F=.028+.972*pow(1.-vh,5.);return E*(D*F*nl*.25/max(.12,vh*vh));}
vec3 domL(){vec3 d=vec3(dot(shS[1],vec3(.3,.6,.1)),dot(shS[2],vec3(.3,.6,.1)),dot(shS[3],vec3(.3,.6,.1)));return normalize(d+vec3(0.,1e-4,0.));}`;
function piel(U, id, tinte) {
  const m = new THREE.MeshPhysicalMaterial({roughness: .5, sheen: .22, sheenRoughness: .5, sheenColor: new THREE.Color(0xffb9a0), envMapIntensity: .3, specularIntensity: .75}); m.vertexColors = true; m.map = tx(id + '_piel_d.webp', true); m.normalMap = tx(id + '_piel_n.webp'); m.normalScale = new THREE.Vector2(1, 1); m.color.set(tinte || 0xffffff);
  m.onBeforeCompile = s => {sss(s); vidrio(s); conSonda(s, U); s.uniforms.frio = U.frio; s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAp;uniform float frio;' + RUIDO).replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>').replace('void main() {', BRILLO + '\nvoid main() {')
    .replace('#include <map_fragment>', '#include <map_fragment>\nfloat aoT=diffuseColor.a;diffuseColor.a=1.;vec4 tN=texture2D(normalMap,vNormalMapUv);{vec3 b=diffuseColor.rgb;float l=dot(b,vec3(.3,.6,.1));diffuseColor.rgb=max(b*.5,mix(vec3(l),b,1.22))*vec3(.9,.83,.79);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.78,.72),vAp*.6);}')
    .replace('#include <color_fragment>', 'float aoP=min(vColor.a*1.04,pow(aoT,1.7));diffuseColor.rgb*=mix(vec3(.95,.62,.58),vec3(1.),vColor.r)*.9;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=clamp(tN.b+.04,.2,.9);').replace('#include <opaque_fragment>', '#include <opaque_fragment>\nif(!(gl_FragColor.r+gl_FragColor.g+gl_FragColor.b<1e4))gl_FragColor.rgb=diffuseColor.rgb*.2;gl_FragColor.rgb=max(gl_FragColor.rgb,vec3(0.));')
    .replace('#include <normal_fragment_maps>', 'vec3 nGeo=normal;{vec3 q=vec3((tN.xy*2.-1.)*normalScale,0.);q.z=sqrt(max(.15,1.-dot(q.xy,q.xy)));vec3 nn=tbn*q;float ln=dot(nn,nn);if(ln>1e-6&&ln<1e6)normal=nn*inversesqrt(ln);}')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{vec3 V=normalize(vViewPosition),L=domL();float so=clamp(aoP*1.15-.1,0.,1.);totalEmissiveRadiance+=brilloPiel(normal,V,clamp(tN.b,.24,.8),(viewMatrix*vec4(L,0.)).xyz,luzSonda((viewMatrix*vec4(L,0.)).xyz))*so*1.1;}')
    .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{vec3 aq=pow(vec3(aoP),vec3(.7,1.,1.1));reflectedLight.indirectDiffuse*=mix(vec3(.22),vec3(1.),aq);reflectedLight.directDiffuse*=mix(vec3(.5),vec3(1.),aq);reflectedLight.directSpecular*=aoP;reflectedLight.indirectSpecular*=aoP*aoP*.7;}{float nv=clamp(dot(nGeo,normalize(vViewPosition)),0.,1.),rd=mix(.52,1.,smoothstep(0.,.75,nv));reflectedLight.indirectDiffuse*=rd;reflectedLight.directDiffuse*=rd;}{float w=.5*aoP;vec3 sd=luzSonda(normalize(nGeo*.4+vec3(0.,0.,.3)))*BRDF_Lambert(diffuseColor.rgb)*vec3(.34,.12,.07)*w;reflectedLight.indirectDiffuse+=sd;}')}; m.customProgramCacheKey = () => 'pielP2'; return m;
}
/* lo que resalta cada mechón: la foto entre su propio promedio, para que se vea el dibujo y no su tono */
const MECHON = 'float lumH(vec4 t){return sqrt(dot(t.rgb,vec3(.3333))+.0004);}';
/* flequillo: las puntas, mezcladas sobre la piel (la otra pasada es el grueso del pelo, opaco) */
function pelo(U, id, c, puntas = false) {
  const m = new THREE.MeshStandardMaterial({color: c, map: tx(id + '_pelo.webp', true), ...(puntas ? {transparent: true, depthWrite: false, forceSinglePass: true} : {alphaTest: .5}), side: THREE.DoubleSide, roughness: .62, envMapIntensity: .15, vertexColors: true});
  m.onBeforeCompile = s => {conSonda(s, U); s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', 'float aoH=vColor.a;diffuseColor.rgb*=mix(.3,1.,aoH)*(vColor.r>.95?1.:mix(.75,1.75,(vColor.r-.4)/.26));').replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(.35,1.,aoH);'); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + RUIDO + MECHON).replace('#include <map_fragment>', `#ifdef USE_MAP
vec4 tP=texture2D(map,vMapUv);float l0=lumH(tP),l1=lumH(textureLod(map,vMapUv,5.5)),he=clamp(l0/max(.02,l1)*.5,0.,1.);float fd=1.-smoothstep(.3,1.2,fwidth(vMapUv.x)*620.);diffuseColor.rgb*=(.35+1.25*smoothstep(.12,.95,he))*(1.+(nQ(vMapUv*vec2(900.,900.))-.5)*.3*fd);diffuseColor.rgb=min(diffuseColor.rgb,vec3(.5,.49,.47));diffuseColor.a*=tP.a;${puntas ? 'diffuseColor.a=smoothstep(.06,.62,diffuseColor.a)*step(.04,diffuseColor.a);' : ''}
#endif`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{vec3 sx=dFdx(-vViewPosition)/45.,sy=dFdy(-vViewPosition)/45.,R1=cross(sy,normal),R2=cross(normal,sx);float dt=dot(sx,R1);vec3 g=sign(dt)*(dFdx(he)*R1+dFdy(he)*R2)*.0011*smoothstep(150.,30.,length(vViewPosition));normal=normalize(abs(dt)*normal-g);}`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{vec3 dw=(viewMatrix*vec4(0.,-1.,0.,0.)).xyz,Tg=dw-normal*dot(dw,normal);float lt=length(Tg);if(lt>.05){Tg/=lt;vec3 V=normalize(vViewPosition);Tg=normalize(Tg+normal*(he-.5)*.8);for(int k=0;k<2;k++){vec3 Lw=k==0?normalize(shS[1].ggg*vec3(1.,0.,0.)+shS[2].ggg*vec3(0.,1.,0.)+shS[3].ggg*vec3(0.,0.,1.)+vec3(0.,.02,0.)):vec3(-.3,.9,-.3);vec3 L=(viewMatrix*vec4(normalize(Lw),0.)).xyz;float th=dot(Tg,normalize(L+V)),ks=sqrt(max(0.,1.-th*th)),nl=smoothstep(-.1,.6,dot(normal,L));totalEmissiveRadiance+=(diffuseColor.rgb*1.6+.01)*(pow(ks,90.)*.26+pow(ks,14.)*.07)*he*1.6*aoH*nl*luzSonda(normalize(L))*(k==0?1.:.6);}}}')}; m.customProgramCacheKey = () => 'peloP2' + puntas; return m;
}
const plano = (U, o) => {const m = new THREE.MeshStandardMaterial(o); m.onBeforeCompile = s => conSonda(s, U); m.customProgramCacheKey = () => 'planoP' + (o.map ? 1 : 0); return m};

/* gesto → pesos de los morphs y apertura de los párpados */
const GESTOS = {son: {son: .46, parp: .05}, risa: {son: .95, abre: .5, cejaAlza: .35, parp: .12}, o: {o: .24, abre: .1, son: .12, cejaAlza: .5}, seria: {cejaFrunce: .12, triste: .12}, triste: {triste: .8, cejaPena: .9, parp: .18}, duerme: {son: .25, parp: 1}, pena: {triste: .5, cejaPena: .8, parp: .25}};
export class CaraP {
  constructor(id, mallas, U, iris) {
    const x = PM[id].x, {E, R} = x.ojos; this.mallas = mallas; this.malla = mallas[0]; this.g = new THREE.Group(); this.mo = matOjos(iris); const u = this.mo.userData.u; u.ri.value = id === 'nino' ? .67 : .59; u.pup.value = .44; u.brillo.value = .7; const f0 = this.mo.onBeforeCompile; this.mo.onBeforeCompile = s => {f0(s); s.fragmentShader = s.fragmentShader.replace('vec3 sc=vec3(.9,.875,.85)', 'vec3 sc=vec3(.62,.59,.57)').replace('vec3(.86,.66,.6)', 'vec3(.6,.42,.38)').replace('ic*mi*.26', 'ic*mi*.05').replace('ic*=1.-.86*smoothstep(.74,.98,k);', 'ic*=(1.-.9*smoothstep(.7,.98,k))*.56;').replace('oc*=mix(.5,1.,som)', 'oc*=mix(.36,1.,som)'); conSonda(s, U)}; this.mo.customProgramCacheKey = () => 'ojosP';
    const r = R * .80, P = [], D = [], I = []; let b = 0; for (const s of [-1, 1]) {const g = new THREE.SphereGeometry(1, 30, 22).rotateZ(-Math.PI / 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) {P.push(E[0] + p.getX(i) * r, E[1] + p.getY(i) * r, s * E[2] + p.getZ(i) * r); D.push(p.getX(i), p.getY(i), p.getZ(i))} for (const i of g.index.array) I.push(i + b); b += p.count} const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(D, 3)); g.setAttribute('dir', new THREE.Float32BufferAttribute(D, 3)); g.setIndex(I); this.ojos = new THREE.Mesh(g, this.mo); this.ojos.position.y = -x.D.cuello; this.g.add(this.ojos); this.par = this.ojos; this.w = {}; this.parp = 0; this.pon('son'); this.y = this.p = 0; this.paso(1, 0);
  }
  /* de espaldas no hace falta dibujar ojos, pestañas, cejas ni dientes */
  ve(cam) {const e = this.g.matrixWorld.elements, dx = cam.x - e[12], dy = cam.y - e[13], dz = cam.z - e[14], v = (dx * e[0] + dy * e[1] + dz * e[2]) / (Math.hypot(dx, dy, dz) || 1) > -.3; if (v === this.vista) return; this.vista = v; this.ojos.visible = v; for (let i = 1; i < this.mallas.length; i++) this.mallas[i].visible = v}
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
function ropaM(U, cols, raya, fijo) {
  const m = new THREE.ShaderMaterial({fog: true, side: THREE.DoubleSide, defines: {CONCOL: 1, ...(fijo !== undefined ? {FIJO: fijo} : {})}, vertexColors: true, uniforms: {...U, ...LUZP, ...FOGU, cols: {value: cols}, cR: {value: new THREE.Color(raya)}}, vertexShader: VS('varying vec4 vCo;'), fragmentShader: FS + `varying vec4 vCo;uniform vec3 cols[10],cR;
void main(){
#ifdef FIJO
int id=FIJO;vec3 c=cols[id]*(.72+.4*nQ(vTu*vec2(520.,26.)));
#else
int id=int(vCo.r*255.+.5)/16;vec3 c=vCo.g>.5?cR:cols[id];
#endif
float ao=vCo.a,w=max(fwidth(vTu.x),fwidth(vTu.y));vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;
if(id==2){float k=1.-smoothstep(.22,.62,w*150.);vec2 q=vTu*vec2(150.,118.);float x=fract(q.x)-.5,f=fract(q.y+abs(x)*1.15),lz=1.-pow(abs(f-.5)*2.,2.),hb=sqrt(max(0.,1.-pow((abs(x)-.25)/.25,2.)));c*=.55+.5*mix(.46,hb*(.45+.55*lz),k);}
else if(id==3){float k=1.-smoothstep(.22,.62,w*62.),x=fract(vTu.x*62.)-.5;c*=.55+.5*mix(.62,sqrt(max(0.,1.-pow(abs(x)*2.2,2.))),k);}
else if(id<2||id==4||id==9){float k=1.-smoothstep(.3,1.,w*420.);c*=.84+.2*mix(.5,nQ(vTu*vec2(520.,300.)),k)+.12*nQ(vTu*23.);}
vec3 irr=luzN(n,.1)*mix(.36,1.,ao),o=c*mix(.38,1.,ao)*irr*.31831;if(id<5||id==9){float rm=pow(1.-clamp(dot(normalize(vV),n),0.,1.),2.6);o+=(c*.9+.01)*rm*luzSonda(normalize(n+vec3(0.,0.,-.6)))*.2*ao;}else if(id>=5){vec3 V=normalize(vV),w2=(viewMatrix*vec4(normalize(pl-vW),0.)).xyz;float sp=pow(max(dot(n,normalize(V+w2)),0.),id==6?40.:22.);o+=(id==6?c:vec3(.05))*sp*irr*(id==6?1.4:.6);}
gl_FragColor=vec4(o,1.);` + FIN}); m.userData.solo = true; return m;
}
function pielM(U, id, tinte) {
  const fina = id === 'nino' || id === 'madre' || id === 'mayor', m = new THREE.ShaderMaterial({fog: true, defines: {CONCOL: 1, ...(fina ? {FINA: 1} : {})}, vertexColors: true, uniforms: {...U, ...LUZP, ...FOGU, map: {value: tx(id + '_piel_d.webp', true)}, ...(fina ? {nm: {value: tx(id + '_piel_n.webp')}} : {}), ti: {value: new THREE.Color(tinte || 0xffffff)}, uVid: VIDRIO}, vertexShader: VS('varying vec4 vCo;uniform float uVid;varying float vAp;', 'vec4 wPv=modelMatrix*vec4(transformed,1.);float pen=max(0.,uVid-wPv.z);vAp=clamp(pen*.9,0.,1.);wPv.z=max(wPv.z,uVid);vec4 mvPosition=viewMatrix*wPv;gl_Position=projectionMatrix*mvPosition;'), fragmentShader: FS + BRILLO + `varying vec4 vCo;varying float vAp;uniform sampler2D map;uniform vec3 ti;
#ifdef FINA
uniform sampler2D nm;
#endif
void main(){vec4 t=texture2D(map,vTu);vec3 b=t.rgb*ti;float l=dot(b,vec3(.3,.6,.1)),ru=.5;b=max(b*.5,mix(vec3(l),b,1.22))*vec3(.9,.83,.79);b=mix(b,vec3(.86,.78,.72),vAp*.6);float ao=min(vCo.a*1.04,pow(t.a,1.7));b*=mix(vec3(.95,.62,.58),vec3(1.),vCo.r)*.9;vec3 n=normalize(vN),V=normalize(vV),n0=n;
#ifdef FINA
vec4 tn=texture2D(nm,vTu);ru=clamp(tn.b,.24,.8);vec3 dx=dFdx(vV),dy=dFdy(vV);vec2 ux=dFdx(vTu),uy=dFdy(vTu);vec3 q1=cross(dy,n),q0=cross(n,dx),T=q1*ux.x+q0*uy.x,Bt=q1*ux.y+q0*uy.y;float dt=max(dot(T,T),dot(Bt,Bt));if(dt>1e-18&&dt<1e6){float k=inversesqrt(dt);vec2 q=tn.xy*2.-1.;n=normalize(T*k*q.x+Bt*k*q.y+n*sqrt(max(.15,1.-dot(q,q))));}
#endif
b*=mix(.56,1.,smoothstep(0.,.75,dot(n0,V)));
vec3 i0=luzN(n,.12),i1=luzN(n0,.55),aq=mix(vec3(.28),vec3(1.),pow(vec3(ao),vec3(.7,1.,1.1)));vec3 irr=vec3(mix(i0.r,i1.r,.5),mix(i0.g,i1.g,.22),mix(i0.b,i1.b,.14))*aq;vec3 o=b*irr*.31831;o+=b*vec3(.34,.12,.07)*luzSonda(normalize(n0*.4+vec3(0.,0.,.3)))*.16*ao;
vec3 pv=pl-vW;float pd=length(pv);vec3 L=(viewMatrix*vec4(pv/pd,0.)).xyz,Ls=(viewMatrix*vec4(domL(),0.)).xyz;float so=clamp(ao*1.15-.1,0.,1.);o+=(brilloPiel(n,V,ru,L,plc/pow(max(pd,1.),1.3))+brilloPiel(n,V,ru,Ls,luzSonda(Ls)))*so;if(!(o.r+o.g+o.b<1e4))o=b*.2;gl_FragColor=vec4(max(o,vec3(0.)),1.);` + FIN}); m.userData.solo = true; return m;
}
function peloM(U, id, c, puntas = false) {
  const m = new THREE.ShaderMaterial({fog: true, side: THREE.DoubleSide, ...(puntas ? {transparent: true, depthWrite: false, forceSinglePass: true} : {}), defines: {CONCOL: 1, ...(puntas ? {PUNTAS: 1} : {})}, vertexColors: true, uniforms: {...U, ...LUZP, ...FOGU, map: {value: tx(id + '_pelo.webp', true)}, c0: {value: new THREE.Color(c)}}, vertexShader: VS('varying vec4 vCo;'), fragmentShader: FS + MECHON + `varying vec4 vCo;uniform sampler2D map;uniform vec3 c0;
void main(){vec4 t=texture2D(map,vTu);
#ifdef PUNTAS
if(t.a<.04||t.a>.62)discard;
#else
if(t.a<.5)discard;
#endif
float he=clamp(lumH(t)/max(.02,lumH(textureLod(map,vTu,5.5)))*.5,0.,1.),ao=vCo.a;vec3 c=c0*(.35+1.25*smoothstep(.12,.95,he))*mix(.3,1.,ao)*(vCo.r>.95?1.:mix(.75,1.75,(vCo.r-.4)/.26)),n=normalize(vN);if(!gl_FrontFacing)n=-n;c=min(c,vec3(.5,.49,.47));vec3 irr=luzN(n,.2)*mix(.35,1.,ao),o=c*irr*.31831,V=normalize(vV),dw=(viewMatrix*vec4(0.,-1.,0.,0.)).xyz,Tg=normalize(dw-n*dot(dw,n)+n*(he-.5)*.8),L=(viewMatrix*vec4(normalize(pl-vW+vec3(0.,60.,0.)),0.)).xyz;float th=dot(Tg,normalize(L+V)),ks=sqrt(max(0.,1.-th*th));o+=(c*1.6+.01)*(pow(ks,70.)*.28+pow(ks,14.)*.07)*he*1.6*ao*luzSonda(L);gl_FragColor=vec4(o,1.);
#ifdef PUNTAS
gl_FragColor.a=smoothstep(.06,.62,t.a);
#endif` + FIN}); m.userData.solo = true; return m;
}
/* monta la persona sobre una figura ya con esqueleto: devuelve sus mallas */
export function monta(f, id0, R) {
  const id = id0.replace('_l', '');
  const P = PM[id0], U = f.U = {shS: {value: [0, 1, 2, 3].map(() => new THREE.Vector3())}, shK: {value: .5}, frio: {value: 0}}, M = P.m, out = [], hay = n => M[n], lig = !!M.ropa, mk = (n, mat, o = {}) => {if (!hay(n)) return null; if (typeof mat === 'function') mat = mat(); const s = new THREE.SkinnedMesh(M[n], mat); s.frustumCulled = false; s.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .8, 0), 2); s.name = n; f.g.add(s); s.bind(f.esq, new THREE.Matrix4()); if (M[n].userData.morphs) {s.morphTargetDictionary = M[n].userData.morphs; s.morphTargetInfluences = new Array(M[n].morphAttributes.position.length).fill(0)} if (o.sombra !== false && !LOWQ) {s.castShadow = s.receiveShadow = true} if (o.orden) s.renderOrder = o.orden; out.push(s); return s};
  const caras = [mk('piel', () => lig ? pielM(U, id, R.tez) : piel(U, id, R.tez)), mk('pestanas', plano(U, {map: tx(id + '_pestanas.webp', true), color: id === 'nino' ? 0x4a3226 : 0x1a100a, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide, roughness: .8}), {sombra: false, orden: 1}), mk('cejas', plano(U, {map: tx(id + '_cejas.webp', true), color: R.ceja ?? 0x6a4a30, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}), {sombra: false, orden: 1}), mk('dientes', plano(U, {color: 0x8e867c, roughness: .28}), {sombra: false}), mk('lengua', plano(U, {color: 0x8a3a3a, roughness: .4}), {sombra: false})].filter(Boolean);
  mk('pelo', () => lig ? peloM(U, id, R.pelo) : pelo(U, id, R.pelo)); if (id0 === id) mk('pelo', () => lig ? peloM(U, id, R.pelo, true) : pelo(U, id, R.pelo, true), {sombra: false, orden: 2}); const C = c => new THREE.Color(c); if (lig) mk('ropa', () => ropaM(U, [R.abrigo, R.pant ?? 0x2a2c36, R.bufanda || R.abrigo, R.gorroC ?? 0xa81c2a, R.boina || R.abrigo, 0x3a2415, 0xb98a3a, 0x241610, 0x8a5a2c, 0xf2ece2].map(C), R.bufanda2 || R.bufanda || 0xffffff));
  mk('abrigo', tela(U, R.abrigo)); mk('pantalon', tela(U, R.pant, {tipo: 'pana'})); if (R.barba || R.bigote) {const cb = R.barba || R.pelo, hebra = (c, f) => {const m = new THREE.MeshStandardMaterial({color: c, roughness: .82, envMapIntensity: .2, vertexColors: true, side: THREE.DoubleSide}); m.onBeforeCompile = s => {conSonda(s, U); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + RUIDO).replace('#include <color_fragment>', `float aoB=vColor.a;{float h=nQ(vMapUvB*vec2(${f}.,18.))*.6+nQ(vMapUvB*vec2(${f * 2.6},40.))*.4;diffuseColor.rgb*=(.7+.5*h)*mix(.5,1.,aoB);}`).replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(.5,1.,aoB);').replace('void main() {', 'varying vec2 vMapUvB;\nvoid main() {'); s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMapUvB;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUvB=uv;')}; m.customProgramCacheKey = () => 'hebra' + f; return m}, B = (n, c) => mk(n, () => lig ? ropaM(U, Array.from({length: 10}, () => C(c)), 0xffffff, 9) : hebra(c, 420)); B('bigote', cb); if (R.barba) {B('barba', cb); B('pelaje', 0xffffff); mk('gorronoel', () => lig ? ropaM(U, Array.from({length: 10}, () => C(R.abrigo)), 0xffffff, 0) : tela(U, R.abrigo))}} if (R.bufanda) mk('bufanda', tela(U, R.bufanda || R.abrigo, {tipo: 'punto', raya: R.bufanda2})); mk('gorro', tela(U, R.gorroC ?? 0xa81c2a, {tipo: 'canale'})); mk('boina', tela(U, R.boina || R.abrigo)); mk('cuero', tela(U, 0x3a2415, {tipo: 'cuero'})); mk('metal', plano(U, {color: 0xb98a3a, metalness: .9, roughness: .34})); mk('boton', plano(U, {color: 0x241610, roughness: .35})); mk('madera', plano(U, {color: 0x8a5a2c, roughness: .6})); 
  f.mallasP = out; if (id0 === id) {f.ca = new CaraP(id, caras, U, R.ojos || P.x.iris); f.head.add(f.ca.g)} return out;
}
