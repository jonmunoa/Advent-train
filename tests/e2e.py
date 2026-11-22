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

BOT = """(()=>{const A=__adv;for(let k=0;k<60000;k++){const G=A.G;if(A.mode==='finish'||A.mode==='end')break;
 const va=A.vsAhead(G.dist,G.v);A.step(1/60,G.v<va*0.95)}
 for(let i=0;i<200;i++)A.step(1/30);const G=A.G;return {mode:A.mode,time:+G.time.toFixed(1),total:+(G.total||0).toFixed(1),bells:G.bells,lost:G.lost,gifts:A.giftsOn(),med:A.MED}})()"""

# acelera a fondo hasta perder un regalo; luego suelta y asienta la cámara para la captura
OVERSPEED = """(()=>{const A=__adv;for(let i=0;i<400&&A.mode==='count';i++)A.step(1/60);let t=0;
 while(A.G.lost<1&&t<40){A.step(1/60,true);t+=1/60}A.step(1/60,false);A.settle();
 return {mode:A.mode,lost:A.G.lost,pen:A.G.pen,lostAt:+t.toFixed(1),gifts:A.giftsOn()}})()"""
# tras perderlo, 1 s más a fondo: el tren no debe pararse
KEEPGOING = """(()=>{const A=__adv;let vmin=99;for(let i=0;i<60;i++){A.step(1/60,true);vmin=Math.min(vmin,A.G.v)}A.step(1/60,false);return {mode:A.mode,vmin:+vmin.toFixed(1)}})()"""

FINISH = BOT

checks = []


def check(name, cond, info=''):
    checks.append((name, bool(cond), info))
    print(('  ok   ' if cond else '  FALLO ') + name + (f'  {info}' if info else ''))


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

        # 1) carrera limpia con el bot
        await pg.evaluate("document.getElementById('bGo').click()")
        await pg.wait_for_timeout(300)
        res = await pg.evaluate(BOT)
        print('carrera bot:', res)
        check('la carrera termina', res['mode'] == 'end' and res['total'] > 0)
        check('el bot no pierde regalos', res['lost'] == 0 and res['gifts'] == 3, f"perdidos {res['lost']}, a bordo {res['gifts']}")
        await pg.wait_for_timeout(1500)
        if SHOTS:
            try:
                await pg.screenshot(path=str(OUT / '3-llegada.png'), timeout=120000)
            except Exception as e:
                print('captura de llegada omitida:', e.__class__.__name__)
        fields = await pg.evaluate("document.getElementById('eFields').textContent")
        check('la llegada muestra los regalos', 'Regalos3/3' in fields.replace(' ', ''), fields)

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
        await b.close()
    srv.shutdown()
    for e in errors:
        print('  ', e)
    ok = all(c[1] for c in checks) and not errors
    print('OK' if ok else 'FALLO')
    sys.exit(0 if ok else 1)

asyncio.run(main())
