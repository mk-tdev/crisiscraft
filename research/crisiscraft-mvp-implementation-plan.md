# CrisisCraft Hackathon MVP Implementation Plan

Status: Plan created 27 October 2026. Implementation started 28 October 2026; see [implementation status](../docs/implementation-status.md) for completed milestones and remaining work.

Build one complete interaction: **command → character reports → validated proposal → human approval → visible deliveries → rewind → alternative route → comparison**. Protect this loop before adding voice or richer scenery.

The [concept](crisiscraft-concept.md) defines the product. The [event research](meta-global-ai-developer-hackathon.md) records organizer rules, resources and judging. The external deadline is **5 November 2026 at 10:00 AM Singapore time**. Target submission by **4 November at 8:00 PM Singapore time**, leaving a 14-hour buffer.

## Planning assumptions and decisions

- Plan for one primary builder, approximately 50 focused engineering hours, plus 6 hours of contingency. If time available is lower, apply the scope cuts below immediately.
- All schedule dates and daily targets below use Singapore time.
- Use a browser-based product with a stylized, elevated 3D scene. Optimize for a laptop and a 1280 × 720 demo recording.
- One training run covers 15 simulated minutes; explicit controls pause or accelerate time.
- Text input is required. Voice is a stretch goal and never blocks submission.
- Two vehicles, three characters, one supply type, two destination requests and one branch checkpoint are sufficient.
- Assume Indie Developer for planning; confirm track before submission. No track is selected by this document.
- Treat model/provider selection as an early access check, not an established API contract.
- Build begins 27 October Singapore time; preserve dated commits and identify all new work. The organizer's build-start ambiguity remains recorded in event research.

## Scope and release gate

| Priority | Capability | Release condition |
| --- | --- | --- |
| P0 | Deterministic scenario engine | Conserves supplies, enforces routes and produces repeatable outcomes |
| P0 | 3D town and vehicles | Locations, closures and truck movement are immediately legible |
| P0 | Three Meta-backed roles | Reports reflect permitted information and feed a concrete proposal |
| P0 | Command and approval | Free text becomes a plan; approved valid actions alone change the world |
| P0 | Branching replay | Restore a checkpoint and compare one changed route under identical scenario events |
| P0 | Metrics and debrief | Metrics come from simulation events; explanations cite those events |
| P0 | Shareable deployment | Judge can open and complete the flow without local setup or personal API keys |
| P0 | Submission evidence | Public repo, three-minute video, contribution record and all contributors listed |
| P1 | Push-to-talk | User can review transcription before submitting the command |
| P2 | Character speech and richer effects | Added only after the complete deployed P0 loop passes |

## Proposed architecture

Use TypeScript throughout. Proposed components are React for interface state, Three.js through React Three Fiber for the town, a pure TypeScript simulation module, a schema validator such as Zod for model outputs, and a small Node HTTP service for provider requests and authoritative session commands. These are design choices; choose compatible package versions when scaffolding and commit a lockfile.

Host the frontend and API under one origin where practical. Select a host supporting a Node service for the MVP, rather than assuming long-running process support from a particular serverless host. Use a small local SQLite store on persistent disk for session snapshots and logs; if the chosen host cannot provide durable disk, use its supported persistent database before claiming refresh recovery. Avoid a multi-service deployment.

| Component | Responsibility | Must not do |
| --- | --- | --- |
| Scenario data | Road graph, capacities, requests, scheduled events and observation rules | Contain real emergency data |
| Simulation engine | Pure state transitions, event ordering, validation and metrics | Call models, read wall-clock time or depend on rendering |
| Session service | Advance ticks, serialize mutations, save runs and enforce revisions | Accept client-authored world state as authoritative |
| Meta adapter | Format bounded role context, call provider and parse response | Expose credentials to the browser |
| Role coordinator | Run three role calls and combine proposed constraints | Feed one role another role's private observations silently |
| Presentation | Render scene, reports, plan editor and comparison | Invent simulation outcomes or treat animation as state |
| Replay module | Restore snapshots, replay actions and fork runs | Re-query models during historical playback |

Prefer a normal request/response interface and incremental polling of session revision for this small MVP. Streaming, WebSockets and distributed workers are unnecessary unless measurements show a need.

## Scenario specification

### World and resources

Use a fictional town named Harbor Point. Model flood changes through scheduled road and shelter events; water rendering is illustrative.

