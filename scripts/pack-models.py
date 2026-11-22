#!/usr/bin/env python3
"""Empaqueta los .glb de assets-src/ en m/models.json.

Por qué: el hosting de artifacts de Claude no sirve .glb, así que los modelos
viajan como base64 dentro de un JSON y src/main.js los parsea con GLTFLoader.parse().
En un hosting normal (Vercel, Netlify, GitHub Pages) también funciona igual.

Uso:  python scripts/pack-models.py
Para añadir un modelo: copia el .glb en assets-src/kenney/<kit>/ y añádelo a
scripts/models.config.json con una clave corta; luego úsalo en main.js con obj('clave', altura)
o inst('clave', lista). Las texturas (Textures/colormap.png) se resuelven desde m/<kit>/.
"""
import base64, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((root / 'scripts' / 'models.config.json').read_text())
bundle = {}
for key, rel in cfg.items():
    p = root / rel
    kit = p.parent.name  # 'holiday' | 'train'
    bundle[key] = {'p': kit, 'b': base64.b64encode(p.read_bytes()).decode()}
out = root / 'm' / 'models.json'
out.write_text(json.dumps(bundle, separators=(',', ':')))
print(f'{len(bundle)} modelos -> {out} ({out.stat().st_size/1024:.0f} KB)')
