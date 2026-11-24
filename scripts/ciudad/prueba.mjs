import {bloque} from './calle.mjs';
const t=Date.now(), O=await bloque(); const c={}; let n=0; for(const q of O.P){c[q.mat]=(c[q.mat]||0)+q.p.length/9; n+=q.p.length/9}
console.log(Math.round(n),'tri',O.P.length,'piezas',O.luces.length,'luces',O.ventanas.length,'ventanas',O.bombillas.length,'bombillas',O.guirnaldas.length,'guirnaldas',Date.now()-t,'ms'); console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+Math.round(v)).join(', '));
