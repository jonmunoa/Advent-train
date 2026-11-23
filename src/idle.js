/* Mi maqueta de Navidad · prototipo idle de Adviento Express.
   El tren da vueltas solo bajo el árbol: carga regalos en el taller y los reparte a las casas.
   Con las monedas de chocolate compras casas, vagones, máquina, luces y más vía.
   La economía y el trazado están en idle-eco.js. El motor, el salón, el árbol, la vía y el tren
   están copiados de main.js (juego de carreras) para no tocarlo mientras esto es un prototipo. */
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {atT, rng, wrapA} from './sim.js';
import {ECO, STAGES, TREE_R, HOUSE_OFF, SAVE_KEY, trackOf, slotsOf, newState, speedOf, capOf, valueOf, rateOf, ITEMS, maxed, canBuy, buy, offlineGain, parseSave} from './idle-eco.js';
clearTimeout(window.__boot);
THREE.Cache.enabled = true;

/* ================= utilidades ================= */
const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function hash2(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u),lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u),v)}
const fbm=(x,y)=>vnoise(x,y)*0.6+vnoise(x*2.1,y*2.1)*0.28+vnoise(x*4.3,y*4.3)*0.12;
const tick=()=>new Promise(r=>setTimeout(r,0));
const QS=new URLSearchParams(location.search),DEBUG=QS.has('debug'),FAST=QS.has('rapido')?10:1;
if(QS.has('reiniciar')){store.del(SAVE_KEY);store.del('advx-idle-silbato');QS.delete('reiniciar');try{history.replaceState(null,'',location.pathname+(QS.toString()?'?'+QS:''))}catch(e){}}
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const NF=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}),NF1=new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}),NF3=new Intl.NumberFormat('es-ES',{minimumSignificantDigits:3,maximumSignificantDigits:3});
const SUF=[[1e15,'mil B'],[1e12,'B'],[1e9,'mil M'],[1e6,'M']];
const fmtN=x=>{x=Math.floor(Math.max(0,x));for(const [v,s] of SUF)if(x>=v)return NF3.format(x/v)+' '+s;return NF.format(x)};
const fmtRate=r=>r<10?NF1.format(r):fmtN(r);
const fmtDur=s=>{if(s<90)return Math.round(s)+' s';if(s<3600)return Math.round(s/60)+' min';const h=Math.floor(s/3600),m=Math.round(s%3600/60);return h+' h'+(m?' '+m+' min':'')};
const kmh=st=>Math.round(speedOf(st)*3.6);

/* ================= estado ================= */
let st=parseSave(store.get(SAVE_KEY))||newState();
const away0=offlineGain(st);
let ready=false,busy=false,FASTSTEP=false;
let dist=2,vCur=0,boostT=0,boostCD=0,laps=0,delivered=0,starve=0,saveT=0;
let saveOff=false;// las pruebas lo activan para simular una ausencia sin que el guardado la pise
function save(){if(saveOff)return;st.t=Date.now();store.set(SAVE_KEY,JSON.stringify(st))}