| Entity | Initial specification |
| --- | --- |
| Depot D | 12 supply crates; vehicles V1 and V2 idle |
| School S | Request for 6 crates due at minute 9; cannot unload before minute 6 |
| East shelter E | Request for 6 crates appears at minute 5, due at minute 12 |
| Vehicles | Two identical trucks, each with capacity 6 crates |
| Reserve constraint | Player's initial command requires at least one idle truck at depot |
| Session | Integer-minute ticks from 0 through 15; checkpoint at minute 2 before dispatch |

Roads are bidirectional, with integer travel durations. Store explicit edge IDs and deterministic tie-breaking.

| Road | Travel minutes | Behavior |
| --- | --- | --- |
| D to J, bridge junction | 2 | Always open |
| J to S, bridge | 2 | Closes at minute 4 |
| D to H, hill junction | 3 | Always open |
| H to S | 3 | Always open |
| J to H | 4 | Always open; diversion |
| D to E | 4 | Always open |

### Fixed events and information

| Tick | World event | Observation delivery |
| --- | --- | --- |
| 0 | School receiving power is unavailable | Shelter manager knows recovery is scheduled for minute 6 |
| 1 | Field inspection identifies bridge closure risk | Field lead gets an authored risk report; logistics still has an earlier open-road report |
| 2 | Decision checkpoint | All visible reports retain their observation and receipt times |
| 4 | Bridge closes | Field lead and global public closure feed receive an update |
| 5 | East shelter request opens | Shelter manager receives request |
| 6 | School can unload | Shelter manager and public destination status update |
| 15 | Evaluation horizon | Compute comparison metrics |

The bridge closure is fixed scenario input, independent of the player's route. Private knowledge is a filtered projection of authored observations, never a model-generated world fact. Distinguish “observed open at minute 0” from “open now.” Role prompts must not include the hidden future event schedule.

### Golden comparison fixture

At minute 2, dispatch V1 with 6 crates to S while V2 stays at the depot. Preserve the reserve rule in both branches. The only changed input is the route:

- **Original:** D → J → S. V1 reaches J at minute 4, after the closure has been applied. It cannot enter the bridge and follows the predetermined diversion J → H → S, arriving and unloading at minute 11.
- **Alternative:** D → H → S. V1 arrives and unloads at minute 8.

At minute 9, the original has delivered 0 school crates and the alternative has delivered 6. At minute 15, both have completed the school delivery; the original is 2 minutes late and the alternative is on time. East shelter's 6 crates remain unmet in both branches because the reserve rule is held constant and no extra dispatch is approved.

This fixture demonstrates a real trade-off within the scenario without making every metric favor the alternative. The numerical outcomes are authored targets to verify in code, not measured results. An already-closed bridge is rejected during planning; a bridge that closes after dispatch causes the explicitly configured diversion.

## Simulation engine and state

### Minimum data contracts

| Record | Required fields |
| --- | --- |
| Scenario | ID, version, horizon, nodes, edges, initial resources, requests, fixed events |
| World state | Tick, revision, road statuses, destination receiving states, depot stock, vehicle states, requests, event cursor |
| Vehicle | ID, capacity, cargo, current node or active edge, edge entry tick, arrival tick, route, status |
| Observation | ID, fact type, entity, value, observed tick, received tick, visibility by role |
| Intent | Destination, quantity, reserve count, route preference, unresolved fields |
| Proposal | ID, base revision, actions, assumptions, warnings, supporting observation IDs |
| Approved command | Unique ID, proposal ID, expected revision, approval tick, normalized actions |
| Event | Stable ID, tick, sequence, type, payload, causing command or scenario event ID |
| Run | ID, parent run, fork tick, scenario version, checkpoint, approved commands, event log, cached role outputs |

Keep all deterministic decisions in normalized records. Do not store floating-point animation coordinates in simulation state. Snapshot pending arrivals, observation queues, event cursors, active constraints and route policy as well as visible entities.

### Tick ordering

Within each tick, apply these operations in a stable order:

1. Apply authored external changes, including bridge closures and request arrivals.
2. Complete vehicle edge travel ending at that tick.
3. Apply queued approved commands in command sequence order.
4. Determine next-edge entry or configured diversion; closed edges cannot be entered.
5. Unload at receiving destinations, or wait until receiving is enabled.
6. Publish observations and append derived metric events.
7. Increment revision and persist the result.

