/* El tren de Navidad · prototipo comunitario (nombre provisional).
   Un solo tren para todo el mundo recorre una maqueta alpina (tren-map.js): pueblo con plaza, colina con túnel,
   lago helado, montaña del túnel grande y estación de esquí con telesilla. Cada jugador manda regalos a sus amigos por
   el tren: viajan en el vagón de regalos hasta su casa y al amigo le llega un enlace para verlo llegar (y devolverlo).
   Los regalos de todos suman al objetivo común del día; al cumplirlo la vía crece, llega otro vagón o más luces. Cada jugador puede poner su casa junto a la vía, y los furgones llevan marcas o mensajes
   con enlace: el primero se subasta cada día y el resto se venden. En la demo los demás jugadores están simulados
   (tren-eco.js). El motor, el salón y las casas vienen de idle.js; si este enfoque se queda, toca sacarlos a un módulo común. */
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
import {rng, wrapA} from './sim.js';
import {mapOf, atM, kindAt, F, BOARD, GAUGE as GA, KT, KB, LAKE_Y, pisteD, lakeE, TRAIN_V, STAGE_NAMES, nearTrack, otherNear, branchNear} from './tren-map.js';
import {TKEY, DAYS, CLOSE_H, MSG_PRICE, BIZ, NAMES, CAP, WAGON_MAX, newWorld, parseWorld, sacoOf, addVotes, nextDay, online, crowdVotes, newPoll, crowdVote, castVote, votesOf, winnerOf, drawDriver, closeAt, showDay, minBid, cleanText, cleanUrl} from './tren-eco.js';
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
const QS=new URLSearchParams(location.search),DEBUG=QS.has('debug');
if(QS.has('reiniciar')){store.del(TKEY);store.del('advx-tren-subasta');store.del('advx-tren-marca');QS.delete('reiniciar');try{history.replaceState(null,'',location.pathname+(QS.toString()?'?'+QS:''))}catch(e){}}
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const NF=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}),NF1=new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}),NF3=new Intl.NumberFormat('es-ES',{minimumSignificantDigits:3,maximumSignificantDigits:3});
const SUF=[[1e15,'mil B'],[1e12,'B'],[1e9,'mil M'],[1e6,'M']];
const fmtN=x=>{x=Math.floor(Math.max(0,x));for(const [v,s] of SUF)if(x>=v)return NF3.format(x/v)+' '+s;return NF.format(x)};
const fmtRate=r=>r<10?NF1.format(r):fmtN(r);
const fmtDur=s=>{if(s<90)return Math.round(s)+' s';if(s<3600)return Math.round(s/60)+' min';const h=Math.floor(s/3600),m=Math.round(s%3600/60);return h+' h'+(m?' '+m+' min':'')};

/* ================= estado ================= */
let st=parseWorld(store.get(TKEY))||newWorld();
let ready=false,busy=false,FASTSTEP=false;
let dist=2,vCur=TRAIN_V,laps=0,delivered=0,starve=0,saveT=0,simClock=0;
function save(){st.t=Date.now();store.set(TKEY,JSON.stringify(st))}

/* ================= motor ================= */
const coarse=matchMedia('(pointer:coarse)').matches;
const canvas=$('c');
// móvil (o ?movil): render directo con el MSAA nativo del navegador, sin sombras ni posprocesado; es lo que más cuesta en un móvil
const LOWQ=coarse||QS.has('movil');document.body.classList.toggle('lowq',LOWQ);
const renderer=new THREE.WebGLRenderer({canvas,antialias:LOWQ,powerPreference:'high-performance',stencil:false});
// sin dientes de sierra: MSAA ×4 también en el móvil (en GPUs de teselas es casi gratis) y nunca por debajo de 1× la resolución CSS
const MAXPR=Math.min(devicePixelRatio||1,2),MINPR=Math.min(1,MAXPR);let dynPR=Math.min(coarse?1.5:1.75,MAXPR);
renderer.setPixelRatio(dynPR);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=!LOWQ;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#0b0809');scene.fog=new THREE.FogExp2('#120d0d',0.0008);
const camera=new THREE.PerspectiveCamera(42,1,0.5,5000);
{const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;void main(){vec3 c=mix(vec3(.16,.11,.09),vec3(.04,.04,.07),smoothstep(-.3,.6,vP.y));gl_FragColor=vec4(c,1.);}'})));
 [[-30,6,0,[9,4,1.4],7],[20,10,-20,[5,3.6,1.6],4],[0,30,0,[2.6,2,1.4],8],[18,4,26,[5,1,1.2],3],[-20,6,-25,[1,4,1.6],3],[30,12,14,[1.4,2,5],3],[10,25,-30,[1.4,2.2,3.6],6]].forEach(([x,y,z,c,r])=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(...c)}));m.position.set(x,y,z);es.add(m)});
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(es,0.03).texture;pm.dispose();scene.environmentIntensity=0.55}
const composer=LOWQ?null:new EffectComposer(renderer,new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4}));
if(composer)composer.addPass(new RenderPass(scene,camera));
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
if(composer){composer.addPass(bloom);composer.addPass(grade);composer.addPass(new OutputPass())}
const draw=dt=>{if(composer)composer.render(dt);else renderer.render(scene,camera)};
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(dynPR);renderer.setSize(w,h,false);if(composer){composer.setPixelRatio(dynPR);composer.setSize(w,h)}camera.aspect=w/h;camera.updateProjectionMatrix();grade.uniforms.asp.value=w/h}
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
key.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048);key.shadow.bias=-0.0004;key.shadow.normalBias=0.22;// el tablero es grande: cada texel de sombra cubre ~0,2 m
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
function toyMat(m,phys,kit){const k=(m.map?'kit:'+kit:'c'+m.color.getHex())+(phys?'p':'');/* mismo kit = misma textura: un solo material */if(!toyCache.has(k)){if(m.map)m.map.anisotropy=4;const o={map:m.map||null,color:m.map?0xffffff:m.color,roughness:phys?.36:.5,metalness:0,side:THREE.FrontSide};toyCache.set(k,phys?new THREE.MeshPhysicalMaterial({...o,clearcoat:.7,clearcoatRoughness:.14}):new THREE.MeshStandardMaterial(o))}return toyCache.get(k)}
const MODELS={treeA:'holiday/tree-snow-a.glb',treeB:'holiday/tree-snow-b.glb',treeC:'holiday/tree-snow-c.glb',treeD:'holiday/tree-decorated-snow.glb',deer:'holiday/reindeer.glb',snowman:'holiday/snowman-hat.glb',nut:'holiday/nutcracker.glb',ginger:'holiday/gingerbread-man.glb',ginger2:'holiday/gingerbread-woman.glb',lantern:'holiday/lantern.glb',presA:'holiday/present-a-cube.glb',presB:'holiday/present-b-round.glb',presC:'holiday/present-a-rectangle.glb',presD:'holiday/present-b-cube.glb',caneR:'holiday/candy-cane-red.glb',caneG:'holiday/candy-cane-green.glb',sled:'holiday/sled.glb',bench:'holiday/bench.glb',flakeA:'holiday/snowflake-a.glb',flakeB:'holiday/snowflake-b.glb',rocks:'holiday/rocks-medium.glb',pile:'holiday/snow-pile.glb',sock:'holiday/sock-red-cane.glb',sock2:'holiday/sock-green-cane.glb',wreath:'holiday/wreath-decorated.glb'};
async function loadModels(onp){const L=new GLTFLoader(),keys=Object.keys(MODELS);let n=0;
  await Promise.all(keys.map(async k=>{const g=await L.loadAsync('m/'+MODELS[k]),sc=g.scene,toy=MODELS[k].startsWith('train/');
    sc.traverse(o=>{if(o.isMesh){o.material=toyMat(o.material,toy,MODELS[k].split('/')[0]);o.castShadow=true;o.receiveShadow=true}});sc.updateMatrixWorld(true);MD[k]={scene:sc,box:new THREE.Box3().setFromObject(sc)};n++;onp&&onp(n/keys.length)}))}
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
function disposeObj(root){const keepM=new Set([...Object.values(M),...Object.values(TM),...toyCache.values(),...HMAT]),keepT=new Set([...Object.values(texCache),...Object.values(phCache)]),
  shared=g=>g===branchGeo||Object.values(MD).some(d=>d.flat&&d.flat.geo===g);
  root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&!shared(o.geometry))o.geometry.dispose();
    if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(keepM.has(m))return;if(m.map&&!keepT.has(m.map))m.map.dispose();m.dispose()})})}

/* ================= tren: locomotora de vapor, ténder, furgones con la marca en los costados y furgón de cola ================= */
const train=new THREE.Group();scene.add(train);
const GAUGE=GA,RT=0.75,WB=0.78,WS=0.42;// carriles, cabeza del carril y radio de las ruedas motrices y pequeñas
const WLEN=7.2,WHALF=1.42,WTOP=4.62,PANEL_Y=2.95,PANEL_W=5.96,PANEL_H=2.05;// furgón: el panel de la marca ocupa casi todo el costado
const cars=[],WAG=[null],WL=[];let OFFS=[0],spot=null,beam=null,LOCO=null,GIFTCAR=null,wheelT=0,WIM=null;// cars: máquina, ténder, furgones y cola; WAG[i]: furgón i
const WCOL=['#8f1d24','#16492f','#1f3a6b','#e6d8b8','#5b2a5e','#9a6a1f'];
const TM={
  lac:new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.3,clearcoat:1,clearcoatRoughness:.06}),// laca: el color va por furgón
  red:new THREE.MeshPhysicalMaterial({color:0xb3121f,roughness:.3,clearcoat:1,clearcoatRoughness:.06}),
  green:new THREE.MeshPhysicalMaterial({color:0x0e4a31,roughness:.28,clearcoat:1,clearcoatRoughness:.05}),
  black:new THREE.MeshPhysicalMaterial({color:0x17181d,roughness:.42,metalness:.35,clearcoat:.7,clearcoatRoughness:.15}),
  brass:new THREE.MeshPhysicalMaterial({color:0xe8b64a,roughness:.34,metalness:1,clearcoat:.25}),
  steel:new THREE.MeshStandardMaterial({color:0xc9ced6,roughness:.28,metalness:1}),
  coal:new THREE.MeshStandardMaterial({color:0x121212,roughness:.5,metalness:.25,flatShading:true}),
  glow:new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.15,.6)}),
  tail:new THREE.MeshBasicMaterial({color:new THREE.Color(3,.45,.35)}),
};
const _m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(1,1,1),_e=new THREE.Euler(),
  UPV=new THREE.Vector3(0,1,0),ZAX=new THREE.Vector3(0,0,1),ONE=new THREE.Vector3(1,1,1),QFLIP=new THREE.Quaternion().setFromAxisAngle(UPV,Math.PI),ZERO=new THREE.Matrix4().makeScale(0,0,0);
/* piezas sueltas que luego se unen por material (pocas llamadas de dibujo por coche) */
function part(L,g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0){_m.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(rx,ry,rz)),ONE);g.applyMatrix4(_m);L.push([g,m]);return g}
function geoOnly(g){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));return g}
function fuse(L,par){const by=new Map();for(const [g,m] of L){if(!by.has(m))by.set(m,[]);by.get(m).push(geoOnly(g))}
  const out=[];by.forEach((gs,m)=>{const me=new THREE.Mesh(mergeGeometries(gs,false),m);me.castShadow=true;me.receiveShadow=true;if(par)par.add(me);out.push(me)});return out}
const BX=(w,h,d)=>new THREE.BoxGeometry(w,h,d),CY=(rt,rb,h,n=20)=>new THREE.CylinderGeometry(rt,rb,h,n),CYX=(r,l,n=20)=>new THREE.CylinderGeometry(r,r,l,n).rotateZ(Math.PI/2),
  TOR=(r,t,n=28)=>new THREE.TorusGeometry(r,t,8,n),DOME=r=>new THREE.SphereGeometry(r,18,8,0,Math.PI*2,0,Math.PI/2),PLN=(w,h)=>new THREE.PlaneGeometry(w,h),SPH=(r,a=12,b=9)=>new THREE.SphereGeometry(r,a,b);
/* techo curvo con grosor, a lo largo de X */
function roofGeo(len,w,rise,th=0.14){const s=new THREE.Shape(),r=(w*w/4+rise*rise)/(2*rise),a=Math.asin(w/2/r);s.moveTo(-w/2,0);s.absarc(0,rise-r,r,Math.PI/2+a,Math.PI/2-a,true);s.lineTo(w/2,-th);s.absarc(0,rise-r-th,r,Math.PI/2-a,Math.PI/2+a,false);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:len,bevelEnabled:false,curveSegments:14});g.translate(0,0,-len/2);g.rotateY(Math.PI/2);return g}
function ringGeo(ro,ri,d,n=28){const s=new THREE.Shape();s.absarc(0,0,ro,0,Math.PI*2,false);const h=new THREE.Path();h.absarc(0,0,ri,0,Math.PI*2,true);s.holes.push(h);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:n});g.translate(0,0,-d/2);return g}
/* ruedas: motrices con radios y contrapeso, y pequeñas de disco; la llanta de acero va aparte */
function bigWheelGeos(){const r=WB,L=[ringGeo(r*0.9,r*0.74,0.2),CY(r*0.2,r*0.2,0.3,14).rotateX(Math.PI/2),BX(r*0.62,r*0.26,0.13).translate(0,-r*0.52,0)];
  for(let k=0;k<12;k++)L.push(BX(0.075,r*0.6,0.09).translate(0,r*0.47,0).rotateZ(k*Math.PI/6));
  return {body:mergeGeometries(L.map(geoOnly),false),tire:geoOnly(ringGeo(r,r*0.9,0.26))}}
function smallWheelGeos(){const r=WS;return {body:mergeGeometries([CY(r*0.88,r*0.88,0.16,20).rotateX(Math.PI/2),CY(r*0.25,r*0.25,0.28,12).rotateX(Math.PI/2)].map(geoOnly),false),tire:geoOnly(ringGeo(r,r*0.86,0.22,24))}}
/* furgón: caja lacada, techo, bastidor, bogies, marco dorado del panel y escalerillas */
function wagonGeos(){const lac=[BX(7.0,2.7,2.84).translate(0,2.9,0)],blk=[roofGeo(7.4,3.1,0.32).translate(0,4.25,0),BX(6.6,0.08,0.55).translate(0,4.6,0),BX(7.3,0.32,2.3).translate(0,1.42,0)],gld=[];
  for(const x of[-2.45,2.45])blk.push(BX(2.0,0.34,2.12).translate(x,1.17,0));
  for(const x of[-3.78,3.78])blk.push(BX(0.4,0.22,0.3).translate(x,1.42,0));
  for(const sd of[-1,1]){const z=sd*(WHALF+0.03);gld.push(BX(PANEL_W+0.2,0.09,0.05).translate(0,PANEL_Y+PANEL_H/2+0.045,z),BX(PANEL_W+0.2,0.09,0.05).translate(0,PANEL_Y-PANEL_H/2-0.045,z),BX(0.09,PANEL_H+0.18,0.05).translate(-PANEL_W/2-0.045,PANEL_Y,z),BX(0.09,PANEL_H+0.18,0.05).translate(PANEL_W/2+0.045,PANEL_Y,z))}
  for(const x of[-3.52,3.52]){for(const z of[0.55,1.05])gld.push(BX(0.05,2.3,0.05).translate(x,2.95,z));for(let k=0;k<6;k++)gld.push(BX(0.05,0.05,0.55).translate(x,1.95+k*0.4,0.8))}
  const mg=a=>mergeGeometries(a.map(geoOnly),false);return {lac:mg(lac),blk:mg(blk),gld:mg(gld)}}
function buildLoco(){const L=[],g=new THREE.Group();
  part(L,BX(8.0,0.36,2.0),TM.black,-0.3,1.72,0);
  part(L,BX(7.8,0.12,3.0),TM.red,-0.35,2.4,0);part(L,BX(7.84,0.05,3.04),TM.brass,-0.35,2.47,0);
  part(L,CYX(1.0,4.8,28),TM.green,0.6,3.45,0);for(const x of[-1.2,0.5,2.2])part(L,TOR(1.012,0.055),TM.brass,x,3.45,0,0,Math.PI/2,0);
  part(L,CYX(1.06,0.82,28),TM.black,3.41,3.45,0);part(L,CYX(0.9,0.08,28),TM.black,3.86,3.45,0);part(L,TOR(0.9,0.05),TM.brass,3.9,3.45,0,0,Math.PI/2,0);part(L,SPH(0.09),TM.brass,3.93,3.45,0);
  part(L,new THREE.LatheGeometry([[0,0],[0.46,0],[0.36,0.35],[0.32,0.85],[0.5,1.3],[0.6,1.48],[0.52,1.52],[0,1.52]].map(([a,b])=>new THREE.Vector2(a,b)),22),TM.black,3.35,4.25,0);
  part(L,TOR(0.57,0.05),TM.brass,3.35,5.74,0,Math.PI/2,0,0);
  part(L,CY(0.5,0.56,0.42),TM.brass,1.35,4.52,0);part(L,DOME(0.5),TM.brass,1.35,4.73,0);
  part(L,CY(0.38,0.44,0.36),TM.red,-0.2,4.5,0);part(L,DOME(0.38),TM.brass,-0.2,4.68,0);
  part(L,CY(0.07,0.07,0.5),TM.brass,-1.45,4.6,0);part(L,CY(0.14,0.07,0.2),TM.brass,-1.45,4.95,0);
  for(const z of[-1.1,1.1])part(L,CYX(0.035,4.4,6),TM.brass,0.7,3.95,z);
  for(const z of[-1.42,1.42]){part(L,CYX(0.42,1.0,18),TM.black,2.5,1.62,z);part(L,CYX(0.45,0.07,18),TM.brass,2.0,1.62,z);part(L,CYX(0.45,0.07,18),TM.brass,3.0,1.62,z)}
  {const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(0.95,0);s.lineTo(0,0.95);s.closePath();const cg=new THREE.ExtrudeGeometry(s,{depth:2.5,bevelEnabled:false});cg.translate(0,0,-1.25);part(L,cg,TM.red,3.95,0.85,0)}
  part(L,BX(0.3,0.5,2.9),TM.red,3.95,1.98,0);for(const z of[-0.95,0.95])part(L,CYX(0.2,0.32,14),TM.brass,4.25,1.98,z);
  // cabina con las ventanas encendidas
  part(L,BX(2.5,2.55,2.9),TM.red,-3.0,3.62,0);part(L,BX(2.54,0.07,2.94),TM.brass,-3.0,2.38,0);
  for(const sd of[-1,1]){part(L,PLN(0.95,0.85),TM.glow,-3.05,4.2,sd*1.456,0,sd>0?0:Math.PI,0);
    part(L,BX(1.07,0.06,0.04),TM.brass,-3.05,4.65,sd*1.47);part(L,BX(1.07,0.06,0.04),TM.brass,-3.05,3.75,sd*1.47);part(L,BX(0.06,0.96,0.04),TM.brass,-3.57,4.2,sd*1.47);part(L,BX(0.06,0.96,0.04),TM.brass,-2.53,4.2,sd*1.47)}
  for(const z of[-0.9,0.9])part(L,new THREE.CircleGeometry(0.26,16),TM.glow,-1.74,4.35,z,0,Math.PI/2,0);
  part(L,roofGeo(3.0,3.4,0.3),TM.black,-3.0,4.93,0);
  part(L,BX(0.5,0.48,0.56),TM.black,3.62,4.55,0);part(L,TOR(0.2,0.04,16),TM.brass,3.88,4.55,0,0,Math.PI/2,0);
  fuse(L,g);
  const rods=[-1,1].map(sd=>{const m=new THREE.Mesh(BX(3.75,0.13,0.07),TM.steel);m.position.set(-0.6,RT+WB,sd*1.52);m.castShadow=true;g.add(m);return m});// bielas
  const W=[];for(const x of[-2.3,-0.6,1.1])for(const sd of[-1,1])W.push({x,y:RT+WB,z:sd*GAUGE,big:true});for(const x of[3.55,-3.75])for(const sd of[-1,1])W.push({x,y:RT+WS,z:sd*GAUGE,big:false});
  g.userData={len:8.9,top:5.3,chimney:new THREE.Vector3(3.35,5.9,0),lamp:new THREE.Vector3(3.92,4.55,0),wheels:W,rods};return g}
function buildTender(){const L=[],g=new THREE.Group();
  part(L,BX(4.6,0.3,2.2),TM.black,0,1.45,0);for(const x of[-1.15,1.15])part(L,BX(1.9,0.34,2.12),TM.black,x,1.17,0);
  part(L,BX(4.4,1.75,2.9),TM.red,0,2.5,0);part(L,BX(4.44,0.08,2.94),TM.brass,0,3.4,0);part(L,BX(4.44,0.08,2.94),TM.brass,0,1.66,0);
  {const cg=new THREE.BoxGeometry(4.0,0.6,2.5,14,1,9),p=cg.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)>0)p.setY(i,p.getY(i)+hash2(p.getX(i)*3.1,p.getZ(i)*2.7)*0.5*(1-Math.abs(p.getZ(i))/1.4));cg.computeVertexNormals();part(L,cg,TM.coal,0,3.3,0)}
  fuse(L,g);
  const W=[];for(const x of[-1.7,-0.6,0.6,1.7])for(const sd of[-1,1])W.push({x,y:RT+WS,z:sd*GAUGE,big:false});
  g.userData={len:4.8,top:3.9,wheels:W};return g}
function buildCaboose(){const L=[],g=new THREE.Group();
  part(L,BX(5.4,0.3,2.3),TM.black,0,1.42,0);for(const x of[-1.4,1.4])part(L,BX(1.9,0.34,2.12),TM.black,x,1.17,0);
  part(L,BX(4.2,2.4,2.8),TM.red,0,2.78,0);part(L,roofGeo(4.6,3.1,0.25),TM.black,0,3.98,0);
  part(L,BX(1.8,1.0,2.1),TM.red,0.2,4.5,0);part(L,roofGeo(2.2,2.5,0.18),TM.black,0.2,5.0,0);
  for(const sd of[-1,1]){for(const x of[-1.3,0,1.3])part(L,PLN(0.6,0.6),TM.glow,x,3.15,sd*1.405,0,sd>0?0:Math.PI,0);part(L,PLN(0.5,0.4),TM.glow,0.2,4.55,sd*1.055,0,sd>0?0:Math.PI,0);part(L,BX(4.24,0.07,0.04),TM.brass,0,1.62,sd*1.42)}
  for(const x of[-2.55,2.55]){part(L,BX(0.5,0.08,2.3),TM.black,x,1.6,0);for(const z of[-1.05,1.05])part(L,BX(0.05,1.0,0.05),TM.brass,x+Math.sign(x)*0.2,2.1,z);part(L,BX(0.05,0.05,2.15),TM.brass,x+Math.sign(x)*0.2,2.6,0)}
  part(L,SPH(0.16),TM.tail,-2.78,3.4,0.9);
  fuse(L,g);
  const W=[];for(const x of[-1.9,-0.9,0.9,1.9])for(const sd of[-1,1])W.push({x,y:RT+WS,z:sd*GAUGE,big:false});
  g.userData={len:6.0,top:5.2,wheels:W};return g}
/* vagón de regalos: plataforma con barandilla dorada y un montón de paquetes; aquí viajan los regalos entre amigos */
function buildGiftCar(){const L=[],g=new THREE.Group();
  part(L,BX(6.6,0.3,2.3),TM.black,0,1.42,0);for(const x of[-2.2,2.2])part(L,BX(2.0,0.34,2.12),TM.black,x,1.17,0);
  part(L,BX(6.8,0.35,2.9),TM.green,0,1.75,0);part(L,BX(6.84,0.06,2.94),TM.brass,0,1.95,0);
  for(const sd of[-1,1]){part(L,BX(6.6,0.06,0.06),TM.brass,0,2.62,sd*1.4);for(let k=-3;k<=3;k++)part(L,BX(0.06,0.66,0.06),TM.brass,k*1.05,2.29,sd*1.4)}
  for(const x of[-3.3,3.3])part(L,BX(0.06,0.66,2.86),TM.brass,x,2.29,0);
  fuse(L,g);
  const pile=new THREE.Group();[['presA',1.3,-2.3,-0.5],['presB',1.1,-1.1,0.6],['presC',1.0,-2.0,0.6],['presD',1.2,1.6,0.5],['presA',1.0,2.5,-0.4],['presB',0.9,1.4,-0.6],['presC',0.8,-0.9,-0.6]].forEach(([q,h,x,z],k)=>{const o=obj(q,h);o.position.set(x,1.98,z);o.rotation.y=k*1.3;pile.add(o)});
  pile.updateMatrixWorld(true);mergeMeshes([...pile.children]).forEach(m=>{m.castShadow=true;m.material=m.material.clone();/* sin cutMat: los regalos del vagón no se recortan */g.add(m)});
  const W=[];for(const x of[-2.7,-1.7,1.7,2.7])for(const sd of[-1,1])W.push({x,y:RT+WS,z:sd*GAUGE,big:false});
  g.userData={len:7.0,top:4.0,wheels:W};return g}
