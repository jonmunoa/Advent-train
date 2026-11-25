/* Ventanillas encendidas de los coches de viajeros: un compartimento pintado por capas (pared del fondo, viajeros y cortinas).
   En ordenador las capas se mueven unas sobre otras según se mira; en el móvil van aplastadas, con cuatro variantes. */
import {THREE, LOWQ, canvasTex, PLN} from './kit.js';

const S = 256, caja = (g, x, y, w, h, r) => {g.beginPath(); g.roundRect(x, y, w, h, r)};
const rad = (g, x, y, r, a, b) => {const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, a); q.addColorStop(1, b); return q};
const ver = (g, y0, y1, ...c) => {const q = g.createLinearGradient(0, y0, 0, y1); c.forEach((k, i) => q.addColorStop(i / (c.length - 1), k)); return q}, hor = (g, x0, x1, ...c) => {const q = g.createLinearGradient(x0, 0, x1, 0); c.forEach((k, i) => q.addColorStop(i / (c.length - 1), k)); return q};
function fondo(g) {
  g.fillStyle = ver(g, 0, S, '#f2d9a4', '#c08a50', '#7a4a26', '#4a2814'); g.fillRect(0, 0, S, S); for (let x = 0; x < S; x += 21) {g.fillStyle = 'rgba(40,18,6,.3)'; g.fillRect(x, 26, 2, S); g.fillStyle = 'rgba(255,220,160,.12)'; g.fillRect(x + 2, 26, 2, S)} g.fillStyle = ver(g, 0, 28, '#fff0cc', '#d8a868'); g.fillRect(0, 0, S, 26); g.fillStyle = '#5a3216'; g.fillRect(0, 25, S, 5);
  for (const x of [28, 228]) {g.fillStyle = rad(g, x, 84, 92, 'rgba(255,232,170,.95)', 'rgba(255,190,90,0)'); g.fillRect(x - 92, -8, 184, 184)}
  caja(g, 70, 58, 116, 100, 10); g.fillStyle = '#4a2a12'; g.fill(); caja(g, 78, 66, 100, 84, 6); g.fillStyle = ver(g, 66, 150, '#0c1226', '#1c2746', '#31405f'); g.fill(); g.fillStyle = 'rgba(255,240,210,.5)'; for (const [x, y, r] of [[96, 84, 1.6], [120, 104, 2], [150, 80, 1.4], [162, 126, 1.8], [108, 134, 1.5]]) {g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()}
  for (const [x, w] of [[62, 34], [160, 34]]) {g.fillStyle = hor(g, x, x + w, '#3e1010', '#7c2a26', '#4c1412', '#84302a', '#431010'); caja(g, x, 54, w, 106, 5); g.fill()} g.fillStyle = '#c79a48'; g.fillRect(58, 50, 140, 5);
  g.fillStyle = '#b98a3a'; g.fillRect(0, 40, S, 3); for (const [x, w, c] of [[14, 38, '#5a3218'], [96, 52, '#7a4a22'], [196, 40, '#3a2a20']]) {g.fillStyle = c; caja(g, x, 26, w, 16, 3); g.fill()}
  for (const x of [28, 228]) {g.fillStyle = '#fff6da'; g.beginPath(); g.moveTo(x - 11, 88); g.lineTo(x + 11, 88); g.lineTo(x + 7, 68); g.lineTo(x - 7, 68); g.fill(); g.fillStyle = '#b98a3a'; g.fillRect(x - 2, 88, 4, 14)}
  for (const x of [-30, 98, 226]) {caja(g, x + 4, 172, 52, 120, 16); g.fillStyle = hor(g, x, x + 60, '#3c1010', '#74282a', '#4a1414'); g.fill(); caja(g, x + 12, 176, 36, 22, 6); g.fillStyle = '#b8a684'; g.fill()}
}
/* una persona sentada, del pecho para arriba */
function persona(g, x, y, e, {piel = '#d89c74', pelo = '#3a2212', abrigo = '#2c3a58', gorro = null, ala = false, mono = false, bufanda = null, mira = 0} = {}) {
  g.save(); g.translate(x, y); g.scale(e, e); g.beginPath(); g.moveTo(-46, 96); g.bezierCurveTo(-46, 46, -30, 38, -12, 33); g.lineTo(12, 33); g.bezierCurveTo(30, 38, 46, 46, 46, 96); g.fillStyle = abrigo; g.fill(); g.fillStyle = hor(g, -46, 46, 'rgba(255,200,120,.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.4)'); g.fill();
  g.fillStyle = piel; g.fillRect(-8, 18, 16, 20); if (bufanda) {g.fillStyle = bufanda; caja(g, -19, 25, 38, 15, 7); g.fill()}
  if (!gorro || mono) {g.fillStyle = pelo; g.beginPath(); g.ellipse(0, -2, 21, 25, 0, 0, 7); g.fill(); if (mono) {g.beginPath(); g.arc(0, -27, 9, 0, 7); g.fill()}}
  g.fillStyle = piel; g.beginPath(); g.ellipse(mira * 4, 3, 16.5, 21, 0, 0, 7); g.fill(); g.fillStyle = rad(g, -14, -8, 40, 'rgba(255,225,170,.5)', 'rgba(60,20,0,.42)'); g.fill(); g.fillStyle = pelo; g.beginPath(); g.ellipse(mira * 2, -14, 18.5, 11, 0, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(50,26,16,.5)'; for (const d of [-6.5, 6.5]) {g.beginPath(); g.ellipse(mira * 5 + d, 1, 2, 2.4, 0, 0, 7); g.fill()} g.fillStyle = 'rgba(120,50,38,.35)'; g.fillRect(mira * 5 - 5, 13, 10, 2); g.fillStyle = 'rgba(120,60,40,.35)'; g.fillRect(mira * 6 - 1.5, 3, 3, 7);
  if (gorro) {g.fillStyle = gorro; if (ala) {caja(g, -18, -32, 36, 20, 7); g.fill(); caja(g, -27, -15, 54, 6, 3); g.fill()} else {g.beginPath(); g.ellipse(0, -11, 20, 19, 0, Math.PI, 0); g.fill(); caja(g, -20, -14, 40, 8, 3); g.fill(); g.beginPath(); g.arc(0, -31, 6, 0, 7); g.fill()}}
  g.restore();
}
const GENTE = [g => {persona(g, 88, 120, 1.25, {gorro: '#2a2622', ala: true, abrigo: '#3a3430', mira: .6}); g.fillStyle = '#e8dcc0'; g.save(); g.translate(122, 216); g.rotate(-.06); g.fillRect(-46, -30, 92, 62); g.fillStyle = 'rgba(60,50,40,.5)'; for (let k = 0; k < 6; k++) {g.fillRect(-40, -22 + k * 9, 36, 3); g.fillRect(5, -22 + k * 9, 36, 3)} g.restore()},
  g => {persona(g, 168, 128, 1.15, {mono: true, pelo: '#6a3a1c', abrigo: '#7a1a24', bufanda: '#e0c890', mira: -.6}); persona(g, 78, 172, .85, {gorro: '#8f3038', abrigo: '#23405f', piel: '#e6b48c', mira: .5})},
  g => {persona(g, 130, 122, 1.22, {gorro: '#1c5a3a', bufanda: '#c8323f', abrigo: '#4a3a2a', piel: '#b87850', mira: -.3})},
  g => {g.fillStyle = '#6a3a18'; g.fillRect(92, 206, 72, 60); g.fillStyle = '#8f3a30'; caja(g, 104, 176, 48, 36, 4); g.fill(); g.fillStyle = '#c8a050'; g.fillRect(125, 176, 6, 36); g.fillRect(104, 190, 48, 6)}];
function frente(g, cor = ['#43100f', '#86302a']) {
  for (const s of [0, 1]) {g.save(); if (s) {g.translate(S, 0); g.scale(-1, 1)} g.beginPath(); g.moveTo(0, 0); g.lineTo(58, 0); g.bezierCurveTo(56, 90, 20, 130, 34, S); g.lineTo(0, S); g.fillStyle = hor(g, 0, 58, cor[0], cor[1], cor[0], cor[1], cor[0]); g.fill(); g.fillStyle = '#c79a48'; g.fillRect(6, 150, 24, 7); g.restore()}
  g.fillStyle = ver(g, 0, 34, cor[0], cor[1], cor[0]); g.beginPath(); g.moveTo(0, 0); g.lineTo(S, 0); g.lineTo(S, 26); for (let k = 4; k >= 0; k--) g.quadraticCurveTo((k + .5) * S / 5, 46, k * S / 5, 26); g.fill();
  g.fillStyle = ver(g, 0, 40, 'rgba(10,4,0,.75)', 'rgba(10,4,0,0)'); g.fillRect(0, 0, S, 40); g.fillStyle = hor(g, 0, 26, 'rgba(10,4,0,.6)', 'rgba(10,4,0,0)'); g.fillRect(0, 0, 26, S); g.fillStyle = hor(g, S, S - 26, 'rgba(10,4,0,.6)', 'rgba(10,4,0,0)'); g.fillRect(S - 26, 0, 26, S);
}
/* atlas 2 × 2: en ordenador las cuatro estampas de viajeros; en el móvil, cuatro ventanillas hechas */
const en = (g, i, f) => {g.save(); g.translate(i % 2 * S, Math.floor(i / 2) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); f(g); g.restore()};
export function ventanilla(id, cor) {
  if (LOWQ) {const m = new THREE.MeshBasicMaterial({map: canvasTex(S * 2, S * 2, g => GENTE.forEach((q, i) => en(g, i, () => {g.filter = 'blur(1px)'; fondo(g); g.save(); g.translate(-18, -10); g.scale(1.14, 1.14); q(g); g.restore(); g.filter = 'none'; frente(g, cor)})), 'ven-p' + id)}); m.color.setRGB(1.5, 1.32, 1.05); return m}
  const tf = canvasTex(S, S, g => {g.filter = 'blur(1.2px)'; fondo(g); g.filter = 'none'}, 'ven-f'), tg = canvasTex(S * 2, S * 2, g => GENTE.forEach((q, i) => en(g, i, () => {g.filter = 'blur(.8px)'; q(g); g.filter = 'none'})), 'ven-g'), tc = canvasTex(S, S, g => frente(g, cor), 'ven-c' + id); for (const t of [tf, tg, tc]) t.premultiplyAlpha = true;
  const m = new THREE.MeshBasicMaterial({map: tc}), U = {tVf: {value: tf}, tVg: {value: tg}}; m.color.setRGB(1.5, 1.32, 1.05); m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U); s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vVw;').replace('#include <project_vertex>', '#include <project_vertex>\nvVw=mvPosition.xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vVw;uniform sampler2D tVf,tVg;').replace('#include <map_fragment>', `{vec3 q0=dFdx(vVw),q1=dFdy(vVw);vec2 s0=dFdx(vMapUv),s1=dFdy(vMapUv);float dt=s0.x*s1.y-s1.x*s0.y;vec3 T=(q0*s1.y-q1*s0.y)/dt,B=(-q0*s1.x+q1*s0.x)/dt,N=normalize(cross(q0,q1)),V=normalize(vVw);float z=max(abs(dot(V,N)),.22);vec2 sh=vec2(dot(V,T)/dot(T,T),dot(V,B)/dot(B,B))/z,k2=floor(vMapUv),u=fract(vMapUv);float h=fract(sin(dot(k2,vec2(12.99,78.23)))*43758.5);
vec2 ub=.5+(u-.5+sh*1.4)/2.4,up=.5+(u-.5+sh*.55)/1.6;ub.x=1.-abs(1.-mod(ub.x,2.));vec3 c=textureGrad(tVf,vec2(ub.x,clamp(ub.y,.01,.99)),s0*.42,s1*.42).rgb;float n=h<.34?0.:h<.64?1.:h<.9?2.:3.;if(fract(h*37.)>.5)up.x=1.-up.x;if(up.x>.004&&up.x<.996&&up.y>.004&&up.y<.996){vec4 p=textureGrad(tVg,up*.5+vec2(mod(n,2.)*.5,n<2.?.5:0.),s0*.31,s1*.31);c=c*(1.-p.a)+p.rgb;}vec4 f=textureGrad(map,u,s0,s1);c=c*(1.-f.a)+f.rgb*.8;c+=vec3(.05,.07,.1)*smoothstep(.1,.0,abs(u.x*.6+u.y-.9-.1*h))*.6;diffuseColor.rgb*=c;}`)}; m.customProgramCacheKey = () => 'ventanilla'; m.userData.solo = true; return m;
}
/* cristal de ventanilla: k elige la variante (va en la parte entera de u; en el móvil, en el cuadrante) */
let nv = 0;
export function cristal(w, h, k = nv++) {const g = PLN(w, h), u = g.attributes.uv; for (let i = 0; i < u.count; i++) {const x = u.getX(i), y = u.getY(i); if (LOWQ) u.setXY(i, (k % 2 + .01 + x * .98) / 2, ((k >> 1) % 2 + .01 + y * .98) / 2); else u.setXY(i, k % 64 + .001 + x * .998, y * .998 + .001)} return g}
