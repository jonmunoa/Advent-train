# Recursos de terceros

| Recurso | Origen | Licencia | Dónde se usa |
|---|---|---|---|
| Holiday Kit (árboles, renos, cascanueces, regalos, farolas, calcetines…) | Kenney — https://kenney.nl/assets/holiday-kit | CC0 1.0 | `assets-src/kenney/holiday`, `m/models.json` |
| Train Kit (locomotora y vagón plataforma) | Kenney — https://kenney.nl/assets/train-kit | CC0 1.0 | `assets-src/kenney/train`, `m/models.json` |
| HDRI "fireplace" (1k) | Poly Haven — https://polyhaven.com/a/fireplace | CC0 1.0 | `m/env/fireplace_1k.exr` |
| Textura "herringbone_parquet" | Poly Haven — https://polyhaven.com/a/herringbone_parquet | CC0 1.0 | `m/ph/herringbone_parquet_*.webp` (suelo) |
| Textura "snow_02" | Poly Haven — https://polyhaven.com/a/snow_02 | CC0 1.0 | `m/ph/snow_02_*.webp` (manta de nieve) |
| Textura "red_brick_03" | Poly Haven — https://polyhaven.com/a/red_brick_03 | CC0 1.0 | `m/ph/red_brick_03_*.webp` (chimenea) |
| Textura "quatrefoil_jacquard_fabric" | Poly Haven — https://polyhaven.com/a/quatrefoil_jacquard_fabric | CC0 1.0 | `m/ph/quatrefoil_jacquard_fabric_nor.webp` (faldón del árbol) |
| Textura "fabric_pattern_07" | Poly Haven — https://polyhaven.com/a/fabric_pattern_07 | CC0 1.0 | `m/ph/fabric_pattern_07_*.webp` (alfombra) |
| Textura "rock_face_03" | Poly Haven — https://polyhaven.com/a/rock_face_03 | CC0 1.0 | `m/ph/rock_face_03_*.webp` (escaparates: roca de los montes) |
| Textura "gravel_stones" | Poly Haven — https://polyhaven.com/a/gravel_stones | CC0 1.0 | `m/ph/gravel_stones_*.webp` (escaparates: balasto) |
| Textura "white_planks_clean" | Poly Haven — https://polyhaven.com/a/white_planks_clean | CC0 1.0 | `m/ph/white_planks_clean_*.webp` (escaparates: madera pintada de casas y escaparates) |
| Textura "stone_brick_wall_001" | Poly Haven — https://polyhaven.com/a/stone_brick_wall_001 | CC0 1.0 | `m/ph/stone_brick_wall_001_*.webp` (escaparates: piedra de viaductos, bocas y fachadas) |
| Textura "painted_plaster_wall" | Poly Haven — https://polyhaven.com/a/painted_plaster_wall | CC0 1.0 | `m/ph/painted_plaster_wall_*.webp` (escaparates: revoco) |
| Textura "cobblestone_floor_04" | Poly Haven — https://polyhaven.com/a/cobblestone_floor_04 | CC0 1.0 | `m/ph/cobblestone_floor_04_*.webp` (escaparates: adoquines de la calle) |
| Textura "weathered_brown_planks" | Poly Haven — https://polyhaven.com/a/weathered_brown_planks | CC0 1.0 | `m/ph/weathered_brown_planks_*.webp` (escaparates: tablas viejas y bancos) |
| Textura "grey_roof_tiles_02" | Poly Haven — https://polyhaven.com/a/grey_roof_tiles_02 | CC0 1.0 | `m/ph/grey_roof_tiles_02_*.webp` (escaparates: tejas) |
| Textura "dark_wood" | Poly Haven — https://polyhaven.com/a/dark_wood | CC0 1.0 | `m/ph/dark_wood_*.webp` (escaparates: traviesas y madera oscura) |
| Textura "pine_bark" | Poly Haven — https://polyhaven.com/a/pine_bark | CC0 1.0 | `m/ph/pine_bark_*.webp` (escaparates: troncos) |
| Ramitas de "fir_tree_01" | Poly Haven — https://polyhaven.com/a/fir_tree_01 | CC0 1.0 | `m/ph/rama.webp`, `rama_nieve.webp` y `abeto.webp`, compuestas con `scripts/rama.py` |
| Sofá "Sofa_01" | Poly Haven — https://polyhaven.com/a/Sofa_01 | CC0 1.0 | `m/ph/Sofa_01.glb` |
| Butaca "ArmChair_01" | Poly Haven — https://polyhaven.com/a/ArmChair_01 | CC0 1.0 | `m/ph/ArmChair_01.glb` |
| Mesilla "ClassicNightstand_01" | Poly Haven — https://polyhaven.com/a/ClassicNightstand_01 | CC0 1.0 | `m/ph/ClassicNightstand_01.glb` |
| Lámpara "vintage_oil_lamp" | Poly Haven — https://polyhaven.com/a/vintage_oil_lamp | CC0 1.0 | `m/ph/vintage_oil_lamp.glb` |
| Planta "potted_plant_02" | Poly Haven — https://polyhaven.com/a/potted_plant_02 | CC0 1.0 | `m/ph/potted_plant_02.glb` |
| Planta "potted_plant_04" | Poly Haven — https://polyhaven.com/a/potted_plant_04 | CC0 1.0 | `m/ph/potted_plant_04.glb` |
| Jingle Bells (1857), We Wish You a Merry Christmas, Deck the Halls | Tradicionales | Dominio público | Sintetizados en `src/main.js` |
| three.js 0.170.0 | https://threejs.org (CDN jsDelivr) | MIT | `index.html` (importmap) |

Los recursos de Poly Haven se descargan con `scripts/fetch-polyhaven.mjs` (lista en `scripts/polyhaven.json`) y se aligeran con gltf-transform (meshopt, webp, simplificación) y sharp.

## Música de los escaparates

No hay ficheros de audio: todo se sintetiza en el navegador (`src/lofi.js`, `src/sonido-tren.js`). Las melodías son villancicos tradicionales o de autores en dominio público (el más reciente, *Away in a Manger*, de 1887); los arreglos son propios.