Vehicles already on an edge may complete it when the edge closes. This simplified traversal rule is part of the scenario definition. A vehicle reaching a junction on the closure tick cannot enter the newly closed edge.

Commands are committed at a tick boundary. The decision clock pauses while interpreting input and reviewing proposals, so provider latency does not change simulated outcomes. Rendering can continue with ambient motion. During playback or execution, server tick advancement is explicit and the client interpolates vehicle positions between node coordinates.

### Invariants and validation

- Depot crates + truck cargo + delivered crates always total the initial 12; unmet demand is not inventory.
- No stock or cargo quantity can be negative; cargo cannot exceed capacity.
- A truck cannot receive two overlapping assignments.
- Routes must be contiguous and use existing edges; known closed edges cannot be approved.
- A reservation is an enforced idle-at-depot constraint, not a sentence in a model response.
- Destination readiness governs unloading, not whether a truck can travel there.
- Future closures are handled by scenario rules, not by revealing future information to models.
- Plans referencing stale revisions must be revalidated and reapproved.
- Duplicate approval requests with the same command ID have one effect.
- The engine's reducer takes explicit state and input and returns new state plus events.

## Meta characters and command processing

### Role boundaries

| Role | Permitted private context | Output |
| --- | --- | --- |
| Logistics lead | Depot inventory, trucks, capacities and last-known route observations | Quantity and vehicle feasibility; dispatch proposal |
| Shelter manager | Receiving readiness, requests and their deadlines | Destination constraints and clarification |
| Field lead | Road observations, observation age and closure-risk reports | Route concerns and a supported alternative |

Use one validated intent extraction call, followed by three role calls with separate prompts and filtered context. Calls can run concurrently within the service, but the resulting reports are presented in a stable role order. A code coordinator assembles the editable plan and validator findings. Limit negotiation to one initial response and one user-requested revision; avoid open-ended agent conversations.

Each response must conform to an application schema containing a short message, referenced observation IDs, uncertainties and permitted proposal fields. Treat structured-output or tool-calling support as something to verify in the provider spike; fall back to ordinary JSON parsing plus schema validation if necessary. Do not depend on undocumented SDK methods.

The engine re-checks factual assertions and proposal references. Unsupported claims are omitted or marked unverified in the report; an unknown observation ID cannot justify an action. Model dialogue cannot directly update the world.

### Command lifecycle

1. User submits text; optional voice transcription enters the same editable text field.
2. Service checks input length, session ownership, rate budget and revision.
3. Intent extraction identifies destination, quantity, reserve constraint and route preference. Missing quantity becomes a clarification or a visibly proposed default based on the request.
4. Three roles receive their individual observation projections and respond.
5. Coordinator assembles a plan; engine validates current feasibility and surfaces conflicts.
6. User edits the plan through explicit quantity, destination and route controls or revises the command.
7. Approval sends proposal ID, expected revision and a unique command ID.
8. Service revalidates and applies normalized actions atomically, then returns events and updated state.

Show “Observed at minute …” beside reports and “Proposed” beside unapproved actions. Expose concrete fixes such as choosing the hill route, reducing quantity or waiting to unload.

### Model access and cost spike

Complete before substantial UI polish:

- Verify one organizer-listed Meta model is accessible with granted credentials or an eligible partner.
- Save the actual provider, model ID and adapter configuration in documentation, with credentials in server environment variables.
- Check structured response behavior, maximum response size, latency, rate limits and billing units from provider documentation at implementation time.
- Run a small set of command and role examples; record latency, usage and validation failures.
- Choose one primary provider. Add a second only if access failure threatens the schedule.
- Target at most 5 provider calls for a normal command turn: one interpreter, three roles and at most one repair. If another response is malformed, show an actionable error and manual controls.
- Initially allow 12 inference turns per session and one active turn at a time. Bound input, output and timeouts; revise limits from observed costs.
- Record actual token usage and cost where returned. Do not assume that the event's billing notification is a hard cap.

Use a 15-second request timeout as an initial application setting and show a retry/manual-control state. Retry only transient transport or rate failures within the total turn budget; keep mutations outside the retrying inference path. Store the resolved proposal so a browser retry does not repeat successful calls unnecessarily.

## Replay and controlled comparison

### Checkpoint and fork

Save a full checkpoint at minute 2 before dispatch. It includes simulation state, private observations available at that point, scenario version, pending events and any randomness state. Prefer no randomness in the MVP; a seeded generator is required if any random event is added.

