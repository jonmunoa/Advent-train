/* Luz local de las maquetas: farolas, ventanas, bombillas y hogueras alumbran de verdad la nieve y lo que tienen al lado sin
   gastar luces de three. Cada maqueta hornea al montarse un mapa visto desde arriba (color de la luz y altura del suelo) en una
   capa de una textura común; el sombreador elige la capa por la posición en la calle. El faro de la máquina va aparte. */
import {THREE, LOWQ, clamp} from './kit.js';
import {BW, BD} from './esc-vias.js';

const CAPAS = 8, W = LOWQ ? 256 : 512, H = LOWQ ? 122 : 244, DATA = new Uint8Array(W * H * 4 * CAPAS), TX = BW * 2 / W, TZ = BD * 2 / H;
const tex = new THREE.DataArrayTexture(DATA, W, H, CAPAS); tex.format = THREE.RGBAFormat; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
/* lzI: del mundo a la maqueta (con la maqueta en x = 0); lzF: capa fija (−1, según la x); lzK: encendido; faP, faD: faro */
export const ULZ = {lzT: {value: tex}, lzI: {value: new THREE.Matrix4()}, lzF: {value: -1}, lzK: {value: 1}, lzP: {value: 340}, faP: {value: new THREE.Vector4(0, 0, 0, 0)}, faD: {value: new THREE.Vector3(1, 0, 0)}};
const MAX = 5;   // luz más fuerte que cabe en el mapa

