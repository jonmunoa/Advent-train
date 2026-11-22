import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
clearTimeout(window.__boot);
THREE.Cache.enabled=true;

/* ================= utilidades ================= */
const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1)};
const fmtD=d=>(d<0?'−':'+')+Math.abs(d).toFixed(1);
const rng=seed=>()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hash2(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u),lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u),v)}
const fbm=(x,y)=>vnoise(x,y)*0.6+vnoise(x*2.1,y*2.1)*0.28+vnoise(x*4.3,y*4.3)*0.12;
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),ms))]);
const tick=()=>new Promise(r=>setTimeout(r,0));

/* ================= datos ================= */
const TAG='TU-TAG-21',SITE_URL='https://tu-dominio.es/';
const NAMES=['Alrededor del árbol','Bosque de abetos','Lago helado','Pueblo de las luces','Colina del reno','Valle de los muñecos','Estación del Polo','Curvas de turrón','Sendero de bastones','Aldea de los elfos','Paso de la ventisca','Río de chocolate','Plaza del belén','Túnel de estrellas','Granja de renos','Mercadillo navideño','Cumbre nevada','Fábrica de juguetes','Bahía de hielo','Camino de los Reyes','Bosque encantado','Pista del trineo','Noche de luces','Nochebuena Express'];
const STN=['Polo Norte','Villa Abeto','Taller de Elfos','Pino Alto','Monte Reno','Valle Nevado','Plaza Mayor','Calle Turrón','Cueva de Hielo','Granja Cascabel','Puente Viejo','Mirador'];
const PRODUCTS=[['Tren navideño para poner alrededor del árbol','tren navidad arbol'],['Tren de vapor navideño con luces y sonido','tren navidad luces sonido'],['Tren eléctrico de juguete con vías','tren electrico juguete vias'],['Pueblo navideño con tren en movimiento','pueblo navideño tren'],['Tren de Navidad a pilas para niños','tren navidad pilas niños'],['Tren navideño de madera','tren navidad madera'],['Tren de Navidad que echa humo','tren navidad humo'],['Tren navideño con mando a distancia','tren navidad mando distancia']];
const THEMES=[
  {wall:'#16301f',fire:0xff7a2e,mat:[0.95,0.97,1],fog:'#120d0d'},
  {wall:'#3a1219',fire:0xff8a3a,mat:[0.97,0.96,0.99],fog:'#130b0c'},
  {wall:'#14223d',fire:0xff7030,mat:[0.94,0.97,1],fog:'#0b0d14'},
  {wall:'#2c1f12',fire:0xff9440,mat:[0.98,0.96,0.94],fog:'#130e09'}];
const DAYS=Array.from({length:24},(_,i)=>({d:i+1,name:NAMES[i],laps:1,th:THEMES[i%4],prod:PRODUCTS[i%8]}));
const DAY1=[[180,300],[500,190],[820,300],[870,600],[770,900],[580,870],[470,1020],[220,970],[130,640]].map(([x,y])=>[(x-500)*0.32,(y-600)*0.32]);
const ORDER=[7,19,1,12,24,3,15,9,22,5,17,11,2,20,8,14,23,6,10,18,4,21,13,16];
const SPAN={24:'w h',1:'w',6:'h',13:'w',18:'h',9:'w',20:'h',3:'w',15:'w',11:'h'};
const TAIL=16,STEP=0.5,VMAX=30,ACC=6.4,BRAKE=9,HARD=13,ALAT=6.6,PEN_GIFT=2,SLIP_V=0.75,SLIP_T=0.7,BELL_BONUS=0.5;
const bellBonus=c=>BELL_BONUS*Math.min(2,1+0.25*(c-1));
const STFR=[0.2,0.52,0.8];
let OFFS=[0,-8.6,-16.2,-23.8],GAUGE=1.24;const RAILY=0.72;

function trackPts(d,r){
  if(d===1)return DAY1;
  const n=8+Math.floor(r()*5),R=82+r()*30,sx=0.9+r()*0.35,rot=r()*Math.PI*2;
  let rad=Array.from({length:n},()=>R*(0.6+0.55*r()));
  rad=rad.map((v,i)=>0.55*v+0.225*(rad[(i+n-1)%n]+rad[(i+1)%n]));
  return rad.map((v,i)=>{const th=(i+(r()-.5)*0.45)/n*Math.PI*2+rot;return [Math.cos(th)*v*sx,Math.sin(th)*v]});
}
function previewPath(d){const pts=trackPts(d,rng(d*7919+11)),c=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal'),sp=c.getSpacedPoints(90);
  let a=1e9,b=-1e9,e=1e9,f=-1e9;sp.forEach(p=>{a=Math.min(a,p.x);b=Math.max(b,p.x);e=Math.min(e,p.z);f=Math.max(f,p.z)});const s=88/Math.max(b-a,f-e);
  return sp.map((p,i)=>(i?'L':'M')+(60+(p.x-(a+b)/2)*s).toFixed(1)+' '+(50+(p.z-(e+f)/2)*s).toFixed(1)).join('')+'Z'}

/* ================= portada: lámina ilustrada ================= */
function drawArt(){const r=rng(77);let s=`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a1e"/><stop offset=".45" stop-color="#14275a"/><stop offset=".7" stop-color="#2a3f78"/></linearGradient><radialGradient id="moon"><stop offset="0" stop-color="#fffbe9"/><stop offset=".25" stop-color="#fff3c8"/><stop offset=".3" stop-color="rgba(255,240,200,.35)"/><stop offset="1" stop-color="rgba(255,240,200,0)"/></radialGradient><linearGradient id="aur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3dffb0" stop-opacity="0"/><stop offset=".4" stop-color="#3dffb0" stop-opacity=".22"/><stop offset=".7" stop-color="#b56bff" stop-opacity=".16"/><stop offset="1" stop-color="#b56bff" stop-opacity="0"/></linearGradient></defs>`;
  s+=`<rect width="1200" height="1400" fill="url(#sky)"/><path d="M-50 260 C200 120 420 300 640 170 S1000 120 1260 230 L1260 330 C1000 230 820 290 640 280 S220 240 -50 360Z" fill="url(#aur)"/>`;
  for(let i=0;i<220;i++)s+=`<circle cx="${(r()*1200).toFixed(0)}" cy="${(r()*760).toFixed(0)}" r="${(r()*1.6+.3).toFixed(1)}" fill="#fff" opacity="${(r()*.7+.3).toFixed(2)}"/>`;
  s+=`<circle cx="960" cy="200" r="190" fill="url(#moon)"/><circle cx="960" cy="200" r="48" fill="#fff8e1"/>`;
  const hill=(y,amp,col,seed)=>{const q=rng(seed);let p=`M0 1400 L0 ${y}`;for(let x=0;x<=1200;x+=60)p+=` L${x} ${(y-amp*(0.5+0.5*Math.sin(x/170+seed))-q()*amp*0.4).toFixed(0)}`;return `<path d="${p} L1200 1400Z" fill="${col}"/>`};
  s+=hill(820,120,'#24386c',3)+hill(900,80,'#2c457f',8);
  const pines=(y0,n,sc,col,seed)=>{const q=rng(seed);let o='';for(let i=0;i<n;i++){const x=q()*1200,h=(40+q()*50)*sc,y=y0+q()*30;o+=`<path d="M${x} ${y-h} L${x-h*.32} ${y} L${x+h*.32} ${y}Z" fill="${col}"/><path d="M${x} ${y-h} L${x-h*.12} ${y-h*.62} L${x+h*.12} ${y-h*.62}Z" fill="#dfe8f7" opacity=".7"/>`}return o};
  s+=pines(900,40,1,'#152a55',4);
  s+=`<g opacity=".95"><path d="M0 1000 L1200 960 L1200 985 L0 1025Z" fill="#3a2a4a"/>`;for(let i=0;i<9;i++){const x=40+i*140;s+=`<path d="M${x} ${1022-i*4.6} L${x+110} ${1022-i*4.6-3.6} L${x+110} 1400 L${x+92} 1400 Q${x+55} ${1060-i*4.6} ${x+18} 1400 L${x} 1400Z" fill="#2d2040"/>`}s+=`</g>`;
  s+=`<g transform="translate(380 965) rotate(-1.9)"><rect x="0" y="-26" width="70" height="24" rx="3" fill="#8e1220"/><rect x="74" y="-26" width="70" height="24" rx="3" fill="#1b5a40"/><rect x="148" y="-26" width="70" height="24" rx="3" fill="#8e1220"/>`;
  for(let k=0;k<3;k++)for(let w=0;w<3;w++)s+=`<rect x="${8+k*74+w*20}" y="-20" width="12" height="9" fill="#ffd57a"/>`;
  s+=`<rect x="222" y="-30" width="58" height="28" rx="6" fill="#c41e2e"/><rect x="226" y="-50" width="26" height="24" fill="#8e1220"/><rect x="262" y="-46" width="9" height="18" fill="#222"/><circle cx="283" cy="-16" r="5" fill="#fff3b0"/>`;
  for(let k=0;k<5;k++)s+=`<circle cx="${266-k*26}" cy="${-62-k*14}" r="${10+k*5}" fill="#e9eef8" opacity="${.55-k*.09}"/>`;
  s+=`</g>`;
  const q=rng(12);for(let i=0;i<14;i++){const x=i*88+q()*30-10,w=60+q()*30,h=50+q()*40,y=1150+q()*30;const c=['#3a1f2a','#24304f','#2f2438','#1f3a35'][i%4];
    s+=`<rect x="${x}" y="${y-h}" width="${w}" height="${h+300}" fill="${c}"/><path d="M${x-8} ${y-h} L${x+w/2} ${y-h-w*.45} L${x+w+8} ${y-h}Z" fill="#e8eef8"/>`;
    for(let k=0;k<2;k++)s+=`<rect x="${x+10+k*(w-34)}" y="${y-h+16}" width="14" height="16" fill="#ffcf6a" opacity="${q()>.2?1:.25}"/>`}
  s+=hill(1260,40,'#e6edf8',21)+hill(1320,30,'#f4f7fd',33);
  $('art').innerHTML=s}