The original branch records its route and resulting actions. The alternative clones the checkpoint into a new run ID and changes only V1's route. Both runs use the same fixed event schedule, reserve constraint, quantity and evaluation horizon.

For this MVP, continuation after dispatch is deterministic: complete the delivery, divert on closure under the defined rule, and take no additional discretionary dispatches. New requests are reported and remain pending. This prevents fresh model decisions from introducing hidden differences between branches.

Models may help propose the alternative and explain the outcome, but historical replay never calls a model. Cache reports and narration with the run. The viewer should display the route intervention and every held-constant input. If a later version allows multiple changed decisions, label it as a different plan rather than a one-decision comparison.

### Metrics

Compute metrics from engine state and events at the same tick in both runs:

| Metric | Definition |
| --- | --- |
| Delivered crates | Sum of completed unload quantities by comparison tick |
| Unmet crates | Sum of max(requested quantity minus delivered quantity, 0) for requests opened by that tick |
| On-time deliveries | Count of fully satisfied requests completed no later than their deadline |
| Delivery lateness | For completed requests, max(completion tick minus deadline, 0); overdue incomplete requests show ongoing lateness separately |
| Crate waiting time | Sum, over requests and elapsed minute intervals, of outstanding crates × interval duration |
| Reserve availability | Idle trucks at depot, plus any ticks where the approved minimum was violated |
| Vehicle travel | Sum of occupied travel minutes; waiting and travel are distinct |

Do not calculate lives saved or operational safety scores. Show both a deadline checkpoint at minute 9 and final results at minute 15 so the timing effect remains visible after both deliveries complete.

The first debrief can use deterministic templates referencing event IDs. An optional Meta-generated summary receives only verified metrics and selected events, and cannot introduce additional numbers. Every displayed causal statement links to the bridge closure, diversion or unloading event that supports it.

## User interface and visual direction

Use a compact diorama with strong landmarks, readable roads and simple vehicle models. Build geometry from original primitives where possible. Floodwater is a translucent plane with authored visual progression; no physics solver is needed.

| View | Required elements |
| --- | --- |
| Briefing | Fictional scenario label, one-sentence objective, start action |
| Command | Town, selected vehicle route, three radio cards, command input, clock, inventory and destination status |
| Plan review | Proposed truck, crates, route, reserve count, readiness warnings, approve and revise actions |
| Execution | Moving trucks, closures, arrival events, pause and speed controls |
| Comparison | Two labeled synchronized maps, shared scrubber, changed route, metric deltas and event explanations |
| Debrief | What changed, what remained constrained and replay/reset action |

Use text and icons as well as color for open/closed roads and original/alternative timelines. Keep text readable in a 720p recording. Model latency should appear as role-specific progress, not a frozen screen. Pause both timelines at the same simulated tick when comparing.

Render both comparison views from separate immutable run states with a shared camera and clock. Reuse static geometry and reduce effects if two canvases hurt frame rate. A final fallback is one canvas with two viewports, while preserving two distinguishable timelines.

## Proposed repository layout

```text
research/
  meta-global-ai-developer-hackathon.md
  crisiscraft-concept.md
  crisiscraft-mvp-implementation-plan.md
apps/
  web/src/                 # Scene, radio panels, plan review, comparison
  server/src/              # Sessions, persistence, provider adapter, HTTP routes
packages/
  sim/src/                 # Reducer, routing, constraints, metrics, replay
  contracts/src/           # Schemas shared by server and client
scenarios/
  harbor-point.json
tests/
  simulation/
  integration/
  e2e/
docs/
  contributions.md
  assets-and-licenses.md
  model-integration.md
  demo-script.md
```

This is a proposed structure, not a request to scaffold it during documentation. Keep the engine independent of framework imports and external API clients.

### Application interfaces

Implement these as small JSON operations; exact URL names may change during scaffolding:

| Operation | Input | Result |
| --- | --- | --- |
| Create session | Scenario ID | Server-generated session token, initial state and revision |
| Read session | Session token, last revision | Current projection and new events |
| Interpret command | Text and expected revision | Role reports, proposal or clarification |
| Approve plan | Proposal ID, expected revision, command ID | Applied events and new revision, or concrete validation error |
| Advance | Requested tick count and expected revision | Bounded deterministic state advance |
| Fork | Checkpoint ID and supported route intervention | Alternative run with immutable parent reference |
| Compare | Two related run IDs and tick | State projections, metrics and event references |
| Reset | Session token | New run of the same scenario |

