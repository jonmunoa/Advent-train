#!/usr/bin/env python3
"""Prueba end-to-end del idle «Mi maqueta de Navidad» (idle.html) con Playwright.

Partida nueva: el tren reparte, se compra desde la tienda, se amplía la vía, se encienden
las luces, se usa el silbato, se guarda, se recarga y se recogen las ganancias sin conexión.
Falla si hay errores de JavaScript, recursos 404 o alguna comprobación no se cumple.

Uso:
  python tests/idle.py            # SwiftShader (CPU)
  python tests/idle.py --gpu      # GPU real (más rápido)
  python tests/idle.py --shots    # además guarda capturas en tests/out/idle-*.png
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
from harness import ROOT, OUT, serve, chromium_args, route_local_three

sys.stdout.reconfigure(encoding='utf-8')
PORT = 8766
SHOTS = '--shots' in sys.argv
GPU = '--gpu' in sys.argv
checks = []


def check(name, cond, info=''):
    checks.append((name, bool(cond), info))
    print(('  ok   ' if cond else '  FALLO ') + name + (f'  {info}' if info else ''))


READY = "window.__idle && window.__idle.ready && !window.__idle.busy"


async def main():
    srv = serve(PORT, ROOT)
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=chromium_args(GPU))
        ctx = await b.new_context(viewport={'width': 1200, 'height': 760})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
        await route_local_three(pg)
        await pg.goto(f'http://127.0.0.1:{PORT}/idle.html?reiniciar')
        # con SwiftShader el primer render tarda (en un navegador real no pasa)
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        await pg.evaluate('__idle.look(0.35,0.6)')

        st = await pg.evaluate('({...__idle.st, houses3d: __idle.houses(), cargo: __idle.cargo()})')
        check('partida nueva: 25 monedas, una casa y un vagón cargado', st['coins'] == 25 and st['houses'] == 1 and st['houses3d'] == 1 and st['cargo'] == 5, str(st))

        # 1) el tren reparte solo
        r = await pg.evaluate('(()=>{const I=__idle,c0=I.st.coins;I.step(40);return {d:I.delivered(),laps:I.laps(),coins:I.st.coins-c0,gifts:I.st.gifts}})()')
        check('el tren reparte regalos y da monedas', r['d'] >= 1 and r['coins'] > 0 and r['gifts'] == r['d'], str(r))
        check('el tren vuelve al taller a cargar', r['laps'] >= 1, str(r))

        # 2) se compra desde la tienda (clic de verdad)
        c0 = await pg.evaluate('__idle.st.coins')
        await pg.click('.it[data-k="casa"]')
        st = await pg.evaluate('({h:__idle.st.houses,c:__idle.st.coins,h3:__idle.houses()})')
        check('comprar una casa en la tienda la añade y cobra', st['h'] == 2 and st['h3'] == 2 and st['c'] < c0, str(st))
        await pg.evaluate('__idle.st.coins=0')
        await pg.click('.it[data-k="vagon"]', force=True)  # sin monedas el botón avisa (aria-disabled), pero se puede pulsar
        check('sin monedas no se compra', await pg.evaluate('__idle.st.wagons') == 1)

        # 3) más casas que regalos: el consejo pide un vagón y el botón se marca
        r = await pg.evaluate("""(()=>{const I=__idle;I.give(1e4);for(let i=0;i<5;i++)I.buy('casa');I.step(60);
          return {h:I.st.houses,starve:I.starve(),tip:I.tip(),hot:document.querySelector('.it[data-k="vagon"]').classList.contains('hot')}})()""")
        check('si faltan regalos, hay casas sin regalo y se pide un vagón', r['h'] > 5 and r['starve'] > 0 and 'vagón' in r['tip'] and r['hot'], str(r))
        r = await pg.evaluate("(()=>{const I=__idle;I.buy('vagon');const s0=I.starve();I.step(60);return {w:I.wagons(),s:I.starve()-s0}})()")
        check('con otro vagón ya llegan regalos a todas', r['w'] == 2 and r['s'] == 0, str(r))

        # 4) ampliar la vía: más huecos, casas recolocadas y regalos que valen el triple
        r = await pg.evaluate("""(async()=>{const I=__idle;I.give(1e6);while(I.buy('casa'));const full=I.tip();const v0=I.rate()/I.st.houses;I.buy('via');
          for(let i=0;i<100&&I.busy;i++)await new Promise(r=>setTimeout(r,100));return {full,stage:I.st.stage,h:I.houses(),slots:document.querySelector('.it[data-k="casa"] .lv').textContent}})()""")
        check('con la vía llena, el consejo pide ampliarla', 'amplíala' in r['full'], r['full'])
        check('ampliar la vía pasa a la etapa 2 y recoloca las casas', r['stage'] == 1 and r['h'] == 8 and r['slots'].endswith('/12'), str(r))

        # 5) luces, máquina y silbato
        r = await pg.evaluate("""(()=>{const I=__idle;I.give(1e6);const v=[];for(const k of ['luces','luces','luces','loco'])v.push(I.buy(k));
          let lamps=0;I.scene.traverse(o=>{if(o.isInstancedMesh&&o.count>0&&o.material&&o.material.color&&o.material.color.r>2)lamps++});return {v,lights:I.st.lights,loco:I.st.loco,lamps}})()""")
        check('las luces se compran y encienden farolas y arcos', all(r['v']) and r['lights'] == 3 and r['lamps'] >= 1, str(r))
        r = await pg.evaluate("(()=>{const I=__idle;const a=I.boost(),b=I.boost();return {a,b,wait:document.getElementById('boost').classList.contains('wait')}})()")
        check('el silbato funciona y luego espera a recargarse', r['a'] and not r['b'], str(r))
        try:
            await pg.wait_for_function("document.getElementById('boost').classList.contains('wait')", polling=200, timeout=30000)
            wait = True
        except Exception:
            wait = False
        check('el botón del silbato muestra la recarga', wait)

        if SHOTS:
            OUT.mkdir(exist_ok=True)
            await pg.evaluate("(()=>{const I=__idle;I.step(3);I.look(0.35,0.6)})()")
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=str(OUT / 'idle-1-maqueta.png'), timeout=120000)
            await pg.evaluate('__idle.follow(true)')
            await pg.wait_for_timeout(3000)
            await pg.screenshot(path=str(OUT / 'idle-2-tren.png'), timeout=120000)
            await pg.evaluate('__idle.follow(false)')

        # 6) se guarda y se recupera al volver
        saved = await pg.evaluate("(()=>{__idle.save();return {...__idle.st}})()")
        await pg.reload()
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        st = await pg.evaluate('({...__idle.st, h3: __idle.houses(), w3: __idle.wagons()})')
        same = all(st[k] == saved[k] for k in ('houses', 'wagons', 'loco', 'lights', 'stage')) and abs(st['coins'] - saved['coins']) < saved['coins'] * 0.01 + 50
        check('al recargar sigue la misma maqueta', same and st['h3'] == saved['houses'] and st['w3'] == saved['wagons'], f"{st} / {saved}")
        check('si vuelves enseguida no sale la ventana de ausencia', not await pg.evaluate('__idle.away()'))

        # 7) dos horas fuera: ventana con lo ganado y botón de recoger
        await pg.evaluate('__idle.offline(7200)')
        await pg.reload()
        await pg.wait_for_function(READY + " && __idle.away()", polling=250, timeout=420000)
        r = await pg.evaluate("({away:__idle.away(),c:__idle.st.coins,txt:document.getElementById('awCoins').textContent,t:document.getElementById('awTime').textContent})")
        check('tras dos horas fuera sale lo ganado', r['away'] and r['txt'].startswith('+') and r['t'].startswith('2 h'), str(r))
        if SHOTS:
            await pg.screenshot(path=str(OUT / 'idle-3-ausencia.png'), timeout=120000)
        await pg.click('#awOk')
        r2 = await pg.evaluate("({away:__idle.away(),c:__idle.st.coins})")
        check('al recoger se suman las monedas y se cierra', not r2['away'] and r2['c'] > r['c'], f"{r['c']:.0f} → {r2['c']:.0f}")

        # 8) móvil: la tienda cabe y no hay desbordes
        mob = await b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
        mp = await mob.new_page()
        mp.on('pageerror', lambda e: errors.append(f'pageerror (móvil): {e}'))
        await route_local_three(mp)
        await mp.goto(f'http://127.0.0.1:{PORT}/idle.html?reiniciar')
        await mp.wait_for_function(READY, polling=500, timeout=420000)
        r = await mp.evaluate("""(()=>{const s=document.getElementById('shop').getBoundingClientRect(),its=[...document.querySelectorAll('.it')].map(e=>e.getBoundingClientRect()),
          b=document.getElementById('boost').getBoundingClientRect();return {sw:document.documentElement.scrollWidth,w:innerWidth,shop:s.bottom<=innerHeight+1,min:Math.min(...its.map(r=>r.width)),minH:Math.min(...its.map(r=>r.height)),boostAbove:b.bottom<=s.top}})()""")
        check('en el móvil la tienda cabe sin desbordar y los botones se pueden tocar', r['sw'] <= r['w'] and r['shop'] and r['min'] >= 56 and r['minH'] >= 44 and r['boostAbove'], str(r))
        if SHOTS:
            await mp.wait_for_timeout(2500)
            await mp.screenshot(path=str(OUT / 'idle-4-movil.png'), timeout=120000)
        await mob.close()

        # 9) rendimiento (informativo): primera vía y la maqueta completa, vista de órbita a 1200×760
        perf = []
        for full in (False, True):
            if full:
                await pg.evaluate("(async()=>{const I=__idle;I.give(1e15);for(let n=0;n<400;n++){let any=false;for(const k of ['casa','vagon','loco','via'])if(I.buy(k)){any=true;while(I.busy)await new Promise(r=>setTimeout(r,50))}if(!any)break}while(I.st.lights<4)I.buy('luces')})()")
                await pg.wait_for_function(READY, polling=250, timeout=120000)
            await pg.evaluate("(()=>{const I=__idle;I.step(2);I.look(0.35,0.6)})()")
            await pg.wait_for_timeout(3000)
            m = await pg.evaluate('__idle.perf(60)')
            st = await pg.evaluate('__idle.st')
            perf.append(f"vía {st['stage'] + 1}, {st['houses']} casas, {st['wagons']} vagones: {m['ms']} ms, {m['calls']} draw calls, {m['tris'] // 1000}k triángulos")
        print('rendimiento (' + ('GPU' if GPU else 'SwiftShader') + '):')
        for line in perf:
            print('  ' + line)
        await b.close()
    srv.shutdown()

    check('sin errores de JavaScript ni recursos que fallen', not errors, '\n        '.join(errors[:8]))
    bad = [c for c in checks if not c[1]]
    print(f"\n{len(checks) - len(bad)}/{len(checks)} comprobaciones OK" + ('' if not bad else ' · FALLAN: ' + ', '.join(c[0] for c in bad)))
    sys.exit(1 if bad else 0)

asyncio.run(main())