/* ================= motor ================= */
const coarse=matchMedia('(pointer:coarse)').matches;
const QS=new URLSearchParams(location.search),DEBUG=QS.has('debug');
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false});
const MAXPR=Math.min(devicePixelRatio||1,coarse?1.4:1.75);let dynPR=coarse?Math.min(1.0,MAXPR):Math.min(1.5,MAXPR);
renderer.setPixelRatio(dynPR);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#0b0809');
const camera=new THREE.PerspectiveCamera(60,1,0.1,4000);
{const es=new THREE.Scene();es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;void main(){vec3 c=mix(vec3(.16,.11,.09),vec3(.04,.04,.07),smoothstep(-.3,.6,vP.y));gl_FragColor=vec4(c,1.);}'})));
 [[-30,6,0,[9,4,1.4],7],[20,10,-20,[5,3.6,1.6],4],[0,30,0,[2.6,2,1.4],8],[18,4,26,[5,1,1.2],3],[-20,6,-25,[1,4,1.6],3],[30,12,14,[1.4,2,5],3],[10,25,-30,[1.4,2.2,3.6],6]].forEach(([x,y,z,c,r])=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(...c)}));m.position.set(x,y,z);es.add(m)});
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(es,0.03).texture;pm.dispose();scene.environmentIntensity=0.55}
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:coarse?0:4}));
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),0.75,0.55,0.86);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},t:{value:0},blur:{value:0},tilt:{value:0},focus:{value:.52},asp:{value:1},flash:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float t,blur,tilt,focus,asp,flash;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;
  if(tilt>0.001){float r=smoothstep(.16,.55,abs(vUv.y-focus))*tilt*.009;if(r>0.0004){vec3 a=c.rgb;for(int i=1;i<10;i++){float an=float(i)*2.39996;float rr=sqrt(float(i))/3.;a+=texture2D(tDiffuse,vUv+vec2(cos(an)/asp,sin(an))*rr*r).rgb;}c.rgb=a/10.;}}
  if(blur>0.0005){vec3 a=c.rgb;for(int i=1;i<6;i++)a+=texture2D(tDiffuse,vUv-d*blur*float(i)).rgb;c.rgb=a/6.;}
  float v=smoothstep(.95,.3,length(d*vec2(1.15,1.)));c.rgb*=mix(.5,1.,v);
  float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(c.rgb,c.rgb*vec3(.92,.96,1.12),smoothstep(.3,0.,l)*.5);c.rgb=mix(c.rgb,c.rgb*vec3(1.1,1.,.86),smoothstep(.4,1.5,l)*.5);
  c.rgb=mix(vec3(l),c.rgb,1.14);c.rgb+=flash*vec3(1.,.9,.7);c.rgb+=(h(vUv*977.+fract(t))-.5)*.012;gl_FragColor=c;}`});
composer.addPass(bloom);composer.addPass(grade);composer.addPass(new OutputPass());
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(dynPR);composer.setPixelRatio(dynPR);renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();grade.uniforms.asp.value=w/h}
addEventListener('resize',resize);resize();
const dbg=DEBUG?Object.assign(document.body.appendChild(document.createElement('div')),{id:'dbg'}):null;
if(dbg){renderer.info.autoReset=false;Object.assign(dbg.style,{position:'fixed',left:'50%',top:'calc(4px + env(safe-area-inset-top))',transform:'translateX(-50%)',zIndex:99,font:'700 11px/1.3 JetBrains Mono,monospace',color:'#fff',background:'rgba(0,0,0,.6)',padding:'3px 8px',pointerEvents:'none',whiteSpace:'nowrap'})}
let dbgN=0,dbgT=0;
function dbgFrame(raw){if(!dbg)return;dbgN++;dbgT+=raw;if(dbgT<0.5)return;const i=renderer.info.render;dbg.textContent=`${Math.round(dbgN/dbgT)} fps · ${(dbgT/dbgN*1000).toFixed(1)} ms · pr ${dynPR.toFixed(2)} · ${i.calls} dc · ${(i.triangles/1000).toFixed(0)}k tri · sombras ${renderer.shadowMap.enabled?'sí':'no'}`;dbgN=0;dbgT=0}

/* ================= texturas ================= */
const texCache={};
function canvasTex(w,h,draw,key,srgb=true){if(key&&texCache[key])return texCache[key];const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;if(key)texCache[key]=t;return t}
function pixTex(size,fn,key,srgb=true){return canvasTex(size,size,(g,w,h)=>{const id=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4,c=fn(x,y);id.data[o]=c[0];id.data[o+1]=c[1];id.data[o+2]=c[2];id.data[o+3]=c[3]===undefined?255:c[3]}g.putImageData(id,0,0)},key,srgb)}
const rep=(t,a,b)=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(a,b);return t};
const dotTex=canvasTex(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.4,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)},'dot');
const woodTex=rep(pixTex(128,(x,y)=>{const g=Math.sin(x*0.25+vnoise(x*0.05,y*0.4)*6)*0.5+0.5,v=70+g*40;return [v*1.2,v*.85,v*.6]},'wood'),1,1);
const plankTex=rep(pixTex(256,(x,y)=>{const row=Math.floor(y/22),e=y%22<2?0.55:1,g=0.85+0.15*Math.sin(x*0.08+row*3+vnoise(x*0.03,row)*5),k=(0.9+hash2(row,7)*0.15)*e*g*255;return [k,k*.97,k*.93]},'plank'),1,1);
const parquetTex=rep(pixTex(512,(x,y)=>{const row=Math.floor(y/32),off=(row%2)*90,col=Math.floor((x+off)/180),e=(y%32<2||((x+off)%180)<2)?0.45:1,tone=0.75+hash2(row,col)*0.35,g=0.88+0.12*Math.sin((x+off)*0.05+vnoise(x*0.02,y*0.3)*7);const k=tone*g*e;return [150*k,92*k,52*k]},'parquet'),26,26);
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
const chevTex=dir=>canvasTex(256,176,(g,w,h)=>{g.fillStyle='#d01828';g.fillRect(0,0,w,h);g.strokeStyle='#fff';g.lineWidth=10;g.strokeRect(5,5,w-10,h-10);g.fillStyle='#fff';
  for(let k=0;k<3;k++){const x=50+k*62;g.beginPath();if(dir>0){g.moveTo(x,30);g.lineTo(x+40,h/2);g.lineTo(x,h-30);g.lineTo(x+22,h-30);g.lineTo(x+62,h/2);g.lineTo(x+22,30)}else{g.moveTo(x+62,30);g.lineTo(x+22,h/2);g.lineTo(x+62,h-30);g.lineTo(x+40,h-30);g.lineTo(x,h/2);g.lineTo(x+40,30)}g.closePath();g.fill()}},'chev'+dir);
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
const snowN=rep(TL.load('m/snow_n.webp'),34,34),woodN=rep(TL.load('m/wood_n.webp'),26,26);
const blobTex=canvasTex(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(0,0,0,.75)');r.addColorStop(.55,'rgba(0,0,0,.35)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64)},'blob');
const puffTex=canvasTex(128,128,(g)=>{const q=rng(8);for(let i=0;i<26;i++){const x=64+(q()-.5)*60,y=64+(q()-.5)*60,rr=14+q()*26,r=g.createRadialGradient(x,y,0,x,y,rr);r.addColorStop(0,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128)}},'puff');
let envReady=null;
function loadEnv(){if(envReady)return envReady;envReady=(async()=>{try{const js=await (await fetch('m/env.json')).json(),bin=Uint8Array.from(atob(js.b),c=>c.charCodeAt(0)).buffer,d=new EXRLoader().parse(bin);
  const t=new THREE.DataTexture(d.data,d.width,d.height,d.format,d.type);t.colorSpace=THREE.LinearSRGBColorSpace;t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.flipY=false;t.mapping=THREE.EquirectangularReflectionMapping;t.needsUpdate=true;
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(t).texture;pm.dispose();t.dispose();scene.environmentIntensity=0.42;scene.environmentRotation.y=1.2}catch(e){console.warn('env',e)}})();return envReady}

/* luces */
const hemi=new THREE.HemisphereLight(0x8aa0d8,0x3a2418,0.42);scene.add(hemi);
const key=new THREE.DirectionalLight(0xbcd0ff,1.25);key.castShadow=true;
key.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048);
Object.assign(key.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:500});key.shadow.bias=-0.0006;key.shadow.normalBias=0.06;
scene.add(key,key.target);
const fireL=new THREE.PointLight(0xff7a2e,2.2,0,0);
const warmFill=new THREE.DirectionalLight(0xffa060,0.42);scene.add(warmFill,warmFill.target);

/* purpurina (nieve artificial) */
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
  rail:new THREE.MeshStandardMaterial({color:0xe9eef5,metalness:1,roughness:.14,side:THREE.DoubleSide}),
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
  zone:new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.6,.4),transparent:true,opacity:.5,depthWrite:false}),
  icicle:new THREE.MeshStandardMaterial({color:0xdff3ff,roughness:.05,metalness:.3,emissive:0x1b2b44}),
  branch:new THREE.MeshStandardMaterial({map:branchTex,alphaTest:.42,side:THREE.DoubleSide,roughness:.85,alphaToCoverage:true}),
  core:new THREE.MeshStandardMaterial({color:0x0e2b1c,roughness:1}),
  door:new THREE.MeshStandardMaterial({color:0x4a2a1a,map:plankTex,roughness:.8}),
  chevL:new THREE.MeshBasicMaterial({map:chevTex(-1),color:new THREE.Color(1.15,1.15,1.15),side:THREE.DoubleSide}),
  chevR:new THREE.MeshBasicMaterial({map:chevTex(1),color:new THREE.Color(1.15,1.15,1.15),side:THREE.DoubleSide}),
  cane:new THREE.MeshStandardMaterial({map:caneTex,roughness:.3}),
  bell:new THREE.MeshPhysicalMaterial({color:0xf3c04a,metalness:1,roughness:.16,clearcoat:1,emissive:0x3a2200}),
  felt:new THREE.MeshStandardMaterial({color:0xa3141f,roughness:1}),
  fur:new THREE.MeshStandardMaterial({color:0xf6f3ee,roughness:1,normalMap:snowNrm,normalScale:new THREE.Vector2(1,1)}),
};
const box=(w,h,d,m,x=0,y=0,z=0,par)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;if(par)par.add(o);return o};
const cyl=(rt,rb,h,m,seg=16)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),m);o.castShadow=true;return o};
const o3=new THREE.Object3D();

/* ================= modelos 3D (Kenney, CC0) ================= */
/* modelos empaquetados en m/models.json (Kenney Holiday Kit + Train Kit, CC0) */
const MD={};const toyCache=new Map();
function toyMat(m,phys){const key=(m.map?m.map.uuid:'c'+m.color.getHex())+(phys?'p':'');if(!toyCache.has(key)){if(m.map)m.map.anisotropy=4;const o={map:m.map||null,color:m.map?0xffffff:m.color,roughness:phys?.36:.5,metalness:0,side:THREE.FrontSide};toyCache.set(key,phys?new THREE.MeshPhysicalMaterial({...o,clearcoat:.7,clearcoatRoughness:.14}):new THREE.MeshStandardMaterial(o))}return toyCache.get(key)}
let modelsReady=null;
function loadModels(onp){if(modelsReady)return modelsReady;modelsReady=(async()=>{const res=await fetch('m/models.json');if(!res.ok)throw new Error('models '+res.status);const js=await res.json(),L=new GLTFLoader(),keys=Object.keys(js);let n=0;
  await Promise.all(keys.map(k=>new Promise((ok,ko)=>{const bin=Uint8Array.from(atob(js[k].b),c=>c.charCodeAt(0)).buffer;L.parse(bin,'m/'+js[k].p+'/',g=>{const sc=g.scene;sc.traverse(o=>{if(o.isMesh){o.material=toyMat(o.material,js[k].p==='train');o.castShadow=true;o.receiveShadow=true}});sc.updateMatrixWorld(true);MD[k]={scene:sc,box:new THREE.Box3().setFromObject(sc)};n++;onp&&onp(n/keys.length);ok()},ko)})))})();return modelsReady}
function flat(k){const D=MD[k];if(D.flat)return D.flat;const gs=[];let mat=null;D.scene.traverse(o=>{if(o.isMesh){let g=o.geometry.clone();for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);if(g.index)g=g.toNonIndexed();g.applyMatrix4(o.matrixWorld);gs.push(g);mat=mat||o.material}});
  const geo=mergeGeometries(gs,false),b=D.box;geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);return D.flat={geo,mat,h:b.max.y-b.min.y,w:Math.max(b.max.x-b.min.x,b.max.z-b.min.z)}}
function inst(k,list,shadow=true,par){if(!list.length)return null;const f=flat(k),m=new THREE.InstancedMesh(f.geo,f.mat,list.length);list.forEach((t,i)=>{o3.position.set(t.x,t.y||0,t.z);o3.rotation.set(0,t.r||0,0);o3.scale.setScalar(t.h/f.h);o3.updateMatrix();m.setMatrixAt(i,o3.matrix)});m.castShadow=shadow;m.receiveShadow=true;(par||world).add(m);return m}
function obj(k,h){const f=flat(k),m=new THREE.Mesh(f.geo,f.mat);m.scale.setScalar(h/f.h);m.castShadow=true;m.receiveShadow=true;return m}

/* ================= tren ================= */
const train=new THREE.Group();scene.add(train);
const cars=[];let ghost=null,spot=null,beam=null;
function carFrom(k,len){const D=MD[k],sc=D.scene.clone(true),b=D.box,s=len/(b.max.z-b.min.z);sc.scale.setScalar(s);sc.position.set(-(b.min.x+b.max.x)/2*s,-b.min.y*s+RAILY-0.05,-(b.min.z+b.max.z)/2*s);
  const inner=new THREE.Group();inner.add(sc);inner.rotation.y=Math.PI/2;const holder=new THREE.Group();holder.add(inner);const wheels=[];sc.traverse(o=>{if(/wheel/i.test(o.name||'')&&!(o.parent&&/wheel/i.test(o.parent.name||''))&&o.position.y>0.15)wheels.push(o)});
  holder.userData={wheels,len,top:(b.max.y-b.min.y)*s+RAILY,s,wr:0.3*s};return holder}
function buildTrain(){train.clear();cars.length=0;
  const L=carFrom('loco',7.6);cars.push(L);train.add(L);
  let wx=0.425;MD.loco.scene.traverse(o=>{if(o.name==='wheel')wx=Math.abs(o.position.x)});GAUGE=wx*L.userData.s;
  for(let i=1;i<4;i++){const W=carFrom('flat',6.6);const pk=['presA','presB','presD'][i-1],p=obj(pk,2.25);p.position.y=W.userData.top-0.25;p.rotation.y=i;p.visible=false;p.userData.s0=p.scale.x;W.add(p);W.userData.gift=p;cars.push(W);train.add(W)}
  OFFS=[0];for(let i=1;i<cars.length;i++)OFFS.push(OFFS[i-1]-(cars[i-1].userData.len/2+cars[i].userData.len/2+0.8));
  const top=L.userData.top,len=L.userData.len;
  const lampM=new THREE.Mesh(new THREE.SphereGeometry(0.34,14,10),M.lamp);lampM.position.set(len*0.5+0.05,top*0.58,0);L.add(lampM);
  spot=new THREE.SpotLight(0xffe2a8,240,95,0.45,0.55,1.25);
  {const cg=new THREE.ConeGeometry(4.2,24,24,1,true);cg.translate(0,-12,0);cg.rotateZ(Math.PI/2);beam=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({map:coneTex,color:new THREE.Color(.2,.16,.09),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false}));beam.position.set(len*0.5+0.2,top*0.58,0);L.add(beam)}spot.position.set(len*0.5,top*0.58,0);const tg=new THREE.Object3D();tg.position.set(30,0,0);L.add(spot,tg);spot.target=tg;
  L.userData.chimney=new THREE.Vector3(len*0.3,top+0.2,0);L.userData.fp=new THREE.Vector3(-len*0.02,top+0.45,0);
  // fantasma
  ghost=carFrom('loco',7.6);const gm=new THREE.MeshBasicMaterial({color:0x7fe6ff,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending});ghost.traverse(o=>{if(o.isMesh){o.material=gm;o.castShadow=false;o.receiveShadow=false}});ghost.visible=false;scene.add(ghost);
  flyer=obj('presA',2.6);flyer.visible=false;scene.add(flyer);
}

/* humo, chispas, fuegos, confeti */
const smoke=[];for(let i=0;i<48;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:puffTex,color:0xeef1f6,transparent:true,opacity:0,depthWrite:false}));s.visible=false;scene.add(s);smoke.push({s,life:0,v:new THREE.Vector3(),sz:1,op:.26})}
let smokeI=0;
function puff(p,v,sz,op,life){const q=smoke[smokeI=(smokeI+1)%smoke.length];q.life=1;q.ml=life||1.7;q.s.visible=true;q.s.position.copy(p);q.v.copy(v);q.sz=sz;q.op=op}
const SPK=100,spkP=new Float32Array(SPK*3),spk=Array.from({length:SPK},()=>({life:0,v:new THREE.Vector3()}));
const spkG=new THREE.BufferGeometry();spkG.setAttribute('position',new THREE.BufferAttribute(spkP,3));
const sparks=new THREE.Points(spkG,new THREE.PointsMaterial({map:dotTex,size:0.35,color:new THREE.Color(3,1.6,.5),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sparks.frustumCulled=false;scene.add(sparks);
let spkI=0;function spark(p,n,pow,col){for(let k=0;k<n;k++){const s=spk[spkI=(spkI+1)%SPK];s.life=0.4+Math.random()*0.4;s.v.set((Math.random()-.5)*pow,Math.random()*pow*0.8,(Math.random()-.5)*pow);spkP.set([p.x,p.y,p.z],spkI*3)}}
const FWN=1000,fwP=new Float32Array(FWN*3),fwC=new Float32Array(FWN*3),fw=Array.from({length:FWN},()=>({l:0,v:new THREE.Vector3()}));
const fwG=new THREE.BufferGeometry();fwG.setAttribute('position',new THREE.BufferAttribute(fwP,3));fwG.setAttribute('color',new THREE.BufferAttribute(fwC,3));
const fireworks=new THREE.Points(fwG,new THREE.PointsMaterial({map:dotTex,size:1.6,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));fireworks.frustumCulled=false;scene.add(fireworks);
for(let i=0;i<FWN;i++)fwP[i*3+1]=-999;let fwI=0,fwQ=[];
function burst(c,n=150,sp0=14,col){col=col||[[4,1,1.2],[4,3,.8],[1,2.4,4],[1.2,4,1.6],[4,1.4,3.4]][Math.floor(Math.random()*5)];
  for(let k=0;k<n;k++){const p=fw[fwI=(fwI+1)%FWN];p.l=1.2+Math.random()*0.6;const u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=Math.sqrt(1-u*u),sp=sp0*(0.8+Math.random()*0.3);p.v.set(r*Math.cos(a)*sp,u*sp,r*Math.sin(a)*sp);fwP.set([c.x,c.y,c.z],fwI*3);fwC.set(col,fwI*3)}}
const CFN=500,cfP=new Float32Array(CFN*3),cfC=new Float32Array(CFN*3),cf=Array.from({length:CFN},()=>({l:0,v:new THREE.Vector3(),ph:0}));
const cfG=new THREE.BufferGeometry();cfG.setAttribute('position',new THREE.BufferAttribute(cfP,3));cfG.setAttribute('color',new THREE.BufferAttribute(cfC,3));
const confetti=new THREE.Points(cfG,new THREE.PointsMaterial({size:0.55,vertexColors:true}));confetti.frustumCulled=false;scene.add(confetti);for(let i=0;i<CFN;i++)cfP[i*3+1]=-999;
function confettiBurst(c){const pal=[[1,.15,.2],[1,.8,.2],[.2,.8,.4],[.3,.6,1],[1,1,1]];for(let i=0;i<CFN;i++){const p=cf[i];p.l=3+Math.random()*2;p.ph=Math.random()*6;p.v.set((Math.random()-.5)*16,10+Math.random()*12,(Math.random()-.5)*16);cfP.set([c.x+(Math.random()-.5)*4,c.y,c.z+(Math.random()-.5)*4],i*3);cfC.set(pal[i%5],i*3)}}
let flyer=null,fly=null;

/* ================= salón (fijo) ================= */
const room=new THREE.Group();scene.add(room);
let fireU=null,garland=null,wallMat=null;
function buildRoom(){
  const floor=new THREE.Mesh(new THREE.CircleGeometry(1400,64).rotateX(-Math.PI/2),new THREE.MeshPhysicalMaterial({map:parquetTex,normalMap:woodN,normalScale:new THREE.Vector2(.35,.35),roughness:.42,clearcoat:.7,clearcoatRoughness:.22}));floor.position.y=-1.2;floor.receiveShadow=true;room.add(floor);
  wallMat=new THREE.MeshStandardMaterial({color:'#16301f',map:wallTex,roughness:.9,side:THREE.BackSide});
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(1100,1100,800,64,1,true),wallMat);wall.position.y=398;room.add(wall);
  const skirting=new THREE.Mesh(new THREE.CylinderGeometry(1098,1098,26,64,1,true),new THREE.MeshStandardMaterial({color:0xeee6d6,roughness:.6,side:THREE.BackSide}));skirting.position.y=12;room.add(skirting);
  // ventana
  const wa=-2.2,wx=Math.cos(wa)*1092,wz=Math.sin(wa)*1092,win=new THREE.Mesh(new THREE.PlaneGeometry(300,380),new THREE.MeshBasicMaterial({map:nightTex,color:new THREE.Color(1.3,1.3,1.4)}));win.position.set(wx,300,wz);win.lookAt(0,300,0);room.add(win);
  const sill=box(340,10,40,new THREE.MeshStandardMaterial({color:0xefe6d6}),wx*0.985,106,wz*0.985,room);sill.lookAt(0,106,0);
  // chimenea
  const fa=0.55,fx=Math.cos(fa)*1060,fz=Math.sin(fa)*1060,fp=new THREE.Group();fp.position.set(fx,0,fz);fp.lookAt(0,0,0);room.add(fp);
  const brick=new THREE.MeshStandardMaterial({color:0x7a2e22,map:rep(pixTex(128,(x,y)=>{const row=Math.floor(y/16),e=(y%16<2||((x+(row%2)*16)%32)<2)?0.45:1,k=(0.8+hash2(row,Math.floor((x+(row%2)*16)/32))*0.3)*e;return [190*k,90*k,70*k]},'brick'),3,3),roughness:.9});
  box(90,260,70,brick,-135,130,0,fp);box(90,260,70,brick,135,130,0,fp);box(360,70,70,brick,0,295,0,fp);box(400,16,90,new THREE.MeshPhysicalMaterial({color:0x3a2416,map:woodTex,roughness:.5,clearcoat:.6}),0,336,10,fp);
  box(180,8,60,new THREE.MeshStandardMaterial({color:0x111111}),0,2,-10,fp);
  const back=box(190,260,10,new THREE.MeshStandardMaterial({color:0x120807,roughness:1}),0,130,-30,fp);
  fireU={t:{value:0}};const fire=new THREE.Mesh(new THREE.PlaneGeometry(170,150),new THREE.ShaderMaterial({uniforms:fireU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float t;varying vec2 vU;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){vec2 p=vU;float q=n(vec2(p.x*6.,p.y*4.-t*2.2))*.6+n(vec2(p.x*13.,p.y*9.-t*3.7))*.4;float shape=smoothstep(.0,.25,p.x)*smoothstep(1.,.75,p.x);float f=clamp((1.-p.y*1.35)*shape*(q*1.6)-.15,0.,1.);
    vec3 c=mix(vec3(1.4,.25,.03),vec3(3.,1.7,.5),f);gl_FragColor=vec4(c*f*1.6,f);}`}));fire.position.set(0,75,-20);fp.add(fire);
  for(let i=0;i<5;i++){const lg=cyl(9,9,120,M.trunk,10);lg.rotation.z=Math.PI/2;lg.rotation.y=(i-2)*0.25;lg.position.set((i-2)*14,12+(i%2)*14,-10);fp.add(lg)}
  fireL.position.copy(fp.localToWorld(new THREE.Vector3(0,90,60)));
  [-120,0,120].forEach((x,i)=>{const s=obj(i%2?'sock2':'sock',60);s.position.set(x,270,40);s.rotation.y=Math.PI;fp.add(s)});
  const wr=obj('wreath',90);wr.position.set(0,470,-20);wr.rotation.x=-Math.PI/2;wr.rotation.z=0;fp.add(wr);
  warmFill.position.copy(fireL.position);warmFill.target.position.set(0,0,0);
  // guirnaldas de luces (bokeh)
  const gp=[],gc=[],pal=[[3,2,.9],[3,.6,.5],[.6,1.6,3],[1,3,1],[3,2.4,1.2]];
  for(let k=0;k<6;k++){const a0=k/6*Math.PI*2+0.3,a1=a0+Math.PI/3*0.9;for(let i=0;i<=40;i++){const u=i/40,a=lerp(a0,a1,u),y=470-Math.sin(u*Math.PI)*90;gp.push(Math.cos(a)*1080,y,Math.sin(a)*1080);gc.push(...pal[(i+k)%5])}}
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));gg.setAttribute('color',new THREE.Float32BufferAttribute(gc,3));
  garland=new THREE.Points(gg,new THREE.PointsMaterial({map:dotTex,size:18,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));room.add(garland);
}