/* ================= motor ================= */
const coarse=matchMedia('(pointer:coarse)').matches;
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false});
// sin dientes de sierra: MSAA ×4 también en el móvil (en GPUs de teselas es casi gratis) y nunca por debajo de 1× la resolución CSS
const MAXPR=Math.min(devicePixelRatio||1,2),MINPR=Math.min(1,MAXPR);let dynPR=Math.min(coarse?1.5:1.75,MAXPR);
renderer.setPixelRatio(dynPR);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#0b0809');scene.fog=new THREE.FogExp2('#120d0d',0.0008);
const camera=new THREE.PerspectiveCamera(42,1,0.5,5000);
{const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;void main(){vec3 c=mix(vec3(.16,.11,.09),vec3(.04,.04,.07),smoothstep(-.3,.6,vP.y));gl_FragColor=vec4(c,1.);}'})));
 [[-30,6,0,[9,4,1.4],7],[20,10,-20,[5,3.6,1.6],4],[0,30,0,[2.6,2,1.4],8],[18,4,26,[5,1,1.2],3],[-20,6,-25,[1,4,1.6],3],[30,12,14,[1.4,2,5],3],[10,25,-30,[1.4,2.2,3.6],6]].forEach(([x,y,z,c,r])=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(...c)}));m.position.set(x,y,z);es.add(m)});
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(es,0.03).texture;pm.dispose();scene.environmentIntensity=0.55}
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4}));
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),0.75,0.55,0.86);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},t:{value:0},tilt:{value:0},focus:{value:.52},asp:{value:1},flash:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float t,tilt,focus,asp,flash;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;
  if(tilt>0.001){float r=smoothstep(.16,.55,abs(vUv.y-focus))*tilt*.009;if(r>0.0004){vec3 a=c.rgb;for(int i=1;i<10;i++){float an=float(i)*2.39996;float rr=sqrt(float(i))/3.;a+=texture2D(tDiffuse,vUv+vec2(cos(an)/asp,sin(an))*rr*r).rgb;}c.rgb=a/10.;}}
  float v=smoothstep(.95,.3,length(d*vec2(1.15,1.)));c.rgb*=mix(.5,1.,v);
  float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(c.rgb,c.rgb*vec3(.92,.96,1.12),smoothstep(.3,0.,l)*.5);c.rgb=mix(c.rgb,c.rgb*vec3(1.1,1.,.86),smoothstep(.4,1.5,l)*.5);
  c.rgb=mix(vec3(l),c.rgb,1.14);c.rgb+=flash*vec3(1.,.9,.7);c.rgb+=(h(vUv*977.+fract(t))-.5)*.012;gl_FragColor=c;}`});
composer.addPass(bloom);composer.addPass(grade);composer.addPass(new OutputPass());
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(dynPR);composer.setPixelRatio(dynPR);renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();grade.uniforms.asp.value=w/h}
addEventListener('resize',resize);resize();
const dbg=DEBUG?Object.assign(document.body.appendChild(document.createElement('div')),{id:'dbg'}):null;
if(dbg)renderer.info.autoReset=false;
let dbgN=0,dbgT=0;
function dbgFrame(raw){if(!dbg)return;dbgN++;dbgT+=raw;if(dbgT<0.5)return;const i=renderer.info.render;dbg.textContent=`${Math.round(dbgN/dbgT)} fps · ${(dbgT/dbgN*1000).toFixed(1)} ms · pr ${dynPR.toFixed(2)} · ${i.calls} dc · ${(i.triangles/1000).toFixed(0)}k tri`;dbgN=0;dbgT=0}

/* ================= texturas ================= */
const texCache={};
function canvasTex(w,h,draw,key,srgb=true){if(key&&texCache[key])return texCache[key];const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;if(key)texCache[key]=t;return t}
function pixTex(size,fn,key,srgb=true){return canvasTex(size,size,(g,w,h)=>{const id=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4,c=fn(x,y);id.data[o]=c[0];id.data[o+1]=c[1];id.data[o+2]=c[2];id.data[o+3]=c[3]===undefined?255:c[3]}g.putImageData(id,0,0)},key,srgb)}
const rep=(t,a,b)=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(a,b);return t};
const dotTex=canvasTex(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.4,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)},'dot');
const woodTex=rep(pixTex(128,(x,y)=>{const g=Math.sin(x*0.25+vnoise(x*0.05,y*0.4)*6)*0.5+0.5,v=70+g*40;return [v*1.2,v*.85,v*.6]},'wood'),1,1);
const plankTex=rep(pixTex(256,(x,y)=>{const row=Math.floor(y/22),e=y%22<2?0.55:1,g=0.85+0.15*Math.sin(x*0.08+row*3+vnoise(x*0.03,row)*5),k=(0.9+hash2(row,7)*0.15)*e*g*255;return [k,k*.97,k*.93]},'plank'),1,1);
const wallTex=rep(canvasTex(256,256,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=3;for(const [cx,cy] of [[64,64],[192,192]]){g.beginPath();g.ellipse(cx,cy,22,40,0,0,7);g.stroke();g.beginPath();g.moveTo(cx,cy-52);g.lineTo(cx,cy+52);g.moveTo(cx-34,cy);g.lineTo(cx+34,cy);g.stroke()}g.fillStyle='rgba(0,0,0,.1)';g.fillRect(126,0,4,h)},'wall'),48,5);
const snowNrm=(()=>{const S=256,hh=new Float32Array(S*S);for(let y=0;y<S;y++)for(let x=0;x<S;x++){const f=(a,b,c)=>vnoise(a/c,b/c);hh[y*S+x]=f(x,y,24)*.6+f(x,y,9)*.3+f(x,y,3)*.1}
  const t=pixTex(S,(x,y)=>{const H=(a,b)=>hh[((b+S)%S)*S+((a+S)%S)];const dx=(H(x+1,y)-H(x-1,y))*6,dy=(H(x,y+1)-H(x,y-1))*6,l=Math.hypot(dx,dy,1);return [(-dx/l*.5+.5)*255,(-dy/l*.5+.5)*255,(1/l*.5+.5)*255]},'snownrm',false);return rep(t,60,60)})();
const winTex=canvasTex(64,80,(g,w,h)=>{const r=g.createRadialGradient(w/2,h*.55,4,w/2,h*.55,w*.8);r.addColorStop(0,'#ffe9b0');r.addColorStop(1,'#d9822b');g.fillStyle=r;g.fillRect(0,0,w,h);g.fillStyle='#b8452a';g.fillRect(0,0,14,h);g.fillRect(w-14,0,14,h);g.fillStyle='#3a2216';g.fillRect(w/2-3,0,6,h);g.fillRect(0,h/2-3,w,6);g.strokeStyle='#3a2216';g.lineWidth=8;g.strokeRect(0,0,w,h)},'win');
const branchTex=canvasTex(512,256,(g,w,h)=>{const r=rng(5);const cy=h/2;
  const needle=(px,py,a,L)=>{g.strokeStyle=`hsl(${125+r()*26},${34+r()*25}%,${17+r()*22}%)`;g.lineWidth=2.4;g.beginPath();g.moveTo(px,py);g.lineTo(px+Math.cos(a)*L,py+Math.sin(a)*L);g.stroke()};
  for(let i=0;i<13;i++){const x0=8+i*36,len=(1-x0/w)*120+24;for(const sd of[-1,1]){const x1=x0+len*0.7,y1=cy+sd*len*0.62;
      g.strokeStyle='#3a2a1c';g.lineWidth=2.4;g.beginPath();g.moveTo(x0,cy);g.lineTo(x1,y1);g.stroke();
      const ang=Math.atan2(y1-cy,x1-x0);for(let k=0;k<34;k++){const t=k/34,px=lerp(x0,x1,t),py=lerp(cy,y1,t);for(const q of[-1,1])needle(px,py,ang+q*(0.75+r()*0.35),(13+r()*9)*(1-t*0.45))}}}
  g.strokeStyle='#3a2a1c';g.lineWidth=5;g.beginPath();g.moveTo(0,cy);g.lineTo(w-10,cy);g.stroke();
  for(let k=0;k<120;k++){const x=k/120*(w-20);for(const q of[-1,1])needle(x,cy,q*(0.9+r()*0.4),12+r()*8)}
},'branch');
function signTex(text,sub){return canvasTex(512,128,(g,w,h)=>{g.fillStyle='#7a1020';g.fillRect(0,0,w,h);g.strokeStyle='#e0ad45';g.lineWidth=10;g.strokeRect(5,5,w-10,h-10);g.fillStyle='#fbf3df';g.textAlign='center';g.textBaseline='middle';g.font='700 52px Georgia, serif';g.fillText(text,w/2,sub?52:h/2+2);if(sub){g.font='500 26px Georgia, serif';g.fillStyle='#e0ad45';g.fillText(sub,w/2,98)}})}
const caneTex=rep(canvasTex(128,32,(g,w,h)=>{g.fillStyle='#fbf6ee';g.fillRect(0,0,w,h);g.fillStyle='#d0162a';for(let x=-h;x<w+h;x+=32){g.beginPath();g.moveTo(x,h);g.lineTo(x+14,h);g.lineTo(x+14+h,0);g.lineTo(x+h,0);g.closePath();g.fill()}},'cane'),10,1);
const WRAPS=[['#b3162a','#f6e7c8','dots'],['#1c6b45','#e8c35a','stars'],['#f3efe6','#c4192d','stripes'],['#c8962d','#8a1422','diamonds'],['#1d3a78','#e9f0fb','flakes'],['#6e1a5a','#f0c75a','dots']].map(([bg,fg,kind],i)=>rep(canvasTex(256,256,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.strokeStyle=fg;
  if(kind==='dots'){for(let y=0;y<4;y++)for(let x=0;x<4;x++){g.beginPath();g.arc(32+x*64+(y%2)*32,32+y*64,12,0,7);g.fill()}}
  if(kind==='stripes'){for(let x=-256;x<256;x+=48){g.beginPath();g.moveTo(x,256);g.lineTo(x+22,256);g.lineTo(x+278,0);g.lineTo(x+256,0);g.fill()}}
  if(kind==='diamonds'){for(let y=0;y<4;y++)for(let x=0;x<4;x++){const cx=32+x*64,cy=32+y*64;g.beginPath();g.moveTo(cx,cy-20);g.lineTo(cx+14,cy);g.lineTo(cx,cy+20);g.lineTo(cx-14,cy);g.fill()}}
  if(kind==='stars'||kind==='flakes'){g.lineWidth=4;for(let y=0;y<3;y++)for(let x=0;x<3;x++){const cx=42+x*86+(y%2)*40,cy=42+y*86;g.beginPath();for(let k=0;k<(kind==='stars'?10:6);k++){if(kind==='stars'){const rr=k%2?8:20,a=-Math.PI/2+k*Math.PI/5;k?g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):g.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}else{const a=k*Math.PI/3;g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*20,cy+Math.sin(a)*20)}}kind==='stars'?g.fill():g.stroke()}}
},'wrap'+i),2,2));
const nightTex=canvasTex(256,320,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'#071230');r.addColorStop(.7,'#1d3770');r.addColorStop(1,'#cfdaf0');g.fillStyle=r;g.fillRect(0,0,w,h);const q=rng(4);for(let i=0;i<90;i++){g.fillStyle=`rgba(255,255,255,${q()})`;g.fillRect(q()*w,q()*h*.6,1.5,1.5)}g.fillStyle='#fff8dc';g.beginPath();g.arc(190,70,18,0,7);g.fill();
  g.fillStyle='#0d1a33';for(let i=0;i<8;i++){const x=i*36+q()*10,hh=40+q()*40;g.beginPath();g.moveTo(x,h-30);g.lineTo(x+14,h-30-hh);g.lineTo(x+28,h-30);g.fill()}g.fillStyle='#e9eef9';g.fillRect(0,h-32,w,32);
  g.fillStyle='#3a2216';g.fillRect(w/2-5,0,10,h);g.fillRect(0,h/2-5,w,10);g.lineWidth=16;g.strokeStyle='#efe6d6';g.strokeRect(0,0,w,h)},'night');
const TL=new THREE.TextureLoader();
const coneTex=canvasTex(8,64,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h)},'cone');
const phCache={};
function phTex(name,rx,ry=rx,srgb=false){const k=name+rx+'x'+ry;if(phCache[k])return phCache[k];const t=TL.load('m/ph/'+name+'.webp');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return phCache[k]=t}
const snowN=phTex('snow_02_nor',34),snowR=phTex('snow_02_rough',34);
const blobTex=canvasTex(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(0,0,0,.75)');r.addColorStop(.55,'rgba(0,0,0,.35)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64)},'blob');
const puffTex=canvasTex(128,128,(g)=>{const q=rng(8);for(let i=0;i<26;i++){const x=64+(q()-.5)*60,y=64+(q()-.5)*60,rr=14+q()*26,r=g.createRadialGradient(x,y,0,x,y,rr);r.addColorStop(0,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128)}},'puff');
let envReady=null;
function loadEnv(){if(envReady)return envReady;envReady=(async()=>{try{const t=await new EXRLoader().loadAsync('m/env/fireplace_1k.exr');t.mapping=THREE.EquirectangularReflectionMapping;
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(t).texture;pm.dispose();t.dispose();scene.environmentIntensity=0.5;scene.environmentRotation.y=0.8}catch(e){console.warn('env',e)}})();return envReady}

/* luces */
const hemi=new THREE.HemisphereLight(0x8aa0d8,0x3a2418,0.42);scene.add(hemi);
const key=new THREE.DirectionalLight(0xbcd0ff,1.25);key.castShadow=true;
key.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048);key.shadow.bias=-0.0006;key.shadow.normalBias=0.06;
scene.add(key,key.target);
const fireL=new THREE.PointLight(0xff7a2e,2.2,0,0);
const warmFill=new THREE.DirectionalLight(0xffa060,0.42);scene.add(warmFill,warmFill.target);

/* purpurina (nieve artificial) alrededor de la cámara */
const SN=coarse?450:900,snowP=new Float32Array(SN*3),snowS=new Float32Array(SN);{const r=rng(4);for(let i=0;i<SN;i++){snowP[i*3]=(r()-.5)*160;snowP[i*3+1]=r()*70;snowP[i*3+2]=(r()-.5)*160;snowS[i]=0.5+r()*0.8}}
const snowG=new THREE.BufferGeometry();snowG.setAttribute('position',new THREE.BufferAttribute(snowP,3));snowG.setAttribute('sz',new THREE.BufferAttribute(snowS,1));
const flakeTex=canvasTex(64,64,(g,w,h)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,255,255,.9)');r.addColorStop(.6,'rgba(255,255,255,.25)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=2.2;for(let k=0;k<6;k++){const a=k*Math.PI/3;g.beginPath();g.moveTo(32,32);g.lineTo(32+Math.cos(a)*26,32+Math.sin(a)*26);g.stroke()}},'flake');
const snowU={map:{value:flakeTex},px:{value:1},t:{value:0}};
const snow=new THREE.Points(snowG,new THREE.ShaderMaterial({uniforms:snowU,transparent:true,depthWrite:false,
  vertexShader:'uniform float px,t;attribute float sz;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float d=-mv.z;gl_PointSize=clamp(sz*px*80./d,1.,4.*px);vA=smoothstep(4.,12.,d)*smoothstep(130.,60.,d)*.85;gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform sampler2D map;varying float vA;void main(){float a=texture2D(map,gl_PointCoord).a*vA;if(a<.02)discard;gl_FragColor=vec4(vec3(.96,.98,1.),a);}'}));snow.frustumCulled=false;scene.add(snow);

/* ================= materiales ================= */
const M={
  roadbed:new THREE.MeshStandardMaterial({color:0x5d616b,roughness:.5,side:THREE.DoubleSide}),
  rail:new THREE.MeshStandardMaterial({color:0xe9eef5,metalness:1,roughness:.28,side:THREE.DoubleSide}),// menos brillo puntual: los raíles finos parpadeaban
  sleeper:new THREE.MeshStandardMaterial({color:0x3a2a20,map:woodTex,roughness:.7}),
  snow:new THREE.MeshStandardMaterial({color:0xf3f7ff,roughness:.7,normalMap:snowNrm,normalScale:new THREE.Vector2(.4,.4)}),
  trunk:new THREE.MeshStandardMaterial({color:0x4a3020,map:woodTex,roughness:.95}),
  dark:new THREE.MeshPhysicalMaterial({color:0x1d1e25,roughness:.38,metalness:.55,clearcoat:.6,clearcoatRoughness:.2}),
  gold:new THREE.MeshPhysicalMaterial({color:0xf2bd45,roughness:.18,metalness:1,clearcoat:.5}),
  red:new THREE.MeshPhysicalMaterial({color:0xc8182c,roughness:.32,metalness:.1,clearcoat:1,clearcoatRoughness:.08}),
  green:new THREE.MeshPhysicalMaterial({color:0x16704c,roughness:.32,clearcoat:1,clearcoatRoughness:.08}),
  lamp:new THREE.MeshBasicMaterial({color:new THREE.Color(3,2.2,1.2)}),
  win:new THREE.MeshBasicMaterial({map:winTex,color:new THREE.Color(1.9,1.6,1.2)}),
  conc:new THREE.MeshStandardMaterial({color:0xcfc6b6,roughness:.9}),
  wood:new THREE.MeshStandardMaterial({color:0x8a5032,map:plankTex,roughness:.85}),
  roofEdge:new THREE.MeshStandardMaterial({color:0x5a1b16,roughness:.7}),
  icicle:new THREE.MeshStandardMaterial({color:0xdff3ff,roughness:.05,metalness:.3,emissive:0x1b2b44}),
  branch:new THREE.MeshStandardMaterial({map:branchTex,alphaTest:.42,side:THREE.DoubleSide,roughness:.85,alphaToCoverage:true}),
  core:new THREE.MeshStandardMaterial({color:0x0e2b1c,roughness:1}),
  door:new THREE.MeshStandardMaterial({color:0x4a2a1a,map:plankTex,roughness:.8}),
  cane:new THREE.MeshStandardMaterial({map:caneTex,roughness:.3}),
  felt:new THREE.MeshStandardMaterial({color:0xa3141f,normalMap:phTex('quatrefoil_jacquard_fabric_nor',5),roughness:1}),
  fur:new THREE.MeshStandardMaterial({color:0xf6f3ee,roughness:1,normalMap:snowNrm,normalScale:new THREE.Vector2(1,1)}),
};
const HCOL=[0xb4473a,0x4a6f9e,0xc89a54,0x7d4f72,0x4f7d62,0xd8cbb4],HMAT=HCOL.map(c=>new THREE.MeshStandardMaterial({color:c,map:plankTex,roughness:.6}));
const box=(w,h,d,m,x=0,y=0,z=0,par)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;if(par)par.add(o);return o};
const cyl=(rt,rb,h,m,seg=16)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),m);o.castShadow=true;return o};
const o3=new THREE.Object3D(),tmpV=new THREE.Vector3(),tmpV2=new THREE.Vector3();

/* ================= modelos 3D (Kenney, CC0) ================= */
const MD={};const toyCache=new Map();
function toyMat(m,phys){const k=(m.map?m.map.uuid:'c'+m.color.getHex())+(phys?'p':'');if(!toyCache.has(k)){if(m.map)m.map.anisotropy=4;const o={map:m.map||null,color:m.map?0xffffff:m.color,roughness:phys?.36:.5,metalness:0,side:THREE.FrontSide};toyCache.set(k,phys?new THREE.MeshPhysicalMaterial({...o,clearcoat:.7,clearcoatRoughness:.14}):new THREE.MeshStandardMaterial(o))}return toyCache.get(k)}
const MODELS={loco:'train/train-locomotive-b.glb',flat:'train/train-carriage-flatbed.glb',treeA:'holiday/tree-snow-a.glb',treeB:'holiday/tree-snow-b.glb',treeC:'holiday/tree-snow-c.glb',treeD:'holiday/tree-decorated-snow.glb',deer:'holiday/reindeer.glb',snowman:'holiday/snowman-hat.glb',nut:'holiday/nutcracker.glb',ginger:'holiday/gingerbread-man.glb',ginger2:'holiday/gingerbread-woman.glb',lantern:'holiday/lantern.glb',presA:'holiday/present-a-cube.glb',presB:'holiday/present-b-round.glb',presC:'holiday/present-a-rectangle.glb',presD:'holiday/present-b-cube.glb',caneR:'holiday/candy-cane-red.glb',caneG:'holiday/candy-cane-green.glb',sled:'holiday/sled.glb',bench:'holiday/bench.glb',flakeA:'holiday/snowflake-a.glb',flakeB:'holiday/snowflake-b.glb',rocks:'holiday/rocks-medium.glb',pile:'holiday/snow-pile.glb',sock:'holiday/sock-red-cane.glb',sock2:'holiday/sock-green-cane.glb',wreath:'holiday/wreath-decorated.glb'};
async function loadModels(onp){const L=new GLTFLoader(),keys=Object.keys(MODELS);let n=0;
  await Promise.all(keys.map(async k=>{const g=await L.loadAsync('m/'+MODELS[k]),sc=g.scene,toy=MODELS[k].startsWith('train/');
    sc.traverse(o=>{if(o.isMesh){o.material=toyMat(o.material,toy);o.castShadow=true;o.receiveShadow=true}});sc.updateMatrixWorld(true);MD[k]={scene:sc,box:new THREE.Box3().setFromObject(sc)};n++;onp&&onp(n/keys.length)}))}
function flat(k){const D=MD[k];if(D.flat)return D.flat;const gs=[];let mat=null;D.scene.traverse(o=>{if(o.isMesh){let g=o.geometry.clone();for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);if(g.index)g=g.toNonIndexed();g.applyMatrix4(o.matrixWorld);gs.push(g);mat=mat||o.material}});
  const geo=mergeGeometries(gs,false),b=D.box;geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);return D.flat={geo,mat,h:b.max.y-b.min.y,w:Math.max(b.max.x-b.min.x,b.max.z-b.min.z)}}
function inst(k,list,shadow,par){if(!list.length)return null;const f=flat(k),m=new THREE.InstancedMesh(f.geo,f.mat,list.length);list.forEach((t,i)=>{o3.position.set(t.x,t.y||0,t.z);o3.rotation.set(0,t.r||0,0);o3.scale.setScalar(t.h/f.h);o3.updateMatrix();m.setMatrixAt(i,o3.matrix)});m.castShadow=shadow;m.receiveShadow=true;par.add(m);return m}
function obj(k,h){const f=flat(k),m=new THREE.Mesh(f.geo,f.mat);m.scale.setScalar(h/f.h);m.castShadow=true;m.receiveShadow=true;return m}
/* une mallas por material (menos draw calls); las mallas deben tener matrixWorld al día */
function mergeMeshes(list){const groups=new Map();
  for(const o of list){let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);
    if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    g.clearGroups();g.applyMatrix4(o.matrixWorld);const k=o.material.uuid+(o.castShadow?'s':'');if(!groups.has(k))groups.set(k,{m:o.material,c:o.castShadow,gs:[]});groups.get(k).gs.push(g)}
  const out=[];groups.forEach(v=>{const mg=mergeGeometries(v.gs,false);v.gs.forEach(g=>g.dispose());if(!mg)return;const m=new THREE.Mesh(mg,v.m);m.castShadow=v.c;m.receiveShadow=true;out.push(m)});return out}
const branchGeo=(()=>{const g=new THREE.PlaneGeometry(1,0.78);g.rotateX(-Math.PI/2);g.translate(0.5,0,0);const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0);return g})();
function disposeObj(root){const keepM=new Set([...Object.values(M),...toyCache.values(),...HMAT]),keepT=new Set([...Object.values(texCache),...Object.values(phCache)]),
  shared=g=>g===branchGeo||Object.values(MD).some(d=>d.flat&&d.flat.geo===g);
  root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&!shared(o.geometry))o.geometry.dispose();
    if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(keepM.has(m))return;if(m.map&&!keepT.has(m.map))m.map.dispose();m.dispose()})})}

/* ================= tren ================= */
const train=new THREE.Group();scene.add(train);
const cars=[];let OFFS=[0],GAUGE=1.24,spot=null,beam=null;const RAILY=0.72;
const GP=[[-2.1,0],[0,0],[2.1,0],[-1.05,1.15],[1.05,1.15]];// regalos sobre cada vagón: tres abajo y dos encima
function carFrom(k,len){const D=MD[k],sc=D.scene.clone(true),b=D.box,s=len/(b.max.z-b.min.z);sc.scale.setScalar(s);sc.position.set(-(b.min.x+b.max.x)/2*s,-b.min.y*s+RAILY-0.05,-(b.min.z+b.max.z)/2*s);
  const inner=new THREE.Group();inner.add(sc);inner.rotation.y=Math.PI/2;const holder=new THREE.Group();holder.add(inner);const wheels=[];sc.traverse(o=>{if(/wheel/i.test(o.name||'')&&!(o.parent&&/wheel/i.test(o.parent.name||''))&&o.position.y>0.15)wheels.push(o)});
  holder.userData={wheels,len,top:(b.max.y-b.min.y)*s+RAILY,s,wr:0.3*s};return holder}
/* vagones y regalos de los vagones: mallas instanciadas (un draw call por tipo, no uno por pieza) */
const GTY=['presA','presB','presD','presC'],WAGM=new THREE.Matrix4();let wagIM=null,giftIM=[],WTOP=2;
function trainInstInit(){const f=flat('flat'),b=MD.flat.box,s=6.6/(b.max.z-b.min.z);WTOP=(b.max.y-b.min.y)*s+RAILY;
  WAGM.makeRotationY(Math.PI/2).multiply(new THREE.Matrix4().makeTranslation(0,RAILY-0.05,0)).multiply(new THREE.Matrix4().makeScale(s,s,s));
  wagIM=new THREE.InstancedMesh(f.geo,f.mat,ECO.wagonMax);wagIM.count=0;
  giftIM=GTY.map(k=>{const g=flat(k),m=new THREE.InstancedMesh(g.geo,g.mat,ECO.wagonMax*ECO.cap);m.userData.h=g.h;return m});
  [wagIM,...giftIM].forEach(m=>{m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m)})}
const _m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),UPV=new THREE.Vector3(0,1,0),ZERO=new THREE.Matrix4().makeScale(0,0,0);
function trainInst(){if(!wagIM)return;const cnt=[0,0,0,0];wagIM.count=cars.length-1;
  for(let i=1;i<cars.length;i++){const W=cars[i];_m.multiplyMatrices(W.matrixWorld,WAGM);wagIM.setMatrixAt(i-1,_m);
    for(const g of W.userData.gv){const IM=giftIM[g.type],k=cnt[g.type]++;if(!g.vis){IM.setMatrixAt(k,ZERO);continue}_p.set(g.x,g.y,g.z);_q.setFromAxisAngle(UPV,g.rot);const sc=g.sc*1.2/IM.userData.h;_s.set(sc,sc,sc);_m2.compose(_p,_q,_s);_m.multiplyMatrices(W.matrixWorld,_m2);IM.setMatrixAt(k,_m)}}
  wagIM.instanceMatrix.needsUpdate=true;giftIM.forEach((IM,t)=>{IM.count=cnt[t];IM.instanceMatrix.needsUpdate=true})}
function makeWagon(i){const W=new THREE.Group();W.userData={len:6.6,top:WTOP,c:0,gv:GP.map(([x,y],j)=>({x,y:WTOP-0.22+y,z:j%2?.15:-.15,rot:(i*3+j)*0.9,type:(i+j)%GTY.length,vis:false,sc:1}))};return W}
function layoutTrain(){OFFS=[0];for(let i=1;i<cars.length;i++)OFFS.push(OFFS[i-1]-(cars[i-1].userData.len/2+cars[i].userData.len/2+0.8))}
function buildTrain(n){train.clear();cars.length=0;if(!wagIM)trainInstInit();
  const L=carFrom('loco',7.6);cars.push(L);train.add(L);
  let wx=0.425;MD.loco.scene.traverse(o=>{if(o.name==='wheel')wx=Math.abs(o.position.x)});GAUGE=wx*L.userData.s;
  for(let i=1;i<=n;i++){const W=makeWagon(i);cars.push(W);train.add(W)}layoutTrain();
  const top=L.userData.top,len=L.userData.len;
  const lampM=new THREE.Mesh(new THREE.SphereGeometry(0.34,14,10),M.lamp);lampM.position.set(len*0.5+0.05,top*0.58,0);L.add(lampM);
  spot=new THREE.SpotLight(0xffe2a8,240,95,0.45,0.55,1.25);
  {const cg=new THREE.ConeGeometry(4.2,24,24,1,true);cg.translate(0,-12,0);cg.rotateZ(Math.PI/2);beam=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({map:coneTex,color:new THREE.Color(.2,.16,.09),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false}));beam.position.set(len*0.5+0.2,top*0.58,0);L.add(beam)}spot.position.set(len*0.5,top*0.58,0);const tg=new THREE.Object3D();tg.position.set(30,0,0);L.add(spot,tg);spot.target=tg;
  L.userData.chimney=new THREE.Vector3(len*0.3,top+0.2,0);
}
function addWagon(){const W=makeWagon(cars.length);cars.push(W);train.add(W);layoutTrain();W.userData.pop=0;W.scale.setScalar(0.6);fillWagon(W,true);poseTrain(dist)}
function fillWagon(W,anim,delay=0){const c0=W.userData.c;W.userData.c=ECO.cap;for(let j=c0;j<ECO.cap;j++){const g=W.userData.gv[j];if(anim&&!FASTSTEP){g.vis=false;giftQ.push({g,t:-(delay+(j-c0)*0.035)})}else{g.vis=true;g.sc=1}}}
function poseCar(c,s,TT){const p=atT(TT,s),q=atT(TT,s+2),b=atT(TT,s-2),yaw=Math.atan2(q.z-b.z,q.x-b.x);c.position.set(p.x,0,p.z);c.rotation.set(0,-yaw,0,'YXZ')}
function poseTrain(d){if(!T)return;cars.forEach((c,i)=>poseCar(c,d+OFFS[i],T));train.updateMatrixWorld(true)}
function spinWheels(ds){const c=cars[0];if(c)c.userData.wheels.forEach(w=>{w.rotation.x+=ds/Math.max(0.6,c.userData.wr)})}

/* humo, chispas, fuegos y confeti */
const smoke=[];for(let i=0;i<48;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:puffTex,color:0xeef1f6,transparent:true,opacity:0,depthWrite:false}));s.visible=false;scene.add(s);smoke.push({s,life:0,v:new THREE.Vector3(),sz:1,op:.26})}
let smokeI=0,smokeAcc=0;
function puff(p,v,sz,op,life){const q=smoke[smokeI=(smokeI+1)%smoke.length];q.life=1;q.ml=life||1.7;q.s.visible=true;q.s.position.copy(p);q.v.copy(v);q.sz=sz;q.op=op}
const SPK=100,spkP=new Float32Array(SPK*3),spk=Array.from({length:SPK},()=>({life:0,v:new THREE.Vector3()}));
const spkG=new THREE.BufferGeometry();spkG.setAttribute('position',new THREE.BufferAttribute(spkP,3));
const sparks=new THREE.Points(spkG,new THREE.PointsMaterial({map:dotTex,size:0.35,color:new THREE.Color(3,1.6,.5),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sparks.frustumCulled=false;scene.add(sparks);
let spkI=0;function spark(p,n,pow){for(let k=0;k<n;k++){const s=spk[spkI=(spkI+1)%SPK];s.life=0.4+Math.random()*0.4;s.v.set((Math.random()-.5)*pow,Math.random()*pow*0.8,(Math.random()-.5)*pow);spkP.set([p.x,p.y,p.z],spkI*3)}}
const FWN=1000,fwP=new Float32Array(FWN*3),fwC=new Float32Array(FWN*3),fw=Array.from({length:FWN},()=>({l:0,v:new THREE.Vector3()}));
const fwG=new THREE.BufferGeometry();fwG.setAttribute('position',new THREE.BufferAttribute(fwP,3));fwG.setAttribute('color',new THREE.BufferAttribute(fwC,3));
const fireworks=new THREE.Points(fwG,new THREE.PointsMaterial({map:dotTex,size:1.6,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));fireworks.frustumCulled=false;scene.add(fireworks);
for(let i=0;i<FWN;i++)fwP[i*3+1]=-999;let fwI=0;const fwQ=[];
function burst(c,n=150,sp0=14,col){col=col||[[4,1,1.2],[4,3,.8],[1,2.4,4],[1.2,4,1.6],[4,1.4,3.4]][Math.floor(Math.random()*5)];
  for(let k=0;k<n;k++){const p=fw[fwI=(fwI+1)%FWN];p.l=1.2+Math.random()*0.6;const u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=Math.sqrt(1-u*u),sp=sp0*(0.8+Math.random()*0.3);p.v.set(r*Math.cos(a)*sp,u*sp,r*Math.sin(a)*sp);fwP.set([c.x,c.y,c.z],fwI*3);fwC.set(col,fwI*3)}}
const CFN=500,cfP=new Float32Array(CFN*3),cfC=new Float32Array(CFN*3),cf=Array.from({length:CFN},()=>({l:0,v:new THREE.Vector3(),ph:0}));
const cfG=new THREE.BufferGeometry();cfG.setAttribute('position',new THREE.BufferAttribute(cfP,3));cfG.setAttribute('color',new THREE.BufferAttribute(cfC,3));
const confetti=new THREE.Points(cfG,new THREE.PointsMaterial({size:0.9,vertexColors:true}));confetti.frustumCulled=false;scene.add(confetti);for(let i=0;i<CFN;i++)cfP[i*3+1]=-999;
function confettiBurst(c,spread=16){const pal=[[1,.15,.2],[1,.8,.2],[.2,.8,.4],[.3,.6,1],[1,1,1]];for(let i=0;i<CFN;i++){const p=cf[i];p.l=3+Math.random()*2;p.ph=Math.random()*6;p.v.set((Math.random()-.5)*spread,10+Math.random()*12,(Math.random()-.5)*spread);cfP.set([c.x+(Math.random()-.5)*4,c.y,c.z+(Math.random()-.5)*4],i*3);cfC.set(pal[i%5],i*3)}cfG.attributes.color.needsUpdate=true}

/* ================= salón (fijo) ================= */
const room=new THREE.Group();scene.add(room);
let fireU=null,garland=null;
const PQ=7,ROOM_M=280;
const GL=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),loadGLB=url=>GL.loadAsync(url);
const FURN=[['Sofa_01',2.35,880,0],['ArmChair_01',1.42,860,0.35],['ClassicNightstand_01',2.9,975,0],['vintage_oil_lamp',2.9,975,0.6,0.7],['potted_plant_02',-1.72,960,0.5],['potted_plant_04',-2.12,1072,0,0.402]];
function buildFurniture(){return (async()=>{
  {const rr=(w,h,r)=>{const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return new THREE.ShapeGeometry(s,4).rotateX(-Math.PI/2)};
   const a=2.25,g=new THREE.Group(),fm=new THREE.MeshStandardMaterial({color:0xffffff,map:phTex('fabric_pattern_07_diff',1/220,1/220,true),normalMap:phTex('fabric_pattern_07_nor',1/220),roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
   const top=new THREE.Mesh(rr(800,500,40),fm);top.position.y=0.8;const rim=new THREE.Mesh(rr(840,540,52),new THREE.MeshStandardMaterial({color:0x2a6a48,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
   g.add(rim,top);g.position.set(Math.cos(a)*620,0,Math.sin(a)*620);g.rotation.y=-a+Math.PI/2;g.traverse(o=>{if(o.isMesh)o.receiveShadow=true});room.add(g)}
  const lampFor={};
  await Promise.all(FURN.map(async([k,a,r,yaw,y=0])=>{try{const gl=await loadGLB('m/ph/'+k+'.glb'),o=gl.scene;
    o.traverse(c=>{if(c.isMesh){c.castShadow=false;c.receiveShadow=false;if(c.material.map)c.material.map.anisotropy=4}});
    o.scale.setScalar(ROOM_M);o.position.set(Math.cos(a)*r,-1.2+y*ROOM_M,Math.sin(a)*r);o.lookAt(0,o.position.y,0);o.rotateY(yaw);room.add(o);
    if(k==='vintage_oil_lamp')lampFor.o=o}catch(e){console.warn('mueble',k,e)}}));
  if(lampFor.o){const b=new THREE.Box3().setFromObject(lampFor.o),c=b.getCenter(new THREE.Vector3());const h=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex,color:new THREE.Color(1.5,.95,.42),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    h.position.set(c.x,b.min.y+(b.max.y-b.min.y)*0.42,c.z);h.scale.setScalar(55);room.add(h)}
})()}
function buildRoom(){
  const floor=new THREE.Mesh(new THREE.CircleGeometry(1400,64).rotateX(-Math.PI/2),new THREE.MeshPhysicalMaterial({map:phTex('herringbone_parquet_diff',PQ,PQ,true),normalMap:phTex('herringbone_parquet_nor',PQ),roughnessMap:phTex('herringbone_parquet_arm',PQ),aoMap:phTex('herringbone_parquet_arm',PQ),color:0xd9b896,normalScale:new THREE.Vector2(.8,.8),roughness:.9,clearcoat:.4,clearcoatRoughness:.3}));floor.position.y=-1.2;floor.receiveShadow=true;room.add(floor);
  const wallMat=new THREE.MeshStandardMaterial({color:'#16301f',map:wallTex,roughness:.9,side:THREE.BackSide});
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(1100,1100,800,64,1,true),wallMat);wall.position.y=398;room.add(wall);
  const skirting=new THREE.Mesh(new THREE.CylinderGeometry(1098,1098,26,64,1,true),new THREE.MeshStandardMaterial({color:0xeee6d6,roughness:.6,side:THREE.BackSide}));skirting.position.y=12;room.add(skirting);
  const wa=-2.2,wx=Math.cos(wa)*1092,wz=Math.sin(wa)*1092,win=new THREE.Mesh(new THREE.PlaneGeometry(300,380),new THREE.MeshBasicMaterial({map:nightTex,color:new THREE.Color(1.3,1.3,1.4)}));win.position.set(wx,300,wz);win.lookAt(0,300,0);room.add(win);
  const sill=box(340,10,40,new THREE.MeshStandardMaterial({color:0xefe6d6}),wx*0.985,106,wz*0.985,room);sill.lookAt(0,106,0);
  const fa=0.55,fx=Math.cos(fa)*1060,fz=Math.sin(fa)*1060,fp=new THREE.Group();fp.position.set(fx,0,fz);fp.lookAt(0,0,0);room.add(fp);
  const brick=new THREE.MeshStandardMaterial({map:phTex('red_brick_03_diff',1.6,1.6,true),normalMap:phTex('red_brick_03_nor',1.6),roughnessMap:phTex('red_brick_03_arm',1.6),aoMap:phTex('red_brick_03_arm',1.6),roughness:1});
  box(90,260,70,brick,-135,130,0,fp);box(90,260,70,brick,135,130,0,fp);box(360,70,70,brick,0,295,0,fp);box(400,16,90,new THREE.MeshPhysicalMaterial({color:0x3a2416,map:woodTex,roughness:.5,clearcoat:.6}),0,336,10,fp);
  box(180,8,60,new THREE.MeshStandardMaterial({color:0x111111}),0,2,-10,fp);
  box(190,260,10,new THREE.MeshStandardMaterial({color:0x120807,roughness:1}),0,130,-30,fp);
  fireU={t:{value:0}};const fire=new THREE.Mesh(new THREE.PlaneGeometry(170,150),new THREE.ShaderMaterial({uniforms:fireU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float t;varying vec2 vU;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){vec2 p=vU;float q=n(vec2(p.x*6.,p.y*4.-t*2.2))*.6+n(vec2(p.x*13.,p.y*9.-t*3.7))*.4;float shape=smoothstep(.0,.25,p.x)*smoothstep(1.,.75,p.x);float f=clamp((1.-p.y*1.35)*shape*(q*1.6)-.15,0.,1.);
    vec3 c=mix(vec3(1.4,.25,.03),vec3(3.,1.7,.5),f);gl_FragColor=vec4(c*f*1.6,f);}`}));fire.position.set(0,75,-20);fp.add(fire);
  for(let i=0;i<5;i++){const lg=cyl(9,9,120,M.trunk,10);lg.rotation.z=Math.PI/2;lg.rotation.y=(i-2)*0.25;lg.position.set((i-2)*14,12+(i%2)*14,-10);fp.add(lg)}
  fireL.position.copy(fp.localToWorld(new THREE.Vector3(0,90,60)));
  [-120,0,120].forEach((x,i)=>{const s=obj(i%2?'sock2':'sock',60);s.position.set(x,270,40);s.rotation.y=Math.PI;fp.add(s)});
  const wr=obj('wreath',90);wr.position.set(0,470,-20);wr.rotation.x=-Math.PI/2;fp.add(wr);
  warmFill.position.copy(fireL.position);warmFill.target.position.set(0,0,0);
  const gp=[],gc=[],pal=[[3,2,.9],[3,.6,.5],[.6,1.6,3],[1,3,1],[3,2.4,1.2]];
  for(let k=0;k<6;k++){const a0=k/6*Math.PI*2+0.3,a1=a0+Math.PI/3*0.9;for(let i=0;i<=40;i++){const u=i/40,a=lerp(a0,a1,u),y=470-Math.sin(u*Math.PI)*90;gp.push(Math.cos(a)*1080,y,Math.sin(a)*1080);gc.push(...pal[(i+k)%5])}}
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));gg.setAttribute('color',new THREE.Float32BufferAttribute(gc,3));
  garland=new THREE.Points(gg,new THREE.PointsMaterial({map:dotTex,size:18,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));room.add(garland);
}

