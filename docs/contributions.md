# Hackathon Contributions

## Starting state

At the beginning of implementation, the workspace contained only `research/` documents. There was no application source, dependency manifest or Git repository. The research and concept were recorded on 26–27 October 2026; app implementation began on 28 October 2026, Singapore time.

## New work on 28 October 2026

Built in this workspace during the hackathon using coding assistance:

- CrisisCraft app structure, UI, manual approval flow and original primitive 3D town.
- Harbor Point scenario data, road layout and authored character observations.
- Deterministic state transitions, routing, resource constraints, command validation and metric calculations.
- Checkpoint isolation, command replay and the controlled route comparison.
- Shared contracts, automated tests and implementation documentation.

Third-party packages provide rendering, UI, build tooling and schema validation. Their implementations are not claimed as original work. Research citations and conceptual inspirations are not imported source or assets.

## New work on 29 October 2026

- Replaced the first preview with the CrisisCraft command room: mission framing, persistent approval controls, team radio, event log, inspectors, playback timeline and responsive layouts.
- Built an original procedural coastal town with neighbourhoods, a quay, boats, water tower, street lamps, shelter queues, response crews, warehouse stock and rescue trucks. Added original inline SVG character portraits and interface icons.
- Added camera orbit/zoom, four camera presets, convoy tracking, projected location buttons, rain/label controls and vehicle orientation/interpolation. Decorative motion does not alter simulation state or represent autonomous AI behaviour.
- Rebuilt decision replay with a shared clock, outcome badges, consequence explanation, alternative-route retry and downloadable run evidence.
- Verified both route outcomes in the browser and checked mobile layout and keyboard access.

The referenced **Assess hackathon eligibility** and **Preview agentic coffee shop** chats and app screenshots informed the interaction benchmark. No source, models, images or other assets from those projects were copied into CrisisCraft. The 3D scenery and presentation assets above were authored in this workspace during the event.

## New work on 30 October – 1 November 2026

- Rebuilt the interface around Priya, Malik and June: free-text/voice orders, bounded role briefings, streamed radio, inspectable prompts and checked dispatch tickets.
- Added Meta Model API integration, Muse Voice Transcribe, Priya's engine-backed planning tools, peer review/revision, crew initiative, and optional Muse Spark Autopilot.
- Added generated drill imagery using Muse Image, SAM 3.1 segmentation and Muse Spark interpretation, plus a model-written after-action review with event-ID checks.
- Expanded the original procedural town into a wider coastal region and added the CC0 Poly Haven materials/props inventoried in [assets-and-licenses.md](assets-and-licenses.md).
- Added local/Vercel Node handlers, provider tests and the recorded [30 live crew evaluations](eval/crew-eval.md).
- Fixed stale Autopilot responses after takeover/reset, added total model-workflow deadlines and explicit stream errors, corrected water overlap to intersect both segmentation masks, and added targeted regression tests.

## New work on 1–2 November 2026

- Added a second scenario, **Harbor Point Region** (`scenarios/harbor-point-region.json`). It is a 50-minute drill across the expanded town:
  - a port depot;
  - four places in need: care home, hill school, village hall across the bay, field hospital;
  - four trucks;
  - three hazards: the harbour bridge closure, the tidal causeway, and a false landslide report.
- Extended the engine in three ways:
  - roads can reopen;
  - per scenario, trucks drive back to the depot to reload;
  - road and vehicle names are stored in the scenario.

  Engine tests play the intended solution and each trap.
- Added a scenario picker in the mission briefing. The crew, endpoints and interface now play any scenario: names, crew posts, chips, suggestions, replay outcomes and debriefs all follow the chosen drill. A general scripted crew covers scenarios beyond the tutorial.
- Added the **Rescue Helicopter**:
  - travel modes in the engine, so aircraft fly only air routes and trucks drive only roads;
  - gusts that close the air routes from minute 20 to 25;
  - aircraft excluded from the truck reserve;
  - mode-aware briefings, planning tools and instructions;
  - a procedural coastguard helicopter model, helipads and landing zones, take-off, flight and landing animation, sky arcs for flights, and grounded visuals.
- Added the **Agents panel**: a live pipeline and timing chart built from per-turn start offsets the server now records, every model call with its exact instructions and briefing, and the run's journey of orders, initiatives, photos and Autopilot moves.
- Made the 3D world object-aware:
  - scenery kept clear of every truck route by its footprint;
  - traffic that yields to moving rescue trucks and keeps its distance;
  - pedestrians who pause for trucks.

  All placement is computed once at load.

## Contribution boundaries for the demo

The team may demonstrate the implemented live Meta features when the deployment is configured and they actually run. Without credentials, the product uses explicitly labelled scripted behaviour; do not present that mode as live inference. The engine remains responsible for valid actions and deterministic outcomes. Generated field images are synthetic scenario illustrations, not real observations. Event-ID checks establish citation existence, not the truth of every generated explanation.

Original scenario logic, prompts, orchestration, controls, procedural art and reliability work were built in this workspace during the event with coding assistance. React, Three.js, model services, SAM's parser and Poly Haven art are third-party contributions and are not claimed as team-built models, libraries or assets. The research and reference projects are inspirations, not imported implementations.

## Team attribution and release record

The public repository is [mk-tdev/crisiscraft](https://github.com/mk-tdev/crisiscraft), on `main`. The GitHub account identifies the repository owner; it does not establish every contributor's legal identity or eligibility. Before submitting, the representative must list the actual team members and map their contributions to the work above. Those names have not been supplied in this workspace and must not be invented or replaced with the fictional crew names.

The production alias is https://crisiscraft.vercel.app; unauthenticated HTML and provider-status GET checks passed on 1 November. The [production browser rehearsal](production-browser-rehearsal.md) covers the latest application flows. Physical microphone rehearsal, final three-minute video link, track and complete submission roster remain to be confirmed. Git history and the dated work log support provenance but do not complete the submission form.

## Production rehearsal fixes — 1 November 2026

Browser-driven testing found and fixed reset leaving Autopilot enabled, voice/transcript work surviving a reset or branch, retained field-photo/review state, and clipped phone replay controls. Five media lifecycle regressions bring the suite to 90 tests. The production checks used real Meta responses and a synthetic microphone stream; they do not claim physical-device or validated training coverage.
