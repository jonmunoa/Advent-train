// Copia src/sim.js a supabase/functions/_shared/sim.js (la Edge Function no puede importar
// fuera de supabase/functions al desplegar). `--check` solo comprueba que son iguales.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src/sim.js'), dst = resolve(root, 'supabase/functions/_shared/sim.js');
const norm = s => s.replace(/\r\n/g, '\n');
const a = norm(readFileSync(src, 'utf8'));
let b = ''; try {b = norm(readFileSync(dst, 'utf8'))} catch {}

if (process.argv.includes('--check')) {
  if (a !== b) {console.error('supabase/functions/_shared/sim.js no coincide con src/sim.js: ejecuta node scripts/sync-shared.mjs'); process.exit(1)}
  console.log('sim.js sincronizado');
} else {
  mkdirSync(dirname(dst), {recursive: true});
  writeFileSync(dst, a);
  console.log('copiado a', dst);
}