/* furgones y ruedas: mallas instanciadas (un draw call por pieza, no uno por coche) */
function trainInit(){const wg=wagonGeos(),bw=bigWheelGeos(),sw=smallWheelGeos(),mk=(geo,mat,n)=>{const m=new THREE.InstancedMesh(geo,mat,n);m.count=0;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);return m};
  WIM={wag:[mk(wg.lac,TM.lac,WAGON_MAX),mk(wg.blk,TM.black,WAGON_MAX),mk(wg.gld,TM.brass,WAGON_MAX)],big:[mk(bw.body,TM.red,6),mk(bw.tire,TM.steel,6)],small:[mk(sw.body,TM.red,140),mk(sw.tire,TM.steel,140)]};
  for(let i=0;i<WAGON_MAX;i++)WIM.wag[0].setColorAt(i,new THREE.Color(WCOL[i%WCOL.length]));WIM.wag[0].instanceColor.needsUpdate=true;
  if(LOWQ){WIM.blob=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.55,polygonOffset:true,polygonOffsetFactor:-2}),WAGON_MAX+5);WIM.blob.frustumCulled=false;WIM.blob.renderOrder=1;scene.add(WIM.blob)}}
function makeWagon(i){const W=new THREE.Group();W.userData={len:WLEN+0.2,top:WTOP,c:0,i,wheels:[-2.95,-1.95,1.95,2.95].flatMap(x=>[-1,1].map(sd=>({x,y:RT+WS,z:sd*GAUGE,big:false})))};return W}
function layoutTrain(){OFFS=[0];for(let i=1;i<cars.length;i++)OFFS.push(OFFS[i-1]-(cars[i-1].userData.len/2+cars[i].userData.len/2+0.55));
  WL.length=0;cars.forEach((c,ci)=>c.userData.wheels.forEach(w=>WL.push({c:ci,...w})))}
function buildTrain(n){train.clear();cars.length=0;WAG.length=1;if(!WIM)trainInit();
  LOCO=buildLoco();cars.push(LOCO,buildTender());for(let i=1;i<=n;i++){const W=makeWagon(i);WAG.push(W);cars.push(W)}GIFTCAR=buildGiftCar();cars.push(GIFTCAR,buildCaboose());
  cars.forEach(c=>train.add(c));layoutTrain();
  const lp=LOCO.userData.lamp,lens=new THREE.Mesh(SPH(0.21,14,10),M.lamp);lens.position.copy(lp);LOCO.add(lens);
  spot=new THREE.SpotLight(0xffe2a8,240,95,0.45,0.55,1.25);spot.position.copy(lp);
  {const cg=new THREE.ConeGeometry(4.2,24,24,1,true);cg.translate(0,-12,0);cg.rotateZ(Math.PI/2);beam=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({map:coneTex,color:new THREE.Color(.2,.16,.09),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false}));beam.position.set(lp.x+0.2,lp.y,lp.z);LOCO.add(beam)}
  const tg=new THREE.Object3D();tg.position.set(30,0,0);LOCO.add(tg);spot.target=tg;if(!LOWQ)LOCO.add(spot)}// en el móvil la luz de foco cuesta ~5 ms por fotograma
function addWagon(){const i=WAG.length,W=makeWagon(i);WAG.push(W);cars.splice(cars.indexOf(GIFTCAR),0,W);train.add(W);layoutTrain();W.userData.pop=0;W.scale.setScalar(0.6);fillWagon(W);setAd(i,null);poseTrain()}
function fillWagon(W){W.userData.c=CAP}
/* el tren va por la vuelta T (según las agujas tomadas). Cada coche pasa por donde pasó la máquina: segs guarda desde qué punto del odómetro va por cada vuelta */
let odo=0,segs=[];
function carAt(ci){const x=odo+OFFS[ci];let k=segs.length-1;while(k>0&&segs[k].o>x)k--;const g=segs[k];return {T:g.T,s:g.s+(x-g.o)}}
function setDist(v){dist=((v%T.L)+T.L)%T.L;segs=[{o:odo,T,s:dist}]}
function setRoute(bits){T=MP.R[bits];segs.push({o:odo,T,s:dist});while(segs.length>1&&segs[1].o<odo+OFFS[OFFS.length-1]-20)segs.shift()}
function poseCar(c,{T,s}){const p=atM(T,s),q=atM(T,s+2),b=atM(T,s-2),yaw=Math.atan2(q.z-b.z,q.x-b.x),pit=Math.atan2(q.y-b.y,Math.hypot(q.x-b.x,q.z-b.z));c.position.set(p.x,p.y,p.z);c.rotation.set(0,-yaw,pit,'YZX')}
function poseTrain(){if(!T||!segs.length)return;cars.forEach((c,i)=>poseCar(c,carAt(i)));train.updateMatrixWorld(true)}
function trainInst(){if(!WIM||!LOCO)return;const n=WAG.length-1;
  for(let i=1;i<=n;i++){const W=WAG[i];for(const IM of WIM.wag)IM.setMatrixAt(i-1,W.matrixWorld)}
  let kb=0,ks=0;for(const w of WL){const c=cars[w.c],th=wheelT/(w.big?WB:WS);_q.setFromAxisAngle(ZAX,w.z<0?th:-th);if(w.z<0)_q.premultiply(QFLIP);_m2.compose(_p.set(w.x,w.y,w.z),_q,ONE);_m.multiplyMatrices(c.matrixWorld,_m2);
    const IMs=w.big?WIM.big:WIM.small,k=w.big?kb++:ks++;IMs[0].setMatrixAt(k,_m);IMs[1].setMatrixAt(k,_m)}
  if(WIM.blob){cars.forEach((c,i)=>{_m2.compose(_p.set(0,0.36,0),_q.identity(),_s.set(c.userData.len*1.08,1,3.9));_m.multiplyMatrices(c.matrixWorld,_m2);WIM.blob.setMatrixAt(i,_m)});_s.set(1,1,1);WIM.blob.count=cars.length;WIM.blob.instanceMatrix.needsUpdate=true}
  WIM.wag.forEach(m=>{m.count=n;m.instanceMatrix.needsUpdate=true});WIM.big.forEach(m=>{m.count=kb;m.instanceMatrix.needsUpdate=true});WIM.small.forEach(m=>{m.count=ks;m.instanceMatrix.needsUpdate=true});
  const th=wheelT/WB;LOCO.userData.rods.forEach((m,k)=>{const a=-th+(k?Math.PI/2:0);m.position.x=-0.6+Math.cos(a)*0.34;m.position.y=RT+WB+Math.sin(a)*0.34})}

/* humo, chispas, fuegos y confeti */
const SMK=48,smP=new Float32Array(SMK*3).fill(-999),smA=new Float32Array(SMK*2),smoke=Array.from({length:SMK},()=>({life:0,p:new THREE.Vector3(),v:new THREE.Vector3(),sz:1,op:.26,ml:1.7}));
const smG=new THREE.BufferGeometry();smG.setAttribute('position',new THREE.BufferAttribute(smP,3));smG.setAttribute('sa',new THREE.BufferAttribute(smA,2));
const smokeU={map:{value:puffTex},k:{value:600}};
const smokePts=new THREE.Points(smG,new THREE.ShaderMaterial({uniforms:smokeU,transparent:true,depthWrite:false,
  vertexShader:'uniform float k;attribute vec2 sa;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=sa.x*k/max(-mv.z,.5);vA=sa.y;gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform sampler2D map;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vec3(.93,.945,.965),t.a*vA);}'}));smokePts.frustumCulled=false;scene.add(smokePts);
let smokeI=0,smokeAcc=0;
function puff(p,v,sz,op,life){const q=smoke[smokeI=(smokeI+1)%SMK];q.life=1;q.ml=life||1.7;q.p.copy(p);q.v.copy(v);q.sz=sz;q.op=op}
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

/* en el móvil, los materiales con barniz (clearcoat) pasan a estándar: el doble reflejo cuesta en cada píxel */
const lite=new Map();
function downgrade(root){if(!LOWQ)return;root.traverse(o=>{const m=o.material;if(!m||!m.isMeshPhysicalMaterial)return;let n=lite.get(m);
  if(!n){n=new THREE.MeshStandardMaterial();for(const k of['color','emissive'])n[k].copy(m[k]);for(const k of['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','roughness','metalness','envMapIntensity','side','transparent','opacity','vertexColors','flatShading','alphaTest','depthWrite','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'])n[k]=m[k];n.normalScale.copy(m.normalScale);n.roughness=Math.min(1,m.roughness+0.08);lite.set(m,n)}
  o.material=n})}

/* los abetos y juguetes que quedan entre la cámara y el coche que sigues no se dibujan (un cono que descarta sus píxeles) */
const CUT={a:{value:new THREE.Vector3()},b:{value:new THREE.Vector3()},r:{value:0}};let cutK=0,cutK2=0,fadeOp=0;
function cutMat(m){if(m.userData.cut)return;m.userData.cut=1;m.onBeforeCompile=sh=>{sh.uniforms.cutA=CUT.a;sh.uniforms.cutB=CUT.b;sh.uniforms.cutR=CUT.r;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCutP;').replace('#include <project_vertex>','#include <project_vertex>\n{vec4 cp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\ncp=instanceMatrix*cp;\n#endif\nvCutP=(modelMatrix*cp).xyz;}');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCutP;uniform vec3 cutA,cutB;uniform float cutR;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(cutR>.01){vec3 ab=cutB-cutA;float t=clamp(dot(vCutP-cutA,ab)/dot(ab,ab),0.,1.);if(t<.985&&length(vCutP-cutA-ab*t)<cutR*(.25+.75*t))discard;}')};
  m.needsUpdate=true}

/* ================= maqueta alpina (se rehace al ampliar la vía) ================= */
let world=null,MP=null,T=null,SL=[],STN=null,treeParts=[],roomTree=null,anims=[],decoG=null,arches=[],eaveLights=[],GIANTS=[],GR=null,SKI=null,LIFT=null,SKATE=null,SLEIGH=null,SANTA=null,PIERS=[],TREES=[];
const BCX=(BOARD.x0+BOARD.x1)/2,BCZ=(BOARD.z0+BOARD.z1)/2;
const anim=a=>{if(LOWQ)a.o.traverse(c=>{if(c.isMesh)c.userData.st=true});else{anims.push(a);MOVING.add(a.o)}};// en el móvil, quietos y unidos al decorado
/* altura del suelo: la rejilla del terreno, interpolada; fuera del tablero, el suelo del salón */
function groundAt(x,z){if(!GR)return 0;const fx=(x-GR.x0)/GR.dx,fz=(z-GR.z0)/GR.dz;if(fx<0||fz<0||fx>GR.nx-1||fz>GR.nz-1)return -1.2;
  const i=Math.min(GR.nx-2,Math.floor(fx)),j=Math.min(GR.nz-2,Math.floor(fz)),u=fx-i,v=fz-j,h=GR.h,n=GR.nx;return lerp(lerp(h[j*n+i],h[j*n+i+1],u),lerp(h[(j+1)*n+i],h[(j+1)*n+i+1],u),v)}
const slopeAt=(x,z)=>Math.hypot(groundAt(x+1,z)-groundAt(x-1,z),groundAt(x,z+1)-groundAt(x,z-1))/2;
const segDist=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)};
const stoneTex=rep(canvasTex(256,256,(g,w,h)=>{g.fillStyle='#4a4744';g.fillRect(0,0,w,h);const q=rng(11);for(let y=0;y<8;y++){const off=(y%2)*24;for(let x=-1;x<6;x++){const l=104+q()*44,bx=x*48+off;g.fillStyle=`rgb(${l+6},${l+2},${l-4})`;g.fillRect(bx+3,y*32+3,42,26);g.fillStyle='rgba(255,255,255,.1)';g.fillRect(bx+3,y*32+3,42,4)}}},'stone'),1,1);
Object.assign(M,{
  stone:new THREE.MeshStandardMaterial({map:stoneTex,roughness:.92}),
  stone2:new THREE.MeshStandardMaterial({map:stoneTex,color:0xe6dccb,roughness:.85}),
  cave:new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}),// la luz de la gruta va pintada en los vértices: se ve igual en el móvil y no cuesta nada
  ice:new THREE.MeshLambertMaterial({color:0xbcd6ec,emissive:0x0c1626}),// sin reflejos: desde ángulos rasantes reflejaba el salón oscuro y salía negro
  fascia:new THREE.MeshPhysicalMaterial({color:0x4a2c1a,map:woodTex,roughness:.45,clearcoat:.7,clearcoatRoughness:.2,side:THREE.DoubleSide}),
  terrain:(()=>{const gm=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,roughnessMap:phTex('snow_02_rough',1),normalMap:phTex('snow_02_nor',1),normalScale:new THREE.Vector2(.85,.85)});
    gm.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec2 gc=floor(vWP.xz*11.);float r=fract(sin(dot(gc,vec2(12.9898,78.233)))*43758.5453);vec3 vd=normalize(cameraPosition-vWP);float tw=fract(r*91.7+dot(vd,vec3(4.1,6.7,3.3))*2.);float dd=length(cameraPosition-vWP);totalEmissiveRadiance+=vec3(2.2,2.3,2.6)*step(.992,r)*smoothstep(.75,1.,tw)*smoothstep(90.,5.,dd)*2.2;}')};return gm})(),
  cobble:new THREE.MeshStandardMaterial({map:stoneTex,color:0xcfc8bd,roughness:.95}),
  velvet:new THREE.MeshStandardMaterial({color:0xb5121f,roughness:.72}),
  skin:new THREE.MeshStandardMaterial({color:0xf0c3a2,roughness:.6}),
  person:new THREE.MeshStandardMaterial({roughness:.65}),
  personV:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65}),
});
/* caja con UV en unidades (la textura no se estira) */
function boxU(w,h,d,k=3){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0]/k,uv.getY(i)*dims[f][1]/k)}return g}
/* perfil extruido a lo largo de la vía desde la muestra i0 (n muestras) */
function ext3(prof,i0,n,step,mat){const N=T.N,Mx=Math.ceil(n/step),P=prof.length,pos=new Float32Array((Mx+1)*P*3),uv=new Float32Array((Mx+1)*P*2),ind=[];
  for(let q=0;q<=Mx;q++){const k=((i0+Math.min(n,q*step))%N+N)%N,c=Math.cos(T.a[k]),s=Math.sin(T.a[k]);
    for(let j=0;j<P;j++){const o=(q*P+j)*3;pos[o]=T.x[k]-s*prof[j][0];pos[o+1]=T.y[k]+prof[j][1];pos[o+2]=T.z[k]+c*prof[j][0];uv[(q*P+j)*2]=(prof[j][0]+prof[j][1])/3;uv[(q*P+j)*2+1]=q*step*T.ds/3}}
  for(let q=0;q<Mx;q++)for(let j=0;j<P-1;j++){const a=q*P+j,b=(q+1)*P+j;ind.push(a,b,b+1,a,b+1,a+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.receiveShadow=true;return m}
/* lo que no se mueve no recalcula su matriz cada fotograma (lo animado sigue: sus matrices se recomponen solas) */
const MOVING=new Set();
function freeze(root){root.updateMatrixWorld(true);root.traverse(o=>{if(o!==root&&!MOVING.has(o))o.matrixAutoUpdate=false})}
function batchStatic(root){root.updateMatrixWorld(true);const list=[];root.traverse(o=>{if(o.isMesh&&o.userData.st)list.push(o)});list.forEach(o=>o.parent.remove(o));mergeMeshes(list).forEach(m=>root.add(m))}
function blobs(list,par){if(!list.length)return;const m=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.6,polygonOffset:true,polygonOffsetFactor:-2}),list.length);
  list.forEach(([x,z,r,y],i)=>{o3.position.set(x,(y||0)+0.15,z);o3.rotation.set(0,0,0);o3.scale.set(r*2,1,r*2);o3.updateMatrix();m.setMatrixAt(i,o3.matrix)});o3.scale.set(1,1,1);m.renderOrder=1;par.add(m)}

/* terreno: rejilla con color por vértice (nieve, roca en lo empinado, pista de esquí), hielo y canto de madera */
function buildTerrain(){const B=BOARD,res=coarse?2.2:1.6,nx=Math.round((B.x1-B.x0)/res)+1,nz=Math.round((B.z1-B.z0)/res)+1,dx=(B.x1-B.x0)/(nx-1),dz=(B.z1-B.z0)/(nz-1);
  const h=new Float32Array(nx*nz);for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)h[j*nx+i]=MP.h(B.x0+i*dx,B.z0+j*dz);
  GR={x0:B.x0,z0:B.z0,dx,dz,nx,nz,h};
  const pos=new Float32Array(nx*nz*3),nor=new Float32Array(nx*nz*3),col=new Float32Array(nx*nz*3),uv=new Float32Array(nx*nz*2);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,x=B.x0+i*dx,z=B.z0+j*dz,y=h[k];pos[k*3]=x;pos[k*3+1]=y;pos[k*3+2]=z;uv[k*2]=x/14;uv[k*2+1]=z/14;
    const ex=(h[j*nx+Math.min(nx-1,i+1)]-h[j*nx+Math.max(0,i-1)])/(2*dx),ez=(h[Math.min(nz-1,j+1)*nx+i]-h[Math.max(0,j-1)*nx+i])/(2*dz),l=Math.hypot(ex,1,ez),ny=1/l;nor[k*3]=-ex/l;nor[k*3+1]=ny;nor[k*3+2]=-ez/l;
    const rock=sstep(0.8,0.6,ny)*sstep(1,4,y),b=0.93+fbm(x*0.05,z*0.05)*0.07,piste=1-sstep(4,8,pisteD(x,z)),ice=sstep(LAKE_Y+0.9,LAKE_Y,y),hr=hash2(i,j)*0.06;
    let r=b*0.92,g=b*0.955,bl=b;r=lerp(r,0.34+hr,rock);g=lerp(g,0.32+hr,rock);bl=lerp(bl,0.33+hr,rock);
    if(piste>0&&y>2){r=lerp(r,1.03,piste);g=lerp(g,1.03,piste);bl=lerp(bl,1.05,piste)}r=lerp(r,0.72,ice);g=lerp(g,0.82,ice);bl=lerp(bl,0.93,ice);col[k*3]=r;col[k*3+1]=g;col[k*3+2]=bl}
  // las caras que taparían la boca de un túnel no se ponen (el hueco queda detrás de la fachada de piedra)
  const mouths=MP.T.runs.filter(r=>r.k===KT).flatMap(r=>[0,1].map(e=>{const T=MP.T,k=e?(r.i+r.n-1)%T.N:r.i,sg=e?-1:1;return {x:T.x[k],y:T.y[k],z:T.z[k],dx:Math.cos(T.a[k])*sg,dz:Math.sin(T.a[k])*sg}}));
  const shut=(a,b,c)=>mouths.some(m=>{let inn=false,top=-1e9;for(const v of[a,b,c]){const x=pos[v*3]-m.x,z=pos[v*3+2]-m.z,al=x*m.dx+z*m.dz,la=Math.abs(x*-m.dz+z*m.dx);if(la<4.2&&al>-2.2&&al<1.8)inn=true;if(la>9||al>5||al<-5)return false;top=Math.max(top,pos[v*3+1])}return inn&&top>m.y+0.5});
  const idx=[];const tri=(a,b,c)=>{if(!shut(a,b,c))idx.push(a,b,c)};for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;tri(a,c,b);tri(b,c,d)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));
  const m=new THREE.Mesh(geo,M.terrain);m.receiveShadow=true;m.name='terreno';world.add(m);
  // agua helada: un plano al nivel del hielo que solo asoma donde el terreno queda por debajo (lago, río y arroyo)
  const ice=new THREE.Mesh(new THREE.PlaneGeometry(B.x1-B.x0,B.z1-B.z0).rotateX(-Math.PI/2),M.ice);ice.position.set(BCX,LAKE_Y,BCZ);ice.renderOrder=1;world.add(ice);// sin sombras: en un plano tan grande salían rayas
  // canto del tablero: listón de madera barnizada que sigue el perfil del terreno
  const fp=[],fu=[],fi=[];const edge=pts=>{const b0=fp.length/3;let acc=0;pts.forEach(([x,z],k)=>{if(k)acc+=Math.hypot(x-pts[k-1][0],z-pts[k-1][1]);const y=Math.max(groundAt(x,z),LAKE_Y)+0.06;fp.push(x,y,z,x,-1.25,z);fu.push(acc/6,y/6,acc/6,-0.2)});for(let k=0;k<pts.length-1;k++){const a=b0+k*2;fi.push(a,a+1,a+2,a+2,a+1,a+3)}};
  const along=(x0,z0,x1,z1)=>{const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/res);return Array.from({length:n+1},(_,k)=>[lerp(x0,x1,k/n),lerp(z0,z1,k/n)])};
  edge(along(B.x0,B.z1,B.x1,B.z1));edge(along(B.x1,B.z1,B.x1,B.z0));edge(along(B.x1,B.z0,B.x0,B.z0));edge(along(B.x0,B.z0,B.x0,B.z1));
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fg.setAttribute('uv',new THREE.Float32BufferAttribute(fu,2));fg.setIndex(fi);fg.computeVertexNormals();
  const fm=new THREE.Mesh(fg,M.fascia);fm.receiveShadow=true;world.add(fm)}// (sin caja debajo: su cara de arriba coincidía con el hielo y salían rayas)
/* vía con balasto, tres carriles de juguete y traviesas; sube y baja con el terreno */
function buildTrack(B){const dy=B.b?-0.02:0,bed=[[-GAUGE-1.6,-0.06],[-GAUGE-1.0,0.3],[GAUGE+1.0,0.3],[GAUGE+1.6,-0.06]].map(([o,y])=>[o,y+dy]);// el ramal, un pelo más bajo: donde se junta con la principal no parpadea
  world.add(ext3(bed,B.i0,B.n,2,M.roadbed));
  const tube=(o,rr,y)=>Array.from({length:9},(_,q)=>{const a=q/8*Math.PI*2;return [o+Math.cos(a)*rr,y+dy+Math.sin(a)*rr]});
  {const rs=[tube(GAUGE,0.15,0.6),tube(-GAUGE,0.15,0.6),tube(0,0.1,0.52)].map(pr=>ext3(pr,B.i0,B.n,1,M.rail).geometry),rm=new THREE.Mesh(mergeGeometries(rs,false),M.rail);rs.forEach(g=>g.dispose());rm.receiveShadow=true;world.add(rm)}// un draw call para los tres
  const s0=B.i0*T.ds,at=[];for(let q=0;q<Math.floor(B.n*T.ds/1.25);q++){const p=atM(T,s0+q*1.25);if(B.b&&branchNear(MP.G,B.b,p.x,p.y,p.z,0.9))continue;at.push(p)}
  const sl=new THREE.InstancedMesh(new THREE.BoxGeometry(0.42,0.16,GAUGE*2+1.3),M.sleeper,at.length);
  at.forEach((p,i)=>{o3.position.set(p.x,p.y+0.38+dy,p.z);o3.rotation.set(0,-p.a,p.p,'YZX');o3.scale.set(1,1,1);o3.updateMatrix();sl.setMatrixAt(i,o3.matrix)});o3.rotation.set(0,0,0);sl.receiveShadow=true;world.add(sl)}
/* puentes: tablero y pretiles de piedra y pilas hasta el suelo */
function buildBridges(B){for(const r of B.runs){if(r.k!==KB)continue;const i0=r.i-12,n=r.n+24;// el tablero sigue 6 m por cada lado: hace de estribo
  const st3=m=>{m.userData.st=true;m.castShadow=true;world.add(m)};st3(ext3([[-2.7,0.0],[2.7,0.0],[2.7,-1.15],[-2.7,-1.15],[-2.7,0.0]],i0,n,2,M.stone));
  // pretiles: se abren donde el otro camino de una aguja entra o sale
  for(const sd of[-1,1]){let a=-1;for(let q=0;q<=n+2;q+=2){const k=((i0+Math.min(q,n))%T.N+T.N)%T.N,ok=q<=n&&!branchNear(MP.G,B.b,T.x[k]-Math.sin(T.a[k])*sd*2.5,T.y[k],T.z[k]+Math.cos(T.a[k])*sd*2.5,3.2);
    if(ok&&a<0)a=q;else if(!ok&&a>=0){const m=Math.min(q-2,n)-a;if(m>=6){st3(ext3([[sd*2.75,0.0],[sd*2.75,1.0],[sd*2.3,1.0],[sd*2.3,0.0]],i0+a,m,2,M.stone2));st3(ext3([[sd*2.82,1.0],[sd*2.82,1.18],[sd*2.25,1.18],[sd*2.25,1.0]],i0+a,m,2,M.snow))}a=-1}}}
  for(let q=10;q<r.n-6;q+=18){const k=(r.i+q)%T.N,x=T.x[k],z=T.z[k],top=T.y[k]-1.15,gy=groundAt(x,z)-0.8,hh=top-gy;if(hh<0.8||otherNear(MP.G,B.u0+(k-B.i0+T.N)%T.N,x,z,5.5))continue;// ninguna pila encima de la vía de abajo
    const p=new THREE.Mesh(boxU(1.9,hh,4.7),M.stone);p.position.set(x,gy+hh/2,z);p.rotation.y=-T.a[k];p.castShadow=p.receiveShadow=true;p.userData.st=true;world.add(p);
    const ft=new THREE.Mesh(boxU(2.6,0.9,5.4),M.stone2);ft.position.set(x,gy+0.45,z);ft.rotation.y=-T.a[k];ft.userData.st=true;world.add(ft);PIERS.push({x,z,y:gy+0.8,a:T.a[k]})}}}
