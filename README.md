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
npm i                          # three para las pruebas de Node
python tests/e2e.py --shots    # juego completo en Chromium (capturas en tests/out/)
node tests/edge.test.mjs       # validación antitrampas y Edge Function, sin navegador
python tests/perf.py           # coste por fotograma frente a tests/perf-baseline.json
```

## Clasificación global (Supabase)

Sin configurar, la clasificación se guarda solo en el dispositivo. Para tener ranking global:

1. Crea un proyecto en [supabase.com](https://supabase.com) (región en Europa).
2. Enlázalo desde la raíz del repo: `npx supabase login` y `npx supabase link --project-ref <ref>` (el `<ref>` son las 20 letras de la URL del proyecto, `https://<ref>.supabase.co`).
3. Crea la tabla: `npx supabase db push --remote` (pide la contraseña de la base de datos), o pega `supabase/migrations/20261122000000_runs.sql` en el SQL Editor.
   Ojo: con el CLI v3, `db push` sin `--remote` va a la base **local** de Docker, que puede ser la de otro proyecto. Si te sugiere `migration repair` o `db pull`, no lo hagas: falta el `--remote`.
4. Secretos de la función:
   `npx supabase secrets set RUN_SALT=<32 caracteres aleatorios> ALLOWED_ORIGINS=https://tu-dominio,http://localhost:5173 SEASON=2026`
5. Despliega la función: `npx supabase functions deploy submit-run --no-verify-jwt` (añade `--use-api` si Docker no está arrancado).
6. En *Project Settings → API Keys*, copia la **Project URL** y la **publishable key** a las variables `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (en Vercel) o a `config.js` (en local).

Para probar antes de diciembre, añade `ALLOW_ANY_DAY=1` a los secretos y quítalo después.

Cómo funciona: el navegador lee `runs` directamente (solo columnas públicas) y envía cada tiempo con su fantasma a `submit-run`. La función repite la carrera a partir del fantasma (velocidades, aceleraciones, turbos, distancia, campanas y regalos perdidos), rechaza lo imposible y guarda **su propio** total. Solo guarda la mejor marca de cada dispositivo y acepta un envío cada 10 s. La lógica es `src/sim.js`, compartida con el juego. Tras cambiarla: `node scripts/sync-shared.mjs`.

## Desplegar

Es una web estática: vale cualquier hosting (Vercel, Netlify, GitHub Pages, Cloudflare Pages). La configuración pública (ID de afiliado, URL, Supabase) está en `config.js`.

## Recursos y créditos

Modelos 3D de [Kenney](https://kenney.nl) (CC0), HDRI de [Poly Haven](https://polyhaven.com) (CC0) y normal maps de [emmelleppi/normal-maps](https://github.com/emmelleppi/normal-maps) vía `@pmndrs/assets` (CC0). Villancicos de dominio público sintetizados en el navegador. Detalle en `LICENSES.md`.

En calidad de Afiliado de Amazon, se obtienen ingresos por las compras adscritas que cumplen los requisitos aplicables.
