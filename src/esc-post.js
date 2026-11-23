/* Posprocesado ligero: todo se dibuja una vez en un búfer con antialiasing ×4 y, ya resuelto, el brillo (bloom), el
   desenfoque de miniatura y el revelado van en unos pocos pases pequeños. El último pinta directamente en la pantalla. */
import {THREE} from './kit.js';

const VS = 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mesh = new THREE.Mesh(tri); mesh.frustumCulled = false;
const sh = (uniforms, fragmentShader, o = {}) => new THREE.ShaderMaterial({uniforms, vertexShader: VS, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, ...o});
const RT = () => new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, depthBuffer: false});

export class Post {
  constructor(renderer) {
    this.r = renderer; this.samples = 4; this.bloom = .5;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4, resolveDepthBuffer: false});
    this.half = RT(); this.dof = RT(); this.dof2 = RT(); this.b = [RT(), RT(), RT(), RT()];
    this.down = sh({m: {value: null}, p: {value: new THREE.Vector2()}, th: {value: 0}}, 'uniform sampler2D m;uniform vec2 p;uniform float th;varying vec2 v;void main(){vec3 c=texture2D(m,v+p*vec2(-1.,-1.)).rgb+texture2D(m,v+p*vec2(1.,-1.)).rgb+texture2D(m,v+p*vec2(-1.,1.)).rgb+texture2D(m,v+p).rgb;c*=.25;c=min(c,vec3(12.));if(th>0.){float l=max(c.r,max(c.g,c.b)),k=clamp(l-th+.25,0.,.5);c*=max(k*k*2.,l-th)/max(l,1e-4);}gl_FragColor=vec4(c,1.);}');
    this.up = sh({m: {value: null}, p: {value: new THREE.Vector2()}, k: {value: 1}}, 'uniform sampler2D m;uniform vec2 p;uniform float k;varying vec2 v;void main(){vec3 c=texture2D(m,v).rgb*4.;c+=(texture2D(m,v+vec2(p.x,0.)).rgb+texture2D(m,v-vec2(p.x,0.)).rgb+texture2D(m,v+vec2(0.,p.y)).rgb+texture2D(m,v-vec2(0.,p.y)).rgb)*2.;c+=texture2D(m,v+p).rgb+texture2D(m,v-p).rgb+texture2D(m,v+vec2(p.x,-p.y)).rgb+texture2D(m,v+vec2(-p.x,p.y)).rgb;gl_FragColor=vec4(c*k/16.,1.);}', {blending: THREE.AdditiveBlending, transparent: true});
    this.gau = sh({m: {value: null}, p: {value: new THREE.Vector2()}}, 'uniform sampler2D m;uniform vec2 p;varying vec2 v;void main(){vec3 c=texture2D(m,v).rgb*.227;c+=(texture2D(m,v+p*1.385).rgb+texture2D(m,v-p*1.385).rgb)*.316;c+=(texture2D(m,v+p*3.231).rgb+texture2D(m,v-p*3.231).rgb)*.0703;gl_FragColor=vec4(c,1.);}');
    const u = this.u = {m: {value: null}, b: {value: null}, d: {value: null}, bk: {value: .5}, tilt: {value: 0}, foc: {value: .5}, t: {value: 0}, cut: {value: 0}, frio: {value: .5}, toneMappingExposure: {value: 1.05}};
    this.fin = sh(u, `uniform sampler2D m,b,d;uniform float bk,tilt,foc,t,cut,frio;varying vec2 v;
#include <tonemapping_pars_fragment>
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec3 c=texture2D(m,v).rgb;float k=smoothstep(.16,.52,abs(v.y-foc))*tilt;if(k>.01)c=mix(c,texture2D(d,v).rgb,k);c+=texture2D(b,v).rgb*bk;
vec2 q=v-.5;c*=mix(.5,1.,smoothstep(.95,.3,length(q*vec2(1.1,1.))));float l=dot(c,vec3(.2126,.7152,.0722));c=mix(c,c*vec3(.92,.97,1.13),smoothstep(.3,0.,l)*frio);c=mix(c,c*vec3(1.08,1.,.88),smoothstep(.4,1.5,l)*.5);c=mix(vec3(l),c,1.13);c*=1.-cut;
c=ACESFilmicToneMapping(max(c,0.));c=mix(pow(c,vec3(.41666))*1.055-.055,c*12.92,vec3(lessThanEqual(c,vec3(.0031308))));gl_FragColor=vec4(c+(h(v*977.+fract(t))-.5)*.012,1.);}`);
  }
  size(w, h) {
    this.rt.setSize(w, h); const s = (t, k) => t.setSize(Math.max(2, Math.round(w / k)), Math.max(2, Math.round(h / k))); s(this.half, 2); s(this.dof, 4); s(this.dof2, 4); this.b.forEach((t, i) => s(t, 4 << i));
  }
  msaa(n) {if (this.samples === n) return; this.samples = n; this.rt.dispose(); this.rt.samples = n}
  paso(mat, src, dst, uni) {mat.uniforms.m.value = src ? src.texture : null; if (uni) for (const k in uni) mat.uniforms[k].value = uni[k]; mesh.material = mat; this.r.setRenderTarget(dst); this.r.render(mesh, cam)}
  px(t, k = 1) {return new THREE.Vector2(k / t.width, k / t.height)}
  /* dibuja las escenas sobre el mismo búfer: solo la última lo resuelve, así el antialiasing se paga una vez */
  escenas(list, camera) {
    const r = this.r, rt = this.rt; r.setRenderTarget(rt); r.clear();
    list.forEach((s, i) => {if (i < list.length - 1) rt.samples = 0; r.render(s, camera); rt.samples = this.samples});
  }
  render(list, camera) {
    this.escenas(list, camera); const {rt, half, b, u} = this;
    this.paso(this.down, rt, half, {p: this.px(rt, .5), th: 0});
    if (u.tilt.value > .01) {this.paso(this.down, half, this.dof, {p: this.px(half, .5), th: 0}); this.paso(this.gau, this.dof, this.dof2, {p: new THREE.Vector2(1 / this.dof.width, 0)}); this.paso(this.gau, this.dof2, this.dof, {p: new THREE.Vector2(0, 1 / this.dof.height)})}
    if (this.bloom > 0) {this.paso(this.down, half, b[0], {p: this.px(half, .5), th: .95}); for (let i = 1; i < 4; i++) this.paso(this.down, b[i - 1], b[i], {p: this.px(b[i - 1], .5), th: 0}); this.r.autoClear = false; for (let i = 3; i > 0; i--) this.paso(this.up, b[i], b[i - 1], {p: this.px(b[i]), k: .9})}
    u.b.value = b[0].texture; u.d.value = this.dof.texture; u.bk.value = this.bloom; this.paso(this.fin, rt, null);
  }
}
