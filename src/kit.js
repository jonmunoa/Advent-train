/* Piezas comunes de las maquetas: texturas, materiales, juguetes Kenney, tren de vapor, árbol, Papá Noel, personitas, casas
   y los paneles de las marcas. Sin escena ni cámara: quien lo usa monta lo suyo. Sale de tren.js. */
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng} from './sim.js';

export const QS=new URLSearchParams(location.search),coarse=matchMedia('(pointer:coarse)').matches,LOWQ=coarse||QS.has('movil'),REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function hash2(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)}
/* el ruido en los puntos de la rejilla, apuntado para no repetir el seno (mismo resultado, unas 8 veces más rápido) */
const HV=new Float64Array(262144).fill(-1);
function hs(x,y){if(x<-256||x>255||y<-256||y>255)return hash2(x,y);const i=(x+256)*512+y+256,v=HV[i];return v<0?HV[i]=hash2(x,y):v}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hs(xi,yi),b=hs(xi,yi+1);return lerp(a+(hs(xi+1,yi)-a)*u,b+(hs(xi+1,yi+1)-b)*u,v)}
const fbm=(x,y)=>vnoise(x,y)*0.6+vnoise(x*2.1,y*2.1)*0.28+vnoise(x*4.3,y*4.3)*0.12;
const tick=()=>new Promise(r=>setTimeout(r,0));

/* ---------- texturas ---------- */
const texCache={};
function canvasTex(w,h,draw,key,srgb=true){if(key&&texCache[key])return texCache[key];const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;if(key)texCache[key]=t;return t}
function pixTex(size,fn,key,srgb=true){return canvasTex(size,size,(g,w,h)=>{const id=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4,c=fn(x,y);id.data[o]=c[0];id.data[o+1]=c[1];id.data[o+2]=c[2];id.data[o+3]=c[3]===undefined?255:c[3]}g.putImageData(id,0,0)},key,srgb)}
const rep=(t,a,b)=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(a,b);return t};
const dotTex=canvasTex(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.4,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)},'dot');
const woodTex=rep(pixTex(128,(x,y)=>{const g=Math.sin(x*0.25+vnoise(x*0.05,y*0.4)*6)*0.5+0.5,v=70+g*40;return [v*1.2,v*.85,v*.6]},'wood'),1,1);
const plankTex=rep(pixTex(256,(x,y)=>{const row=Math.floor(y/22),e=y%22<2?0.55:1,g=0.85+0.15*Math.sin(x*0.08+row*3+vnoise(x*0.03,row)*5),k=(0.9+hash2(row,7)*0.15)*e*g*255;return [k,k*.97,k*.93]},'plank'),1,1);
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
const TL=new THREE.TextureLoader();
const coneTex=canvasTex(8,64,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h)},'cone');
const phCache={};
function phTex(name,rx,ry=rx,srgb=false){const k=name+rx+'x'+ry;if(phCache[k])return phCache[k];const t=TL.load('m/ph/'+name+'.webp');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return phCache[k]=t}
const snowN=phTex('snow_02_nor',34),snowR=phTex('snow_02_rough',34);
const blobTex=canvasTex(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(0,0,0,.75)');r.addColorStop(.55,'rgba(0,0,0,.35)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64)},'blob');
const puffTex=canvasTex(128,128,(g)=>{const q=rng(8);for(let i=0;i<26;i++){const x=64+(q()-.5)*60,y=64+(q()-.5)*60,rr=14+q()*26,r=g.createRadialGradient(x,y,0,x,y,rr);r.addColorStop(0,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128)}},'puff');

/* ---------- materiales ---------- */
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
  branch:new THREE.MeshStandardMaterial({map:(()=>{const t=TL.load('m/ph/rama.webp');t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t})(),alphaTest:.36,side:THREE.DoubleSide,roughness:.85,alphaToCoverage:true}),
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

const stoneTex=rep(canvasTex(256,256,(g,w,h)=>{g.fillStyle='#4a4744';g.fillRect(0,0,w,h);const q=rng(11);for(let y=0;y<8;y++){const off=(y%2)*24;for(let x=-1;x<6;x++){const l=104+q()*44,bx=x*48+off;g.fillStyle=`rgb(${l+6},${l+2},${l-4})`;g.fillRect(bx+3,y*32+3,42,26);g.fillStyle='rgba(255,255,255,.1)';g.fillRect(bx+3,y*32+3,42,4)}}},'stone'),1,1);
Object.assign(M,{
  stone:new THREE.MeshStandardMaterial({map:stoneTex,roughness:.92}),
  stone2:new THREE.MeshStandardMaterial({map:stoneTex,color:0xe6dccb,roughness:.85}),
  ice:new THREE.MeshLambertMaterial({color:0xbcd6ec,emissive:0x0c1626}),
  cobble:new THREE.MeshStandardMaterial({map:stoneTex,color:0xcfc8bd,roughness:.95}),
  velvet:new THREE.MeshStandardMaterial({color:0xb5121f,roughness:.72}),
  skin:new THREE.MeshStandardMaterial({color:0xf0c3a2,roughness:.6}),
  person:new THREE.MeshStandardMaterial({roughness:.65}),
  personV:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65}),
});
/* caja con UV en unidades (la textura no se estira) */
function boxU(w,h,d,k=3){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0]/k,uv.getY(i)*dims[f][1]/k)}return g}

/* ================= modelos 3D (Kenney, CC0) ================= */
const MD={};
/* los árboles y juguetes que quedan entre la cámara y el coche que se sigue no se dibujan (un cono que descarta sus píxeles) */
const CUT={a:{value:new THREE.Vector3()},b:{value:new THREE.Vector3()},r:{value:0}};
function cutMat(m,k=1,t=.985){m.onBeforeCompile=sh=>{sh.uniforms.cutA=CUT.a;sh.uniforms.cutB=CUT.b;sh.uniforms.cutR=CUT.r;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCutP;').replace('#include <project_vertex>','#include <project_vertex>\n{vec4 cp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\ncp=instanceMatrix*cp;\n#endif\nvCutP=(modelMatrix*cp).xyz;}');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCutP;uniform vec3 cutA,cutB;uniform float cutR;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(cutR>.01){vec3 ab=cutB-cutA;float t=clamp(dot(vCutP-cutA,ab)/dot(ab,ab),0.,1.);if(t<'+t.toFixed(3)+'&&length(vCutP-cutA-ab*t)<cutR*'+k.toFixed(2)+'*(.25+.75*t))discard;}')};m.customProgramCacheKey=()=>'cut'+k+t;return m}
/* juguetes: los prepara esc-juguetes.js */
function flat(k){const D=MD[k];if(D.flat)return D.flat;const gs=[];let mat=null;D.scene.traverse(o=>{if(o.isMesh){let g=o.geometry.clone();for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);if(g.index)g=g.toNonIndexed();g.applyMatrix4(o.matrixWorld);gs.push(g);mat=mat||o.material}});
  const geo=mergeGeometries(gs,false),b=D.box;geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);return D.flat={geo,mat,h:b.max.y-b.min.y,w:Math.max(b.max.x-b.min.x,b.max.z-b.min.z)}}
