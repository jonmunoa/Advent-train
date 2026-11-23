"""Prueba end-to-end de los escaparates (escaparates.html, prototipo) con Playwright.

Portada, paseo de la mano, llegada al cristal, los tres escaparates, vuelta a la calle (da la vuelta), mirar alrededor y
acercarse, seguir solo al cabo de un rato, marcas al tocar (vagón y rótulo), editor y petición, compartir, sonido, que
no se hable con ningún servidor y versión móvil. Falla si hay errores de JavaScript, recursos 404 o alguna comprobación no se cumple.

Uso:
  python tests/esc.py [--shots] [--gpu]
"""
import asyncio, math, sys
from playwright.async_api import async_playwright
from harness import ROOT, OUT, serve, chromium_args, route_local_three

sys.stdout.reconfigure(encoding='utf-8')
PORT, SHOTS, GPU, checks = 8769, '--shots' in sys.argv, '--gpu' in sys.argv, []
READY = 'window.__esc && window.__esc.listo'


def check(name, cond, info=''):
    checks.append((name, bool(cond)))
    print(('  ok   ' if cond else '  FALLO ') + name + (f'  {info}' if info else ''))


async def abrir(pg, errors, quien=''):
    pg.on('pageerror', lambda e: errors.append(f'pageerror {quien}: {e}'))
    pg.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
    await route_local_three(pg)
    await pg.goto(f'http://127.0.0.1:{PORT}/escaparates.html', wait_until='commit')
    await pg.wait_for_function(READY, polling=500, timeout=420000)
    await pg.evaluate('window.__noAdapt=true')


