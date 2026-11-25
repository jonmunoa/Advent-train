/* Altura mínima a la que puede ir la cámara en cada metro de una maqueta: por encima del suelo y de los edificios, con las laderas suaves (un campo
   continuo: la cámara sube y baja poco a poco al acercarse a algo, sin saltos). Se prepara una vez, al terminar de montar la maqueta: se dibuja
   desde arriba con la altura como color y se lee sin parar el fotograma. */
import {THREE} from './kit.js';
import {BW, BD} from './esc-vias.js';
import {corrientes} from './esc-nivel.js';

export const TW = Math.ceil(2 * BW) + 8, TH = Math.ceil(2 * BD) + 8;
const Y0 = -20, YR = 90, PEND = 2.1, inv = {value: new THREE.Matrix4()};
const MAT = new THREE.ShaderMaterial({side: THREE.DoubleSide, uniforms: {inv}, vertexShader: 'uniform mat4 inv;varying float h;void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\np=modelMatrix*p;h=(inv*p).y;gl_Position=projectionMatrix*viewMatrix*p;}', fragmentShader: `varying float h;void main(){float v=clamp((h-(${Y0.toFixed(1)}))/${YR.toFixed(1)},0.,1.)*255.;gl_FragColor=vec4(floor(v)/255.,fract(v),0.,1.);}`});
const cam = new THREE.Camera(), esc = new THREE.Scene(); cam.matrixAutoUpdate = cam.matrixWorldAutoUpdate = false; esc.matrixWorldAutoUpdate = false; let rt = null;
/* de la maqueta a la imagen: x a lo ancho, z a lo alto, y al fondo */
cam.projectionMatrix.set(2 / TW, 0, 0, 0, 0, 0, 2 / TH, 0, 0, -1 / 60, 0, 0, 0, 0, 0, 1); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
/* el suelo solo (hasta que se lea el dibujo, o si no se puede) */
function suelo(m) {const G = new Float32Array(TW * TH); for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) G[j * TW + i] = m.gy(i + .5 - TW / 2, j + .5 - TH / 2) + 1.9; return G}
/* laderas: desde cada punto se baja como mucho PEND por metro; después se redondean los picos */
function suaviza(G) {const P = PEND, Q = PEND * 1.4142, b = (a, v) => v > a ? v : a; for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {const k = j * TW + i; let v = G[k]; if (i) v = b(v, G[k - 1] - P); if (j) {v = b(v, G[k - TW] - P); if (i) v = b(v, G[k - TW - 1] - Q); if (i < TW - 1) v = b(v, G[k - TW + 1] - Q)} G[k] = v} for (let j = TH - 1; j >= 0; j--) for (let i = TW - 1; i >= 0; i--) {const k = j * TW + i; let v = G[k]; if (i < TW - 1) v = b(v, G[k + 1] - P); if (j < TH - 1) {v = b(v, G[k + TW] - P); if (i) v = b(v, G[k + TW - 1] - Q); if (i < TW - 1) v = b(v, G[k + TW + 1] - Q)} G[k] = v} for (let p = 0; p < 2; p++) for (const [n, m, a, b] of [[TH, TW, TW, 1], [TW, TH, 1, TW]]) {const t = new Float32Array(m); for (let j = 0; j < n; j++) {for (let i = 0; i < m; i++) {let s = 0; for (let q = -2; q <= 2; q++) s += G[j * a + Math.min(m - 1, Math.max(0, i + q)) * b]; t[i] = s / 5} for (let i = 0; i < m; i++) G[j * a + i * b] = t[i]}} return G}
/* altura mínima en (x, z), con interpolación */
export function campo(m, x, z) {const G = m.techoG || (m.techoG = suaviza(suelo(m))), u = Math.min(TW - 1.001, Math.max(0, x + TW / 2 - .5)), v = Math.min(TH - 1.001, Math.max(0, z + TH / 2 - .5)), i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, k = j * TW + i; return (G[k] * (1 - a) + G[k + 1] * a) * (1 - b) + (G[k + TW] * (1 - a) + G[k + TW + 1] * a) * b}
export function techoDe(renderer, m) {
  if (m.techoLeido) return; m.techoLeido = true; m.techoG = suaviza(suelo(m)); rt ||= new THREE.WebGLRenderTarget(TW, TH, {generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
  const no = new Set([m.tren.g, ...(m.mas || []).map(t => t.g), m.caja, m.domo, m.frente, m.adorno, m.terr].filter(Boolean)), L = [], ve = o => {if (no.has(o) || !o.visible) return; const q = o.material; if (o.isMesh && q && !q.transparent && !q.alphaTest && q.visible !== false && !o.userData.sinSombra) L.push(o); o.children.forEach(ve)}; ve(m.g);
  m.g.updateMatrixWorld(true); inv.value.copy(m.g.matrixWorld).invert(); cam.matrixWorld.copy(m.g.matrixWorld); cam.matrixWorldInverse.copy(inv.value);
  const r0 = renderer.getRenderTarget(), ac = renderer.autoClear, cc = new THREE.Color(), ca = renderer.getClearAlpha(), H = []; renderer.getClearColor(cc); for (const o of L) if (o.children.length) {H.push([o, o.children]); o.children = []}
  renderer.setRenderTarget(rt); renderer.setClearColor(0, 0); renderer.clear(); renderer.autoClear = false; esc.overrideMaterial = MAT; esc.children = L; const fc = L.map(o => o.frustumCulled); L.forEach(o => {o.frustumCulled = false}); corrientes(L, () => renderer.render(esc, cam)); L.forEach((o, i) => {o.frustumCulled = fc[i]}); esc.children = []; for (const [o, c] of H) o.children = c; renderer.autoClear = ac; renderer.setClearColor(cc, ca);
  const b = new Uint8Array(TW * TH * 4); renderer.readRenderTargetPixelsAsync(rt, 0, 0, TW, TH, b).then(() => {
    const R = new Float32Array(TW * TH); for (let i = 0; i < R.length; i++) R[i] = b[i * 4] || b[i * 4 + 1] ? Y0 + (b[i * 4] + b[i * 4 + 1] / 255) / 255 * YR : -1e3;
    // fuera lo fino (cables, postes, cercas): solo cuenta lo que ocupa tres metros seguidos a lo ancho y a lo largo
    const en = (i, j) => R[Math.min(TH - 1, Math.max(0, j)) * TW + Math.min(TW - 1, Math.max(0, i))], G = suelo(m); for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {let v = 1e9; for (let q = -1; q <= 1; q++) for (let p = -1; p <= 1; p++) v = Math.min(v, en(i + p, j + q)); const k = j * TW + i; if (v > G[k] + 1) for (let q = -2; q <= 2; q++) for (let p = -2; p <= 2; p++) {const a = i + p, c = j + q; if (a >= 0 && c >= 0 && a < TW && c < TH) G[c * TW + a] = Math.max(G[c * TW + a], v + 1.3)}}
    m.techoG = suaviza(G);
  }).catch(() => {}); renderer.setRenderTarget(r0);
}