function inst(k,list,shadow,par){if(!list.length)return null;const f=flat(k),m=new THREE.InstancedMesh(f.geo,f.mat,list.length);list.forEach((t,i)=>{o3.position.set(t.x,t.y||0,t.z);o3.rotation.set(0,t.r||0,0);o3.scale.setScalar(t.h/f.h);o3.updateMatrix();m.setMatrixAt(i,o3.matrix)});m.castShadow=shadow;m.receiveShadow=true;par.add(m);return m}
function obj(k,h){const f=flat(k),m=new THREE.Mesh(f.geo,f.mat);m.scale.setScalar(h/f.h);m.castShadow=true;m.receiveShadow=true;return m}
/* une mallas por material (menos draw calls); las mallas deben tener matrixWorld al día */
function mergeMeshes(list){const groups=new Map();
  for(const o of list){let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const k of Object.keys(g.attributes))if(!['position','normal','uv',o.material.vertexColors?'color':''].includes(k))g.deleteAttribute(k);
    if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    g.clearGroups();g.applyMatrix4(o.matrixWorld);const k=o.material.uuid+(o.castShadow?'s':'');if(!groups.has(k))groups.set(k,{m:o.material,c:o.castShadow,gs:[]});groups.get(k).gs.push(g)}
  const out=[];groups.forEach(v=>{const mg=mergeGeometries(v.gs,false);v.gs.forEach(g=>g.dispose());if(!mg)return;const m=new THREE.Mesh(mg,v.m);m.castShadow=v.c;m.receiveShadow=true;out.push(m)});return out}
const branchGeo=(()=>{const g=new THREE.PlaneGeometry(1,0.78);g.rotateX(-Math.PI/2);g.translate(0.5,0,0);const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0);return g})();

/* ---------- tren ---------- */
const GAUGE=1.24,RT=0.75,WB=0.78,WS=0.42;// carriles, cabeza del carril y radio de las ruedas motrices y pequeñas
const WLEN=7.2,WHALF=1.42,WTOP=4.62,PANEL_Y=2.95,PANEL_W=5.96,PANEL_H=2.05;// furgón: el panel de la marca ocupa casi todo el costado

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
const winG=canvasTex(64,64,(g,w,h)=>{const r=g.createRadialGradient(32,22,2,32,30,44);r.addColorStop(0,'#fff3cf');r.addColorStop(.45,'#ffcf7d');r.addColorStop(1,'#b8601c');g.fillStyle=r;g.fillRect(0,0,w,h);g.fillStyle='rgba(70,30,10,.6)';g.fillRect(0,50,w,14);g.beginPath();g.arc(22,44,9,0,7);g.fill()},'winG');TM.glow.map=winG;TM.glow.color.setRGB(1.7,1.4,1.05);
function gastado(m,{lo=.7,hi=3.1,k=.5,id=''}={}){m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLo;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLo=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vLo;float sz;float hG(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}float nG(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hG(i),hG(i+vec3(1,0,0)),f.x),mix(hG(i+vec3(0,1,0)),hG(i+vec3(1,1,0)),f.x),f.y),mix(mix(hG(i+vec3(0,0,1)),hG(i+vec3(1,0,1)),f.x),mix(hG(i+vec3(0,1,1)),hG(i+vec3(1,1,1)),f.x),f.y),f.z);}').replace('#include <color_fragment>','#include <color_fragment>\n{float n=nG(vLo*2.3),n2=nG(vLo*vec3(9.,2.2,9.));sz=(1.-smoothstep('+lo.toFixed(2)+','+hi.toFixed(2)+',vLo.y+(n-.5)*1.1))*'+k.toFixed(2)+';sz=clamp(sz+smoothstep(.62,.9,n2)*.14,0.,1.);diffuseColor.rgb=mix(diffuseColor.rgb*(.93+.12*n),vec3(.085,.07,.06),sz*.62);}').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+sz*.5,0.,1.);')};m.customProgramCacheKey=()=>'gas'+id+lo+hi+k;return m}
gastado(TM.lac,{id:'l'});gastado(TM.black,{k:.35,id:'b'});gastado(TM.green,{id:'g'});gastado(TM.red,{id:'r'});gastado(TM.brass,{k:.3,id:'d'});
// furgones de tablas: la veta y las juntas vienen de la foto
TM.lac.map=phTex('white_planks_clean_diff',1,1,true);TM.lac.clearcoat=.35;TM.lac.clearcoatRoughness=.35;TM.lac.roughness=.5;if(!LOWQ){TM.lac.normalMap=phTex('white_planks_clean_nor',1);TM.lac.normalScale=new THREE.Vector2(1.7,1.7)}
TM.snow=new THREE.MeshStandardMaterial({color:0xeef3fb,roughness:.85});
function uvCaja(g,k){const u=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<u.count;i++){const X=Math.abs(n.getX(i)),Y=Math.abs(n.getY(i));u.setXY(i,(X>.5?p.getZ(i):p.getX(i))*k,(Y>.5?p.getZ(i):p.getY(i))*k)}return g}
const _m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(1,1,1),_e=new THREE.Euler(),
  UPV=new THREE.Vector3(0,1,0),ZAX=new THREE.Vector3(0,0,1),ONE=new THREE.Vector3(1,1,1),QFLIP=new THREE.Quaternion().setFromAxisAngle(UPV,Math.PI),ZERO=new THREE.Matrix4().makeScale(0,0,0);
/* piezas sueltas que luego se unen por material (pocas llamadas de dibujo por coche) */
function part(L,g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0){_m.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(rx,ry,rz)),ONE);g.applyMatrix4(_m);L.push([g,m]);return g}
function geoOnly(g){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));return g}
function fuse(L,par){const by=new Map();for(const [g,m] of L){if(!by.has(m))by.set(m,[]);by.get(m).push(geoOnly(g))}
  const out=[];by.forEach((gs,m)=>{const me=new THREE.Mesh(mergeGeometries(gs,false),m);me.castShadow=true;me.receiveShadow=true;if(par){par.add(me);me.userData.fijo=true}out.push(me)});return out}
