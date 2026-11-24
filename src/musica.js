/* Sonido: villancicos de caja de música (dominio público, sintetizados), pasos en la nieve, campanillas y silbato. Sale de tren.js.
   De lejos la música se oye apagada, como al otro lado del cristal; al acercarse al escaparate se aclara (setCerca). */
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
let ac=null,acP=null,sfx=store.get('advx-sonido')!=='0',music=sfx,cerca=0;
/* el contexto tarda ~80 ms en crearse: se hace antes de tocar nada, parado */
export function prepAu(){setTimeout(()=>{if(!ac&&!acP)try{acP=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}},60)}
function au(){if(!ac){try{ac=acP||new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume().catch(()=>{});return ac}
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
let mus=null,filt=null;
function musInit(){if(mus||!ac)return;const out=ac.createGain();out.gain.value=0;const dry=ac.createGain();dry.gain.value=.85;const wet=ac.createGain();wet.gain.value=.5;const conv=ac.createConvolver();
  const len=Math.floor(ac.sampleRate*2.8),ir=ac.createBuffer(2,len,ac.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}conv.buffer=ir;
  const comp=ac.createDynamicsCompressor();out.connect(dry);dry.connect(comp);out.connect(conv);conv.connect(wet);wet.connect(comp);filt=ac.createBiquadFilter();filt.type='lowpass';filt.frequency.value=700;comp.connect(filt);filt.connect(ac.destination);
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
  mus.out.gain.setTargetAtTime(music&&!callado?0.34+0.3*cerca:0,ac.currentTime,0.8);filt.frequency.setTargetAtTime(650+9000*cerca*cerca,ac.currentTime,0.7);
  if(!music){mus.start=ac.currentTime+0.5;mus.i=0;return}
  if(mus.start<ac.currentTime-0.5&&mus.i===0)mus.start=ac.currentTime+0.1;
  const hor=ac.currentTime+0.3;
  while(mus.i<mus.ev.length&&mus.start+mus.ev[mus.i].t<hor){const e=mus.ev[mus.i++],t=Math.max(ac.currentTime,mus.start+e.t);if(e.k==='l')vLead(t,e.n,e.d);else if(e.k==='c')vChord(t,e);else vSleigh(t,e.a,e.v)}
  if(mus.i>=mus.ev.length){mus.start+=mus.L+1.2;mus.song=(mus.song+1)%SONGS.length;loadSong()}}
setInterval(musicTick,60);

export const pasos=k=>{if(!sfx||!ac)return;noise(.09,.028*k,1900,'bandpass');noise(.05,.018*k,5200,'highpass')};
export const traqueteo=k=>{if(!sfx||!ac||k<.02)return;noise(.05,.03*k,420);setTimeout(()=>noise(.05,.022*k,380),110)};
export const setCerca=v=>{cerca=v};
/* efectos de la historia */
let callado=false;export const silencio=v=>{callado=v};
export const campana=(n=1)=>{for(let i=0;i<n;i++)[392,588,784,1046].forEach((f,k)=>tone(f,1.8,'sine',.06/(k+1),i*.75))};
export const suave=()=>{[784,988,1175].forEach((f,i)=>tone(f,.9,'sine',.035,i*.11))};
export const viento=()=>{if(!sfx||!ac)return;noise(3.4,.05,520);noise(3.8,.03,900,'bandpass')};
export const clac=()=>{noise(.06,.16,3200,'bandpass');noise(.05,.1,900)};
export const chuf=()=>{noise(.2,.05,900)};
export const trenSuena=()=>{for(let i=0;i<6;i++)setTimeout(()=>noise(.18,.06,700),i*260)};
export const sonidoOn=()=>sfx;
export function setSonido(on){sfx=music=on;store.set('advx-sonido',on?'1':'0');if(on)au()}
export {au,tone,noise,chime,bells,whistle};