Use typed error codes for malformed input, stale revision, invalid plan, provider failure and exhausted budget. Serialize session mutations to prevent double dispatch. Give browsers opaque session tokens; cap stored sessions and expire them after a documented short retention period. Deploy with global inference concurrency and daily request limits so a public judge link does not create unbounded spend. Logs omit credentials and avoid unnecessary user text retention.

## Work packages and effort

| Work package | Estimate | Dependencies | Completion evidence |
| --- | --- | --- | --- |
| W1 Access and scenario specification | 4 h | None | Live Meta request, confirmed response schema, scenario fixture committed |
| W2 Engine, routing and metrics | 9 h | W1 scenario | Golden comparison and resource tests pass |
| W3 Scene and command UI | 7 h | W2 state contract | A manual approved plan moves a truck in 3D |
| W4 Role calls and validation | 8 h | W1 access, W2 validator | Natural-language command reaches live approved execution |
| W5 Checkpoints and comparison | 8 h | W2 event log, W3 rendering | Two branches produce reproducible different arrival times |
| W6 Persistence and deployment | 4 h | W3, W4 | Fresh-browser session survives refresh and completes flow |
| W7 Verification and presentation | 6 h | W5, W6 | Critical tests, readable demo and public repository evidence |
| W8 Video and submission | 4 h | W7 | Three-minute recording and validated submission links |
| Contingency | 6 h | Apply where needed | Fix access, replay or deployment blockers |

Total planned work: 50 hours plus 6 hours contingency. Voice and extra effects are outside this estimate. These are planning estimates, not guarantees. Work packages may interleave, but the dependency order controls the critical path: scenario and access → engine → complete command loop → branching → deployed verification → video.

## Calendar and milestone gates

| Singapore date | Work | Gate by end of day |
| --- | --- | --- |
| Tue 27 Oct | W1 and engine skeleton | One live Meta call; agreed graph, actions and expected replay outcomes |
| Wed 28 Oct | W2 | Headless original and alternative produce minute 11 versus minute 8 school arrival |
| Thu 29 Oct | W3 and early deployment | Manual command works in a simple 3D scene; deployment starts successfully |
| Fri 30 Oct | W4 | Complete text → three roles → validation → approval → truck movement with live inference |
| Sat 31 Oct | W5 checkpoint and fork | Original is preserved; alternative changes only route and replays deterministically |
| Sun 1 Nov | W5 comparison and W6 | Side-by-side views and metrics work at equal ticks on deployed app |
| Mon 2 Nov | W7 | Critical checks pass; optional intended-user review if available; freeze features |
| Tue 3 Nov | W7 and W8 recording | Final three-minute video recorded; repo and contribution documentation ready |
| Wed 4 Nov | W8 | Verify links and submit by 8:00 PM Singapore time |
| Thu 5 Nov | Contingency before 10:00 AM | Confirm submission receipt before external deadline; avoid planned feature work |

If no usable Meta access exists by the first gate, finish the adapter and engine with labeled fixtures while resolving access; do not count fixtures as a working Meta integration. If the complete loop is not working by 30 October, cut voice, speech, extra animation and polish immediately. If branching is blocked on 1 November, stop visual work and finish checkpoint correctness first.

## Verification strategy

Tests should target simulation correctness and integration boundaries rather than duplicate UI implementation.

| Check | Required assertion |
| --- | --- |
| Golden scenario | At tick 9, original school delivery is 0 and alternative is 6; final arrival ticks are 11 and 8 |
| Resource conservation | Stock + cargo + deliveries stays 12 through loading, waiting, diversion and unloading |
| Invalid proposals | Unknown truck, excessive cargo, disconnected route and already-closed edge are rejected |
| Closure ordering | Arrival at J on tick 4 cannot enter bridge; a truck already traversing an edge may finish |
| Shelter readiness | Early arrival waits; unloading occurs only once receiving is enabled |
| Reserve rule | Second dispatch is rejected while one truck must remain idle at depot |
| Approval integrity | Duplicate command ID has one effect; stale proposals cannot silently execute |
| Replay integrity | Replaying the same checkpoint and actions yields equal normalized state and event hashes |
| Fork isolation | Advancing or editing alternative cannot mutate original state or logs |
| Role visibility | Captured prompt inputs contain only permitted observations; future schedule and other private context are absent |
| Model boundary | Malformed output, invented observation IDs, timeouts and rate failures cannot mutate simulation state |
| Metrics | Hand-calculated small fixtures match delivered, unmet, waiting and lateness values |
| Persistence | Reload restores run and checkpoint; process restart on the selected persistent host retains the session |
| End-to-end flow | Fresh session completes command, revision, approval, fork and comparison in deployed browser |