// las formas básicas se hacen una vez por medida y luego se copian (las cajas, escalando una de lado 1)
const copiaG=g=>{const q=new THREE.BufferGeometry();q.type=g.type;q.parameters=g.parameters;q.index=g.index;for(const k in g.attributes){const a=g.attributes[k];q.attributes[k]=new THREE.BufferAttribute(a.array.slice(),a.itemSize)}return q},HECHAS=new Map(),una=(t,f)=>(...a)=>{const k=t+a.join();let g=HECHAS.get(k);if(!g){if(HECHAS.size>1500)HECHAS.clear();HECHAS.set(k,g=f(...a))}return copiaG(g)};
const BX1=new THREE.BoxGeometry(1,1,1),BX=(w,h,d)=>{const q=copiaG(BX1),p=q.attributes.position.array;for(let i=0;i<72;i+=3){p[i]*=w;p[i+1]*=h;p[i+2]*=d}q.parameters={width:w,height:h,depth:d,widthSegments:1,heightSegments:1,depthSegments:1};return q};
const CY=una('c',(rt,rb,h,n=20)=>new THREE.CylinderGeometry(rt,rb,h,n)),CYX=una('x',(r,l,n=20)=>new THREE.CylinderGeometry(r,r,l,n).rotateZ(Math.PI/2)),
  TOR=una('t',(r,t,n=28)=>new THREE.TorusGeometry(r,t,8,n)),DOME=una('d',r=>new THREE.SphereGeometry(r,18,8,0,Math.PI*2,0,Math.PI/2)),PLN=una('p',(w,h)=>new THREE.PlaneGeometry(w,h)),SPH=una('s',(r,a=12,b=9)=>new THREE.SphereGeometry(r,a,b));
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
function wagonGeos(marco=true){const N=LOWQ?8:14,lac=[uvCaja(BX(7.0,2.7,2.84).translate(0,2.9,0),.42)],blk=[roofGeo(7.4,3.1,0.32).translate(0,4.25,0),BX(7.3,0.32,2.3).translate(0,1.42,0)],gld=[],nie=[];
  // techo: pasarela de tablas, costillas y una capa de nieve que no llega al borde
  for(const z of[-.16,.16])blk.push(BX(6.9,.06,.27).translate(0,4.64,z));for(let k=0;k<7;k++){const x=-3.3+k*1.1;blk.push(roofGeo(.09,3.14,.34).translate(x,4.27,0))}
  nie.push(roofGeo(6.7,2.5,.24,.06).translate(0,4.4,0));for(const [x,z,r] of [[-2.6,.75,.5],[-.6,-.85,.62],[1.7,.8,.56],[2.9,-.6,.44]])nie.push(SPH(r,10,5).scale(1.6,.24,1).translate(x,4.46,z));
  // bogies: largueros, cajas de grasa y muelles
  for(const x of[-2.45,2.45]){blk.push(BX(2.0,0.26,2.12).translate(x,1.2,0));for(const z of[-1.2,1.2]){blk.push(BX(1.9,.2,.16).translate(x,1.0,z));for(const d of[-.5,.5])blk.push(BX(.34,.34,.2).translate(x+d,.86,z*1.02),CY(.09,.09,.3,8).translate(x+d*.42,1.16,z*1.05))}}
  // topes, enganche y tirantes bajo el bastidor
  for(const x of[-3.78,3.78]){blk.push(BX(0.4,0.22,0.3).translate(x,1.42,0));for(const z of[-.8,.8])blk.push(CYX(.1,.34,8).translate(x*.985,1.46,z),CYX(.2,.06,N).translate(x*1.03,1.46,z))}for(const z of[-.95,.95]){blk.push(BX(2.4,.06,.06).translate(0,.98,z));for(const s of[-1,1])blk.push(BX(1.4,.06,.06).rotateZ(s*.3).translate(s*1.82,1.17,z))}
  // esquinas de hierro con remaches y puertas correderas asomando bajo el panel
  for(const x of[-3.47,3.47])for(const z of[-1.4,1.4]){blk.push(BX(.14,2.66,.14).translate(x,2.9,z));for(let k=0;k<6;k++)blk.push(SPH(.035,5,4).translate(x,1.75+k*.46,z+Math.sign(z)*.08))}for(const z of[-1.45,1.45])blk.push(BX(6.9,.09,.07).translate(0,1.66,z),BX(6.9,.09,.07).translate(0,4.22,z));
  if(marco)for(const sd of[-1,1]){const z=sd*(WHALF+0.03);gld.push(BX(PANEL_W+0.2,0.09,0.05).translate(0,PANEL_Y+PANEL_H/2+0.045,z),BX(PANEL_W+0.2,0.09,0.05).translate(0,PANEL_Y-PANEL_H/2-0.045,z),BX(0.09,PANEL_H+0.18,0.05).translate(-PANEL_W/2-0.045,PANEL_Y,z),BX(0.09,PANEL_H+0.18,0.05).translate(PANEL_W/2+0.045,PANEL_Y,z))}
  for(const x of[-3.56,3.56]){for(const z of[0.55,1.05])gld.push(CY(.028,.028,2.6,6).translate(x,2.95,z));for(let k=0;k<7;k++)gld.push(CY(.024,.024,.5,6).rotateX(Math.PI/2).translate(x,1.8+k*0.38,0.8))}gld.push(TOR(.3,.035,16).rotateY(Math.PI/2).translate(-3.66,4.05,-.75));
  const mg=a=>mergeGeometries(a.map(geoOnly),false);return {lac:mg(lac),blk:mg(blk),gld:mg(gld),nie:mg(nie)}}
