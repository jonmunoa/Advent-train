/* Acabados: de qué está hecho cada color liso de las maquetas (madera, cuero, fieltro, pan, ladrillo, latón, papel, cal, piedra, caramelo, lana, teja…).
   Cada material lleva su número en userData.ac; al juntar la geometría viaja en el atributo «ac» (número, nieve que se le posa, pie enterrado) y el
   sombreador dibuja el detalle: vetas, hiladas, corteza, pelusa, cepillado… y la nieve de encima y la del pie. Vale para los cubos de esc-geo.js,
   para los materiales sueltos (lo que se mueve) y, en el móvil, para MATE (esc-ligero.js). */
import {THREE, LOWQ, cutMat} from './kit.js';

export const AC = {nada: 0, madera: 1, cuero: 2, fieltro: 3, pan: 4, ladrillo: 5, metal: 6, papel: 7, cal: 8, piedra: 9, caramelo: 10, lana: 11, teja: 12, tela: 13, laca: 14};
export const ACABADO_GLSL = `
/* k: acabado; p: posición; n: normal (de la maqueta); px: lo que mide un píxel ahí; da el relieve */
float acabado(int k,vec3 p,vec3 n,float px,inout vec3 c,inout float ru,inout float me){
  vec3 a=abs(n);vec2 q=a.y>.7?p.xz:(a.x>a.z?p.zy:p.xy);float f1=smoothstep(.5,.12,px),f2=smoothstep(.16,.04,px),f3=smoothstep(.055,.014,px),h=0.;
  if(k==1){float w=1.1,id=floor(q.x/w),f=fract(q.x/w),ln=mix(1.,smoothstep(0.,.06,f)*smoothstep(1.,.94,f),f1),g=nR(vec3(q.x*7.+id*7.,q.y*.8+id*13.,id)),g2=mix(.5,nR(vec3(q.x*24.,q.y*1.6+id*5.,id+3.)),f2);c*=.7+.24*hR(vec3(id,3.,1.))+.2*g+.24*(g2-.2);c=mix(c*.34,c,ln);h=ln*.7+g2*.22;ru=clamp(ru+.06-.2*g,.3,1.);}
  else if(k==2){float m=nR(p*2.2),g=mix(.5,nR(p*17.),f3),e=mix(.5,nR(p*7.),f2),ar=smoothstep(.56,.5,abs(nR(p*vec3(1.6,3.,1.6))-.5)*2.+.42);c*=.7+.34*m+.16*(g-.5);c=mix(c,c*.5,.5*(1.-ar)*f2);c=mix(c,c*1.35+.012,smoothstep(.62,.86,e)*.35);ru=clamp(.36+.26*m+.1*g,.2,.9);h=g*.35+e*.3;}
  else if(k==3){float m=nR(p*1.4),g=mix(.5,nR(p*15.),f3),e=mix(.5,nR(p*5.),f2);c*=.82+.2*m+.22*(g-.5)+.16*(e-.5);ru=1.;h=g*.5+e*.2;}
  else if(k==4){float m=nR(p*1.1),e=nR(p*3.7),g=mix(.5,nR(p*13.),f3),t=m*.45+e*.3+n.y*.28+.12;c=mix(vec3(.2,.075,.02),c*1.1,smoothstep(.12,.72,t));c*=.86+.28*(g-.5)+.1;float hr=smoothstep(.5,.78,nR(p*2.3+9.)*.6+n.y*.38+.3*(g-.5)+.12);c=mix(c,vec3(.8,.73,.62),hr*.7);ru=.82+.12*g;h=e*.5+g*.45;}
  else if(k==5||k==9){vec2 t=k==5?vec2(1.15,.5):vec2(2.1,1.05),b=q/t;b.x+=.5*mod(floor(b.y),2.)+(k==9?.3*hR(vec3(floor(b.y),7.,3.)):0.);vec2 id=floor(b),f=fract(b);float j=a.y>.7?1.:min(smoothstep(0.,.07,f.x)*smoothstep(1.,.93,f.x),smoothstep(0.,.14,f.y)*smoothstep(1.,.86,f.y)),r=hR(vec3(id,k==5?1.:5.)),g=mix(.5,nR(p*9.),f2);j=mix(.85,j,f1);c*=(k==5?.62+.6*r:.72+.42*r)*(.84+.3*g);if(k==9)c*=mix(vec3(1.04,.99,.93),vec3(.95,.98,1.05),hR(vec3(id,9.)));c=mix(k==5?vec3(.4,.37,.34):c*.45,c,j);ru=.93;h=j*.8+g*.25;}
  else if(k==6){float m=nR(p*1.3),g=mix(.5,nR(vec3(q.x*30.,q.y*2.,1.)),f3),o=smoothstep(.55,.82,nR(p*2.9)*.65+m*.35);c*=.74+.34*m+.12*(g-.5);c=mix(c,c*vec3(.36,.42,.4),o*.55);ru=clamp(.24+.2*m+.14*g+.3*o,.16,.8);h=g*.12+o*.1;}
  else if(k==7){if(a.y<.6){float l=mix(.5,hR(vec3(floor(q.y*11.),floor(q.x*.7),2.)),f2),o=mix(.5,nR(vec3(q.x*.8,q.y*11.,4.)),f2);c*=.72+.2*l+.2*o;h=l*.4;}else{c*=.93+.1*nR(p*1.2)+.05*nR(p*6.);}ru=.97;}
  else if(k==8){float m=nR(p*.9),s=nR(vec3(q.x*1.9,q.y*.22,2.)),g=mix(.5,nR(p*6.),f2);c*=.86+.18*m+.1*(g-.5);c*=mix(vec3(1.),vec3(.78,.76,.7),smoothstep(.5,.86,s)*.8);float ds=smoothstep(.66,.74,nR(p*.55+3.)*.6+nR(p*1.9)*.4);c=mix(c,c*vec3(.62,.54,.46),ds*.75);ru=.95;h=g*.35+m*.3-ds*.4;}
  else if(k==10){float m=nR(p*1.2),g=mix(0.,step(.965,hR(floor(p*13.))),f3);c*=.9+.16*m;c+=g*.14;ru=clamp(ru-.1+.12*m,.16,.7);h=m*.1;}
  else if(k==11){float m=nR(p*.55),b=nR(p*.35+5.);vec3 d=b>.55?vec3(.62,.6,.5):b>.38?vec3(.55,-.62,.56):vec3(-.6,.2,.77);float s=sin((dot(p,d)+m*1.1)*17.),u=mix(0.,s,smoothstep(.22,.06,px)),t=mix(.5,nR(p*19.),f3);c*=.72+.26*(u*.5+.5)+.2*(t-.5)+.08*m;ru=1.;h=(u*.5+.5)*.75+t*.15;}
  else if(k==12){float r=p.y*1.25+.04*nR(p*4.),co=(a.x>a.z?p.z:p.x)*.95+.5*mod(floor(r),2.),id=hR(vec3(floor(co),floor(r),2.)),f=fract(r),x=abs(fract(co)-.5);float e=mix(.6,f-x*x*.9,f1);c*=(.58+.34*id)*(.62+.5*e);ru=.8;h=e*.8;}
  else if(k==13){float m=nR(p*1.1),w=mix(.5,.5+.25*sin(q.x*38.)+.25*sin(q.y*38.),f3),e=nR(p*.45);c*=.8+.18*m+.16*(w-.5)+.12*e;ru=1.;h=w*.35+m*.2;}
  else if(k==14){float m=nR(p*1.5),g=mix(.5,nR(p*8.),f2);c*=.9+.14*m;c=mix(c,c*.72,smoothstep(.7,.9,nR(p*4.1))*.3);ru=clamp(ru-.05+.12*g,.12,.9);h=g*.05;}
  else{float m=nR(p*1.3),g=mix(.5,nR(p*7.),f2);c*=.9+.14*m+.08*(g-.5);ru=clamp(ru+.1*(g-.5),.05,1.);h=g*.1;}
  return h;
}
/* nieve: la que cae encima (nv 0–1) y la que se amontona al pie (h: altura sobre el suelo) */
float nieveAc(vec3 p,vec3 n,float nv,float h){if(nv<.004)return 0.;float r=nR(p*1.7)*.6+nR(p*5.3)*.4;float s=smoothstep(.56,.8,n.y+(r-.5)*.34)*smoothstep(0.,.3,nv*1.3-r*.95);float b=smoothstep(.2,.6,.62-h*.75+(r-.5)*.5);return max(s,b);}
`;
/* deja un material liso con su acabado: n de AC; nieve: cuánta se le posa (0 para lo que está bajo techo o se mueve mucho) */
export function acaba(m, n, nieve = .8) {m.userData.ac = n; m.userData.nv = nieve; if (!LOWQ) parchea(m, 'const int acK=' + n + ';const float acN=0.,acP=99.;', 'vAp3=position;vAn3=normal;', 'sa' + n); return m}
const VERT = 'varying vec3 vAp3,vAn3;';
export const RUIDO_AC = 'float hR(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}float nR(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hR(i),hR(i+vec3(1,0,0)),f.x),mix(hR(i+vec3(0,1,0)),hR(i+vec3(1,1,0)),f.x),f.y),mix(mix(hR(i+vec3(0,0,1)),hR(i+vec3(1,0,1)),f.x),mix(hR(i+vec3(0,1,1)),hR(i+vec3(1,1,1)),f.x),f.y),f.z);}';
/* añade el acabado a un material de three; pre: de dónde salen acK, acN y acP */
export function parchea(m, pre, vert, clave, varyings = '') {
  const vA = varyings === 'VAC'; varyings = vA ? 'varying vec3 vAc;' : varyings;
  const f0 = m.onBeforeCompile, t0 = String(m.customProgramCacheKey()); let h0 = 7; for (let i = 0; i < t0.length; i++) h0 = h0 * 31 + t0.charCodeAt(i) | 0;
  m.onBeforeCompile = function (s, r) {
    f0.call(this, s, r); s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + VERT + (vA ? 'attribute vec3 ac;' : '') + varyings).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vert);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + VERT + varyings + (s.fragmentShader.includes('float nR(') ? '' : RUIDO_AC) + ACABADO_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${pre}float acH=0.,acR=roughness,acM=0.,acS=0.;{vec3 an=normalize(vAn3);float px=length(fwidth(vAp3));acH=acabado(acK,vAp3,an,px,diffuseColor.rgb,acR,acM);if(acN>.004){acS=nieveAc(vAp3,an,acN,acP);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.885,.96)*(.95+.07*nR(vAp3*5.)),acS);acR=mix(acR,.84,acS);acH=mix(acH*smoothstep(.22,.05,px),.5*nR(vAp3*3.),acS);}else acH*=smoothstep(.22,.05,px);}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=acR;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor=metalness*(1.-acS);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),R1=cross(sy,normal),R2=cross(normal,sx);float dt=dot(sx,R1);vec3 g=sign(dt)*(dFdx(acH)*R1+dFdy(acH)*R2)*.075;vec3 nn=abs(dt)*normal-g;if(dot(nn,nn)>1e-12)normal=normalize(nn);}');
  };
  m.customProgramCacheKey = () => 'cut' + h0 + '|' + clave; return m;
}
