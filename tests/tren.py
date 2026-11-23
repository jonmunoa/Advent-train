#!/usr/bin/env python3
"""Prueba end-to-end del tren de Navidad (tren.html, prototipo) con Playwright.

Partida nueva en la maqueta alpina: mover, acercar y girar la vista con ratón y con dedos, tocar un vagón para
seguirlo (ficha con la marca y su enlace), la cámara dentro de los túneles, elegir camino en el cruce (panel,
carteles y teclado), que el tren vaya por ahí, poner tu casa, reparto, los días del calendario (la vía crece),
el editor de marcas (logo, enlace, vista previa y petición), compartir, guardado, que no se hable con ningún
servidor y versión móvil. Falla si hay errores de JavaScript, recursos 404 o alguna comprobación no se cumple.

Uso:
  python tests/tren.py            # SwiftShader (CPU)
  python tests/tren.py --gpu      # GPU real (más rápido)
  python tests/tren.py --shots    # además guarda capturas en tests/out/tren-*.png
"""
import asyncio, math, os, struct, sys, zlib
from playwright.async_api import async_playwright
from harness import ROOT, OUT, serve, chromium_args, route_local_three

sys.stdout.reconfigure(encoding='utf-8')
PORT = 8767
SHOTS = '--shots' in sys.argv
GPU = '--gpu' in sys.argv
checks = []


def check(name, cond, info=''):
    checks.append((name, bool(cond), info))
    print(('  ok   ' if cond else '  FALLO ') + name + (f'  {info}' if info else ''))


def png(w=240, h=160):
    """Logo de prueba: círculo verde con un abeto blanco, fondo transparente."""
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            dx, dy = x - w / 2, y - h / 2
            inside = dx * dx + dy * dy < (h * 0.45) ** 2
            tree = abs(dx) < (y - h * 0.18) * 0.45 and h * 0.18 < y < h * 0.78
            row += bytes((255, 255, 255, 255) if tree else (15, 122, 74, 255) if inside else (0, 0, 0, 0))
        rows.append(bytes(row))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')


async def frames(pg, n=2):
    await pg.evaluate(f"new Promise(r=>{{let n={n};const f=()=>--n<0?r():requestAnimationFrame(f);f()}})")


async def px_err(pg, P, x, y):
    """Distancia en píxeles entre (x, y) y donde se ve ahora el punto P del suelo."""
    S = await pg.evaluate('P=>P&&__tren.onScreen(...P)', P)
    return math.hypot(S['x'] - x, S['y'] - y) if S else 1e9