/* túneles: por dentro, una gruta de hielo con farolillos, tan ancha como deje la montaña; en cada extremo, boca de piedra con arco */
let CAVES=[];
const caveY=(W,H,o)=>H*Math.pow(Math.max(0,1-(o/W)**2),0.375);// altura del techo a o metros del eje
function caveDims(r){const n=Math.ceil(r.n/2),W0=new Float32Array(n+1),W=new Float32Array(n+1),H=new Float32Array(n+1);
  for(let q=0;q<=n;q++){const k=(r.i+Math.min(r.n-1,q*2))%T.N,lx=-Math.sin(T.a[k]),lz=Math.cos(T.a[k]);let w=8;
    for(;w>3.6;w-=0.4){let fits=true;const h=6.9+(w-3.6)*0.48;for(let o=-w;o<=w&&fits;o+=w/6)if(groundAt(T.x[k]+lx*o,T.z[k]+lz*o)-T.y[k]<caveY(w,h,o)+0.9)fits=false;if(fits)break}
    W0[q]=Math.max(3.6,Math.min(w,3.6+Math.max(0,Math.min(q,n-q)*2*T.ds-3.4)*0.7))}
  for(let q=0;q<=n;q++){let m=9,a=0,c=0;for(let d=-2;d<=2;d++){const v=W0[clamp(q+d,0,n)];m=Math.min(m,v);a+=v;c++}W[q]=Math.max(3.6,(m+a/c)/2);H[q]=6.9+(W[q]-3.6)*0.48}
  return {i:r.i,n:r.n,m:n,W,H,x:T.x[(r.i+4)%T.N],z:T.z[(r.i+4)%T.N]}}
/* ancho de la gruta en s (0 si ahí no hay túnel) */
function caveW(T,s){const i=Math.floor((((s%T.L)+T.L)%T.L)/T.ds)%T.N;for(const c of T.caves){const q=((i-c.i)%T.N+T.N)%T.N;if(q<c.n)return c.W[Math.min(c.m,Math.round(q/2))]}return 0}
/* s de la cámara dentro de la gruta: nunca en la boca de piedra (a 3,5 m como poco de los extremos) */
function caveClamp(T,s0,sc){const L=T.L,m=x=>((x%L)+L)%L;for(const c of T.caves){const a=c.i*T.ds,len=c.n*T.ds,u=m(s0+3-a);if(u<len+6)return a+clamp(u-3+(sc-s0),3.5,len-3.5)}return sc}
function buildCave(r){const C=caveDims(r),{m,W,H}=C,ring=22,P=[],lamps=[],rnd=rng(77+r.i);CAVES.push(C);
  const frame=q=>{const k=(r.i+Math.min(r.n-1,q*2))%T.N;return {x:T.x[k],y:T.y[k],z:T.z[k],lx:-Math.sin(T.a[k]),lz:Math.cos(T.a[k])}};
  for(let q=0;q<=m;q++){const f=frame(q),row=[],rough=sstep(3.7,5.5,W[q]);
    for(let j=0;j<=ring;j++){const fl=j>ring-5,ph=j/(ring-5)*Math.PI;let o,h;if(fl){o=lerp(W[q],-W[q],(j-(ring-5))/5);h=-0.14}else{const k2=1-rough*0.11*vnoise(q*0.55+r.i,j*0.8);o=-Math.cos(ph)*W[q]*k2;h=-0.14+H[q]*Math.pow(Math.sin(ph),0.75)*k2}
      row.push(new THREE.Vector3(f.x+f.lx*o,f.y+h,f.z+f.lz*o))}
    P.push(row);
    if(q>2&&q<m-2&&q%5===0){const sd=(q/5)%2?1:-1,o=sd*W[q]*0.76;lamps.push(new THREE.Vector3(f.x+f.lx*o,f.y+caveY(W[q],H[q],o)*0.86,f.z+f.lz*o))}}
  // color pintado: hielo azul, más claro arriba, con charcos de luz cálida junto a los farolillos y cada cara con su tono
  const pos=[],col=[],c=new THREE.Vector3(),e1=new THREE.Vector3(),e2=new THREE.Vector3(),deep=new THREE.Color('#16305c'),ice=new THREE.Color('#6fa3d6'),snowC=new THREE.Color('#a9bfe0'),warm=new THREE.Color(1,.6,.26),cc=new THREE.Color();
  const tri=(a,b,d,floor)=>{c.copy(a).add(b).add(d).multiplyScalar(1/3);e1.subVectors(b,a);e2.subVectors(d,a);e1.cross(e2).normalize();const n=0.5+0.5*e1.dot(UPV)*-1;cc.copy(deep).lerp(floor?snowC:ice,floor?0.55:0.25+0.45*n+0.3*rnd());
    let g=0;for(const l of lamps)g+=Math.exp(-l.distanceToSquared(c)/7);cc.multiplyScalar(0.42);cc.r+=warm.r*g*0.5;cc.g+=warm.g*g*0.5;cc.b+=warm.b*g*0.5;
    for(const v of[a,b,d]){pos.push(v.x,v.y,v.z);col.push(Math.min(.78,cc.r),Math.min(.78,cc.g),Math.min(.8,cc.b))}};
  for(let q=0;q<m;q++)for(let j=0;j<ring;j++){const a=P[q][j],b=P[q+1][j],d=P[q+1][j+1],e=P[q][j+1],fl=j>=ring-5;tri(a,b,d,fl);tri(a,d,e,fl)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  world.add(new THREE.Mesh(g,M.cave));
  // farolillos, guirnalda de luces de colores por el techo y carámbanos
  const inst3=(geo,mat,list,fn)=>{if(!list.length)return;const im=new THREE.InstancedMesh(geo,mat,list.length);list.forEach((v,i)=>{o3.rotation.set(0,0,0);o3.scale.set(1,1,1);fn(v,i,im);o3.updateMatrix();im.setMatrixAt(i,o3.matrix)});o3.scale.set(1,1,1);if(im.instanceColor)im.instanceColor.needsUpdate=true;world.add(im)};
  inst3(new THREE.SphereGeometry(0.26,12,8),M.lamp,lamps,v=>o3.position.copy(v));
  const fairy=[],ics=[],pal=[[2.4,.4,.5],[2.4,1.8,.5],[.5,1.2,2.6],[.6,2.4,.8]];
  for(let q=1;q<m;q++){const f=frame(q);for(const sd of[-1,1]){const o=sd*W[q]*0.6;fairy.push(new THREE.Vector3(f.x+f.lx*o,f.y+caveY(W[q],H[q],o)*0.84-0.1+Math.sin(q*1.3)*0.16,f.z+f.lz*o))}
    if(W[q]>4.6&&rnd()<0.8){const o=(rnd()-.5)*W[q]*1.3;ics.push({x:f.x+f.lx*o,y:f.y+caveY(W[q],H[q],o)*0.95,z:f.z+f.lz*o,l:0.4+rnd()*0.9})}}
  inst3(new THREE.SphereGeometry(0.1,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),fairy,(v,i,im)=>{o3.position.copy(v);im.setColorAt(i,new THREE.Color(...pal[i%4]))});
  const ig=new THREE.ConeGeometry(0.17,1,6);ig.rotateX(Math.PI);ig.translate(0,-0.5,0);inst3(ig,M.icicle,ics,v=>{o3.position.set(v.x,v.y,v.z);o3.scale.set(1,v.l,1)})}
function buildTunnels(B){
  for(const r of B.runs){if(r.k!==KT)continue;buildCave({k:KT,i:r.i-4,n:r.n+8});// la gruta sobresale 2 m por cada boca, por dentro de la fachada
    for(const end of[0,1]){const k=end?(r.i+r.n-1)%T.N:r.i,x=T.x[k],y=T.y[k],z=T.z[k],a=T.a[k],dx=Math.cos(a),dz=Math.sin(a),lx=-Math.sin(a),lz=Math.cos(a),into=end?-1:1,hw=8.5;
      let step=0;for(let o=-hw;o<=hw;o+=1.5)step=Math.max(step,groundAt(x+dx*into*1.4+lx*o,z+dz*into*1.4+lz*o)-y);const hh=clamp(step+0.6,7.6,15);
      const s=new THREE.Shape();s.moveTo(-hw,-0.8);s.lineTo(-3.1,-0.8);s.lineTo(-3.1,3.3);s.absarc(0,3.3,3.1,Math.PI,0,true);s.lineTo(3.1,-0.8);s.lineTo(hw,-0.8);s.lineTo(hw,hh*0.82);s.quadraticCurveTo(hw*0.55,hh,0,hh);s.quadraticCurveTo(-hw*0.55,hh,-hw,hh*0.82);s.closePath();
      const g=new THREE.ExtrudeGeometry(s,{depth:4.2,bevelEnabled:true,bevelThickness:.16,bevelSize:.16,bevelSegments:1,curveSegments:16});g.translate(0,0,-2.1);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);
      const pm=new THREE.Mesh(g,M.stone);const fo=into*(coarse?0.8:0.35);pm.position.set(x-dx*fo,y,z-dz*fo);pm.rotation.y=Math.PI/2-a;pm.castShadow=pm.receiveShadow=true;pm.userData.st=true;world.add(pm);
      const ar=new THREE.Shape();ar.absarc(0,3.3,3.75,0,Math.PI,false);ar.absarc(0,3.3,3.1,Math.PI,0,true);ar.closePath();const ag=new THREE.ExtrudeGeometry(ar,{depth:4.9,bevelEnabled:false,curveSegments:16});ag.translate(0,0,-2.45);
      const am=new THREE.Mesh(ag,M.stone2);am.position.copy(pm.position);am.rotation.copy(pm.rotation);am.userData.st=true;world.add(am);
      // nieve encima de la fachada (sigue su curva) y un caparazón nevado sobre los primeros metros de gruta, por si la ladera queda baja
      const cs=new THREE.Shape(),e0=hh*0.82,wc=hw+0.3;cs.moveTo(-wc,e0-0.1);cs.quadraticCurveTo(-hw*0.55,hh-0.1,0,hh-0.1);cs.quadraticCurveTo(hw*0.55,hh-0.1,wc,e0-0.1);cs.lineTo(wc,e0+0.35);cs.quadraticCurveTo(hw*0.55,hh+0.5,0,hh+0.5);cs.quadraticCurveTo(-hw*0.55,hh+0.5,-wc,e0+0.35);cs.closePath();
      const cg=new THREE.ExtrudeGeometry(cs,{depth:4.9,bevelEnabled:false,curveSegments:12});cg.translate(0,0,-2.45);const cap=new THREE.Mesh(cg,M.snow);cap.position.copy(pm.position);cap.rotation.copy(pm.rotation);cap.userData.st=true;
      const sh=ext3(Array.from({length:13},(_,j)=>{const t=j/12*Math.PI;return [Math.cos(t)*6.2,8.6*Math.pow(Math.sin(t),0.6)-0.5]}),end?r.i+r.n-21:r.i+1,20,2,M.snow);sh.userData.st=true;world.add(sh);world.add(cap)}}}

/* árbol de Navidad (el del salón y el de la plaza): el mismo, a otra escala */
function buildTree(par,x,y,z,sc){
  const R=17,r=rng(7+Math.round(sc*100)),g=new THREE.Group(),H=R*2.5;
  const stand=cyl(R*0.24,R*0.3,7,M.red,24);stand.position.y=3.5;g.add(stand);
  const skirt=new THREE.Mesh(new THREE.RingGeometry(R*0.3,R*0.95,48,1).rotateX(-Math.PI/2),M.felt);skirt.position.y=0.25;skirt.receiveShadow=true;g.add(skirt);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(R*0.95,0.9,8,64),M.fur);trim.rotation.x=Math.PI/2;trim.position.y=0.4;g.add(trim);
  const core=new THREE.Mesh(new THREE.ConeGeometry(R*0.4,H*0.86,24),M.core);core.position.y=H*0.43+12;g.add(core);
  const wh=24,per=14,n=wh*per,br=new THREE.InstancedMesh(branchGeo,M.branch,n),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(),col=new THREE.Color();let k=0;const tips=[];
  const y0=12.5;
  for(let i=0;i<wh;i++){const u=i/wh,yy=y0+(H-y0)*0.94*u,L=R*Math.pow(1-u,0.95)+1.2;const pitch0=-Math.min(0.45,Math.asin(Math.min(1,Math.max(0,yy-10)/L)));
    for(let j=0;j<per;j++){const phi=j/per*Math.PI*2+i*0.7,pitch=pitch0+(hash2(i,j)-.5)*0.12;q.setFromEuler(e.set(0,phi,pitch,'YZX'));p.set(0,yy,0);s.set(L,1,L);m4.compose(p,q,s);br.setMatrixAt(k,m4);col.setHSL(0.36,0.25,0.72+hash2(i,j*3)*0.28);br.setColorAt(k,col);k++;
      if(j%2===0)tips.push([Math.cos(phi)*L*0.82,yy+Math.sin(pitch)*L*0.82-1.2,-Math.sin(phi)*L*0.82])}}
  br.instanceColor.needsUpdate=true;br.castShadow=br.receiveShadow=true;g.add(br);
  const radAt=yy=>{const u=Math.min(1,Math.max(0,(yy-y0)/((H-y0)*0.94)));return (R*Math.pow(1-u,0.95)+1.2)*0.8};
  const NB=coarse?150:220,lights=new THREE.InstancedMesh(new THREE.SphereGeometry(0.385,6,5),new THREE.MeshBasicMaterial({color:0xffffff}),NB),base=[];
  const pal=[[3,.4,.5],[3,2.3,.5],[.5,1.4,3],[.7,3,.9],[3,.9,2.4]],o=new THREE.Object3D();
  for(let i=0;i<NB;i++){const t=i/NB,yy=y0+2+t*(H-y0-4),ang=t*Math.PI*2*10,rr=radAt(yy);o.position.set(Math.cos(ang)*rr,yy-1,Math.sin(ang)*rr);o.scale.set(0.8,1.3,0.8);o.updateMatrix();lights.setMatrixAt(i,o.matrix);const c=new THREE.Color(...pal[i%5]);base.push(c);lights.setColorAt(i,c)}
  g.add(lights);
  const orn=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshPhysicalMaterial({roughness:.06,metalness:.85,clearcoat:1,iridescence:.4}),tips.length),oc=[0xd0202f,0xf0b93c,0xdfe6f2,0x2a6fd6,0x1f8a52];o.scale.set(1,1,1);
  tips.forEach((tp,i)=>{if(tp[1]<10)tp[1]=10;const sc2=(1.6+hash2(i,7)*1.4)*0.57;o.position.set(...tp);o.scale.setScalar(sc2);o.updateMatrix();orn.setMatrixAt(i,o.matrix);orn.setColorAt(i,new THREE.Color(oc[i%5]))});orn.instanceColor.needsUpdate=true;orn.castShadow=true;g.add(orn);
  const sh=new THREE.Shape();for(let i=0;i<10;i++){const rr=i%2?2.2:5.2,a=Math.PI/2+i*Math.PI/5;i?sh.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):sh.moveTo(Math.cos(a)*rr,Math.sin(a)*rr)}
  const stg=new THREE.ExtrudeGeometry(sh,{depth:1.4,bevelEnabled:true,bevelSize:.3,bevelThickness:.3,bevelSegments:2});stg.translate(0,0,-0.7);
  const star=new THREE.Mesh(stg,new THREE.MeshBasicMaterial({color:new THREE.Color(4,3,1)}));star.position.y=H+16;g.add(star);MOVING.add(star);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(R*5,R*5).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:dotTex,color:new THREE.Color(1.1,.62,.28),transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.y=0.6;g.add(glow);
  g.position.set(x,y,z);g.scale.setScalar(sc);par.add(g);g.updateMatrixWorld(true);
  return {lights,base,star,glow,top:g.localToWorld(new THREE.Vector3(0,H+16,0))}}

/* Papá Noel: abrigo de terciopelo, cinturón, barba, gorro y un brazo para saludar */
function santaFig(){const L=[],g=new THREE.Group(),W=M.fur;
  part(L,CY(0.55,0.75,1.4,16),M.velvet,0,1.5,0);part(L,SPH(0.68,16,12),M.velvet,0.08,1.28,0);part(L,TOR(0.74,0.13,20),W,0,0.84,0,Math.PI/2,0,0);
  part(L,TOR(0.66,0.1,20),TM.black,0.04,1.45,0,Math.PI/2,0,0);part(L,BX(0.1,0.28,0.32),TM.brass,0.74,1.45,0);
  for(const z of[-0.26,0.26]){part(L,CY(0.18,0.2,0.62,10),M.velvet,0,0.45,z);part(L,BX(0.52,0.3,0.32),TM.black,0.1,0.15,z)}
  part(L,SPH(0.36,16,12),M.skin,0,2.55,0);part(L,new THREE.ConeGeometry(0.4,0.75,14),W,0.14,2.22,0,0,0,Math.PI);part(L,SPH(0.09,8,6),M.skin,0.36,2.55,0);
  part(L,new THREE.ConeGeometry(0.38,0.8,16),M.velvet,-0.05,3.06,0,0,0,0.25);part(L,TOR(0.37,0.1,18),W,0,2.78,0,Math.PI/2,0,0);part(L,SPH(0.14,10,8),W,-0.26,3.44,0);
  part(L,CY(0.15,0.15,0.85,10),M.velvet,0.1,1.75,-0.74,-0.35,0,0);part(L,SPH(0.17,10,8),W,0.12,1.35,-0.88);
  fuse(L,g);
  const arm=new THREE.Group();arm.position.set(0,2.05,0.66);const am=new THREE.Mesh(CY(0.15,0.15,0.85,10).translate(0,-0.42,0),M.velvet),mit=new THREE.Mesh(SPH(0.17,10,8),W);mit.position.y=-0.9;am.castShadow=true;arm.add(am,mit);g.add(arm);
  return {g,arm}}

/* personitas (esquiadores, patinadores y gente en el telesilla): chaqueta y gorro con color por instancia; el resto con colores de vértice */
function personGeos(pose){const J=[],R=[],col=(g,c)=>{const n=g.attributes.position.count,a=new Float32Array(n*3),cc=new THREE.Color(c);for(let i=0;i<n;i++)a.set([cc.r,cc.g,cc.b],i*3);g.setAttribute('color',new THREE.BufferAttribute(a,3));return g},
  put=(L,g,c,x,y,z,rx=0,ry=0,rz=0)=>{_m.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(rx,ry,rz)),ONE);g.applyMatrix4(_m);g=geoOnly(g);if(c!==undefined)col(g,c);L.push(g)};
  const sit=pose==='sit',ski=pose==='ski',lean=ski?-0.28:0;
  put(J,CY(0.28,0.34,0.8,10),undefined,ski?0.1:0,1.2,0,0,0,lean);put(J,new THREE.ConeGeometry(0.21,0.42,10),undefined,ski?0.22:0,1.98,0);
  for(const sd of[-1,1])put(J,CY(0.085,0.085,0.7,6),undefined,ski?0.25:0.02,1.15,sd*0.38,sd*0.35,0,ski?-0.9:0);
  put(R,SPH(0.22,10,8),0xf0c3a2,ski?0.18:0,1.72,0);put(R,SPH(0.09,6,5),0xffffff,ski?0.22:0,2.22,0);put(R,CY(0.2,0.2,0.08,10),0xffffff,ski?0.18:0,1.84,0);
  for(const sd of[-1,1]){if(sit){put(R,CY(0.11,0.11,0.6,6),0x26303f,0.3,0.92,sd*0.14,0,0,Math.PI/2);put(R,CY(0.1,0.1,0.55,6),0x26303f,0.6,0.62,sd*0.14)}else put(R,CY(0.11,0.11,0.8,6),0x26303f,ski?0.05:0,0.42,sd*0.14,0,0,ski?-0.15:0);
    if(ski){put(R,BX(1.7,0.04,0.11),0xc8182c,0.2,0.03,sd*0.16);put(R,CY(0.022,0.022,1.25,4),0x30343c,0.55,0.62,sd*0.48,0,0,0.45)}else if(!sit)put(R,BX(0.36,0.06,0.1),0xdfe6f2,0.04,0.03,sd*0.14)}
  const j=mergeGeometries(J,false),r=mergeGeometries(R,false);if(sit){j.translate(0,-0.92,0);r.translate(0,-0.92,0)}return {j,r}}
const JACKETS=[0xc8182c,0x1f6fd6,0x1f8a52,0xf0b93c,0x7d4f72,0xe8e2d4,0xff7a2e,0x2a2f3a];
function crowd(pose,n,par){const g=personGeos(pose),jm=new THREE.InstancedMesh(g.j,M.person,n),rm=new THREE.InstancedMesh(g.r,M.personV,n);for(let i=0;i<n;i++)jm.setColorAt(i,new THREE.Color(JACKETS[(i*3+pose.length)%JACKETS.length]));jm.instanceColor.needsUpdate=true;
  [jm,rm].forEach(m=>{m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;par.add(m)});return {jm,rm,n}}

/* taller de Papá Noel junto a la vía: aquí se cargan los regalos */
function buildStation(r){const S=MP.st,g=new THREE.Group();
  box(26,1.0,5,M.conc,0,0.5,0,g);box(26,0.06,0.35,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.2,.3)}),0,1.03,-2.3,g);
  [-9,-3,3,9].forEach(x=>{const c=cyl(0.14,0.14,4.4,M.dark,10);c.position.set(x,3.2,1.6);g.add(c)});
  box(21,0.25,4.6,M.roofEdge,0,5.45,0.6,g);box(21.4,0.4,5,M.snow,0,5.75,0.6,g);
  const hb=house(r,HMAT[0]);hb.position.set(-3,1,7.2);hb.rotation.y=Math.PI;g.add(hb);
  [-6,6].forEach(x=>{const hd=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,8),M.lamp);hd.position.set(x,4.9,0.6);g.add(hd)});
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(6,1.5),new THREE.MeshBasicMaterial({map:signTex('Taller','de Papá Noel'),side:THREE.DoubleSide}));sg.position.set(0,6.7,0.6);sg.rotation.y=Math.PI;g.add(sg);
  const bench=obj('bench',1.6);bench.position.set(5,1,1.4);bench.rotation.y=Math.PI;g.add(bench);
  [-12,12].forEach(x=>{const l=obj('lantern',6.5);l.position.set(x,1,-1.2);g.add(l)});
  const pile=new THREE.Group();[['presA',2.2,0,0],['presB',1.8,1.6,0.6],['presC',1.6,0.6,1.6],['presD',1.2,0.8,0.5,2.2],['presA',1.5,-1.4,1.2],['presB',1.3,2.4,1.9]].forEach(([q,h,x,z,y])=>{const o=obj(q,h);o.position.set(x-8,1+(y||0),z+0.2);o.rotation.y=x;pile.add(o)});pile.updateMatrixWorld(true);{const ps=[...pile.children],mm=mergeMeshes(ps);pile.clear();mm.forEach(m=>pile.add(m))}g.add(pile);
  const nut=obj('nut',5.2);nut.position.set(-4.5,1,-0.6);nut.rotation.y=Math.PI;g.add(nut);
  g.traverse(c=>{if(c.isMesh&&c!==nut&&c.parent!==pile)c.userData.st=true});
  const sa=santaFig();sa.g.position.set(2.4,1,-1.3);sa.g.rotation.y=Math.PI/2;sa.g.scale.setScalar(1.15);g.add(sa.g);SANTA=sa;MOVING.add(sa.arm);MOVING.add(pile);MOVING.add(nut);
  g.position.set(T.x[0]+S.nx*5.2,T.y[0],T.z[0]+S.nz*5.2);g.rotation.y=Math.atan2(S.nx,S.nz);world.add(g);
  g.updateMatrixWorld(true);STN={pile,nut,hop:0,base:nut.rotation.y,pileWorld:pile.localToWorld(new THREE.Vector3(-8,2,0.6)),x:g.position.x,z:g.position.z}}
