# CrisisCraft Implementation Status

Updated 30 October 2026, Singapore time.

## Brew-style rebuild (30 October)

The command room was rebuilt around a crew of three role-bounded characters and the house style shared with Brew & Reason.

- **Crew (`packages/crew`).** Priya (logistics), Malik (shelter) and June (field) each receive a briefing projected by the engine from their own observations. Reports run in parallel. Priya then plans from her briefing and what teammates said, the engine dry-runs the plan, and a refused plan gets one revision with the refusal reason. Turns stream to the browser as NDJSON.
- **Meta Model API provider.** OpenAI-compatible Chat Completions at `https://api.meta.ai/v1`, `muse-spark-1.3` by default, schema-constrained JSON (`response_format: json_schema`), `reasoning_effort: low`. Muse Spark Open on Baseten works by changing `MODEL_BASE_URL` and `MODEL_NAME`.
- **Scripted crew.** Without `MODEL_API_KEY`, a deterministic stand-in reads the same briefings and is labelled *Scripted crew · no model key* in the header.
- **Server authority.** `/api/crew` rebuilds world state from the approved command history with `replay`; it never accepts client state. The same Node handler serves Vite dev and the Vercel function (`npm run build:vercel` → `.vercel/output`).
- **Interface.** Light neutral UI with the orange accent; free-text orders with suggestions; streamed transcript with cited reports and "What they saw" prompt inspection; plan card gated by the rules check; Crew tab showing each role's knowledge; event log with Rewind; minute strip that only reveals past events and known deadlines; four concept cards; generalised decision replay with two synchronized 3D views and an event-grounded debrief.
- **Town.** CC0 Poly Haven sky, textures and props (see [assets](assets-and-licenses.md)); rising water, closable bridge with barriers, school power state, crates matching stock and deliveries, procedural trucks and people, rain and lightning.

## Verification

- `npm run check`: 48 tests (36 engine, 12 crew) pass, strict typecheck passes, production build succeeds.
- Bundled Vercel function smoke-tested locally: streams 7 NDJSON lines ending in a validated hill-road plan.
- Headless Chromium (SwiftShader) drove a full drill at 1440×900 with no console errors: order → reports → plan → approve → run to end → rewind → bridge order → decision replay (A on time at minute 8; B 2 minutes late after the bridge closure), plus a 390-px mobile pass. Screenshots: `docs/screenshots/town.jpg`, `crew.jpg`, `replay.jpg`.

## Not yet done

1. **A live Meta model run.** No API key was available; request shape is unit-tested against a mocked endpoint only. The prompts need tuning against real `muse-spark-1.3` output once credits are claimed.
2. Public deployment, public repository, demo video and submission form.
3. Voice, extra scenarios and facilitator notes remain optional.

The older screenshots (`command-*.png`, `route-comparison.png`) and `command-room-verification.md` describe the previous UI.
