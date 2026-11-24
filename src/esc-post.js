/* El revelado. Las escenas se dibujan una vez en un búfer de alto rango con antialiasing y después, en pasadas pequeñas:
   oclusión ambiental (GTAO a media resolución), luz dispersa en la niebla (a un cuarto), desenfoque de cámara y de miniatura,
   brillo sin umbral, exposición automática y el pase final (escalado con nitidez, AgX, etalonaje, grano). */
import {THREE} from './kit.js';

const VS = 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mesh = new THREE.Mesh(tri); mesh.frustumCulled = false;
const V2 = (a = 0, b = a) => new THREE.Vector2(a, b), V3 = () => new THREE.Vector3(), V4 = () => new THREE.Vector4();
const sh = (uniforms, fragmentShader, o = {}) => new THREE.ShaderMaterial({uniforms, vertexShader: VS, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, ...o});
const RT = (o = {}) => new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, depthBuffer: false, ...o});
const NL = 20;   // luces que encienden la niebla

const LIN = 'uniform vec2 nf;float lin(float d){return nf.x*nf.y/(nf.y-d*(nf.y-nf.x));}';
const IGN = 'float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}';

export class Post {
  /* alto: con oclusión y desenfoques; si no (móvil), brillo, niebla y revelado */
  constructor(renderer, {alto = true} = {}) {
    this.r = renderer; this.alto = alto; this.samples = 4; this.bloom = .5; this.sinAO = !alto; this.esc = 1; this.sinNiebla = false;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4, resolveDepthBuffer: true, depthTexture: new THREE.DepthTexture(4, 4, THREE.UnsignedIntType)});
    // se quita el multimuestreo ya dentro del dibujo (después de las sombras, que vuelven a enlazar el búfer) para no resolverlo a medias
    this.pinza = new THREE.Mesh(tri, new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false, depthTest: false})); this.pinza.frustumCulled = false; this.pinza.renderOrder = -1e4; this.pinza.onBeforeRender = () => {if (this.abierto) this.rt.samples = 0};
    // reloj de la gráfica: cuánto tarda cada fotograma de verdad (para ajustar la resolución)
    const gl = renderer.getContext(), tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'); this.tq = tq && {gl, e: tq, cola: [], ms: 0, n: 0};
    this.foco = {a: 0, d: 100}; this.cocR = RT(); this.boke = RT(); this.half = RT({generateMipmaps: alto, minFilter: alto ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter}); this.dof = RT(); this.dof2 = RT(); this.b = [0, 1, 2, 3, 4, 5].map(() => RT());
    this.ln = RT({type: THREE.FloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter}); this.aoA = RT({format: THREE.RGFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter}); this.aoB = RT({format: THREE.RGFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter}); this.nie = RT(); this.ex = [0, 1].map(() => RT({type: THREE.HalfFloatType, format: THREE.RGBAFormat})); this.exi = 0; this.ex.forEach(t => t.setSize(1, 1));
    const Z = this.zu = {z: {value: null}, nf: {value: V2(2, 2600)}, fo: {value: new THREE.Vector3(100, 0, 9)}}, P = this.pr = {value: V2(1, 1)};
    /* reducción de 13 muestras (Jimenez): sin parpadeos en las bombillas */
    this.down = sh({m: {value: null}, p: {value: V2()}, ka: {value: 0}}, `uniform sampler2D m;uniform vec2 p;uniform float ka;varying vec2 v;vec3 q(float x,float y){return min(texture2D(m,v+p*vec2(x,y)).rgb,vec3(60.));}float w(vec3 c){return mix(1.,1./(1.+max(c.r,max(c.g,c.b))),ka);}
void main(){vec3 A=(q(-1.,-1.)+q(1.,-1.)+q(-1.,1.)+q(1.,1.))*.25,e=q(0.,0.),t=q(0.,2.),b=q(0.,-2.),l=q(-2.,0.),r=q(2.,0.),B=(q(-2.,2.)+t+l+e)*.25,C=(t+q(2.,2.)+e+r)*.25,D=(l+e+q(-2.,-2.)+b)*.25,E=(e+r+b+q(2.,-2.))*.25;float a=w(A)*.5,f=w(B)*.125,g=w(C)*.125,h=w(D)*.125,i=w(E)*.125;gl_FragColor=vec4((A*a+B*f+C*g+D*h+E*i)/(a+f+g+h+i),1.);}`);
    this.chica = sh({m: {value: null}, p: {value: V2()}}, 'uniform sampler2D m;uniform vec2 p;varying vec2 v;void main(){vec3 c=texture2D(m,v+p*vec2(-1.,-1.)).rgb+texture2D(m,v+p*vec2(1.,-1.)).rgb+texture2D(m,v+p*vec2(-1.,1.)).rgb+texture2D(m,v+p).rgb;gl_FragColor=vec4(min(c*.25,vec3(60.)),1.);}');
    this.up = sh({m: {value: null}, p: {value: V2()}, k: {value: 1}}, 'uniform sampler2D m;uniform vec2 p;uniform float k;varying vec2 v;void main(){vec3 c=texture2D(m,v).rgb*4.;c+=(texture2D(m,v+vec2(p.x,0.)).rgb+texture2D(m,v-vec2(p.x,0.)).rgb+texture2D(m,v+vec2(0.,p.y)).rgb+texture2D(m,v-vec2(0.,p.y)).rgb)*2.;c+=texture2D(m,v+p).rgb+texture2D(m,v-p).rgb+texture2D(m,v+vec2(p.x,-p.y)).rgb+texture2D(m,v+vec2(-p.x,p.y)).rgb;gl_FragColor=vec4(c*k/16.,1.);}', {blending: THREE.AdditiveBlending, transparent: true});
    this.gau = sh({m: {value: null}, p: {value: V2()}}, 'uniform sampler2D m;uniform vec2 p;varying vec2 v;void main(){vec3 c=texture2D(m,v).rgb*.227;c+=(texture2D(m,v+p*1.385).rgb+texture2D(m,v-p*1.385).rgb)*.316;c+=(texture2D(m,v+p*3.231).rgb+texture2D(m,v-p*3.231).rgb)*.0703;gl_FragColor=vec4(c,1.);}');
    /* profundidad lineal a media resolución */
    this.lin = sh({m: {value: null}, z: Z.z, nf: Z.nf}, LIN + 'uniform sampler2D z;varying vec2 v;void main(){gl_FragColor=vec4(lin(texture2D(z,v).r),0.,0.,1.);}');
    /* oclusión ambiental por horizontes (GTAO) */
    this.aoU = {m: {value: null}, px: {value: V2()}, pr: P, R: {value: 22}, kp: {value: 400}, far: {value: 900}};
    this.gtao = sh(this.aoU, IGN + `uniform sampler2D m;uniform vec2 px,pr;uniform float R,kp,far;varying vec2 v;vec3 pos(vec2 u){float d=textureLod(m,u,0.).r;return vec3((u*2.-1.)*pr*d,-d);}
void main(){float d=textureLod(m,v,0.).r;if(d>far){gl_FragColor=vec4(1.,d,0.,1.);return;}vec3 P=vec3((v*2.-1.)*pr*d,-d),r=pos(v+vec2(px.x,0.))-P,l=P-pos(v-vec2(px.x,0.)),u=pos(v+vec2(0.,px.y))-P,b=P-pos(v-vec2(0.,px.y)),N=normalize(cross(abs(r.z)<abs(l.z)?r:l,abs(u.z)<abs(b.z)?u:b)),V=normalize(-P);
float rad=R*(1.+d*.0025),rp=min(rad*kp/d,90.),n0=ign(gl_FragCoord.xy),n1=fract(n0*7.13+.37),vis=0.;if(rp<1.5){gl_FragColor=vec4(1.,d,0.,1.);return;}
for(int s=0;s<3;s++){float ph=(float(s)+n0)*1.0471975;vec2 dir=vec2(cos(ph),sin(ph));vec3 D=vec3(dir,0.),sn=normalize(cross(D,V)),T=cross(V,sn),pn=N-sn*dot(N,sn);float L=length(pn),cn=clamp(dot(pn,V)/max(L,1e-4),-1.,1.),n=sign(dot(pn,T))*acos(cn);
for(int k=0;k<2;k++){float sd=k==0?-1.:1.,hz=-1.;for(int j=0;j<5;j++){float t=(float(j)+n1)/5.;t=t*t;vec2 o=dir*sd*max(rp*t,float(j)+1.)*px;vec3 S=pos(v+o)-P;float q=length(S),hc=dot(S,V)/max(q,1e-4),f=clamp(1.-q*q/(rad*rad),0.,1.);hz=max(hz,mix(-1.,hc,f));}
float h=n+clamp(sd*acos(clamp(hz,-1.,1.))-n,-1.5707963,1.5707963);vis+=L*(cn+2.*h*sin(n)-cos(2.*h-n))*.25;}}
gl_FragColor=vec4(clamp(vis/3.,0.,1.),d,0.,1.);}`);
    this.bil = sh({m: {value: null}, p: {value: V2()}}, 'uniform sampler2D m;uniform vec2 p;varying vec2 v;void main(){vec2 c=texture2D(m,v).rg;float a=c.r,w=1.;for(int i=-3;i<=3;i++){if(i==0)continue;vec2 s=texture2D(m,v+p*float(i)).rg;float k=exp(-float(i*i)*.16)*max(0.,1.-abs(s.g-c.g)/(c.g*.02+.4));a+=s.r*k;w+=k;}gl_FragColor=vec4(a/w,c.g,0.,1.);}');
    /* luz dispersa en la niebla: integral exacta de cada luz a lo largo del rayo, más la bruma del aire */
    this.luces = Array.from({length: NL}, V4); this.lucesC = Array.from({length: NL}, V3); this.nU = {m: {value: null}, pr: P, L: {value: this.luces}, C: {value: this.lucesC}, n: {value: 0}, dn: {value: 1}};
    this.niebla = sh(this.nU, `#define NL ${NL}
uniform sampler2D m;uniform vec2 pr;uniform vec4 L[NL];uniform vec3 C[NL];uniform int n;uniform float dn;varying vec2 v;void main(){float d=min(texture2D(m,v).r,1500.);vec3 D=vec3((v*2.-1.)*pr,-1.);float k=length(D),t=d*k;D/=k;vec3 c=vec3(0.);for(int i=0;i<NL;i++){if(i>=n)break;vec3 p=L[i].xyz;float b=dot(D,p),h=sqrt(max(dot(p,p)-b*b,0.)+L[i].w);c+=C[i]*(atan((t-b)/h)+atan(b/h))/h;}gl_FragColor=vec4(c*dn,1.);}`);
    /* desenfoque de cámara: círculo de confusión a media resolución y recogida en espiral */
    const FO = LIN + 'uniform sampler2D z;uniform vec3 fo;float coc(float d){float q=lin(d);float k=fo.y*(q-fo.x)/q;k=sign(k)*max(0.,abs(k)-.55);return clamp(k,-fo.z,fo.z);}';
    this.pre = sh({m: {value: null}, p: {value: V2()}, ...Z}, FO + 'uniform sampler2D m;uniform vec2 p;varying vec2 v;void main(){vec3 c=vec3(0.);float w=0.,mi=99.,ma=-99.;for(int i=0;i<4;i++){vec2 q=v+p*vec2(i%2==0?-1.:1.,i<2?-1.:1.);float k=coc(texture2D(z,q).r);vec3 s=min(texture2D(m,q).rgb,vec3(24.));float g=1./(1.+max(s.r,max(s.g,s.b))*.35);c+=s*g;w+=g;mi=min(mi,k);ma=max(ma,k);}float kk=mi<-.6?mi:ma;gl_FragColor=vec4(c/w,kk);}');
    this.esp = sh({m: {value: null}, p: {value: V2()}, R: {value: 9}}, 'uniform sampler2D m;uniform vec2 p;uniform float R;varying vec2 v;void main(){vec4 c0=texture2D(m,v);float cs=abs(c0.a),tot=1.,ce=0.;vec3 c=c0.rgb;float a=0.;for(int i=1;i<=40;i++){float r=pow(float(i)/40.,.62)*R;a+=2.39996;vec4 s=texture2D(m,v+vec2(cos(a),sin(a))*r*p);float ss=abs(s.a);if(s.a>c0.a)ss=min(ss,cs*2.);float k=smoothstep(r-.9,r+.9,ss);c+=mix(c/tot,s.rgb,k);tot+=1.;ce+=k*step(s.a,-.5);}gl_FragColor=vec4(c/tot,clamp(ce/40.*2.6,0.,1.));}');
    /* exposición automática: se acerca poco a poco a la luminancia media de la imagen */
    this.exU = {m: {value: null}, a: {value: null}, k: {value: .05}}; this.expo = sh(this.exU, 'uniform sampler2D m,a;uniform float k;varying vec2 v;void main(){float s=0.,w=0.;for(int y=0;y<6;y++)for(int x=0;x<8;x++){vec2 q=(vec2(float(x),float(y))+.5)/vec2(8.,6.);vec3 c=texture2D(m,q).rgb;float g=exp(-dot(q-.5,q-.5)*5.);s+=g*log(dot(c,vec3(.2126,.7152,.0722))+.004);w+=g;}float n=s/w,o=texture2D(a,vec2(.5)).r;gl_FragColor=vec4(k>.99?n:mix(o,n,k),0.,0.,1.);}');
    const u = this.u = {bp: {value: V2()}, bo: {value: null}, dk: {value: 0}, ...Z, m: {value: null}, b: {value: null}, d: {value: null}, bk: {value: .06}, tilt: {value: 0}, foc: {value: .5}, t: {value: 0}, cut: {value: 0}, frio: {value: .5}, ao: {value: null}, ak: {value: 0}, ap: {value: V2()}, ni: {value: null}, nk: {value: 0}, np: {value: V2()}, ea: {value: null}, ev: {value: 1}, rs: {value: V2()}, ni2: {value: .35}, toneMappingExposure: {value: 1}};
    this.fin = sh(u, FO + `uniform sampler2D m,b,d,bo,ao,ni,ea;uniform vec2 bp,ap,np,rs;uniform float bk,tilt,foc,t,cut,frio,dk,ak,nk,ev,ni2;varying vec2 v;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float lu(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
/* nitidez que no marca halos (idea de CAS): se afila según el contraste de los vecinos */
vec3 nitida(vec2 q){vec2 p=1./rs;vec3 c=texture2D(m,q).rgb;if(ni2<.01)return c;vec3 a=texture2D(m,q+vec2(0.,p.y)).rgb,e=texture2D(m,q-vec2(0.,p.y)).rgb,f=texture2D(m,q+vec2(p.x,0.)).rgb,g=texture2D(m,q-vec2(p.x,0.)).rgb;float lc=lu(c)/(1.+lu(c)),la=lu(a)/(1.+lu(a)),le=lu(e)/(1.+lu(e)),lf=lu(f)/(1.+lu(f)),lg=lu(g)/(1.+lu(g));float mi=min(lc,min(min(la,le),min(lf,lg))),ma=max(lc,max(max(la,le),max(lf,lg)));float k=sqrt(clamp(min(mi,1.-ma)/max(ma,1e-3),0.,1.))*ni2*.2;return max((c-(a+e+f+g)*k)/(1.-4.*k),0.);}
/* media resolución subida sin cruzar bordes: pesa cada vecino por lo parecida que es su profundidad */
float oclusion(float dz){vec2 q=v/ap-.5,i=floor(q),f=q-i;float s=0.,w=0.;for(int k=0;k<4;k++){vec2 o=vec2(float(k%2),float(k/2)),c=texture2D(ao,(i+o+.5)*ap).rg;float g=(o.x>.5?f.x:1.-f.x)*(o.y>.5?f.y:1.-f.y)/(.002+abs(c.g-dz)/dz);s+=c.r*g;w+=g;}return s/max(w,1e-5);}
vec3 agx(vec3 c){const mat3 A=mat3(.842479062253094,.0423282422610123,.0423756549057051,.0784335999999992,.878468636469772,.0784336,.0792237451477643,.0791661274605434,.879142973793104);const mat3 B=mat3(1.19687900512017,-.0528968517574562,-.0529716355144438,-.0980208811401368,1.15190312990417,-.0980434501171241,-.0990297440797205,-.0989611768448433,1.15107367264116);c=A*max(c,1e-10);c=clamp((log2(c)+12.47393)/16.5,0.,1.);vec3 x2=c*c,x4=x2*x2;c=15.5*x4*x2-40.14*x4*c+31.96*x4-6.868*x2*c+.4298*x2+.1191*c-.00232;
/* toque de revelado: algo más de contraste y de color que el AgX base */
float l=lu(c);c=pow(max(c,0.),vec3(1.24));l=lu(c);c=l+1.16*(c-l);c=B*c;return clamp(c,0.,1.);}
void main(){vec2 q=v-.5;float r2=dot(q,q);vec3 c=nitida(v);
#ifdef ALTO
float zd=texture2D(z,v).r,dz=lin(zd);if(ak>.01){float a=oclusion(dz);a=mix(1.,a,ak*smoothstep(3.,.7,lu(c)));c*=a/(a*(1.-.35*clamp(c/(c+.5),0.,1.))+.35*clamp(c/(c+.5),0.,1.));c*=1.;}
if(dk>.5){vec2 o=bp;vec4 k=.25*(texture2D(bo,v+o)+texture2D(bo,v-o)+texture2D(bo,v+vec2(o.x,-o.y))+texture2D(bo,v+vec2(-o.x,o.y)));float kz=smoothstep(.15,1.3,abs(coc(zd)));c=mix(c,k.rgb,max(kz,k.a));}
float k=smoothstep(.16,.52,abs(v.y-foc))*tilt;if(k>.01)c=mix(c,texture2D(d,v).rgb,k);
#endif
if(nk>.001)c+=texture2D(ni,v).rgb*nk;
c=mix(c,texture2D(b,v).rgb,bk);
float eA=texture2D(ea,vec2(.5)).r;c*=ev*clamp(exp2((-1.95-eA*1.442)*.28),.62,1.5);
c*=mix(.62,1.,smoothstep(.75,.12,r2*1.25));float l=lu(c);c=mix(c,c*vec3(.93,.985,1.1),smoothstep(.16,0.,l)*frio);c*=1.-cut;
c=agx(c);c=pow(c,vec3(1.));c=mix(vec3(lu(c)),c,1.02);
float g=(h(v*977.+fract(t))+h(v*531.+fract(t*1.7))-1.);c+=g*.022*(1.-.6*lu(c));
gl_FragColor=vec4(c,1.);}`, {defines: alto ? {ALTO: 1} : {}});
  }
  /* w, h: lo que se ve en pantalla; la escena se dibuja a «esc» veces ese tamaño */
  size(w, h) {
    this.w = w; this.h = h; const W = Math.max(2, Math.round(w * this.esc)), H = Math.max(2, Math.round(h * this.esc)); this.rt.setSize(W, H); const s = (t, k) => t.setSize(Math.max(2, Math.round(W / k)), Math.max(2, Math.round(H / k))); s(this.half, 2); if (this.alto) {s(this.cocR, 2); s(this.boke, 2); s(this.dof, 4); s(this.dof2, 4); s(this.ln, 2); s(this.aoA, 2); s(this.aoB, 2)} s(this.nie, 4); this.b.forEach((t, i) => s(t, 4 << i));
  }
  msaa(n) {if (this.samples === n) return; this.samples = n; this.rt.dispose(); this.rt.samples = n}
  paso(mat, src, dst, uni) {mat.uniforms.m.value = src ? src.texture || src : null; if (uni) for (const k in uni) mat.uniforms[k].value = uni[k]; mesh.material = mat; this.r.setRenderTarget(dst); this.r.render(mesh, cam)}
  /* empieza a medir / recoge lo medido */
  mide(ini) {const t = this.tq; if (!t) return; const {gl, e} = t; if (ini) {if (t.cola.length > 4) {t.q = null; return} t.q = gl.createQuery(); gl.beginQuery(e.TIME_ELAPSED_EXT, t.q); return} if (t.q) {gl.endQuery(e.TIME_ELAPSED_EXT); t.cola.push(t.q); t.q = null} while (t.cola.length && gl.getQueryParameter(t.cola[0], gl.QUERY_RESULT_AVAILABLE)) {const q = t.cola.shift(); if (!gl.getParameter(e.GPU_DISJOINT_EXT)) {t.ms += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; t.n++} gl.deleteQuery(q)}}
  px(t, k = 1) {return new THREE.Vector2(k / t.width, k / t.height)}
  /* luces que se ven en la niebla: lista de {p: Vector3 (mundo), c: Color, r: radio del foco} */
  ponLuces(list, camera) {let n = 0; for (const q of list) {if (n >= NL) break; const L = this.luces[n]; const p = this._v || (this._v = V3()); p.copy(q.p).applyMatrix4(camera.matrixWorldInverse); if (p.z > 260) continue; L.set(p.x, p.y, p.z, q.r * q.r); this.lucesC[n].set(q.c.r, q.c.g, q.c.b); n++} this.nU.n.value = n}
  /* dibuja las escenas sobre el mismo búfer: solo la última lo resuelve, así el antialiasing se paga una vez */
  escenas(list, camera) {
    const r = this.r, rt = this.rt; r.setRenderTarget(rt); r.clear();
    list.forEach((s, i) => {this.abierto = i < list.length - 1; if (this.abierto && this.pinza.parent !== s) s.add(this.pinza); r.render(s, camera); rt.samples = this.samples; this.abierto = false});
  }
  render(list, camera) {
    this.mide(true); this.escenas(list, camera); const {rt, half, b, u} = this, Z = this.zu, R = 9 * rt.height / 900, E = camera.projectionMatrix.elements; u.rs.value.set(rt.width, rt.height); this.pr.value.set(1 / E[0], 1 / E[5]); Z.z.value = rt.depthTexture; Z.nf.value.set(camera.near, camera.far);
    const ao = this.alto && !this.sinAO, ni = !this.sinNiebla && this.nU.n.value > 0 && this.alto;
    if (this.alto) this.paso(this.lin, null, this.ln);
    if (ao) {this.aoU.px.value.copy(this.px(this.ln)); this.aoU.kp.value = E[5] * this.ln.height * .5; this.paso(this.gtao, this.ln, this.aoA); this.paso(this.bil, this.aoA, this.aoB, {p: new THREE.Vector2(1 / this.ln.width, 0)}); this.paso(this.bil, this.aoB, this.aoA, {p: new THREE.Vector2(0, 1 / this.ln.height)}); u.ao.value = this.aoA.texture; u.ap.value.copy(this.px(this.ln))} u.ak.value = ao ? this.aoK ?? 1 : 0;
    if (ni) {this.paso(this.niebla, this.ln, this.nie); u.ni.value = this.nie.texture} u.nk.value = ni ? 1 : 0;
    u.dk.value = this.alto && this.foco.a > .02 ? 1 : 0;
    if (u.dk.value) {Z.fo.value.set(this.foco.d, this.foco.a * 520 / Math.max(62, this.foco.d) * rt.height / 900, R); this.paso(this.pre, rt, this.cocR, {p: this.px(rt, .5)}); this.paso(this.esp, this.cocR, this.boke, {p: this.px(this.cocR), R}); u.bo.value = this.boke.texture; u.bp.value.copy(this.px(this.boke, .5))}
    this.paso(this.chica, rt, half, {p: this.px(rt, .5)});
    if (this.alto && u.tilt.value > .01) {this.paso(this.chica, half, this.dof, {p: this.px(half, .5)}); this.paso(this.gau, this.dof, this.dof2, {p: new THREE.Vector2(1 / this.dof.width, 0)}); this.paso(this.gau, this.dof2, this.dof, {p: new THREE.Vector2(0, 1 / this.dof.height)})}
    this.paso(this.down, half, b[0], {p: this.px(half), ka: 1}); for (let i = 1; i < b.length; i++) this.paso(this.down, b[i - 1], b[i], {p: this.px(b[i - 1]), ka: 0});
    // exposición
    {const a = this.ex[this.exi], c = this.ex[this.exi ^= 1]; this.exU.a.value = a.texture; this.exU.k.value = this.exN ? .035 : 1; this.exN = 1; this.paso(this.expo, b[3], c); u.ea.value = c.texture}
    this.r.autoClear = false; for (let i = b.length - 1; i > 0; i--) this.paso(this.up, b[i], b[i - 1], {p: this.px(b[i]), k: .86});
    u.b.value = b[0].texture; u.d.value = this.dof.texture; u.bk.value = Math.min(.14, this.bloom * .1) / 2.2; this.paso(this.fin, rt, null); this.mide(false);
  }
}
