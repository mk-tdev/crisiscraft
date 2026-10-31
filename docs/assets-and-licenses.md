# Assets and Dependency Rights

## Original materials

Harbor Point is a fictional map created for CrisisCraft during the hackathon. Buildings, roads, trees, trucks and water are generated in source from geometric primitives. The scenario, character names, reports, UI styles and demonstration text are authored for this project. No real town map, satellite image, character model or disaster dataset is included; the CC0 scene assets below are the only third-party art.

The UI uses system font fallbacks and makes no external font request. No generated bitmap, stock photograph, music or voice asset is required for this milestone.

The 29 October command-room upgrade adds original SVG portraits/icons and source-generated buildings, crews, quay, boats, streetlights and water tower. The screenshots in `docs/screenshots/command-*.png` are captures of CrisisCraft itself. Reference screenshots from Brew & Reason and Why That Goal were inspected for design direction only and are not distributed with this project.

## Third-party scene assets (CC0)

The 30 October living-town rebuild adds CC0 assets from [Poly Haven](https://polyhaven.com/license) under `apps/web/public/assets`, fetched by `python3 scripts/fetch-assets.py` (about 29 MB). CC0 requires no attribution; they are listed so the inventory stays complete. Trees, people, trucks, houses, shelters, the bridge and water remain original procedural geometry.

| Type | Poly Haven ID | Use in the scene |
| --- | --- | --- |
| HDRI (1k) | `kloofendal_overcast_puresky` | Overcast sky, ambient light and reflections |
| Texture (1k diffuse, normal, ARM) | `leafy_grass` | Lawns and open ground |
| Texture (1k diffuse, normal, ARM) | `asphalt_02` | Road surfaces |
| Texture (1k diffuse, normal) | `brushed_concrete` | Kerbs, junctions, depot apron |
| Texture (1k diffuse, normal) | `damp_beach_sand` | River banks and shoreline |
| Texture (1k diffuse, normal) | `painted_plaster_wall` | House and east-shelter walls |
| Texture (1k diffuse, normal) | `brick_wall_001` | School shelter walls |
| Texture (1k diffuse, normal) | `grey_roof_tiles` | Pitched roofs |
| Texture (1k diffuse, normal) | `corrugated_iron` | Supply depot walls and roof |
| Texture (1k diffuse, normal) | `weathered_planks` | Harbour quay |
| Model (glTF, 1k) | `concrete_road_barrier_02` | Bridge closure barriers |
| Model (glTF, 1k) | `street_lamp_02` | Street lamps |
| Model (glTF, 1k) | `painted_wooden_bench` | Benches near the shelters |
| Model (glTF, 1k) | `shrub_03`, `shrub_sorrel_01` | Roadside planting |
| Model (glTF, 1k) | `Barrel_01`, `medical_box`, `plastic_crate_02` | Depot dressing (relief crates themselves are procedural) |

Painted signs (ROAD CLOSED, SCHOOL SHELTER and similar), hazard stripes, route chevrons, ripple normals and flood-edge masks are generated at runtime on a canvas.

## Runtime and tooling dependencies

React, React DOM, Three.js, React Three Fiber, Zod, Vite, TypeScript and Vitest supply third-party functionality. Exact installed versions and transitive packages are recorded in `package-lock.json`; upstream license texts are distributed with their installed packages. Preserve applicable notices when redistributing the application. Dependency use is separate from the team's original contribution claims.

Do not reuse source or assets from Village of Shadows, BatchLens, Open Disaster or other hackathon projects without checking their specific rights. They currently serve only as conceptual references.

## Before public submission

Select a repository source license deliberately, retain dependency notices, and update this inventory for any added fonts, models, images, audio or datasets. The organizer's public-repository requirement does not by itself choose a source license for the team.