/* ================= mundo por día ================= */
let world=null,T=null,ST=[],DAY=DAYS[0],treeParts=null,arches=[],eaveLights=[],mini=null,TG=null,TC=[0,0],BELLS=[],anims=[],MATR=200,MED=null;
function disposeWorld(){if(!world)return;scene.remove(world);const keep=new Set([...Object.values(M),...toyCache.values()]);world.traverse(o=>{if(o.isInstancedMesh){o.dispose()}if(o.geometry&&!Object.values(MD).some(d=>d.flat&&d.flat.geo===o.geometry))o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!keep.has(m)){if(m.map&&!Object.values(texCache).includes(m.map))m.map.dispose();m.dispose()}})}});world=null}
function buildTrack(pts){
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');
  const L=curve.getLength(),N=Math.round(L/STEP),sp=curve.getSpacedPoints(N),ds=L/N;
  const x=new Float32Array(N),z=new Float32Array(N),a=new Float32Array(N),vs0=new Float32Array(N),vs=new Float32Array(N);
  for(let i=0;i<N;i++){x[i]=sp[i].x;z[i]=sp[i].z}
  for(let i=0;i<N;i++){const p=(i-1+N)%N,q=(i+1)%N;a[i]=Math.atan2(z[q]-z[p],x[q]-x[p])}
  const w=Math.round(6/ds);for(let i=0;i<N;i++){const k=Math.abs(wrapA(a[(i+w)%N]-a[(i-w+N)%N]))/(2*w*ds);vs0[i]=Math.min(VMAX,Math.sqrt(ALAT/Math.max(k,1e-5)))}
  const m=Math.round(8/ds);for(let i=0;i<N;i++){let v=VMAX;for(let j=-m;j<=m;j+=2)v=Math.min(v,vs0[(i+j+N)%N]);vs[i]=v}
  // envolvente: velocidad máxima en cada punto para que morro y cola estén por debajo de vs y dé tiempo a frenar (soltando) antes de la siguiente curva
  const tl=Math.round(TAIL/ds),ve=new Float32Array(N);for(let i=0;i<N;i++)ve[i]=Math.min(vs[i],vs[(i-tl+N)%N]);
  for(let pass=0;pass<2;pass++)for(let i=N-1;i>=0;i--){const j=(i+1)%N;ve[i]=Math.min(ve[i],Math.sqrt(ve[j]*ve[j]+2*BRAKE*ds))}
  return {x,z,a,vs,ve,N,L,ds};
}
const at=s=>{s=((s%T.L)+T.L)%T.L;const f=s/T.ds,i=Math.floor(f)%T.N,j=(i+1)%T.N,t=f-Math.floor(f);return {x:lerp(T.x[i],T.x[j],t),z:lerp(T.z[i],T.z[j],t),a:T.a[i]+wrapA(T.a[j]-T.a[i])*t}};
const vsAt=s=>T.vs[Math.floor((((s%T.L)+T.L)%T.L)/T.ds)%T.N];
function buildGrid(){TG=new Map();for(let i=0;i<T.N;i+=4){const k=Math.floor(T.x[i]/16)*4096+Math.floor(T.z[i]/16);let l=TG.get(k);if(!l)TG.set(k,l=[]);l.push(i)}}
function dTrack(x,z){const cx=Math.floor(x/16),cz=Math.floor(z/16);let m=1e9;for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const l=TG.get((cx+a)*4096+(cz+b));if(l)for(const i of l){const dx=T.x[i]-x,dz=T.z[i]-z,d=dx*dx+dz*dz;if(d<m)m=d}}return m<1e9?Math.sqrt(m):48}
function matH(x,z,d){if(d===undefined)d=dTrack(x,z);const r=Math.hypot(x-TC[0],z-TC[1]);const bank=Math.exp(-Math.pow((d-GAUGE-3.6)/1.6,2))*0.9;return ((fbm(x*0.025+DAY.d,z*0.025)-0.3)*4.2+vnoise(x*0.12,z*0.12)*0.5)*sstep(6,26,d)*sstep(20,34,r)+bank*sstep(18,30,r)}
function extrude(prof,step,mat){
  const Mx=Math.ceil(T.N/step),P=prof.length,pos=new Float32Array((Mx+1)*P*3),uv=new Float32Array((Mx+1)*P*2),ind=[];
  for(let i=0;i<=Mx;i++){const k=i===Mx?0:i*step,c=Math.cos(T.a[k]),s=Math.sin(T.a[k]);
    for(let j=0;j<P;j++){const o=(i*P+j)*3;pos[o]=T.x[k]-s*prof[j][0];pos[o+1]=prof[j][1];pos[o+2]=T.z[k]+c*prof[j][0];uv[(i*P+j)*2]=prof[j][0]/3;uv[(i*P+j)*2+1]=i*step*T.ds/3}}
  for(let i=0;i<Mx;i++)for(let j=0;j<P-1;j++){const a=i*P+j,b=(i+1)*P+j;ind.push(a,b,b+1,a,b+1,a+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.receiveShadow=true;return m;
}
const markStatic=o=>o.traverse(c=>{if(c.isMesh&&!c.isInstancedMesh&&!Array.isArray(c.material))c.userData.st=true});
function batchStatic(root){root.updateMatrixWorld(true);const groups=new Map(),rm=[];
  root.traverse(o=>{if(!o.isMesh||!o.userData.st)return;let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);
    if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    g.clearGroups();g.applyMatrix4(o.matrixWorld);const key=o.material.uuid+(o.castShadow?'s':'');if(!groups.has(key))groups.set(key,{m:o.material,c:o.castShadow,gs:[]});groups.get(key).gs.push(g);rm.push(o)});
  rm.forEach(o=>{o.parent.remove(o)});
  groups.forEach(v=>{const mg=mergeGeometries(v.gs,false);v.gs.forEach(g=>g.dispose());if(!mg)return;const m=new THREE.Mesh(mg,v.m);m.castShadow=v.c;m.receiveShadow=true;root.add(m)})}
const eaveQ=[],iceQ=[];
function blobs(list){if(!list.length)return;const m=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.6,polygonOffset:true,polygonOffsetFactor:-2}),list.length);
  list.forEach(([x,z,r,y],i)=>{o3.position.set(x,(y||0)+0.15,z);o3.rotation.set(0,0,0);o3.scale.set(r*2,1,r*2);o3.updateMatrix();m.setMatrixAt(i,o3.matrix)});o3.scale.set(1,1,1);m.renderOrder=1;world.add(m)}
function house(r,col){
  const g=new THREE.Group(),w=6+r()*3,d=6+r()*2,h=3.4+r()*1.4;
  const bm=new THREE.MeshStandardMaterial({color:col,map:plankTex,roughness:.6});
  box(w,h,d,bm,0,h/2,0,g);box(w+0.1,0.5,d+0.1,M.conc,0,0.25,0,g);
  const sh=new THREE.Shape();sh.moveTo(-w/2-0.6,0);sh.lineTo(w/2+0.6,0);sh.lineTo(0,h*0.6);sh.closePath();
  const eg=new THREE.ExtrudeGeometry(sh,{depth:d+0.9,bevelEnabled:false});eg.translate(0,h-0.12,-(d+0.9)/2);const edge=new THREE.Mesh(eg,M.roofEdge);edge.castShadow=true;g.add(edge);
  const rg=new THREE.ExtrudeGeometry(sh,{depth:d+0.9,bevelEnabled:true,bevelThickness:.28,bevelSize:.24,bevelSegments:3,curveSegments:1});rg.translate(0,h+0.12,-(d+0.9)/2);
  const roof=new THREE.Mesh(rg,M.snow);roof.castShadow=roof.receiveShadow=true;g.add(roof);
  box(0.8,1.8,0.8,M.wood,w*0.22,h+1.1,d*0.15,g);box(1,0.25,1,M.snow,w*0.22,h+2.05,d*0.15,g);
  const wg=new THREE.PlaneGeometry(1.05,1.3);
  [[-w*0.28,h*0.55],[w*0.28,h*0.55]].forEach(([x,y])=>{const p=new THREE.Mesh(wg,M.win);p.position.set(x,y,d/2+0.02);g.add(p);box(1.3,0.12,0.3,M.snow,x,y-0.72,d/2+0.12,g)});
  [-d*0.2,d*0.2].forEach(z=>{const p=new THREE.Mesh(wg,M.win);p.position.set(w/2+0.02,h*0.55,z);p.rotation.y=Math.PI/2;g.add(p);const q=p.clone();q.position.x=-w/2-0.02;q.rotation.y=-Math.PI/2;g.add(q)});
  const door=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.1),M.door);door.position.set(0,1.05,d/2+0.02);g.add(door);
  const wr=new THREE.Mesh(new THREE.TorusGeometry(0.32,0.11,8,16),M.green);wr.position.set(0,1.5,d/2+0.08);g.add(wr);
  g.userData.eaves=[[-w/2-0.5,w/2+0.5,h+0.05,d/2+0.55],[-w/2-0.5,w/2+0.5,h+0.05,-d/2-0.55]];
  return g;
}
function queueEaves(g,r){g.updateWorldMatrix(true,true);const v=new THREE.Vector3();g.userData.eaves.forEach(([x0,x1,y,z])=>{for(let x=x0;x<=x1;x+=0.42){v.set(x,y,z);g.localToWorld(v);eaveQ.push(v.clone());if(r()<0.7){const u=v.clone();u.y-=0.05;iceQ.push([u,0.25+r()*0.55])}}})}
const branchGeo=(()=>{const g=new THREE.PlaneGeometry(1,0.78);g.rotateX(-Math.PI/2);g.translate(0.5,0,0);const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0);return g})();
const bellGeo=(()=>{const p=[[0,0],[1.45,0],[1.38,.22],[1.05,.8],[.86,1.7],[.8,2.25],[.55,2.6],[.2,2.75],[0,2.78]].map(([x,y])=>new THREE.Vector2(x,y));const g=new THREE.LatheGeometry(p,28);g.translate(0,-1.4,0);return g})();