/* ================= maqueta (se rehace al ampliar la vía) ================= */
let world=null,T=null,SL=[],MATR=80,STN=null,treeParts=null,anims=[],decoG=null,arches=[],eaveLights=[],TG=null,FEAT=[],GIANTS=[];
function buildGrid(){TG=new Map();const add=(x,z)=>{const k=Math.floor(x/16)*4096+Math.floor(z/16);let l=TG.get(k);if(!l)TG.set(k,l=[]);l.push(x,z)};for(let i=0;i<T.N;i+=4)add(T.x[i],T.z[i])}
function dTrack(x,z){const cx=Math.floor(x/16),cz=Math.floor(z/16);let m=1e9;for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const l=TG.get((cx+a)*4096+(cz+b));if(l)for(let i=0;i<l.length;i+=2){const dx=l[i]-x,dz=l[i+1]-z,d=dx*dx+dz*dz;if(d<m)m=d}}return m<1e9?Math.sqrt(m):48}
function dFeat(x,z){let m=1e9;for(const [a,b,r] of FEAT){const d=Math.hypot(x-a,z-b)-r;if(d<m)m=d}return m}
/* relieve de la manta: llano en la vía, las casas y el taller; ondulado lejos de ellos */
function matH(x,z,d){if(d===undefined)d=dTrack(x,z);const r=Math.hypot(x,z),df=dFeat(x,z),f=Math.min(d,df+2);const bank=Math.exp(-Math.pow((d-GAUGE-3.6)/1.6,2))*0.9;
  return ((fbm(x*0.025+3,z*0.025)-0.3)*3.6+vnoise(x*0.12,z*0.12)*0.5)*sstep(6,24,f)*sstep(TREE_R+3,TREE_R+12,r)+bank*sstep(TREE_R+1,TREE_R+10,r)*sstep(0,4,df)}