/* plaza del pueblo: árbol iluminado, farolas, bancos y regalos */
function buildPlaza(r){const P=F.plaza,y=groundAt(P.x,P.z);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(P.r,40).rotateX(-Math.PI/2),M.cobble);disc.position.set(P.x,y+0.05,P.z);disc.receiveShadow=true;world.add(disc);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(P.r,0.35,6,64),M.snow);ring.rotation.x=Math.PI/2;ring.position.set(P.x,y+0.1,P.z);ring.userData.st=true;world.add(ring);
  treeParts=[buildTree(world,P.x,y,P.z,0.42)];
  const lp=[];for(let k=0;k<6;k++){const a=k/6*Math.PI*2+0.3;lp.push({x:P.x+Math.cos(a)*(P.r-1.4),z:P.z+Math.sin(a)*(P.r-1.4),y,h:5.4,r:a})}inst('lantern',lp,true,world);
  const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(0.26,12,8),M.lamp,lp.length);lp.forEach((q,i)=>{o3.position.set(q.x,y+5.4*0.78,q.z);o3.updateMatrix();heads.setMatrixAt(i,o3.matrix)});world.add(heads);
  for(let k=0;k<3;k++){const a=k/3*Math.PI*2+1.1,b=obj('bench',1.6);b.position.set(P.x+Math.cos(a)*(P.r-3.4),y,P.z+Math.sin(a)*(P.r-3.4));b.rotation.y=-a-Math.PI/2;b.userData.st=true;world.add(b)}
  ['presA','presB','presC','presD','presA','presB','presC'].forEach((q,k)=>{const a=k/7*Math.PI*2+r(),rr=3.6+r()*1.2,o=obj(q,1.0+r()*0.8);o.position.set(P.x+Math.cos(a)*rr,y+0.25,P.z+Math.sin(a)*rr);o.rotation.y=r()*6;o.userData.st=true;world.add(o)});
  [0,1].forEach(k=>{const a=2.4+k*0.5,s=obj(k?'ginger2':'ginger',2.4);s.position.set(P.x+Math.cos(a)*(P.r-2.2),y,P.z+Math.sin(a)*(P.r-2.2));s.rotation.y=-a;world.add(s);anim({k:'ginger',o:s,y,ph:k*1.3})});
  const sm=obj('snowman',3.6);sm.position.set(P.x+Math.cos(4.4)*(P.r-2),y,P.z+Math.sin(4.4)*(P.r-2));sm.rotation.y=r()*6;world.add(sm);anim({k:'snowman',o:sm,ph:2})}
/* estación de esquí: pista con banderines, esquiadores, telesilla y casetas */
function buildSki(r){const P=F.piste,seg=[];let Lp=0;for(let i=0;i<P.length-1;i++){const dx=P[i+1][0]-P[i][0],dz=P[i+1][1]-P[i][1],l=Math.hypot(dx,dz);seg.push({x:P[i][0],z:P[i][1],dx:dx/l,dz:dz/l,l,s0:Lp});Lp+=l}
  const at=s=>{s=clamp(s,0,Lp-0.01);let g=seg[0];for(const q of seg)if(s>=q.s0)g=q;const u=s-g.s0;return {x:g.x+g.dx*u,z:g.z+g.dz*u,dx:g.dx,dz:g.dz}};
  const fl=[];for(let s=3;s<Lp-2;s+=6.5)for(const sd of[-1,1]){const q=at(s),x=q.x-q.dz*sd*7,z=q.z+q.dx*sd*7;fl.push([x,groundAt(x,z),z,(Math.round(s/6.5)+(sd>0?1:0))%2])}
  const fm=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08,0.08,1.8,5).translate(0,0.9,0),new THREE.MeshStandardMaterial({roughness:.5}),fl.length);fl.forEach(([x,y,z,c],i)=>{o3.position.set(x,y,z);o3.updateMatrix();fm.setMatrixAt(i,o3.matrix);fm.setColorAt(i,new THREE.Color(c?0xd0202f:0x2a6fd6))});fm.instanceColor.needsUpdate=true;world.add(fm);
  const n=coarse?6:9,c=crowd('ski',n,world);SKI={at,L:Lp,...c,list:Array.from({length:n},(_,i)=>({s:i/n*Lp,v:3+r()*1.6,f:1.1+r()*0.7,ph:r()*6}))};
  const b=P[P.length-1],hut=house(r,HMAT[2]);hut.position.set(b[0]-9,groundAt(b[0]-9,b[1]+2),b[1]+2);hut.rotation.y=Math.PI*0.5;hut.userData.st=true;hut.traverse(o=>{if(o.isMesh)o.userData.st=true});world.add(hut);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(7,1.75),new THREE.MeshBasicMaterial({map:signTex('Pista de esquí','Telesilla'),side:THREE.DoubleSide}));sg.position.set(b[0]+6,groundAt(b[0]+6,b[1]+3)+3.6,b[1]+3);world.add(sg);
  const pp=new THREE.Mesh(CY(0.12,0.12,3.6,6).translate(0,1.8,0),M.dark);pp.position.set(b[0]+6,groundAt(b[0]+6,b[1]+3),b[1]+3);pp.userData.st=true;world.add(pp);
  buildLift(r)}
function buildLift(r){const [b,t]=F.lift,dx=t[0]-b[0],dz=t[1]-b[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,nx=-uz,nz=ux,yaw=Math.atan2(uz,ux);
  const nT=Math.round(len/11),TW=[];for(let k=0;k<=nT;k++){const s=k/nT*len,x=b[0]+ux*s,z=b[1]+uz*s;TW.push({s,x,z,y:groundAt(x,z)+(k===0||k===nT?6:9.5)})}
  const L=[];for(const w of TW){part(L,CY(0.22,0.32,w.y-groundAt(w.x,w.z)+0.4,8),TM.black,w.x,(w.y+groundAt(w.x,w.z))/2-0.2,w.z);part(L,BX(0.3,0.3,4.2),TM.black,w.x,w.y,w.z,0,-yaw,0)}
  const up=new THREE.Vector3();for(let k=0;k<TW.length-1;k++)for(const sd of[-1,1]){const A=new THREE.Vector3(TW[k].x+nx*1.7*sd,TW[k].y+0.15,TW[k].z+nz*1.7*sd),B=new THREE.Vector3(TW[k+1].x+nx*1.7*sd,TW[k+1].y+0.15,TW[k+1].z+nz*1.7*sd),l=A.distanceTo(B),g=CY(0.045,0.045,l,5);
    _q.setFromUnitVectors(UPV,up.subVectors(B,A).normalize());_m.compose(_p.addVectors(A,B).multiplyScalar(0.5),_q,ONE);g.applyMatrix4(_m);L.push([g,TM.black])}
  fuse(L,world).forEach(m=>m.castShadow=true);
  const cy=s=>{let k=0;while(k<TW.length-2&&TW[k+1].s<s)k++;const a=TW[k],c=TW[k+1];return lerp(a.y,c.y,clamp((s-a.s)/(c.s-a.s),0,1))};
  // sillas con colores de vértice: asiento rojo y hierro oscuro
  const CL=[],cc=(g,c)=>{g=geoOnly(g);const n=g.attributes.position.count,a=new Float32Array(n*3),q=new THREE.Color(c);for(let i=0;i<n;i++)a.set([q.r,q.g,q.b],i*3);g.setAttribute('color',new THREE.BufferAttribute(a,3));CL.push(g)};
  cc(BX(1.0,0.12,1.5).translate(0.1,0,0),0xc8182c);cc(BX(0.12,0.8,1.5).translate(-0.4,0.42,0),0xc8182c);cc(CY(0.04,0.04,2.3,5).translate(-0.2,1.3,0),0x22252b);cc(BX(0.08,0.08,1.6).translate(-0.2,2.45,0),0x22252b);
  const n=coarse?10:14,cm=new THREE.InstancedMesh(mergeGeometries(CL,false),M.personV,n);cm.castShadow=true;cm.frustumCulled=false;world.add(cm);
  const riders=crowd('sit',n,world);
  LIFT={b,len,ux,uz,nx,nz,cy,n,cm,riders,pos:[]};
  for(const [x,z,rot] of[[b[0]+ux*-5,b[1]+uz*-5,yaw],[t[0]+ux*5,t[1]+uz*5,yaw+Math.PI]]){const h=house(r,HMAT[4]);h.position.set(x,groundAt(x,z),z);h.rotation.y=-rot+Math.PI/2;h.traverse(o=>{if(o.isMesh)o.userData.st=true});world.add(h)}}
/* lago helado: patinadores y montones de nieve en la orilla */
function buildLake(r){const n=coarse?4:6,c=crowd('skate',n,world);SKATE={...c,list:Array.from({length:n},(_,i)=>({ph:i/n*Math.PI*2,w:0.14+r()*0.08,k:i%3===0?2:1,rr:0.5+r()*0.25}))};
  const Lk=F.lake,piles=[];for(let k=0;k<14;k++){const a=k/14*Math.PI*2+r()*0.3,x=Lk.x+Math.cos(a)*Lk.rx*1.18,z=Lk.z+Math.sin(a)*Lk.rz*1.22;if(nearTrack(MP.G,x,z,12).d<8)continue;piles.push({x,z,y:groundAt(x,z)-0.3,h:1.2+r()*1.4,r:r()*6})}
  inst('pile',piles,false,world)}
/* el trineo de Papá Noel da vueltas por encima de la maqueta (no depende de la etapa) */
function buildSleigh(){const g=new THREE.Group(),sl=obj('sled',1.9);sl.rotation.y=Math.PI/2;g.add(sl);
  const sa=santaFig();sa.g.scale.setScalar(0.72);sa.g.position.set(-0.3,0.55,0);g.add(sa.g);
  for(const [x,z] of[[4.4,-0.8],[4.4,0.8],[7.2,-0.8],[7.2,0.8]]){const d=obj('deer',2.7);d.position.set(x,0,z);d.rotation.y=Math.PI/2;g.add(d)}
  const sk=new THREE.Mesh(CY(0.03,0.03,6.4,4).rotateZ(Math.PI/2),TM.brass);sk.position.set(4.2,1.3,0);g.add(sk);
  g.updateMatrixWorld(true);const parts=[];g.traverse(o=>{if(o.isMesh)parts.push(o)});const merged=mergeMeshes(parts);parts.forEach(o=>o.parent.remove(o));g.clear();merged.forEach(m=>{m.castShadow=false;g.add(m)});scene.add(g);SLEIGH=g}
/* decorado: bosques, rocas en lo empinado, renos, muñecos de nieve y trineos */
function scatterScenery(r){const taken=[],P=F.plaza;
  const ok=(x,z,rad,minT)=>{if(x<BOARD.x0+4||x>BOARD.x1-4||z<BOARD.z0+4||z>BOARD.z1-4)return false;if(nearTrack(MP.G,x,z,18).d<minT+rad)return false;if(lakeE(x,z)<1.7||groundAt(x,z)<LAKE_Y+0.6)return false;
    if(pisteD(x,z)<rad+7.5||segDist(x,z,F.lift[0],F.lift[1])<rad+3.5)return false;if(Math.hypot(x-P.x,z-P.z)<P.r+rad+2)return false;if(Math.hypot(x-STN.x,z-STN.z)<17)return false;
    for(const s of SL)if(Math.hypot(s.x-x,s.z-z)<rad+6.5)return false;for(const [a,b,q] of taken)if(Math.hypot(a-x,b-z)<q+rad)return false;return true};
  const trees={treeA:[],treeB:[],treeC:[],treeD:[]},NT=LOWQ?110:240;
  for(let t=0;t<NT*16&&TREES.length<NT;t++){const x=lerp(BOARD.x0,BOARD.x1,r()),z=lerp(BOARD.z0+26,BOARD.z1,r()),y=groundAt(x,z),f=fbm(x*0.022+4,z*0.022);
    if(f<0.45||y>46||slopeAt(x,z)>1.15||!ok(x,z,2.2,6))continue;const q=['treeA','treeB','treeC','treeA','treeB','treeD'][Math.floor(r()*6)],hi=y>12,o={x,z,y:y-0.3,h:(hi?5:7)+r()*(hi?5:8),r:r()*6};trees[q].push(o);TREES.push(o);taken.push([x,z,2.2])}
  Object.entries(trees).forEach(([q,l])=>inst(q,l,true,world));blobs(TREES.filter(o=>o.y<4).map(o=>[o.x,o.z,o.h*0.3,o.y]),world);
  const rocks=[];for(let t=0;t<900&&rocks.length<(coarse?26:44);t++){const x=lerp(BOARD.x0,BOARD.x1,r()),z=lerp(BOARD.z0+30,BOARD.z1,r()),sl=slopeAt(x,z);if(sl<0.55||sl>2.4||!ok(x,z,2,5))continue;rocks.push({x,z,y:groundAt(x,z)-0.6,h:2.2+r()*2.8,r:r()*6});taken.push([x,z,2])}inst('rocks',rocks,true,world);
  const flat=(n,rad,fn)=>{let k=0;for(let t=0;t<n*60&&k<n;t++){const x=lerp(BOARD.x0+20,BOARD.x1-20,r()),z=lerp(-60,BOARD.z1-10,r());if(slopeAt(x,z)>0.25||groundAt(x,z)>4||!ok(x,z,rad,6))continue;fn(x,z,groundAt(x,z));taken.push([x,z,rad]);k++}};
  inst('pile',(()=>{const l=[];flat(12,2,(x,z,y)=>l.push({x,z,y:y-0.3,h:1.2+r()*1.4,r:r()*6}));return l})(),false,world);
  flat(3,3,(x,z,y)=>{const g=new THREE.Group();for(let i=0;i<2+Math.floor(r()*2);i++){const d1=obj('deer',3.8+r()*0.8);d1.position.set((r()-.5)*7,0,(r()-.5)*7);d1.rotation.y=r()*6;g.add(d1);anim({k:'deer',o:d1,base:d1.rotation.y,ph:r()*6})}g.position.set(x,y,z);world.add(g)});
  flat(4,2,(x,z,y)=>{const s=obj('snowman',4.2);s.position.set(x,y,z);s.rotation.y=r()*6;world.add(s);anim({k:'snowman',o:s,ph:r()*6})});
  flat(3,1.4,(x,z,y)=>{const s=obj(r()<.5?'ginger':'ginger2',2.4);s.position.set(x,y,z);s.rotation.y=r()*6;world.add(s);anim({k:'ginger',o:s,y,ph:r()*6})});
  flat(2,3,(x,z,y)=>{const s=obj('sled',1.8);s.position.set(x,y,z);s.rotation.y=r()*6;s.userData.st=true;world.add(s)})}
/* regalos gigantes y juguetes del salón alrededor del tablero (se desvanecen si tapan la maqueta) */
function giantPresent(x,z,sz,h,rot,tex){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({map:tex,roughness:.4,transparent:true});
  box(sz,h,sz,mat,0,h/2,0,g);const rb=new THREE.MeshStandardMaterial({color:0xe8c35a,metalness:.7,roughness:.25,transparent:true});
  box(sz+0.4,h+0.4,sz*0.12,rb,0,h/2,0,g);box(sz*0.12,h+0.4,sz+0.4,rb,0,h/2,0,g);
  [[0,0.7],[Math.PI,0.7],[Math.PI/2,0.5],[-Math.PI/2,0.5]].forEach(([a,s])=>{const t=new THREE.Mesh(new THREE.TorusGeometry(sz*0.13*s+sz*0.04,sz*0.035,10,24),rb);t.position.y=h+sz*0.1;t.rotation.set(Math.PI/2*0.4,a,0);t.position.x=Math.cos(a)*sz*0.1;t.position.z=Math.sin(a)*sz*0.1;g.add(t)});
  g.updateMatrixWorld(true);const parts=[...g.children],merged=mergeMeshes(parts);parts.forEach(o=>{g.remove(o);o.geometry.dispose()});merged.forEach(m=>g.add(m));
  g.position.set(x,-1.2,z);g.rotation.y=rot;world.add(g);GIANTS.push({o:g,mats:[mat,rb],a:Math.atan2(z-BCZ,x-BCX),r:Math.hypot(x-BCX,z-BCZ),op:1})}
function buildGiants(r){const ex=(BOARD.x1-BOARD.x0)/2,ez=(BOARD.z1-BOARD.z0)/2,n=LOWQ?3:8;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2+0.2+r()*0.3,sz=36+r()*42,k=1.25+r()*0.25;giantPresent(BCX+Math.cos(a)*ex*k,BCZ+Math.sin(a)*ez*k,sz,sz*(0.6+r()*0.6),r()*0.8,WRAPS[Math.floor(r()*WRAPS.length)])}
  const giant=(q,h,a,k)=>{const o=obj(q,h);o.material=o.material.clone();o.material.transparent=true;const x=BCX+Math.cos(a)*ex*k,z=BCZ+Math.sin(a)*ez*k;o.position.set(x,-1.2,z);world.add(o);GIANTS.push({o,mats:[o.material],a:Math.atan2(z-BCZ,x-BCX),r:Math.hypot(x-BCX,z-BCZ),op:1});return o};
  const a1=-0.4;giant('ginger',40,a1,1.3).rotation.set(-0.35,a1+Math.PI,0);
  giant('nut',58,a1+2.6,1.32).lookAt(BCX,-1.2,BCZ);
  [a1+1.2,a1+3.9].forEach((aa,i)=>giant(i?'caneG':'caneR',70,aa,1.22).rotation.set(0.25,aa,0))}

async function buildWorld(k){
  if(world){scene.remove(world);disposeObj(world)}world=new THREE.Group();scene.add(world);anims=[];decoG=null;arches=[];GIANTS=[];PIERS=[];TREES=[];treeParts=[];
  MP=mapOf(k);T=MP.T;SL=MP.SL;POLL=null;const r=rng(500+k*97);
  {const U=MP.U;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<U.N;i+=6){x0=Math.min(x0,U.x[i]);x1=Math.max(x1,U.x[i]);z0=Math.min(z0,U.z[i]);z1=Math.max(z1,U.z[i])}CTR.set((x0+x1)/2,4,(z0+z1)/2+(portrait()?6:13));HOME.w=x1-x0+36;HOME.d=z1-z0+44}
  buildTerrain();if(!FASTSTEP)await tick();
  // la vía principal y, después, cada ramal (runs: sus túneles y puentes; u0: su primera muestra en la unión)
  CAVES=[];let u0=0;[MP.T,...MP.alts].forEach((A,b)=>{const R=b?MP.R[1<<(b-1)]:MP.T,i0=b?Math.round(R.alt[b-1]/R.ds):0,runs=[];
    if(b)for(let i=0;i<A.N;){let n=1;while(i+n<A.N&&A.k[i+n]===A.k[i])n++;if(A.k[i])runs.push({k:A.k[i],i:i0+i,n});i+=n}
    const B={b,i0,n:A.N,runs:b?runs:R.runs,u0};u0+=A.N;T=R;buildTrack(B);buildBridges(B);buildTunnels(B)});
  T=MP.T;for(const R of MP.R)R.caves=R.runs.filter(r=>r.k===KT).map(r=>{const c=CAVES.find(q=>Math.hypot(q.x-R.x[r.i],q.z-R.z[r.i])<2);return c&&{...c,i:r.i-4,n:r.n+8}}).filter(Boolean);
  setDist(dist);buildForks();
  buildStation(r);buildPlaza(r);buildSki(r);buildLake(r);scatterScenery(r);buildGiants(r);
  batchStatic(world);freeze(world);
  // sombra: la luz de la luna cubre todo el tablero
  const S=178,dir=new THREE.Vector3(-60,120,-40).normalize();key.target.position.set(BCX,0,BCZ);key.position.copy(dir).multiplyScalar(420).add(key.target.position);
  Object.assign(key.shadow.camera,{left:-S,right:S,top:S,bottom:-S,near:1,far:900});key.shadow.camera.updateProjectionMatrix();key.target.updateMatrixWorld()}

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
function makeHouse(i){const sl=SL[i],r=rng(9001+i*131),g=house(r,HMAT[(i*5+st.stage)%6]);g.position.set(sl.x,sl.y,sl.z);g.rotation.y=Math.atan2(-sl.nx,-sl.nz);g.updateMatrixWorld(true);
  const chim=g.localToWorld(g.userData.chim.clone()),ev=[],ice=[],v=new THREE.Vector3();
  g.userData.eaves.forEach(([x0,x1,y,z])=>{for(let x=x0;x<=x1;x+=0.42){v.set(x,y,z);g.localToWorld(v);ev.push(v.clone());if(r()<0.7){const u=v.clone();u.y-=0.05;ice.push([u,0.25+r()*0.55])}}});
  return {g,chim,ev,ice,i,pop:1,landed:true,y0:sl.y}}
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

/* luces que llegan entre todos: farolas junto a la vía (nivel 2) y arcos de caramelo (nivel 3); las guirnaldas van con las casas */
let treeLightK=0.6;
function buildDeco(){const T=MP.T;if(decoG){world.remove(decoG);disposeObj(decoG)}decoG=new THREE.Group();world.add(decoG);arches=[];treeLightK=0.55+0.15*Math.min(3,st.lights);
  const okS=s=>s>22&&s<T.L-22&&[-6,0,6].every(q=>kindAt(T,s+q)===0);
  if(st.lights>=2){const pos=[];for(let s=14;s<T.L;s+=26){if(!okS(s))continue;const p=atM(T,s),side=(Math.round(s/26)%2?1:-1),x=p.x-Math.sin(p.a)*(GAUGE+3)*side,z=p.z+Math.cos(p.a)*(GAUGE+3)*side;
      if(SL.some(o=>Math.hypot(o.x-x,o.z-z)<7)||nearTrack(MP.G,x,z,8).d<GAUGE+2.6)continue;pos.push({x,z,y:groundAt(x,z),h:6.2,r:p.a})}
    inst('lantern',pos,true,decoG);const hy=6.2*0.78;
    if(pos.length){const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(0.42,12,8),M.lamp,pos.length),pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(10,10).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:dotTex,color:new THREE.Color(.6,.42,.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),pos.length);
      pos.forEach((q,i)=>{o3.rotation.set(0,0,0);o3.scale.set(1,1,1);o3.position.set(q.x,q.y+hy,q.z);o3.updateMatrix();heads.setMatrixAt(i,o3.matrix);o3.position.set(q.x,q.y+0.5,q.z);o3.updateMatrix();pools.setMatrixAt(i,o3.matrix)});pools.frustumCulled=false;decoG.add(heads,pools)}}
  if(st.lights>=3){[0.16,0.41,0.66,0.89].forEach((f,k)=>{const s=f*T.L;if(!okS(s))return;const p=atM(T,s),g=new THREE.Group();if([-1,1].some(q=>nearTrack(MP.G,p.x-Math.sin(p.a)*4.6*q,p.z+Math.cos(p.a)*4.6*q,8).d<4))return;
    const arc=new THREE.Mesh(new THREE.TorusGeometry(4.6,0.22,10,48,Math.PI),M.cane);arc.castShadow=true;g.add(arc);
    const n=26,bm=[0,1].map(()=>new THREE.InstancedMesh(new THREE.SphereGeometry(0.17,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),n/2)),pal=[[3,.5,.6],[3,2.2,.5],[.6,1.6,3],[.8,3,1]];
    for(let i=0;i<n;i++){const t=(i+0.5)/n*Math.PI;o3.position.set(Math.cos(t)*4.6,Math.sin(t)*4.6-0.3,0);o3.rotation.set(0,0,0);o3.scale.set(1,1,1);o3.updateMatrix();bm[i%2].setMatrixAt(i>>1,o3.matrix);bm[i%2].setColorAt(i>>1,new THREE.Color(...pal[(i+k)%4]))}
    bm.forEach(b=>{b.instanceColor.needsUpdate=true;g.add(b)});g.position.set(p.x,p.y+0.3,p.z);g.rotation.y=-(p.a+Math.PI/2);decoG.add(g);arches.push(bm)})}
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

/* ================= simulación: el tren reparte y la comunidad (simulada) vota ================= */
const flyers=[],flyQ=[];let burstBudget=0,noneT=0,claimT=12;
function flyGift(from,to,dur,arc,onEnd){let f=flyers.find(x=>!x.visible);if(!f){if(flyers.length>=16){onEnd&&onEnd();return}f=obj(['presB','presC','presD','presA'][flyers.length%4],1.2);f.castShadow=false;scene.add(f);flyers.push(f)}
  f.visible=true;f.position.copy(from);flyQ.push({f,from:from.clone(),to:to.clone(),t:0,dur,arc,onEnd})}
function atStation(){laps++;for(let k=1;k<WAG.length;k++)fillWagon(WAG[k]);
  if(FASTSTEP||!STN)return;STN.hop=1;loadS();
  for(let q=1;q<Math.min(WAG.length,4);q++){const W=WAG[q];flyGift(STN.pileWorld,W.localToWorld(tmpV.set(0,WTOP+0.8,0)),0.5,4)}}
function atHouse(i){const h=HS[i];if(!h)return;let W=null;for(let k=WAG.length-1;k>0;k--)if(WAG[k].userData.c>0){W=WAG[k];break}
  if(!W){starve++;if(!FASTSTEP&&noneT<=0){noneT=1.4;floatAt(h.chim,'sin regalo','none')}return}
  W.userData.c--;const val=sacoOf(st),me=i===st.mine;delivered++;st.total+=val;if(me)st.myGifts+=val;
  if(!FASTSTEP){W.localToWorld(tmpV.set((Math.random()-.5)*3,WTOP+0.3,0));const to=h.chim.clone();to.y+=0.4;
    flyGift(tmpV,to,0.6,6,()=>{puff(tmpV2.copy(h.chim).setY(h.chim.y+1.2),new THREE.Vector3(0,3,0),2.2,.42,1.2);
      if(me){burst(h.chim,70,8,[4,3,.8]);floatAt(h.chim,'¡Para ti! +'+fmtN(val),'me');kaching()}
      else{if(burstBudget>0){burstBudget--;burst(h.chim,24,5,[4,3,.8])}floatAt(h.chim,'+'+fmtN(val),'');chime()}})}}