async function buildWorld(day,prog){
  disposeWorld();DAY=day;world=new THREE.Group();scene.add(world);eaveQ.length=0;iceQ.length=0;anims=[];
  const r=rng(day.d*7919+11),th=day.th;
  T=buildTrack(trackPts(day.d,r));buildGrid();
  let cx=0,cz=0;for(let i=0;i<T.N;i+=10){cx+=T.x[i];cz+=T.z[i]}cx/=Math.ceil(T.N/10);cz/=Math.ceil(T.N/10);
  TC=day.d===1?[0,4]:[cx*0.3,cz*0.3];
  let md=1e9,mr=0;for(let i=0;i<T.N;i+=4){md=Math.min(md,Math.hypot(T.x[i]-TC[0],T.z[i]-TC[1]));mr=Math.max(mr,Math.hypot(T.x[i],T.z[i]))}MATR=mr+55;
  scene.fog=new THREE.FogExp2(th.fog,0.0009);if(wallMat)wallMat.color.set(th.wall);fireL.color.setHex(th.fire);
  prog(30,'Extendiendo la manta de nieve…');await tick();
  // manta de nieve
  {const rg=new THREE.RingGeometry(1,MATR,coarse?120:180,coarse?40:60);rg.rotateX(-Math.PI/2);const pa=rg.attributes.position,col=new Float32Array(pa.count*3);
   for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i),rr=Math.hypot(x,z);const edge=sstep(MATR-14,MATR,rr);const d=dTrack(x,z);const h=d<GAUGE+1.6?0:matH(x,z,d)-edge*1.5;pa.setY(i,h);const lo=sstep(-1.2,1.6,h),b=0.93+fbm(x*0.08,z*0.08)*0.07;col[i*3]=b*lerp(0.84,1,lo);col[i*3+1]=b*lerp(0.9,1,lo);col[i*3+2]=b}
   rg.setAttribute('color',new THREE.BufferAttribute(col,3));rg.computeVertexNormals();
   const gm=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,normalMap:snowN,normalScale:new THREE.Vector2(.9,.9)});
   gm.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
     sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec2 gc=floor(vWP.xz*11.);float r=fract(sin(dot(gc,vec2(12.9898,78.233)))*43758.5453);vec3 vd=normalize(cameraPosition-vWP);float tw=fract(r*91.7+dot(vd,vec3(4.1,6.7,3.3))*2.);float dd=length(cameraPosition-vWP);totalEmissiveRadiance+=vec3(2.2,2.3,2.6)*step(.992,r)*smoothstep(.75,1.,tw)*smoothstep(70.,5.,dd)*2.2;}')};
   const mat=new THREE.Mesh(rg,gm);mat.receiveShadow=true;world.add(mat);
   const tor=new THREE.Mesh(new THREE.TorusGeometry(MATR,4.2,10,160),new THREE.MeshStandardMaterial({color:0xf4f7ff,roughness:.7,normalMap:snowN,normalScale:new THREE.Vector2(1,1)}));tor.rotation.x=Math.PI/2;tor.position.y=-0.6;tor.scale.set(1,1,0.55);tor.receiveShadow=true;world.add(tor)}
  prog(40,'Colocando las vías…');await tick();
  world.add(extrude([[-GAUGE-1.4,0.02],[-GAUGE-0.9,0.3],[GAUGE+0.9,0.3],[GAUGE+1.4,0.02]],2,M.roadbed));
  const tube=(o,r,y)=>Array.from({length:9},(_,k)=>{const a=k/8*Math.PI*2;return [o+Math.cos(a)*r,y+Math.sin(a)*r]});
  [GAUGE,-GAUGE].forEach(o=>world.add(extrude(tube(o,0.15,0.6),1,M.rail)));world.add(extrude(tube(0,0.1,0.52),1,M.rail));
  {const nS=Math.floor(T.L/1.25),sl=new THREE.InstancedMesh(new THREE.BoxGeometry(0.42,0.16,GAUGE*2+1.3),M.sleeper,nS);
   for(let i=0;i<nS;i++){const p=at(i*1.25);o3.position.set(p.x,0.38,p.z);o3.rotation.set(0,-p.a,0);o3.scale.set(1,1,1);o3.updateMatrix();sl.setMatrixAt(i,o3.matrix)}sl.receiveShadow=true;world.add(sl)}
  prog(50,'Decorando el árbol gigante…');await tick();
  buildBigTree(TC[0],TC[1],Math.max(24,Math.min(44,md-12)),r);
  // estaciones
  ST=STFR.map((f,j)=>{
    const s=f*T.L,p=at(s);let nx=-Math.sin(p.a),nz=Math.cos(p.a);if(nx*(p.x-TC[0])+nz*(p.z-TC[1])<0){nx=-nx;nz=-nz}
    const name=STN[(day.d*3+j)%STN.length],g=new THREE.Group();
    box(26,1.0,5,M.conc,0,0.5,0,g);box(26,0.06,0.35,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.2,.3)}),0,1.03,-2.3,g);
    [-9,-3,3,9].forEach(x=>{const c=cyl(0.14,0.14,4.4,M.dark,10);c.position.set(x,3.2,1.6);g.add(c)});
    box(21,0.25,4.6,M.roofEdge,0,5.45,0.6,g);box(21.4,0.4,5,M.snow,0,5.75,0.6,g);
    const hb=house(r,0x7a3a26);hb.position.set(-3,1,7.2);hb.rotation.y=Math.PI;g.add(hb);
    [-6,6].forEach(x=>{const hd=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,8),M.lamp);hd.position.set(x,4.9,0.6);g.add(hd)});
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(6,1.5),new THREE.MeshBasicMaterial({map:signTex(name,'Estación '+(j+1)),side:THREE.DoubleSide}));sg.position.set(0,6.7,0.6);sg.rotation.y=Math.PI;g.add(sg);
    const bench=obj('bench',1.6);bench.position.set(5,1,1.4);bench.rotation.y=Math.PI;g.add(bench);
    [-12,12].forEach(x=>{const l=obj('lantern',6.5);l.position.set(x,1,-1.2);g.add(l)});
    const pile=new THREE.Group();[['presA',2.2,0,0],['presB',1.8,1.6,0.6],['presC',1.6,0.6,1.6],['presD',1.2,0.8,0.5,2.2]].forEach(([k,h,x,z,y])=>{const o=obj(k,h);o.position.set(x-8,1+(y||0),z+0.2);o.rotation.y=x;pile.add(o)});g.add(pile);
    const nut=obj('nut',5.2);nut.position.set(-4.5,1,-0.6);nut.rotation.y=Math.PI;g.add(nut);
    g.position.set(p.x+nx*5.2+0,0,p.z+nz*5.2);g.rotation.y=Math.atan2(nx,nz);world.add(g);queueEaves(hb,r);
    g.traverse(c=>{if(c.isMesh&&c!==nut&&!pile.children.includes(c))c.userData.st=true});
    anims.push({k:'nut',o:nut,base:nut.rotation.y,j});
    return {s,x:p.x,z:p.z,a:p.a,nx,nz,j,name,pile,nut,pileWorld:new THREE.Vector3(p.x+nx*5.2,2.5,p.z+nz*5.2)};
  });
  // meta
  {const p=at(0),g=new THREE.Group();[-4.6,4.6].forEach(z=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.36,8,16),M.cane);c.castShadow=true;c.position.set(0,4,z);g.add(c)});
   const mt=canvasTex(512,96,(c,w,h)=>{for(let i=0;i<32;i++)for(let k=0;k<4;k++){c.fillStyle=(i+k)%2?'#111':'#fff';c.fillRect(i*16,k*24,16,24)}c.fillStyle='#b81f30';c.fillRect(150,8,212,80);c.fillStyle='#fff';c.font='700 50px Georgia, serif';c.textAlign='center';c.textBaseline='middle';c.fillText('META',256,50)},'meta');
   const bm=new THREE.MeshBasicMaterial({map:mt,side:THREE.DoubleSide});const ban=new THREE.Mesh(new THREE.PlaneGeometry(9.6,1.7),bm);ban.position.y=7.4;ban.rotation.y=Math.PI/2;g.add(ban);
   g.position.set(p.x,0,p.z);g.rotation.y=-p.a;world.add(g);markStatic(g)}
  prog(60,'Encendiendo farolas…');await tick();
  // arcos de bastón de caramelo
  arches=[];
  [0.1,0.38,0.66,0.92].forEach((f,k)=>{const p=at(f*T.L),g=new THREE.Group();
    const arc=new THREE.Mesh(new THREE.TorusGeometry(4.6,0.22,10,48,Math.PI),M.cane);arc.castShadow=true;g.add(arc);arc.userData.st=true;
    const n=26,bm=[0,1].map(q=>new THREE.InstancedMesh(new THREE.SphereGeometry(0.17,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),n/2)),pal=[[3,.5,.6],[3,2.2,.5],[.6,1.6,3],[.8,3,1]];
    for(let i=0;i<n;i++){const t=(i+0.5)/n*Math.PI;o3.position.set(Math.cos(t)*4.6,Math.sin(t)*4.6-0.3,0);o3.rotation.set(0,0,0);o3.scale.set(1,1,1);o3.updateMatrix();bm[i%2].setMatrixAt(i>>1,o3.matrix);bm[i%2].setColorAt(i>>1,new THREE.Color(...pal[(i+k)%4]))}
    bm.forEach(b=>{b.instanceColor.needsUpdate=true;g.add(b)});
    g.position.set(p.x,0.3,p.z);g.rotation.y=-(p.a+Math.PI/2);world.add(g);arches.push(bm)});
  // farolas (faroles Kenney)
  {const pos=[];for(let s=10;s<T.L;s+=28){if(ST.some(o=>Math.abs(o.s-s)<22)||Math.abs(s-T.L)<20)continue;const p=at(s),side=(Math.round(s/28)%2?1:-1);pos.push({x:p.x-Math.sin(p.a)*(GAUGE+3)*side,z:p.z+Math.cos(p.a)*(GAUGE+3)*side,h:6.2,r:p.a})}
   inst('lantern',pos);const f=flat('lantern'),hy=6.2*0.78;
   const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(0.42,12,8),M.lamp,pos.length),pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(10,10).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:dotTex,color:new THREE.Color(.6,.42,.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),pos.length);
   pos.forEach((q,i)=>{o3.rotation.set(0,0,0);o3.scale.set(1,1,1);o3.position.set(q.x,hy,q.z);o3.updateMatrix();heads.setMatrixAt(i,o3.matrix);o3.position.set(q.x,0.5,q.z);o3.updateMatrix();pools.setMatrixAt(i,o3.matrix)});
   pools.frustumCulled=false;world.add(heads,pools)}
  // señales de curva
  {let inC=false;for(let i=0;i<T.N;i+=4){const c=T.vs[i]<15.5;if(c&&!inC){const s0=i*T.ds-14;
     for(let k=0;k<3;k++){const s=s0+k*9,p=at(s),a=at(s-15),b=at(s+15),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;let ox=p.x-mx,oz=p.z-mz;const ol=Math.hypot(ox,oz)||1;ox/=ol;oz/=ol;
       const tx=Math.cos(p.a),tz=Math.sin(p.a),right=(mx-p.x)*(-tz)+(mz-p.z)*tx,sg=new THREE.Group(),bd=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.17),right>0?M.chevR:M.chevL);bd.position.y=2.3;sg.add(bd);
       const pp=cyl(0.07,0.07,1.8,M.dark,6);pp.position.y=0.9;sg.add(pp);sg.position.set(p.x+ox*(GAUGE+3.4),0,p.z+oz*(GAUGE+3.4));sg.rotation.y=Math.atan2(-tx,-tz);world.add(sg);markStatic(sg)}}inC=c}}
  prog(70,'Montando el pueblo…');await tick();
  const taken=[...ST.map(o=>[o.x+o.nx*12,o.z+o.nz*12,16]),[TC[0],TC[1],treeR+4]];
  const free=(x,z,rad)=>taken.every(([a,b,q])=>Math.hypot(a-x,b-z)>q+rad);
  const inMat=(x,z,m)=>Math.hypot(x,z)<MATR-m;
  const HC=[0xb4473a,0x4a6f9e,0xc89a54,0x7d4f72,0x4f7d62,0xd8cbb4];
  const hBlobs=[];let hn=0;for(let t=0;t<900&&hn<12;t++){const x=(r()-.5)*2*MATR,z=(r()-.5)*2*MATR,d=dTrack(x,z);if(d>12&&inMat(x,z,10)&&free(x,z,8)){
    const h=house(r,HC[Math.floor(r()*HC.length)]);let best=1e9,bi=0;for(let k=0;k<T.N;k+=8){const q=(T.x[k]-x)**2+(T.z[k]-z)**2;if(q<best){best=q;bi=k}}
    h.position.set(x,matH(x,z,d),z);h.rotation.y=Math.atan2(T.x[bi]-x,T.z[bi]-z);world.add(h);queueEaves(h,r);markStatic(h);taken.push([x,z,8]);hBlobs.push([x,z,6.5,matH(x,z,d)]);hn++}}
  // decorado Kenney
  const scatter=(n,minD,rad,fn)=>{const out=[];for(let t=0;t<n*25&&out.length<n;t++){const x=(r()-.5)*2*MATR,z=(r()-.5)*2*MATR,d=dTrack(x,z);if(d>minD&&inMat(x,z,rad+4)&&free(x,z,rad)){const o=fn(x,z,d);out.push(o);taken.push([x,z,rad])}}return out};
  const trees={treeA:[],treeB:[],treeC:[],treeD:[]};scatter(coarse?110:170,7,2.6,(x,z,d)=>{const k=['treeA','treeB','treeC','treeA','treeB','treeD'][Math.floor(r()*6)];const o={x,z,y:matH(x,z,d)-0.2,h:7+r()*9,r:r()*6};trees[k].push(o);return o});
  Object.entries(trees).forEach(([k,l])=>inst(k,l,true));blobs([...Object.values(trees).flat().map(o=>[o.x,o.z,o.h*0.3,o.y]),...hBlobs]);
  const piles=scatter(24,6,2,(x,z,d)=>({x,z,y:matH(x,z,d)-0.3,h:1.2+r()*1.4,r:r()*6}));inst('pile',piles,false);
  const rocks=scatter(10,7,2,(x,z,d)=>({x,z,y:matH(x,z,d)-0.2,h:1.6+r()*1.6,r:r()*6}));inst('rocks',rocks,true);
  const canes=[];for(let s=30;s<T.L;s+=60){const p=at(s),side=(Math.round(s/60)%2?1:-1),x=p.x+Math.sin(p.a)*(GAUGE+2.6)*side,z=p.z-Math.cos(p.a)*(GAUGE+2.6)*side;if(free(x,z,1))canes.push({x,z,h:3.4,r:p.a+(side>0?0:Math.PI)})}inst(r()<.5?'caneR':'caneG',canes,true);
  scatter(4,7,3,(x,z,d)=>{const g=new THREE.Group();const n=2+Math.floor(r()*3);for(let i=0;i<n;i++){const d1=obj('deer',3.8+r()*0.8);d1.position.set((r()-.5)*7,0,(r()-.5)*7);d1.rotation.y=r()*6;g.add(d1);anims.push({k:'deer',o:d1,base:d1.rotation.y,ph:r()*6})}g.position.set(x,matH(x,z,d),z);world.add(g);return {}});
  scatter(5,6,2,(x,z,d)=>{const s=obj('snowman',4.2);s.position.set(x,matH(x,z,d),z);s.rotation.y=r()*6;world.add(s);anims.push({k:'snowman',o:s,ph:r()*6});return {}});
  scatter(6,3.8,1.4,(x,z,d)=>{const s=obj(r()<.5?'ginger':'ginger2',2.4);s.position.set(x,matH(x,z,d),z);s.rotation.y=r()*6;world.add(s);anims.push({k:'ginger',o:s,y:s.position.y,ph:r()*6});return {}});
  scatter(3,6,3,(x,z,d)=>{const s=obj('sled',1.8);s.position.set(x,matH(x,z,d),z);s.rotation.y=r()*6;world.add(s);s.userData.st=true;return {}});
  for(let i=0;i<10;i++){const a=r()*Math.PI*2,rr=r()*MATR*0.9,f=obj(r()<.5?'flakeA':'flakeB',5+r()*4);f.position.set(Math.cos(a)*rr,30+r()*40,Math.sin(a)*rr);f.castShadow=false;world.add(f);anims.push({k:'flake',o:f,y:f.position.y,ph:r()*6})}
  // regalos gigantes alrededor de la manta
  {const k=7+Math.floor(r()*3);for(let i=0;i<k;i++){const a=i/k*Math.PI*2+r()*0.4,sz=36+r()*46,rr=MATR+sz*0.6+10+r()*40,x=Math.cos(a)*rr,z=Math.sin(a)*rr,h=sz*(0.6+r()*0.6);giantPresent(x,z,sz,h,r()*0.8,WRAPS[Math.floor(r()*WRAPS.length)])}
   const gb=obj('ginger',38);const a1=r()*6;gb.position.set(Math.cos(a1)*(MATR+30),-1.2,Math.sin(a1)*(MATR+30));gb.rotation.set(-0.35,a1+Math.PI,0);world.add(gb);
   const nc=obj('nut',58);const a2=a1+2.2;nc.position.set(Math.cos(a2)*(MATR+44),-1.2,Math.sin(a2)*(MATR+44));nc.lookAt(0,-1.2,0);world.add(nc);
   [a1+1,a1+3.8].forEach((aa,i)=>{const c=obj(i?'caneG':'caneR',70);c.position.set(Math.cos(aa)*(MATR+26),-1.2,Math.sin(aa)*(MATR+26));c.rotation.set(0.25,aa,0);world.add(c)})}
  // carámbanos y luces de alero
  {const ig=new THREE.ConeGeometry(0.06,1,5);ig.rotateX(Math.PI);ig.translate(0,-0.5,0);const im=new THREE.InstancedMesh(ig,M.icicle,Math.max(1,iceQ.length));
   iceQ.forEach(([v,l],i)=>{o3.position.copy(v);o3.rotation.set(0,0,0);o3.scale.set(1,l,1);o3.updateMatrix();im.setMatrixAt(i,o3.matrix)});o3.scale.set(1,1,1);world.add(im);
   const pal=[[3,.4,.5],[3,2.3,.5],[.5,1.4,3],[.7,3,.9]];eaveLights=[0,1].map(q=>{const idx=eaveQ.filter((_,i)=>i%2===q),m=new THREE.InstancedMesh(new THREE.SphereGeometry(0.09,6,4),new THREE.MeshBasicMaterial({color:0xffffff}),Math.max(1,idx.length));
     idx.forEach((v,i)=>{o3.position.copy(v);o3.position.y+=0.08;o3.updateMatrix();m.setMatrixAt(i,o3.matrix);m.setColorAt(i,new THREE.Color(...pal[(i+q)%4]))});if(m.instanceColor)m.instanceColor.needsUpdate=true;world.add(m);return m})}
  // campanas
  BELLS=[];{const nb=Math.max(10,Math.round(T.L/52));for(let i=0;i<nb;i++){const s=(i+0.5)/nb*T.L;if(ST.some(o=>Math.abs(o.s-s)<12)||s<25||s>T.L-20)continue;let vm=VMAX;for(let q=-12;q<=12;q+=2)vm=Math.min(vm,vsAt(s+q));const kmh=Math.max(25,Math.floor(Math.min(19,vm*0.88)*3.6/5)*5);
    const p=at(s),g=new THREE.Group(),b=new THREE.Mesh(bellGeo,M.bell);b.castShadow=true;g.add(b);const cl=new THREE.Mesh(new THREE.SphereGeometry(0.38,12,8),M.gold);cl.position.y=-1.4;g.add(cl);
    const bow=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.16,8,16),M.red);bow.position.y=1.6;g.add(bow);const rg=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.12,8,40),new THREE.MeshBasicMaterial({color:new THREE.Color(.6,3,1),transparent:true,opacity:.8,depthWrite:false}));g.add(rg);
    g.position.set(p.x,7.2,p.z);g.rotation.y=-p.a+Math.PI/2;world.add(g);BELLS.push({s,v:kmh/3.6,kmh,g,rg,b,st:0,ph:r()*6})}}
  prog(84,'Juntando piezas…');await tick();
  batchStatic(world);
  buildMini();
  MED=medals();
}
let treeR=30;
function giantPresent(x,z,sz,h,rot,tex){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({map:tex,roughness:.4});
  const b=box(sz,h,sz,mat,0,h/2,0,g);const rb=new THREE.MeshStandardMaterial({color:0xe8c35a,metalness:.7,roughness:.25});
  box(sz+0.4,h+0.4,sz*0.12,rb,0,h/2,0,g);box(sz*0.12,h+0.4,sz+0.4,rb,0,h/2,0,g);
  [[0,0.7],[Math.PI,0.7],[Math.PI/2,0.5],[-Math.PI/2,0.5]].forEach(([a,s])=>{const t=new THREE.Mesh(new THREE.TorusGeometry(sz*0.13*s+sz*0.04,sz*0.035,10,24),rb);t.position.y=h+sz*0.1;t.rotation.set(Math.PI/2*0.4,a,0);t.position.x=Math.cos(a)*sz*0.1;t.position.z=Math.sin(a)*sz*0.1;g.add(t)});
  g.position.set(x,-1.2,z);g.rotation.y=rot;world.add(g);markStatic(g)}
