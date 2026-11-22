#!/usr/bin/env python3
"""Prueba de humo end-to-end con Playwright (Chromium).

Abre el calendario, pulsa la puerta de hoy, espera al billete, arranca la carrera
y la completa con un "maquinista bot" usando el hook window.__adv de src/main.js.
Después comprueba las mecánicas una a una (regalos que se caen, etc.).
Falla si hay errores de JavaScript, recursos 404 o alguna comprobación no se cumple.

Uso:
  pip install playwright && python -m playwright install chromium
  python tests/e2e.py                 # sirve el repo en :8765 y prueba
  python tests/e2e.py --shots         # además guarda capturas en tests/out/
  python tests/e2e.py --gpu           # usa la GPU real en vez de SwiftShader (más rápido)
  THREE_LOCAL=node_modules/three python tests/e2e.py   # sin internet: sirve three.js local

Por defecto usa SwiftShader (CPU): más lento pero igual en cualquier máquina.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
from harness import OUT, serve, chromium_args, route_local_three

sys.stdout.reconfigure(encoding='utf-8')
PORT = 8765
SHOTS = '--shots' in sys.argv
GPU = '--gpu' in sys.argv

# maquinista bot: salida perfecta, va al 97 % de la envolvente y gasta el turbo cuando renta
BOT = """(()=>{const A=__adv;for(let k=0;k<60000;k++){const G=A.G;if(A.mode==='finish'||A.mode==='end')break;
 if(A.mode==='race'&&A.turboGood())A.turbo();A.step(1/60,A.mode==='race'&&G.v<A.vsAhead(G.dist)*0.97)}
 for(let i=0;i<200;i++)A.step(1/30);const G=A.G;return {mode:A.mode,time:+G.time.toFixed(1),total:+(G.total||0).toFixed(1),bells:G.bells,lost:G.lost,gifts:A.giftsOn(),turbos:G.turbos,med:A.MED}})()"""

# acelera a fondo hasta perder un regalo; luego suelta y asienta la cámara para la captura
OVERSPEED = """(()=>{const A=__adv;for(let i=0;i<400&&A.mode==='count';i++)A.step(1/60);let t=0;
 while(A.G.lost<1&&t<40){A.step(1/60,true);t+=1/60}A.step(1/60,false);A.settle();
 return {mode:A.mode,lost:A.G.lost,pen:A.G.pen,lostAt:+t.toFixed(1),gifts:A.giftsOn()}})()"""
# tras perderlo, 1 s más a fondo: el tren no debe pararse
KEEPGOING = """(()=>{const A=__adv;let vmin=99;for(let i=0;i<60;i++){A.step(1/60,true);vmin=Math.min(vmin,A.G.v)}A.step(1/60,false);return {mode:A.mode,vmin:+vmin.toFixed(1)}})()"""

FINISH = BOT

# decodifica el reto actual con el mismo sim.js y lo compara con el circuito
GHOST_RT = """(async()=>{const S=await __adv.sim(),code=__adv.code,g=await S.decodeGhost(code),T=S.trackFor(g.day);
 return {len:code.length,day:g.day,name:g.name,raw:g.raw,total:g.total,dist:g.cum[g.cum.length-1],L:T.L}})()"""

# sigue con el bot hasta tener el turbo cargado, lo activa y asienta la cámara
TURBO_ON = """(()=>{const A=__adv;for(let i=0;i<4000&&!(A.G.turbo>0)&&A.mode==='race';i++){if(A.turboGood())A.turbo();const G=A.G;A.step(1/60,G.v<A.vsAhead(G.dist)*0.97)}
 for(let i=0;i<15;i++)A.step(1/60,true);A.settle();return {turbo:+A.G.turbo.toFixed(2),v:+A.G.v.toFixed(1),turbos:A.G.turbos}})()"""

# turbo activo y vapor a fondo 1,5 s: la velocidad no puede pasar de VTURBO (35 m/s)
TURBO_CAP = """(()=>{const A=__adv;let m=0;for(let i=0;i<90&&A.mode==='race';i++){A.step(1/60,true);m=Math.max(m,A.G.v)}A.step(1/60,false);return m})()"""

# 6 s de carrera con el bot contra el fantasma del amigo
CHALLENGE_MID = """(()=>{const A=__adv;for(let i=0;i<400&&A.mode==='count';i++)A.step(1/60);
 for(let i=0;i<360;i++){const G=A.G;A.step(1/60,G.v<A.vsAhead(G.dist)*0.95)}A.settle();
 return {src:A.GH&&A.GH.src,ghost:A.GH?A.ghostTimeAt(A.G.dist)!==null:false,delta:document.getElementById('hDelta').textContent}})()"""

checks = []


def parse_ghost(code):
    """Cabecera del codec v1 de src/sim.js (deflate-raw + base64url con prefijo 'z')."""
    import base64, struct, zlib
    raw = base64.urlsafe_b64decode(code[1:] + '=' * (-len(code[1:]) % 4))
    b = zlib.decompress(raw, -15) if code[0] == 'z' else raw
    nl = b[4]
    name = b[5:5 + nl].decode('utf-8')
    o = 5 + nl
    raw_ms, total_ms = struct.unpack_from('<II', b, o)
    return {'version': b[0], 'season': 2000 + b[1], 'day': b[2], 'name': name, 'raw_ms': raw_ms, 'total_ms': total_ms,
            'bells': b[o + 8], 'lost': b[o + 9], 'turbos': b[o + 10], 'n': b[o + 11] | b[o + 12] << 8}


class FakeSupabase:
    """PostgREST y submit-run de mentira en http://sb.test, con una fila previa de «Leire»."""
    URL = 'http://sb.test'

    def __init__(self, seed_ghost):
        self.rows = [{'id': 7, 'name': 'Leire', 'total_ms': 99000, 'ghost': seed_ghost, 'day': 1}]
        self.last = {}

    async def attach(self, ctx):
        cfg = f"export default {{TAG:'TU-TAG-21',SITE_URL:'',SUPABASE_URL:'{self.URL}',SUPABASE_KEY:'clave-de-prueba'}};"
        await ctx.route('**/config.js', lambda r: r.fulfill(body=cfg, content_type='application/javascript'))
        await ctx.route(self.URL + '/**', self.handle)

    async def handle(self, route):
        import json, urllib.parse
        req = route.request
        h = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'}
        if req.method == 'OPTIONS':
            return await route.fulfill(status=204, headers=h)
        u = urllib.parse.urlparse(req.url)
        q = dict(urllib.parse.parse_qsl(u.query))
        if u.path == '/functions/v1/submit-run':
            body = json.loads(req.post_data)
            g = parse_ghost(body['ghost'])
            self.last = {**g, 'device': body['device']}
            row = {'id': 1, 'name': g['name'], 'total_ms': g['total_ms'], 'ghost': body['ghost'], 'day': g['day']}
            self.rows = [r for r in self.rows if r['id'] != 1] + [row]
            rank = 1 + sum(r['total_ms'] < row['total_ms'] and r['day'] == row['day'] for r in self.rows)
            return await route.fulfill(json={'id': 1, 'total_ms': row['total_ms'], 'rank': rank, 'mejor': True}, headers=h)
        if u.path == '/rest/v1/runs':
            rows = self.rows
            if 'id' in q:
                rows = [r for r in rows if str(r['id']) == q['id'][3:]]
            if 'day' in q:
                rows = [r for r in rows if str(r['day']) == q['day'][3:]]
            rows = sorted(rows, key=lambda r: r['total_ms'])
            cols = q.get('select', '').split(',')
            return await route.fulfill(json=[{k: r[k] for k in cols if k in r} for r in rows], headers=h)
        await route.fulfill(status=404, headers=h)


