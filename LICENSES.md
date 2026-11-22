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
| Sofá "Sofa_01" | Poly Haven — https://polyhaven.com/a/Sofa_01 | CC0 1.0 | `m/ph/Sofa_01.glb` |
| Butaca "ArmChair_01" | Poly Haven — https://polyhaven.com/a/ArmChair_01 | CC0 1.0 | `m/ph/ArmChair_01.glb` |
| Mesilla "ClassicNightstand_01" | Poly Haven — https://polyhaven.com/a/ClassicNightstand_01 | CC0 1.0 | `m/ph/ClassicNightstand_01.glb` |
| Lámpara "vintage_oil_lamp" | Poly Haven — https://polyhaven.com/a/vintage_oil_lamp | CC0 1.0 | `m/ph/vintage_oil_lamp.glb` |
| Planta "potted_plant_02" | Poly Haven — https://polyhaven.com/a/potted_plant_02 | CC0 1.0 | `m/ph/potted_plant_02.glb` |
| Planta "potted_plant_04" | Poly Haven — https://polyhaven.com/a/potted_plant_04 | CC0 1.0 | `m/ph/potted_plant_04.glb` |
| Jingle Bells (1857), We Wish You a Merry Christmas, Deck the Halls | Tradicionales | Dominio público | Sintetizados en `src/main.js` |
| three.js 0.170.0 | https://threejs.org (CDN jsDelivr) | MIT | `index.html` (importmap) |

Los recursos de Poly Haven se descargan con `scripts/fetch-polyhaven.mjs` (lista en `scripts/polyhaven.json`) y se aligeran con gltf-transform (meshopt, webp, simplificación) y sharp.