function buildBigTree(x,z,R,r){
  treeR=R;const g=new THREE.Group(),H=R*2.5;
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
  const NB=coarse?180:280,phases=[0,1,2].map(()=>new THREE.InstancedMesh(new THREE.SphereGeometry(0.55,10,8),new THREE.MeshBasicMaterial({color:0xffffff}),Math.ceil(NB/3)));
  const pal=[[3,.4,.5],[3,2.3,.5],[.5,1.4,3],[.7,3,.9],[3,.9,2.4]],o=new THREE.Object3D();
  for(let i=0;i<NB;i++){const t=i/NB,y=y0+2+t*(H-y0-4),ang=t*Math.PI*2*10,rr=radAt(y);o.position.set(Math.cos(ang)*rr,y-1,Math.sin(ang)*rr);o.scale.set(0.8,1.3,0.8);o.updateMatrix();const m=phases[i%3];m.setMatrixAt(Math.floor(i/3),o.matrix);m.setColorAt(Math.floor(i/3),new THREE.Color(...pal[i%5]))}
  phases.forEach(m=>{m.instanceColor.needsUpdate=true;g.add(m)});
  const orn=new THREE.InstancedMesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshPhysicalMaterial({roughness:.06,metalness:.85,clearcoat:1,iridescence:.4}),tips.length),oc=[0xd0202f,0xf0b93c,0xdfe6f2,0x2a6fd6,0x1f8a52];o.scale.set(1,1,1);
  tips.forEach((tp,i)=>{if(tp[1]<9)tp[1]=9;const sc=1.6+hash2(i,7)*1.4;o.position.set(...tp);o.scale.setScalar(sc);o.updateMatrix();orn.setMatrixAt(i,o.matrix);orn.setColorAt(i,new THREE.Color(oc[i%5]))});orn.instanceColor.needsUpdate=true;orn.castShadow=true;g.add(orn);
  const sh=new THREE.Shape();for(let i=0;i<10;i++){const rr=i%2?2.2:5.2,a=Math.PI/2+i*Math.PI/5;i?sh.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):sh.moveTo(Math.cos(a)*rr,Math.sin(a)*rr)}
  const stg=new THREE.ExtrudeGeometry(sh,{depth:1.4,bevelEnabled:true,bevelSize:.3,bevelThickness:.3,bevelSegments:2});stg.translate(0,0,-0.7);
  const star=new THREE.Mesh(stg,new THREE.MeshBasicMaterial({color:new THREE.Color(4,3,1)}));star.position.y=H+16;g.add(star);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(R*5,R*5).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:dotTex,color:new THREE.Color(1.1,.62,.28),transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.y=0.6;g.add(glow);
  g.position.set(x,0,z);world.add(g);treeParts={phases,star,glow};
}
function buildMini(){
  let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(let i=0;i<T.N;i++){mnx=Math.min(mnx,T.x[i]);mxx=Math.max(mxx,T.x[i]);mnz=Math.min(mnz,T.z[i]);mxz=Math.max(mxz,T.z[i])}
  const sc=96/Math.max(mxx-mnx,mxz-mnz),ox=60-(mnx+mxx)/2*sc,oz=60-(mnz+mxz)/2*sc,P=(x,z)=>[(ox+x*sc).toFixed(1),(oz+z*sc).toFixed(1)];
  let d='';for(let i=0;i<T.N;i+=8){const [a,b]=P(T.x[i],T.z[i]);d+=(i?'L':'M')+a+' '+b}d+='Z';
  $('miniSvg').innerHTML=`<path d="${d}" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="3" stroke-linejoin="round"/>`+BELLS.map((b,i)=>{const p=at(b.s),[x,y]=P(p.x,p.z);return `<circle id="mb${i}" cx="${x}" cy="${y}" r="2.6" fill="#6fe39a"/>`}).join('')+ST.map(o=>{const [a,b]=P(o.x,o.z);return `<circle id="mst${o.j}" cx="${a}" cy="${b}" r="5" fill="#e0ad45" stroke="#2b1a12" stroke-width="1.5"/>`}).join('')+`<circle id="mgh" r="4.5" fill="#7fe6ff" opacity=".8"/><circle id="mtr" r="6" fill="#c41e2e" stroke="#fff" stroke-width="2"/>`;
  mini={P,tr:$('mtr'),gh:$('mgh')};
}
/* simulación de un maquinista perfecto para fijar medallas */
function vsAhead(dist){return T.ve[Math.floor((((dist%T.L)+T.L)%T.L)/T.ds)%T.N]}
function medals(){let v=9,dist=0,t=0,bonus=0,combo=0,bi=0;const dt=1/60;// sale con «salida perfecta» y va justo a la velocidad de la envolvente
  for(let k=0;k<60000&&dist<T.L;k++){const thr=v<vsAhead(dist);
    if(thr)v+=ACC*(1-0.5*v/VMAX)*dt;else v-=BRAKE*dt;v=Math.max(0,Math.min(VMAX,v-0.25*dt));dist+=v*dt;t+=dt;
    while(bi<BELLS.length&&dist>=BELLS[bi].s){if(v>=BELLS[bi].v){combo++;bonus+=bellBonus(combo)}else combo=0;bi++}}
  const ideal=t-bonus;const r1=x=>Math.round(x*10)/10;
  return {ideal,g:r1(ideal*1.08),s:r1(ideal*1.22),b:r1(ideal*1.4)}}

/* ================= sonido ================= */
let ac=null,sfx=store.get('advx-sfx')!=='0',music=store.get('advx-music')!=='0';
function au(){if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume().catch(()=>{});return ac}
function tone(f,d,type,g,when){if(!sfx||!ac)return;const t=ac.currentTime+(when||0),o=ac.createOscillator(),v=ac.createGain();o.type=type||'sine';o.frequency.value=f;v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(g,t+0.012);v.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(v);v.connect(ac.destination);o.start(t);o.stop(t+d+0.05)}
let nbuf=null;function nb(){if(!nbuf){const n=ac.sampleRate;nbuf=ac.createBuffer(1,n,n);const a=nbuf.getChannelData(0);for(let i=0;i<n;i++)a[i]=Math.random()*2-1}return nbuf}
function noise(d,g,fc,type){if(!sfx||!ac)return;nb();const t=ac.currentTime,s=ac.createBufferSource(),f=ac.createBiquadFilter(),v=ac.createGain();s.buffer=nbuf;f.type=type||'lowpass';f.frequency.value=fc;v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(0.0001,t+d);s.connect(f);f.connect(v);v.connect(ac.destination);s.start(t,Math.random()*0.5,d+0.05)}
const bells=()=>[1319,1568,2093,2637].forEach((f,i)=>tone(f,0.8,'sine',0.08,i*0.08));
const ding=()=>{tone(2093,0.9,'sine',0.09);tone(3136,0.6,'sine',0.04,0.02);tone(1046,1.2,'triangle',0.03)};
const dull=()=>{tone(220,0.25,'triangle',0.06);noise(0.12,0.05,600)};
const perfectS=()=>[1568,2093,2637,3136].forEach((f,i)=>tone(f,0.5,'triangle',0.06,i*0.06));
const whistle=()=>{tone(740,1.1,'triangle',0.07);tone(932,1.1,'triangle',0.05);tone(1109,1.1,'triangle',0.03)};
const beep=hi=>tone(hi?1046:523,hi?0.6:0.22,'square',0.06);
const creak=()=>{noise(0.5,0.08,900,'bandpass');tone(180,0.35,'sawtooth',0.02)};
const hiss=()=>noise(0.45,0.07,3500,'highpass');
let wind=null;
function windOn(){if(!ac||wind)return;const s=ac.createBufferSource();s.buffer=nb();s.loop=true;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=600;const g=ac.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(ac.destination);s.start();wind={s,f,g}}
function windSet(v){if(!wind)return;const x=sfx&&mode==='race'?Math.pow(v/VMAX,2)*0.11:0;wind.g.gain.setTargetAtTime(x,ac.currentTime,0.15);wind.f.frequency.setTargetAtTime(400+v*45,ac.currentTime,0.2)}
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
  const target=music?(mode==='race'||mode==='count'?0.42:0.95):0;mus.out.gain.setTargetAtTime(target,ac.currentTime,0.4);
  if(!music){mus.start=ac.currentTime+0.5;mus.i=0;return}
  if(mus.start<ac.currentTime-0.5&&mus.i===0)mus.start=ac.currentTime+0.1;
  const hor=ac.currentTime+0.3;
  while(mus.i<mus.ev.length&&mus.start+mus.ev[mus.i].t<hor){const e=mus.ev[mus.i++],t=Math.max(ac.currentTime,mus.start+e.t);if(e.k==='l')vLead(t,e.n,e.d);else if(e.k==='c')vChord(t,e);else vSleigh(t,e.a,e.v)}
  if(mus.i>=mus.ev.length){mus.start+=mus.L+1.2;mus.song=(mus.song+1)%SONGS.length;loadSong()}}
setInterval(musicTick,60);
const setTog=()=>{$('bMusic').classList.toggle('off',!music);$('bSfx').classList.toggle('off',!sfx);$('bMusic').setAttribute('aria-pressed',music);$('bSfx').setAttribute('aria-pressed',sfx)};setTog();
$('bMusic').onclick=()=>{music=!music;store.set('advx-music',music?'1':'0');setTog();au()};
$('bSfx').onclick=()=>{sfx=!sfx;store.set('advx-sfx',sfx?'1':'0');setTog();au()};

/* ================= clasificación ================= */
const Board={online:false,db:null,uid:null,failed:false,
  init(){this.ready=(async()=>{try{if(!window.claude||!window.claude.use)return;const db=await withTimeout(window.claude.use('db'),10000);if(!db)return;const u=await window.claude.use('user');const id=u?await u.id():null;if(!id)return;this.db=db;this.uid=id;this.online=true}catch(e){}})();return this.ready},
  local(d){try{return JSON.parse(store.get('advx-lb-'+d)||'[]')}catch(e){return[]}},
  async top(d,n){await this.ready;const me=(store.get('advx-name')||'').trim();
    if(this.online){try{const f='d'+d,snap=await withTimeout(this.db.collection('runs').where(f,'>',0).orderBy(f).limit(n).get(),9000);
      return {src:'online',rows:snap.docs.map(x=>{const v=x.data()||{};return {name:String(v.alias||'Anónimo').slice(0,16),t:+v[f],me:x.id===this.uid}})}}catch(e){}}
    return {src:'local',rows:this.local(d).sort((a,b)=>a.t-b.t).slice(0,n).map(r=>({...r,me:!!me&&r.name===me}))}},
  async submit(d,name,t){t=Math.round(t*10)/10;const L=this.local(d),ex=L.find(r=>r.name===name);if(ex){ex.t=Math.min(ex.t,t)}else L.push({name,t});store.set('advx-lb-'+d,JSON.stringify(L.sort((a,b)=>a.t-b.t).slice(0,50)));
    if(this.online&&!this.failed){try{const ref=this.db.collection('runs').doc(this.uid),s=await withTimeout(ref.get(),8000),cur=s.exists?{...s.data()}:{},f='d'+d;cur.alias=name;if(!(cur[f]>0)||t<cur[f])cur[f]=t;await withTimeout(ref.set(cur),8000);return true}catch(e){this.failed=true}}return false}
};
Board.init();

/* ================= juego ================= */
let mode='home',camMode=store.get('advx-cam')||'tp',G=null,flashT=0,timeScale=1,GH=null;
const input={thr:false,brk:false};
function loadGhost(){try{GH=JSON.parse(store.get('advx-gh-'+DAY.d)||'null')}catch(e){GH=null}}
function newRun(){G={dist:0,v:0,stress:0,time:0,pen:0,lost:0,slip:0,reload:0,bells:0,combo:0,bestCombo:0,bonus:0,vmax:0,ci:0,bi:0,chuff:0,cd:0,smokeAcc:0,tr:[],trT:0,heldAtGo:false,ps:false,fin:0,splits:[]};
  cars.forEach((c,i)=>{if(i){const g=c.userData.gift;g.visible=true;g.scale.setScalar(g.userData.s0);g.position.z=0;g.rotation.set(0,i,0);delete c.userData.pop}});
  loose.forEach(L=>scene.remove(L.o));loose.length=0;fly=null;if(flyer)flyer.visible=false;BELLS.forEach(b=>{b.st=0;b.g.visible=true;b.g.scale.setScalar(1);b.rg.visible=true});loadGhost();ghost.visible=!!GH;
  BELLS.forEach((b,i)=>{const el=$('mb'+i);if(el)el.setAttribute('fill','#6fe39a')})}
