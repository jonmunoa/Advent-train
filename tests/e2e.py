#!/usr/bin/env python3
"""Prueba de humo end-to-end con Playwright (Chromium).

Abre el calendario, pulsa la puerta de hoy, espera al billete, arranca la carrera
y la completa con un "maquinista bot" usando el hook window.__adv de src/main.js.
Falla si hay errores de JavaScript o si la carrera no termina.

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

BOT = """(()=>{const A=__adv;for(let k=0;k<60000;k++){const G=A.G;if(A.mode==='finish'||A.mode==='end')break;
 const va=A.vsAhead(G.dist,G.v);A.step(1/60,G.v<va*0.95)}
 for(let i=0;i<200;i++)A.step(1/30);const G=A.G;return {mode:A.mode,time:+G.time.toFixed(1),total:+(G.total||0).toFixed(1),bells:G.bells,der:G.der,med:A.MED}})()"""


async def main():
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
        await pg.evaluate("document.getElementById('bGo').click()")
        await pg.wait_for_timeout(300)
        res = await pg.evaluate(BOT)
        print('resultado:', res)
        await pg.wait_for_timeout(1500)
        if SHOTS:
            try:
                await pg.screenshot(path=str(OUT / '3-llegada.png'), timeout=120000)
            except Exception as e:
                print('captura de llegada omitida:', e.__class__.__name__)
        await b.close()
    srv.shutdown()
    ok = res['mode'] == 'end' and res['total'] > 0 and not errors
    for e in errors:
        print('  ', e)
    print('OK' if ok else 'FALLO')
    sys.exit(0 if ok else 1)

asyncio.run(main())
