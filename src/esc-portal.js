/* La calle vista desde dentro del escaparate: un cristal con escarcha en los bordes que se pierde en la bruma del paisaje, y al otro lado la calle
   desenfocada según lo lejos que está (lo que se arrima al cristal, nítido). La calle se dibuja aparte solo cuando se mira hacia ella. */
import {THREE, LOWQ, canvasTex, rng, lerp, vnoise} from './kit.js';
import {VX, VY0, VY1} from './esc-calle.js';

const W2 = VX, H2 = (VY1 - VY0) / 2, MX = 46, MY = 40, BJ = 9, TAPS = LOWQ ? 10 : 18;   // MX, MY: cuánto se sale el cristal del hueco, para perderse en la bruma
export const portalRT = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: LOWQ ? 4 : 0, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, depthTexture: new THREE.DepthTexture(4, 4)});
const pU = {m: {value: portalRT.texture}, dz: {value: portalRT.depthTexture}, r: {value: new THREE.Vector2()}, nf: {value: new THREE.Vector2(.4, 900)}, cp: {value: new THREE.Vector3()}, cd: {value: new THREE.Vector3()}, fr: {value: null}, bru: {value: new THREE.Color()}, luz: {value: 1}, k: {value: 1}, px: {value: 1}};

/* flores de hielo: ramas que crecen desde los bordes hacia dentro */
function escarcha() {
  const tw = LOWQ ? 512 : 1024, th = tw * .62 | 0;
  return canvasTex(tw, th, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const R = rng(77), u = w / 1024; g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    const rama = (x, y, a, l, n, gr) => {const p = Math.max(3, l / (5 * u) | 0); let px = x, py = y, t = a; for (let i = 0; i < p; i++) {t += (R() - .5) * .16; const qx = px + Math.cos(t) * 5 * u, qy = py + Math.sin(t) * 5 * u, f = 1 - i / p; g.strokeStyle = `rgba(255,255,255,${(.1 + .16 * f) * (n ? .8 : 1)})`; g.lineWidth = Math.max(.6, gr * f) * u; g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke(); px = qx; py = qy; if (n < 2 && i > 0 && (n ? R() < .55 : 1)) for (const s of [-1, 1]) rama(px, py, t + s * (.85 + R() * .25), l * f * (n ? .3 : .34) * (.6 + R() * .6), n + 1, gr * .6)}};
    for (let i = 0; i < 46; i++) {const s = R() * 2 * (w + h), [x, y, a] = s < w ? [s, 0, Math.PI / 2] : s < w + h ? [w, s - w, Math.PI] : s < 2 * w + h ? [s - w - h, h, -Math.PI / 2] : [0, s - 2 * w - h, 0]; rama(x, y, a + (R() - .5) * 1.1, (70 + R() * 130) * u, 0, 2.6)}
    // velo fino de escarcha, más espeso en los bordes
    const d = g.getImageData(0, 0, w, h), D = d.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {const i = (y * w + x) * 4, n = vnoise(x / u * .02, y / u * .02) * .5 + vnoise(x / u * .07, y / u * .07) * .3 + vnoise(x / u * .3, y / u * .3) * .2; D[i + 1] = n * 255; D[i + 2] = vnoise(x / u * .9, y / u * .9) * 255} g.putImageData(d, 0, 0);
  }, 'escarcha', false);
}
const FS = `uniform sampler2D m,dz,fr;uniform vec2 r,nf;uniform vec3 cp,cd,bru;uniform float luz,k,px;varying vec3 vW;varying vec2 q;
float mz(vec2 u){float d=texture2D(dz,u).r*2.-1.,v=2.*nf.x*nf.y/(nf.y+nf.x-d*(nf.y-nf.x));vec3 D=normalize(vW-cp);return cp.z+D.z*v/max(.05,dot(D,cd));}
float coc(float z){return smoothstep(16.,150.,z)*.85+smoothstep(6.,30.,z)*.15;}
void main(){
  vec2 s=gl_FragCoord.xy/r;vec3 D=normalize(vW-cp);float gz=smoothstep(.03,.34,D.z);
  vec2 b=abs(q-vec2(0.,-${BJ.toFixed(1)}))-vec2(${W2.toFixed(1)},${(H2 + 0).toFixed(1)}+${BJ.toFixed(1)});float sd=length(max(b,0.))+min(max(b.x,b.y),0.);
  vec4 f=texture2D(fr,q/vec2(${(2 * W2 + 14).toFixed(1)},${(2 * H2 + 14).toFixed(1)})+.5);float n=f.g;
  float a=1.-smoothstep(-9.,${(MX * .62).toFixed(1)},sd+(n-.5)*34.);a*=gz*k;if(a<.015)discard;
  float z0=mz(s),c0=coc(z0),R=c0*.021;                                      // lo que se desenfoca este punto, en alto de pantalla
  vec3 ac=vec3(0.);float w=0.;vec2 as=vec2(r.y/r.x,1.);
  float es=smoothstep(-24.,6.,sd+(n-.5)*30.);R=max(R,es*.024);float lod=log2(max(1.,R*r.y*px/float(${TAPS})*${LOWQ ? '4.2' : '4.6'}));
  for(int i=0;i<${TAPS};i++){float t=(float(i)+.5)/float(${TAPS}),rr=sqrt(t);float an=float(i)*2.39996;vec2 u=s+vec2(cos(an),sin(an))*rr*R*as;float ci=max(coc(mz(u)),es)*.021;float wi=smoothstep(0.,.0035,ci-rr*R+.0035)+.0004;vec3 c=textureLod(m,u,lod).rgb;c=min(c,vec3(9.));wi*=1.+.6*dot(c,vec3(.3333));ac+=c*wi;w+=wi;}
  vec3 c=ac/w;
  // escarcha: flores de hielo y un velo en los bordes; por abajo, el vaho
  float borde=smoothstep(-20.,8.,sd+(n-.5)*22.),flor=f.r*smoothstep(-46.,-4.,sd+(n-.5)*8.),vaho=smoothstep(-${(H2 * .55).toFixed(1)},-${H2.toFixed(1)},q.y)*.12*(.5+n);
  float y=dot(bru,vec3(.3,.59,.11));vec3 hielo=mix(bru,vec3(.8,.89,1.)*y,.45)*1.15+vec3(.5,.56,.66)*luz*.05;
  c=mix(c,hielo*(.86+.28*f.b*f.g),clamp(borde*.82+vaho,0.,.94));c+=(hielo*.55+vec3(.06,.07,.09)*luz)*flor*(1.-borde*.35);
  c=mix(c,bru,smoothstep(-2.,20.,sd+(n-.5)*26.)*.9);
  gl_FragColor=vec4(c,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function hacePortal() {
  pU.fr.value = escarcha(); const g = new THREE.PlaneGeometry(2 * (W2 + MX), 2 * (H2 + MY)).rotateY(Math.PI);
  const q = new THREE.Mesh(g, new THREE.ShaderMaterial({uniforms: pU, transparent: true, depthWrite: true, vertexShader: 'varying vec3 vW;varying vec2 q;void main(){q=position.xy;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}', fragmentShader: FS}));
  q.renderOrder = 1; q.position.y = (VY0 + VY1) / 2; q.visible = false; q.frustumCulled = true; return q;
}
export function tamañoPortal(W, H) {const q = LOWQ ? .6 : .8; portalRT.setSize(Math.max(2, W * q | 0), Math.max(2, H * q | 0))}
const D = new THREE.Vector3(), F = new THREE.Frustum(), PM = new THREE.Matrix4(), BB = new THREE.Box3();
/* si algo del cristal entra en el plano y no se mira de canto o de espaldas */
export function seVePortal(q, camera) {const c = camera.position, x = q.position.x; camera.updateMatrixWorld(); F.setFromProjectionMatrix(PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); BB.min.set(x - W2 - 14, VY0 - 12, -2.4); BB.max.set(x + W2 + 14, VY1 + 12, -2); if (!F.intersectsBox(BB)) return false; const dx = Math.max(0, Math.abs(c.x - x) - W2 - 14); return -2.2 - c.z > .045 * Math.hypot(dx, c.z + 2.2)}
/* antes de dibujar la calle: la cámara, la bruma de la maqueta y el tamaño del búfer en el que se pinta la escena */
export function ponPortal(camera, bruma, noche, w, h) {camera.getWorldDirection(D); pU.cd.value.copy(D); pU.cp.value.copy(camera.position); pU.nf.value.set(camera.near, camera.far); if (bruma) pU.bru.value.copy(bruma); pU.luz.value = noche ? .5 : 1; pU.r.value.set(w, h); pU.px.value = portalRT.height / h}