async def nav_mouse(pg):
    """Navegación con ratón: arrastrar, inercia, rueda, girar, doble clic, límites, botones, teclado y volver de un vagón."""
    async def drag(x0, y0, x1, y1, btn='left', pause=0):
        await pg.mouse.move(x0, y0)
        await pg.mouse.down(button=btn)
        await pg.mouse.move(x0 + 8, y0 + 4)
        await frames(pg)
        P = await pg.evaluate(f'__tren.under({x0 + 8},{y0 + 4})')
        for i in range(1, 11):
            await pg.mouse.move(x0 + 8 + (x1 - x0 - 8) * i / 10, y0 + 4 + (y1 - y0 - 4) * i / 10)
            await frames(pg, 1)
        await frames(pg)
        e = await px_err(pg, P, x1, y1)
        if pause:
            await pg.wait_for_timeout(pause)
        await pg.mouse.up(button=btn)
        return e, await pg.evaluate('__tren.camInfo()')

    errs = []
    for view in ('__tren.goHome()', '__tren.look(1.2,0.3,60,-40,55)', '__tren.look(2.4,1.2,90,20,10)', '__tren.look(0.3,0.2,40,60,0)'):
        for a in ((600, 400, 420, 520), (500, 300, 760, 420)):
            await pg.evaluate(view + ';__tren.camSettle()')
            e, v = await drag(*a, pause=150)
            errs.append(e)
    check('al arrastrar, el suelo va pegado al ratón (de lejos, de cerca, rasante y desde arriba)', max(errs) < 1.5, str([round(e, 2) for e in errs]))
    check('si paras antes de soltar, la vista se queda quieta', v['v'] == 0, str(v['v']))
    await pg.evaluate('__tren.look(1.57,0.6,120,-20,40)')
    _, v = await drag(600, 400, 420, 420)
    t0 = v['t'][0]
    await pg.wait_for_timeout(1500)
    w = await pg.evaluate('__tren.camInfo()')
    check('al soltar en movimiento sigue con inercia y se para sola', v['v'] > 5 and w['v'] < 1 and abs(w['t'][0] - t0) > 2, f"{v['v']} → {w['v']}, {t0} → {w['t'][0]}")
    errs = []
    for (x, y) in ((930, 470), (300, 600), (700, 250)):
        for f in (-100, 100):
            await pg.evaluate('__tren.look(1.57,0.62,%d,-10,30)' % (200 if f < 0 else 60))
            await frames(pg)
            P = await pg.evaluate(f'__tren.under({x},{y})')
            await pg.mouse.move(x, y)
            for _ in range(6):
                await pg.mouse.wheel(0, f)
                await frames(pg, 1)
                errs.append(await px_err(pg, P, x, y))
            await pg.wait_for_timeout(600)
            errs.append(await px_err(pg, P, x, y))
    check('con la rueda, también girando rápido, el punto bajo el ratón no se mueve', max(errs) < 1.5, f'peor {max(errs):.2f} px')
    await pg.evaluate('__tren.look(1.57,0.62,120,-10,30)')
    await frames(pg)
    C, a0 = await pg.evaluate('[__tren.under(600,380),__tren.camInfo()]')
    await drag(600, 400, 760, 404, 'right', 150)
    a1 = await pg.evaluate('__tren.camInfo()')
    e = await px_err(pg, C, 600, 380)
    await drag(600, 400, 608, 480, 'right', 150)
    a2 = await pg.evaluate('__tren.camInfo()')
    check('el botón derecho gira sobre el centro y sube o baja la vista', a1['az'] > a0['az'] + 0.5 and e < 14 and a2['el'] > a1['el'] + 0.2, f"giro {a0['az']} → {a1['az']}, error {e:.1f} px, inclinación {a1['el']} → {a2['el']}")
    await pg.wait_for_timeout(200)
    az = await pg.evaluate("new Promise(r=>{const a=__tren.camInfo().az;setTimeout(()=>r(Math.abs(__tren.camInfo().az-a)),9000)})")
    check('la vista no gira sola después de tocarla', az < 0.002, str(az))
    await pg.evaluate('__tren.look(1.9,0.14,30,-30,50)')
    await pg.mouse.move(600, 380)
    for _ in range(30):
        await pg.mouse.wheel(0, 150)
        await frames(pg, 1)
    for _ in range(2):
        await drag(900, 400, 200, 500)
    await pg.wait_for_timeout(1500)
    v = await pg.evaluate('({...__tren.camInfo(),c:__tren.under(600,380)})')
    check('alejar a tope desde abajo acaba viendo la maqueta entera desde arriba, y en el borde vuelve sola', v['el'] > 0.45 and v['d'] > 220 and v['c'] and abs(v['c'][0]) < 130 and abs(v['c'][2]) < 130, str(v))
    await pg.evaluate('__tren.look(1.57,0.62,120,-10,30)')
    await frames(pg)
    P = await pg.evaluate('__tren.under(800,300)')
    await pg.mouse.dblclick(800, 300)
    await pg.wait_for_timeout(900)
    v, e = await pg.evaluate('__tren.camInfo()'), await px_err(pg, P, 800, 300)
    check('doble clic acerca hacia ese punto', v['d'] < 80 and e < 1.5, f"d {v['d']}, error {e:.2f}")
    await pg.evaluate('__tren.look(1.9,0.5,140,-30,50);__tren.hold(true)')
    await frames(pg)
    v0 = await pg.evaluate('__tren.camInfo()')
    c = await pg.evaluate('__tren.carScreen(3)')
    await pg.mouse.click(c['x'], c['y'])
    step, last = 0, v0['p']
    for _ in range(40):
        await frames(pg, 1)
        q = await pg.evaluate('__tren.camInfo().p')
        step, last = max(step, math.dist(q, last)), q
    f = await pg.evaluate('__tren.focused')
    total = math.dist(v0['p'], last)
    await pg.evaluate('__tren.camSettle()')
    await pg.click('#focusX')
    await pg.evaluate('__tren.camSettle()')
    v1 = await pg.evaluate('__tren.camInfo()')
    check('al tocar un vagón la cámara vuela sin saltos, y al volver queda como estaba', f and step < 0.35 * max(total, 60) and math.dist(v0['p'], v1['p']) < 1.5, f"vuelo {total:.0f} m, mayor paso {step:.1f} m, vuelta {v0['p']} {v1['p']}")
    await pg.evaluate('__tren.focus({car:3});__tren.camSettle();__tren.hold(false)')
    await pg.mouse.move(600, 380)
    for _ in range(16):
        await pg.mouse.wheel(0, 150)
        await frames(pg, 2)
    check('alejar mucho suelta el vagón', not await pg.evaluate('__tren.focused'))
    await pg.evaluate('__tren.look(1.57,0.62,120,-10,30)')
    await pg.keyboard.press('ArrowRight')
    await frames(pg)
    v = await pg.evaluate('__tren.camInfo()')
    await pg.wait_for_timeout(1200)
    d0 = (await pg.evaluate('__tren.camInfo()'))['d']
    await pg.click('#nIn')
    await pg.wait_for_timeout(600)
    a = await pg.evaluate('__tren.camInfo()')
    await pg.click('#nRot')
    await pg.wait_for_timeout(900)
    z = await pg.evaluate('__tren.camInfo()')
    await pg.click('#nHome')
    await pg.wait_for_timeout(1500)
    h = await pg.evaluate('({...__tren.camInfo(),away:document.getElementById("nav").classList.contains("away")})')
    check('flechas, botones de acercar y girar, y «Ver toda la maqueta»', v['v'] > 1 and a['d'] < d0 * 0.75 and abs(z['az'] - a['az'] - 0.785) < 0.02 and abs(h['az'] - 1.571) < 0.01 and not h['away'], f"{v['v']} · {d0} → {a['d']} · {a['az']} → {z['az']} · {h}")
    check('la pista de manejo se va al mover la vista', await pg.evaluate("document.getElementById('navHint').hidden"))


