# Deterministic Simulation Engine

The engine is a pure TypeScript module shared by tests and the browser preview. Callers supply an authored scenario, a trusted current state and explicit input. Functions return copied state and deterministic events; they do not mutate earlier runs.

## Operations

| Export | Contract |
| --- | --- |
| `parseScenario(input)` | Runtime schema validation plus node, road, request and event cross-reference checks |
| `createWorld(scenario)` | Initializes minute 0, including its external events, requests and observations |
| `approveCommand(scenario, state, unknownInput)` | Schema-checks input, revalidates revision and constraints, then atomically dispatches at the current paused boundary |
| `advanceTo(scenario, state, target)` | Advances to a bounded integer tick; backward time is rejected |
| `checkpoint(state)` / `restore(scenario, checkpoint)` | Copies the entire engine record and checks scenario identity and version on restore |
| `replay(scenario, commands, until)` | Reconstructs a run from the scenario and recorded approvals, without model calls |
| `roleContext(state, role)` | Copies only received public and role-permitted observations; omits future schedule and authoritative world state |
| `metrics(scenario, state)` | Derives delivery, demand, lateness, waiting, travel and reserve figures |
| `compareSchoolRoutes(scenario, tick)` | Harbor Point golden-fixture convenience function, not a general scenario branching API |

Scenario and state records remain internal trusted inputs after initialization. The command boundary accepts `unknown` and rejects malformed objects. A future public HTTP service must own sessions and revisions; browser-side validation alone is not authority. The current frontend bundles scenario data for development and does not claim to hide future events from someone inspecting its source.

## Clock semantics

An approval is applied immediately at the current paused tick after that tick's external changes. It loads stock and starts the first edge. No wall-clock latency is part of the exercise.

For each advance from `t` to `t + 1`:

1. Accumulate waiting, travel and reserve metrics over `[t, t + 1)`.
2. Move the clock forward one minute.
3. Apply authored changes and open new requests in stable ID order.
4. Complete edge arrivals in vehicle ID order.
5. Start each next edge, diverting around closures where possible.
6. Unload at receiving destinations.
7. Publish observations delivered on that tick.
8. Increment revision and verify invariants.

If several commands share a tick, their recorded array order controls approval order and expected revisions. External changes cannot be skipped by approval. There is no queue in this milestone: a server can serialize calls to these operations later.

## Dispatch and retries

Each approval contains a unique ID, expected revision, minimum reserve and one or two dispatch actions. An action contains vehicle ID, open request ID, positive integer quantity and a contiguous node route.

Validation rejects excessive capacity or stock use, demand already allocated to another truck, unavailable trucks, disconnected routes, already-closed roads and reserve violations. A batch succeeds entirely or leaves the caller's state unchanged. Reserve requirements cannot be weakened by a subsequent dispatch.

An identical retry of a successful command ID has no additional effect, even if the world has advanced. Reusing the ID with changed input returns `DUPLICATE_COMMAND`. A new approval against an old revision returns `STALE_REVISION`.

Identifiers are bounded strings that exclude prototype object keys. Quantity and tick values must be finite integers within the operation's constraints.

## Travel and resource assumptions

Roads are bidirectional and have positive integer durations. A closure blocks new entry; vehicles already traversing an edge complete it. Diversion uses Dijkstra with lexical path tie-breaking independent of scenario edge insertion order. If no route remains, the truck is stranded and retains its cargo.

An early arrival waits for the shelter to receive. A delivered truck remains parked at its destination. The exercise has no automatic returns, additional discretionary dispatches, consumption, losses or newly created inventory. These limitations keep the first route comparison controlled.

At every tick:

```text
depot stock + truck cargo + completed deliveries = initial stock
delivered request quantity + cargo allocated to that request <= request quantity
idle trucks at depot >= approved reserve minimum
```

## Metrics

Unmet crates count only requests that have opened. On-time deliveries count fully satisfied requests completed at or before their deadline. Completed lateness is separate from ongoing lateness on overdue, incomplete requests.

Crate waiting minutes are the sum of outstanding request crates over each elapsed minute interval. For Harbor Point at minute 15, bridge-route waiting is `6 × 11 + 6 × (15 - 5) = 126`; hill-route waiting is `6 × 8 + 6 × (15 - 5) = 108`. Travel minutes sum time occupied on edges across vehicles: 9 versus 6 for the two school routes.

## Replay and provenance

Checkpoints include current legs, pending scenario inputs through the immutable versioned scenario, applied-event IDs, received observations, request state, accumulated metrics, events and approvals. JSON round-trip is supported for trusted snapshots. The current engine has no randomness.

Replay starts from scenario minute 0 and applies recorded commands at their original ticks and revisions. State and event sequence equality are verified using SHA-256 in tests; the browser engine has no crypto dependency. Branching copies the recorded command before changing its route and cannot mutate the original.

Events have stable sequence IDs, ticks, payloads and causal references for dispatches and closure-driven diversions. Private observation contents are not included in the shared event log. The future model adapter must receive `roleContext` projections rather than the raw scenario or event log.