function extrude(prof,step,mat){const N=T.N,Mx=Math.ceil(N/step),P=prof.length,pos=new Float32Array((Mx+1)*P*3),uv=new Float32Array((Mx+1)*P*2),ind=[];
  for(let i=0;i<=Mx;i++){const k=i===Mx?0:i*step,c=Math.cos(T.a[k]),s=Math.sin(T.a[k]);
    for(let j=0;j<P;j++){const o=(i*P+j)*3;pos[o]=T.x[k]-s*prof[j][0];pos[o+1]=prof[j][1];pos[o+2]=T.z[k]+c*prof[j][0];uv[(i*P+j)*2]=prof[j][0]/3;uv[(i*P+j)*2+1]=i*step*T.ds/3}}
  for(let i=0;i<Mx;i++)for(let j=0;j<P-1;j++){const a=i*P+j,b=(i+1)*P+j;ind.push(a,b,b+1,a,b+1,a+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.receiveShadow=true;return m}
function batchStatic(root){root.updateMatrixWorld(true);const list=[];root.traverse(o=>{if(o.isMesh&&o.userData.st)list.push(o)});list.forEach(o=>o.parent.remove(o));mergeMeshes(list).forEach(m=>root.add(m))}
const markStatic=o=>o.traverse(c=>{if(c.isMesh&&!c.isInstancedMesh&&!Array.isArray(c.material))c.userData.st=true});
function blobs(list,par){if(!list.length)return;const m=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.6,polygonOffset:true,polygonOffsetFactor:-2}),list.length);
  list.forEach(([x,z,r,y],i)=>{o3.position.set(x,(y||0)+0.15,z);o3.rotation.set(0,0,0);o3.scale.set(r*2,1,r*2);o3.updateMatrix();m.setMatrixAt(i,o3.matrix)});o3.scale.set(1,1,1);m.renderOrder=1;par.add(m)}
const outward=p=>{let nx=-Math.sin(p.a),nz=Math.cos(p.a);if(nx*p.x+nz*p.z<0){nx=-nx;nz=-nz}return [nx,nz]};

async function buildWorld(k){
  if(world){scene.remove(world);disposeObj(world)}world=new THREE.Group();scene.add(world);anims=[];decoG=null;arches=[];GIANTS=[];
  T=trackOf(k);SL=slotsOf(k);buildGrid();
  let mr=0;for(let i=0;i<T.N;i+=4)mr=Math.max(mr,Math.hypot(T.x[i],T.z[i]));MATR=mr+HOUSE_OFF+24;
  const r=rng(500+k*97),p0=atT(T,0),[snx,snz]=outward(p0);
  FEAT=[...SL.map(s=>[s.x,s.z,6]),[p0.x+snx*7,p0.z+snz*7,14]];
  // manta de nieve
  {const rg=new THREE.RingGeometry(1,MATR,coarse?120:180,coarse?40:60);rg.rotateX(-Math.PI/2);const pa=rg.attributes.position,col=new Float32Array(pa.count*3);
   for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i),rr=Math.hypot(x,z);const edge=sstep(MATR-14,MATR,rr);const d=dTrack(x,z);const h=d<GAUGE+1.6?0:matH(x,z,d)-edge*1.5;pa.setY(i,h);const lo=sstep(-1.2,1.6,h),b=0.93+fbm(x*0.08,z*0.08)*0.07;col[i*3]=b*lerp(0.84,1,lo);col[i*3+1]=b*lerp(0.9,1,lo);col[i*3+2]=b}
   rg.setAttribute('color',new THREE.BufferAttribute(col,3));rg.computeVertexNormals();
   const gm=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,roughnessMap:snowR,normalMap:snowN,normalScale:new THREE.Vector2(.9,.9)});
   gm.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
     sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec2 gc=floor(vWP.xz*11.);float r=fract(sin(dot(gc,vec2(12.9898,78.233)))*43758.5453);vec3 vd=normalize(cameraPosition-vWP);float tw=fract(r*91.7+dot(vd,vec3(4.1,6.7,3.3))*2.);float dd=length(cameraPosition-vWP);totalEmissiveRadiance+=vec3(2.2,2.3,2.6)*step(.992,r)*smoothstep(.75,1.,tw)*smoothstep(90.,5.,dd)*2.2;}')};
   const mat=new THREE.Mesh(rg,gm);mat.receiveShadow=true;world.add(mat);
   const tor=new THREE.Mesh(new THREE.TorusGeometry(MATR,4.2,10,160),new THREE.MeshStandardMaterial({color:0xf4f7ff,roughness:.8,roughnessMap:snowR,normalMap:snowN,normalScale:new THREE.Vector2(1,1)}));tor.rotation.x=Math.PI/2;tor.position.y=-0.6;tor.scale.set(1,1,0.55);tor.receiveShadow=true;world.add(tor)}
  // vía
  world.add(extrude([[-GAUGE-1.4,0.02],[-GAUGE-0.9,0.3],[GAUGE+0.9,0.3],[GAUGE+1.4,0.02]],2,M.roadbed));
  const tube=(o,rr,y)=>Array.from({length:9},(_,q)=>{const a=q/8*Math.PI*2;return [o+Math.cos(a)*rr,y+Math.sin(a)*rr]});
  [GAUGE,-GAUGE].forEach(o=>world.add(extrude(tube(o,0.15,0.6),1,M.rail)));world.add(extrude(tube(0,0.1,0.52),1,M.rail));
  {const nS=Math.floor(T.L/1.25),sl=new THREE.InstancedMesh(new THREE.BoxGeometry(0.42,0.16,GAUGE*2+1.3),M.sleeper,nS);
   for(let i=0;i<nS;i++){const p=atT(T,i*1.25);o3.position.set(p.x,0.38,p.z);o3.rotation.set(0,-p.a,0);o3.scale.set(1,1,1);o3.updateMatrix();sl.setMatrixAt(i,o3.matrix)}sl.receiveShadow=true;world.add(sl)}
  buildBigTree(TREE_R,r);
  // taller de Papá Noel: aquí se cargan los regalos
  {const g=new THREE.Group();
    box(26,1.0,5,M.conc,0,0.5,0,g);box(26,0.06,0.35,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.2,.3)}),0,1.03,-2.3,g);
    [-9,-3,3,9].forEach(x=>{const c=cyl(0.14,0.14,4.4,M.dark,10);c.position.set(x,3.2,1.6);g.add(c)});
    box(21,0.25,4.6,M.roofEdge,0,5.45,0.6,g);box(21.4,0.4,5,M.snow,0,5.75,0.6,g);
    const hb=house(r,HMAT[0]);hb.position.set(-3,1,7.2);hb.rotation.y=Math.PI;g.add(hb);
    [-6,6].forEach(x=>{const hd=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,8),M.lamp);hd.position.set(x,4.9,0.6);g.add(hd)});
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(6,1.5),new THREE.MeshBasicMaterial({map:signTex('Taller','de Papá Noel'),side:THREE.DoubleSide}));sg.position.set(0,6.7,0.6);sg.rotation.y=Math.PI;g.add(sg);
    const bench=obj('bench',1.6);bench.position.set(5,1,1.4);bench.rotation.y=Math.PI;g.add(bench);
    [-12,12].forEach(x=>{const l=obj('lantern',6.5);l.position.set(x,1,-1.2);g.add(l)});
    const pile=new THREE.Group();[['presA',2.2,0,0],['presB',1.8,1.6,0.6],['presC',1.6,0.6,1.6],['presD',1.2,0.8,0.5,2.2],['presA',1.5,-1.4,1.2],['presB',1.3,2.4,1.9]].forEach(([q,h,x,z,y])=>{const o=obj(q,h);o.position.set(x-8,1+(y||0),z+0.2);o.rotation.y=x;pile.add(o)});g.add(pile);
    const nut=obj('nut',5.2);nut.position.set(-4.5,1,-0.6);nut.rotation.y=Math.PI;g.add(nut);
    g.position.set(p0.x+snx*5.2,0,p0.z+snz*5.2);g.rotation.y=Math.atan2(snx,snz);world.add(g);
    g.traverse(c=>{if(c.isMesh&&c!==nut&&!pile.children.includes(c))c.userData.st=true});
    g.updateMatrixWorld(true);STN={pile,nut,hop:0,base:nut.rotation.y,pileWorld:pile.localToWorld(new THREE.Vector3(-8,2,0.6)),x:g.position.x,z:g.position.z}}
  // decorado: abetos, nieve, rocas, renos, muñecos y trineos lejos de la vía, las casas y el taller
  const taken=[[0,0,TREE_R+6],[p0.x+snx*8,p0.z+snz*8,17],...SL.map(s=>[s.x,s.z,8.5])];
  const free=(x,z,rad)=>taken.every(([a,b,q])=>Math.hypot(a-x,b-z)>q+rad),inMat=(x,z,m)=>Math.hypot(x,z)<MATR-m;
  const scatter=(n,minD,rad,fn)=>{const out=[];for(let t=0;t<n*25&&out.length<n;t++){const x=(r()-.5)*2*MATR,z=(r()-.5)*2*MATR,d=dTrack(x,z);if(d>minD&&inMat(x,z,rad+4)&&free(x,z,rad)){const o=fn(x,z,d);out.push(o);taken.push([x,z,rad])}}return out};
  const area=MATR*MATR/4900,trees={treeA:[],treeB:[],treeC:[],treeD:[]};
  scatter(Math.round((coarse?22:32)*area),9,3,(x,z,d)=>{const q=['treeA','treeB','treeC','treeA','treeB','treeD'][Math.floor(r()*6)];const o={x,z,y:matH(x,z,d)-0.2,h:7+r()*9,r:r()*6};trees[q].push(o);return o});
  Object.entries(trees).forEach(([q,l])=>inst(q,l,true,world));blobs(Object.values(trees).flat().map(o=>[o.x,o.z,o.h*0.3,o.y]),world);
  inst('pile',scatter(Math.round(12*area),6,2,(x,z,d)=>({x,z,y:matH(x,z,d)-0.3,h:1.2+r()*1.4,r:r()*6})),false,world);
  inst('rocks',scatter(Math.round(5*area),7,2,(x,z,d)=>({x,z,y:matH(x,z,d)-0.2,h:1.6+r()*1.6,r:r()*6})),true,world);
  scatter(2+k,7,3,(x,z,d)=>{const g=new THREE.Group();const n=2+Math.floor(r()*3);for(let i=0;i<n;i++){const d1=obj('deer',3.8+r()*0.8);d1.position.set((r()-.5)*7,0,(r()-.5)*7);d1.rotation.y=r()*6;g.add(d1);anims.push({k:'deer',o:d1,base:d1.rotation.y,ph:r()*6})}g.position.set(x,matH(x,z,d),z);world.add(g);return {}});
  scatter(3+k,6,2,(x,z,d)=>{const s=obj('snowman',4.2);s.position.set(x,matH(x,z,d),z);s.rotation.y=r()*6;world.add(s);anims.push({k:'snowman',o:s,ph:r()*6});return {}});
  scatter(4+k,3.8,1.4,(x,z,d)=>{const s=obj(r()<.5?'ginger':'ginger2',2.4);s.position.set(x,matH(x,z,d),z);s.rotation.y=r()*6;world.add(s);anims.push({k:'ginger',o:s,y:s.position.y,ph:r()*6});return {}});
  scatter(2,6,3,(x,z,d)=>{const s=obj('sled',1.8);s.position.set(x,matH(x,z,d),z);s.rotation.y=r()*6;world.add(s);s.userData.st=true;return {}});
  // regalos gigantes y juguetes del salón alrededor de la manta
  {const n=7+Math.floor(r()*3);for(let i=0;i<n;i++){const a=i/n*Math.PI*2+r()*0.4,sz=36+r()*46,rr=MATR+sz*0.6+10+r()*40;giantPresent(Math.cos(a)*rr,Math.sin(a)*rr,sz,sz*(0.6+r()*0.6),r()*0.8,WRAPS[Math.floor(r()*WRAPS.length)])}
   const giant=(k,h,a,rr)=>{const o=obj(k,h);o.material=o.material.clone();o.material.transparent=true;o.position.set(Math.cos(a)*rr,-1.2,Math.sin(a)*rr);world.add(o);GIANTS.push({o,mats:[o.material],a,r:rr,op:1});return o};
   const a1=r()*6;giant('ginger',38,a1,MATR+30).rotation.set(-0.35,a1+Math.PI,0);
   giant('nut',58,a1+2.2,MATR+44).lookAt(0,-1.2,0);
   [a1+1,a1+3.8].forEach((aa,i)=>giant(i?'caneG':'caneR',70,aa,MATR+26).rotation.set(0.25,aa,0))}
  batchStatic(world);
  // sombra: la luz principal cubre toda la maqueta
  const S=MATR*1.05,dir=new THREE.Vector3(-60,120,-40).normalize();key.position.copy(dir).multiplyScalar(300);key.target.position.set(0,0,0);
  Object.assign(key.shadow.camera,{left:-S,right:S,top:S,bottom:-S,near:1,far:300+MATR*2});key.shadow.camera.updateProjectionMatrix();
}
function giantPresent(x,z,sz,h,rot,tex){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({map:tex,roughness:.4,transparent:true});
  box(sz,h,sz,mat,0,h/2,0,g);const rb=new THREE.MeshStandardMaterial({color:0xe8c35a,metalness:.7,roughness:.25,transparent:true});
  box(sz+0.4,h+0.4,sz*0.12,rb,0,h/2,0,g);box(sz*0.12,h+0.4,sz+0.4,rb,0,h/2,0,g);
  [[0,0.7],[Math.PI,0.7],[Math.PI/2,0.5],[-Math.PI/2,0.5]].forEach(([a,s])=>{const t=new THREE.Mesh(new THREE.TorusGeometry(sz*0.13*s+sz*0.04,sz*0.035,10,24),rb);t.position.y=h+sz*0.1;t.rotation.set(Math.PI/2*0.4,a,0);t.position.x=Math.cos(a)*sz*0.1;t.position.z=Math.sin(a)*sz*0.1;g.add(t)});
  g.updateMatrixWorld(true);const parts=[...g.children],merged=mergeMeshes(parts);parts.forEach(o=>{g.remove(o);o.geometry.dispose()});merged.forEach(m=>g.add(m));
  g.position.set(x,-1.2,z);g.rotation.y=rot;world.add(g);GIANTS.push({o:g,mats:[mat,rb],a:Math.atan2(z,x),r:Math.hypot(x,z),op:1})}
