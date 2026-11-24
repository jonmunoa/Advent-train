# Plan gráfico: realismo a 60 fps (pedido por Jon el 24 de noviembre de 2026)

Encargo: «gráficos rollo GTA, muy realista, de locos, y los FPS a 60». Las iteraciones que hagan falta. Los escaparates (`escaparates.html`) son lo único que se toca.
Reglas: sin push; pruebas con `python tests/esc.py --gpu` (sin `--gpu` fallan las de tiempos); cada cambio con su medida; commits pequeños; publicar en el artifact al cerrar cada bloque.
Descargas autorizadas por Jon (CC0): MakeHuman system assets, skins01, skins02, faceunits01 y MPFB2 (en `assets-src/makehuman/zip`, fuera de git) y Poly Haven. npm de desarrollo: `three-mesh-bvh`.

## Punto de partida (v24, Radeon 860M integrada, a 1×, MSAA ×4)
| | 1600×900 | 1920×1080 | llamadas | triángulos |
|---|---|---|---|---|
| andando | 14,0 ms | 17,1 ms | 461 | 1,33 M |
| mirando | 13,4 ms | 16,0 ms | 240 | 1,25 M |
| dentro | 12,8 ms | 14,8 ms | 163 | 0,91 M |

## Qué delata que no es real (ordenado por lo que pesa)
1. Las personas son muñecos (cabezón, ojos enormes).
2. Luz plana: hemisférica sin oclusión, sin luz rebotada, casi sin sombras.
3. El suelo no refleja y la nieve es un plano morado.
4. Fachadas de cajas, cantos vivos, sin suciedad.
5. Color muy saturado; copos como discos blancos; halos planos.
6. Maquetas: montañas moradas, terreno liso, casas simples.

## Bloques
- [ ] A. Motor: GTAO a media resolución, niebla con luz (dispersión analítica de farolas y escaparates), bloom sin umbral, AgX con revelado, exposición automática, escalado con nitidez, reflejos del entorno capturados de la propia calle.
- [ ] B. Luz horneada de la calle (trazado de rayos sin conexión con `three-mesh-bvh`, por vértice, con dirección dominante); capas: cielo, luces, escaparates. Sondas para las personas.
- [ ] C. Suelo: adoquín mojado, nieve pisada y charcos con reflejos en pantalla (SSR) en ordenador y reflejos estirados en el móvil.
- [ ] D. Personas: MakeHuman (proporciones y piel reales) sobre el esqueleto de las escenas; abrigos con pliegues simulados.
- [ ] E. Fachadas y atrezo con más detalle (molduras, cantos romos, nieve acumulada, suciedad).
- [ ] F. Maquetas: oclusión, luz de farolas en el terreno, sierra y cielo fotográficos, materiales.
- [ ] G. 60 fps: menos llamadas, escalado dinámico, móvil sin tope de 40.

## Bitácora