const tmpV=new THREE.Vector3(),tmpV2=new THREE.Vector3();
let wheelAng=0;
function poseCar(c,s,j,roll){const p=at(s),q=at(s+2),b=at(s-2),yaw=Math.atan2(q.z-b.z,q.x-b.x);c.position.set(p.x-Math.sin(yaw)*j,0,p.z+Math.cos(yaw)*j);c.rotation.set(roll,-yaw,0,'YXZ')}
const turnSign=s=>Math.sign(wrapA(at(s+4).a-at(s-4).a))||1;
function poseTrain(dist,stress){const tt=performance.now();
  cars.forEach((c,i)=>{const s=dist+OFFS[i],sg=stress>0.05?turnSign(s):0,j=stress>0.25?Math.sin(tt/30+i*1.7)*stress*0.08:0;
    poseCar(c,s,j,-sg*stress*0.16+(stress>0.25?Math.sin(tt/45+i)*stress*0.03:0));
    const g=c.userData.gift;if(g&&g.visible&&!(c.userData.pop<1)){g.position.z=-sg*stress*0.55;g.rotation.x=Math.sin(tt/55+i*2.3)*stress*0.22;g.rotation.z=Math.sin(tt/70+i)*stress*0.12}});
  train.updateMatrixWorld(true);
}
function spinWheels(ds){cars.forEach(c=>c.userData.wheels.forEach(w=>{w.rotation.x+=ds/Math.max(0.6,c.userData.wr)}))}
function ghostDistAt(t){if(!GH)return 0;const tr=GH.tr,f=t*20,i=Math.floor(f);if(i>=tr.length-1)return tr[tr.length-1];return lerp(tr[i],tr[i+1],f-i)}
function ghostTimeAt(d){if(!GH)return null;const tr=GH.tr;let lo=0,hi=tr.length-1;if(d>=tr[hi])return hi/20;while(hi-lo>1){const m=(lo+hi)>>1;if(tr[m]<d)lo=m;else hi=m}const f=tr[hi]===tr[lo]?0:(d-tr[lo])/(tr[hi]-tr[lo]);return (lo+f)/20}
function flash(t,d,cls){const m=$('msg');m.textContent=t;m.className='msg on'+(cls?' '+cls:'');flashT=d}
function toast(t,cls){const el=$('split');el.innerHTML=t;el.className='split on '+(cls||'');clearTimeout(toast.h);toast.h=setTimeout(()=>el.className='split',2600)}
/* regalos que se caen: castigo por pasarse de velocidad en curva */
const loose=[];
const groundY=(x,z)=>{const d=dTrack(x,z);return d<GAUGE+1.4?0.3:d<GAUGE+1.6?0:matH(x,z,d)};
const giftsOn=()=>cars.reduce((n,c,i)=>n+(i&&(c.userData.gift.visible||(fly&&fly.car===c))?1:0),0);
function loseGift(vs){G.pen+=PEN_GIFT;G.lost++;G.slip=SLIP_T;G.stress=0.4;G.v=Math.min(G.v,vs*SLIP_V);
  let car=null;for(let i=1;i<cars.length;i++){const c=cars[i];if(c.userData.gift.visible&&!(c.userData.pop<1)&&!(fly&&fly.car===c)){car=c;break}}
  if(car){const g=car.userData.gift,o=g.clone(),p=at(G.dist+OFFS[cars.indexOf(car)]),sg=turnSign(G.dist),nx=-Math.sin(p.a),nz=Math.cos(p.a);
    g.getWorldPosition(o.position);g.getWorldQuaternion(o.quaternion);g.getWorldScale(o.scale);o.rotation.setFromQuaternion(o.quaternion);scene.add(o);g.visible=false;
    const out=-sg*(5+G.v*0.25);loose.push({o,v:new THREE.Vector3(Math.cos(p.a)*G.v*0.8+nx*out,7+Math.random()*2,Math.sin(p.a)*G.v*0.8+nz*out),w:new THREE.Vector3((Math.random()-.5)*8,(Math.random()-.5)*6,(Math.random()-.5)*8),rest:false,b:0});
    flash(`¡Regalo perdido! +${PEN_GIFT} s`,1.3,'bad');tone(140,0.3,'triangle',0.08);noise(0.25,0.12,900)}
  else{flash(`¡Patinazo! +${PEN_GIFT} s`,1.1,'bad')}
  noise(0.5,0.1,3200,'bandpass');tone(2400,0.4,'sawtooth',0.015);spark(cars[0].position.clone().setY(0.6),24,9);grade.uniforms.flash.value=0.12}
function looseStep(dt){for(const L of loose){if(L.rest)continue;const o=L.o;L.v.y-=22*dt;o.position.addScaledVector(L.v,dt);o.rotation.x+=L.w.x*dt;o.rotation.y+=L.w.y*dt;o.rotation.z+=L.w.z*dt;
  const gy=groundY(o.position.x,o.position.z);if(o.position.y<gy){o.position.y=gy;if(L.b++===0)puff(o.position.clone().setY(gy+0.5),new THREE.Vector3(0,1.5,0),2.2,.4,1.2);
    L.v.y*=-0.28;L.v.x*=0.55;L.v.z*=0.55;L.w.multiplyScalar(0.5);o.rotation.x*=0.4;o.rotation.z*=0.4;if(L.v.lengthSq()<1.5||L.b>4){L.rest=true;o.rotation.x=0;o.rotation.z=0}}}}
function reloadGift(st){const c=cars.find((c,i)=>i&&!c.userData.gift.visible);if(!c||fly||!flyer)return;fly={car:c,from:st.pileWorld.clone(),t:0};flyer.position.copy(fly.from);flyer.visible=true;G.reload++;tone(1568,0.25,'triangle',0.05);tone(2093,0.3,'triangle',0.04,0.1)}
function race(dt){
  G.time+=dt;G.trT+=dt;while(G.trT>=0.05){G.trT-=0.05;G.tr.push(Math.round(G.dist*10)/10)}
  if(G.slip>0){G.slip-=dt;if(Math.random()<0.5)spark(tmpV.set(cars[0].position.x,0.5,cars[0].position.z),2,6)}
  if(input.thr){if(G.slip<=0)G.v+=ACC*(1-0.5*G.v/VMAX)*dt}else G.v-=(input.brk?HARD:BRAKE)*dt;
  G.v=Math.max(0,Math.min(VMAX,G.v-0.25*dt));
  const ds=G.v*dt;G.dist+=ds;G.chuff+=ds;spinWheels(ds);
  if(G.chuff>3.2){G.chuff=0;if(G.v>0.5)noise(0.09,0.06+0.12*G.v/VMAX,600+G.v*25)}
  const vs=Math.min(vsAt(G.dist),vsAt(G.dist-TAIL)),over=G.v/vs-1;
  if(over>0.03)G.stress+=over*3.6*dt;else G.stress=Math.max(0,G.stress-1.0*dt);
  if(G.stress>0.3&&Math.random()<0.6){spark(tmpV.set(cars[2].position.x,0.6,cars[2].position.z),2,5);if(Math.random()<0.12)tone(2600+Math.random()*600,0.12,'sawtooth',0.012)}
  if(G.stress>=1)loseGift(vs);
  G.vmax=Math.max(G.vmax,G.v);
  const CK=ST.slice().sort((a,b)=>a.s-b.s);if(G.ci<CK.length&&G.dist>=CK[G.ci].s){const o=CK[G.ci++];o.hop=1;split();reloadGift(o)}
  while(G.bi<BELLS.length&&G.dist>=BELLS[G.bi].s){const b=BELLS[G.bi++],el=$('mb'+(G.bi-1));if(G.v>=b.v){b.st=1;G.bells++;G.combo++;G.bestCombo=Math.max(G.bestCombo,G.combo);const bb=bellBonus(G.combo);G.bonus+=bb;ding();if(G.combo>1)tone(1568+G.combo*120,0.4,'triangle',0.04,0.08);burst(b.g.position,60+G.combo*10,9,[4,3,.8]);flash(`¡Campana! −${bb.toFixed(2).replace(/0$/,'').replace('.',',')} s${G.combo>1?' · combo x'+G.combo:''}`,0.9,'good');if(el)el.setAttribute('fill','#f6c64e')}else{b.st=2;G.combo=0;dull();flash(`Muy lento para la campana (${b.kmh} km/h)`,1.1,'bad');if(el)el.setAttribute('fill','rgba(255,255,255,.25)')}}
  poseTrain(G.dist,G.stress);
  if(G.dist>=DAY.laps*T.L)startFinish();
}
function split(){const n=G.splits.length+1;G.splits.push(G.time);if(GH&&GH.sp&&GH.sp[n-1]!==undefined){const d=G.time-GH.sp[n-1];toast(`Estación ${n} · <b>${fmtD(d)} s</b>`,d<=0?'good':'bad')}else toast(`Estación ${n} · ${fmt(G.time)}`)}
function startFinish(){mode='finish';$('warn').className='warn';lastWarn='';$('edge').style.opacity=0;G.fin=0;input.thr=false;$('pedal').classList.remove('on');whistle();confettiBurst(cars[0].position.clone().setY(8));grade.uniforms.flash.value=0.35;
  const now=performance.now()/1000;for(let k=0;k<10;k++)fwQ.push({at:now+0.2+k*0.38,p:new THREE.Vector3(TC[0]+(Math.random()-.5)*60,treeR*2.6+10+Math.random()*30,TC[1]+(Math.random()-.5)*60)});
  G.total=Math.max(0,G.time+G.pen-G.bonus);$('cd').textContent='¡META!';const el=$('cd');el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}
function finishStep(rdt){G.fin+=rdt;timeScale=G.fin<1.6?0.3:1;const dt=rdt*timeScale;G.v=Math.max(0,G.v-(G.fin<1.6?2:7)*dt);const ds=G.v*dt;G.dist+=ds;spinWheels(ds);poseTrain(G.dist,0);if(G.fin>2.4){mode='end';timeScale=1;showEnd()}}

/* ================= cámara ================= */
const camPos=new THREE.Vector3(160,70,160),camLook=new THREE.Vector3(),orbit={a:0.6};
let camBlend=1;const camFromP=new THREE.Vector3(),camFromL=new THREE.Vector3(),wantP=new THREE.Vector3(),wantL=new THREE.Vector3();
function camTarget(kind,dt,outP,outL){
  const L=cars[0];
  if(kind==='orbit'){orbit.a+=dt*0.07;const R=mode==='pre'?44:56,c=L.position;outP.set(c.x+Math.cos(orbit.a)*R,mode==='pre'?16:22,c.z+Math.sin(orbit.a)*R);outL.set(c.x,3,c.z);return}
  if(kind==='finish'){const fw2=tmpV2.set(1,0,0).applyAxisAngle(THREE.Object3D.DEFAULT_UP,L.rotation.y);const sd=tmpV.set(-fw2.z,0,fw2.x);outP.set(L.position.x+fw2.x*9+sd.x*9,4.5,L.position.z+fw2.z*9+sd.z*9);outL.set(L.position.x,3,L.position.z);return}
  const fw2=tmpV2.set(1,0,0).applyAxisAngle(THREE.Object3D.DEFAULT_UP,L.rotation.y);
  const s=G?G.dist:0;
  if(kind==='fp'){const p=L.localToWorld(tmpV.copy(L.userData.fp)),la=at(s+30);outP.copy(p);outL.set(la.x,3.8,la.z);return}
  const la=at(s+26);outP.set(L.position.x-fw2.x*15,11.2,L.position.z-fw2.z*15);outL.set(la.x,1.4,la.z);
}
const bez=(a,b,c,t,o)=>o.set((1-t)*(1-t)*a.x+2*(1-t)*t*b.x+t*t*c.x,(1-t)*(1-t)*a.y+2*(1-t)*t*b.y+t*t*c.y,(1-t)*(1-t)*a.z+2*(1-t)*t*b.z+t*t*c.z);
const cinMid=new THREE.Vector3();
function updateCam(dt){
  const kind=(mode==='pre'||mode==='end')?'orbit':mode==='finish'?'finish':camMode;
  camTarget(kind,dt,wantP,wantL);
  if(kind==='fp'&&camBlend>=1){camPos.copy(wantP);camLook.lerp(wantL,1-Math.exp(-7*dt))}
  else{const k=kind==='orbit'?2:kind==='finish'?3:5;camPos.lerp(wantP,1-Math.exp(-k*dt));camLook.lerp(wantL,1-Math.exp(-k*1.3*dt))}
  if(camBlend<1){camBlend=Math.min(1,camBlend+dt/(mode==='count'?3:2));const e=camBlend*camBlend*(3-2*camBlend);
    if(mode==='count'&&G&&G.cin){bez(camFromP,cinMid,wantP,e,camera.position)}else camera.position.lerpVectors(camFromP,wantP,e);
    camera.lookAt(tmpV.lerpVectors(camFromL,wantL,e));if(camBlend>=1){camPos.copy(wantP);camLook.copy(wantL)}}
  else{camera.position.copy(camPos);camera.lookAt(camLook)}
  const v=G&&(mode==='race'||mode==='count')?G.v:0,vr=v/VMAX;
  if(mode==='race'&&v>2){const a=(camMode==='fp'?0.022:0.035)*vr,tt=performance.now()/1000;camera.position.x+=Math.sin(tt*37)*a;camera.position.y+=Math.sin(tt*53+1)*a}
  if(G&&mode==='race'&&G.stress>0.2){const s=G.stress*(camMode==='fp'?0.05:0.18);camera.position.x+=(Math.random()-.5)*s;camera.position.y+=(Math.random()-.5)*s}
  const fov=(kind==='fp'?70:kind==='finish'?50:58)+vr*16;if(Math.abs(camera.fov-fov)>0.05){camera.fov=lerp(camera.fov,fov,1-Math.exp(-3*dt));camera.updateProjectionMatrix()}
  grade.uniforms.blur.value=coarse?0:(mode==='race'?Math.pow(Math.max(0,vr-0.45)/0.55,2)*(camMode==='fp'?0.007:0.005):0);
  grade.uniforms.tilt.value=coarse?0:lerp(grade.uniforms.tilt.value,(mode==='pre'||mode==='end'||mode==='finish')?1:0,1-Math.exp(-3*dt));
  grade.uniforms.focus.value=kind==='orbit'?0.5:0.46;
  key.position.set(cars[0].position.x-60,120,cars[0].position.z-40);key.target.position.set(cars[0].position.x,0,cars[0].position.z);
}

/* ================= HUD ================= */
const giftSvg=c=>`<svg viewBox="0 0 24 24" class="g ${c}" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><rect x="3" y="7" width="18" height="4" rx="1.5"/><path class="rb" d="M12 7v14M12 7c-2-4-6-3-4.5 0M12 7c2-4 6-3 4.5 0"/></svg>`;
{let s='<circle cx="100" cy="100" r="96" fill="rgba(6,9,20,.82)" stroke="#e0ad45" stroke-width="3"/>';for(let k=0;k<=12;k++){const a=(-225+k*22.5)*Math.PI/180,big=k%2===0,r1=big?72:78;s+=`<line x1="${100+Math.cos(a)*r1}" y1="${100+Math.sin(a)*r1}" x2="${100+Math.cos(a)*86}" y2="${100+Math.sin(a)*86}" stroke="#fff" stroke-width="${big?3:1.5}"/>`;if(big)s+=`<text x="${100+Math.cos(a)*58}" y="${100+Math.sin(a)*58+5}" fill="#c9cfe0" font-size="14" font-family="JetBrains Mono" text-anchor="middle">${k*10}</text>`}
 s+='<path id="safeArc" fill="none" stroke="#3fd08a" stroke-width="6" opacity=".85"/><path id="bellArc" fill="none" stroke="#f6c64e" stroke-width="10" opacity="0"/><g id="needle"><path d="M100 100 L96 96 L100 26 L104 96Z" fill="#c41e2e"/><circle cx="100" cy="100" r="8" fill="#e0ad45"/></g>';$('dialSvg').innerHTML=s}