async def nav_touch(ctx, pg):
    """Navegación con dedos (toques de verdad por CDP): arrastrar, pellizcar, girar, inclinar, soltar un dedo y doble toque."""
    cdp = await ctx.new_cdp_session(pg)

    async def touch(kind, pts):
        await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})

    async def move(a, b, n=12):
        """Mueve los dedos de las posiciones a a las b."""
        for i in range(1, n + 1):
            await touch('touchMove', [(p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n) for p, q in zip(a, b)])
            await frames(pg, 1)
        await frames(pg)

    view = '__tren.look(1.57,0.8,150,-10,30)'
    await pg.evaluate(view)
    await touch('touchStart', [(190, 400)])
    await move([(190, 400)], [(202, 404)], 3)
    P = await pg.evaluate('__tren.under(202,404)')
    await move([(202, 404)], [(120, 520)])
    e1 = await px_err(pg, P, 120, 520)
    await pg.wait_for_timeout(150)
    await touch('touchEnd', [])
    check('con un dedo, el suelo va pegado al dedo', e1 < 1.5, f'{e1:.2f} px')

    await pg.evaluate(view)
    a0 = await pg.evaluate('__tren.camInfo()')
    await touch('touchStart', [(150, 420)])
    await touch('touchStart', [(150, 420), (230, 420)])
    await move([(150, 420), (230, 420)], [(142, 420), (238, 420)], 4)
    P = await pg.evaluate('__tren.under(190,420)')
    await move([(142, 420), (238, 420)], [(60, 380), (280, 380)])
    e2 = await px_err(pg, P, 170, 380)
    a1 = await pg.evaluate('__tren.camInfo()')
    check('pellizcar acerca y mueve a la vez, con el punto entre los dedos quieto y sin girar', e2 < 2.5 and a1['d'] < a0['d'] * 0.6 and abs(a1['az'] - a0['az']) < 1e-6, f"{e2:.2f} px, d {a0['d']} → {a1['d']}, az {a0['az']} → {a1['az']}")
    # levantar un dedo: el otro sigue arrastrando sin salto
    b = await pg.evaluate('__tren.camInfo()')
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': 280, 'y': 380, 'id': 1}]})   # se levanta el segundo dedo
    await frames(pg)
    c = await pg.evaluate('__tren.camInfo()')
    P = await pg.evaluate('__tren.under(60,380)')
    await move([(60, 380)], [(130, 430)])
    e3 = await px_err(pg, P, 130, 430)
    await pg.wait_for_timeout(150)
    await touch('touchEnd', [])
    check('al levantar un dedo, el otro sigue arrastrando sin salto', math.dist(b['p'], c['p']) < 0.5 and e3 < 2, f"{math.dist(b['p'], c['p']):.2f} m, {e3:.2f} px")

    await pg.evaluate(view)
    await touch('touchStart', [(110, 420)])
    await touch('touchStart', [(110, 420), (270, 420)])
    n, R0 = 14, 80
    prev = [(110, 420), (270, 420)]
    for i in range(1, n + 1):
        t = 0.9 * i / n
        nxt = [(190 - R0 * math.cos(t), 420 - R0 * math.sin(t)), (190 + R0 * math.cos(t), 420 + R0 * math.sin(t))]
        await move(prev, nxt, 1)
        prev = nxt
    P = await pg.evaluate('__tren.under(190,420)')
    a = await pg.evaluate('__tren.camInfo()')
    await touch('touchEnd', [])
    check('girar dos dedos gira la vista con ellos', -0.9 < a['az'] - 1.57 < -0.5 and 130 < a['d'] < 175, f"az {a['az']}, d {a['d']}")

    await pg.evaluate(view)
    await touch('touchStart', [(130, 420)])
    await touch('touchStart', [(130, 420), (250, 420)])
    await move([(130, 420), (250, 420)], [(130, 330), (250, 330)])
    a = await pg.evaluate('__tren.camInfo()')
    await touch('touchEnd', [])
    check('subir dos dedos a la vez inclina la vista', a['el'] < 0.65 and abs(a['az'] - 1.57) < 0.01, f"el {a['el']}")

    await pg.evaluate('__tren.dist=12;__tren.look(1.57,0.8,250,-10,30);__tren.hold(true)')
    await frames(pg)
    c = await pg.evaluate('__tren.carScreen(2)')
    await pg.touchscreen.tap(c['x'] + 10, c['y'] + 9)
    await frames(pg)
    f = await pg.evaluate('__tren.focused')
    await pg.evaluate('__tren.focus(null);__tren.hold(false);__tren.look(1.57,0.8,150,-10,30)')
    check('de lejos, un toque cerca del tren (a un dedo) lo sigue', bool(f), str(f))
    await pg.touchscreen.tap(60, 560)
    await pg.touchscreen.tap(62, 561)
    await pg.wait_for_timeout(700)
    a = await pg.evaluate('({...__tren.camInfo(),f:__tren.focused})')
    check('doble toque acerca', a['d'] < 110 and not a['f'], str(a['d']))
    r = await pg.evaluate("(()=>{const h=document.getElementById('nHome').getBoundingClientRect(),s=document.getElementById('shop').getBoundingClientRect();return {vis:getComputedStyle(document.getElementById('nHome')).visibility,in:getComputedStyle(document.getElementById('nIn')).display,b:h.bottom,top:s.top,r:h.right,w:innerWidth,wd:h.width}})()")
    check('en el móvil solo queda «Ver toda la maqueta», encima de las fichas, cuando te has movido', r['vis'] == 'visible' and r['in'] == 'none' and r['b'] < r['top'] and r['r'] <= r['w'] and r['wd'] >= 40, str(r))
    await pg.tap('#nHome')
    await pg.wait_for_timeout(1500)
    check('y vuelve a la vista de inicio', abs((await pg.evaluate('__tren.camInfo()'))['az'] - 1.571) < 0.01)