function celebrate(){if(FASTSTEP)return;const P=treeParts[0];if(P){confettiBurst(P.top.clone(),24);bells()}}
/* objetivo del día cumplido: mañana (en la demo, ahora) llega la mejora */
function dayDone(){const d=st.day,rw=nextDay(st);save();
  news({via:`¡Objetivo del día ${d} cumplido entre todos! La vía llega ${('a '+STAGE_NAMES[st.stage].toLowerCase()).replace(/^a el /,'al ')}`,vagon:`¡Objetivo del día ${d} cumplido entre todos! El tren estrena otro vagón`,luces:`¡Objetivo del día ${d} cumplido entre todos! Se encienden más luces`}[rw]||`¡Objetivo del día ${d} cumplido entre todos!`,true);
  if(rw==='via'){expand();return}
  if(rw==='vagon')addWagon();else if(rw==='luces')buildDeco();
  celebrate();uiShop()}
function sim(dt){
  if(busy||!T)return;
  simClock+=dt;vCur+=(TRAIN_V-vCur)*(1-Math.exp(-1.5*dt));
  pollTick(dt);if(busy)return;
  const prev=dist;dist+=vCur*dt;odo+=vCur*dt;wheelT+=vCur*dt;
  for(const F of MP.forks)if(prev<T.fs[F.f]&&dist>=T.fs[F.f])takeFork(F);
  const lap=dist>=T.L;if(lap)dist-=T.L;
  for(let i=0;i<HS.length;i++){const e=SL[i].rs[T.bits];if(e>=0&&(lap?e>prev||e<=dist:e>prev&&e<=dist))atHouse(i)}
  if(lap)atStation();
  // otros jugadores ponen su casa de vez en cuando (siempre queda un hueco para ti)
  claimT-=dt;if(claimT<=0&&!busy){claimT=16+Math.random()*16;const free=SL.length-st.houses;
    if(free>(st.mine<0?1:0)){st.houses++;addHouse();news(`${person()} ha puesto su casa junto a la vía`)}}
  poseTrain();
  saveT+=dt;if(saveT>5){saveT=0;save()}
}
const person=()=>NAMES[Math.random()*NAMES.length|0];

/* ================= votación: por dónde va el tren, y quién lo lleva ================= */
/* POLL: la votación de la próxima aguja. left/right son las opciones en pantalla (la de la izquierda es el camino que sale a la izquierda) */
let POLL=null,DRV=null,FORKG=[];const SIDE_COL=['#c8182c','#1d7a4c'],LINE_COL=[[1.15,.02,.07],[.05,.72,.28]],CLOSE_D=11,VOTE_CARD={t:0};
const pollOpt=(P,side)=>P.F.opts[side===0?P.F.left:1-P.F.left];
const pollRoute=(P,side)=>side===0?P.F.left:1-P.F.left;// 0: vía principal, 1: ramal
const forkD=F=>{const d=T.fs[F.f]-dist;return d>0.01?d:d+T.L};
function nextFork(){let b=null,bd=1e9;for(const F of MP.forks){const d=forkD(F);if(d<bd){bd=d;b=F}}return b}
function openPoll(seed){const F=nextFork();if(!F)return;POLL={F,state:'open',won:-1,t:0,d0:Math.max(30,forkD(F)),...newPoll()};if(seed)crowdVote(POLL,seed,simClock);signDirty=true}
/* al empezar, el tren va de camino a la primera aguja (a unos 28 s) y ya hay gente votando */
function startRun(){setDist(T.fs[0]-156);openPoll(17)}
function pollTick(dt){if(!POLL){openPoll();return}
  const P=POLL;P.t+=dt;
  if(P.state==='open'){const k=crowdVotes(simClock,st.day)*dt;crowdVote(P,k,simClock);if(addVotes(st,k)){dayDone();if(busy)return}
    if(forkD(P.F)<CLOSE_D){P.state='closed';P.won=winnerOf(P);signDirty=true}}
  else if(P.state==='done'&&P.t>4.5)openPoll()}
/* la máquina llega a la aguja: toma el camino que ha ganado */
function takeFork(F){const P=POLL&&POLL.F===F?POLL:null;if(P&&P.won<0)P.won=winnerOf(P);
  const go=P?pollRoute(P,P.won):0,bits=(T.bits&~(1<<F.f))|(go<<F.f);setRoute(bits);
  if(!P)return;P.state='done';P.t=0;signDirty=true;
  const v=votesOf(P),tot=v[0]+v[1],pct=tot?Math.round(v[P.won]/tot*100):50,o=pollOpt(P,P.won),ok=P.mine===P.won;if(ok)st.wins++;
  news(P.mine>=0&&ok?`¡Tu voto ha ganado! El tren va por ${o.art}`:`El tren va por ${o.art}: ${pct} % de los votos`,true);
  const me=drawDriver(st,P.mine>=0);setDriver(me?(st.myName||''):person(),me);if(!FASTSTEP)toot();save()}
/* tu voto */
function vote(side){const P=POLL;if(!P||P.state!=='open'||busy)return false;const r=castVote(P,side);if(!r)return false;au();
  if(r==='nuevo'){st.votes++;tone(1319,0.16,'triangle',0.06);tone(1760,0.25,'triangle',0.05,0.07);if(navigator.vibrate)try{navigator.vibrate(12)}catch(e){}
    if(addVotes(st,1)){save();dayDone();return true}}else tone(988,0.14,'triangle',0.05);
  signDirty=true;save();uiPoll();return true}
/* maquinista: su nombre va sobre la locomotora hasta la aguja siguiente */
function setDriver(name,me){if(DRV&&DRV.tag)dropObj(DRV.tag);DRV={name,me,tag:null};driverTag();
  if(me&&!FASTSTEP){openDrv();kaching();bells()}else if(!me)$('drvCard').hidden=true}
function driverTag(){if(!DRV||!LOCO)return;if(DRV.tag)dropObj(DRV.tag);const n=DRV.name||(DRV.me?'tú':'');if(!n){DRV.tag=null;return}
  DRV.tag=tagSprite('Maquinista: '+n,DRV.me?'rgba(122,16,32,.94)':'rgba(11,21,48,.88)');DRV.tag.material.sizeAttenuation=false;DRV.tag.center.set(0.5,0);DRV.tag.position.set(0,6.6,0);LOCO.add(DRV.tag)}// del mismo tamaño en pantalla de lejos y de cerca
function openDrv(){hideHint();$('drvName').value=st.myName||'';$('drvNameRow').hidden=!!st.myName;$('drvCard').hidden=false}
let tootT=-1e9;
function toot(){const now=performance.now();if(now-tootT<1100)return;tootT=now;whistle();if(!LOCO)return;LOCO.updateMatrixWorld();LOCO.localToWorld(tmpV.copy(LOCO.userData.chimney));for(let i=0;i<7;i++)puff(tmpV.clone(),new THREE.Vector3((Math.random()-.5)*2.4,5+Math.random()*3,(Math.random()-.5)*2.4),1.5,.5,1.6)}
function tagSprite(text,bg){const t=canvasTex(512,128,(c,w,hh)=>{c.fillStyle=bg;rrect(c,6,10,w-12,hh-20,40);c.fill();c.strokeStyle='#e0ad45';c.lineWidth=5;rrect(c,6,10,w-12,hh-20,40);c.stroke();
    c.fillStyle='#fbf3df';c.textAlign='center';c.textBaseline='middle';c.font='700 46px Rubik, system-ui, sans-serif';c.fillText(text,w/2,hh/2+2,w-60)});
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,toneMapped:false,depthTest:false,transparent:true,color:new THREE.Color(.82,.82,.82)}));sp.scale.set(6,1.5,1);sp.renderOrder=6;return sp}// por debajo del umbral del bloom: texto nítido
const dropObj=o=>{if(o.parent)o.parent.remove(o);o.traverse(c=>{if(c.geometry&&!c.isSprite)c.geometry.dispose();if(c.material){if(c.material.map)c.material.map.dispose();c.material.dispose()}})};

/* en la maqueta: dos hilos de luz por los dos caminos de la próxima aguja y un cartel en cada uno con su porcentaje (también se vota tocándolos) */
let signDirty=true;const SIGN=[0,1].map(i=>{const cv=document.createElement('canvas');cv.width=320;cv.height=112;const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,toneMapped:false,depthTest:false,transparent:true,sizeAttenuation:false,color:new THREE.Color(.84,.84,.84)}));sp.renderOrder=7;sp.visible=false;sp.center.set(0.5,0);scene.add(sp);return {cv,tx,sp,txt:''}});
function buildForks(){FORKG=MP.forks.map(F=>[0,1].map(side=>{const rt=side===0?F.left:1-F.left,R=MP.R[rt?1<<F.f:0],i0=Math.round((rt?R.alt[F.f]:R.fs[F.f])/R.ds),n=Math.round(F.len[rt]/R.ds),T0=T;T=R;
    const gs=[-1,1].map(sd=>ext3([[sd*(GAUGE+0.95),0.34],[sd*(GAUGE+1.32),0.34]],i0+6,n-12,2,M.roadbed).geometry);T=T0;const col=new THREE.Color(...LINE_COL[side]);
    const m=new THREE.Mesh(mergeGeometries(gs,false),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0,toneMapped:false,side:THREE.DoubleSide,depthWrite:false}));gs.forEach(g=>g.dispose());m.renderOrder=2;m.visible=false;world.add(m);
    const q=atM(R,(rt?R.alt[F.f]:R.fs[F.f])+Math.min(34,F.len[rt]*0.4));return {m,p:new THREE.Vector3(q.x,Math.max(q.y+5,groundAt(q.x,q.z)+3),q.z)}}))}
function drawSign(i){const P=POLL,S=SIGN[i],v=votesOf(P),tot=v[0]+v[1],pct=tot?Math.round(v[i]/tot*100):50,o=pollOpt(P,i),t=o.n+'|'+pct+'|'+(P.mine===i)+'|'+P.state+P.won;if(S.txt===t)return;S.txt=t;
  const g=S.cv.getContext('2d'),w=320,h=112;g.clearRect(0,0,w,h);g.globalAlpha=P.won>=0&&P.won!==i?0.45:1;g.fillStyle=SIDE_COL[i];rrect(g,6,4,w-12,80,40);g.fill();g.lineWidth=P.mine===i||P.won===i?9:4;g.strokeStyle=P.mine===i||P.won===i?'#ffd56b':'rgba(255,245,225,.85)';rrect(g,6,4,w-12,80,40);g.stroke();
  g.fillStyle=SIDE_COL[i];g.beginPath();g.moveTo(w/2-16,82);g.lineTo(w/2+16,82);g.lineTo(w/2,108);g.closePath();g.fill();
  g.fillStyle='#fff8e8';g.textBaseline='middle';g.textAlign='left';g.font='800 42px Rubik, system-ui, sans-serif';g.fillText(o.n,30,46,172);g.textAlign='right';g.font='800 40px "JetBrains Mono", monospace';g.fillText(pct+'%',w-28,46,104);g.globalAlpha=1;S.tx.needsUpdate=true}
function forkFx(t){const P=POLL,hide=!P||busy||cutK>=0.5;
  FORKG.forEach((G,f)=>G.forEach((g,side)=>{const on=P&&P.F.f===f;let op=0;if(on)op=P.state==='open'?0.5+0.28*Math.sin(t*3.2+side*Math.PI)+(P.mine===side?0.2:0):P.won===side?1:0.06;
    g.m.material.opacity=lerp(g.m.material.opacity,op,0.12);g.m.visible=g.m.material.opacity>0.02}));
  const k=2*tanH()/innerHeight,W=innerWidth<560?92:118;
  SIGN.forEach((S,i)=>{S.sp.visible=!hide&&!(P.state==='done'&&P.won!==i);if(!S.sp.visible)return;S.sp.position.copy(FORKG[P.F.f][i].p);S.sp.scale.set(W*k,W*k*0.35,1);S.sp.center.x=0.5});
  // si en pantalla se pisan, se apartan uno a cada lado
  if(SIGN[0].sp.visible&&SIGN[1].sp.visible){const a=scr(tmpV.copy(SIGN[0].sp.position)),ax=a.x,b=scr(tmpV.copy(SIGN[1].sp.position)),nd=W*1.04-Math.abs(ax-b.x);if(nd>0&&Math.abs(a.y-b.y)<W*0.36){const sg=ax<=b.x?1:-1;SIGN[0].sp.center.x=0.5+sg*nd/2/W;SIGN[1].sp.center.x=0.5-sg*nd/2/W}}
  if(signDirty&&P&&!hide){signDirty=false;drawSign(0);drawSign(1)}}
function hitSign(sx,sy){for(let i=0;i<2;i++){const S=SIGN[i].sp;if(!S.visible)continue;const q=scr(tmpV.copy(S.position)),w=innerWidth<560?92:118;q.x-=(S.center.x-0.5)*w;if(q.z<1&&Math.abs(q.x-sx)<w/2+4&&sy<q.y+6&&sy>q.y-w*0.35-6)return i}return -1}

/* ================= cámara: se maneja como un mapa, o pegada a un vagón =================
   Arrastrar mueve (el punto del suelo que agarras va pegado al dedo o al ratón), la rueda o el pellizco acercan hacia donde
   apuntas (ese punto no se mueve de la pantalla), el botón derecho, Mayús o girar dos dedos giran, y dos dedos en vertical inclinan.
   Los gestos se aplican una vez por fotograma (gesture), siempre sobre la cámara que se ve. */
const CTR=new THREE.Vector3(BCX,4,BCZ+40),HOME={w:300,d:260};// vista de inicio: encuadra la vía de la etapa
const cam={az:Math.PI/2,el:0.62,d:300,tgt:CTR.clone(),azT:null,vx:0,vz:0,vaz:0,vel:0,focus:null,faz:Math.PI/2,fel:0.3,fd:17,fdT:17,back:null};
const camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),camDir=new THREE.Vector3(),ease3=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const bl={t:1,dur:.8,p:new THREE.Vector3(),az:0,el:0,hop:0};// vuelo entre dos vistas: sale siempre de lo que se ve
const zm={on:false,l:0,A:new THREE.Vector3(),x:-1e4,y:0};// zoom suave hacia un punto fijo: l es lo que queda (logaritmo)
const ptrs=new Map(),gs={moved:false,drag:false,far:false,G:new THREE.Vector3(),hist:[],lastMove:0},pn={};let lastInput=-1e9,tap=null,lastTap={t:-1e9,x:0,y:0},touched=false,hov=null,curs='';
const FOV=42,MIND=8,tanH=()=>Math.tan(THREE.MathUtils.degToRad(FOV/2));
const portrait=()=>camera.aspect<0.8,homeEl=()=>portrait()?0.86:0.62;
const defD=()=>{const v=tanH();return clamp(Math.max(HOME.w/2/(v*camera.aspect),(HOME.d*0.36+18)/v),110,430)},maxD=()=>clamp(defD()*1.5,300,560);
const elMin=()=>lerp(0.1,0.5,sstep(14,95,camPos.y)),ELMAX=1.45;// cuanto más alto, menos rasante: al alejarte, la vista se inclina sola
const effD=()=>camPos.y/Math.max(0.3,Math.sin(cam.el));// distancia de la vista según la altura: no da saltos al pasar por una montaña
/* hasta dónde se puede mover el centro: toda la maqueta de cerca y casi solo el centro con el zoom alejado del todo */
function bounds(){const k=0.8*sstep(0.66,1,effD()/maxD()),f=(a,c)=>lerp(a,c,k);return {x0:f(BOARD.x0+8,CTR.x),x1:f(BOARD.x1-8,CTR.x),z0:f(BOARD.z0+30,CTR.z),z1:f(BOARD.z1-4,CTR.z)}}
const rubber=(v,lo,hi)=>{const o=v<lo?v-lo:v>hi?v-hi:0;if(!o)return v;const D=0.22*cam.d;return (o<0?lo:hi)+o*D*0.55/(D+0.55*Math.abs(o))};
function moveTgt(x,z){const b=bounds();cam.tgt.x=rubber(x,b.x0,b.x1);cam.tgt.z=rubber(z,b.z0,b.z1)}
function stopMotion(){cam.vx=cam.vz=cam.vaz=cam.vel=0;cam.azT=null;zm.on=false}
/* el centro de giro pasa a ser el suelo que hay en el centro de la pantalla, sin mover la cámara (si estaba volando, se queda donde está) */
function anchor(){const fly=bl.t<1;camera.getWorldDirection(camDir);if(fly){bl.t=1;cam.el=Math.asin(clamp(-camDir.y,-1,1));cam.az=Math.atan2(-camDir.z,-camDir.x)}
  let t=groundT(rayAt(innerWidth/2,innerHeight/2));t=t===null?cam.d:clamp(t,5,maxD()*1.2);
  cam.tgt.copy(camera.position).addScaledVector(camDir,t);cam.d=t}
function blendFrom(){camera.getWorldDirection(camDir);bl.p.copy(camera.position);bl.az=Math.atan2(-camDir.z,-camDir.x);bl.el=Math.asin(clamp(-camDir.y,-1,1));bl.t=0;bl.hop=-1}
/* punto del suelo bajo el dedo, sin irse al infinito cerca del horizonte */
function groundPt(sx,sy,out){const R=rayAt(sx,sy),t=groundT(R);return R.at(Math.min(t||1e9,2.6*cam.d),out)}
/* agarrar el suelo y llevarlo con el dedo */
function grab(sx,sy){const R=rayAt(sx,sy),t=groundT(R);gs.far=!t||t>Math.max(3.2*cam.d,60);if(!gs.far)R.at(t,gs.G);gs.hist.length=0}
function dragTo(sx,sy,dx,dy){let mx,mz;
  if(gs.far){const k=2*cam.d*tanH()/innerHeight,kf=k/Math.max(0.35,Math.sin(cam.el)),s=Math.sin(cam.az),c=Math.cos(cam.az);mx=-s*dx*k-c*dy*kf;mz=c*dx*k-s*dy*kf}
  else{const R=rayAt(sx,sy),tm=Math.max(4.2*cam.d,80);let t=(gs.G.y-R.origin.y)/R.direction.y;if(!(t>0)||t>tm)t=tm;R.at(t,tmpV);mx=gs.G.x-tmpV.x;mz=gs.G.z-tmpV.z}
  moveTgt(cam.tgt.x+mx,cam.tgt.z+mz)}
function rotate(dx,dy){const k=coarse?0.0075:0.0055;
  if(cam.focus){cam.faz+=dx*k;cam.fel=clamp(cam.fel+dy*0.005,0.02,1.35)}
  else{cam.az+=dx*k;cam.el=clamp(cam.el+dy*0.005,elMin(),ELMAX)}}
/* acercar o alejar k veces respecto a un punto, que se queda quieto en la pantalla */
function dolly(A,k){cam.tgt.sub(A).multiplyScalar(k).add(A);cam.d*=k}
function zoomAt(sx,sy,f){lastInput=performance.now();hideHint();
  if(cam.focus){cam.fdT*=f;if(cam.fdT>78&&f>1){setFocus(null,true)}else{cam.fdT=clamp(cam.fdT,6.5,90);return}}
  if(!zm.on||Math.hypot(sx-zm.x,sy-zm.y)>14||bl.t<1){anchor();groundPt(sx,sy,zm.A);zm.x=sx;zm.y=sy;if(!zm.on)zm.l=0}
  cam.vx=cam.vz=0;zm.on=true;zm.l=zoomLim(zm.A,zm.l+Math.log(f))}
/* tope de zoom: de cerca, por la distancia al punto al que vas; de lejos, por la altura */
const zoomLim=(A,l)=>clamp(l,Math.min(0,Math.log(MIND/Math.max(1,camera.position.distanceTo(A)))),Math.max(0,Math.log(maxD()/effD())));
/* inclinar dejando quieto un punto en la pantalla */
function tiltAbout(A,a){if(A){tmpV.set(Math.sin(cam.az),0,-Math.cos(cam.az));cam.tgt.sub(A).applyAxisAngle(tmpV,-a).add(A)}cam.el+=a}
function goHome(){if(cam.focus)setFocus(null);blendFrom();stopMotion();cam.tgt.copy(CTR);cam.d=defD();cam.el=homeEl();cam.az=Math.PI/2;lastInput=performance.now()}
function flyTo(x,z,d,az){if(cam.focus)setFocus(null);blendFrom();stopMotion();cam.tgt.set(x,Math.max(0,groundAt(x,z))+2,z);cam.d=d;if(az!==undefined)cam.az=az;cam.el=clamp(cam.el,0.35,0.75);lastInput=performance.now()}
/* dos dedos: pellizcar, girar y mover a la vez (todo pegado a los dedos), o inclinar si los dos suben o bajan juntos */
function pinchStart(){const [a,b]=[...ptrs.values()];Object.assign(pn,{d:Math.hypot(a.x-b.x,a.y-b.y),ang:Math.atan2(b.y-a.y,b.x-a.x),mx:(a.x+b.x)/2,my:(a.y+b.y)/2,ax:a.x,ay:a.y,bx:b.x,by:b.y,mode:null,rot:0});pn.d0=pn.d;pn.a0=pn.ang;if(!cam.focus){anchor();pn.A=groundPt(pn.mx,pn.my,pn.A||new THREE.Vector3())}}
function pinchMove(){const [a,b]=[...ptrs.values()],d=Math.max(20,Math.hypot(a.x-b.x,a.y-b.y)),ang=Math.atan2(b.y-a.y,b.x-a.x),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  if(!pn.mode){const ya=a.y-pn.ay,yb=b.y-pn.by,xa=a.x-pn.ax,xb=b.x-pn.bx,tw=Math.abs(wrapA(ang-pn.a0)),par=ya*yb>0&&Math.min(Math.abs(ya),Math.abs(yb))>9&&Math.abs(xa)+Math.abs(xb)<0.8*(Math.abs(ya)+Math.abs(yb));
    if(par&&Math.abs(d/pn.d0-1)<0.12&&tw<0.16)pn.mode='tilt';else if(Math.abs(d-pn.d0)>9||tw>0.09||Math.hypot(mx-pn.mx,my-pn.my)>16)pn.mode='pin';else return;
    pn.d=d;pn.ang=ang;pn.mx=mx;pn.my=my;if(pn.mode==='pin'&&!cam.focus)groundPt(mx,my,pn.A);return}
  const k=pn.d/d;let tw=wrapA(ang-pn.ang);pn.rot+=tw;if(Math.abs(pn.rot)<0.12&&!pn.turn)tw=0;else pn.turn=true;// girar solo si se gira a propósito
  if(pn.mode==='tilt')rotate(0,(my-pn.my)*1.25);
  else if(cam.focus){cam.fd=cam.fdT=clamp(cam.fd*k,6.5,90);cam.faz-=tw;if(cam.fd>78&&k>1){setFocus(null,true);groundPt(mx,my,pn.A=pn.A||new THREE.Vector3())}}
  else{const lo=camera.position.distanceTo(pn.A)<MIND&&k<1,hi=effD()>maxD()&&k>1;dolly(pn.A,lo||hi?Math.pow(k,0.3):k);
    if(tw){cam.az-=tw;const x=cam.tgt.x-pn.A.x,z=cam.tgt.z-pn.A.z,c=Math.cos(-tw),s=Math.sin(-tw);cam.tgt.x=pn.A.x+x*c-z*s;cam.tgt.z=pn.A.z+x*s+z*c}
    freePose();placeCam();gs.G.copy(pn.A);gs.far=false;dragTo(mx,my,mx-pn.mx,my-pn.my)}
  pn.d=d;pn.ang=ang;pn.mx=mx;pn.my=my}
function gesture(){if(!gs.moved||!ptrs.size)return;gs.moved=false;
  if(ptrs.size>1){if(ptrs.size===2)pinchMove();return}
  const q=ptrs.values().next().value,dx=q.x-q.px,dy=q.y-q.py;if(!gs.drag)return;q.px=q.x;q.py=q.y;
  if(cam.focus||q.rot)rotate(dx,dy);else dragTo(q.x,q.y,dx,dy);
  gs.hist.push({t:performance.now(),x:cam.tgt.x,z:cam.tgt.z,az:cam.focus?cam.faz:cam.az,el:cam.focus?cam.fel:cam.el});if(gs.hist.length>8)gs.hist.shift()}
/* al empezar a arrastrar (o al levantar uno de los dos dedos): se agarra desde donde está ahora, sin salto */
function startDrag(){const q=ptrs.values().next().value;gs.drag=true;q.px=q.x;q.py=q.y;gs.hist.length=0;hideHint();if(cam.focus)return;if(bl.t<1)anchor();if(q.rot)anchor();else grab(q.x,q.y)}
/* al soltar, sigue con la velocidad que llevaba el dedo */
function throwIt(q){const H=gs.hist,now=performance.now();if(H.length<2||now-gs.lastMove>70)return;const b=H[H.length-1],a=H.find(h=>b.t-h.t<110)||H[0],T0=(b.t-a.t)/1000;if(T0<0.012)return;
  if(cam.focus||q.rot){cam.vaz=clamp((b.az-a.az)/T0,-4,4);cam.vel=clamp((b.el-a.el)/T0,-3,3)}
  else{const vm=2.2*cam.d;let vx=(b.x-a.x)/T0,vz=(b.z-a.z)/T0;const v=Math.hypot(vx,vz);if(v>vm){vx*=vm/v;vz*=vm/v}cam.vx=vx;cam.vz=vz}}