function buildLoco(CB=TM.green,CR=TM.red){const L=[],g=new THREE.Group();
  part(L,BX(8.0,0.36,2.0),TM.black,-0.3,1.72,0);
  part(L,BX(7.8,0.12,3.0),CR,-0.35,2.4,0);part(L,BX(7.84,0.05,3.04),TM.brass,-0.35,2.47,0);
  part(L,CYX(1.0,4.8,28),CB,0.6,3.45,0);for(const x of[-1.2,0.5,2.2])part(L,TOR(1.012,0.055),TM.brass,x,3.45,0,0,Math.PI/2,0);
  part(L,CYX(1.06,0.82,28),TM.black,3.41,3.45,0);part(L,CYX(0.9,0.08,28),TM.black,3.86,3.45,0);part(L,TOR(0.9,0.05),TM.brass,3.9,3.45,0,0,Math.PI/2,0);part(L,SPH(0.09),TM.brass,3.93,3.45,0);
  part(L,new THREE.LatheGeometry([[0,0],[0.46,0],[0.36,0.35],[0.32,0.85],[0.5,1.3],[0.6,1.48],[0.52,1.52],[0,1.52]].map(([a,b])=>new THREE.Vector2(a,b)),22),TM.black,3.35,4.25,0);
  part(L,TOR(0.57,0.05),TM.brass,3.35,5.74,0,Math.PI/2,0,0);
  part(L,CY(0.5,0.56,0.42),TM.brass,1.35,4.52,0);part(L,DOME(0.5),TM.brass,1.35,4.73,0);
  part(L,CY(0.38,0.44,0.36),CR,-0.2,4.5,0);part(L,DOME(0.38),TM.brass,-0.2,4.68,0);
  part(L,CY(0.07,0.07,0.5),TM.brass,-1.45,4.6,0);part(L,CY(0.14,0.07,0.2),TM.brass,-1.45,4.95,0);
  for(const z of[-1.1,1.1])part(L,CYX(0.035,4.4,6),TM.brass,0.7,3.95,z);
  for(const z of[-1.42,1.42]){part(L,CYX(0.42,1.0,18),TM.black,2.5,1.62,z);part(L,CYX(0.45,0.07,18),TM.brass,2.0,1.62,z);part(L,CYX(0.45,0.07,18),TM.brass,3.0,1.62,z)}
  {const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(0.95,0);s.lineTo(0,0.95);s.closePath();const cg=new THREE.ExtrudeGeometry(s,{depth:2.5,bevelEnabled:false});cg.translate(0,0,-1.25);part(L,cg,CR,3.95,0.85,0)}
  part(L,BX(0.3,0.5,2.9),CR,3.95,1.98,0);for(const z of[-0.95,0.95])part(L,CYX(0.2,0.32,14),TM.brass,4.25,1.98,z);
  // remaches, tuberías, pasamanos, arenero, dinamo, campana, escalones y topes
  {const rv=(x,r,n,y=3.45)=>{for(let k=0;k<n;k++){const t=k/n*6.283;part(L,SPH(.04,5,4),TM.black,x,y+Math.sin(t)*r,Math.cos(t)*r)}};if(!LOWQ){rv(3.06,1.07,22);rv(3.76,1.07,22);for(const x of[-1.2,.5,2.2])rv(x+.16,1.005,18);for(let k=0;k<15;k++)for(const z of[-1.51,1.51])part(L,SPH(.035,5,4),TM.black,-4.1+k*.16,2.52,z)}
    for(const z of[-1,1]){part(L,CYX(.05,4.2,8),TM.brass,.9,2.86,z*1.06);part(L,CYX(.07,2.2,8),TM.black,1.9,3.05,z*.98);part(L,CY(.05,.05,1.0,8),TM.brass,2.95,3.6,z*1.02,z*-.5,0,0);for(const x of[-1.2,.4,2.0,3.2])part(L,SPH(.055,6,5),TM.brass,x,3.95,z*1.1);part(L,BX(.42,.07,.5),TM.black,3.2,1.2,z*1.35);part(L,BX(.42,.07,.5),TM.black,-3.9,1.3,z*1.4);part(L,BX(.07,.9,.07),TM.black,3.2,1.7,z*1.5);part(L,BX(1.2,.36,.5),TM.black,.2,2.12,z*1.18);part(L,CYX(.17,1.0,10),TM.black,-1.2,2.75,z*1.25);
      part(L,CYX(.24,.5,14),TM.black,4.28,1.98,z*.95);part(L,CYX(.3,.08,16),TM.black,4.52,1.98,z*.95)}
    part(L,CY(.1,.14,.34,10),TM.black,2.35,4.5,0);part(L,new THREE.SphereGeometry(.22,14,8,0,6.2832,0,1.6),TM.brass,2.35,4.68,0);part(L,CY(.24,.22,.07,14),TM.brass,2.35,4.68,0);part(L,BX(.06,.06,.5),TM.black,2.35,4.94,0);for(const z of[-.24,.24])part(L,BX(.06,.5,.06),TM.black,2.35,4.7,z);
    part(L,TOR(.72,.045,20),TM.black,3.9,3.45,0,0,Math.PI/2,0);for(let k=0;k<8;k++){const t=k/8*6.283;part(L,BX(.05,.16,.1),TM.black,3.9,3.45+Math.sin(t)*.82,Math.cos(t)*.82,-t,0,0)}part(L,BX(.05,.34,.8),TM.brass,3.93,3.06,0);part(L,CYX(.05,.5,8),TM.steel,4.35,1.5,0);part(L,TOR(.13,.04,10),TM.steel,4.62,1.5,0);
    for(let k=0;k<9;k++)part(L,BX(.08,.95,.07),CR,4.35-.0,1.02,-1.12+k*.28,0,0,.62);}
  // cabina con las ventanas encendidas
  part(L,BX(2.5,2.55,2.9),CR,-3.0,3.62,0);part(L,BX(2.54,0.07,2.94),TM.brass,-3.0,2.38,0);
  for(const sd of[-1,1]){part(L,PLN(0.95,0.85),TM.glow,-3.05,4.2,sd*1.456,0,sd>0?0:Math.PI,0);
    part(L,BX(1.07,0.06,0.04),TM.brass,-3.05,4.65,sd*1.47);part(L,BX(1.07,0.06,0.04),TM.brass,-3.05,3.75,sd*1.47);part(L,BX(0.06,0.96,0.04),TM.brass,-3.57,4.2,sd*1.47);part(L,BX(0.06,0.96,0.04),TM.brass,-2.53,4.2,sd*1.47)}
  for(const z of[-0.9,0.9])part(L,new THREE.CircleGeometry(0.26,16),TM.glow,-1.74,4.35,z,0,Math.PI/2,0);
  part(L,roofGeo(3.0,3.4,0.3),TM.black,-3.0,4.93,0);
  part(L,BX(0.5,0.48,0.56),TM.black,3.62,4.55,0);part(L,TOR(0.2,0.04,16),TM.brass,3.88,4.55,0,0,Math.PI/2,0);
  fuse(L,g);
  const rods=[-1,1].map(sd=>{const m=new THREE.Mesh(BX(3.75,0.13,0.07),TM.steel);m.position.set(-0.6,RT+WB,sd*1.52);m.castShadow=true;g.add(m);return m});// bielas
  const W=[];for(const x of[-2.3,-0.6,1.1])for(const sd of[-1,1])W.push({x,y:RT+WB,z:sd*GAUGE,big:true});for(const x of[3.55,-3.75])for(const sd of[-1,1])W.push({x,y:RT+WS,z:sd*GAUGE,big:false});
  g.userData={len:8.9,top:5.3,chimney:new THREE.Vector3(3.35,5.9,0),lamp:new THREE.Vector3(3.92,4.55,0),wheels:W,rods};return g}
