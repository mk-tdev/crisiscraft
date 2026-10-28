# CrisisCraft

A fictional emergency coordination drill: approve a supply delivery, watch the consequences, then rewind one route decision and compare two timelines.

## Current milestone

Implemented on 28 October 2026: a TypeScript workspace, deterministic Harbor Point simulation, schema-validated dispatch, event logs, role-specific observation projections, checkpoint/replay primitives and a local React/Three.js preview.

The preview uses **manual dispatch and authored reports**, labeled in the interface. Meta inference, free-text commands, a server authority, durable sessions, voice and hosted deployment are still pending. This is a fictional rehearsal prototype, not a live emergency-response tool or a validated training product.

## Run locally

Use Node 22.12 or newer (verified with Node 24.18) and npm. From the workspace root:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite, normally `http://127.0.0.1:5173/`. No account, API key or external service is needed for this milestone. Refresh resets the in-memory exercise.

1. Start at minute 2 and choose the bridge or hill route.
2. Approve V1's six-crate delivery; V2 must remain at the depot.
3. Play, advance one minute or run to the end.
4. Choose **Rewind & compare routes**. Both timelines have the same starting state, supplies, reserve constraint and external events.
5. Compare minute 9, the delivery deadline, and minute 15, the final horizon.

## Verify

```sh
npm test
npm run typecheck
npm run build
# Or run all required checks together:
npm run check
```

The test suite covers inventory conservation, capacity, reserve protection, simultaneous arrival and closure ordering, waiting to unload, atomic batch approvals, idempotency, stale revisions, observation boundaries, checkpoint isolation, route tie-breaking and replay hashes. Production output is generated in `apps/web/dist`.

## Workspace

| Path | Purpose |
| --- | --- |
| `apps/web` | React/Vite app, original primitive 3D town and manual controls |
| `packages/contracts` | Shared TypeScript types and runtime schemas |
| `packages/sim` | Pure simulation, routing, metrics, observation projections and replay |
| `scenarios/harbor-point.json` | Versioned authored scenario, road graph and reports |
| `tests/simulation` | Deterministic engine and boundary tests |
| `research` | Hackathon rules, concept and implementation plan |
| `docs` | Engine contract, implementation status, contributions and assets |

The engine imports no renderer, clock, random generator or network client. Its exports are consumed directly by the preview now and can be reused on the server in the next milestone. Checkpoints are internal trusted records; they are not an untrusted file-import endpoint.

## Expected scenario outcomes

| Result | Bridge route | Hill route |
| --- | --- | --- |
| School crates delivered by minute 9 | 0 | 6 |
| School delivery completed | Minute 11 | Minute 8 |
| Completed delivery lateness | 2 minutes | 0 minutes |
| Final unmet demand | 6 crates | 6 crates |
| Final idle trucks at depot | 1 | 1 |

The bridge closes at minute 4. New entry is denied, including for a truck reaching its junction on that tick. A truck already on a closing edge can finish traversing it. Closed-route diversions use deterministic shortest paths. School receiving starts at minute 6. A delivered truck stays at its destination; the MVP does not automatically dispatch it again or return it to depot.

The remaining East shelter demand is intentional: holding one truck in reserve constrains both runs. Metrics describe the authored simulation, not predicted real-world outcomes.

See the [engine contract](docs/simulation-engine.md), [implementation status](docs/implementation-status.md) and [MVP plan](research/crisiscraft-mvp-implementation-plan.md).

## Hackathon provenance

This workspace initially contained research documents and no application code. The application and scenario are new work created during the event. [Contributions](docs/contributions.md) distinguish original work from third-party dependencies; [asset notes](docs/assets-and-licenses.md) record the scene's source. The repository must be public before submission; local setup does not establish public hosting or complete submission.