const setCursor=c=>{if(c!==curs){curs=c;canvas.style.cursor=c}};
canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}if(ready)updateCam(0);touched=true;stopMotion();gs.moved=false;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,rot:e.button===2||e.button===1||e.shiftKey||e.ctrlKey||e.metaKey});
  tap=ptrs.size===1&&e.button===0?{id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp}:null;gs.drag=false;
  if(!cam.focus&&bl.t<1&&ready)anchor();// agarrar la vista en pleno vuelo la para ahí
  if(ptrs.size===2&&ready)pinchStart();else if(ptrs.size===1&&e.button===1)e.preventDefault();
  if(ptrs.size===1)setCursor(ptrs.get(e.pointerId).rot||cam.focus?'move':'grabbing');lastInput=performance.now()});
canvas.addEventListener('pointermove',e=>{const q=ptrs.get(e.pointerId);if(!q){if(e.pointerType==='mouse')hov={x:e.clientX,y:e.clientY};return}
  q.x=e.clientX;q.y=e.clientY;lastInput=gs.lastMove=performance.now();gs.moved=true;
  if(ptrs.size===1&&!gs.drag){if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<(e.pointerType==='touch'?9:4))return;tap=null;if(ready)startDrag()}});
['pointerup','pointercancel'].forEach(ev=>canvas.addEventListener(ev,e=>{const q=ptrs.get(e.pointerId);if(!q)return;const was=ev==='pointerup'&&tap&&tap.id===e.pointerId&&e.timeStamp-tap.t<550;/* hora del gesto, no la del fotograma: un tirón no se come el toque */
  if(ready)updateCam(0);const n=ptrs.size;ptrs.delete(e.pointerId);tap=null;lastInput=performance.now();
  if(n===2){pn.turn=false;if(!cam.focus&&pn.mode==='pin'){const l=Math.log(effD()>maxD()?maxD()/effD():camera.position.distanceTo(pn.A)<MIND?MIND/camera.position.distanceTo(pn.A):1);if(l){zm.on=true;zm.l=l;zm.A.copy(pn.A);zm.x=-1e4}}if(ready)startDrag()}
  else if(n===1){if(gs.drag&&ev==='pointerup')throwIt(q);gs.drag=false;setCursor('grab');hov=e.pointerType==='mouse'?{x:e.clientX,y:e.clientY}:null}
  if(was&&!pick(e.clientX,e.clientY,e.pointerType==='touch'?22:6)){const dbl=e.timeStamp-lastTap.t<340&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<32;lastTap={t:dbl?-1e9:e.timeStamp,x:e.clientX,y:e.clientY};if(dbl)zoomAt(e.clientX,e.clientY,0.5)}}));
canvas.addEventListener('lostpointercapture',e=>{ptrs.delete(e.pointerId)});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
/* rueda o panel táctil (pellizcar en el panel llega como rueda con Ctrl) */
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!ready)return;touched=true;const px=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?innerHeight:1);zoomAt(e.clientX,e.clientY,Math.exp(e.ctrlKey?clamp(px,-40,40)*0.011:clamp(px,-160,160)*0.0021))},{passive:false});
/* cámara libre: posición a partir del centro, el giro, la inclinación y la distancia, sin meterse en el suelo */
function freePose(){const ce=Math.cos(cam.el);camPos.set(cam.tgt.x+Math.cos(cam.az)*ce*cam.d,cam.tgt.y+Math.sin(cam.el)*cam.d,cam.tgt.z+Math.sin(cam.az)*ce*cam.d);
  const gy=groundAt(camPos.x,camPos.z)+1.8;if(camPos.y<gy){cam.tgt.y+=gy-camPos.y;camPos.y=gy}camLook.copy(cam.tgt)}
function placeCam(){camera.position.copy(camPos);camera.lookAt(camLook);camera.updateMatrixWorld()}
function freeStep(dt){
  if(zm.on){const q=zm.l*(1-Math.exp(-13*dt));zm.l-=q;dolly(zm.A,Math.exp(q));freePose();placeCam();anchor();if(Math.abs(zm.l)<0.0015)zm.on=false}
  const b=bounds(),t=cam.tgt,out=t.x<b.x0||t.x>b.x1||t.z<b.z0||t.z>b.z1;
  if(!ptrs.size){if(cam.vx||cam.vz){t.x+=cam.vx*dt;t.z+=cam.vz*dt;const f=Math.exp(-(out?16:4.2)*dt);cam.vx*=f;cam.vz*=f;if(Math.hypot(cam.vx,cam.vz)<0.01*cam.d)cam.vx=cam.vz=0}
    if(cam.vaz||cam.vel){cam.az+=cam.vaz*dt;cam.el+=cam.vel*dt;const f=Math.exp(-6*dt);cam.vaz*=f;cam.vel*=f;if(Math.abs(cam.vaz)+Math.abs(cam.vel)<0.004)cam.vaz=cam.vel=0}
    if(out){const s=1-Math.exp(-9*dt);t.x=lerp(t.x,clamp(t.x,b.x0,b.x1),s);t.z=lerp(t.z,clamp(t.z,b.z0,b.z1),s)}}
  if(cam.azT!==null){cam.az+=wrapA(cam.azT-cam.az)*(1-Math.exp(-9*dt));if(Math.abs(wrapA(cam.azT-cam.az))<0.002)cam.azT=null}
  const em=elMin();if(cam.el<em)tiltAbout(zm.on?zm.A:ptrs.size===2&&pn.mode==='pin'?pn.A:null,(em-cam.el)*(1-Math.exp(-8*dt)));if(cam.el>ELMAX)cam.el=ELMAX;
  if(!touched&&!REDUCED&&performance.now()-lastInput>8000)cam.az+=dt*0.018;// solo gira sola hasta que la tocas por primera vez
  freePose()}
function updateCam(dt){gesture();const s=1-Math.exp(-7*dt);
  const fc=cam.focus?cars[cam.focus.car]:null;
  if(fc){if(!ptrs.size&&(cam.vaz||cam.vel)){cam.faz+=cam.vaz*dt;cam.fel=clamp(cam.fel+cam.vel*dt,0.02,1.35);const f=Math.exp(-6*dt);cam.vaz*=f;cam.vel*=f}
    const yaw=-fc.rotation.y;cam.fd=lerp(cam.fd,cam.fdT,1-Math.exp(-11*dt));tmpV.set(fc.position.x,fc.position.y+2.7,fc.position.z);cam.tgt.lerp(tmpV,1-Math.exp(-14*dt));
    const a=yaw+cam.faz,ce=Math.cos(cam.fel);camPos.set(cam.tgt.x+Math.cos(a)*ce*cam.fd,cam.tgt.y+Math.sin(cam.fel)*cam.fd,cam.tgt.z+Math.sin(a)*ce*cam.fd);camLook.copy(cam.tgt);
    const gy=groundAt(camPos.x,camPos.z)+1.4;if(camPos.y<gy)camPos.y=gy}
  else freeStep(dt);
  // en un túnel, la cámara entra con el tren: un fundido corto y va por dentro de la gruta, mirando el costado del coche
  const fcar=fc?cam.focus.car:-1;let inT=false;
  if(fcar>=0&&T){const q=carAt(fcar);inT=kindAt(q.T,q.s+2.5)===KT||kindAt(q.T,q.s-2.5)===KT}
  cutK=fcar<0?0:inT?Math.min(1,cutK+dt/0.5):Math.max(0,cutK-dt/0.5);const inside=fcar>=0&&cutK>=0.5;
  if(inside){bl.t=1;const {T:Tc,s:s0}=carAt(fcar),side=Math.sin(cam.faz)>=0?1:-1,sc=caveClamp(Tc,s0,s0+(portrait()?7.5:3.5)),q=atM(Tc,sc),w=caveW(Tc,sc)||4,lat=side*clamp(w-1.1,2.2,6.4),lk=atM(Tc,s0);
    camera.position.set(q.x-Math.sin(q.a)*lat,q.y+2.9,q.z+Math.cos(q.a)*lat);camera.lookAt(lk.x,lk.y+2.7,lk.z)}
  else{
    if(bl.t<1){if(bl.hop<0){const D=bl.p.distanceTo(camPos);bl.dur=REDUCED?0.001:clamp(0.5+D/420,0.55,1.15);bl.hop=Math.min(26,D*0.1)}
      bl.t=Math.min(1,bl.t+dt/bl.dur);const e=ease3(bl.t);camDir.copy(camPos).sub(camLook);const az=Math.atan2(camDir.z,camDir.x),el=Math.atan2(camDir.y,Math.hypot(camDir.x,camDir.z)),a=bl.az+wrapA(az-bl.az)*e,l=lerp(bl.el,el,e);
      camPos.lerpVectors(bl.p,camPos,e);camPos.y+=bl.hop*Math.sin(Math.PI*e);const gy=groundAt(camPos.x,camPos.z)+1.4;if(camPos.y<gy)camPos.y=gy;
      camLook.set(camPos.x-Math.cos(a)*Math.cos(l),camPos.y-Math.sin(l),camPos.z-Math.sin(a)*Math.cos(l))}
    camera.position.copy(camPos);camera.lookAt(camLook)}
  const fov=inside?(portrait()?66:48):FOV;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix()}
  if(snow.visible===inside){snow.visible=!inside;key.intensity=inside?0.4:1.25;hemi.intensity=inside?1:0.42}camera.updateMatrixWorld();
  {const op=Math.round(Math.min(1,(1-Math.abs(2*cutK-1))*1.6)*50)/50;if(op!==fadeOp){fadeOp=op;$('tunFade').style.opacity=op}}
  cutK2=lerp(cutK2,fcar>=0&&!inside?1:0,1-Math.exp(-5*dt));CUT.r.value=cutK2<0.02?0:cutK2*5;if(CUT.r.value>0&&fcar>=0){const c=cars[fcar];CUT.a.value.copy(camera.position);CUT.b.value.set(c.position.x,c.position.y+2.4,c.position.z)}// los abetos no tapan el coche que sigues
  if(hov&&!ptrs.size){setCursor(hitSign(hov.x,hov.y)>=0||hitCar(hov.x,hov.y,6)>=0||hitHouse(hov.x,hov.y)?'pointer':cam.focus?'move':'grab');hov=null}
  navUI();
  grade.uniforms.tilt.value=lerp(grade.uniforms.tilt.value,coarse||fc?0:0.85*sstep(70,220,cam.d),1-Math.exp(-3*dt));grade.uniforms.focus.value=0.5}
/* el botón «Ver toda la maqueta» solo destaca si te has ido de la vista de inicio */
let awayOn=null;function navUI(){const aw=!!cam.focus||Math.abs(Math.log(cam.d/defD()))>0.12||cam.tgt.distanceTo(CTR)>0.12*cam.d||Math.abs(wrapA(cam.az-Math.PI/2))>0.25;if(aw!==awayOn){awayOn=aw;$('nav').classList.toggle('away',aw)}}
/* seguir al tren desde atrás (el botón del ojo) */
function setFollow(on){if(on)setFocus({car:0,chase:true});else if(cam.focus&&cam.focus.chase)setFocus(null)}
function snapCam(){bl.t=1;zm.on=false;updateCam(0)}
/* pista de manejo: se ve la primera vez y se va en cuanto mueves la vista */
let hintOn=false;function showHint(){if(store.get('advx-tren-nav'))return;hintOn=true;const h=$('navHint');h.innerHTML=coarse?'<b>Un dedo</b> mueve · <b>pellizca</b> para acercar · <b>gira</b> con dos dedos':'<b>Arrastra</b> para moverte · <b>rueda</b> para acercarte · <b>botón derecho</b> para girar';h.hidden=false}
function hideHint(){if(!hintOn)return;hintOn=false;store.set('advx-tren-nav','1');$('navHint').classList.add('bye');setTimeout(()=>{$('navHint').hidden=true},260)}
/* tocar: un vagón (la cámara se pega a él) o tu casa */
const RC=new THREE.Raycaster(),NDC=new THREE.Vector2(),_inv=new THREE.Matrix4(),_box=new THREE.Box3(),_ray=new THREE.Ray();
function rayAt(sx,sy){NDC.set(sx/innerWidth*2-1,-(sy/innerHeight)*2+1);RC.setFromCamera(NDC,camera);return RC.ray}
/* distancia hasta el suelo a lo largo del rayo (marcha sobre la rejilla de alturas y afina por bisección) */
function groundT(R,max=1800){const o=R.origin,d=R.direction;if(o.y<groundAt(o.x,o.z))return 0;let t=0,step=0.8;
  while(t<max){t+=step;const y=o.y+d.y*t;if(y<groundAt(o.x+d.x*t,o.z+d.z*t)){let a=t-step,b=t;for(let k=0;k<14;k++){const m=(a+b)/2;if(o.y+d.y*m<groundAt(o.x+d.x*m,o.z+d.z*m))b=m;else a=m}return (a+b)/2}
    if(y<-3&&d.y<0)return null;step=Math.max(0.8,t*0.012)}return null}
function pickGround(sx,sy){const R=rayAt(sx,sy),t=groundT(R);return t===null?null:R.at(t,new THREE.Vector3())}
/* coche bajo el dedo: primero el que se toca de lleno; si no, el más cercano a menos de «slop» píxeles (de lejos el tren es muy pequeño) */
function hitCar(sx,sy,slop){const R=rayAt(sx,sy),tg=groundT(R)||1e9,px=2*tanH()/innerHeight;let bt=1e9,bc=-1,nd=1e9,nc=-1;// groundT 0: la cámara está dentro de la montaña (en un túnel)
  cars.forEach((c,ci)=>{_inv.copy(c.matrixWorld).invert();_ray.copy(R).applyMatrix4(_inv);const L=c.userData.len/2;
    _box.min.set(-L,0.3,-1.7);_box.max.set(L,c.userData.top,1.7);const p=_ray.intersectBox(_box,tmpV2);
    if(p){const t=p.applyMatrix4(c.matrixWorld).distanceTo(R.origin);if(t<bt&&t<tg+1){bt=t;bc=ci}}
    else if(slop){const e=slop*px*c.position.distanceTo(R.origin);_box.expandByScalar(e);const q=_ray.intersectBox(_box,tmpV2);if(q){const t=q.applyMatrix4(c.matrixWorld).distanceTo(R.origin),dd=R.distanceToPoint(tmpV.copy(c.position));if(t<tg+1+2*e&&dd<nd){nd=dd;nc=ci}}}});
  return bc>=0?bc:nc}
function hitHouse(sx,sy){const h=st.mine>=0&&HS[st.mine];if(!h)return false;const R=rayAt(sx,sy),tg=groundT(R)||1e9,c=h.g.position,t=tmpV.copy(c).sub(R.origin).dot(R.direction);return t>0&&R.at(t,tmpV2).distanceTo(c)<6&&t<tg+6}
function pick(sx,sy,slop=6){if(!ready||busy)return false;au();const sg=hitSign(sx,sy);if(sg>=0){vote(sg);return true}
  const bc=hitCar(sx,sy,slop);
  if(bc>=0){if(!(cam.focus&&cam.focus.car===bc&&!cam.focus.chase))setFocus({car:bc});return true}
  if(hitHouse(sx,sy)){focusHouse();return true}return false}
function focusHouse(){const h=HS[st.mine];if(!h)return;const sl=SL[st.mine];flyTo(h.g.position.x,h.g.position.z,40,Math.atan2(-sl.nz,-sl.nx))}

/* ================= marcas en los furgones: imagen y texto en los dos costados, con enlace ================= */
const AD_W=1024,AD_H=352,ADS={};let maxAniso=8,freeMat=null;
const PANEL=(()=>{const a=PLN(PANEL_W,PANEL_H).translate(0,0,WHALF+0.02),b=PLN(PANEL_W,PANEL_H).rotateY(Math.PI).translate(0,0,-(WHALF+0.02));return mergeGeometries([a,b],false)})();
const AD_BG=['#7a1020','#1c6b45','#1d3a78','#c8962d','#f3efe6','#2b1a12'];
const rrect=(g,x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()};
const hexLum=c=>{const n=parseInt(c.slice(1),16),f=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(n>>16)+.7152*f(n>>8&255)+.0722*f(n&255)};
const shade=(c,k)=>{const n=parseInt(c.slice(1),16),f=v=>Math.round(Math.min(255,Math.max(0,k>0?v+(255-v)*k:v*(1+k))));return `rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`};
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return ''}};
/* dibuja el costado: fondo, marco dorado, imagen (encajada sin recortar), hasta dos líneas de texto y la web */
function drawAd(cv,ad){const g=cv.getContext('2d'),w=cv.width,h=cv.height,bg=ad.bg||AD_BG[0],light=hexLum(bg)>0.4;
  g.clearRect(0,0,w,h);const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,shade(bg,.16));gr.addColorStop(1,shade(bg,-.18));g.fillStyle=gr;rrect(g,0,0,w,h,28);g.fill();
  g.lineWidth=9;g.strokeStyle='#e0ad45';rrect(g,12,12,w-24,h-24,20);g.stroke();
  const im=ad.im,hasTxt=!!(ad.text||ad.sub);let tx0=48,tx1=w-48;
  if(im&&im.width){const boxW=hasTxt?w*0.36:w-120,boxH=h-96,sc=Math.min(boxW/im.width,boxH/im.height),dw=im.width*sc,dh=im.height*sc,cx=hasTxt?48+boxW/2:w/2;
    g.imageSmoothingQuality='high';g.drawImage(im,cx-dw/2,h/2-dh/2,dw,dh);tx0=48+boxW+28}
  if(hasTxt){const ink=light?'#2b1a12':'#fbf3df',mw=tx1-tx0,cx=(tx0+tx1)/2;g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
    const fit=(txt,font,max,min)=>{let s=max;for(;s>min;s-=2){g.font=font.replace('#',s);if(g.measureText(txt).width<=mw)break}return s};
    if(ad.text){const s=fit(ad.text,'400 #px "Alfa Slab One", Georgia, serif',ad.sub?88:100,30);g.font=`400 ${s}px "Alfa Slab One", Georgia, serif`;g.fillText(ad.text,cx,ad.sub?h*0.41:h/2+4,mw)}
    if(ad.sub){g.globalAlpha=.85;const s=fit(ad.sub,'500 #px Rubik, system-ui, sans-serif',42,20);g.font=`500 ${s}px Rubik, system-ui, sans-serif`;g.fillText(ad.sub,cx,ad.text?h*0.68:h/2,mw);g.globalAlpha=1}}
  if(ad.host){g.font='600 25px Rubik, system-ui, sans-serif';g.textAlign='right';g.textBaseline='alphabetic';g.fillStyle=light?'rgba(43,26,18,.72)':'rgba(251,243,223,.78)';g.fillText(ad.host,w-44,h-34)}
  if(ad.tag){g.font='700 22px Rubik, system-ui, sans-serif';const tw=g.measureText(ad.tag).width+28;g.fillStyle='rgba(0,0,0,.35)';rrect(g,w-36-tw,26,tw,34,17);g.fill();g.fillStyle='#fbf3df';g.textAlign='center';g.textBaseline='middle';g.fillText(ad.tag,w-36-tw/2,44)}}
const imgCache=new Map();
function loadImg(src){if(!src)return Promise.resolve(null);if(imgCache.has(src))return imgCache.get(src);const p=new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src});imgCache.set(src,p);return p}
const adTex=cv=>{const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=maxAniso;return t};
/* furgón libre: invita a poner tu marca (una sola textura para todos) */
function freeAdMat(){if(freeMat)return freeMat;const cv=document.createElement('canvas');cv.width=AD_W;cv.height=AD_H;drawAd(cv,{text:'Tu marca aquí',sub:'Toca el vagón para ponerla',bg:'#16213f',tag:'Libre'});
  return freeMat=new THREE.MeshBasicMaterial({map:adTex(cv),toneMapped:false,color:new THREE.Color(.8,.8,.8)})}// por debajo del umbral del bloom: texto nítido
async function setAd(i,ad){const W=WAG[i];if(!W)return;const tok=(W.userData.adTok||0)+1;W.userData.adTok=tok;
  const im=ad?(ad.im||await loadImg(ad.img)):null;if(WAG[i]!==W||W.userData.adTok!==tok)return;
  const old=ADS[i];if(old){W.remove(old.mesh);if(old.tex){old.tex.dispose();old.mat.dispose()}delete ADS[i]}
  if(!ad){const m=new THREE.Mesh(PANEL,freeAdMat());m.position.y=PANEL_Y;W.add(m);ADS[i]={ad:null,mesh:m};return}
  const cv=document.createElement('canvas');cv.width=AD_W;cv.height=AD_H;drawAd(cv,{...ad,im,host:ad.url?hostOf(ad.url):''});
  const tex=adTex(cv),mat=new THREE.MeshBasicMaterial({map:tex,toneMapped:false,color:new THREE.Color(.84,.84,.84)});
  const m=new THREE.Mesh(PANEL,mat);m.position.y=PANEL_Y;W.add(m);ADS[i]={ad,tex,mat,mesh:m}}
/* ejemplos de la demo: el vagón del día (patrocinado) y un vagón con mensaje */
const logoURL=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#fbf3df';g.beginPath();g.arc(128,128,118,0,7);g.fill();g.fillStyle='#1d3a78';g.beginPath();g.arc(128,128,100,0,7);g.fill();
  g.fillStyle='#e0ad45';g.beginPath();for(let k=0;k<10;k++){const r=k%2?34:82,a=-Math.PI/2+k*Math.PI/5;g.lineTo(128+Math.cos(a)*r,128+Math.sin(a)*r)}g.closePath();g.fill();return c.toDataURL('image/png')})();
const EX_SPONSOR={text:'Pastelería La Estrella',sub:'Turrón artesano · ejemplo',bg:'#1d3a78',img:logoURL,tag:'Patrocinado',url:'https://www.example.com/'};
const EX_MSG={text:'¡Feliz Navidad, amama Maite!',sub:'De Ane, desde Bilbao',bg:'#b3162a'};
/* subasta (simulada) y vagones con mensaje */
const AUC_KEY='advx-tren-subasta';
let auc=(()=>{try{const o=JSON.parse(store.get(AUC_KEY));if(o&&o.top&&Number.isFinite(o.top.amt))return o}catch(e){}return {top:{amt:41,who:'Pastelería La Estrella',me:false},bid:null,mine:null}})();
const saveAuc=()=>store.set(AUC_KEY,JSON.stringify(auc));
let rivalT=25;
function auctionTick(dt){rivalT-=dt;if(rivalT>0)return;rivalT=22+Math.random()*26;if(Math.random()>(auc.top.me?0.6:0.45))return;
  const was=auc.top.me,amt=auc.top.amt+1+Math.floor(Math.random()*4);auc.top={amt,who:BIZ[Math.random()*BIZ.length|0],me:false};saveAuc();
  news(was?`Te han superado: ${amt} € por el vagón de mañana`:`Nueva puja por el vagón de mañana: ${amt} €`,was);if(was&&tiles.tAd){tiles.tAd.b.querySelector('.flag').textContent='¡Te superan!';tiles.tAd.b.classList.add('hot')}if($('adSheet').classList.contains('on'))syncAdForm()}
const msgWagon=()=>{for(let i=2;i<WAG.length;i++)if(!ADS[i]||!ADS[i].ad)return i;return -1};
async function applyAds(){await setAd(1,EX_SPONSOR);if(WAG.length>2)await setAd(2,EX_MSG);for(let i=3;i<WAG.length;i++)await setAd(i,null);if(auc.mine&&auc.mine.wagon<WAG.length)await setAd(auc.mine.wagon,auc.mine.ad)}
/* ficha del vagón: la marca, su web y, si está libre, el botón para ponerla */
function showCard(i){const A=ADS[i]&&ADS[i].ad,u=A&&A.url?cleanUrl(A.url):'';$('card').hidden=false;
  $('caTag').textContent=i===1?'Vagón del día · patrocinado':A?'Vagón con mensaje':`Vagón nº ${i} · libre`;
  $('caName').textContent=A?(A.text||'Imagen sin texto'):'Pon aquí tu marca o un mensaje';$('caSub').textContent=A?(A.sub||''):'Con tu imagen y un enlace a tu web, durante 24 horas';
  $('caGo').hidden=!u;if(u){$('caGo').href=u;$('caHost').textContent=hostOf(u)}$('caFree').hidden=!!A;$('card').dataset.w=i}
function hideCard(){$('card').hidden=true}

