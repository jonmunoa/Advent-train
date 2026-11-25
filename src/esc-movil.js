/* La calle en el móvil: los mismos vértices y mapas de luz de siempre, pero fundidos en una malla por acera y con un solo material
   (texturas en una tira de capas), para que toda la calle sean unas pocas llamadas y el sombreado cueste lo mínimo. */
import {THREE, clamp} from './kit.js';
import {CAPAS, MATS, NIEVE_N} from './esc-capas.js';

const P = 512, N = CAPAS.length;
export const tCapas = new THREE.DataArrayTexture(null, P, P, N); tCapas.format = THREE.RGBAFormat; tCapas.type = THREE.UnsignedByteType; tCapas.colorSpace = THREE.SRGBColorSpace; tCapas.wrapS = tCapas.wrapT = THREE.RepeatWrapping; tCapas.magFilter = THREE.LinearFilter; tCapas.minFilter = THREE.LinearMipmapLinearFilter; tCapas.generateMipmaps = true; tCapas.anisotropy = 2; tCapas.source.dataReady = false; tCapas.needsUpdate = true;
/* sube la tira de una vez (sin pasar por un lienzo, que multiplicaría el color por el alfa) */
export async function subeCapas(renderer, url) {
  const b = await fetch(url).then(r => r.blob()); let im; try {im = await createImageBitmap(b, {premultiplyAlpha: 'none', colorSpaceConversion: 'none'})} catch (e) {im = new Image(); im.src = URL.createObjectURL(b); await im.decode()}
  renderer.initTexture(tCapas); const gl = renderer.getContext(), t = renderer.properties.get(tCapas).__webglTexture; renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); while (gl.getError()); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, P, P, N, gl.RGBA, gl.UNSIGNED_BYTE, im);
  if (gl.getError()) for (let k = 0; k < N; k++) {const q = await createImageBitmap(im, 0, k * P, P, P, {premultiplyAlpha: 'none'}); renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, P, P, 1, gl.RGBA, gl.UNSIGNED_BYTE, q)}
  renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); if (im.close) im.close();
}
/* funde las piezas de una zona. partes: {m, v, pos, nor, lm, ti, puv, T[nivel][tienda]}; devuelve una geometría por combinación de niveles */
export function funde(partes, combos) {
  const L = partes.filter(p => p.m === 'liso' || p.m === 'nieve' || MATS[p.m]), nv = L.reduce((s, p) => s + p.v, 0), pos = new Uint16Array(nv * 4), nor = new Int8Array(nv * 4), lm = new Uint16Array(nv * 2), ti = new Uint8Array(nv * 4), puv = new Uint16Array(nv * 2), cap = new Uint8Array(nv * 4); let o = 0; const off = [];
  for (const p of L) {off.push(o); pos.set(p.pos, o * 4); nor.set(p.nor, o * 4); lm.set(p.lm, o * 2); ti.set(p.ti, o * 4); if (p.puv) puv.set(p.puv, o * 2); const m = MATS[p.m], id = p.m === 'liso' ? 0 : p.m === 'nieve' ? 1 : 2 + m[0] + (p.m === 'granito' ? 32 : 0); for (let v = 0; v < p.v; v++) {cap[(o + v) * 4] = id; cap[(o + v) * 4 + 1] = m && m[3] === 'suelo' ? 1 : m && m[3] === 'prop' ? 2 : 0} o += p.v}
  const base = new THREE.BufferGeometry(); base.setAttribute('position', new THREE.BufferAttribute(pos, 4, true)); base.setAttribute('normal', new THREE.BufferAttribute(nor, 4, true)); base.setAttribute('lmuv', new THREE.BufferAttribute(lm, 2, true)); base.setAttribute('tinte', new THREE.BufferAttribute(ti, 4, true)); base.setAttribute('puv', new THREE.BufferAttribute(puv, 2, true)); base.setAttribute('capa', new THREE.BufferAttribute(cap, 4, false));
  return combos.map(N => {const ix = [], r = [0]; for (let t = 0; t < 3; t++) {L.forEach((p, k) => {const a = p.T[Math.min(N[t], p.T.length - 1)][t], q = off[k]; for (let i = 0; i < a.length; i++) ix.push(a[i] + q)}); r.push(ix.length)} const g = new THREE.BufferGeometry(); for (const k in base.attributes) g.setAttribute(k, base.attributes[k]); g.setIndex(new THREE.BufferAttribute(nv < 65536 ? new Uint16Array(ix) : new Uint32Array(ix), 1)); g.userData.r = r; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5); return g});
}
const cp = []; for (let i = 0; i < 64; i++) cp.push(new THREE.Vector4(1, 1, 1, .01)); for (const k in MATS) {const [c, col, rep] = MATS[k]; cp[c + (k === 'granito' ? 32 : 0)].set(...col, rep)}
/* U: uniformes de esc-bloque; LZ y RUIDO: sus trozos de sombreador */
export function matMovil(U, LZ, RUIDO) {
  const m = new THREE.ShaderMaterial({fog: true, side: THREE.DoubleSide, uniforms: {...U, tC: {value: tCapas}, cp: {value: cp}, fogColor: {value: new THREE.Color()}, fogNear: {value: 1}, fogFar: {value: 2}},
    vertexShader: `uniform vec3 uB0,uBS;uniform vec4 cp[64];attribute vec4 tinte,capa;attribute vec2 lmuv,puv;varying vec2 vL,vB;varying vec4 vT;varying vec3 vPo,vNo;flat varying ivec2 vC;varying float vZ;
${LZ}
#include <fog_pars_vertex>
void main(){vec3 q=uB0+position*uBS;vec4 w=modelMatrix*vec4(q,1.);vPo=w.xyz;vNo=normal;vL=lmuv;vT=tinte;vC=ivec2(int(capa.x+.5),int(capa.y+.5));vec3 a=abs(normal);float k=cp[max(vC.x-2,0)].w;vB=vC.y==2?puv:(vC.y==1?q.xz:a.y>a.x&&a.y>a.z?q.xz:a.x>a.z?q.zy:q.xy)*k;vZ=luzEsc(w.x);vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `precision highp sampler2DArray;uniform sampler2DArray tC;uniform sampler2D tL,tE,tDir;uniform samplerCube tCu;uniform float MX,MW,on,esc,envK,cuOn;uniform vec4 cp[64];varying vec2 vL,vB;varying vec4 vT;varying vec3 vPo,vNo;flat varying ivec2 vC;varying float vZ;
${RUIDO}
#include <fog_pars_fragment>
vec3 refl(vec3 R,float ru){return cuOn>.5?min(textureLod(tCu,R,.9+ru*3.4).rgb,vec3(6.)):vec3(0.);}
void main(){vec3 lm=texture2D(tE,vL).rgb,Lm=pow(texture2D(tL,vL).rgb,vec3(2.4))*MX*mix(.16,1.,on),irr=Lm+vec3(1.,.8,.58)*1.25*pow(lm.r,2.4)*MW*vZ*esc,al,V=normalize(cameraPosition-vPo),Nn=normalize(vNo),sp=vec3(0.);if(!gl_FrontFacing)Nn=-Nn;float oc=clamp(dot(irr,vec3(.4))*1.6+lm.g*.35,0.,1.),som=mix(.66,1.,smoothstep(0.,.34,lm.g));
if(vC.x==0){ // pintura, hierro y cristal lisos
al=pow(vT.rgb,vec3(2.2))*som;float ru=vT.a>.5?(vT.a-.502)*2.008:vT.a*2.008,me=step(.5,vT.a);if(me<.5)ru=max(ru,.3);float nv=clamp(dot(Nn,V),0.,1.);vec3 F0=mix(vec3(.04),al,me),F=F0+(max(vec3(1.-ru),F0)-F0)*pow(1.-nv,5.);vec3 rf=refl(reflect(-V,Nn),ru+.15);sp=max(mix(vec3(dot(rf,vec3(.33))),rf,.4)-.08,0.)*F*oc*envK*.4;vec3 D=normalize(texture2D(tDir,vL).xyz*2.-1.),H=normalize(D+V);float nh=clamp(dot(Nn,H),0.,1.),a2=ru*ru*ru*ru,d=nh*nh*(a2-1.)+1.;sp+=min(irr*F0*(a2/(3.14159*d*d))*clamp(dot(Nn,D),0.,1.)*lm.b*.12,vec3(1.1));al*=1.-me;}
else if(vC.x==1){al=vec3(.80,.82,.86)*.965;}
else{int c=vC.x-2;vec4 A=texture(tC,vec3(vB,float(c&31)),vC.y==1?.7:0.);vec3 col=cp[c].rgb;
if(vC.y==1){ // acera y calzada: adoquín, nieve y agua
vec4 As=texture(tC,vec3(vB,float(c&31)),2.);float h=As.a,n1=nB(vPo*.045),n2=As.r,n3=As.g,sn=smoothstep(.40,.62,vT.a*1.12+(.5-h)*.62+(n2-.5)*.22+(n3-.5)*.1),ag=smoothstep(.12,.42,vT.g*.6+(.5-h)*.8+(n1-.44)*1.5)*(1.-sn);vec3 ca=A.rgb*col*(vT.r*2.);ca*=mix(1.,.5,ag*.8+.2*(1.-sn));vec3 nv=vec3(.78,.80,.85)*(.9+.12*n1)*(.95+.08*n3);nv=mix(nv,nv*vec3(.72,.70,.69),smoothstep(.2,.9,vT.g)*.55*n2);al=mix(ca,nv,sn);float dV=distance(cameraPosition,vPo),ru=min(1.,mix(mix(.34,.07,ag),mix(.78,.46,vT.g*.7),sn)+dV*.00022);
vec3 N2=Nn;{vec2 dh=vec2(dFdx(h),dFdy(h));vec3 sx=dFdx(vPo),sy=dFdy(vPo),r1=cross(sy,Nn),r2=cross(Nn,sx);float dt=dot(sx,r1);vec3 g=sign(dt)*(dh.x*r1+dh.y*r2);N2=normalize(abs(dt)*Nn-g*(1.15*(1.-sn)*smoothstep(.06,.34,ru))*smoothstep(900.,60.,dV));}
if(sn>.3){vec2 q=(pow(texture(tC,vec3(vPo.xz*.0111,${NIEVE_N}.)).xy,vec2(1./2.2))*2.-1.)*sn*smoothstep(900.,80.,dV);N2=normalize(N2+vec3(q.x,0.,q.y)*.75);}
vec3 D=normalize(texture2D(tDir,vL).xyz*2.-1.);float f=dot(Nn,D),g=dot(N2,D);irr*=mix(1.,clamp((max(g,0.)+.32)/(max(f,0.)+.32),.3,1.8),lm.b*(1.-.6*sn));float nV=clamp(dot(N2,V),0.,1.),F=.04+(max(1.-ru,.04)-.04)*pow(1.-nV,5.);vec3 R=reflect(-V,normalize(mix(N2,vec3(0.,1.,0.),.35)));vec3 rf=refl(R,ru);rf=mix(vec3(dot(rf,vec3(.33))),rf,.3);sp=max(min(rf,vec3(2.2))-.3,0.)*F*oc*envK*mix(.5,.8,ag)*(.35+.9*smoothstep(.35,.75,h));vec3 H=normalize(D+V);float nh=clamp(dot(N2,H),0.,1.),a2=ru*ru*ru*ru+1e-4,d=nh*nh*(a2-1.)+1.;sp+=min(irr*F*(a2/(3.14159*d*d))*smoothstep(0.,.2,g)*lm.b*.45/max(.09,max(g,.12)*(nV+.06))*.5,vec3(3.));}
else al=A.rgb*col*(vC.y==2?1.:vT.r*2.)*som;}
gl_FragColor=vec4(al*irr*.31831+sp,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`}); m.userData.solo = true; return m;
}