async def main():
    srv, errors, reqs = serve(PORT, ROOT), [], []
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=chromium_args(GPU))
        ctx = await b.new_context(viewport={'width': 1200, 'height': 760})
        await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg = await ctx.new_page()
        pg.on('request', lambda r: reqs.append((r.method, r.url)))
        await abrir(pg, errors)
        shot = lambda n: pg.screenshot(path=str(OUT / f'esc-{n}.png'), timeout=120000)

        # 1) portada y paseo
        r = await pg.evaluate("({st:__esc.st,btn:document.getElementById('go').textContent,dis:document.getElementById('go').disabled,hud:getComputedStyle(document.getElementById('foot')).opacity,m:__esc.manos()})")
        check('portada: la calle espera detrás, sin controles, y el botón invita a dar la mano', r['st'] == 'inicio' and r['btn'] == 'Dame la mano' and not r['dis'] and float(r['hud']) < 0.1, str(r))
        if SHOTS:
            await pg.wait_for_timeout(900)
            await shot('1-portada')
        await pg.evaluate('__esc.step(1)')
        r = await pg.evaluate('({m:__esc.manos(),p:__esc.pos()})')
        check('mientras esperan van cogidos de la mano', r['m'] < 4, f"manos a {r['m']:.1f} (45 = 1 m)")
        await pg.click('#go')
        await pg.wait_for_timeout(300)
        r = await pg.evaluate("(()=>{__esc.hold(true);const x0=__esc.pos().m[0];let worst=0,feet=0;for(let i=0;i<24;i++){__esc.step(.04);worst=Math.max(worst,__esc.manos())}return {st:__esc.st,dx:__esc.pos().m[0]-x0,worst,p:__esc.pos()}})()")
        check('al empezar andan hacia el primer escaparate sin soltarse', r['st'] == 'paseo' and r['dx'] > 6 and r['worst'] < 5 and r['p']['n'][0] > r['p']['m'][0], str({k: r[k] for k in ('st', 'dx', 'worst')}))
        if SHOTS:
            await pg.evaluate('document.body.classList.remove("quieto")')
            await pg.wait_for_timeout(1300)
            await shot('2-paseo')

        # 2) los tres escaparates
        nombres = []
        for k in range(3):
            if k:
                await pg.evaluate(f'__esc.ir({k})')
                r = await pg.evaluate("(()=>{let w=0,v=0,prev=__esc.cam().p;for(let i=0;i<900&&!(__esc.st==='mira'&&__esc.n===%d);i++){__esc.step(1/30);const q=__esc.cam().p;w=Math.max(w,0);prev=q}return __esc.st})()" % k)
            else:
                await pg.evaluate("(()=>{for(let i=0;i<900&&__esc.st!=='mira';i++)__esc.step(1/30)})()")
            await pg.evaluate('__esc.step(16)')
            r = await pg.evaluate("({st:__esc.st,n:__esc.n,p:__esc.pos(),u:__esc.E.u,cap:document.getElementById('capN').textContent,cs:document.getElementById('capS').textContent,vis:__esc.mundos.map(m=>m.g.visible),cam:__esc.cam()})")
            nombres.append(r['cap'])
            X = 340 * k
            check(f'escaparate {k + 1}: el niño llega al cristal, la madre espera detrás y la cámara se acerca a la maqueta', r['st'] == 'mira' and r['n'] == k and abs(r['p']['n'][0] - X) < 40 and r['p']['n'][2] < 12 and r['p']['m'][2] > 20 and abs(r['p']['yn'] - math.pi / 2) < 0.2 and r['u'] > 0.4 and r['vis'][k] and abs(r['cam']['p'][0] - X) < 75 and str(k + 1) in r['cs'], str({q: r[q] for q in ('st', 'n', 'u', 'cap')}))
            if SHOTS:
                await pg.evaluate('__esc.hold(false);document.body.classList.remove("quieto")')
                await pg.wait_for_timeout(700)
                await shot(f'3-escaparate{k + 1}')
                await pg.evaluate('__esc.hold(true)')
        check('cada escaparate tiene su circuito', len(set(nombres)) == 3, str(nombres))
        r = await pg.evaluate("(()=>{const a=[];for(let i=0;i<60;i++){__esc.step(.1);a.push(__esc.pos().hn)}return [Math.min(...a),Math.max(...a)]})()")
        check('el niño sigue el tren con la cabeza', r[1] - r[0] > 0.02, str(r))
        r = await pg.evaluate("(()=>{const m=__esc.mundos[2],s0=m.tren.s;__esc.step(2);return (m.tren.s-s0+m.T.L)%m.T.L/2})()")
        check('el tren da vueltas despacio', 5.5 < r < 7, f'{r:.2f} u/s')
        r = await pg.evaluate("(()=>{const T=__esc.mundos[2].tren;let w=0,prev=T.cars.map(c=>c.position.toArray());for(let i=0;i<1600;i++){__esc.mundos[2].update(.05,i*.05);const q=T.cars.map(c=>c.position.toArray());q.forEach((a,j)=>{w=Math.max(w,Math.hypot(a[0]-prev[j][0],a[1]-prev[j][1],a[2]-prev[j][2]))});prev=q}return w})()")
        check('una vuelta entera sin saltos', r < 0.6, f'mayor paso {r:.2f}')
        # la calle da la vuelta
        await pg.evaluate("__esc.ir(3);(()=>{for(let i=0;i<900&&!(__esc.st==='mira'&&__esc.n===3);i++)__esc.step(1/30)})()")
        r = await pg.evaluate("({st:__esc.st,n:__esc.n,cap:document.getElementById('capN').textContent,vis:__esc.mundos.map(m=>m.g.visible)})")
        check('después del tercero se vuelve al primero: la calle da la vuelta', r['st'] == 'mira' and r['n'] == 3 and r['cap'] == nombres[0] and r['vis'][0], str(r))
        await pg.evaluate("__esc.ir(2);(()=>{for(let i=0;i<900&&!(__esc.st==='mira'&&__esc.n===2);i++)__esc.step(1/30)})()")
        r = await pg.evaluate('({st:__esc.st,n:__esc.n})')
        check('también se puede volver hacia atrás', r['st'] == 'mira' and r['n'] == 2, str(r))

        # 3) mirar alrededor y acercarse
        await pg.evaluate('__esc.step(3);__esc.hold(false)')
        a = await pg.evaluate('({c:__esc.cam(),u:__esc.E.uT})')
        await pg.mouse.move(600, 380)
        await pg.mouse.down()
        await pg.mouse.move(420, 340, steps=8)
        await pg.mouse.up()
        await pg.evaluate('__esc.step(3)')
        c = await pg.evaluate('({c:__esc.cam(),az:__esc.E.az})')
        check('arrastrar mira alrededor', c['az'] > 0.1 and math.dist(a['c']['p'], c['c']['p']) > 6, str(c))
        for _ in range(8):
            await pg.mouse.wheel(0, -200)
        await pg.evaluate('__esc.step(4)')
        z = await pg.evaluate('({c:__esc.cam(),u:__esc.E.u,f:+document.getElementById("frost").style.opacity})')
        check('la rueda acerca hasta pegar la nariz al cristal (escarcha en los bordes), y la cámara no lo atraviesa', z['u'] > 0.9 and z['c']['p'][2] < 60 and z['c']['p'][2] > 10 and z['f'] > 0.3, str(z))
        if SHOTS:
            await shot('4-nariz')
        await pg.evaluate('__esc.mirar(.5);__esc.step(4)')

        # 4) al cabo de un rato siguen paseando solos
        r = await pg.evaluate("(()=>{__esc.hold(true);const n=__esc.n;__esc.step(100);const a=__esc.n;__esc.step(30);return {n,a,b:__esc.n}})()")
        check('si nadie toca nada, al rato siguen paseando al siguiente', r['a'] == r['n'] and r['b'] == r['n'] + 1, str(r))
        await pg.evaluate("(()=>{for(let i=0;i<900&&__esc.st!=='mira';i++)__esc.step(1/30);__esc.step(6)})()")

        # 5) marcas
        await pg.evaluate("__esc.ir(__esc.n+1);(()=>{for(let i=0;i<900&&!(__esc.st==='mira');i++)__esc.step(1/30);const m=__esc.mundos[((__esc.n%3)+3)%3];__esc.mirar(.45);m.tren.s=m.T.L*.14;__esc.step(5)})()")
        k = await pg.evaluate('((__esc.n%3)+3)%3')
        r = await pg.evaluate(f"({{v:__esc.vagon({k},0),q:null}})")
        q = await pg.evaluate(f"__esc.queHay({r['v']['x']},{r['v']['y']})")
        await pg.mouse.click(r['v']['x'], r['v']['y'])
        c = await pg.evaluate("({h:document.getElementById('card').hidden,n:document.getElementById('caName').textContent,t:document.getElementById('caTag').textContent,a:document.getElementById('caGo').href,rel:document.getElementById('caGo').rel,tg:document.getElementById('caGo').target,go:!document.getElementById('caGo').hidden,free:!document.getElementById('caFree').hidden,s:__esc.sitios()})")
        ad = c['s'][str(k + 1)].get('1')
        check('tocar un vagón enseña su marca', not c['h'] and q and q['k'] == k and ad and c['n'] == ad['text'] and 'Vagón 1' in c['t'], str({x: c[x] for x in ('h', 'n', 't')}))
        check('si la marca tiene web, «Visitar» la abre en otra pestaña y marcada como patrocinada', (not ad.get('url')) or (c['go'] and c['a'].startswith('https://www.example.com') and c['tg'] == '_blank' and 'sponsored' in c['rel'] and 'noopener' in c['rel']), str({x: c[x] for x in ('a', 'rel', 'go')}))
        await pg.click('#caX')
        await pg.evaluate('__esc.mirar(0);__esc.step(6)')
        v = await pg.evaluate(f'__esc.rotulo({k})')
        await pg.mouse.click(v['x'], v['y'])
        c = await pg.evaluate("({h:document.getElementById('card').hidden,t:document.getElementById('caTag').textContent,free:!document.getElementById('caFree').hidden})")
        check('tocar el rótulo de una tienda sin marca ofrece el sitio', not c['h'] and 'Rótulo' in c['t'] and 'libre' in c['t'] and c['free'], str(c))
        await pg.click('#caFree')
        await pg.fill('#adText', 'Vivero Abeto Verde')
        await pg.fill('#adUrl', 'javascript:alert(1)')
        await pg.click('#adAsk')
        r = await pg.evaluate("({e:document.getElementById('adErr').textContent,ok:document.getElementById('adOk').hidden,tab:document.getElementById('tabRot').getAttribute('aria-selected')})")
        check('un enlace que no es una web no se acepta', 'enlace' in r['e'] and r['ok'] and r['tab'] == 'true', str(r))
        await pg.fill('#adUrl', 'vivero-abeto.es')
        await pg.click('#adAsk')
        await pg.wait_for_function("!document.getElementById('adOk').hidden", timeout=5000)
        r = await pg.evaluate('navigator.clipboard.readText()')
        check('pedir el sitio copia los datos (no se envía nada)', all(x in r for x in ('rótulo', f'escaparate {k + 1}', 'Vivero Abeto Verde', 'https://vivero-abeto.es/', '€')), r[:120])
        if SHOTS:
            await shot('5-marca')
        await pg.click('#adSee')
        await pg.wait_for_timeout(300)
        r = await pg.evaluate(f"({{ad:__esc.tiendas[{k}].ad&&__esc.tiendas[{k}].ad.text,b:!document.getElementById('prevBack').hidden}})")
        await pg.click('#prevBack')
        await pg.wait_for_timeout(300)
        r['after'] = await pg.evaluate(f'__esc.tiendas[{k}].ad')
        check('«Ver cómo queda» la pone en el letrero y al volver se quita', r['ad'] == 'Vivero Abeto Verde' and r['b'] and r['after'] is None, str(r))
        await pg.click('#adX')

        # 6) compartir, sonido y red
        await pg.evaluate("Object.defineProperty(navigator,'share',{value:undefined,configurable:true})")
        await pg.click('#bShare')
        await pg.wait_for_timeout(300)
        r = await pg.evaluate('navigator.clipboard.readText()')
        check('compartir copia el enlace sin parámetros', r.endswith('/escaparates.html'), r)
        await pg.click('#bSon')
        check('el sonido se puede quitar y se recuerda', await pg.evaluate("document.getElementById('bSon').classList.contains('off')&&localStorage.getItem('advx-sonido')==='0'"))
        bad = [u for m, u in reqs if m != 'GET' or not u.startswith((f'http://127.0.0.1:{PORT}/', 'https://cdn.jsdelivr.net/npm/three@', 'https://fonts.', 'data:', 'blob:'))]
        check('no habla con ningún servidor: solo descarga la página, three.js y las letras', not bad, str(bad[:4]))
        for q, (n, js) in enumerate([('paseo', "__esc.ir(__esc.n+1);__esc.step(4.5)"), ('mirando', "(()=>{for(let i=0;i<900&&__esc.st!=='mira';i++)__esc.step(1/30);__esc.mirar(.6);__esc.step(6)})()")]):
            await pg.evaluate(js)
            m = await pg.evaluate('__esc.perf(60,1)')
            print(f"rendimiento {n}: {m['ms']} ms a 1×, {m['calls']} draw calls, {m['tris'] // 1000}k triángulos")
        await ctx.close()

        # 7) móvil
        mob = await b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
        mp = await mob.new_page()
        await abrir(mp, errors, '(móvil)')
        if SHOTS:
            await mp.wait_for_timeout(900)
            await mp.screenshot(path=str(OUT / 'esc-6-movil-portada.png'), timeout=120000)
        await mp.tap('#go')
        await mp.evaluate("(()=>{__esc.hold(true);for(let i=0;i<900&&__esc.st!=='mira';i++)__esc.step(1/30);__esc.step(2)})()")
        r = await mp.evaluate("""(()=>{const R=q=>document.querySelector(q).getBoundingClientRect(),f=R('#foot'),a=R('#bAd'),n=R('#bNext');return {sw:document.documentElement.scrollWidth,w:innerWidth,fb:f.bottom<=innerHeight,fl:f.left,fr:f.right,btn:n.width,gap:f.top-a.bottom,u:__esc.E.u,n:__esc.pos().n[0]}})()""")
        check('en el móvil los controles caben y el niño se pone a un lado para no tapar', r['sw'] <= r['w'] and r['fb'] and r['fl'] >= 0 and r['fr'] <= r['w'] and r['btn'] >= 44 and r['gap'] >= 0 and r['n'] < -45, str(r))
        cdp = await mob.new_cdp_session(mp)
        tch = lambda t, pts: cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
        await tch('touchStart', [(150, 400)])
        await tch('touchStart', [(150, 400), (220, 400)])
        for q in range(1, 9):
            await tch('touchMove', [(150 - q * 9, 400), (220 + q * 9, 400)])
            await mp.wait_for_timeout(16)
        await tch('touchEnd', [])
        await mp.evaluate('__esc.step(4)')
        u = await mp.evaluate('__esc.E.u')
        check('pellizcar acerca al cristal', u > r['u'] + 0.15, f"{r['u']:.2f} → {u:.2f}")
        await mp.tap('#bAd')
        r = await mp.evaluate("(()=>{const c=document.querySelector('#adSheet .card').getBoundingClientRect();return {l:c.left,r:c.right,t:c.top,b:c.bottom,w:innerWidth,h:innerHeight}})()")
        check('el editor de marcas cabe en el móvil', r['l'] >= 0 and r['r'] <= r['w'] and r['t'] >= 0 and r['b'] <= r['h'], str(r))
        await mp.tap('#adX')
        if SHOTS:
            await mp.evaluate('__esc.hold(false);__esc.mirar(.75);__esc.step(8)')
            await mp.wait_for_timeout(900)
            await mp.screenshot(path=str(OUT / 'esc-7-movil.png'), timeout=120000)
        await b.close()
    srv.shutdown()
    check('sin errores de JavaScript ni recursos que fallen', not errors, '\n        '.join(errors[:8]))
    bad = [c for c in checks if not c[1]]
    print(f"\n{len(checks) - len(bad)}/{len(checks)} comprobaciones OK" + ('' if not bad else ' · FALLAN: ' + ', '.join(c[0] for c in bad)))
    sys.exit(1 if bad else 0)

asyncio.run(main())