/* ================= interfaz ================= */
const ICON={
  casa:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
  marca:'<path d="M3.5 10v4h3l8 4.5v-13L6.5 10z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5M19.8 7a7 7 0 0 1 0 10"/>',
  tunel:'<path d="M3 20v-7a9 9 0 0 1 18 0v7"/><path d="M8 20v-6a4 4 0 0 1 8 0v6"/><path d="M10.5 20v-3M13.5 20v-3"/>',
  bosque:'<path d="M9 3 4.5 10H7l-3.5 6h11L11 10h2.500z"/><path d="M9 16v5"/><path d="M17 9l-2 3.500M17 9l4 7h-4.500"/><path d="M17.500 16v4"/>',
  orilla:'<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  puente:'<path d="M2.500 9h19"/><path d="M4 9v10M20 9v10"/><path d="M4 19a8 8 0 0 1 16 0"/>',
  pistas:'<path d="M2.500 20 9 6l4 8 2.500-4 6 10z"/><path d="M7 10.500l2 1.500 2-1.500"/>',
  lago:'<ellipse cx="12" cy="14" rx="9.500" ry="5.500"/><path d="M7 14c1.500-1.200 3-1.200 4.500 0s3 1.200 4.500 0"/>',
  monte:'<path d="M2.500 20 10 5l5 10 2-3.500L21.500 20z"/><path d="M7.500 10l2.500 1.500L12.500 10"/>',
  valle:'<path d="M2.500 8 7 15l5 3 5-3 4.500-7"/><path d="M9 18.500h6"/>',
};
const tiles={};
function buildShop(){$('shop').innerHTML=
  `<section class="poll" id="poll" aria-label="Votación: por dónde va el tren"><div class="phead"><b id="pTitle">¿Por dónde tira el tren?</b><button class="plnk" id="pGo" type="button">Ver el cruce</button><a class="plnk" id="pAsk" target="_blank" rel="noopener noreferrer" hidden>Pide votos</a><span class="ptime mono" id="pTime"></span></div><div class="pbar" aria-hidden="true"><i id="pBar"></i></div><div class="popts">`+
  [0,1].map(i=>`<button class="po ${i?'r':'l'}" id="po${i}" type="button" aria-pressed="false" style="--c:${SIDE_COL[i]}"><i class="pf"></i><svg class="pi" viewBox="0 0 24 24" aria-hidden="true"></svg><span class="pn"></span><span class="pv"></span><span class="pp mono"></span></button>`).join('')+`</div></section>`+
  `<button class="it" id="tHouse"><span class="flag">¡Libre!</span><span class="lv mono"></span><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.casa}</svg></span><span class="nm"></span><span class="fx"></span><span class="pr mono"><b></b></span></button>`+
  `<button class="it" id="tAd"><span class="flag">Nuevo</span><span class="lv mono"></span><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.marca}</svg></span><span class="nm">Tu marca</span><span class="fx">En un vagón 24 h, con enlace</span><span class="pr mono"><b></b></span></button>`;
  for(const id of ['tHouse','tAd']){const b=$(id);tiles[id]={b,lv:b.querySelector('.lv'),ic:b.querySelector('.ic svg'),nm:b.querySelector('.nm'),fx:b.querySelector('.fx'),pr:b.querySelector('.pr b'),c:{}}}
  for(const i of [0,1]){const b=$('po'+i);PO[i]={b,f:b.querySelector('.pf'),i:b.querySelector('.pi'),n:b.querySelector('.pn'),v:b.querySelector('.pv'),p:b.querySelector('.pp'),c:{}};b.onclick=()=>{if(!vote(i)&&POLL&&POLL.state==='open')return;uiPoll()}}
  if(!store.get('advx-tren-marca'))$('tAd').classList.add('hot');
  $('pGo').onclick=()=>{au();if(POLL)seeFork()};
  $('tHouse').onclick=()=>{au();if(st.mine<0)openHouse();else focusHouse()};
  $('tAd').onclick=()=>{au();openAd()}}
const PO=[],pollE={c:{}};
function seeFork(){const F=POLL.F,g=FORKG[F.f],p=g[0].p,q=g[1].p;touched=true;flyTo((F.x+p.x+q.x)/3,(F.z+p.z+q.z)/3,portrait()?150:105,Math.atan2(-Math.sin(F.a),-Math.cos(F.a)));cam.el=0.72}
const shareUrl=()=>window.ADVX_TREN_URL||location.origin+location.pathname;// ADVX_TREN_URL: dirección pública si la página va dentro de un marco
/* panel de la votación: opciones, porcentajes, cuenta atrás y cómo va tu voto */
function uiPoll(){const P=POLL,E=pollE;if(!P||!PO[0])return;const v=votesOf(P),tot=v[0]+v[1],open=P.state==='open',left=Math.max(0,(forkD(P.F)-CLOSE_D)/TRAIN_V);
  for(const i of [0,1]){const o=pollOpt(P,i),q=PO[i],pct=tot?Math.round(v[i]/tot*100):50;
    if(q.c.id!==o.id){q.c.id=o.id;q.i.innerHTML=ICON[o.id]||''}setTxt(q,'n',q.n,o.n);setTxt(q,'p',q.p,pct+' %');setTxt(q,'v',q.v,`${fmtN(v[i])} voto${v[i]===1?'':'s'}`);
    const f=(Math.round(pct)/100).toFixed(2);if(q.c.f!==f){q.c.f=f;q.f.style.transform=`scaleX(${f})`}
    const cls='po '+(i?'r':'l')+(P.won>=0?(P.won===i?' win':' lose'):'');if(q.c.cls!==cls){q.c.cls=cls;q.b.className=cls}
    const pr=String(P.mine===i);if(q.c.pr!==pr){q.c.pr=pr;q.b.setAttribute('aria-pressed',pr)}if(q.b.disabled!==!open)q.b.disabled=!open}
  let t='¿Por dónde tira el tren?';const h=st.mine>=0?SL[st.mine]:null;
  if(P.state==='closed')t='¡Votación cerrada!';else if(P.state==='done')t=`¡Gana ${pollOpt(P,P.won).art}!`;
  else if(P.mine>=0){const d=v[P.mine]-v[1-P.mine],o=pollOpt(P,P.mine).art;t=d>0?`Tu voto gana por ${d}`:d<0?`Tu voto pierde por ${-d}`:'Tu voto va empatado'}
  else if(h&&h.f===P.F.f)t=`Tu casa está por ${P.F.opts[h.side1].art}`;
  setTxt(E,'t',$('pTitle'),t);setTxt(E,'s',$('pTime'),open?`${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`:'');
  const b=open?clamp(left*TRAIN_V/(P.d0-CLOSE_D),0,1).toFixed(3):'0';if(E.c.b!==b){E.c.b=b;$('pBar').style.transform=`scaleX(${b})`}
  const ask=open&&P.mine>=0;if(E.c.ask!==ask){E.c.ask=ask;$('pAsk').hidden=!ask;$('pGo').hidden=ask}
  if(ask){const o=pollOpt(P,P.mine),k=o.id+(v[P.mine]>=v[1-P.mine]);if(E.c.k!==k){E.c.k=k;$('pAsk').href='https://wa.me/?text='+encodeURIComponent(`🚂 El Tren de Navidad llega al cruce y ${v[P.mine]>=v[1-P.mine]?'va ganando':'va perdiendo'} ${o.art}. ¡Vota ${o.n} antes de que pase! ${shareUrl()}`)}}
  signDirty=true}
const setTxt=(E,k,el,v)=>{if(E.c[k]!==v){E.c[k]=v;el.textContent=v}};
const fmtLeft=ms=>{const m=Math.max(0,Math.round(ms/60000));return m<60?m+' min':Math.floor(m/60)+' h '+(m%60)+' min'};
function uiShop(){if(!tiles.tHouse)return;uiPoll();
  const H=tiles.tHouse,slots=SL.length,free=slots-st.houses;
  if(st.mine<0){setTxt(H,'nm',H.nm,'Pon tu casa');setTxt(H,'fx',H.fx,free>0?'El tren te traerá regalos':'Vía llena: espera al tramo nuevo');setTxt(H,'pr',H.pr,free>0?`${free} libre${free===1?'':'s'}`:'Llena')}
  else{setTxt(H,'nm',H.nm,'Tu casa');setTxt(H,'fx',H.fx,st.myName);setTxt(H,'pr',H.pr,`${fmtN(st.myGifts)} regalos`)}
  setTxt(H,'lv',H.lv,`${st.houses}/${slots}`);const hc='it'+(st.mine<0&&free>0?' hot':'');if(H.c.cls!==hc){H.c.cls=hc;H.b.className=hc}
  const A=tiles.tAd;setTxt(A,'pr',A.pr,`Puja: ${auc.top.amt} €`);setTxt(A,'lv',A.lv,fmtLeft(closeAt()-Date.now()));
  const D=Math.min(1,st.today/st.goal);setTxt(dayE,'t',$('dayTxt'),`Día ${st.day} de ${DAYS}`);setTxt(dayE,'p',$('dayPct'),`${fmtN(st.today)}/${fmtN(st.goal)}`);
  const dr=Math.round(D*400)/400;if(dayE.c.f!==dr){dayE.c.f=dr;$('dayBar').style.transform=`scaleX(${dr})`}}
const dayE={c:{}};
async function expand(){busy=true;if(!FASTSTEP){grade.uniforms.flash.value=0.45;bells()}
  await buildWorld(st.stage);buildDeco();placeTown(true);markMine();downgrade(scene);startRun();WAG.slice(1).forEach(W=>fillWagon(W));poseTrain();
  if(!cam.focus)goHome()
  if(!FASTSTEP&&treeParts[0]){confettiBurst(treeParts[0].top.clone(),30);for(let i=0;i<6;i++)fwQ.push({at:performance.now()/1000+0.3+i*0.35,p:new THREE.Vector3(BCX+(Math.random()-.5)*120,70+Math.random()*30,BCZ+40+(Math.random()-.5)*80)})}
  busy=false;uiShop()}
/* tu casa: estrella encima y cartel con tu nombre */
let mineMark=null;
function markMine(){if(mineMark){scene.remove(mineMark.g);mineMark.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose()}});mineMark=null}
  const h=HS[st.mine];if(st.mine<0||!h)return;const g=new THREE.Group(),sh=new THREE.Shape();for(let k=0;k<10;k++){const r=k%2?0.55:1.3,a=Math.PI/2+k*Math.PI/5;k?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r)}
  const star=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:0.35,bevelEnabled:true,bevelSize:0.08,bevelThickness:0.08,bevelSegments:2}),new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,1.7,.5)}));star.geometry.center();
  const lab=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTex(512,128,(c,w,hh)=>{c.fillStyle='rgba(11,21,48,.82)';rrect(c,6,10,w-12,hh-20,40);c.fill();c.strokeStyle='#e0ad45';c.lineWidth=5;rrect(c,6,10,w-12,hh-20,40);c.stroke();
    c.fillStyle='#fbf3df';c.textAlign='center';c.textBaseline='middle';c.font='700 46px Rubik, system-ui, sans-serif';c.fillText('Tu casa · '+st.myName,w/2,hh/2+2,w-60)}),toneMapped:false,depthTest:false,transparent:true,color:new THREE.Color(.8,.8,.8)}));// por debajo del umbral del bloom: texto nítido
  lab.scale.set(9,2.25,1);lab.renderOrder=5;const p=h.chim;g.position.set(p.x,0,p.z);star.position.y=p.y+3.2;lab.position.y=p.y+6.2;g.add(star,lab);scene.add(g);mineMark={g,star,y:p.y+3.2}}
/* modales */
let lastFocusEl=null;
function openModal(id){lastFocusEl=document.activeElement;$(id).classList.add('on')}
function closeModal(id){$(id).classList.remove('on');if(lastFocusEl&&lastFocusEl.focus)lastFocusEl.focus()}
const anyModal=()=>document.querySelector('.modal.on');
const shake=el=>el.animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}],{duration:220,easing:'ease-out'});
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
function openHouse(){const free=SL.length-st.houses;if(free<=0){news('La vía está llena: cuando se cumpla el objetivo del día se abre un tramo nuevo con sitio',true);return}
  $('hName').value=st.myName||'';openModal('houseSheet');setTimeout(()=>$('hName').focus(),60)}
function claimHouse(name){const n=cleanText(name,14);if(!n||st.mine>=0||st.houses>=SL.length)return false;
  st.myName=n;st.mine=st.houses;st.houses++;addHouse();markMine();save();uiShop();return true}
$('houseForm').addEventListener('submit',e=>{e.preventDefault();if(!claimHouse($('hName').value)){shake($('hName'));$('hName').focus();return}
  closeModal('houseSheet');kaching();news(`¡Ya tienes casa junto a la vía, ${st.myName}! El tren te dejará regalos cada vez que pase`,true);setTimeout(focusHouse,250)});
$('hX').onclick=()=>closeModal('houseSheet');
/* te ha tocado ser el maquinista */
$('drvForm').addEventListener('submit',e=>{e.preventDefault();const n=cleanText($('drvName').value,14);if(!n){shake($('drvName'));return}st.myName=n;if(DRV&&DRV.me){DRV.name=n;driverTag()}$('drvNameRow').hidden=true;save();uiShop();if(st.mine>=0)markMine();kaching()});
$('drvToot').onclick=()=>{au();toot()};$('drvSee').onclick=()=>setFocus({car:0});$('drvX').onclick=()=>{$('drvCard').hidden=true};
$('drvShare').onclick=()=>{$('drvShare').href='https://wa.me/?text='+encodeURIComponent(`🚂 ¡Ahora mismo llevo yo el Tren de Navidad! Mira mi nombre en la locomotora y vota por dónde va: ${shareUrl()}`)};
/* tu marca: editor, vista previa, puja y vagón con mensaje */
const ed={tab:'bid',img:'',text:'',sub:'',url:'',bg:AD_BG[0]};
const edAd=()=>({text:cleanText(ed.text,32),sub:cleanText(ed.sub,40),bg:ed.bg,img:ed.img,url:cleanUrl(ed.url)||''});
const edEmpty=()=>!ed.img&&!cleanText(ed.text,32)&&!cleanText(ed.sub,40);
const urlBad=()=>cleanUrl(ed.url)===null;
async function drawPrev(){const a=edAd(),im=await loadImg(a.img);const cv=$('adPrev');
  if(edEmpty())drawAd(cv,{text:'Tu marca aquí',sub:'Sube una imagen o escribe un mensaje',bg:a.bg,tag:ed.tab==='bid'?'Patrocinado':''});else drawAd(cv,{...a,im,host:a.url?hostOf(a.url):'',tag:ed.tab==='bid'?'Patrocinado':''})}
const fmtDay=ms=>new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(ms);
function syncAdForm(){const bid=ed.tab==='bid';$('tabBid').setAttribute('aria-selected',bid);$('tabMsg').setAttribute('aria-selected',!bid);$('bidRow').hidden=!bid;$('msgGo').hidden=bid;
  if(bid){const t=auc.top;$('adLead').innerHTML=`Tu imagen va en el <b>primer vagón</b> todo el <b>${fmtDay(showDay())}</b>. Puja más alta: <b>${t.amt} €</b> (${t.me?'tú':t.who}). Cierra a las ${CLOSE_H}:00, dentro de ${fmtLeft(closeAt()-Date.now())}.`;
    const mb=minBid(t.amt),inp=$('bidAmt');inp.min=mb;if(!(+inp.value>=mb))inp.value=mb;$('bidGo').textContent=t.me?'Subir mi puja':`Pujar ${Math.max(mb,+inp.value||mb)} €`}
  else{const w=msgWagon(),free=WAG.slice(1).filter((_,k)=>!ADS[k+1]||!ADS[k+1].ad).length;$('adLead').innerHTML=w>0?`Tu imagen o mensaje va en un vagón durante <b>24 horas</b> por <b>${MSG_PRICE} €</b>. ${free===1?'Queda 1 vagón libre':'Quedan '+free+' vagones libres'} hoy.`:'Hoy no quedan vagones libres. Cuando entre todos ganéis otro vagón, habrá sitio.';$('msgGo').disabled=w<0}
  drawPrev()}
function openAd(tab){store.set('advx-tren-marca','1');tiles.tAd.b.classList.remove('hot');if(tab)ed.tab=tab;syncAdForm();openModal('adSheet')}
$('adX').onclick=()=>closeModal('adSheet');
$('tabBid').onclick=()=>{ed.tab='bid';syncAdForm()};$('tabMsg').onclick=()=>{ed.tab='msg';syncAdForm()};
$('adText').addEventListener('input',e=>{ed.text=e.target.value;drawPrev()});$('adSub').addEventListener('input',e=>{ed.sub=e.target.value;drawPrev()});
$('adUrl').addEventListener('input',e=>{ed.url=e.target.value;$('adErr').textContent='';drawPrev()});
$('bidAmt').addEventListener('input',()=>{if(!auc.top.me)$('bidGo').textContent=`Pujar ${Math.max(minBid(auc.top.amt),+$('bidAmt').value||0)} €`});
$('adBg').innerHTML=AD_BG.map((c,i)=>`<button type="button" role="radio" aria-checked="${i===0}" aria-label="Color ${i+1}" style="--c:${c}" data-c="${c}"></button>`).join('');
$('adBg').onclick=e=>{const b=e.target.closest('button');if(!b)return;ed.bg=b.dataset.c;$('adBg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',x===b));drawPrev()};
/* la imagen se reduce a 800 px como mucho en el propio navegador (en la versión real se sube y se revisa) */
$('adFile').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  if(!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>8e6){$('adErr').textContent='Usa una imagen PNG, JPG o WebP de menos de 8 MB.';return}$('adErr').textContent='';
  const url=URL.createObjectURL(f),im=await loadImg(url);imgCache.delete(url);URL.revokeObjectURL(url);if(!im){$('adErr').textContent='No se ha podido leer la imagen.';return}
  const k=Math.min(1,800/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,0,0,c.width,c.height);
  ed.img=c.toDataURL(f.type==='image/jpeg'?'image/jpeg':'image/png',0.9);$('adFileLbl').textContent='Cambiar imagen';drawPrev()});
function adCheck(){if(edEmpty()){$('adErr').textContent='Sube una imagen o escribe un mensaje.';shake($('adPrev'));return false}
  if(urlBad()){$('adErr').textContent='Revisa el enlace: tiene que ser una web, por ejemplo tumarca.com o instagram.com/tumarca.';shake($('adUrl'));$('adUrl').focus();return false}return true}
$('bidGo').onclick=()=>{if(!adCheck())return;
  const amt=Math.floor(+$('bidAmt').value),mb=auc.top.me?auc.top.amt+1:minBid(auc.top.amt);if(!(amt>=mb)){$('adErr').textContent=`La puja mínima es de ${mb} €.`;shake($('bidAmt'));return}
  $('adErr').textContent='';auc.top={amt,who:cleanText(ed.text,32)||'Tu marca',me:true};auc.bid={amt,ad:edAd()};saveAuc();kaching();rivalT=Math.max(rivalT,20);
  news(`Vas ganando la puja con ${amt} €. Si alguien te supera, te avisamos`,true);syncAdForm();uiShop()};
$('msgGo').onclick=async()=>{if(!adCheck())return;
  const w=msgWagon();if(w<0)return;$('adErr').textContent='';auc.mine={wagon:w,ad:edAd()};saveAuc();await setAd(w,auc.mine.ad);kaching();closeModal('adSheet');
  news('¡Tu vagón ya va en el tren! (En la versión real, en cuanto se revise y se pague)',true);setFocus({car:w+1})};
let previewOf=null;
$('adSee').onclick=async()=>{if(urlBad()){adCheck();return}const i=ed.tab==='bid'?1:(msgWagon()>0?msgWagon():2);if(!WAG[i])return;previewOf={i,ad:ADS[i]?ADS[i].ad:null};
  await setAd(i,edEmpty()?{text:'Tu marca aquí',bg:ed.bg,tag:ed.tab==='bid'?'Patrocinado':''}:{...edAd(),tag:ed.tab==='bid'?'Patrocinado':''});closeModal('adSheet');setFocus({car:i+1,preview:true})};
async function endPreview(){if(!previewOf)return;const p=previewOf;previewOf=null;await setAd(p.i,p.ad)}
$('caFree').onclick=()=>{au();openAd(+$('card').dataset.w===1?'bid':'msg')};
/* noticias de la comunidad (simuladas en la demo) */
const newsQ=[];let newsT=0;
function news(t,hi){if(FASTSTEP)return;if(hi){newsQ.unshift({t,hi});newsT=Math.min(newsT,0.2)}else newsQ.push({t,hi});if(newsQ.length>5)newsQ.length=5}
function chatter(){const r=Math.random(),P=POLL;
  if(P&&P.state==='open'){if(r<0.34)return `${person()} ha votado ${pollOpt(P,Math.random()<.5?0:1).art}`;
    if(r<0.52){const v=votesOf(P),w=v[0]>=v[1]?0:1,d=Math.abs(v[0]-v[1]);return d?`Va ganando ${pollOpt(P,w).art} por ${d} voto${d===1?'':'s'}`:'¡Empate en el cruce!'}}
  if(r<0.66&&DRV&&DRV.name&&!DRV.me)return `${DRV.name} lleva el tren hasta el próximo cruce`;
  if(r<0.84)return `${person()} ha recibido ${fmtN(sacoOf(st))} regalos en su casa`;
  return `Puja más alta por el vagón de mañana: ${auc.top.amt} €`}
let newsCur='';
function uiNews(dt){newsT-=dt;if(newsT>0)return;const n=newsQ.shift()||{t:chatter()};newsT=n.hi?5:3.4;if(n.t===newsCur)return;newsCur=n.t;
  const el=$('newsTxt');el.textContent=n.t;$('tip').classList.toggle('hi',!!n.hi);if(!REDUCED)el.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'})}
/* contador de regalos de todos y gente mirando el tren */
let dispG=st.total,lastRate='';
function uiBank(dt){dispG=Math.abs(st.total-dispG)<1?st.total:lerp(dispG,st.total,1-Math.exp(-8*dt));const t=fmtN(dispG);if($('gifts').textContent!==t)$('gifts').textContent=t;
  const r=`${NF.format(online(simClock))} viendo el tren`;if(r!==lastRate){lastRate=r;$('rate').textContent=r}}
/* números que salen de las chimeneas */
const FL=[];let flI=0;
function floatAt(p,text,cls){if(FASTSTEP)return;tmpV.copy(p);tmpV.y+=2.5;tmpV.project(camera);if(tmpV.z>1||Math.abs(tmpV.x)>1.1||Math.abs(tmpV.y)>1.1)return;
  let e=FL[flI];if(!e){e=document.createElement('div');e.className='fl';e.innerHTML='<span></span>';$('floats').appendChild(e);FL[flI]=e}flI=(flI+1)%14;
  e.className='fl'+(cls?' '+cls:'');e.style.transform=`translate(${((tmpV.x*.5+.5)*innerWidth).toFixed(1)}px,${((-tmpV.y*.5+.5)*innerHeight).toFixed(1)}px)`;const s=e.firstChild;s.textContent=text;
  s.getAnimations().forEach(a=>a.cancel());
  s.animate(REDUCED?[{opacity:0},{opacity:1,offset:.2},{opacity:0}]:[{opacity:0,transform:'translate(-50%,-20%) scale(.9)'},{opacity:1,offset:.18,transform:'translate(-50%,-90%) scale(1)'},{opacity:0,transform:'translate(-50%,-260%) scale(1)'}],{duration:cls==='me'?1700:1100,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'})}
/* cámara pegada a un vagón (con su ficha) o libre */
/* keep: al soltarlo alejando el zoom, la vista se queda donde está; si no, vuelve a la que tenías antes de seguirlo */
function setFocus(f,keep){if(!f&&previewOf)endPreview();const was=cam.focus;
  if(f){const c=cars[f.car];if(!c)return;const yaw=-c.rotation.y,ca=Math.atan2(camera.position.z-c.position.z,camera.position.x-c.position.x);
    if(!was)cam.back={x:cam.tgt.x,y:cam.tgt.y,z:cam.tgt.z,d:cam.d,az:cam.az,el:cam.el};blendFrom();stopMotion();
    if(f.chase){cam.faz=Math.PI-0.45;cam.fel=0.36;cam.fdT=26}
    else{cam.faz=Math.sin(ca-yaw)>=0?Math.PI/2:-Math.PI/2;cam.fel=0.3;cam.fdT=f.car>=2&&f.car<cars.length-1?clamp(4.8/(tanH()*camera.aspect),12,46):18}
    cam.fd=cam.fdT;cam.tgt.set(c.position.x,c.position.y+2.7,c.position.z);hideHint()}
  else if(was){cam.vaz=cam.vel=0;if(keep){bl.t=0;cam.focus=null;cam.d=cam.fd;anchor()}else{blendFrom();const b=cam.back;if(b){cam.tgt.set(b.x,b.y,b.z);cam.d=b.d;cam.az=b.az;cam.el=b.el}else{cam.tgt.copy(CTR);cam.d=defD();cam.el=homeEl();cam.az=Math.PI/2}}}
  cam.focus=f||null;lastInput=performance.now();document.body.classList.toggle('foc',!!f);{const on=!!(f&&f.chase),b=$('bCam');b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);b.title=on?'Ver la maqueta (C)':'Seguir al tren (C)'}
  const wi=f&&f.car!==undefined?f.car-1:-1;if(wi>=1&&wi<WAG.length)showCard(wi);else hideCard();
  const pill=$('focusX');pill.hidden=!f;if(f)pill.textContent=f.preview?'Vista previa · Volver':'Volver a la maqueta'}
$('focusX').onclick=()=>{const wasPrev=previewOf;setFocus(null);if(wasPrev)openAd()};
$('bCam').onclick=()=>{au();setFollow(!(cam.focus&&cam.focus.chase))};
/* botones de la vista */
const mid=()=>[innerWidth/2,innerHeight/2],turn=a=>{touched=true;if(cam.focus){cam.vaz=a*6;return}anchor();cam.vaz=0;cam.azT=(cam.azT===null?cam.az:cam.azT)+a;lastInput=performance.now();hideHint()};
$('nIn').onclick=()=>{touched=true;zoomAt(...mid(),0.62)};$('nOut').onclick=()=>{touched=true;zoomAt(...mid(),1.6)};$('nRot').onclick=()=>turn(Math.PI/4);$('nHome').onclick=()=>{touched=true;hideHint();goHome()};
function nudge(dx,dy){touched=true;hideHint();if(cam.focus)return rotate(-dx*1.2,-dy);if(bl.t<1)anchor();const k=2.1*cam.d*tanH()/innerHeight,s=Math.sin(cam.az),c=Math.cos(cam.az),v=6;cam.vx=clamp(cam.vx+(s*dx+c*dy)*k*v,-1.4*cam.d,1.4*cam.d);cam.vz=clamp(cam.vz+(-c*dx+s*dy)*k*v,-1.4*cam.d,1.4*cam.d);lastInput=performance.now()}
const NAVK={ArrowLeft:[-34,0],ArrowRight:[34,0],ArrowUp:[0,-34],ArrowDown:[0,34],a:[-34,0],d:[34,0],w:[0,-34],s:[0,34]};
addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||!ready||anyModal()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(NAVK[k]){e.preventDefault();nudge(...NAVK[k])}else if(k==='+'||k==='=')zoomAt(...mid(),0.75);else if(k==='-')zoomAt(...mid(),1.34);else if(k==='q'&&!e.repeat)turn(-Math.PI/6);else if(k==='e'&&!e.repeat)turn(Math.PI/6);else if(k==='0'||k==='Home'){touched=true;goHome()}});
addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Escape'){const m=anyModal();if(m)closeModal(m.id);else if(!$('drvCard').hidden)$('drvCard').hidden=true;else if(cam.focus)setFocus(null);return}
  if(anyModal()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(!e.repeat&&(e.key==='c'||e.key==='C'))setFollow(!(cam.focus&&cam.focus.chase));else if(!e.repeat&&(e.key==='1'||e.key==='2'))vote(+e.key-1)});
