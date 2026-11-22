# Adviento Express 🚂🎄

Calendario de Adviento jugable: cada día del 1 al 24 de diciembre se abre una puerta con un circuito nuevo de tren de juguete en 3D. Conduce, apura las curvas para cargar el turbo, haz sonar las campanas encadenando combos, no pierdas los regalos en las curvas, bate a tu fantasma y consigue la medalla de oro.

## Probar en local

```bash
npx serve -l 5173 .
# o
python -m http.server 5173
```

Abre `http://localhost:5173`. Antes del 1 de diciembre solo está abierta la puerta 1; marca "Modo pruebas" al final del calendario para abrir todas.

## Controles

| Acción | Teclado | Móvil |
|---|---|---|
| Dar vapor | Espacio / ↑ / W | Mantener pulsado el botón VAPOR o la pantalla |
| Frenar | Soltar (↓ / S frena más) | Soltar |
| Turbo (con la barra llena) | E / Mayús | Botón TURBO |
| Cambiar cámara | C | Botón cámara |
| Repetir | R | Botón en la pausa o en la llegada |
| Pausa | P / Esc | Botón pausa |

## Pruebas

```bash
pip install playwright && python -m playwright install chromium
python tests/e2e.py --shots
```

## Desplegar

Es una web estática: vale cualquier hosting (Vercel, Netlify, GitHub Pages, Cloudflare Pages). Antes de publicar:

1. En `src/main.js`, cambia `TAG` por tu ID de afiliado de Amazon y `SITE_URL` por tu dominio.
2. Sustituye el adaptador `Board` (clasificación) por un backend real si quieres ranking global.

## Recursos y créditos

Modelos 3D de [Kenney](https://kenney.nl) (CC0), HDRI de [Poly Haven](https://polyhaven.com) (CC0) y normal maps de [emmelleppi/normal-maps](https://github.com/emmelleppi/normal-maps) vía `@pmndrs/assets` (CC0). Villancicos de dominio público sintetizados en el navegador. Detalle en `LICENSES.md`.

En calidad de Afiliado de Amazon, se obtienen ingresos por las compras adscritas que cumplen los requisitos aplicables.
