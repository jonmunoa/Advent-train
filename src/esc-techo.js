/* Altura de lo que hay en cada metro de una maqueta (edificios, árboles, rocas), para que la cámara no acabe dentro de nada. Se saca una sola vez
   por maqueta: se dibuja desde arriba con la altura como color y se lee sin parar el fotograma. */
import {THREE} from './kit.js';
import {BW, BD} from './esc-vias.js';

export const TW = Math.ceil(2 * BW) + 8, TH = Math.ceil(2 * BD) + 8;
const Y0 = -20, YR = 90, inv = {value: new THREE.Matrix4()};
const MAT = new THREE.ShaderMaterial({side: THREE.DoubleSide, uniforms: {inv}, vertexShader: 'uniform mat4 inv;varying float h;void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\np=modelMatrix*p;h=(inv*p).y;gl_Position=projectionMatrix*viewMatrix*p;}', fragmentShader: `varying float h;void main(){float v=clamp((h-(${Y0.toFixed(1)}))/${YR.toFixed(1)},0.,1.)*255.;gl_FragColor=vec4(floor(v)/255.,fract(v),0.,1.);}`});
const cam = new THREE.Camera(), esc = new THREE.Scene(); cam.matrixAutoUpdate = cam.matrixWorldAutoUpdate = false; esc.matrixWorldAutoUpdate = false; let rt = null;
/* de la maqueta a la imagen: x a lo ancho, z a lo alto, y al fondo */
cam.projectionMatrix.set(2 / TW, 0, 0, 0, 0, 0, 2 / TH, 0, 0, -1 / 60, 0, 0, 0, 0, 0, 1); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
export function techoDe(renderer, m) {
  if (m.techoG) return m.techoG; const G = m.techoG = new Float32Array(TW * TH).fill(-1e3); rt ||= new THREE.WebGLRenderTarget(TW, TH, {generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
  const no = new Set([m.tren.g, ...(m.mas || []).map(t => t.g), m.caja, m.domo, m.frente, m.adorno].filter(Boolean)), L = [], ve = o => {if (no.has(o) || !o.visible) return; const q = o.material; if (o.isMesh && q && !q.transparent && q.visible !== false) L.push(o); o.children.forEach(ve)}; ve(m.g);
  m.g.updateMatrixWorld(true); inv.value.copy(m.g.matrixWorld).invert(); cam.matrixWorld.copy(m.g.matrixWorld); cam.matrixWorldInverse.copy(inv.value);
  const r0 = renderer.getRenderTarget(), ac = renderer.autoClear, cc = new THREE.Color(), ca = renderer.getClearAlpha(), H = []; renderer.getClearColor(cc); for (const o of L) if (o.children.length) {H.push([o, o.children]); o.children = []}
  renderer.setRenderTarget(rt); renderer.setClearColor(0, 0); renderer.clear(); renderer.autoClear = false; esc.overrideMaterial = MAT; esc.children = L; const fc = L.map(o => o.frustumCulled); L.forEach(o => {o.frustumCulled = false}); renderer.render(esc, cam); L.forEach((o, i) => {o.frustumCulled = fc[i]}); esc.children = []; for (const [o, c] of H) o.children = c; renderer.autoClear = ac; renderer.setClearColor(cc, ca);
  const b = new Uint8Array(TW * TH * 4); renderer.readRenderTargetPixelsAsync(rt, 0, 0, TW, TH, b).then(() => {
    const R = new Float32Array(TW * TH); for (let i = 0; i < R.length; i++) R[i] = b[i * 4] || b[i * 4 + 1] ? Y0 + (b[i * 4] + b[i * 4 + 1] / 255) / 255 * YR : -1e3;
    // fuera lo muy fino (cables, postes); y dos metros de margen alrededor de lo demás
    const S = new Float32Array(TW * TH), en = (A, i, j) => A[Math.min(TH - 1, Math.max(0, j)) * TW + Math.min(TW - 1, Math.max(0, i))];
    for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {const v = en(R, i, j); S[j * TW + i] = Math.min(v, Math.max(en(R, i - 1, j), en(R, i + 1, j)), Math.max(en(R, i, j - 1), en(R, i, j + 1)))}
    for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {let v = -1e3; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (a * a + b * b < 7) v = Math.max(v, en(S, i + a, j + b)); G[j * TW + i] = v + .5}
  }).catch(() => {}); renderer.setRenderTarget(r0); return G;
}
