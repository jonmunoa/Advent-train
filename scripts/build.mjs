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
const KEEP = ['index.html', 'idle.html', 'tren.html', 'escaparates.html', 'favicon.svg', 'og.jpg', 'og-escaparates.jpg', 'src', 'm'];
// La portada es La calle de los trenes (escaparates.html); el juego de carreras pasa a adviento.html (vercel.json manda /escaparates.html a /)
const PAGES = {'escaparates.html': 'index.html', 'index.html': 'adviento.html'};
const env = process.env;

rmSync(out, {recursive: true, force: true});
mkdirSync(out);
for (const f of KEEP) {const p = join(root, f); if (!existsSync(p)) throw new Error('falta ' + f); cpSync(p, join(out, PAGES[f] || f), {recursive: true})}

const base = (await import(pathToFileURL(join(root, 'config.js')).href)).default;
let site = env.ADVX_SITE_URL || base.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : '');
if (site && !site.endsWith('/')) site += '/';
const cfg = {
  TAG: env.ADVX_TAG || base.TAG,
  SITE_URL: site && site + 'adviento.html',   // solo la usa el juego de carreras (enlaces de reto)
  SUPABASE_URL: env.SUPABASE_URL || base.SUPABASE_URL,
  SUPABASE_KEY: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || base.SUPABASE_KEY,
};
if (cfg.SUPABASE_URL && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.SUPABASE_URL) && !env.ADVX_ALLOW_ANY_SUPABASE) throw new Error('SUPABASE_URL no parece una URL de proyecto: ' + cfg.SUPABASE_URL);
writeFileSync(join(out, 'config.js'), '// Generado por scripts/build.mjs\nexport default ' + JSON.stringify(cfg, null, 2) + ';\n');

/* WhatsApp y compañía quieren direcciones absolutas en las etiquetas para compartir */
for (const page of ['index.html', 'adviento.html']) {
  let html = readFileSync(join(out, page), 'utf8');
  if (site) html = html.replace('<meta property="og:url" content="">', `<meta property="og:url" content="${site}${page === 'index.html' ? '' : page}">`)
    .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")([^"/]+\.jpg)">/g, `$1${site}$2">`);
  writeFileSync(join(out, page), html);
}

console.log(`dist/ listo · TAG ${cfg.TAG === 'TU-TAG-21' ? 'DE MARCADOR (pon ADVX_TAG)' : 'ok'} · SITE_URL ${site || '(la actual)'} · Supabase ${cfg.SUPABASE_URL && cfg.SUPABASE_KEY ? 'sí' : 'no (ranking local)'}`);
