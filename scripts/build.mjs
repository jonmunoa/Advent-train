// Build de despliegue (Vercel): copia la web estática a dist/ y genera dist/config.js
// desde variables de entorno. No compila nada: el juego sigue siendo módulos ES y three.js
// por importmap. Sin dependencias.
//   ADVX_TAG, ADVX_SITE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (o SUPABASE_ANON_KEY)
// Si falta una variable se usa el valor de config.js. ADVX_SITE_URL vacío → la URL de
// producción de Vercel (VERCEL_PROJECT_PRODUCTION_URL) para las etiquetas Open Graph.
import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'dist');
const KEEP = ['index.html', 'idle.html', 'favicon.svg', 'og.jpg', 'src', 'm'];
const env = process.env;

rmSync(out, {recursive: true, force: true});
mkdirSync(out);
for (const f of KEEP) {const p = join(root, f); if (!existsSync(p)) throw new Error('falta ' + f); cpSync(p, join(out, f), {recursive: true})}

const base = (await import(pathToFileURL(join(root, 'config.js')).href)).default;
let site = env.ADVX_SITE_URL || base.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : '');
if (site && !site.endsWith('/')) site += '/';
const cfg = {
  TAG: env.ADVX_TAG || base.TAG,
  SITE_URL: site,
  SUPABASE_URL: env.SUPABASE_URL || base.SUPABASE_URL,
  SUPABASE_KEY: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || base.SUPABASE_KEY,
};
if (cfg.SUPABASE_URL && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.SUPABASE_URL) && !env.ADVX_ALLOW_ANY_SUPABASE) throw new Error('SUPABASE_URL no parece una URL de proyecto: ' + cfg.SUPABASE_URL);
writeFileSync(join(out, 'config.js'), '// Generado por scripts/build.mjs\nexport default ' + JSON.stringify(cfg, null, 2) + ';\n');

let html = readFileSync(join(out, 'index.html'), 'utf8');
if (site) html = html.replace('<meta property="og:url" content="">', `<meta property="og:url" content="${site}">`)
  .replace('<meta property="og:image" content="og.jpg">', `<meta property="og:image" content="${site}og.jpg">`)
  .replace('<meta name="twitter:image" content="og.jpg">', `<meta name="twitter:image" content="${site}og.jpg">`);
writeFileSync(join(out, 'index.html'), html);

console.log(`dist/ listo · TAG ${cfg.TAG === 'TU-TAG-21' ? 'DE MARCADOR (pon ADVX_TAG)' : 'ok'} · SITE_URL ${site || '(la actual)'} · Supabase ${cfg.SUPABASE_URL && cfg.SUPABASE_KEY ? 'sí' : 'no (ranking local)'}`);