READY = "window.__tren && window.__tren.ready && !window.__tren.busy"


async def main():
    srv = serve(PORT, ROOT)
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=chromium_args(GPU))
        ctx = await b.new_context(viewport={'width': 1200, 'height': 760})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
        reqs = []
        pg.on('request', lambda r: reqs.append((r.method, r.url)))
        await route_local_three(pg)
        await pg.goto(f'http://127.0.0.1:{PORT}/tren.html?reiniciar', wait_until='commit')
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        await pg.evaluate('window.__idleNoAdapt=true;__tren.look(Math.PI/2,0.62)')

        st = await pg.evaluate('({...__tren.st, w3: __tren.wagons(), h3: __tren.houses(), ads: __tren.ads(), a1: __tren.adImg(1), map: __tren.map()})')
        check('partida nueva: día 1, tren con 3 vagones, el pueblo, los dos vagones de ejemplo y la marca con enlace',
              st['w3'] == st['wagons'] == 3 and st['h3'] == st['houses'] == 3 and st['day'] == 1 and st['total'] < 100 and st['ads'] == [1, 2] and st['a1']['w'] == 1024 and st['a1']['url'] == 'https://www.example.com/' and st['mine'] == -1, str({k: st[k] for k in ('w3', 'h3', 'ads', 'a1', 'mine')}))
        check('la primera vía ya pasa por un túnel y por un puente (el ocho se cruza por encima)', any(r['k'] == 1 for r in st['map']['runs']) and any(r['k'] == 2 for r in st['map']['runs']), str(st['map']))

        # 1) zoom con la rueda hacia donde apunta el ratón (no hacia el centro)
        await pg.mouse.move(930, 470)
        a = await pg.evaluate('__tren.camInfo()')
        for _ in range(6):
            await pg.mouse.wheel(0, -240)
            await pg.wait_for_timeout(40)
        await pg.evaluate('__tren.camSettle()')
        z = await pg.evaluate('__tren.camInfo()')
        check('la rueda acerca la cámara hacia el punto que hay bajo el ratón', z['d'] < a['d'] * 0.45 and z['t'][0] > a['t'][0] + 25, f"{a} → {z}")

        await nav_mouse(pg)

        # 2) tocar un vagón: la cámara se pega a él y sale su ficha; la rueda lo acerca más; el tren no cambia de ritmo
        await pg.evaluate('__tren.hold(true);__tren.dist=12;__tren.look(Math.PI/2,0.45,80,-40,55)')   # tren quieto mientras se apunta
        c = await pg.evaluate('__tren.carScreen(3)')
        await pg.mouse.click(c['x'], c['y'])
        await pg.evaluate('__tren.hold(false)')
        await pg.evaluate('__tren.camSettle()')
        r = await pg.evaluate('({f:__tren.focused,card:__tren.card(),fd:__tren.camInfo().fd})')
        check('tocar un vagón lo sigue con la cámara y enseña su ficha', r['f'] and r['f'].get('car') == 3 and not r['card']['hidden'] and r['card']['name'], f'{r} {c}')
        await pg.mouse.move(600, 380)
        for _ in range(4):
            await pg.mouse.wheel(0, -200)
        await pg.evaluate('__tren.camSettle()')
        r2 = await pg.evaluate('(()=>{const d0=__tren.dist;__tren.step(2);return {fd:__tren.camInfo().fd,f:__tren.focused,v:(__tren.dist-d0)/2}})()')
        check('con un vagón enfocado, la rueda acerca la cámara al vagón y el tren sigue a su ritmo', r2['fd'] < r['fd'] - 2 and r2['f'] and r2['f'].get('car') == 3 and 5 < r2['v'] < 6, f"{r['fd']} → {r2}")
        await pg.evaluate('__tren.focus({car:2});__tren.camSettle()')
        r = await pg.evaluate("(()=>{const a=document.getElementById('caGo');return {card:__tren.card(),t:a.target,rel:a.rel,host:document.getElementById('caHost').textContent}})()")
        check('la ficha del vagón patrocinado enlaza a su web en otra pestaña', r['card']['href'] == 'https://www.example.com/' and r['t'] == '_blank' and 'noopener' in r['rel'] and 'sponsored' in r['rel'] and r['host'] == 'example.com', str(r))
        if SHOTS:
            OUT.mkdir(exist_ok=True)
            await pg.wait_for_timeout(1200)
            await pg.evaluate('__tren.camSettle()')
            await pg.screenshot(path=str(OUT / 'tren-2-vagon.png'), timeout=120000)
        await pg.click('#focusX')
        r = await pg.evaluate('({f:__tren.focused,card:__tren.card()})')
        check('«Volver a la maqueta» suelta el vagón y esconde la ficha', not r['f'] and r['card']['hidden'], str(r))

        # 3) túnel: la cámara entra con el vagón (y la marca se sigue viendo) y vuelve a salir
        r = await pg.evaluate("""(()=>{const T=__tren,u=T.map().runs.find(q=>q.k===1);T.route(0);T.hold(true);T.dist=u.s-40-T.offs(2);T.focus({car:2});T.camSettle();const a=T.inside();
          T.dist=u.s+u.len/2-T.offs(2);T.camSettle();const b=T.inside(),p=T.camInfo().p,g=T.ground(p[0],p[2]),c=T.carScreen(2);
          T.dist=u.s+u.len+30-T.offs(2);T.camSettle();return {a,b,under:p[1]<g-3,c,x:innerWidth,y:innerHeight,d:T.inside()}})()""")
        check('en un túnel la cámara entra en la gruta con el vagón centrado, y al salir vuelve fuera', not r['a'] and r['b'] and r['under'] and 0.25 * r['x'] < r['c']['x'] < 0.75 * r['x'] and 0.2 * r['y'] < r['c']['y'] < 0.8 * r['y'] and not r['d'], str(r))
        if SHOTS:
            await pg.evaluate("(()=>{const T=__tren,u=T.map().runs.find(q=>q.k===1);T.dist=u.s+u.len/2-T.offs(2);T.camSettle()})()")
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=str(OUT / 'tren-4-tunel.png'), timeout=120000)
        await pg.evaluate('__tren.hold(false);__tren.focus(null)')

        # 3b) elegir camino: con el panel, con los carteles de la maqueta y con el teclado
        await pg.evaluate('__tren.route(0);__tren.goHome();__tren.camSettle();__tren.dist=__tren.forks()[0].s-150')
        await pg.wait_for_timeout(400)
        r = await pg.evaluate("({p:__tren.poll(),n:[0,1].map(i=>document.querySelector('#po'+i+' .pn').textContent),t:document.getElementById('pTime').textContent,s:[0,1].map(i=>!!__tren.sign(i))})")
        check('el panel enseña los dos caminos del próximo cruce, con cuenta atrás y carteles en la maqueta', r['p']['state'] == 'open' and r['p']['mine'] == -1 and r['n'] == r['p']['opts'] and len(set(r['n'])) == 2 and r['t'].startswith('0:2') and all(r['s']), str(r))
        await pg.click('#po0')
        r = await pg.evaluate("({p:__tren.poll(),pr:document.getElementById('po0').getAttribute('aria-pressed'),t:document.getElementById('pTitle').textContent})")
        check('un toque elige el camino y lo dice', r['p']['mine'] == 0 and r['pr'] == 'true' and r['t'].startswith('Irá por'), str(r))
        s1 = await pg.evaluate('__tren.sign(1)')
        await pg.mouse.click(s1['x'], s1['y'] - 24)
        r = await pg.evaluate('({p:__tren.poll(),f:__tren.focused})')
        check('tocar un cartel de la maqueta cambia la elección', r['p']['mine'] == 1 and not r['f'], str(r))
        await pg.keyboard.press('1')
        check('la tecla 1 elige el camino de la izquierda', (await pg.evaluate('__tren.poll().mine')) == 0)
        if SHOTS:
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=str(OUT / 'tren-9-cruce.png'), timeout=120000)
        # el tren va por donde has elegido (por los dos lados), con todos los coches detrás por la misma vía
        for side in (0, 1):
            r = await pg.evaluate("""side=>{const T=__tren;T.hold(true);T.dist=T.forks()[0].s-30;const p=T.poll();T.choose(side);T.step(4.2);const c=T.poll();const late=T.choose(1-side);T.step(3);const b=T.bits();T.step(3);
              let gap=0;for(let i=0;i<T.wagons()+3;i++){const a=T.carPos(i),q=T.carPos(i+1);if(!q)break;const d=Math.hypot(a[0]-q[0],a[2]-q[2])-Math.abs(T.offs(i+1)-T.offs(i));gap=Math.max(gap,Math.abs(d))}
              T.hold(false);return {p,closed:c.state,won:c.won,late,b,exp:p.route[side],gap}}""", side)
            check(f"si eliges el camino de la {'izquierda' if side == 0 else 'derecha'}, el tren va por ahí y los vagones le siguen (y ya no se puede cambiar)", r['closed'] == 'closed' and r['won'] == side and r['b'] == r['exp'] and r['gap'] < 1.2 and not r['late'], str(r))
        r = await pg.evaluate("""(()=>{const T=__tren,o=[];for(let k=0;k<4;k++){T.dist=T.forks()[0].s-20;T.step(6);o.push(T.bits())}return {o,paths:T.paths(),seen:T.st.seen}})()""")
        check('si no eliges, el tren alterna los caminos, y cuenta los que has recorrido', set(r['o']) == {0, 1} and r['paths'] == [2, 2], str(r))
        # con la máquina ya en el ramal, la cola sigue por donde pasó y la vuelta se cierra sin saltos
        r = await pg.evaluate("""(()=>{const T=__tren;let worst=0;T.dist=T.forks()[0].s-20;T.choose(T.poll().route[0]===1?0:1);let prev=[...Array(T.wagons()+3).keys()].map(i=>T.carPos(i)),laps=T.laps();
          for(let k=0;k<1500&&T.laps()<laps+1;k++){T.step(0.05);const now=prev.map((_,i)=>T.carPos(i));now.forEach((q,i)=>{worst=Math.max(worst,Math.hypot(q[0]-prev[i][0],q[2]-prev[i][2]))});prev=now}
          return {worst,laps:T.laps()-laps}})()""")
        check('una vuelta entera por el ramal, sin que ningún coche dé un salto', r['laps'] >= 1 and r['worst'] < 0.5, str(r))
        await pg.click('#pToot')

        # 4) poner tu casa desde el formulario; la cámara va a verla y tu nombre va en la locomotora
        await pg.evaluate('__tren.look(Math.PI/2,0.62)')
        n0 = await pg.evaluate('({h:__tren.houses(),d:__tren.driver()})')
        await pg.click('#tHouse')
        await pg.fill('#hName', '  <b>Jon</b> ')
        await pg.click('#houseForm button[type=submit]')
        await pg.wait_for_timeout(700)
        await pg.evaluate('__tren.camSettle()')
        r = await pg.evaluate('({mine:__tren.st.mine,h3:__tren.houses(),name:__tren.st.myName,d:__tren.driver(),open:document.getElementById("houseSheet").classList.contains("on"),cam:__tren.camInfo()})')
        check('poner tu casa: junto a la vía, con tu nombre (limpio) en ella y en la locomotora, y la cámara se acerca', n0['d'] == '' and r['mine'] == 0 and r['h3'] == n0['h'] + 1 and r['name'] == r['d'] == 'bJon/b' and not r['open'] and r['cam']['d'] < 60, str(r))

        # 5) el tren reparte y te deja regalos a ti
        r = await pg.evaluate("(()=>{const T=__tren;T.step(150);return {d:T.delivered(),laps:T.laps(),me:T.st.myGifts,total:T.st.total}})()")
        check('el tren reparte en las casas y también en la tuya', r['d'] > 5 and r['laps'] >= 1 and r['me'] > 0 and r['total'] > r['me'], str(r))

        # 6) calendario: fuera de temporada se puede pasar de día; la vía crece el día 4
        r = await pg.evaluate("({p:__tren.preview,btn:!document.getElementById('dayNext').hidden,t:document.getElementById('dayPct').textContent})")
        check('fuera de temporada es una vista previa: dice qué llega mañana y deja pasar de día', r['p'] and r['btn'] and 'vagón' in r['t'], str(r))
        await pg.click('#dayNext')
        r = await pg.evaluate("({d:__tren.st.day,w:__tren.wagons(),h:__tren.houses()})")
        check('el día 2 llega otro vagón y otra casa', r['d'] == 2 and r['w'] == 4 and r['h'] == 5, str(r))
        r = await pg.evaluate("""(async()=>{const T=__tren,L0=T.map().L;for(let k=0;k<2;k++){T.nextDay();for(let i=0;i<150&&T.busy;i++)await new Promise(r=>setTimeout(r,100))}
          return {L0,day:T.st.day,stage:T.st.stage,L:T.map().L,runs:T.map().runs,h3:T.houses(),h:T.st.houses,mine:T.st.mine,poll:T.poll(),forks:T.forks().length,paths:T.paths()}})()""")
        check('el día 4 la vía crece (con puentes), hay dos cruces y tu casa sigue', r['day'] == 4 and r['stage'] == 1 and r['L'] > r['L0'] + 50 and any(x['k'] == 2 for x in r['runs']) and r['h3'] == r['h'] + 1 and r['mine'] == 0 and r['forks'] == 2 and r['poll']['state'] == 'open' and r['paths'] == [2, 4], str({k: r[k] for k in r if k != 'runs'}))

        # 7) tu marca: subir logo, texto y enlace; un enlace raro no vale; la petición se copia (o sale por correo)
        await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        await pg.click('#tAd')
        await pg.set_input_files('#adFile', files=[{'name': 'logo.png', 'mimeType': 'image/png', 'buffer': png()}])
        await pg.fill('#adText', 'Vivero Abeto Verde')
        await pg.fill('#adSub', 'Árboles de Navidad · Getxo')
        await pg.wait_for_function("document.getElementById('adFileLbl').textContent==='Cambiar imagen'", timeout=10000)
        await pg.fill('#adUrl', 'javascript:alert(1)')
        await pg.click('#adAsk')
        r = await pg.evaluate("({err:document.getElementById('adErr').textContent,ok:document.getElementById('adOk').hidden})")
        check('un enlace que no es una web no se acepta', 'enlace' in r['err'] and r['ok'], str(r))
        await pg.fill('#adUrl', 'vivero-abeto.es/navidad')
        await pg.click('#adAsk')
        await pg.wait_for_function("!document.getElementById('adOk').hidden", timeout=5000)
        r = await pg.evaluate("(async()=>({clip:await navigator.clipboard.readText(),ok:document.getElementById('adOk').textContent,go:document.getElementById('adAsk').textContent}))()")
        check('pedir el vagón copia los datos (texto, enlace y precio), sin enviar nada a ningún sitio', all(q in r['clip'] for q in ('Vivero Abeto Verde', 'https://vivero-abeto.es/navidad', 'vagón del día', '€', 'adjunto')) and 'copiad' in r['ok'].lower() and '€' in r['go'], str(r))
        if SHOTS:
            await pg.locator('#adSheet .card').screenshot(path=str(OUT / 'tren-3-marca.png'), timeout=120000)

        # 8) vista previa en el tren y vuelta
        await pg.click('#adSee')
        r = await pg.evaluate('({f:__tren.focused,a1:__tren.adImg(1),pill:document.getElementById("focusX").hidden,card:__tren.card()})')
        check('«Ver cómo queda» pone tu diseño en el primer vagón, con su enlace, y la cámara lo sigue', r['f'] and r['f'].get('car') == 2 and r['a1']['img'] and r['a1']['text'] == 'Vivero Abeto Verde' and r['a1']['url'].startswith('https://vivero-abeto.es') and not r['pill'], str(r))
        await pg.click('#focusX')
        r = await pg.evaluate('({f:__tren.focused,a1:__tren.adImg(1),open:document.getElementById("adSheet").classList.contains("on")})')
        check('al volver, el vagón del día recupera su anuncio y se reabre el editor', not r['f'] and r['a1']['text'] == 'Pastelería La Estrella' and r['open'], str(r))

        # 9) vista previa en otro vagón, y al volver queda libre
        await pg.click('#tabMsg')
        await pg.click('#adSee')
        r = await pg.evaluate('({f:__tren.focused,a3:__tren.adImg(3),go:document.getElementById("adAsk").textContent})')
        await pg.click('#focusX')
        await pg.click('#adX')
        r['ads'] = await pg.evaluate('__tren.ads()')
        check('en «Otro vagón» la vista previa va al primer vagón libre, y al volver queda libre', r['f'] and r['f'].get('car') == 4 and r['a3'] and r['a3']['text'] == 'Vivero Abeto Verde' and r['ads'] == [1, 2], str(r))

        # 9b) compartir: sin menú del sistema, copia el enlace sin parámetros
        await pg.evaluate("Object.defineProperty(navigator,'share',{value:undefined,configurable:true})")
        await pg.click('#bShare')
        await pg.wait_for_timeout(300)
        r = await pg.evaluate('navigator.clipboard.readText()')
        check('compartir copia el enlace de la página, sin parámetros', r.endswith('/tren.html') and '?' not in r, r)

        if SHOTS:
            await pg.evaluate('__tren.look(Math.PI/2,0.62)')
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=str(OUT / 'tren-1-maqueta.png'), timeout=120000)
            await pg.evaluate('__tren.look(1.75,0.42,70,92,-62)')
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=str(OUT / 'tren-7-esqui.png'), timeout=120000)

        # 10) se guarda en el navegador y se recupera (el día y el tren salen del calendario)
        saved = await pg.evaluate('(()=>{window.dispatchEvent(new Event("pagehide"));return {...__tren.st,ls:Object.keys(localStorage)}})()')
        await pg.reload(wait_until='commit')
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        r = await pg.evaluate('({...__tren.st,w3:__tren.wagons(),h3:__tren.houses(),d:__tren.driver()})')
        keys = ('mine', 'myName', 'total', 'myGifts', 'chosen', 'seen')
        check('al recargar siguen tu casa, tu nombre, tus regalos y los caminos recorridos', all(r[k] == saved[k] for k in keys) and r['d'] == saved['myName'] and r['day'] == 1 and r['w3'] == 3, f"{ {k: r[k] for k in keys} } / { {k: saved[k] for k in keys} }")
        bad = [u for m, u in reqs if m != 'GET' or not u.startswith((f'http://127.0.0.1:{PORT}/', 'https://cdn.jsdelivr.net/npm/three@', 'https://fonts.', 'data:', 'blob:'))]
        check('no habla con ningún servidor: solo descarga la página, three.js y las letras', not bad, str(bad[:4]))
        await pg.goto(f'http://127.0.0.1:{PORT}/tren.html?dia=15', wait_until='commit')
        await pg.wait_for_function(READY, polling=500, timeout=420000)
        r = await pg.evaluate('({d:__tren.st.day,s:__tren.st.stage,w:__tren.wagons(),l:__tren.st.lights,h:__tren.houses(),m:__tren.st.mine})')
        check('?dia=15 enseña el tren de ese día, con tu casa', r['d'] == 15 and r['s'] == 3 and r['w'] == 8 and r['l'] == 2 and r['h'] > 15 and r['m'] == 0, str(r))

        # 11) móvil: todo cabe y se puede tocar
        mob = await b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
        mp = await mob.new_page()
        mp.on('pageerror', lambda e: errors.append(f'pageerror (móvil): {e}'))
        await route_local_three(mp)
        await mp.goto(f'http://127.0.0.1:{PORT}/tren.html?reiniciar', wait_until='commit')
        await mp.wait_for_function(READY, polling=500, timeout=420000)
        r = await mp.evaluate("""(()=>{const s=document.getElementById('shop').getBoundingClientRect(),its=[...document.querySelectorAll('.it,.po')].map(e=>e.getBoundingClientRect()),
          d=document.querySelector('.day').getBoundingClientRect(),n=document.getElementById('tip').getBoundingClientRect();
          return {sw:document.documentElement.scrollWidth,w:innerWidth,shop:s.bottom<=innerHeight+1,dock:s.height/innerHeight,minW:Math.min(...its.map(r=>r.width)),minH:Math.min(...its.map(r=>r.height)),dayH:d.height,gap:n.top-d.bottom}})()""")
        check('en el móvil caben la cabecera, los avisos, el cruce y las dos fichas', r['sw'] <= r['w'] and r['shop'] and r['dock'] < 0.23 and r['minW'] >= 90 and r['minH'] >= 44 and r['dayH'] < 24 and r['gap'] >= 0, str(r))
        await nav_touch(mob, mp)
        await mp.evaluate('__tren.focus({car:2});__tren.camSettle()')
        await mp.wait_for_timeout(400)
        r = await mp.evaluate("""(()=>{const c=document.getElementById('card').getBoundingClientRect(),s=document.getElementById('shop').getBoundingClientRect();return {l:c.left,r:c.right,b:c.bottom,top:s.top,w:innerWidth,vis:!document.getElementById('card').hidden}})()""")
        check('en el móvil la ficha del vagón cabe encima de las fichas de abajo', r['vis'] and r['l'] >= 0 and r['r'] <= r['w'] and r['b'] <= r['top'], str(r))
        if SHOTS:
            await mp.wait_for_timeout(900)
            await mp.evaluate('__tren.camSettle()')
            await mp.screenshot(path=str(OUT / 'tren-8-movil-vagon.png'), timeout=120000)
        await mp.evaluate('__tren.focus(null)')
        await mp.tap('#tAd')
        r = await mp.evaluate("""(()=>{const c=document.querySelector('#adSheet .card').getBoundingClientRect(),p=document.getElementById('adPrev').getBoundingClientRect();
          return {l:c.left,r:c.right,t:c.top,b:c.bottom,w:innerWidth,h:innerHeight,pw:p.width,sw:document.documentElement.scrollWidth}})()""")
        check('en el móvil el editor de tu marca cabe en la pantalla', r['l'] >= 0 and r['r'] <= r['w'] and r['t'] >= 0 and r['b'] <= r['h'] and r['pw'] > 280 and r['sw'] <= r['w'], str(r))
        if SHOTS:
            await mp.wait_for_timeout(600)
            await mp.screenshot(path=str(OUT / 'tren-5-movil-marca.png'), timeout=120000)
            await mp.click('#adX')
            await mp.wait_for_timeout(2500)
            await mp.screenshot(path=str(OUT / 'tren-6-movil.png'), timeout=120000)
        await mob.close()

        # 12) rendimiento (informativo): vista general a 1200×760 con 1× y 1,5× de resolución
        await pg.evaluate('__tren.look(Math.PI/2,0.62)')
        await pg.wait_for_timeout(2500)
        st = await pg.evaluate('__tren.st')
        print('rendimiento (' + ('GPU' if GPU else 'SwiftShader') + f"), vía {st['stage'] + 1}, {st['houses']} casas, {st['wagons']} vagones:")
        for pr in (1, 1.5):
            m = await pg.evaluate(f'__tren.perf(60,{pr})')
            print(f"  {pr}×: {m['ms']} ms, {m['calls']} draw calls, {m['tris'] // 1000}k triángulos")
        await b.close()
    srv.shutdown()

    check('sin errores de JavaScript ni recursos que fallen', not errors, '\n        '.join(errors[:8]))
    bad = [c for c in checks if not c[1]]
    print(f"\n{len(checks) - len(bad)}/{len(checks)} comprobaciones OK" + ('' if not bad else ' · FALLAN: ' + ', '.join(c[0] for c in bad)))
    sys.exit(1 if bad else 0)

asyncio.run(main())