function buildBigTree(R,r){
  const g=new THREE.Group(),H=R*2.5;
  const stand=cyl(R*0.24,R*0.3,7,M.red,24);stand.position.y=3.5;g.add(stand);const rim=new THREE.Mesh(new THREE.TorusGeometry(R*0.24,0.5,8,32),M.gold);rim.rotation.x=Math.PI/2;rim.position.y=7;g.add(rim);
  const tk=cyl(R*0.07,R*0.09,H*0.3,M.trunk,12);tk.position.y=H*0.15+3;g.add(tk);
  const skirt=new THREE.Mesh(new THREE.RingGeometry(R*0.3,R*0.95,48,1).rotateX(-Math.PI/2),M.felt);skirt.position.y=0.25;skirt.receiveShadow=true;g.add(skirt);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(R*0.95,0.9,8,64),M.fur);trim.rotation.x=Math.PI/2;trim.position.y=0.4;g.add(trim);
  const core=new THREE.Mesh(new THREE.ConeGeometry(R*0.4,H*0.86,24),M.core);core.position.y=H*0.43+12;g.add(core);
  const wh=24,per=14,n=wh*per,br=new THREE.InstancedMesh(branchGeo,M.branch,n),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(),col=new THREE.Color();let k=0;const tips=[];
  const y0=12.5;
  for(let i=0;i<wh;i++){const u=i/wh,y=y0+(H-y0)*0.94*u,L=R*Math.pow(1-u,0.95)+1.2;const pitch0=-Math.min(0.45,Math.asin(Math.min(1,Math.max(0,y-10)/L)));
    for(let j=0;j<per;j++){const phi=j/per*Math.PI*2+i*0.7,pitch=pitch0+(hash2(i,j)-.5)*0.12;q.setFromEuler(e.set(0,phi,pitch,'YZX'));p.set(0,y,0);s.set(L,1,L);m4.compose(p,q,s);br.setMatrixAt(k,m4);col.setHSL(0.36,0.25,0.72+hash2(i,j*3)*0.28);br.setColorAt(k,col);k++;
      if(j%2===0)tips.push([Math.cos(phi)*L*0.82,y+Math.sin(pitch)*L*0.82-1.2,-Math.sin(phi)*L*0.82])}}
  br.instanceColor.needsUpdate=true;br.castShadow=br.receiveShadow=true;g.add(br);
  const radAt=y=>{const u=Math.min(1,Math.max(0,(y-y0)/((H-y0)*0.94)));return (R*Math.pow(1-u,0.95)+1.2)*0.8};
  const k0=R/30,NB=coarse?150:220,phases=[0,1,2].map(()=>new THREE.InstancedMesh(new THREE.SphereGeometry(0.55*Math.max(0.7,k0),10,8),new THREE.MeshBasicMaterial({color:0xffffff}),Math.ceil(NB/3)));
  const pal=[[3,.4,.5],[3,2.3,.5],[.5,1.4,3],[.7,3,.9],[3,.9,2.4]],o=new THREE.Object3D();
  for(let i=0;i<NB;i++){const t=i/NB,y=y0+2+t*(H-y0-4),ang=t*Math.PI*2*10,rr=radAt(y);o.position.set(Math.cos(ang)*rr,y-1,Math.sin(ang)*rr);o.scale.set(0.8,1.3,0.8);o.updateMatrix();const m=phases[i%3];m.setMatrixAt(Math.floor(i/3),o.matrix);m.setColorAt(Math.floor(i/3),new THREE.Color(...pal[i%5]))}
  phases.forEach(m=>{m.instanceColor.needsUpdate=true;g.add(m)});
  const orn=new THREE.InstancedMesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshPhysicalMaterial({roughness:.06,metalness:.85,clearcoat:1,iridescence:.4}),tips.length),oc=[0xd0202f,0xf0b93c,0xdfe6f2,0x2a6fd6,0x1f8a52];o.scale.set(1,1,1);
  tips.forEach((tp,i)=>{if(tp[1]<10)tp[1]=10;const sc=(1.6+hash2(i,7)*1.4)*k0;o.position.set(...tp);o.scale.setScalar(sc);o.updateMatrix();orn.setMatrixAt(i,o.matrix);orn.setColorAt(i,new THREE.Color(oc[i%5]))});orn.instanceColor.needsUpdate=true;orn.castShadow=true;g.add(orn);
  const sh=new THREE.Shape();for(let i=0;i<10;i++){const rr=i%2?2.2:5.2,a=Math.PI/2+i*Math.PI/5;i?sh.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):sh.moveTo(Math.cos(a)*rr,Math.sin(a)*rr)}
  const stg=new THREE.ExtrudeGeometry(sh,{depth:1.4,bevelEnabled:true,bevelSize:.3,bevelThickness:.3,bevelSegments:2});stg.translate(0,0,-0.7);
  const star=new THREE.Mesh(stg,new THREE.MeshBasicMaterial({color:new THREE.Color(4,3,1)}));star.position.y=H+16;g.add(star);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(R*5,R*5).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:dotTex,color:new THREE.Color(1.1,.62,.28),transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.y=0.6;g.add(glow);
  world.add(g);treeParts={phases,star,glow,top:new THREE.Vector3(0,H+16,0)};
}

/* ================= casas ================= */
function house(r,bm){
  const g=new THREE.Group(),w=6+r()*3,d=6+r()*2,h=3.4+r()*1.4;
  box(w,h,d,bm,0,h/2,0,g);box(w+0.1,0.5,d+0.1,M.conc,0,0.25,0,g);
  const sh=new THREE.Shape();sh.moveTo(-w/2-0.6,0);sh.lineTo(w/2+0.6,0);sh.lineTo(0,h*0.6);sh.closePath();
  const eg=new THREE.ExtrudeGeometry(sh,{depth:d+0.9,bevelEnabled:false});eg.translate(0,h-0.12,-(d+0.9)/2);const edge=new THREE.Mesh(eg,M.roofEdge);edge.castShadow=true;g.add(edge);
  const rg=new THREE.ExtrudeGeometry(sh,{depth:d+0.9,bevelEnabled:true,bevelThickness:.28,bevelSize:.24,bevelSegments:3,curveSegments:1});rg.translate(0,h+0.12,-(d+0.9)/2);
  const roof=new THREE.Mesh(rg,M.snow);roof.castShadow=roof.receiveShadow=true;g.add(roof);
  box(0.8,1.8,0.8,M.wood,w*0.22,h+1.1,d*0.15,g);g.userData.chim=new THREE.Vector3(w*0.22,h+2.3,d*0.15);box(1,0.25,1,M.snow,w*0.22,h+2.05,d*0.15,g);
  const wg=new THREE.PlaneGeometry(1.05,1.3);
  [[-w*0.28,h*0.55],[w*0.28,h*0.55]].forEach(([x,y])=>{const p=new THREE.Mesh(wg,M.win);p.position.set(x,y,d/2+0.02);g.add(p);box(1.3,0.12,0.3,M.snow,x,y-0.72,d/2+0.12,g)});
  [-d*0.2,d*0.2].forEach(z=>{const p=new THREE.Mesh(wg,M.win);p.position.set(w/2+0.02,h*0.55,z);p.rotation.y=Math.PI/2;g.add(p);const q=p.clone();q.position.x=-w/2-0.02;q.rotation.y=-Math.PI/2;g.add(q)});
  const door=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.1),M.door);door.position.set(0,1.05,d/2+0.02);g.add(door);
  const wr=new THREE.Mesh(new THREE.TorusGeometry(0.32,0.11,8,16),M.green);wr.position.set(0,1.5,d/2+0.08);g.add(wr);
  g.userData.eaves=[[-w/2-0.5,w/2+0.5,h+0.05,d/2+0.55],[-w/2-0.5,w/2+0.5,h+0.05,-d/2-0.55]];
  return g;
}
const townG=new THREE.Group();scene.add(townG);
let HS=[],townBatch=[],popQ=[],needBatch=false;const giftQ=[];
function makeHouse(i){const sl=SL[i],r=rng(9001+i*131),g=house(r,HMAT[(i*5+st.stage)%6]);g.position.set(sl.x,0,sl.z);g.rotation.y=Math.atan2(-sl.nx,-sl.nz);g.updateMatrixWorld(true);
  const chim=g.localToWorld(g.userData.chim.clone()),ev=[],ice=[],v=new THREE.Vector3();
  g.userData.eaves.forEach(([x0,x1,y,z])=>{for(let x=x0;x<=x1;x+=0.42){v.set(x,y,z);g.localToWorld(v);ev.push(v.clone());if(r()<0.7){const u=v.clone();u.y-=0.05;ice.push([u,0.25+r()*0.55])}}});
  return {g,chim,ev,ice,i,pop:1,landed:true}}
function clearTown(){townBatch.forEach(m=>{townG.remove(m);m.geometry.dispose();if(m.isInstancedMesh)m.dispose()});townBatch=[];eaveLights=[];HS.forEach(h=>{if(h.g.parent)townG.remove(h.g);disposeObj(h.g)});HS=[];popQ=[]}
function placeTown(anim){clearTown();for(let i=0;i<Math.min(st.houses,SL.length);i++){const h=makeHouse(i);HS.push(h);if(anim&&!FASTSTEP){h.pop=-i*0.05;h.landed=false;h.g.visible=false;townG.add(h.g);popQ.push(h)}}rebatch()}
function addHouse(){const h=makeHouse(HS.length);HS.push(h);if(FASTSTEP){rebatch();return}h.pop=0;h.landed=false;townG.add(h.g);popQ.push(h)}
/* las casas ya colocadas van unidas por material; las que están apareciendo van sueltas */
function rebatch(){townBatch.forEach(m=>{townG.remove(m);m.geometry.dispose();if(m.isInstancedMesh)m.dispose()});townBatch=[];eaveLights=[];
  const settled=HS.filter(h=>h.pop>=1),meshes=[];settled.forEach(h=>{if(h.g.parent)townG.remove(h.g);h.g.updateMatrixWorld(true);h.g.traverse(o=>{if(o.isMesh)meshes.push(o)})});
  townBatch=mergeMeshes(meshes);
  const ice=settled.flatMap(h=>h.ice);if(ice.length){const ig=new THREE.ConeGeometry(0.06,1,5);ig.rotateX(Math.PI);ig.translate(0,-0.5,0);const im=new THREE.InstancedMesh(ig,M.icicle,ice.length);
    ice.forEach(([v,l],i)=>{o3.position.copy(v);o3.rotation.set(0,0,0);o3.scale.set(1,l,1);o3.updateMatrix();im.setMatrixAt(i,o3.matrix)});o3.scale.set(1,1,1);townBatch.push(im)}
  // guirnaldas en los aleros: llegan con el primer nivel de luces
  if(st.lights>=1){const ev=settled.flatMap(h=>h.ev),pal=[[3,.4,.5],[3,2.3,.5],[.5,1.4,3],[.7,3,.9]];eaveLights=[0,1].map(q=>{const idx=ev.filter((_,i)=>i%2===q),m=new THREE.InstancedMesh(new THREE.SphereGeometry(0.09,6,4),new THREE.MeshBasicMaterial({color:0xffffff}),Math.max(1,idx.length));
    idx.forEach((v,i)=>{o3.position.copy(v);o3.position.y+=0.08;o3.rotation.set(0,0,0);o3.updateMatrix();m.setMatrixAt(i,o3.matrix);m.setColorAt(i,new THREE.Color(...pal[(i+q)%4]))});if(m.instanceColor)m.instanceColor.needsUpdate=true;if(!idx.length)m.visible=false;return m});townBatch.push(...eaveLights)}
  townBatch.forEach(m=>townG.add(m))}

/* luces compradas: farolas (nivel 2) y arcos de caramelo (nivel 3); las guirnaldas van con las casas */
let treeLightK=0.6;
function buildDeco(){if(decoG){world.remove(decoG);disposeObj(decoG)}decoG=new THREE.Group();world.add(decoG);arches=[];treeLightK=0.55+0.15*Math.min(3,st.lights);
  const nearStation=s=>s<22||s>T.L-22;
  if(st.lights>=2){const pos=[];for(let s=14;s<T.L;s+=26){if(nearStation(s))continue;const p=atT(T,s),side=(Math.round(s/26)%2?1:-1),x=p.x-Math.sin(p.a)*(GAUGE+3)*side,z=p.z+Math.cos(p.a)*(GAUGE+3)*side;
      if(SL.some(o=>Math.hypot(o.x-x,o.z-z)<7)||Math.hypot(x,z)<TREE_R+3)continue;pos.push({x,z,h:6.2,r:p.a})}
    inst('lantern',pos,true,decoG);const hy=6.2*0.78;
    if(pos.length){const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(0.42,12,8),M.lamp,pos.length),pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(10,10).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:dotTex,color:new THREE.Color(.6,.42,.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),pos.length);
      pos.forEach((q,i)=>{o3.rotation.set(0,0,0);o3.scale.set(1,1,1);o3.position.set(q.x,hy,q.z);o3.updateMatrix();heads.setMatrixAt(i,o3.matrix);o3.position.set(q.x,0.5,q.z);o3.updateMatrix();pools.setMatrixAt(i,o3.matrix)});pools.frustumCulled=false;decoG.add(heads,pools)}}
  if(st.lights>=3){[0.16,0.41,0.66,0.89].forEach((f,k)=>{const s=f*T.L;if(nearStation(s))return;const p=atT(T,s),g=new THREE.Group();
    const arc=new THREE.Mesh(new THREE.TorusGeometry(4.6,0.22,10,48,Math.PI),M.cane);arc.castShadow=true;g.add(arc);
    const n=26,bm=[0,1].map(()=>new THREE.InstancedMesh(new THREE.SphereGeometry(0.17,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),n/2)),pal=[[3,.5,.6],[3,2.2,.5],[.6,1.6,3],[.8,3,1]];
    for(let i=0;i<n;i++){const t=(i+0.5)/n*Math.PI;o3.position.set(Math.cos(t)*4.6,Math.sin(t)*4.6-0.3,0);o3.rotation.set(0,0,0);o3.scale.set(1,1,1);o3.updateMatrix();bm[i%2].setMatrixAt(i>>1,o3.matrix);bm[i%2].setColorAt(i>>1,new THREE.Color(...pal[(i+k)%4]))}
    bm.forEach(b=>{b.instanceColor.needsUpdate=true;g.add(b)});g.position.set(p.x,0.3,p.z);g.rotation.y=-(p.a+Math.PI/2);decoG.add(g);arches.push(bm)})}
  rebatch()}