function buildTender(CR=TM.red){const L=[],g=new THREE.Group();
  part(L,BX(4.6,0.3,2.2),TM.black,0,1.45,0);for(const x of[-1.15,1.15])part(L,BX(1.9,0.34,2.12),TM.black,x,1.17,0);
  part(L,BX(4.4,1.75,2.9),CR,0,2.5,0);if(!LOWQ)for(const z of[-1.47,1.47])for(let k=0;k<14;k++)for(const y of[1.78,3.22])part(L,SPH(.04,5,4),TM.black,-2.05+k*.315,y,z);part(L,BX(3.4,.9,.04),TM.brass,0,2.5,1.46);part(L,BX(3.3,.8,.05),CR,0,2.5,1.465);part(L,BX(3.4,.9,.04),TM.brass,0,2.5,-1.46);part(L,BX(3.3,.8,.05),CR,0,2.5,-1.465);for(const x of[-2.35,2.35])for(const z of[-.8,.8])part(L,CYX(.1,.3,8),TM.black,x,1.5,z);part(L,BX(4.44,0.08,2.94),TM.brass,0,3.4,0);part(L,BX(4.44,0.08,2.94),TM.brass,0,1.66,0);
  {const cg=new THREE.BoxGeometry(4.0,0.6,2.5,14,1,9),p=cg.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)>0)p.setY(i,p.getY(i)+hash2(p.getX(i)*3.1,p.getZ(i)*2.7)*0.5*(1-Math.abs(p.getZ(i))/1.4));cg.computeVertexNormals();part(L,cg,TM.coal,0,3.3,0)}
  fuse(L,g);
  const W=[];for(const x of[-1.7,-0.6,0.6,1.7])for(const sd of[-1,1])W.push({x,y:RT+WS,z:sd*GAUGE,big:false});
  g.userData={len:4.8,top:3.9,wheels:W};return g}
function buildCaboose(CR=TM.red){const L=[],g=new THREE.Group();
  part(L,BX(5.4,0.3,2.3),TM.black,0,1.42,0);for(const x of[-1.4,1.4])part(L,BX(1.9,0.34,2.12),TM.black,x,1.17,0);
  part(L,BX(4.2,2.4,2.8),CR,0,2.78,0);part(L,roofGeo(4.6,3.1,0.25),TM.black,0,3.98,0);
  part(L,BX(1.8,1.0,2.1),CR,0.2,4.5,0);part(L,roofGeo(2.2,2.5,0.18),TM.black,0.2,5.0,0);part(L,roofGeo(1.9,1.9,.14,.05),TM.snow,.2,5.14,0);part(L,roofGeo(1.1,2.4,.18,.05),TM.snow,-1.5,4.16,0);part(L,roofGeo(.9,2.4,.18,.05),TM.snow,1.7,4.16,0);part(L,CY(.12,.12,.7,10),TM.black,-1.6,4.5,.5);for(const z of[-1.43,1.43])for(const y of[1.75,3.85])part(L,BX(4.2,.08,.05),TM.black,0,y,z);
  for(const sd of[-1,1]){for(const x of[-1.3,0,1.3])part(L,PLN(0.6,0.6),TM.glow,x,3.15,sd*1.405,0,sd>0?0:Math.PI,0);part(L,PLN(0.5,0.4),TM.glow,0.2,4.55,sd*1.055,0,sd>0?0:Math.PI,0);part(L,BX(4.24,0.07,0.04),TM.brass,0,1.62,sd*1.42)}
  for(const x of[-2.55,2.55]){part(L,BX(0.5,0.08,2.3),TM.black,x,1.6,0);for(const z of[-1.05,1.05])part(L,BX(0.05,1.0,0.05),TM.brass,x+Math.sign(x)*0.2,2.1,z);part(L,BX(0.05,0.05,2.15),TM.brass,x+Math.sign(x)*0.2,2.6,0)}
  part(L,SPH(0.16),TM.tail,-2.78,3.4,0.9);
  fuse(L,g);
  const W=[];for(const x of[-1.9,-0.9,0.9,1.9])for(const sd of[-1,1])W.push({x,y:RT+WS,z:sd*GAUGE,big:false});
  g.userData={len:6.0,top:5.2,wheels:W};return g}

/* árbol de Navidad (el del salón y el de la plaza): el mismo, a otra escala */
function buildTree(par,x,y,z,sc){
  const R=17,r=rng(7+Math.round(sc*100)),g=new THREE.Group(),H=R*2.5;
  const stand=cyl(R*0.24,R*0.3,7,M.red,24);stand.position.y=3.5;g.add(stand);
  const skirt=new THREE.Mesh(new THREE.RingGeometry(R*0.3,R*0.95,48,1).rotateX(-Math.PI/2),M.felt);skirt.position.y=0.25;skirt.receiveShadow=true;g.add(skirt);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(R*0.95,0.9,8,64),M.fur);trim.rotation.x=Math.PI/2;trim.position.y=0.4;g.add(trim);
  const core=new THREE.Mesh(new THREE.ConeGeometry(R*0.36,H*0.79,24),M.core);core.position.y=H*0.395+11;g.add(core);
  const wh=27,per=14,n=wh*per,br=new THREE.InstancedMesh(branchGeo,M.branch,n),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(),col=new THREE.Color();let k=0;const tips=[];
  const y0=12.5;
  for(let i=0;i<wh;i++){const u=i/wh,yy=y0+(H+5-y0)*0.94*u,L=R*Math.pow(1-u,0.95)+1.2;const pitch0=-Math.min(0.45,Math.asin(Math.min(1,Math.max(0,yy-10)/L)));
    for(let j=0;j<per;j++){const phi=j/per*Math.PI*2+i*0.7,pitch=pitch0+(hash2(i,j)-.5)*0.12;q.setFromEuler(e.set(0,phi,pitch,'YZX'));p.set(0,yy,0);s.set(L,1,L);m4.compose(p,q,s);br.setMatrixAt(k,m4);col.setHSL(0.36,0.14,0.8+hash2(i,j*3)*0.2).multiplyScalar(1.25);br.setColorAt(k,col);k++;
      if((j+i)%3===0)tips.push([Math.cos(phi)*L*0.82,yy+Math.sin(pitch)*L*0.82-1.2,-Math.sin(phi)*L*0.82])}}
  br.instanceColor.needsUpdate=true;br.castShadow=br.receiveShadow=true;g.add(br);
  const radAt=yy=>{const u=Math.min(1,Math.max(0,(yy-y0)/((H+5-y0)*0.94)));return (R*Math.pow(1-u,0.95)+1.2)*0.8};
  const NB=coarse?150:220,lights=new THREE.InstancedMesh(new THREE.SphereGeometry(0.385,6,5),new THREE.MeshBasicMaterial({color:0xffffff}),NB),base=[];
  const pal=[[3,.4,.5],[3,2.3,.5],[.5,1.4,3],[.7,3,.9],[3,.9,2.4]],o=new THREE.Object3D();
  for(let i=0;i<NB;i++){const t=i/NB,yy=y0+2+t*(H+3-y0-4),ang=t*Math.PI*2*10,rr=radAt(yy);o.position.set(Math.cos(ang)*rr,yy-1,Math.sin(ang)*rr);o.scale.set(0.8,1.3,0.8);o.updateMatrix();lights.setMatrixAt(i,o.matrix);const c=new THREE.Color(...pal[i%5]);base.push(c);lights.setColorAt(i,c)}
  g.add(lights);
  const orn=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshPhysicalMaterial({roughness:.14,metalness:.45,clearcoat:1,clearcoatRoughness:.05}),tips.length),oc=[0xd0202f,0xf0b93c,0xdfe6f2,0x2a6fd6,0x1f8a52];o.scale.set(1,1,1);
  tips.forEach((tp,i)=>{if(tp[1]<10)tp[1]=10;const sc2=(1.6+hash2(i,7)*1.4)*0.57*(.42+.62*Math.sqrt(Math.max(0,1-(tp[1]-10)/38)));o.position.set(...tp);o.scale.setScalar(sc2);o.updateMatrix();orn.setMatrixAt(i,o.matrix);orn.setColorAt(i,new THREE.Color(oc[i%5]))});orn.instanceColor.needsUpdate=true;orn.castShadow=true;g.add(orn);
  const sh=new THREE.Shape();for(let i=0;i<10;i++){const rr=i%2?2.2:5.2,a=Math.PI/2+i*Math.PI/5;i?sh.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):sh.moveTo(Math.cos(a)*rr,Math.sin(a)*rr)}
  const stg=new THREE.ExtrudeGeometry(sh,{depth:1.0,bevelEnabled:true,bevelSize:.5,bevelThickness:.9,bevelSegments:1});stg.translate(0,0,-0.5);
  const star=new THREE.Mesh(stg,new THREE.MeshStandardMaterial({color:0xf0b83e,metalness:.55,roughness:.34,emissive:new THREE.Color(1.25,.72,.2),emissiveIntensity:1,flatShading:true}));star.position.y=H+7;g.add(star);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(R*5,R*5).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:dotTex,color:new THREE.Color(1.1,.62,.28),transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.y=0.6;g.add(glow);
  g.position.set(x,y,z);g.scale.setScalar(sc);par.add(g);g.updateMatrixWorld(true);
  return {lights,base,star,glow,top:g.localToWorld(new THREE.Vector3(0,H+7,0))}}

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