def fmt(t):
    """Igual que fmt() de main.js: m:ss.d"""
    m = int(t // 60)
    return f'{m}:{t - m * 60:04.1f}'


def check(name, cond, info=''):
    checks.append((name, bool(cond), info))
    print(('  ok   ' if cond else '  FALLO ') + name + (f'  {info}' if info else ''))


async def main():
    import subprocess
    try:
        sync = subprocess.run(['node', 'scripts/sync-shared.mjs', '--check'], cwd=str(OUT.parent.parent), capture_output=True, text=True)
        check('supabase/functions/_shared/sim.js coincide con src/sim.js', sync.returncode == 0, (sync.stdout + sync.stderr).strip())
    except FileNotFoundError:
        print('  (sin Node: no se comprueba la copia de sim.js)')
    srv = serve(PORT)
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=chromium_args(GPU))
        pg = await b.new_page(viewport={'width': 1200, 'height': 760})
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
        await route_local_three(pg)
        await pg.goto(f'http://127.0.0.1:{PORT}/index.html')
        await pg.wait_for_timeout(1500)
        if SHOTS:
            OUT.mkdir(exist_ok=True)
            await pg.screenshot(path=str(OUT / '1-calendario.png'))
        await pg.evaluate("document.querySelector('.door.today').click()")
        await pg.wait_for_function("document.getElementById('pre').classList.contains('on')", timeout=180000)
        if SHOTS:
            await pg.evaluate('__adv.settle()'); await pg.wait_for_timeout(2000)
            await pg.screenshot(path=str(OUT / '2-billete.png'))

        # 1) carrera limpia con el bot
        await pg.evaluate("document.getElementById('bGo').click()")
        await pg.wait_for_timeout(300)
        res = await pg.evaluate(BOT)
        print('carrera bot:', res)
        check('la carrera termina', res['mode'] == 'end' and res['total'] > 0)
        check('el bot no pierde regalos', res['lost'] == 0 and res['gifts'] == 3, f"perdidos {res['lost']}, a bordo {res['gifts']}")
        check('el bot usa el turbo', res['turbos'] >= 1, f"{res['turbos']} turbos")
        check('un buen maquinista consigue el oro', res['total'] <= res['med']['g'], f"{res['total']} s frente a oro {res['med']['g']} s")
        await pg.wait_for_timeout(1500)
        if SHOTS:
            try:
                await pg.screenshot(path=str(OUT / '3-llegada.png'), timeout=120000)
            except Exception as e:
                print('captura de llegada omitida:', e.__class__.__name__)
        share = await pg.evaluate("[__adv.shareText(), document.getElementById('shareTxt').textContent, document.getElementById('eName').textContent, __adv.BELLS().length]")
        txt, shown, dayname, nb = share
        print('compartir:\n' + txt)
        line = next((l for l in txt.split('\n') if l.startswith('🔔')), '')
        check('texto de compartir con día, tiempo, campanas y regalos', 'Día 1' in txt and fmt(res['total']) in txt and line.count('🟨') + line.count('⬛') == nb and '🎁 3/3' in txt)
        check('el texto no desvela el circuito', dayname not in txt, dayname)
        check('la llegada muestra el texto que se comparte', shown == txt)
        fields = await pg.evaluate("document.getElementById('eFields').textContent")
        check('la llegada muestra los regalos', 'Regalos3/3' in fields.replace(' ', ''), fields)

        # 1b) fantasma codificado: ida y vuelta y enlace de reto con nombre
        await pg.fill('#iName', 'Ane')
        await pg.wait_for_function("__adv.code && location.hash !== null", timeout=10000)
        await pg.wait_for_timeout(600)
        gh = await pg.evaluate(GHOST_RT)
        print('fantasma:', gh)
        check('el fantasma se codifica en un enlace corto', gh['len'] < 600, f"{gh['len']} caracteres")
        check('ida y vuelta del codec conserva día, nombre y tiempos', gh['day'] == 1 and gh['name'] == 'Ane' and abs(gh['raw'] - res['time']) < 0.06 and abs(gh['total'] - res['total']) < 0.06)
        check('la distancia integrada del fantasma cuadra con el circuito', -0.5 < gh['dist'] - gh['L'] < 1.0, f"{gh['dist']:.2f} m frente a {gh['L']:.2f} m")
        challenge = await pg.evaluate("document.getElementById('shareTxt').textContent.split('\\n').pop()")
        check('el texto de compartir lleva el enlace de reto', '#reto-' in challenge, challenge[:60] + '…')

        # 2) a fondo: se pierde un regalo, se penaliza y el tren no se para
        await pg.evaluate("document.getElementById('bAgain').click()")
        await pg.wait_for_timeout(200)
        ov = await pg.evaluate(OVERSPEED)
        print('a fondo:', ov)
        check('pasarse de velocidad hace perder un regalo', ov['lost'] >= 1 and ov['gifts'] == 2, f"a los {ov['lostAt']} s")
        check('cada regalo perdido suma 2 s', abs(ov['pen'] - 2 * ov['lost']) < 1e-6, f"pen {ov['pen']}")
        if SHOTS:
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=str(OUT / '4-regalo-perdido.png'))
        kg = await pg.evaluate(KEEPGOING)
        check('el tren no se para tras perderlo', kg['mode'] == 'race' and kg['vmin'] > 3, f"vmin {kg['vmin']} m/s")
        fin = await pg.evaluate(FINISH)
        check('la carrera con pérdidas termina', fin['mode'] == 'end', str(fin))

        # 3) abrir el reto en otra pestaña: billete con el nombre, fantasma dorado y delta
        await pg.close()
        p2 = await b.new_page(viewport={'width': 1200, 'height': 760})
        p2.on('pageerror', lambda e: errors.append(f'pageerror (reto): {e}'))
        await route_local_three(p2)
        await p2.goto(challenge, wait_until='domcontentloaded', timeout=120000)
        await p2.wait_for_function("document.getElementById('pre').classList.contains('on')", timeout=180000)
        pre = await p2.evaluate("document.getElementById('pGhost').textContent")
        check('el billete anuncia el reto del amigo', 'Ane' in pre, pre)
        if SHOTS:
            await p2.evaluate('__adv.settle()'); await p2.wait_for_timeout(1500)
            await p2.screenshot(path=str(OUT / '5-billete-reto.png'))
        await p2.evaluate("document.getElementById('bGo').click()")
        await p2.wait_for_timeout(200)
        mid = await p2.evaluate(CHALLENGE_MID)
        await p2.wait_for_timeout(400)
        mid['delta'] = await p2.evaluate("document.getElementById('hDelta').textContent")
        check('en carrera el fantasma es del amigo y hay delta', mid['src'] == 'amigo' and mid['ghost'] and mid['delta'] != '', str(mid))
        if SHOTS:
            await p2.wait_for_timeout(700)
            await p2.screenshot(path=str(OUT / '6-carrera-reto.png'))
        tb = await p2.evaluate(TURBO_ON)
        check('el turbo se carga apurando curvas y se activa', tb['turbo'] > 0 and tb['v'] > 0, str(tb))
        cap = await p2.evaluate(TURBO_CAP)
        check('con turbo y vapor a fondo no se pasa del tope', cap <= 35.01, f"{cap:.2f} m/s")
        if SHOTS:
            await p2.wait_for_timeout(300)
            await p2.screenshot(path=str(OUT / '7-turbo.png'))
        await p2.evaluate(FINISH)
        await p2.wait_for_timeout(800)
        end2 = await p2.evaluate("[document.getElementById('eDelta').textContent, __adv.shareText()]")
        check('la llegada compara con el amigo', 'Ane' in end2[0], end2[0])
        check('el texto de compartir menciona el reto', '⚔️' in end2[1] and 'Ane' in end2[1])
        await p2.close()

        # 4) clasificación global con un Supabase simulado
        sb = FakeSupabase(seed_ghost=challenge.split('#reto-')[1])
        ctx = await b.new_context(viewport={'width': 1200, 'height': 760})
        await sb.attach(ctx)
        p3 = await ctx.new_page()
        p3.on('pageerror', lambda e: errors.append(f'pageerror (supabase): {e}'))
        await route_local_three(p3)
        await p3.goto(f'http://127.0.0.1:{PORT}/index.html#dia-1', wait_until='domcontentloaded', timeout=120000)
        await p3.wait_for_function("document.getElementById('pre').classList.contains('on')", timeout=180000)
        await p3.wait_for_function("document.querySelector('#pLB [data-beat]')", timeout=15000)
        check('el billete carga la clasificación compartida con «Bátelo»', 'Leire' in await p3.evaluate("document.getElementById('pLB').textContent"))
        await p3.evaluate("document.getElementById('bGo').click()")
        await p3.wait_for_timeout(200)
        await p3.evaluate(BOT)
        await p3.wait_for_timeout(800)
        await p3.fill('#iName', 'Ane')
        await p3.evaluate("document.getElementById('bSave').click()")
        await p3.wait_for_function("/Fichado/.test(document.getElementById('bSave').textContent)", timeout=15000)
        saved = await p3.evaluate("[document.getElementById('bSave').textContent, document.getElementById('eLB').textContent, __adv.shareText()]")
        print('fichado:', saved[0], '| envío:', sb.last)
        check('fichar envía el fantasma con el nombre a submit-run', sb.last.get('name') == 'Ane' and sb.last.get('day') == 1 and len(sb.last.get('device', '')) == 36)
        check('la llegada muestra la posición y la clasificación compartida', 'Fichado · 1º' in saved[0] and 'Clasificación compartida' in saved[1] and 'Leire' in saved[1])
        check('tras fichar, el enlace de reto es corto', '#reto-i' in saved[2], saved[2].split('\n')[-1])
        short = saved[2].split('\n')[-1]
        await p3.evaluate("document.querySelector('#eLB [data-beat]').click()")
        await p3.wait_for_function("document.getElementById('pre').classList.contains('on')", timeout=15000)
        pre3 = await p3.evaluate("document.getElementById('pGhost').textContent")
        check('«Bátelo» en la clasificación abre el reto de esa fila', 'Leire' in pre3, pre3)
        await p3.close()
        p4 = await ctx.new_page()
        p4.on('pageerror', lambda e: errors.append(f'pageerror (enlace corto): {e}'))
        await route_local_three(p4)
        await p4.goto(short, wait_until='domcontentloaded', timeout=120000)
        await p4.wait_for_function("document.getElementById('pre').classList.contains('on')", timeout=180000)
        pre4 = await p4.evaluate("document.getElementById('pGhost').textContent")
        check('el enlace corto abre el reto de Ane desde el servidor', 'Ane' in pre4, pre4)
        await ctx.close()
        await b.close()
    srv.shutdown()
    for e in errors:
        print('  ', e)
    ok = all(c[1] for c in checks) and not errors
    print('OK' if ok else 'FALLO')
    sys.exit(0 if ok else 1)

asyncio.run(main())