const arcP=(a0,a1,r=90)=>{const p=a=>[100+Math.cos(a*Math.PI/180)*r,100+Math.sin(a*Math.PI/180)*r],[x0,y0]=p(a0),[x1,y1]=p(a1);return `M${x0} ${y0} A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${x1} ${y1}`};
let lastKey='',lastWarn='';const hc=new Map();const stx=(id,v)=>{v=String(v);if(hc.get(id)!==v){hc.set(id,v);$(id).textContent=v}};const sat=(id,a,v)=>{const k=id+'|'+a;if(hc.get(k)!==v){hc.set(k,v);$(id).setAttribute(a,v)}};const sst=(id,p,v)=>{const k=id+'#'+p;if(hc.get(k)!==v){hc.set(k,v);$(id).style[p]=v}};
function hud(){
  stx('hTime',fmt(G.time+G.pen));
  const gt=ghostTimeAt(G.dist);if(gt!==null&&G.dist>5){const d=G.time-gt;stx('hDelta',fmtD(d));const cl='delta '+(d<=0?'good':'bad');if(hc.get('hDc')!==cl){hc.set('hDc',cl);$('hDelta').className=cl}}else stx('hDelta','');
  stx('hBells',`${G.bells}/${BELLS.length}`+(G.combo>1?` ×${G.combo}`:''));
  const va=vsAhead(G.dist,G.v),kmh=G.v*3.6;
  stx('kmh',Math.round(kmh));sat('needle','transform',`rotate(${(-135+kmh/120*270).toFixed(0)} 100 100)`);
  sat('safeArc','d',arcP(-225,-225+Math.max(2,Math.round(va*3.6/120*270))));
  const nb=BELLS[G.bi];const ba=$('bellArc');if(nb&&nb.s-G.dist<90){const a=-225+nb.kmh/120*270;ba.setAttribute('d',arcP(a-2,a+2,78));ba.setAttribute('opacity','1')}else ba.setAttribute('opacity','0');
  let w='',c='';
  if(G.v>va*1.03){w=giftsOn()?'¡CURVA! FRENA O PIERDES REGALOS':'¡CURVA! FRENA';c='hot'}
  else if(nb&&nb.s-G.dist<70&&nb.s-G.dist>0){const ok=G.v>=nb.v;w=`CAMPANA · ${nb.kmh} km/h ${ok?'✓':'¡MÁS VAPOR!'}`;c=ok?'ok':'st'}
  const k=w+c;if(k!==lastWarn){lastWarn=k;const el=$('warn');el.textContent=w;el.className='warn'+(w?' on '+c:'')}
  sst('edge','opacity',Math.min(1,G.stress*1.2).toFixed(2));
  if(mini){const p=at(G.dist),[x,y]=mini.P(p.x,p.z);sat('mtr','cx',x);sat('mtr','cy',y);if(GH){const q=at(ghostDistAt(G.time)),[gx,gy]=mini.P(q.x,q.z);mini.gh.setAttribute('cx',gx);mini.gh.setAttribute('cy',gy)}else mini.gh.setAttribute('cx',-50);
}
  if(MED){const nxt=[['oro',MED.g],['plata',MED.s],['bronce',MED.b]].find(([n,t])=>G.time+G.pen<t);stx('hTarget',nxt?`Objetivo ${nxt[0]} ${fmt(nxt[1])}`:'Sin medalla');}
}

/* ================= pantallas ================= */
const screens=['home','pre','hud','pause','end'];
function show(id){screens.forEach(s=>$(s).classList.toggle('on',s===id||(id==='pause'&&s==='hud')))}
function isOpen(d){if($('dev').checked)return true;const now=new Date();return now>=new Date(now.getFullYear(),11,d)||(now.getMonth()<11&&d===1)}
function todayDay(){const now=new Date();if(now.getMonth()===11&&now.getDate()<=24)return now.getDate();if(now.getMonth()===11)return 24;return 1}
const previews={};const MEDN=['','oro','plata','bronce'];
function renderHome(){
  const now=new Date(),td=todayDay(),pre=now.getMonth()<11,ds=now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}),left=Math.ceil((new Date(now.getFullYear(),11,1)-now)/864e5);
  $('tPin').textContent=td;
  $('tTxt').innerHTML=pre?`Hoy es <b>${esc(ds)}</b>. Faltan ${left} ${left===1?'día':'días'} para la primera puerta: abre la <b>1</b> para calentar motores.`:`Hoy es <b>${esc(ds)}</b>. Toca abrir la puerta <b>${td}</b>: <b>${esc(DAYS[td-1].name)}</b>.`;
  $('cal').innerHTML=ORDER.map(d=>{const D=DAYS[d-1],open=isOpen(d),b=store.get('advx-best-'+d),md=+store.get('advx-medal-'+d)||0,isT=d===td,played=!!b&&open;
    if(!previews[d])previews[d]=previewPath(d);
    const inner=`<div class="in"><svg viewBox="0 0 120 100"><path d="${previews[d]}" fill="none" stroke="#e0ad45" stroke-width="3" stroke-linejoin="round"/></svg><span>${esc(D.name)}${b?'<br>Récord '+fmt(+b):''}</span>${md?`<i class="med m${md}" title="Medalla de ${MEDN[md]}"></i>`:''}</div>`;
    return `<button class="door ${SPAN[d]||''} d${d%5} ${open?'':'lock'} ${isT?'today':''} ${played&&!isT?'open':''}" data-d="${d}" aria-label="Puerta ${d}${open?'':' (cerrada)'}">${inner}<div class="flap"><div class="face"><span class="num ${d%3===1?'s':'slab'}">${d}</span>${md?`<i class="med m${md}"></i>`:''}</div><div class="back"></div></div>${isT?'<span class="rib">¡Ábreme!</span>':''}</button>`}).join('');
}
$('cal').addEventListener('click',e=>{const b=e.target.closest('.door');if(!b||busy)return;const d=+b.dataset.d;au();
  if(!isOpen(d)){b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');tone(200,0.15,'square',0.04);const t=document.createElement('span');t.className='tip';t.textContent='Se abre el '+d+' de diciembre';b.appendChild(t);setTimeout(()=>t.remove(),1600);return}
  openDoor(b,d)});
$('dev').addEventListener('change',()=>{store.set('advx-dev',$('dev').checked?'1':'0');renderHome()});
$('dev').checked=store.get('advx-dev')==='1';
let busy=false;
async function openDoor(el,d){busy=true;creak();const rib=el.querySelector('.rib');if(rib)rib.remove();el.classList.add('open');await new Promise(r=>setTimeout(r,850));
  const rc=el.getBoundingClientRect(),z=$('zoom');$('zN').textContent=d;$('zM').textContent=DAYS[d-1].name;$('zBar').style.width='5%';$('zS').textContent='Abriendo la puerta…';
  Object.assign(z.style,{display:'grid',transition:'none',left:rc.left+'px',top:rc.top+'px',width:rc.width+'px',height:rc.height+'px',borderRadius:'8px',opacity:1});z.classList.remove('full');void z.offsetWidth;
  z.style.transition='';Object.assign(z.style,{left:'0px',top:'0px',width:innerWidth+'px',height:innerHeight+'px',borderRadius:'0px'});z.classList.add('full');
  await new Promise(r=>setTimeout(r,650));
  try{await loadDay(d)}catch(err){console.error(err);$('zS').textContent='No se ha podido cargar el circuito. Recarga la página.';busy=false;return}
  show('pre');z.style.transition='opacity .5s';z.style.opacity=0;setTimeout(()=>{z.style.display='none'},520);busy=false}
let roomBuilt=false;
async function loadDay(d){const D=DAYS[d-1],prog=(p,t)=>{$('zBar').style.width=p+'%';$('zS').textContent=t};
  if(!cars.length){prog(8,'Desempaquetando juguetes…');await Promise.all([loadModels(f=>prog(8+f*18,'Desempaquetando juguetes…')),loadEnv()]);buildTrain()}
  if(!roomBuilt){buildRoom();roomBuilt=true}
  if(DAY!==D||!world){await buildWorld(D,prog)}
  newRun();poseTrain(0,0);prog(92,'Calentando la caldera…');await tick();
  orbit.a=0.6;camera.position.set(cars[0].position.x+60,30,cars[0].position.z+40);camPos.copy(camera.position);camLook.copy(cars[0].position);camera.lookAt(camLook);
  try{await withTimeout(renderer.compileAsync(scene,camera),8000)}catch(e){}
  composer.render(0.016);prog(100,'¡Al andén!');await new Promise(r=>setTimeout(r,250));
  try{history.replaceState(null,'','#dia-'+d)}catch(e){}
  fillPre()}
async function fillPre(){mode='pre';
  $('pNo').textContent='Billete nº '+String(DAY.d*137+1000).padStart(5,'0');$('pDay').textContent=`Día ${DAY.d} de 24`;$('pName').textContent=DAY.name;$('pStub').textContent=`Válido el ${DAY.d} de diciembre`;
  $('pFields').innerHTML=[['Recorrido',(T.L/1000).toFixed(2).replace('.',',')+' km'],['Campanas',BELLS.length],['Curvas cerradas',countCurves()],['Tu récord',store.get('advx-best-'+DAY.d)?fmt(+store.get('advx-best-'+DAY.d)):'—']].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  const md=+store.get('advx-medal-'+DAY.d)||0;
  $('pMed').innerHTML=[['m1','Oro',MED.g],['m2','Plata',MED.s],['m3','Bronce',MED.b]].map(([c,n,t],i)=>`<div class="${md&&md<=i+1?'got':''}"><i class="med ${c}"></i><span>${n}</span><b>${fmt(t)}</b></div>`).join('');
  $('pGhost').textContent=GH?`Competirás contra tu fantasma: ${fmt(GH.t)}`:'Tu primer viaje dejará un fantasma para batirlo después.';
  document.querySelectorAll('#punch button').forEach(b=>b.classList.toggle('on',b.dataset.cam===camMode));
  $('pLB').innerHTML='<li><span>Cargando…</span></li>';const res=await Board.top(DAY.d,5);if(mode==='pre')$('pLB').innerHTML=res.rows.length?res.rows.map((r,i)=>`<li><span>${i+1}. ${esc(r.name)}</span><b>${fmt(r.t)}</b></li>`).join(''):'<li><span>Nadie ha viajado aún. ¡Estrénalo!</span></li>'}
function countCurves(){let n=0,inC=false;for(let i=0;i<T.N;i+=4){const c=T.vs[i]<15.5;if(c&&!inC)n++;inC=c}return n}
document.querySelectorAll('#punch button').forEach(b=>b.onclick=()=>{camMode=b.dataset.cam;store.set('advx-cam',camMode);document.querySelectorAll('#punch button').forEach(x=>x.classList.toggle('on',x===b))});
function goHome(){mode='home';input.thr=false;windSet(0);show('home');renderHome();try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
function startRace(quick){au();windOn();newRun();poseTrain(0,0);lastKey='';show('hud');mode='count';G.cd=quick?2.6:3.6;cdShown=4;$('hLap').textContent=`DÍA ${DAY.d} · ${DAY.name.toUpperCase()}`;
  camFromP.copy(camera.position);camFromL.copy(camLook);camBlend=0;G.cin=!quick;
  if(!quick){camFromP.set(TC[0]+30,treeR*2.5+40,TC[1]+30);camFromL.set(TC[0],treeR,TC[1]);const L=cars[0].position;cinMid.set((camFromP.x+L.x)/2+40,camFromP.y*0.6,(camFromP.z+L.z)/2+40)}
  $('msg').classList.remove('on');$('split').className='split';ghost.visible=!!GH}
let cdShown=4;
function countdown(dt){G.cd-=dt;const n=Math.ceil(G.cd-0.6);if(n!==cdShown&&G.cd>-0.4){cdShown=n;const el=$('cd');el.textContent=n>0?n:'¡YA!';el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');beep(n<=0);if(n<=0)whistle()}
  if(G.cd<=0.6){mode='race';G.heldAtGo=input.thr}}
$('bGo').onclick=()=>startRace(false);$('bBack1').onclick=goHome;$('bBack2').onclick=goHome;
$('bAgain').onclick=()=>startRace(true);
$('bPause').onclick=pause;$('bResume').onclick=resume;$('bRestart').onclick=()=>startRace(true);$('bQuit').onclick=goHome;
$('bCam').onclick=toggleCam;
let pausedFrom=null;
function pause(){if(mode!=='race'&&mode!=='count')return;pausedFrom=mode;mode='paused';input.thr=false;windSet(0);$('pedal').classList.remove('on');show('pause');$('bResume').focus()}
function resume(){if(mode!=='paused')return;mode=pausedFrom;show('hud')}
function toggleCam(){camMode=camMode==='tp'?'fp':'tp';store.set('advx-cam',camMode);camFromP.copy(camera.position);camFromL.copy(camLook);camBlend=0.55;if(G)G.cin=false}
function showEnd(){
  windSet(0);
  const total=G.total,key='advx-best-'+DAY.d,prev=+store.get(key)||0,isBest=!prev||total<prev;
  if(isBest){store.set(key,total.toFixed(1));try{store.set('advx-gh-'+DAY.d,JSON.stringify({t:total,tr:G.tr,sp:G.splits}))}catch(e){}}
  const medal=total<=MED.g?1:total<=MED.s?2:total<=MED.b?3:0,pm=+store.get('advx-medal-'+DAY.d)||0;if(medal&&(!pm||medal<pm))store.set('advx-medal-'+DAY.d,medal);
  $('eNo').textContent=`Día ${DAY.d} de 24`;$('eName').textContent=DAY.name;$('eTime').textContent=fmt(total);$('depT').textContent='LLEGADAS · DÍA '+DAY.d;
  const dPrev=prev?total-prev:null;
  $('eDelta').innerHTML=prev?(dPrev<0?`<b class="good">${fmtD(dPrev)} s</b> mejor que tu récord`:`<b class="bad">${fmtD(dPrev)} s</b> respecto a tu récord (${fmt(prev)})`):'Primer viaje: ya tienes fantasma para la próxima.';
  const nxt=[[1,'oro',MED.g],[2,'plata',MED.s],[3,'bronce',MED.b]].filter(([m])=>!medal||m<medal).pop();
  $('eHint').textContent=nxt?`Te faltan ${(total-nxt[2]).toFixed(1).replace('.',',')} s para la medalla de ${nxt[1]}.`:'¡Medalla de oro! Ahora a por el primer puesto.';
  $('eFields').innerHTML=[['Campanas',`${G.bells}/${BELLS.length}`],['Mejor combo','×'+G.bestCombo],['Vel. máxima',Math.round(G.vmax*3.6)+' km/h'],['Regalos',`${giftsOn()}/3`]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('eSum').innerHTML=`<li><span>Recorrido</span><b>${fmt(G.time)}</b></li>${G.lost?`<li><span>Regalos perdidos (${G.lost})</span><b>+${G.pen} s</b></li>`:''}<li><span>Campanas</span><b>−${G.bonus.toFixed(1)} s</b></li><li><span>Total</span><b>${fmt(total)}</b></li>`;
  const st=$('eStamp');st.hidden=false;st.className='stampbig '+(medal?'m'+medal:'');st.textContent=medal?['','¡ORO!','PLATA','BRONCE'][medal]:(isBest?'¡RÉCORD!':'SIN MEDALLA');
  $('iName').value=store.get('advx-name')||'';$('bSave').disabled=false;$('bSave').textContent='Fichar tiempo';
  renderShare(medal);
  $('prT').textContent=DAY.prod[0];$('prA').href=`https://www.amazon.es/s?k=${encodeURIComponent(DAY.prod[1])}&tag=${TAG}`;
  $('eLB').innerHTML='<div class="r"><span></span><span>CARGANDO…</span><span></span></div>';
  show('end');(async()=>{const res=await Board.top(DAY.d,10);renderDep(res)})();
}
/* compartir al estilo Wordle: sin nombre ni forma del circuito */
const siteUrl=()=>SITE_URL&&!/tu-dominio/.test(SITE_URL)?SITE_URL:location.origin+location.pathname;
let lastMedal=0;
function shareUrl(){return siteUrl()+'#dia-'+DAY.d}
function shareText(){const sq=BELLS.map(b=>b.st===1?'🟨':'⬛').join('');
  return [`🚂 Adviento Express · Día ${DAY.d}`,`${['🎟️','🥇','🥈','🥉'][lastMedal]} ${fmt(G.total)}`,`🔔 ${sq} ${G.bells}/${BELLS.length}`,`🎁 ${giftsOn()}/3`+(G.bestCombo>1?` · combo ×${G.bestCombo}`:''),'¿Me ganas?'].join('\n')}
function renderShare(medal){lastMedal=medal;const txt=shareText(),url=shareUrl(),all=txt+'\n'+url,u=encodeURIComponent(url),t=encodeURIComponent(txt);
  $('shareTxt').textContent=all;
  $('share').innerHTML=(navigator.share?`<button class="s-sh" id="bShare" type="button">Compartir</button>`:'')+`<a class="s-wa" href="https://wa.me/?text=${encodeURIComponent(all)}" target="_blank" rel="noopener">WhatsApp</a><a class="s-x" href="https://twitter.com/intent/tweet?text=${t}&url=${u}" target="_blank" rel="noopener">X</a><a class="s-tg" href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener">Telegram</a><button class="s-cp" id="bCopy" type="button">Copiar</button>`;
  if(navigator.share)$('bShare').onclick=()=>navigator.share({title:'Adviento Express',text:txt,url}).catch(()=>{});
  $('bCopy').onclick=async()=>{try{await navigator.clipboard.writeText(all);$('bCopy').textContent='¡Copiado!'}catch(e){$('bCopy').textContent='No se pudo'}}}
function renderDep(res,hl){$('eLB').innerHTML=(res.rows.length?res.rows.map((r,i)=>`<div class="r ${r.me||(hl&&r.name===hl)?'me':''}" style="animation-delay:${i*70}ms"><span>${String(i+1).padStart(2,'0')}</span><span>${esc(r.name)}</span><span>${fmt(r.t)}</span></div>`).join(''):'<div class="r"><span>--</span><span>SIN LLEGADAS TODAVÍA</span><span>-:--.-</span></div>')+`<p class="src">${res.src==='online'?'Clasificación compartida':'Clasificación de este dispositivo'}</p>`}
$('fName').addEventListener('submit',async e=>{e.preventDefault();const n=$('iName').value.trim().replace(/\s+/g,' ').slice(0,16);if(!n||!G||!G.total)return;
  store.set('advx-name',n);$('bSave').disabled=true;$('bSave').textContent='Fichando…';
  const ok=await Board.submit(DAY.d,n,G.total);$('bSave').textContent=ok||!Board.online?'Fichado':'Fichado aquí';
  renderDep(await Board.top(DAY.d,10),n)});

/* ================= controles ================= */
const racing=()=>mode==='race'||mode==='count';
function press(on){if(!racing()){input.thr=false;return}
  if(on&&!input.thr&&mode==='race'&&G.time<0.35&&!G.heldAtGo&&!G.ps){G.ps=true;G.v=Math.max(G.v,9);flash('¡Salida perfecta!',1.1,'good');perfectS();puff(cars[0].localToWorld(tmpV.set(-1,1,2)),new THREE.Vector3(0,1,3),2,.35,1.2);puff(cars[0].localToWorld(tmpV.set(-1,1,-2)),new THREE.Vector3(0,1,-3),2,.35,1.2)}
  if(!on&&input.thr&&mode==='race'&&G.v>8){hiss();const L=cars[0];[-1,1].forEach(sd=>puff(L.localToWorld(tmpV.set(1.5,0.8,sd*2.2)),new THREE.Vector3(0,1.4,sd*2.5).applyEuler(L.rotation),1.6,.3,0.9))}
  input.thr=on;$('pedal').classList.toggle('on',on);if(on)au()}
[canvas,$('pedal')].forEach(el=>{el.addEventListener('pointerdown',e=>{if(!racing())return;e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch(_){}press(true)});
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>el.addEventListener(ev,()=>press(false)));el.addEventListener('contextmenu',e=>e.preventDefault())});
const GK=[' ','ArrowUp','w','W'],BK=['ArrowDown','s','S'];
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;
  if(GK.includes(e.key)&&racing()){e.preventDefault();if(!e.repeat)press(true)}
  else if(BK.includes(e.key))input.brk=true;
  else if((e.key==='c'||e.key==='C')&&racing())toggleCam();
  else if((e.key==='r'||e.key==='R')&&(racing()||mode==='end'||mode==='paused')){e.preventDefault();startRace(true)}
  else if(e.key==='p'||e.key==='P'||e.key==='Escape'){mode==='paused'?resume():pause()}
  else if(e.key==='Enter'&&mode==='pre'){e.preventDefault();startRace(false)}});
addEventListener('keyup',e=>{if(GK.includes(e.key))press(false);if(BK.includes(e.key))input.brk=false});
addEventListener('blur',()=>{press(false);input.brk=false;if(mode==='race')pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='race')pause()});