/* ================= sonido ================= */
let ac=null,sfx=store.get('advx-sfx')!=='0',music=store.get('advx-music')!=='0';
function au(){if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume().catch(()=>{});return ac}
function tone(f,d,type,g,when){if(!sfx||!ac)return;const t=ac.currentTime+(when||0),o=ac.createOscillator(),v=ac.createGain();o.type=type||'sine';o.frequency.value=f;v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(g,t+0.012);v.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(v);v.connect(ac.destination);o.start(t);o.stop(t+d+0.05)}
let nbuf=null;function nb(){if(!nbuf){const n=ac.sampleRate;nbuf=ac.createBuffer(1,n,n);const a=nbuf.getChannelData(0);for(let i=0;i<n;i++)a[i]=Math.random()*2-1}return nbuf}
function noise(d,g,fc,type){if(!sfx||!ac)return;nb();const t=ac.currentTime,s=ac.createBufferSource(),f=ac.createBiquadFilter(),v=ac.createGain();s.buffer=nbuf;f.type=type||'lowpass';f.frequency.value=fc;v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(0.0001,t+d);s.connect(f);f.connect(v);v.connect(ac.destination);s.start(t,Math.random()*0.5,d+0.05)}
const PENTA=[1047,1175,1319,1568,1760,2093];let lastChime=0;
const chime=()=>{const n=performance.now();if(n-lastChime<70)return;lastChime=n;tone(PENTA[Math.floor(Math.random()*PENTA.length)],0.5,'sine',0.035);tone(PENTA[Math.floor(Math.random()*PENTA.length)]*2,0.25,'sine',0.012,0.02)};
const kaching=()=>{tone(1318,0.14,'triangle',0.06);tone(1976,0.32,'triangle',0.05,0.07);noise(0.08,0.03,6000,'highpass')};
const nope=()=>{tone(196,0.16,'triangle',0.05)};
const bells=()=>[1319,1568,2093,2637].forEach((f,i)=>tone(f,0.8,'sine',0.08,i*0.08));
const whistle=()=>{tone(740,1.1,'triangle',0.07);tone(932,1.1,'triangle',0.05);tone(1109,1.1,'triangle',0.03)};
const loadS=()=>{tone(1568,0.2,'triangle',0.03);tone(2093,0.25,'triangle',0.025,0.08)};
// Villancicos de dominio público: Jingle Bells (1857), We Wish You a Merry Christmas y Deck the Halls (tradicionales)
const m2f=m=>440*Math.pow(2,(m-69)/12);
const cG=[43,'M'],cC=[48,'M'],cD=[50,'M'],cD7=[50,'7'],cA7=[45,'7'],cB7=[47,'7'],cEm=[40,'m'];
const JB=[[71,1],[71,1],[71,2],[71,1],[71,1],[71,2],[71,1],[74,1],[67,1.5],[69,.5],[71,4],[72,1],[72,1],[72,1.5],[72,.5],[72,1],[71,1],[71,1],[71,.5],[71,.5],[71,1],[69,1],[69,1],[71,1],[69,2],[74,2]];
const SONGS=[
 {bpm:132,bpb:4,bells:1,mel:[...JB,...JB.slice(0,21),[74,1],[74,1],[72,1],[69,1],[67,4]],ch:[cG,cG,cG,cG,cC,cG,cA7,cD7,cG,cG,cG,cG,cC,cG,cD7,cG]},
 {bpm:108,bpb:3,bells:.6,mel:[[0,2],[62,1],[67,1],[67,.5],[69,.5],[67,.5],[66,.5],[64,1],[64,1],[64,1],[69,1],[69,.5],[71,.5],[69,.5],[67,.5],[66,1],[62,1],[62,1],[71,1],[71,.5],[72,.5],[71,.5],[69,.5],[67,1],[64,1],[62,.5],[62,.5],[64,1],[69,1],[66,1],[67,3]],ch:[cD7,cG,cC,cA7,cD7,cB7,cEm,cD7,cG]},
 {bpm:116,bpb:4,bells:.8,mel:(()=>{const A=[[74,1.5],[72,.5],[71,1],[69,1],[67,1],[69,1],[71,1],[67,1],[69,.5],[71,.5],[72,.5],[69,.5],[71,1.5],[69,.5],[67,1],[66,1],[67,2]];
   return [...A,...A,[69,1.5],[71,.5],[72,1],[69,1],[71,1.5],[72,.5],[74,1],[69,1],[71,.5],[73,.5],[74,.5],[76,.5],[78,.5],[79,.5],[78,.5],[76,.5],[74,4],...A]})(),ch:[cG,cG,cD7,cG,cG,cG,cD7,cG,cD,cG,cA7,cD,cG,cG,cD7,cG]}];
let mus=null;
function musInit(){if(mus||!ac)return;const out=ac.createGain();out.gain.value=0;const dry=ac.createGain();dry.gain.value=.85;const wet=ac.createGain();wet.gain.value=.5;const conv=ac.createConvolver();
  const len=Math.floor(ac.sampleRate*2.8),ir=ac.createBuffer(2,len,ac.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}conv.buffer=ir;
  const comp=ac.createDynamicsCompressor();out.connect(dry);dry.connect(comp);out.connect(conv);conv.connect(wet);wet.connect(comp);comp.connect(ac.destination);
  mus={out,song:0,start:ac.currentTime+0.3,ev:null,i:0,L:0};loadSong()}
function loadSong(){const S=SONGS[mus.song],b=60/S.bpm,ev=[];let t=0;S.mel.forEach(([n,d])=>{if(n)ev.push({t,k:'l',n,d:d*b});t+=d*b});
  let ct=0;S.ch.forEach(c=>{ev.push({t:ct,k:'c',c,d:S.bpb*b,bpb:S.bpb,b});for(let q=0;q<S.bpb*2;q++)ev.push({t:ct+q*b/2,k:'s',a:q%2===0,v:S.bells});ct+=S.bpb*b});
  ev.sort((x,y)=>x.t-y.t);mus.ev=ev;mus.i=0;mus.L=Math.max(t,ct)}
function vLead(t,n,d){const f=m2f(n),o=ac.createOscillator(),m=ac.createOscillator(),mg=ac.createGain(),g=ac.createGain(),dur=Math.max(0.8,d*1.7);
  o.frequency.value=f;m.frequency.value=f*3.5;mg.gain.setValueAtTime(f*2.4,t);mg.gain.exponentialRampToValueAtTime(f*0.04,t+0.45);m.connect(mg);mg.connect(o.frequency);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.15,t+0.005);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(mus.out);o.start(t);m.start(t);o.stop(t+dur+.05);m.stop(t+dur+.05);
  const s2=ac.createOscillator(),sg=ac.createGain();s2.frequency.value=f*2;sg.gain.setValueAtTime(0,t);sg.gain.linearRampToValueAtTime(0.03,t+0.004);sg.gain.exponentialRampToValueAtTime(0.0001,t+0.6);s2.connect(sg);sg.connect(mus.out);s2.start(t);s2.stop(t+0.65)}
function vChord(t,e){const [r,q]=e.c,iv=q==='m'?[0,3,7]:q==='7'?[0,4,7,10]:[0,4,7],d=e.d,b=e.b;
  const beats=e.bpb===3?[0,1,2]:[0,2];beats.forEach((o,k)=>{const bs=ac.createOscillator(),g=ac.createGain(),tt=t+o*b,len=(e.bpb===3?1:2)*b;bs.frequency.value=m2f(r+(k===0?0:(e.bpb===3?12:7)));g.gain.setValueAtTime(0,tt);g.gain.linearRampToValueAtTime(e.bpb===3&&k?0.06:0.14,tt+0.01);g.gain.exponentialRampToValueAtTime(0.0001,tt+len*0.95);bs.connect(g);g.connect(mus.out);bs.start(tt);bs.stop(tt+len)});
  const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=1300;f.Q.value=0.4;f.connect(mus.out);
  iv.forEach(x=>{[-6,6].forEach(dt=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sawtooth';o.frequency.value=m2f(r+12+x);o.detune.value=dt;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.0075,t+0.35);g.gain.setValueAtTime(0.0075,t+d-0.2);g.gain.linearRampToValueAtTime(0,t+d+0.25);o.connect(g);g.connect(f);o.start(t);o.stop(t+d+0.3)})})}
function vSleigh(t,acc,v){const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain(),tr=ac.createOscillator(),tg=ac.createGain();s.buffer=nb();f.type='bandpass';f.frequency.value=8200;f.Q.value=0.9;
  tr.frequency.value=34;tg.gain.value=0.5;tr.connect(tg);const amp=ac.createGain();amp.gain.value=0.5;tg.connect(amp.gain);
  g.gain.setValueAtTime((acc?0.09:0.05)*v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);s.connect(f);f.connect(amp);amp.connect(g);g.connect(mus.out);s.start(t,Math.random()*.5,0.18);tr.start(t);tr.stop(t+0.2)}
function musicTick(){if(!ac)return;if(!mus){if(!music)return;musInit();if(!mus)return}
  mus.out.gain.setTargetAtTime(music?0.55:0,ac.currentTime,0.4);
  if(!music){mus.start=ac.currentTime+0.5;mus.i=0;return}
  if(mus.start<ac.currentTime-0.5&&mus.i===0)mus.start=ac.currentTime+0.1;
  const hor=ac.currentTime+0.3;
  while(mus.i<mus.ev.length&&mus.start+mus.ev[mus.i].t<hor){const e=mus.ev[mus.i++],t=Math.max(ac.currentTime,mus.start+e.t);if(e.k==='l')vLead(t,e.n,e.d);else if(e.k==='c')vChord(t,e);else vSleigh(t,e.a,e.v)}
  if(mus.i>=mus.ev.length){mus.start+=mus.L+1.2;mus.song=(mus.song+1)%SONGS.length;loadSong()}}
setInterval(musicTick,60);
const setTog=()=>{$('bMusic').classList.toggle('off',!music);$('bSfx').classList.toggle('off',!sfx);$('bMusic').setAttribute('aria-pressed',music);$('bSfx').setAttribute('aria-pressed',sfx)};setTog();
$('bMusic').onclick=()=>{music=!music;store.set('advx-music',music?'1':'0');setTog();au()};
$('bSfx').onclick=()=>{sfx=!sfx;store.set('advx-sfx',sfx?'1':'0');setTog();au()};
addEventListener('pointerdown',au,{passive:true});addEventListener('keydown',au);

/* ================= simulación: el tren reparte ================= */
const flyers=[],flyQ=[];let burstBudget=0,noneT=0;
function flyGift(from,to,dur,arc,onEnd){let f=flyers.find(x=>!x.visible);if(!f){if(flyers.length>=16){onEnd&&onEnd();return}f=obj(['presB','presC','presD','presA'][flyers.length%4],1.2);f.castShadow=false;scene.add(f);flyers.push(f)}
  f.visible=true;f.position.copy(from);flyQ.push({f,from:from.clone(),to:to.clone(),t:0,dur,arc,onEnd})}
function atStation(){laps++;for(let k=1;k<cars.length;k++)fillWagon(cars[k],true,(k-1)*0.06);
  if(FASTSTEP||!STN)return;STN.hop=1;loadS();
  for(let q=1;q<Math.min(cars.length,4);q++){const W=cars[q];flyGift(STN.pileWorld,W.localToWorld(tmpV.set(0,W.userData.top+1,0)),0.5,4)}}
function atHouse(i){const h=HS[i];if(!h)return;let W=null;for(let k=cars.length-1;k>0;k--)if(cars[k].userData.c>0){W=cars[k];break}
  if(!W){starve++;if(!FASTSTEP&&noneT<=0){noneT=1.4;floatAt(h.chim,'sin regalo','none')}return}
  W.userData.c--;const gv=W.userData.gv[W.userData.c];gv.vis=false;
  const val=valueOf(st)*FAST;st.coins+=val;st.total+=val;st.gifts++;delivered++;
  if(FASTSTEP)return;
  W.localToWorld(tmpV.set(gv.x,gv.y,gv.z));const to=h.chim.clone();to.y+=0.4;
  flyGift(tmpV,to,0.6,6,()=>{puff(tmpV2.copy(h.chim).setY(h.chim.y+1.2),new THREE.Vector3(0,3,0),2.2,.42,1.2);if(burstBudget>0){burstBudget--;burst(h.chim,24,5,[4,3,.8])}floatAt(h.chim,'+'+fmtN(val),'');chime()})}
function sim(dt){
  if(busy||!T)return;
  const target=speedOf(st)*(boostT>0?ECO.boostK:1);vCur+=(target-vCur)*(1-Math.exp(-2.2*dt));
  if(boostT>0)boostT-=dt;if(boostCD>0)boostCD-=dt;
  const prev=dist;dist+=vCur*dt;const L=T.L;
  if(Math.floor(prev/L)!==Math.floor(dist/L))atStation();
  for(let i=0;i<HS.length;i++){const e=SL[i].s;if(Math.floor((prev-e)/L)!==Math.floor((dist-e)/L))atHouse(i)}
  if(dist>L*1e6)dist-=L*1e6;
  spinWheels(vCur*dt);poseTrain(dist);
  saveT+=dt;if(saveT>5){saveT=0;save()}
}
function boost(){if(!ready||boostCD>0)return false;boostT=ECO.boostT;boostCD=ECO.boostCD;whistle();grade.uniforms.flash.value=0.1;store.set('advx-idle-silbato','1');
  const L=cars[0];[-1,1].forEach(sd=>puff(L.localToWorld(tmpV.set(-2,0.8,sd*1.8)),new THREE.Vector3(-3,1.2,sd*2).applyEuler(L.rotation),2.2,.4,1.1));return true}

/* ================= cámara: órbita alrededor de la maqueta o detrás del tren ================= */
const cam={az:0.35,el:0.6,d:120,dT:120,vaz:0,vel:0,follow:false};
const camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),wantP=new THREE.Vector3(),wantL=new THREE.Vector3();
const ptrs=new Map();let pinch0=0,lastInput=-1e9;
const clampD=d=>clamp(d,MATR*0.45,MATR*2.6),defD=()=>MATR*1.8*Math.max(1,1.15/camera.aspect)**0.8;
canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y)}cam.vaz=cam.vel=0;lastInput=performance.now()});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;lastInput=performance.now();
  if(ptrs.size===1){const k=coarse?0.008:0.006;cam.az-=dx*k;cam.el=clamp(cam.el+dy*0.005,0.14,1.25);cam.vaz=-dx*k*30;cam.vel=dy*0.005*30}
  else if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0>0&&d>0)cam.dT=clampD(cam.dT*pinch0/d);pinch0=d}});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>canvas.addEventListener(ev,e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch0=0}));