Use saved provider-response fixtures for routine integration tests and clearly identify them. Before recording, perform one bounded live-provider smoke test to establish actual Meta integration. Exercise real adapter failure handling with controlled provider errors or a local stand-in during implementation. Record the browser, laptop and viewport used for visual verification; target smooth motion around 30 FPS on that recorded setup without making a broader performance claim.

## Risks and scope cuts

| Risk | Mitigation or cut |
| --- | --- |
| Provider access or rate limits | Test access first; bound requests; use manual plan editing for continuity and labeled fixtures for development |
| Replay differences caused by fresh AI calls | Cache historical output and use deterministic continuation after the branch |
| Model appears to know everything | Separate context projections and observation timestamps; inspect actual request payloads |
| Model creates invalid actions | Schema-check output, validate against engine, revalidate at approval |
| 3D scene consumes the schedule | Primitive geometry, fixed elevated camera, no character locomotion or realistic flood physics |
| Comparison feels cosmetic | Show route intervention, identical external events, exact arrival times and event-linked deltas |
| Two views render slowly | Share geometry, lower effects and use two viewports with a shared camera |
| Training relevance remains speculative | Seek brief feedback from an intended user if available; describe prototype purpose accurately |
| Public demo incurs uncontrolled cost | Session limits, global concurrency and budget limits; clear exhausted-budget state |
| Lost sessions after deployment restart | Persistent storage check before final deployment; refresh and restart smoke tests |
| Scope exceeds available hours | Preserve simulation, command loop and branching; cut voice, speech, extra scenarios and visual effects in that order |

## Three minute demo script

| Video time | Action and claim |
| --- | --- |
| 0:00–0:10 | Show the town, objective and three urgent reports; viewer understands the coordination task |
| 0:10–0:35 | Issue the supply-and-reserve command; show the three roles' different observations |
| 0:35–1:00 | Resolve readiness and route concerns; approve a concrete plan; briefly reveal validated capacity and reserve constraints |
| 1:00–1:25 | Accelerate the original run: bridge closes, truck diverts, deadline is missed |
| 1:25–2:05 | Rewind to the checkpoint, change only the route and play both timelines together |
| 2:05–2:30 | Compare minute 9 and final metrics; click the event explaining the difference |
| 2:30–2:50 | Explain the Meta role boundaries and deterministic engine using the actual working interface |
| 2:50–3:00 | State intended user, fictional rehearsal scope and what the team built during the event |

Record real working behavior. If speeding up simulation or editing out provider waits, preserve the meaning of the workflow. Pre-recorded replay is labeled as replay; fixture mode is never presented as a live model call. Voice can be omitted without changing the story.

## Final release checklist

- [ ] P0 interaction works end to end on the deployed judge URL.
- [ ] At least one live Meta-backed command and role sequence has been verified.
- [ ] Golden comparison, resource, replay and approval tests pass.
- [ ] Original and alternative remain immutable and reproducible across refresh.
- [ ] Main workflow is usable with keyboard and text, with readable reports at demo resolution.
- [ ] README explains setup, environment variables, scenario assumptions, controls and model integration.
- [ ] Repository is public and contains no credentials or private provider logs.
- [ ] Contribution log identifies event-built features and any starting materials.
- [ ] Asset and dependency rights are documented; repository license is selected deliberately.
- [ ] Submission track and all team members are confirmed.
- [ ] Video is three minutes and accessible from a signed-out browser.
- [ ] Representative submits through the organizer platform and verifies receipt.

## Immediate next implementation tasks

1. Scaffold the TypeScript application, pure simulation module and shared schemas.
2. Verify provider credentials and execute one real Meta request from the server.
3. Encode Harbor Point and write the golden original-versus-alternative fixture.
4. Implement the reducer, inventory validation, travel and fixed event ordering.
5. Render the resulting states and reach the manual command milestone before expanding the AI workflow.