new ResizeObserver(()=>document.documentElement.style.setProperty('--shop-h',$('shop').offsetHeight+'px')).observe($('shop'));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)save()});
addEventListener('pagehide',()=>{if(ready)save()});

/* ================= bucle ================= */
let last=performance.now(),fA=0,fN=0,lastAdj=0,fwOn=false,cfOn=false,spkOn=false;
function fx(dt,t){
  const L=cars[0];if(!L||!T)return;
  // humo: dentro de un túnel no sale (se vería atravesando la montaña)
  const inTun=kindAt(T,dist+3)===KT,ch=L.localToWorld(tmpV.copy(L.userData.chimney));smokeAcc+=dt*(1.6+vCur*0.3);
  while(smokeAcc>1){smokeAcc-=1;if(!inTun)puff(ch,tmpV2.set((Math.random()-.5)*0.8,4.2+Math.random(),(Math.random()-.5)*0.8),1,.26,1.7)}
  smokeU.k.value=renderer.getPixelRatio()*innerHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  smoke.forEach((p,i)=>{if(p.life<=0){smA[i*2+1]=0;return}p.life-=dt/p.ml;p.p.addScaledVector(p.v,dt);p.v.multiplyScalar(Math.exp(-0.6*dt));p.sz+=dt*1.7;smP[i*3]=p.p.x;smP[i*3+1]=p.p.y;smP[i*3+2]=p.p.z;smA[i*2]=p.sz;smA[i*2+1]=Math.max(0,p.life)*p.op});
  smG.attributes.position.needsUpdate=true;smG.attributes.sa.needsUpdate=true;
  spkOn=false;for(let i=0;i<SPK;i++){const s=spk[i];if(s.life<=0){spkP[i*3+1]=-99;continue}spkOn=true;s.life-=dt;s.v.y-=18*dt;spkP[i*3]+=s.v.x*dt;spkP[i*3+1]+=s.v.y*dt;spkP[i*3+2]+=s.v.z*dt}spkG.attributes.position.needsUpdate=true;
  snowU.px.value=renderer.getPixelRatio();snowU.t.value=t;
  const cp=camera.position;for(let i=0;i<SN;i++){let y=snowP[i*3+1]-dt*(0.8+(i%5)*0.15);if(y<cp.y-25)y+=70;if(y>cp.y+45)y-=70;snowP[i*3+1]=y;let x=snowP[i*3]+Math.sin(t*0.6+i)*dt*0.4;if(x-cp.x>80)x-=160;if(x-cp.x<-80)x+=160;snowP[i*3]=x;let z=snowP[i*3+2];if(z-cp.z>80)z-=160;if(z-cp.z<-80)z+=160;snowP[i*3+2]=z}
  snowG.attributes.position.needsUpdate=true;
  const tk=[0,1,2].map(i=>treeLightK*(0.45+0.55*Math.max(0,Math.sin(t*2.2+i*2.1)))),tc=new THREE.Color();
  for(const P of[roomTree,...treeParts]){if(!P)continue;P.base.forEach((c,i)=>P.lights.setColorAt(i,tc.copy(c).multiplyScalar(tk[i%3])));P.lights.instanceColor.needsUpdate=true;P.star.rotation.y=t*0.6;P.glow.material.opacity=0.45+treeLightK*0.15+Math.sin(t*2.2)*0.08}
  arches.forEach((a,k)=>a.forEach((m,i)=>m.material.color.setScalar((Math.floor(t*2.5+k)+i)%2?1:0.25)));
  eaveLights.forEach((m,i)=>m.material.color.setScalar(0.5+0.5*Math.max(0,Math.sin(t*1.6+i*3.1))));
  if(fireU){fireU.t.value=t;warmFill.intensity=0.42+Math.sin(t*7)*0.05+Math.sin(t*13.7)*0.04}
  const tp=L.position;
  if(STN){if(STN.hop>0){STN.hop=Math.max(0,STN.hop-dt*1.5);STN.pile.position.y=Math.abs(Math.sin(STN.hop*Math.PI*3))*1.2*STN.hop}const d=Math.hypot(STN.x-tp.x,STN.z-tp.z);STN.nut.rotation.y=STN.base+(d<30?Math.sin(t*6)*0.35:0);
    if(SANTA){const near=d<46?1:0;SANTA.w=lerp(SANTA.w||0,near,1-Math.exp(-3*dt));SANTA.arm.rotation.x=-SANTA.w*(2.5+Math.sin(t*8)*0.35)}}
  anims.forEach(a=>{const o=a.o;if(a.k==='deer'){o.rotation.y=a.base+Math.sin(t*0.6+a.ph)*0.35;o.rotation.x=Math.max(0,Math.sin(t*0.9+a.ph))*0.12}
    else if(a.k==='snowman'){o.rotation.z=Math.sin(t*1.4+a.ph)*0.06}
    else if(a.k==='ginger'){o.getWorldPosition(tmpV);const d=tmpV.distanceTo(tp);const hop=d<28?Math.abs(Math.sin(t*9+a.ph))*1.3:0;o.position.y=a.y+hop;o.rotation.z=d<28?Math.sin(t*9+a.ph)*0.25:0}});
  // regalos volando (taller → vagón, vagón → chimenea)
  for(let k=flyQ.length-1;k>=0;k--){const q=flyQ[k];q.t+=dt/q.dur;const e=Math.min(1,q.t);q.f.position.lerpVectors(q.from,q.to,e);q.f.position.y+=Math.sin(e*Math.PI)*q.arc;q.f.rotation.y+=dt*8;if(q.t>=1){q.f.visible=false;flyQ.splice(k,1);q.onEnd&&q.onEnd()}}
  // vagones nuevos
  for(let i=1;i<WAG.length;i++){const W=WAG[i];if(W.userData.pop===undefined||W.userData.pop>=1)continue;W.userData.pop=Math.min(1,W.userData.pop+dt/0.45);const p=W.userData.pop;W.scale.setScalar((0.6+0.4*(1-Math.pow(1-p,3)))*(1+Math.sin(p*Math.PI*2)*(1-p)*0.12));if(p===1){W.scale.setScalar(1);puff(W.position.clone().setY(W.position.y+1.5),new THREE.Vector3(0,2,0),3,.4,1.2)}}
  // casas que aparecen: caen un poco con rebote y luego se unen al resto
  for(let k=popQ.length-1;k>=0;k--){const h=popQ[k];h.pop+=dt/0.55;if(h.pop<0)continue;h.g.visible=true;const p=Math.min(1,h.pop),e=1-Math.pow(1-p,3);h.g.scale.setScalar(lerp(0.55,1,e)+Math.sin(p*Math.PI*2)*(1-p)*0.16);h.g.position.y=h.y0+(1-e)*5;
    if(!h.landed&&p>0.5){h.landed=true;puff(tmpV.set(h.g.position.x,h.y0+1,h.g.position.z),new THREE.Vector3(0,1.5,0),5,.45,1.3);if(burstBudget>0){burstBudget--;burst(h.chim,30,6,[3,3,3.4])}}
    if(p>=1){h.g.scale.setScalar(1);h.g.position.y=h.y0;h.g.updateMatrixWorld(true);popQ.splice(k,1);needBatch=true}}
  if(needBatch&&!popQ.length){needBatch=false;rebatch()}
  fireworks.visible=fwOn;confetti.visible=cfOn;sparks.visible=spkOn;
  if(fwQ.length&&fwQ[0].at<=t){const q=fwQ.shift();burst(q.p);noise(0.5,0.2,500)}
  let fwa=false;for(let i=0;i<FWN;i++){const p=fw[i];if(p.l<=0)continue;fwa=true;p.l-=dt;p.v.multiplyScalar(Math.exp(-1.4*dt));p.v.y-=6*dt;fwP[i*3]+=p.v.x*dt;fwP[i*3+1]+=p.v.y*dt;fwP[i*3+2]+=p.v.z*dt;if(p.l<=0)fwP[i*3+1]=-999;fwC[i*3]*=0.985;fwC[i*3+1]*=0.985;fwC[i*3+2]*=0.985}
  if(fwa){fwG.attributes.position.needsUpdate=true;fwG.attributes.color.needsUpdate=true}fwOn=fwa;
  let cfa=false;for(let i=0;i<CFN;i++){const p=cf[i];if(p.l<=0)continue;cfa=true;p.l-=dt;p.v.y-=9*dt;p.v.x*=Math.exp(-1.5*dt);p.v.z*=Math.exp(-1.5*dt);if(p.v.y<-3)p.v.y=-3;cfP[i*3]+=(p.v.x+Math.sin(t*4+p.ph)*1.5)*dt;cfP[i*3+1]+=p.v.y*dt;cfP[i*3+2]+=(p.v.z+Math.cos(t*4+p.ph)*1.5)*dt;if(cfP[i*3+1]<0.4)cfP[i*3+1]=0.4;if(p.l<=0)cfP[i*3+1]=-999}
  if(cfa)cfG.attributes.position.needsUpdate=true;cfOn=cfa;
  {const cp2=camera.position,ca=Math.atan2(cp2.z-BCZ,cp2.x-BCX),cr=Math.hypot(cp2.x-BCX,cp2.z-BCZ),k=1-Math.exp(-6*dt);
   for(const G of GIANTS){const want=cr>G.r*0.75?1-0.97*(1-sstep(0.32,0.62,Math.abs(wrapA(G.a-ca)))):1;if(Math.abs(want-G.op)<0.003)continue;
     G.op=lerp(G.op,want,k);G.mats.forEach(m=>{m.opacity=G.op;m.depthWrite=G.op>0.98});G.o.visible=G.op>0.04;const sh=G.op>0.5;if(G.sh!==sh){G.sh=sh;G.o.traverse(c=>{if(c.isMesh)c.castShadow=sh})}}}
  grade.uniforms.flash.value*=Math.exp(-5*dt);grade.uniforms.t.value=t;
  burstBudget=Math.min(3,burstBudget+dt*2);if(noneT>0)noneT-=dt;
  if(beam)beam.visible=!(cam.focus&&cam.focus.chase)&&!inTun;
  if(mineMark){mineMark.star.rotation.y=t*1.4;mineMark.star.position.y=mineMark.y+Math.sin(t*2.2)*0.35}
  // esquiadores: bajan haciendo eses y vuelven a salir de arriba
  if(SKI){const S=SKI;S.list.forEach((s,i)=>{s.s+=dt*s.v;if(s.s>S.L)s.s=0;const q=S.at(s.s),ph=t*s.f+s.ph,lat=Math.sin(ph)*4,wd=Math.cos(ph)*s.f*4,x=q.x-q.dz*lat,z=q.z+q.dx*lat,vx=q.dx*s.v-q.dz*wd,vz=q.dz*s.v+q.dx*wd;
    o3.position.set(x,groundAt(x,z),z);o3.rotation.set(clamp(wd*0.08,-0.4,0.4),-Math.atan2(vz,vx),0,'YXZ');o3.scale.setScalar(1);o3.updateMatrix();S.jm.setMatrixAt(i,o3.matrix);S.rm.setMatrixAt(i,o3.matrix)});S.jm.instanceMatrix.needsUpdate=true;S.rm.instanceMatrix.needsUpdate=true}
  // telesilla: sillas que suben por un lado y bajan por el otro; las de subida, con gente
  if(LIFT){const Lf=LIFT,tot=2*Lf.len,R=Lf.riders;for(let i=0;i<Lf.n;i++){const p=((t*1.5+i/Lf.n*tot)%tot+tot)%tot,up=p<Lf.len,s=up?p:tot-p,sd=up?1:-1,x=Lf.b[0]+Lf.ux*s+Lf.nx*1.7*sd,z=Lf.b[1]+Lf.uz*s+Lf.nz*1.7*sd,y=Lf.cy(s)-2.45,yaw=Math.atan2(Lf.uz,Lf.ux)+(up?0:Math.PI);
    o3.position.set(x,y,z);o3.rotation.set(0,-yaw,Math.sin(t*1.3+i)*0.04,'YXZ');o3.scale.setScalar(1);o3.updateMatrix();Lf.cm.setMatrixAt(i,o3.matrix);Lf.pos[i]={x,y,z,yaw};
    const m=up&&i%2===0?o3.matrix:ZERO;R.jm.setMatrixAt(i,m);R.rm.setMatrixAt(i,m)}o3.rotation.set(0,0,0);[Lf.cm,R.jm,R.rm].forEach(m=>m.instanceMatrix.needsUpdate=true)}
  // patinadores en el lago
  if(SKATE){const S=SKATE,Lk=F.lake;S.list.forEach((s,i)=>{const a=t*s.w+s.ph,x=Lk.x+Math.cos(a)*Lk.rx*s.rr,z=Lk.z+(s.k===2?Math.sin(2*a)*Lk.rz*0.5:Math.sin(a)*Lk.rz*s.rr),dx=-Math.sin(a)*Lk.rx*s.rr,dz=s.k===2?Math.cos(2*a)*Lk.rz:Math.cos(a)*Lk.rz*s.rr;
    o3.position.set(x,LAKE_Y,z);o3.rotation.set(0.1,-Math.atan2(dz,dx),0,'YXZ');o3.updateMatrix();S.jm.setMatrixAt(i,o3.matrix);S.rm.setMatrixAt(i,o3.matrix)});o3.rotation.set(0,0,0);S.jm.instanceMatrix.needsUpdate=true;S.rm.instanceMatrix.needsUpdate=true}
  // el trineo de Papá Noel, por encima de todo
  if(SLEIGH){const a=t*0.05,rx=175,rz=150;SLEIGH.position.set(BCX+Math.cos(a)*rx,96+Math.sin(t*0.7)*5,BCZ+Math.sin(a)*rz);SLEIGH.rotation.set(0,-Math.atan2(Math.cos(a)*rz,-Math.sin(a)*rx),Math.sin(t*0.7)*0.06)}
  forkFx(t);
  if(DRV&&DRV.tag){const k=2*tanH()/innerHeight*(innerWidth<560?112:136);DRV.tag.scale.set(k,k/4,1);DRV.tag.position.y=cutK>=0.5?5.2:6.6}
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
let uiAcc=0,HOLD=false;// HOLD: solo para las pruebas (congela el tren)
function loop(now){requestAnimationFrame(loop);
  const cap=coarse&&!ptrs.size&&now-lastInput>1500,raw=(now-last)/1000;if(cap&&raw<1/32)return;
  last=now;const dt=Math.min(0.05,raw),t=now/1000;
  if(!ready)return;
  if(!HOLD){let simT=Math.min(raw,1);while(simT>1e-4){const h=Math.min(0.05,simT);sim(h);simT-=h}}
  fx(dt,t);trainInst();updateCam(Math.min(0.2,raw));uiBank(dt);uiNews(raw);auctionTick(raw);
  uiAcc+=dt;if(uiAcc>0.1){uiAcc=0;uiShop()}
  if(dbg)renderer.info.reset();draw(dt);dbgFrame(raw);
  if(!window.__idleNoAdapt)adapt(raw,now,cap);
}
function perf(n=120,pr=1){const ip=dynPR,ar=renderer.info.autoReset;dynPR=pr;resize();renderer.info.autoReset=false;const gl=renderer.getContext(),px=new Uint8Array(4),sync=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
  for(let i=0;i<3;i++){draw(1/60);sync()}renderer.info.reset();draw(1/60);sync();const calls=renderer.info.render.calls,tris=renderer.info.render.triangles;
  const t0=performance.now();for(let i=0;i<n;i++){renderer.info.reset();draw(1/60);sync()}const ms=(performance.now()-t0)/n;
  renderer.info.autoReset=ar;dynPR=ip;resize();return {ms:+ms.toFixed(2),calls,tris,tex:renderer.info.memory.textures,geo:renderer.info.memory.geometries,pr,w:innerWidth,h:innerHeight}}

/* ================= arranque ================= */
function prog(p,txt){$('lBar').style.transform=`scaleX(${(p/100).toFixed(3)})`;if(txt)$('lTxt').textContent=txt}
async function boot(){
  buildShop();uiBank(1);
  prog(4,'Sacando los juguetes de la caja…');
  const fontP=document.fonts?Promise.all(['400 80px "Alfa Slab One"','500 40px Rubik','700 46px Rubik'].map(f=>document.fonts.load(f))).catch(()=>{}):null;
  await loadModels(p=>prog(4+p*52));
  maxAniso=renderer.capabilities.getMaxAnisotropy();toyCache.forEach(m=>cutMat(m));
  buildTrain(st.wagons);
  prog(60,'Montando el salón…');await tick();
  buildRoom();room.traverse(o=>{if(o.isMesh&&!o.material.isShaderMaterial)o.userData.st=true});batchStatic(room);freeze(room);if(!LOWQ)buildFurniture();loadEnv();roomTree=buildTree(room,BCX,-1.2,-330,2.6);buildSleigh();
  prog(70,'Levantando las montañas…');await tick();
  await buildWorld(st.stage);buildDeco();placeTown(false);
  startRun();WAG.slice(1).forEach(W=>fillWagon(W));poseTrain();vCur=TRAIN_V;
  await fontP;markMine();await applyAds();downgrade(scene);
  cam.tgt.copy(CTR);cam.d=defD();cam.el=homeEl();snapCam();trainInst();setCursor('grab');
  prog(100,'');ready=true;$('load').classList.add('done');uiShop();showHint();
  setDriver(person(),false);news('Vota por dónde va el tren: en el cruce manda la mayoría',true);
  save();
}
boot().catch(e=>{console.error(e);const el=$('err');el.textContent='No se ha podido montar la maqueta. Recarga la página.';el.style.display='block'});
requestAnimationFrame(loop);

/* gancho para las pruebas automáticas */
const scr=w=>{w.project(camera);return {x:(w.x*.5+.5)*innerWidth,y:(-w.y*.5+.5)*innerHeight,z:w.z}};
window.__tren={get st(){return st},get ready(){return ready},get busy(){return busy},get auc(){return auc},
  step(sec){FASTSTEP=true;try{let n=Math.ceil(sec/0.05);while(n-->0)sim(0.05)}finally{FASTSTEP=false}},
  claim:claimHouse,finishDay:()=>{if(addVotes(st,Math.max(0,st.goal-st.today)))dayDone()},
  rival:()=>{rivalT=0;const r=Math.random;Math.random=()=>0;try{auctionTick(0)}finally{Math.random=r}},
  houses:()=>HS.length,wagons:()=>WAG.length-1,delivered:()=>delivered,starve:()=>starve,laps:()=>laps,
  ads:()=>Object.keys(ADS).filter(i=>ADS[i].ad).map(Number),adImg:i=>ADS[i]&&ADS[i].ad?{w:ADS[i].tex.image.width,h:ADS[i].tex.image.height,text:ADS[i].ad.text||'',img:!!ADS[i].ad.img,url:ADS[i].ad.url||''}:null,
  news:()=>newsCur,focus:f=>setFocus(f),get focused(){return cam.focus},camSettle:()=>{for(let i=0;i<90;i++)updateCam(0.05)},
  camInfo:()=>({p:camera.position.toArray().map(v=>+v.toFixed(1)),t:cam.tgt.toArray().map(v=>+v.toFixed(1)),d:+cam.d.toFixed(1),fd:+cam.fd.toFixed(1),az:+cam.az.toFixed(3),el:+cam.el.toFixed(3),v:+Math.hypot(cam.vx,cam.vz).toFixed(1),fly:bl.t<1}),
  under:(x,y)=>{const P=pickGround(x,y);return P&&P.toArray()},onScreen:(x,y,z)=>scr(new THREE.Vector3(x,y,z)),goHome,
  follow:setFollow,perf,get scene(){return scene},settle:()=>snapCam(),
  look:(az,el,d,x,z)=>{setFocus(null);stopMotion();cam.az=az;cam.el=el;cam.d=d||defD();if(x!==undefined)cam.tgt.set(x,Math.max(0,groundAt(x,z))+2,z);else cam.tgt.copy(CTR);lastInput=performance.now()+1e9;snapCam()},
  // toques: se proyecta un punto a la pantalla y se toca ahí, como haría un dedo
  carScreen:i=>{const c=cars[i];if(!c)return null;return scr(c.localToWorld(new THREE.Vector3(0,2.9,0)))},
  offs:i=>OFFS[i],poll:()=>POLL&&{f:POLL.F.f,id:POLL.F.id,state:POLL.state,won:POLL.won,mine:POLL.mine,votes:votesOf(POLL),opts:[0,1].map(i=>pollOpt(POLL,i).n),route:[0,1].map(i=>pollRoute(POLL,i)),d:+forkD(POLL.F).toFixed(1)},vote,setVotes:(a,b)=>{POLL.n=[a,b];uiPoll()},sign:i=>SIGN[i].sp.visible?scr(SIGN[i].sp.position.clone()):null,seeFork,
  driver:()=>DRV&&{name:DRV.name,me:DRV.me,tag:!!DRV.tag},drive:()=>setDriver(st.myName||'',true),bits:()=>T.bits,route:b=>{T=MP.R[b||0];setDist(dist);poseTrain()},routes:()=>MP.R.map(r=>+r.L.toFixed(1)),forks:()=>MP.forks.map(F=>({id:F.id,s:+T.fs[F.f].toFixed(1),m:+T.ms[F.f].toFixed(1)})),carPos:i=>cars[i].position.toArray(),slot:i=>({...SL[i],rs:[...SL[i].rs]}),inside:()=>cutK>=0.5,
  lookP:(x,y,z,d,az,el)=>{setFocus(null);stopMotion();cam.az=az;cam.el=el;cam.tgt.set(x,y,z);cam.d=d;lastInput=performance.now()+1e9;snapCam()},
  sleigh:()=>SLEIGH&&SLEIGH.position.toArray(),hold:on=>{HOLD=!!on},
  cpu:(n=60)=>{const t0=performance.now();for(let i=0;i<n;i++){sim(1/60);fx(1/60,i/60);trainInst();updateCam(1/60)}return +((performance.now()-t0)/n).toFixed(2)},
  tap:(x,y)=>pick(x,y),zoomAt:(x,y,f)=>zoomAt(x,y,f),ground:groundAt,
  map:()=>({L:+MP.T.L.toFixed(1),runs:MP.T.runs.map(r=>({k:r.k,s:+(r.i*T.ds).toFixed(1),len:+(r.n*T.ds).toFixed(1)})),slots:SL.length,stage:st.stage}),
  card:()=>({hidden:$('card').hidden,name:$('caName').textContent,href:$('caGo').hidden?null:$('caGo').href}),
  kindAt:s=>kindAt(T,s),get dist(){return dist},set dist(v){setDist(v);poseTrain();openPoll()}};