canvas.addEventListener('wheel',e=>{e.preventDefault();cam.dT=clampD(cam.dT*Math.exp(e.deltaY*0.0011));lastInput=performance.now()},{passive:false});
function updateCam(dt){
  const idle=(performance.now()-lastInput)/1000;
  if(!ptrs.size){cam.az+=cam.vaz*dt;cam.el=clamp(cam.el+cam.vel*dt,0.14,1.25);cam.vaz*=Math.exp(-5*dt);cam.vel*=Math.exp(-5*dt)}
  if(idle>5&&!REDUCED)cam.az+=dt*0.03;
  cam.d=lerp(cam.d,cam.dT,1-Math.exp(-4*dt));
  let k=12;
  if(cam.follow&&cars[0]){const L=cars[0],fw=tmpV2.set(1,0,0).applyAxisAngle(THREE.Object3D.DEFAULT_UP,L.rotation.y);wantP.set(L.position.x-fw.x*22-fw.z*9,11,L.position.z-fw.z*22+fw.x*9);wantL.set(L.position.x+fw.x*12,2,L.position.z+fw.z*12);k=4}
  else{const ce=Math.cos(cam.el);wantP.set(Math.cos(cam.az)*cam.d*ce,Math.sin(cam.el)*cam.d+2,Math.sin(cam.az)*cam.d*ce);wantL.set(0,7,0);if(camK<12){camK=Math.min(12,camK+dt*6);k=camK}}
  camPos.lerp(wantP,1-Math.exp(-k*dt));camLook.lerp(wantL,1-Math.exp(-k*dt));camera.position.copy(camPos);camera.lookAt(camLook);
  grade.uniforms.tilt.value=lerp(grade.uniforms.tilt.value,coarse||cam.follow?0:0.85,1-Math.exp(-3*dt));grade.uniforms.focus.value=0.5;
}
let camK=12;
function setFollow(on){cam.follow=on;camK=on?4:3;$('bCam').classList.toggle('on',on);$('bCam').setAttribute('aria-pressed',on);$('bCam').title=on?'Ver la maqueta (C)':'Seguir al tren (C)'}
function snapCam(){cam.d=cam.dT;updateCam(0);const ce=Math.cos(cam.el);camPos.set(Math.cos(cam.az)*cam.d*ce,Math.sin(cam.el)*cam.d+2,Math.sin(cam.az)*cam.d*ce);camLook.set(0,7,0);camera.position.copy(camPos);camera.lookAt(camLook)}

/* ================= interfaz ================= */
const ICON={
  casa:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
  vagon:'<rect x="2.5" y="12.5" width="19" height="3.5" rx="1"/><circle cx="7" cy="18.6" r="1.7"/><circle cx="17" cy="18.6" r="1.7"/><rect x="6" y="6.5" width="5.5" height="6" rx=".8"/><rect x="13" y="8.5" width="4.5" height="4" rx=".8"/><path d="M8.75 6.5v6"/>',
  loco:'<path d="M3 17.5V8.5h7v9"/><path d="M10 12h10v5.5H3"/><path d="M14 12V7.5h3V12"/><path d="M5 8.5V5.5h3v3"/><circle cx="7" cy="19.3" r="1.7"/><circle cx="16" cy="19.3" r="1.7"/>',
  luces:'<path d="M2 5.5c6 4.5 14 4.5 20 0"/><path d="M6.5 8.4v1.6M12 9.9v1.6M17.5 8.4v1.6"/><path d="M5.2 10h2.6l-.3 3.3a1 1 0 0 1-2 0zM10.7 11.5h2.6l-.3 3.3a1 1 0 0 1-2 0zM16.2 10h2.6l-.3 3.3a1 1 0 0 1-2 0z"/>',
  via:'<path d="M8.5 3 5 21M15.5 3 19 21"/><path d="M6.6 7h10.8M5.9 12h12.2M5.1 17h13.8"/>',
};
const SHOP=[
  {k:'casa',n:'Casa',fx:s=>maxed(s,'casa')?'Vía llena: amplíala':`+${fmtN(valueOf(s)*FAST)} por vuelta`,lv:s=>`${s.houses}/${slotsOf(s.stage).length}`},
  {k:'vagon',n:'Vagón',flag:'¡Faltan!',fx:s=>maxed(s,'vagon')?'Tren completo':`+${ECO.cap} regalos de carga`,lv:s=>`${s.wagons}/${ECO.wagonMax}`},
  {k:'loco',n:'Máquina',fx:s=>maxed(s,'loco')?'A toda máquina':`${kmh(s)} → ${kmh({...s,loco:s.loco+1})} km/h`,lv:s=>`${s.loco}/${ECO.locoMax}`},
  {k:'luces',n:'Luces',fx:s=>`×${NF1.format(ECO.lightK)} cada regalo`+(['',' · guirnaldas',' · farolas',' · arcos'][s.lights+1]||''),lv:s=>`${s.lights}`},
  {k:'via',n:'Más vía',flag:'¡Llena!',fx:s=>maxed(s,'via')?'Vía completa':`${slotsOf(s.stage+1).length} huecos · ×${ECO.stageK} cada regalo`,lv:s=>`${s.stage+1}/${STAGES.length}`},
];
const coinSvg='<svg class="coin" viewBox="0 0 32 32" aria-hidden="true"><use href="#coinS"/></svg>';
const shopEls={};
function buildShop(){const el=$('shop');el.innerHTML=SHOP.map((it,i)=>`<button class="it" data-k="${it.k}" title="${it.n} (${i+1})"><span class="fill"></span><span class="flag">${it.flag||''}</span><span class="lv mono"></span><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[it.k]}</svg></span><span class="nm">${it.n}</span><span class="fx"></span><span class="pr mono">${coinSvg}<b></b></span></button>`).join('');
  el.querySelectorAll('.it').forEach(b=>{b.onclick=()=>tryBuy(b.dataset.k);shopEls[b.dataset.k]={b,fill:b.querySelector('.fill'),lv:b.querySelector('.lv'),fx:b.querySelector('.fx'),pr:b.querySelector('.pr b'),c:{}}})}
const setTxt=(E,k,el,v)=>{if(E.c[k]!==v){E.c[k]=v;el.textContent=v}};
function uiShop(){for(const it of SHOP){const E=shopEls[it.k];if(!E)continue;const mx=maxed(st,it.k),cost=ITEMS[it.k].cost(st),ok=!mx&&st.coins>=cost;
  const hot=(it.k==='vagon'&&st.houses>capOf(st)&&!mx)||(it.k==='via'&&maxed(st,'casa')&&!mx);
  const cls='it'+(mx?' max':ok?' ok':' no')+(hot?' hot':'');if(E.c.cls!==cls){E.c.cls=cls;E.b.className=cls;E.b.setAttribute('aria-disabled',!ok)}
  setTxt(E,'pr',E.pr,mx?'—':fmtN(cost));setTxt(E,'fx',E.fx,it.fx(st));setTxt(E,'lv',E.lv,it.lv(st));
  const f=mx?0:Math.min(1,st.coins/cost),fr=Math.round(f*200)/200;if(E.c.f!==fr){E.c.f=fr;E.fill.style.transform=`scaleX(${fr})`}
  const al=`${it.n}: ${it.fx(st)}. ${mx?'Completo':'Cuesta '+fmtN(cost)+' monedas'}`;if(E.c.al!==al){E.c.al=al;E.b.setAttribute('aria-label',al)}}}
function tryBuy(k){au();if(!ready||busy)return;const E=shopEls[k];
  if(!canBuy(st,k)){nope();if(E&&!maxed(st,k))E.b.querySelector('.pr').animate([{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}],{duration:220,easing:'ease-out'});return}
  buy(st,k);onBought(k);save();uiShop();uiTip(true)}
function onBought(k){if(!FASTSTEP)kaching();
  if(k==='casa')addHouse();
  else if(k==='vagon')addWagon();
  else if(k==='loco'){if(!FASTSTEP){const L=cars[0];spark(L.position.clone().setY(1),30,10);puff(L.localToWorld(tmpV.copy(L.userData.chimney)),new THREE.Vector3(0,6,0),2.4,.5,1.6)}}
  else if(k==='luces'){buildDeco();if(!FASTSTEP&&treeParts){grade.uniforms.flash.value=0.15;burst(treeParts.top,120,10,[4,3,1])}}
  else if(k==='via')expand()}
async function expand(){busy=true;if(!FASTSTEP){grade.uniforms.flash.value=0.45;bells()}
  await buildWorld(st.stage);buildDeco();placeTown(true);dist=2;vCur*=0.5;cars.slice(1).forEach(W=>fillWagon(W,true));poseTrain(dist);
  cam.dT=defD();if(!FASTSTEP&&treeParts){confettiBurst(treeParts.top.clone().setY(30),30);for(let i=0;i<6;i++)fwQ.push({at:performance.now()/1000+0.3+i*0.35,p:new THREE.Vector3((Math.random()-.5)*60,60+Math.random()*30,(Math.random()-.5)*60)})}
  busy=false;uiShop()}
/* números que salen de las chimeneas */
const FL=[];let flI=0;
function floatAt(p,text,cls){if(FASTSTEP)return;tmpV.copy(p);tmpV.y+=2.5;tmpV.project(camera);if(tmpV.z>1||Math.abs(tmpV.x)>1.1||Math.abs(tmpV.y)>1.1)return;
  let e=FL[flI];if(!e){e=document.createElement('div');e.className='fl';e.innerHTML='<span></span>';$('floats').appendChild(e);FL[flI]=e}flI=(flI+1)%14;
  e.className='fl'+(cls?' '+cls:'');e.style.transform=`translate(${((tmpV.x*.5+.5)*innerWidth).toFixed(1)}px,${((-tmpV.y*.5+.5)*innerHeight).toFixed(1)}px)`;const s=e.firstChild;s.textContent=text;
  s.getAnimations().forEach(a=>a.cancel());
  s.animate(REDUCED?[{opacity:0},{opacity:1,offset:.2},{opacity:0}]:[{opacity:0,transform:'translate(-50%,-20%) scale(.9)'},{opacity:1,offset:.18,transform:'translate(-50%,-90%) scale(1)'},{opacity:0,transform:'translate(-50%,-260%) scale(1)'}],{duration:1100,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'})}
/* contador */
let dispCoins=st.coins,lastRate='';
function uiBank(dt){dispCoins=Math.abs(st.coins-dispCoins)<1?st.coins:lerp(dispCoins,st.coins,1-Math.exp(-10*dt));const t=fmtN(dispCoins);if($('coins').textContent!==t)$('coins').textContent=t;
  const r='+'+fmtRate(rateOf(st)*FAST)+' / s';if(r!==lastRate){lastRate=r;$('rate').textContent=r}}
/* consejo del momento */
let tipTxt=null,tipT=0;
function uiTip(force){if(!force&&(tipT-=1)>0)return;tipT=15;const cap=capOf(st),slots=slotsOf(st.stage).length;let t='';
  if(st.houses>cap)t=`${st.houses-cap===1?'Una casa se queda':st.houses-cap+' casas se quedan'} sin regalo: compra un vagón.`;
  else if(st.houses>=slots&&!maxed(st,'via'))t='La vía está llena: amplíala para que quepan más casas.';
  else if(st.total<40)t='El tren reparte regalos a las casas: cada uno da monedas de chocolate. ¡Compra casas!';
  else if(!store.get('advx-idle-silbato')&&boostCD<=0)t=coarse?'Toca el silbato para que el tren corra más.':'Toca el silbato (o pulsa Espacio) para que el tren corra más.';
  if(t!==tipTxt){tipTxt=t;const el=$('tip');if(t){el.textContent=t;el.classList.remove('hide')}else el.classList.add('hide')}}
/* silbato */
const RING=2*Math.PI*33;let lastRing=-1;
function uiBoost(){const f=boostCD>0?1-boostCD/ECO.boostCD:1,q=Math.round(f*100);if(q===lastRing)return;lastRing=q;const b=$('boost');b.querySelector('.ring circle').style.strokeDashoffset=(RING*(1-f)).toFixed(1);b.classList.toggle('wait',boostCD>0);b.setAttribute('aria-disabled',boostCD>0)}
/* ganancias sin conexión */
let awayG=null;
function showAway(g){awayG=g;$('awTime').textContent=fmtDur(g.sec);$('awCoins').textContent='+'+fmtN(g.coins*FAST);$('awGifts').textContent=`Tu tren ha repartido ${NF.format(g.gifts)} regalo${g.gifts===1?'':'s'} mientras no estabas.`;$('away').classList.add('on');setTimeout(()=>$('awOk').focus(),50)}
$('awOk').onclick=()=>{if(!awayG)return;const g=awayG;awayG=null;st.coins+=g.coins*FAST;st.total+=g.coins*FAST;st.gifts+=g.gifts;save();$('away').classList.remove('on');kaching();if(treeParts)burst(treeParts.top,160,12,[4,3,.8]);uiShop()};
$('boost').onclick=()=>{au();boost();uiTip(true)};
$('bCam').onclick=()=>{au();setFollow(!cam.follow)};
addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||$('away').classList.contains('on'))return;const i='12345'.indexOf(e.key);
  if(i>=0){tryBuy(SHOP[i].k);return}if(e.code==='Space'){e.preventDefault();boost();uiTip(true)}else if(e.key==='c'||e.key==='C')setFollow(!cam.follow)});
new ResizeObserver(()=>document.documentElement.style.setProperty('--shop-h',$('shop').offsetHeight+'px')).observe($('shop'));
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();if(ready)save()}else if(hiddenAt&&ready){const g=offlineGain({...st,t:hiddenAt});hiddenAt=0;if(g.sec>=60&&g.coins>0&&!awayG)showAway(g)}});
addEventListener('pagehide',()=>{if(ready)save()});

