"""Utilidades compartidas por las pruebas: servidor estático y arranque de Chromium."""
import functools, http.server, os, pathlib, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tests' / 'out'
CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'


def serve(port, root=ROOT):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                          '.js': 'application/javascript', '.mjs': 'application/javascript',
                          '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.exr': 'image/x-exr'}

        def log_message(self, *a):
            pass
    h = functools.partial(Quiet, directory=str(root))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def chromium_args(gpu):
    """gpu=True usa la GPU real (Direct3D 11 en Windows); False usa SwiftShader (CPU)."""
    if gpu:
        return ['--no-sandbox', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu']
    return ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']


async def route_local_three(pg):
    """Sin internet: sirve three.js desde THREE_LOCAL (p. ej. node_modules/three)."""
    local = os.environ.get('THREE_LOCAL')
    if not local:
        return
    base = pathlib.Path(local).resolve()

    async def fulfil(route):
        rel = route.request.url[len(CDN):]
        f = base / rel.replace('.module.min.js', '.module.js')
        await route.fulfill(path=str(f), content_type='application/javascript')
    await pg.route(CDN + '**', fulfil)