/* ================= bucle ================= */
let last=performance.now(),fA=0,fN=0,lastAdj=0;
function fx(dt,t){
  const L=cars[0],v=G?G.v:0;
  const ch=L.localToWorld(tmpV.copy(L.userData.chimney));
  const rate=2+v*0.6;G.smokeAcc=(G.smokeAcc||0)+dt*rate;
  const so=camMode==='fp'&&racing()?0.12:0.26;
  while(G.smokeAcc>1){G.smokeAcc-=1;puff(ch,tmpV2.set((Math.random()-.5)*0.8,4.2+Math.random(),(Math.random()-.5)*0.8),1,so,1.7)}
  smoke.forEach(p=>{if(p.life<=0)return;p.life-=dt/(p.ml||1.7);if(p.life<=0){p.s.visible=false;return}p.s.position.addScaledVector(p.v,dt);p.v.multiplyScalar(Math.exp(-0.6*dt));p.sz+=dt*1.7;p.s.scale.setScalar(p.sz);p.s.material.opacity=p.life*p.op});
  for(let i=0;i<SPK;i++){const s=spk[i];if(s.life<=0){spkP[i*3+1]=-99;continue}s.life-=dt;s.v.y-=18*dt;spkP[i*3]+=s.v.x*dt;spkP[i*3+1]+=s.v.y*dt;spkP[i*3+2]+=s.v.z*dt}spkG.attributes.position.needsUpdate=true;
  snowU.px.value=renderer.getPixelRatio();snowU.t.value=t;
  const cp=camera.position;for(let i=0;i<SN;i++){let y=snowP[i*3+1]-dt*(0.8+(i%5)*0.15);if(y<cp.y-25)y+=70;if(y>cp.y+45)y-=70;snowP[i*3+1]=y;let x=snowP[i*3]+Math.sin(t*0.6+i)*dt*0.4;if(x-cp.x>80)x-=160;if(x-cp.x<-80)x+=160;snowP[i*3]=x;let z=snowP[i*3+2];if(z-cp.z>80)z-=160;if(z-cp.z<-80)z+=160;snowP[i*3+2]=z}
  snowG.attributes.position.needsUpdate=true;
  if(treeParts){treeParts.phases.forEach((m,i)=>m.material.color.setScalar(0.45+0.55*Math.max(0,Math.sin(t*2.2+i*2.1))));treeParts.star.rotation.y=t*0.6}
  arches.forEach((a,k)=>a.forEach((m,i)=>m.material.color.setScalar((Math.floor(t*2.5+k)+i)%2?1:0.25)));
  eaveLights.forEach((m,i)=>m.material.color.setScalar(0.5+0.5*Math.max(0,Math.sin(t*1.6+i*3.1))));
  ST.forEach(o=>{if(o.hop>0){o.hop=Math.max(0,o.hop-dt*1.5);o.pile.position.y=Math.abs(Math.sin(o.hop*Math.PI*3))*1.2*o.hop}});
  if(fireU){fireU.t.value=t;warmFill.intensity=0.42+Math.sin(t*7)*0.05+Math.sin(t*13.7)*0.04}
  if(treeParts)treeParts.glow.material.opacity=0.55+Math.sin(t*2.2)*0.08;
  const tp=cars[0].position;
  anims.forEach(a=>{const o=a.o;if(a.k==='deer'){o.rotation.y=a.base+Math.sin(t*0.6+a.ph)*0.35;o.rotation.x=Math.max(0,Math.sin(t*0.9+a.ph))*0.12}
    else if(a.k==='snowman'){o.rotation.z=Math.sin(t*1.4+a.ph)*0.06}
    else if(a.k==='ginger'){o.getWorldPosition(tmpV);const d=tmpV.distanceTo(tp);const hop=d<28?Math.abs(Math.sin(t*9+a.ph))*1.3:0;o.position.y=a.y+hop;o.rotation.z=d<28?Math.sin(t*9+a.ph)*0.25:0}
    else if(a.k==='flake'){o.rotation.y+=dt*0.4;o.rotation.x=Math.sin(t*0.5+a.ph)*0.3;o.position.y=a.y+Math.sin(t*0.7+a.ph)*2}
    else if(a.k==='nut'){const d=ST[a.j]?Math.hypot(ST[a.j].x-tp.x,ST[a.j].z-tp.z):99;o.rotation.y=a.base+(d<30?Math.sin(t*6)*0.35:0)}});
  BELLS.forEach(b=>{if(b.st===0){b.g.position.y=7.2+Math.sin(t*2+b.ph)*0.4;b.b.rotation.z=Math.sin(t*3+b.ph)*0.25;const ok=G&&G.v>=b.v;b.rg.material.color.setRGB(ok?.6:3,ok?3:1.2,ok?1:.3);b.rg.rotation.z=t}
    else if(b.st===1){const sc=b.g.scale.x;if(sc>0.01){b.g.scale.setScalar(Math.max(0.001,sc-dt*3));b.g.position.y+=dt*8;b.rg.visible=false}else b.g.visible=false}
    else if(b.st===2){b.rg.visible=false;b.b.material=M.dark}});
  fireworks.visible=true;
  if(fwQ.length&&fwQ[0].at<=t){const q=fwQ.shift();burst(q.p);noise(0.5,0.25,500);setTimeout(()=>noise(0.6,0.06,6000,'highpass'),260)}
  let fwa=false;for(let i=0;i<FWN;i++){const p=fw[i];if(p.l<=0)continue;fwa=true;p.l-=dt;p.v.multiplyScalar(Math.exp(-1.4*dt));p.v.y-=6*dt;fwP[i*3]+=p.v.x*dt;fwP[i*3+1]+=p.v.y*dt;fwP[i*3+2]+=p.v.z*dt;if(p.l<=0)fwP[i*3+1]=-999;fwC[i*3]*=0.985;fwC[i*3+1]*=0.985;fwC[i*3+2]*=0.985}
  if(fwa){fwG.attributes.position.needsUpdate=true;fwG.attributes.color.needsUpdate=true}
  let cfa=false;for(let i=0;i<CFN;i++){const p=cf[i];if(p.l<=0)continue;cfa=true;p.l-=dt;p.v.y-=9*dt;p.v.x*=Math.exp(-1.5*dt);p.v.z*=Math.exp(-1.5*dt);if(p.v.y<-3)p.v.y=-3;cfP[i*3]+=(p.v.x+Math.sin(t*4+p.ph)*1.5)*dt;cfP[i*3+1]+=p.v.y*dt;cfP[i*3+2]+=(p.v.z+Math.cos(t*4+p.ph)*1.5)*dt;if(cfP[i*3+1]<0.4)cfP[i*3+1]=0.4;if(p.l<=0)cfP[i*3+1]=-999}
  if(cfa)cfG.attributes.position.needsUpdate=true;
  if(fly){fly.t+=dt/0.75;const c=fly.car,to=c.localToWorld(tmpV2.set(0,c.userData.top+1,0)),e=Math.min(1,fly.t);flyer.position.lerpVectors(fly.from,to,e);flyer.position.y+=Math.sin(e*Math.PI)*5;flyer.rotation.y+=dt*8;
    if(fly.t>=1){flyer.visible=false;if(c.userData.gift){c.userData.gift.visible=true;c.userData.gift.scale.setScalar(0.01);c.userData.pop=0}fly=null}}
  cars.forEach(c=>{const g=c.userData.gift;if(g&&g.visible&&c.userData.pop!==undefined&&c.userData.pop<1){c.userData.pop=Math.min(1,c.userData.pop+dt*3);const p=c.userData.pop,el=1+Math.sin(p*Math.PI*2.5)*(1-p)*0.6;g.scale.setScalar(g.userData.s0*Math.max(0.01,p*el))}});
  if(GH&&G&&(mode==='race'||mode==='count'||mode==='finish')){const gd=ghostDistAt(G.time);poseCar(ghost,gd,0,0);ghost.visible=camMode!=='fp'||Math.abs(gd-G.dist)>9}else ghost.visible=false;
  if(loose.length)looseStep(dt);
  grade.uniforms.flash.value*=Math.exp(-5*dt);if(beam)beam.visible=camMode!=='fp'||!racing();
}
function adapt(raw,now){fA+=raw;fN++;if(now-lastAdj<1500||fN<40)return;const avg=fA/fN;fA=0;fN=0;lastAdj=now;
  if(avg>1/50&&dynPR>0.6){dynPR=Math.max(0.6,+(dynPR-0.15).toFixed(2));resize()}
  else if(avg<1/57&&dynPR<MAXPR){dynPR=Math.min(MAXPR,+(dynPR+0.1).toFixed(2));resize()}
  if(avg>1/34&&dynPR<=0.6&&renderer.shadowMap.enabled){renderer.shadowMap.enabled=false;bloom.enabled=false;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true})}}
function loop(now){
  const raw=(now-last)/1000,dt=Math.min(0.05,raw);last=now;const t=now/1000;
  if(world&&mode!=='home'&&G){
    if(mode==='count'){countdown(dt);poseTrain(0,0)}
    else if(mode==='race')race(dt);
    else if(mode==='finish')finishStep(dt);
    else if(mode==='end'){G.v=Math.max(0,G.v-6*dt);const ds=G.v*dt;G.dist+=ds;spinWheels(ds);poseTrain(G.dist,0)}
    if(mode!=='paused'){fx(dt*timeScale,t);updateCam(dt)}
    if(racing())hud();
    windSet(G.v);
    if(flashT>0){flashT-=dt;if(flashT<=0)$('msg').classList.remove('on')}
    if(dbg)renderer.info.reset();
    composer.render(dt);dbgFrame(raw);
    if((mode==='race'||mode==='pre')&&!window.__advNoAdapt)adapt(raw,now);
  }
  requestAnimationFrame(loop);
}
function perf(n=120,pr=1){const ip=dynPR,ar=renderer.info.autoReset;dynPR=pr;resize();renderer.info.autoReset=false;const gl=renderer.getContext(),px=new Uint8Array(4),sync=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
  for(let i=0;i<3;i++){composer.render(1/60);sync()}renderer.info.reset();composer.render(1/60);sync();const calls=renderer.info.render.calls,tris=renderer.info.render.triangles;
  const t0=performance.now();for(let i=0;i<n;i++){renderer.info.reset();composer.render(1/60);sync()}const ms=(performance.now()-t0)/n;
  renderer.info.autoReset=ar;dynPR=ip;resize();return {ms:+ms.toFixed(2),calls,tris,tex:renderer.info.memory.textures,geo:renderer.info.memory.geometries,pr,w:innerWidth,h:innerHeight}}
function pose(kind,f=0.25){const d=f*T.L;if(G)G.dist=d;poseTrain(d,0);camTarget(kind,0,wantP,wantL);camPos.copy(wantP);camLook.copy(wantL);camBlend=1;camera.position.copy(wantP);camera.lookAt(wantL);camera.fov=kind==='fp'?70:58;camera.updateProjectionMatrix();
  key.position.set(cars[0].position.x-60,120,cars[0].position.z-40);key.target.position.set(cars[0].position.x,0,cars[0].position.z);grade.uniforms.blur.value=0;grade.uniforms.tilt.value=kind==='orbit'?1:0}
window.__adv={newRun:()=>{newRun();poseTrain(0,0);mode='race'},perf,pose,settle:()=>{camBlend=1;if(G)G.cin=false;for(let i=0;i<80;i++)updateCam(0.05)},get G(){return G},get mode(){return mode},vsAhead:(d,v)=>vsAhead(d,v),ST:()=>ST,BELLS:()=>BELLS,get MED(){return MED},get pr(){return dynPR},step:(dt,thr)=>{if(thr!==undefined&&thr!==input.thr)press(thr);if(mode==='count')countdown(dt);else if(mode==='race')race(dt);else if(mode==='finish')finishStep(dt)},giftsOn,shareText:()=>shareText()+'\n'+shareUrl()};
drawArt();renderHome();
{const m=/^#dia-(\d+)$/.exec(location.hash),hd=m?+m[1]:0;if(hd>=1&&hd<=24&&isOpen(hd)){setTimeout(()=>{const el=document.querySelector(`.door[data-d="${hd}"]`);if(el)openDoor(el,hd)},300)}}
requestAnimationFrame(loop);