/* personitas (esquiadores, patinadores y gente en el telesilla): abrigo y gorro con color por instancia; el resto con colores de vértice */
function personGeos(pose){const J=[],R=[],SG=LOWQ?5:9,SB=LOWQ?3:4,col=(g,c)=>{const n=g.attributes.position.count,a=new Float32Array(n*3),cc=new THREE.Color(c);for(let i=0;i<n;i++)a.set([cc.r,cc.g,cc.b],i*3);g.setAttribute('color',new THREE.BufferAttribute(a,3));return g},
  put=(L,g,c,x,y,z,rx=0,ry=0,rz=0)=>{_m.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(rx,ry,rz)),ONE);g.applyMatrix4(_m);g=geoOnly(g);if(c!==undefined)col(g,c);L.push(g)},
  hueso=(L,c,a,b,r0,r1)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),D=B.clone().sub(A),l=D.length(),g=new THREE.CylinderGeometry(r1,r0,l,SG,1).translate(0,l/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV,D.normalize()));put(L,g,c,...a);put(L,SPH(r1,SG,SB),c,...b);if(!LOWQ)put(L,SPH(r0,SG,SB),c,...a)};
  const sit=pose==='sit',ski=pose==='ski',skate=pose==='skate',ln=ski?.2:skate?.1:0,px=y=>ln*Math.max(0,y-.55);
  // abrigo con vuelo, cuello y mangas
  put(J,new THREE.LatheGeometry([[.02,.62],[.36,.6],[.375,.66],[.31,.95],[.268,1.1],[.3,1.34],[.262,1.52],[.15,1.63],[.1,1.67]].map(([a,b])=>new THREE.Vector2(a,b)),SG+4),undefined,px(1.1)*.6,0,0,0,0,-ln*.7);
  for(const s of[-1,1]){const h=ski?[.5,1.1,s*.42]:skate?[-.18,1.02,s*.5]:[.1+.05*s,.98,s*.4],c=ski?[.28,1.18,s*.44]:skate?[.02,1.22,s*.46]:[.02,1.22,s*.42];hueso(J,undefined,[px(1.5),1.47,s*.24],c,.1,.085);hueso(J,undefined,c,h,.085,.075);put(R,SPH(.085,SG,SB),0x2a2a30,...h)}
  // gorro con vuelta y borla
  put(J,new THREE.SphereGeometry(.222,SG+3,7,0,6.2832,0,1.7).scale(1,1.12,1),undefined,px(1.9),1.9,0,0,0,-ln*.4);put(R,TOR(.205,.05,SG+5),0xf2efe8,px(1.9)+.004,1.885,0,Math.PI/2,0,0);put(R,SPH(.075,7,5),0xf2efe8,px(2.15)-.01,2.17,0);
  put(R,SPH(.2,SG+3,LOWQ?6:8).scale(.96,1.08,.95),0xeebf9d,px(1.8)+.01,1.8,0);put(R,SPH(.032,6,5),0xe0a07e,px(1.8)+.205,1.79,0);for(const s of[-1,1]){put(R,SPH(.02,4,3),0x241812,px(1.8)+.188,1.835,s*.07);if(LOWQ)continue;put(R,SPH(.045,6,5).scale(.5,.8,1),0xdf8f7c,px(1.8)+.172,1.765,s*.1);put(R,SPH(.055,6,5),0xe4b090,px(1.8),1.8,s*.19)}put(R,SPH(.195,SG,7).scale(.9,.95,1),0x4a2e1c,px(1.8)-.045,1.8,0);
  put(R,TOR(.15,.062,SG+3).scale(1,1,.9),0xd9c9a4,px(1.65),1.645,0,Math.PI/2,0,0);put(R,BX(.06,.34,.11),0xd9c9a4,px(1.5)+.27,1.47,.08,0,0,.2);
  for(const s of[-1,1]){const z=s*.13;if(sit){hueso(R,0x2a3140,[.02,.8,z],[.52,.84,z],.12,.105);hueso(R,0x2a3140,[.52,.84,z],[.56,.4,z],.1,.085);put(R,SPH(.12,SG,6).scale(1.5,.75,1),0x3a281c,.62,.32,z)}
    else{const f=skate?[s*.16,.1]:ski?[.02,.1]:[.015*s,.1],k=ski?.16:skate?.1:.02;hueso(R,0x2a3140,[0,.72,z],[k,.4,z*1.05],.125,.1);hueso(R,0x2a3140,[k,.4,z*1.05],[f[0],.14,z],.1,.085);put(R,SPH(.115,SG,6).scale(1.55,.85,1),0x3a281c,f[0]+.06,.11,z)}
    if(ski){put(R,BX(1.75,.035,.11),0xc8182c,.2,.03,z*1.2);put(R,CY(.018,.018,1.25,4),0x30343c,.6,.6,s*.48,0,0,.45)}else if(skate)put(R,BX(.36,.07,.03),0xdfe6f2,s*.16+.05,.03,z)}
  const j=mergeGeometries(J,false),r=mergeGeometries(R,false);if(sit){j.translate(0,-0.92,0);r.translate(0,-0.92,0)}return {j,r}}