/* ================= bucle ================= */
let last=performance.now(),fA=0,fN=0,lastAdj=0;
function fx(dt,t){
  const L=cars[0];if(!L)return;
  const ch=L.localToWorld(tmpV.copy(L.userData.chimney)),bo=boostT>0;smokeAcc+=dt*(1.5+vCur*0.28)*(bo?1.8:1);
  while(smokeAcc>1){smokeAcc-=1;puff(ch,tmpV2.set((Math.random()-.5)*0.8,(bo?6:4.2)+Math.random(),(Math.random()-.5)*0.8),bo?1.5:1,.26,1.7)}
  if(bo&&Math.random()<0.4)spark(tmpV.set(L.position.x,0.5,L.position.z),2,7);
  smoke.forEach(p=>{if(p.life<=0)return;p.life-=dt/(p.ml||1.7);if(p.life<=0){p.s.visible=false;return}p.s.position.addScaledVector(p.v,dt);p.v.multiplyScalar(Math.exp(-0.6*dt));p.sz+=dt*1.7;p.s.scale.setScalar(p.sz);p.s.material.opacity=p.life*p.op});
  for(let i=0;i<SPK;i++){const s=spk[i];if(s.life<=0){spkP[i*3+1]=-99;continue}s.life-=dt;s.v.y-=18*dt;spkP[i*3]+=s.v.x*dt;spkP[i*3+1]+=s.v.y*dt;spkP[i*3+2]+=s.v.z*dt}spkG.attributes.position.needsUpdate=true;
  snowU.px.value=renderer.getPixelRatio();snowU.t.value=t;
  const cp=camera.position;for(let i=0;i<SN;i++){let y=snowP[i*3+1]-dt*(0.8+(i%5)*0.15);if(y<cp.y-25)y+=70;if(y>cp.y+45)y-=70;snowP[i*3+1]=y;let x=snowP[i*3]+Math.sin(t*0.6+i)*dt*0.4;if(x-cp.x>80)x-=160;if(x-cp.x<-80)x+=160;snowP[i*3]=x;let z=snowP[i*3+2];if(z-cp.z>80)z-=160;if(z-cp.z<-80)z+=160;snowP[i*3+2]=z}
  snowG.attributes.position.needsUpdate=true;
  if(treeParts){treeParts.phases.forEach((m,i)=>m.material.color.setScalar(treeLightK*(0.45+0.55*Math.max(0,Math.sin(t*2.2+i*2.1)))));treeParts.star.rotation.y=t*0.6;treeParts.glow.material.opacity=0.45+treeLightK*0.15+Math.sin(t*2.2)*0.08}
  arches.forEach((a,k)=>a.forEach((m,i)=>m.material.color.setScalar((Math.floor(t*2.5+k)+i)%2?1:0.25)));
  eaveLights.forEach((m,i)=>m.material.color.setScalar(0.5+0.5*Math.max(0,Math.sin(t*1.6+i*3.1))));
  if(fireU){fireU.t.value=t;warmFill.intensity=0.42+Math.sin(t*7)*0.05+Math.sin(t*13.7)*0.04}
  const tp=L.position;
  if(STN){if(STN.hop>0){STN.hop=Math.max(0,STN.hop-dt*1.5);STN.pile.position.y=Math.abs(Math.sin(STN.hop*Math.PI*3))*1.2*STN.hop}const d=Math.hypot(STN.x-tp.x,STN.z-tp.z);STN.nut.rotation.y=STN.base+(d<30?Math.sin(t*6)*0.35:0)}
  anims.forEach(a=>{const o=a.o;if(a.k==='deer'){o.rotation.y=a.base+Math.sin(t*0.6+a.ph)*0.35;o.rotation.x=Math.max(0,Math.sin(t*0.9+a.ph))*0.12}
    else if(a.k==='snowman'){o.rotation.z=Math.sin(t*1.4+a.ph)*0.06}
    else if(a.k==='ginger'){o.getWorldPosition(tmpV);const d=tmpV.distanceTo(tp);const hop=d<28?Math.abs(Math.sin(t*9+a.ph))*1.3:0;o.position.y=a.y+hop;o.rotation.z=d<28?Math.sin(t*9+a.ph)*0.25:0}
    else if(a.k==='flake'){o.rotation.y+=dt*0.4;o.rotation.x=Math.sin(t*0.5+a.ph)*0.3;o.position.y=a.y+Math.sin(t*0.7+a.ph)*2}});
  // regalos volando (taller → vagón, vagón → chimenea)
  for(let k=flyQ.length-1;k>=0;k--){const q=flyQ[k];q.t+=dt/q.dur;const e=Math.min(1,q.t);q.f.position.lerpVectors(q.from,q.to,e);q.f.position.y+=Math.sin(e*Math.PI)*q.arc;q.f.rotation.y+=dt*8;if(q.t>=1){q.f.visible=false;flyQ.splice(k,1);q.onEnd&&q.onEnd()}}
  // regalos que aparecen en los vagones
  for(let k=giftQ.length-1;k>=0;k--){const q=giftQ[k];q.t+=dt;if(q.t<0)continue;const g=q.g;g.vis=true;const p=Math.min(1,q.t/0.32),el=1+Math.sin(p*Math.PI*2.2)*(1-p)*0.35;g.sc=Math.max(0.05,(0.6+0.4*p)*el);if(p>=1){g.sc=1;giftQ.splice(k,1)}}
  // vagones nuevos
  for(let i=1;i<cars.length;i++){const W=cars[i];if(W.userData.pop===undefined||W.userData.pop>=1)continue;W.userData.pop=Math.min(1,W.userData.pop+dt/0.45);const p=W.userData.pop;W.scale.setScalar((0.6+0.4*(1-Math.pow(1-p,3)))*(1+Math.sin(p*Math.PI*2)*(1-p)*0.12));if(p===1){W.scale.setScalar(1);puff(W.position.clone().setY(1.5),new THREE.Vector3(0,2,0),3,.4,1.2)}}
  // casas que aparecen: caen un poco con rebote y luego se unen al resto
  for(let k=popQ.length-1;k>=0;k--){const h=popQ[k];h.pop+=dt/0.55;if(h.pop<0)continue;h.g.visible=true;const p=Math.min(1,h.pop),e=1-Math.pow(1-p,3);h.g.scale.setScalar(lerp(0.55,1,e)+Math.sin(p*Math.PI*2)*(1-p)*0.16);h.g.position.y=(1-e)*5;
    if(!h.landed&&p>0.5){h.landed=true;puff(tmpV.set(h.g.position.x,1,h.g.position.z),new THREE.Vector3(0,1.5,0),5,.45,1.3);if(burstBudget>0){burstBudget--;burst(h.chim,30,6,[3,3,3.4])}}
    if(p>=1){h.g.scale.setScalar(1);h.g.position.y=0;h.g.updateMatrixWorld(true);popQ.splice(k,1);needBatch=true}}
  if(needBatch&&!popQ.length){needBatch=false;rebatch()}
  fireworks.visible=true;
  if(fwQ.length&&fwQ[0].at<=t){const q=fwQ.shift();burst(q.p);noise(0.5,0.2,500)}
  let fwa=false;for(let i=0;i<FWN;i++){const p=fw[i];if(p.l<=0)continue;fwa=true;p.l-=dt;p.v.multiplyScalar(Math.exp(-1.4*dt));p.v.y-=6*dt;fwP[i*3]+=p.v.x*dt;fwP[i*3+1]+=p.v.y*dt;fwP[i*3+2]+=p.v.z*dt;if(p.l<=0)fwP[i*3+1]=-999;fwC[i*3]*=0.985;fwC[i*3+1]*=0.985;fwC[i*3+2]*=0.985}
  if(fwa){fwG.attributes.position.needsUpdate=true;fwG.attributes.color.needsUpdate=true}
  let cfa=false;for(let i=0;i<CFN;i++){const p=cf[i];if(p.l<=0)continue;cfa=true;p.l-=dt;p.v.y-=9*dt;p.v.x*=Math.exp(-1.5*dt);p.v.z*=Math.exp(-1.5*dt);if(p.v.y<-3)p.v.y=-3;cfP[i*3]+=(p.v.x+Math.sin(t*4+p.ph)*1.5)*dt;cfP[i*3+1]+=p.v.y*dt;cfP[i*3+2]+=(p.v.z+Math.cos(t*4+p.ph)*1.5)*dt;if(cfP[i*3+1]<0.4)cfP[i*3+1]=0.4;if(p.l<=0)cfP[i*3+1]=-999}
  if(cfa)cfG.attributes.position.needsUpdate=true;
  {const cp2=camera.position,ca=Math.atan2(cp2.z,cp2.x),cr=Math.hypot(cp2.x,cp2.z),k=1-Math.exp(-6*dt);
   for(const G of GIANTS){const want=cr>G.r*0.75?1-0.97*(1-sstep(0.32,0.62,Math.abs(wrapA(G.a-ca)))):1;if(Math.abs(want-G.op)<0.003)continue;
     G.op=lerp(G.op,want,k);G.mats.forEach(m=>{m.opacity=G.op;m.depthWrite=G.op>0.98});G.o.visible=G.op>0.04;const sh=G.op>0.5;if(G.sh!==sh){G.sh=sh;G.o.traverse(c=>{if(c.isMesh)c.castShadow=sh})}}}
  grade.uniforms.flash.value*=Math.exp(-5*dt);grade.uniforms.t.value=t;
  burstBudget=Math.min(3,burstBudget+dt*2);if(noneT>0)noneT-=dt;
  if(beam)beam.visible=!cam.follow;
}
/* resolución adaptativa; en el móvil, 30 fps salvo mientras tocas la pantalla */
let slowN=0;
function adapt(raw,now,cap){if(raw>0.2||document.hidden)return;// tirones (carga, pestaña oculta) no cuentan: no son la GPU
  fA+=raw;fN++;if(now-lastAdj<1500||fN<30)return;const avg=fA/fN;fA=0;fN=0;lastAdj=now;const tgt=cap?1/30:1/60;
  // si va justo: primero baja la resolución hasta 1,25×, luego quita sombras, luego baja a 1× y por último el bloom; nunca por debajo de 1×
  if(avg>tgt*1.25){const floor=renderer.shadowMap.enabled?Math.max(MINPR,1.25):MINPR;
    if(dynPR>floor){dynPR=Math.max(floor,+(dynPR-0.15).toFixed(2));resize()}
    else if(++slowN>=3&&renderer.shadowMap.enabled){renderer.shadowMap.enabled=false;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true})}// solo si sigue lento varios segundos
    else if(slowN>=6&&bloom.enabled&&avg>tgt*1.5)bloom.enabled=false}
  else{slowN=0;if(!cap&&avg<tgt*1.05&&dynPR<MAXPR){dynPR=Math.min(MAXPR,+(dynPR+0.1).toFixed(2));resize()}}}
let uiAcc=0;
function loop(now){requestAnimationFrame(loop);
  const cap=coarse&&!ptrs.size&&now-lastInput>1500,raw=(now-last)/1000;if(cap&&raw<1/32)return;
  last=now;const dt=Math.min(0.05,raw),t=now/1000;
  if(!ready)return;
  {let simT=Math.min(raw,1);while(simT>1e-4){const h=Math.min(0.05,simT);sim(h);simT-=h}}
  fx(dt,t);trainInst();updateCam(dt);uiBank(dt);uiBoost();
  uiAcc+=dt;if(uiAcc>0.1){uiAcc=0;uiShop();uiTip()}
  if(dbg)renderer.info.reset();composer.render(dt);dbgFrame(raw);
  if(!window.__idleNoAdapt)adapt(raw,now,cap);
}
function perf(n=120,pr=1){const ip=dynPR,ar=renderer.info.autoReset;dynPR=pr;resize();renderer.info.autoReset=false;const gl=renderer.getContext(),px=new Uint8Array(4),sync=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
  for(let i=0;i<3;i++){composer.render(1/60);sync()}renderer.info.reset();composer.render(1/60);sync();const calls=renderer.info.render.calls,tris=renderer.info.render.triangles;
  const t0=performance.now();for(let i=0;i<n;i++){renderer.info.reset();composer.render(1/60);sync()}const ms=(performance.now()-t0)/n;
  renderer.info.autoReset=ar;dynPR=ip;resize();return {ms:+ms.toFixed(2),calls,tris,tex:renderer.info.memory.textures,geo:renderer.info.memory.geometries,pr,w:innerWidth,h:innerHeight}}

/* ================= arranque ================= */
function prog(p,txt){$('lBar').style.transform=`scaleX(${(p/100).toFixed(3)})`;if(txt)$('lTxt').textContent=txt}
async function boot(){
  buildShop();uiShop();uiBank(1);
  prog(4,'Sacando los juguetes de la caja…');
  await loadModels(p=>prog(4+p*62));
  buildTrain(st.wagons);
  prog(70,'Montando el salón…');await tick();
  buildRoom();buildFurniture();loadEnv();
  prog(82,'Montando la maqueta…');await tick();
  await buildWorld(st.stage);buildDeco();placeTown(false);
  cars.slice(1).forEach(W=>fillWagon(W,false));poseTrain(dist);vCur=speedOf(st);
  cam.dT=defD();snapCam();trainInst();
  prog(100,'');ready=true;$('load').classList.add('done');uiShop();uiTip(true);
  if(away0.sec>=60&&away0.coins>0)setTimeout(()=>{if(!awayG)showAway(away0)},480);// tras el fundido de la carga
  save();
}
boot().catch(e=>{console.error(e);const el=$('err');el.textContent='No se ha podido montar la maqueta. Recarga la página.';el.style.display='block'});
requestAnimationFrame(loop);

/* gancho para las pruebas automáticas */
window.__idle={get st(){return st},get ready(){return ready},get busy(){return busy},
  step(sec){FASTSTEP=true;try{let n=Math.ceil(sec/0.05);while(n-->0)sim(0.05)}finally{FASTSTEP=false}},
  buy:k=>{if(!canBuy(st,k))return false;buy(st,k);onBought(k);uiShop();uiTip(true);return true},
  give:c=>{st.coins+=c},rate:()=>rateOf(st)*FAST,save,offline:sec=>{saveOff=true;st.t=Date.now()-sec*1000;store.set(SAVE_KEY,JSON.stringify(st))},
  houses:()=>HS.length,wagons:()=>cars.length-1,cargo:()=>cars.slice(1).reduce((n,c)=>n+c.userData.c,0),delivered:()=>delivered,starve:()=>starve,laps:()=>laps,
  tip:()=>tipTxt,away:()=>$('away').classList.contains('on'),boost,follow:setFollow,perf,get scene(){return scene},
  settle:()=>{cam.d=cam.dT;snapCam()},look:(az,el,d)=>{cam.az=az;cam.el=el;cam.dT=cam.d=d||defD();lastInput=performance.now()+1e9;snapCam()}};