/* mu: Mundo. Usa mu.focosL ([x, y, z, radio, r, g, b, fuerza]) y mu.bloq ([x, z, giro, medio ancho, medio fondo]: casas que dan sombra) */
export function* horneaLuz(mu) {
  const capa = mu.i % CAPAS, off = capa * W * H * 4, gy = new Float32Array(W * H), R = new Float32Array(W * H * 3); for (let j = 0; j < H; j++) {if (j % 60 === 59) yield; for (let i = 0; i < W; i++) gy[j * W + i] = mu.gy(-BW + (i + .5) * TX, -BD + (j + .5) * TZ)} let nq = 0;
  for (const [x, y, z, r, cr, cg, cb, k] of mu.focosL) {if (++nq % 10 === 0) yield;
    const i0 = Math.max(1, Math.floor((x - r + BW) / TX)), i1 = Math.min(W - 2, Math.ceil((x + r + BW) / TX)), j0 = Math.max(1, Math.floor((z - r + BD) / TZ)), j1 = Math.min(H - 2, Math.ceil((z + r + BD) / TZ)), B = r > 4 ? mu.bloq.filter(b => Math.hypot(b[0] - x, b[1] - z) < r + 5) : [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const n = j * W + i, px = -BW + (i + .5) * TX, pz = -BD + (j + .5) * TZ, dx = x - px, dz = z - pz, d2h = dx * dx + dz * dz; if (d2h > r * r) continue; const dy = y - gy[n]; if (dy < .05) continue;
      const nx = (gy[n - 1] - gy[n + 1]) / (2 * TX), nz = (gy[n - W] - gy[n + W]) / (2 * TZ), d2 = d2h + dy * dy, d = Math.sqrt(d2), c = (nx * dx + dy + nz * dz) / (d * Math.sqrt(nx * nx + 1 + nz * nz)); if (c <= 0) continue;
      const q = 1 - (d2h / (r * r)) ** 2; let e = k * (c * .85 + .15) * q * q / (1 + d2 / 5); if (e < .004) continue;
      // casas en medio
      for (const [bx, bz, ry, hw, hd] of B) {const ca = Math.cos(ry), sa = Math.sin(ry), ax = px - bx, az = pz - bz, ox = ax * ca - az * sa, oz = ax * sa + az * ca, vx = dx * ca - dz * sa, vz = dx * sa + dz * ca; let t0 = 0, t1 = 1, ok = true; for (const [o, v, h] of [[ox, vx, hw], [oz, vz, hd]]) {if (Math.abs(v) < 1e-6) {if (Math.abs(o) > h) ok = false; continue} let a = (-h - o) / v, b = (h - o) / v; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b)} if (ok && t1 > t0 + .01) {e *= .12; break}}
      R[n * 3] += e * cr; R[n * 3 + 1] += e * cg; R[n * 3 + 2] += e * cb;
    }
  }
  yield; for (let n = 0; n < W * H; n++) {for (let c = 0; c < 3; c++) DATA[off + n * 4 + c] = Math.round(255 * Math.sqrt(clamp(R[n * 3 + c] / MAX, 0, 1))); DATA[off + n * 4 + 3] = Math.round(clamp((gy[n] + 12) / 72, 0, 1) * 255)}
  tex.addLayerUpdate(capa); tex.needsUpdate = true;
}
const f1 = x => x.toFixed(1);
/* vértice: posición en la maqueta y capa de luz */
export const LUZ_VERT = `{vec4 wq=vec4(transformed,1.);
#ifdef USE_INSTANCING
wq=instanceMatrix*wq;
#endif
wq=modelMatrix*wq;vLw=wq.xyz;vLc=floor(wq.x/lzP+.5);if(lzF>=0.){vLz=(lzI*wq).xyz;vLc=lzF;}else{vLz=(lzI*vec4(wq.x-vLc*lzP,wq.yz,1.)).xyz;vLc=mod(vLc,${f1(CAPAS)});}}`;
/* lo que suman la luz local y el faro, por unidad de albedo */
export const LUZ_GLSL = `vec3 luzLocal(vec3 nW,vec3 vLz,vec3 vLw,float vLc){vec3 E=vec3(0.);vec2 uL=vec2(vLz.x/${f1(BW * 2)}+.5,vLz.z/${f1(BD * 2)}+.5);if(uL.x>0.&&uL.x<1.&&uL.y>0.&&uL.y<1.){float cL=floor(vLc+.5);vec4 m0=texture(lzT,vec3(uL,cL));vec3 e=m0.rgb*m0.rgb*${f1(MAX)};float alt=vLz.y-(m0.a*72.-12.);
if(alt>.6){vec2 px=vec2(${(1.6 / (BW * 2)).toFixed(6)},${(1.6 / (BD * 2)).toFixed(6)});vec3 a=texture(lzT,vec3(uL+vec2(px.x,0.),cL)).rgb,b=texture(lzT,vec3(uL+vec2(0.,px.y),cL)).rgb,c2=texture(lzT,vec3(uL-vec2(px.x,0.),cL)).rgb,d2=texture(lzT,vec3(uL-vec2(0.,px.y),cL)).rgb,l3=vec3(.4,.4,.2);vec2 g=vec2(dot(a-c2,l3),dot(b-d2,l3));vec3 L=normalize(vec3(g.x,.14-clamp((alt-3.)*.05,0.,.3),g.y)+1e-4),am=max(max(a,b),max(c2,d2));e=max(e,am*am*${f1(MAX * .8)});float nl=clamp(dot(nW,L)*.75+.32,0.,1.);e*=mix(1.,nl*1.25,smoothstep(.6,1.6,alt))*exp(-max(alt-3.6,0.)*.24);}
E+=e*lzK;}
if(faP.w>.01){vec3 q=vLw-faP.xyz;float l=length(q);q/=max(l,1e-3);float c=dot(q,faD),k=faP.w*smoothstep(.86,.985,c)/(1.+l*l*.0035)*smoothstep(90.,30.,l);if(k>.002)E+=vec3(1.,.8,.5)*k*(clamp(dot(nW,-q),0.,1.)*.85+.15);}return E;}`;
const VERT = '#include <fog_vertex>\n' + LUZ_VERT, FRAG = '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=luzLocal(inverseTransformDirection(normal,viewMatrix),vLz,vLw,vLc)*material.diffuseColor;';
/* engancha la luz a un material con luces; se llama una vez por copia */
export function conLuz(m) {
  if (!m.isMeshStandardMaterial || m.userData.sinLuz || m.lzPuesta) return m; m.lzPuesta = true; const f = m.onBeforeCompile, b = m.customProgramCacheKey.call(m);
  m.onBeforeCompile = function (s, r) {f && f.call(this, s, r); Object.assign(s.uniforms, ULZ); s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 lzI;uniform float lzF,lzP;varying vec3 vLz,vLw;varying float vLc;').replace('#include <fog_vertex>', VERT); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nprecision highp sampler2DArray;uniform sampler2DArray lzT;uniform float lzK;uniform vec4 faP;uniform vec3 faD;varying vec3 vLz,vLw;varying float vLc;\n' + LUZ_GLSL).replace('#include <lights_fragment_end>', FRAG)};
  m.customProgramCacheKey = () => 'lz|' + b; return m;
}