const JACKETS=[0xc8182c,0x1f6fd6,0x1f8a52,0xf0b93c,0x7d4f72,0xe8e2d4,0xff7a2e,0x2a2f3a];
function crowd(pose,n,par){const g=personGeos(pose),jm=new THREE.InstancedMesh(g.j,M.person,n),rm=new THREE.InstancedMesh(g.r,M.personV,n);for(let i=0;i<n;i++)jm.setColorAt(i,new THREE.Color(JACKETS[(i*3+pose.length)%JACKETS.length]));jm.instanceColor.needsUpdate=true;
  jm.userData.con=[rm];[jm,rm].forEach(m=>{m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;par.add(m)});return {jm,rm,n}}

/* ---------- casas ---------- */
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

/* ---------- marcas en los costados ---------- */
const AD_W=1024,AD_H=352,maxAniso=8;
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
    const fit=(txt,font,max,min)=>{g.font=font.replace('#',max);const w=g.measureText(txt).width;return w<=mw?max:Math.max(min,Math.floor(max*mw/w))};
    if(ad.text){const s=fit(ad.text,'400 #px "Alfa Slab One", Georgia, serif',ad.sub?88:100,30);g.font=`400 ${s}px "Alfa Slab One", Georgia, serif`;g.fillText(ad.text,cx,ad.sub?h*0.41:h/2+4,mw)}
    if(ad.sub){g.globalAlpha=.85;const s=fit(ad.sub,'500 #px Rubik, system-ui, sans-serif',42,20);g.font=`500 ${s}px Rubik, system-ui, sans-serif`;g.fillText(ad.sub,cx,ad.text?h*0.68:h/2,mw);g.globalAlpha=1}}
  if(ad.host){g.font='600 25px Rubik, system-ui, sans-serif';g.textAlign='right';g.textBaseline='alphabetic';g.fillStyle=light?'rgba(43,26,18,.72)':'rgba(251,243,223,.78)';g.fillText(ad.host,w-44,h-34)}
  if(ad.tag){g.font='700 22px Rubik, system-ui, sans-serif';const tw=g.measureText(ad.tag).width+28;g.fillStyle='rgba(0,0,0,.35)';rrect(g,w-36-tw,26,tw,34,17);g.fill();g.fillStyle='#fbf3df';g.textAlign='center';g.textBaseline='middle';g.fillText(ad.tag,w-36-tw/2,44)}}
const imgCache=new Map();
function loadImg(src){if(!src)return Promise.resolve(null);if(imgCache.has(src))return imgCache.get(src);const p=new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src});imgCache.set(src,p);return p}
const adTex=cv=>{const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=maxAniso;return t};
const logoURL=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#fbf3df';g.beginPath();g.arc(128,128,118,0,7);g.fill();g.fillStyle='#1d3a78';g.beginPath();g.arc(128,128,100,0,7);g.fill();
  g.fillStyle='#e0ad45';g.beginPath();for(let k=0;k<10;k++){const r=k%2?34:82,a=-Math.PI/2+k*Math.PI/5;g.lineTo(128+Math.cos(a)*r,128+Math.sin(a)*r)}g.closePath();g.fill();return c.toDataURL('image/png')})();

export {uvCaja,gastado,THREE,CUT,cutMat,mergeGeometries,rng,sstep,lerp,clamp,hash2,vnoise,fbm,tick,texCache,canvasTex,pixTex,rep,dotTex,woodTex,plankTex,snowNrm,winTex,signTex,caneTex,WRAPS,phTex,blobTex,puffTex,coneTex,stoneTex,
  M,HCOL,HMAT,box,cyl,o3,boxU,MD,flat,inst,obj,mergeMeshes,GAUGE,RT,WB,WS,WLEN,WHALF,WTOP,PANEL,PANEL_Y,PANEL_W,PANEL_H,TM,part,geoOnly,fuse,BX,CY,CYX,TOR,DOME,PLN,SPH,roofGeo,ringGeo,bigWheelGeos,smallWheelGeos,wagonGeos,buildLoco,buildTender,buildCaboose,
  buildTree,santaFig,personGeos,JACKETS,crowd,house,AD_W,AD_H,AD_BG,rrect,hostOf,drawAd,loadImg,adTex,logoURL,UPV,ZAX,ONE,QFLIP};
/* bombilla encendida: el filamento arde en el centro y el cristal se apaga hacia el borde */
export const bombilla = (m, k = 1) => {m.onBeforeCompile = s => {s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNb,vVb;').replace('#include <project_vertex>', '#include <project_vertex>\nvec3 nbO=normal;\n#ifdef USE_INSTANCING\nnbO=mat3(instanceMatrix)*nbO;\n#endif\nvNb=normalMatrix*nbO;vVb=-mvPosition.xyz;'); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNb,vVb;').replace('#include <opaque_fragment>', `{float nv=clamp(dot(normalize(vNb),normalize(vVb)),0.,1.);outgoingLight*=mix(.34,1.25,pow(nv,1.6))+${(1.4 * k).toFixed(2)}*pow(nv,18.);outgoingLight+=dot(outgoingLight,vec3(.33))*.25*pow(nv,10.);}\n#include <opaque_fragment>`)}; m.customProgramCacheKey = () => 'bomb' + k; m.userData.solo = true; return m};
/* píxeles por unidad a distancia 1 (lo pone la cámara en cada fotograma) */
export const BOMB_KPX = {value: 900};
/* bombillas lejanas (o en el móvil): un punto redondo con el filamento en el centro en vez de una esfera; pon(i, x, y, z, color) */
export function bombillasP(n, {tam = .95, niebla = true} = {}) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('instC', new THREE.BufferAttribute(c, 3));
  const m = new THREE.ShaderMaterial({fog: niebla, uniforms: {color: {value: new THREE.Color(1, 1, 1)}, tam: {value: tam}, kpx: BOMB_KPX, fogColor: {value: new THREE.Color()}, fogNear: {value: 1}, fogFar: {value: 2}}, vertexShader: `uniform float tam,kpx;uniform vec3 color;attribute vec3 instC;varying vec3 vC;
#include <fog_pars_vertex>
void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;float s=2.2*tam*length(modelMatrix[0].xyz)*kpx/max(1.,-mvPosition.z),q=clamp(s,1.7,64.);gl_PointSize=q;vC=color*instC*min(1.,s*s/(q*q));
#include <fog_vertex>
}`, fragmentShader: `varying vec3 vC;
#include <fog_pars_fragment>
void main(){vec2 q=gl_PointCoord*2.-1.;float r=dot(q,q);if(r>1.)discard;float nv=sqrt(1.-r);gl_FragColor=vec4(vC*(mix(.34,1.25,nv*sqrt(nv))+1.4*pow(nv,18.)),1.);
#include <fog_fragment>
}`});
  m.userData.solo = true; const q = new THREE.Points(g, m); q.frustumCulled = false; q.pon = (i, x, y, z, col) => {p.set([x, y, z], i * 3); c.set([col.r, col.g, col.b], i * 3)}; return q;
}

/* manchas y huellas pegadas al suelo: se acercan un poco a la cámara sin moverse de sitio en pantalla, para que no las corten los bultos de la nieve */
export const pegada=(m,d=3)=>{m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nmvPosition.xyz*=1.-'+d.toFixed(1)+'/max(length(mvPosition.xyz),'+(d*3).toFixed(1)+');gl_Position=projectionMatrix*mvPosition;')};m.customProgramCacheKey=()=>'peg'+d;return m};

/* ---------- geometría deprisa ----------
   Las maquetas se montan a base de miles de piezas pequeñas: estas tres operaciones de three van elemento a elemento y se llevaban la mitad
   del tiempo. Aquí recorren los números directamente; lo raro (atributos entrelazados, morphs, tangentes) sigue por el camino de siempre. */
{
  const B = THREE.BufferGeometry.prototype, m0 = B.applyMatrix4, v0 = B.computeVertexNormals, i0 = B.toNonIndexed, llano = a => !a || (a.isBufferAttribute && !a.isInterleavedBufferAttribute && !a.normalized && a.array instanceof Float32Array), NM = new THREE.Matrix3();
  B.applyMatrix4 = function (M) {
    const p = this.attributes.position, n = this.attributes.normal, e = M.elements; if (!p || !llano(p) || !llano(n) || this.attributes.tangent || e[3] || e[7] || e[11] || e[15] !== 1) return m0.call(this, M);
    const a = p.array, [x0, x1, x2, , y0, y1, y2, , z0, z1, z2, , t0, t1, t2] = e; for (let i = 0, l = a.length; i < l; i += 3) {const x = a[i], y = a[i + 1], z = a[i + 2]; a[i] = x0 * x + y0 * y + z0 * z + t0; a[i + 1] = x1 * x + y1 * y + z1 * z + t1; a[i + 2] = x2 * x + y2 * y + z2 * z + t2} p.needsUpdate = true;
    if (n) {const b = n.array, [a0, a1, a2, b0, b1, b2, c0, c1, c2] = NM.getNormalMatrix(M).elements; for (let i = 0, l = b.length; i < l; i += 3) {const x = b[i], y = b[i + 1], z = b[i + 2], u = a0 * x + b0 * y + c0 * z, v = a1 * x + b1 * y + c1 * z, w = a2 * x + b2 * y + c2 * z, q = 1 / (Math.sqrt(u * u + v * v + w * w) || 1); b[i] = u * q; b[i + 1] = v * q; b[i + 2] = w * q} n.needsUpdate = true}
    if (this.boundingBox !== null) this.computeBoundingBox(); if (this.boundingSphere !== null) this.computeBoundingSphere(); return this;
  };
  B.computeVertexNormals = function () {
    const p = this.attributes.position; if (!p || !llano(p) || !llano(this.attributes.normal)) return v0.call(this); let n = this.attributes.normal; if (!n) this.setAttribute('normal', n = new THREE.BufferAttribute(new Float32Array(p.count * 3), 3)); const a = p.array, b = n.array, ix = this.index && this.index.array, N = ix ? ix.length : p.count; b.fill(0);
    for (let i = 0; i < N; i += 3) {const A = (ix ? ix[i] : i) * 3, C = (ix ? ix[i + 1] : i + 1) * 3, D = (ix ? ix[i + 2] : i + 2) * 3, ux = a[D] - a[C], uy = a[D + 1] - a[C + 1], uz = a[D + 2] - a[C + 2], vx = a[A] - a[C], vy = a[A + 1] - a[C + 1], vz = a[A + 2] - a[C + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; b[A] += nx; b[A + 1] += ny; b[A + 2] += nz; b[C] += nx; b[C + 1] += ny; b[C + 2] += nz; b[D] += nx; b[D + 1] += ny; b[D + 2] += nz}
    for (let i = 0, l = b.length; i < l; i += 3) {const x = b[i], y = b[i + 1], z = b[i + 2], q = 1 / (Math.sqrt(x * x + y * y + z * z) || 1); b[i] = x * q; b[i + 1] = y * q; b[i + 2] = z * q} n.needsUpdate = true;
  };
  B.toNonIndexed = function () {
    if (!this.index || this.groups.length > 1) return i0.call(this); for (const k in this.morphAttributes) if (this.morphAttributes[k]) return i0.call(this); for (const k in this.attributes) if (this.attributes[k].isInterleavedBufferAttribute) return i0.call(this);
    const ix = this.index.array, N = ix.length, g = new THREE.BufferGeometry(); for (const k in this.attributes) {const q = this.attributes[k], w = q.itemSize, a = q.array, b = new a.constructor(N * w); if (w === 3) for (let i = 0, o = 0; i < N; i++) {const j = ix[i] * 3; b[o++] = a[j]; b[o++] = a[j + 1]; b[o++] = a[j + 2]} else if (w === 2) for (let i = 0, o = 0; i < N; i++) {const j = ix[i] * 2; b[o++] = a[j]; b[o++] = a[j + 1]} else for (let i = 0, o = 0; i < N; i++) for (let c = 0, j = ix[i] * w; c < w; c++) b[o++] = a[j + c]; g.setAttribute(k, new THREE.BufferAttribute(b, w, q.normalized))} return g;
  };
}
/* ruido en el móvil: una textura de 64³ en lugar de ocho cuentas por punto (y los niveles de la textura lo suavizan de lejos, sin hormigueo) */
export const T3R = {value: null}; if (LOWQ) {const n = 64, d = new Uint8Array(n * n * n), r = rng(77); for (let i = 0; i < d.length; i++) d[i] = r() * 256; const t = new THREE.Data3DTexture(d, n, n, n); t.format = THREE.RedFormat; t.unpackAlignment = 1; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; T3R.value = t}
export const RUIDO3 = 'uniform sampler3D t3R;float hR(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}float nR(vec3 x){return texture(t3R,x*.015625+.0078125).r;}';
