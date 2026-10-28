# CrisisCraft Concept

Status: Selected hackathon concept, 27 October 2026.

**CrisisCraft is a playable 3D emergency coordination drill where you command a team of AI characters, approve a plan, and rewind one decision to compare its consequences.**

Pitch: “Practise the crisis before it happens—and replay the decision you wish you had made.”

The hackathon MVP follows a volunteer coordinator in a fictional coastal town during a flood. The player handles conflicting reports, limited vehicles and delayed information. Meta models interpret instructions and propose actions from each character's perspective. A deterministic simulation controls inventory, road access, travel and delivery outcomes.

## Intended user and purpose

The intended user is a volunteer coordinator practising communication, resource allocation and decisions under incomplete information. A facilitator could use the prototype to discuss why participants chose a route, what they knew at the time and what they might ask next.

The MVP is a fictional rehearsal prototype. Its outcomes describe its own scenario assumptions. It does not provide real incident instructions, flood forecasts, medical advice or evidence of improved real-world preparedness.

The training format has a precedent: CDC's collaborative TEST game uses narrative problems to practise emergency roles, teamwork and resource management. This supports exploring the format, while training effectiveness for CrisisCraft remains a hypothesis. [CDC TEST](https://www.cdc.gov/readiness/php/testgame/index.html)

## The experience

### Opening

An elevated view reveals a small coastal town, two delivery vehicles, a depot, a school shelter and an eastern shelter. Floodwater advances visually. A shelter loses power and a bridge warning appears. Three characters send short radio reports. The interface immediately presents the task: deliver supply crates while preserving one available vehicle.

The initial checkpoint precedes the bridge closure. A brief opening preview may show the closure, but the playable clock and reports must clearly identify when it actually occurs. The player should never be asked to send a vehicle across a bridge the interface already marks as closed.

### Coordinate

The player types, or optionally says: “Move supplies to the school. Keep one vehicle available.”

- The logistics lead knows vehicle capacity and available supplies.
- The shelter manager knows the school cannot receive supplies until its power issue is resolved.
- The field lead has a recent bridge-risk report and local road information.

Reports include observation times. Characters have bounded information, so a route report can be stale without the simulation inventing contradictory facts. The player can request clarification, change a route or quantity, and approve the proposed plan. Trucks then move through the 3D town.

### Rewind

The player selects the dispatch checkpoint and changes the route. The alternative starts from the same world state and encounters the same scheduled bridge closure and shelter recovery. Two synchronized views show the original and alternative deliveries, delays and outstanding requests.

The debrief links metric changes to recorded events: for example, the bridge closed before the truck entered it, forcing a longer diversion. The comparison is between two policies in this authored scenario; it is not a prediction about an actual flood.

## Distinctive product claim

The central interaction is **human coordination with differently informed characters, followed by a controlled comparison of one changed decision**.

Open Disaster already describes a 3D disaster simulator with autonomous agents, dialogue, analytics and replay. CrisisCraft should acknowledge that overlap and demonstrate its narrower distinction through the approval workflow and branching comparison. The competitor's capabilities here are claims from its project description, not an independent product evaluation. [Open Disaster](https://devpost.com/software/open-disaster)

Village of Shadows and BatchLens are user-supplied interaction and visual inspirations. Their implementations and assets are not dependencies; the MVP will use its own scene and interactions.

## Hackathon MVP boundary

| Required | Optional after the core works | Excluded |
| --- | --- | --- |
| One fictional flood scenario | Push-to-talk transcription | Real maps or real incident data |
| One stylized 3D town | Short spoken character replies | Flood physics or forecasting |
| Three AI character roles | Extra character animation | Medical, political or war scenarios |
| Two vehicles and one supply type | A second authored decision | City-scale simulation |
| Text command and plan approval | Richer environmental effects | Multiplayer or accounts |
| Validated resource and travel rules | Additional scenario variants | Autonomous real-world dispatch |
| One checkpoint and two timelines | Facilitation notes | Unbounded AI negotiation |
| Metrics and event-grounded debrief | Open-weight bonus eligibility if access permits | Claims of validated training effectiveness |

## Meta model contribution

Meta inference is a core runtime dependency for interpreting free-form commands and generating role-specific reports and proposals. Each role receives only its permitted observations. A code-owned validator checks the proposed plan before the player can approve it.

The model cannot mint supplies, bypass a closed road, exceed a truck's capacity or modify the clock. The simulation remains playable through explicit controls during an inference failure, with that mode visibly identified. A genuine live Meta-backed run is required before claiming the integration works.

Select the specific available Meta model and provider during the first implementation milestone. Model names in the [event research](meta-global-ai-developer-hackathon.md) are organizer references; exact API behavior, access and cost still need a technical spike.

## Hackathon fit

Proposed theme: **Build for Your World**, subject to grounding the use case in firsthand coordination knowledge or feedback from an intended user. Theme and track are separate choices. Indie Developer is the planning assumption until the entrant confirms the actual track.

| Published judging category | CrisisCraft evidence to build |
| --- | --- |
| Impact, 30% | Explain a specific coordination problem and obtain feedback on whether the drill represents a useful exercise |
| Meta tooling, 25% | Show distinct role knowledge, command interpretation, conflicting proposals and revision |
| Technical execution, 20% | Demonstrate validated actions, resource conservation and reproducible branching |
| Demo, 25% | Show command, conflict, movement, rewind and comparison in three minutes |

The project is an interactive rehearsal simulation, with substantial functionality beyond a chatbot. Keep all demonstrated new work attributable to the event and record asset rights. The [hackathon research](meta-global-ai-developer-hackathon.md) contains the detailed rules and schedule discrepancies.

## Success criteria

1. A first-time viewer understands the coordination task within ten seconds.
2. A free-form command produces a concrete proposal and understandable conflicts from the three roles.
3. Approval visibly moves a truck while preserving all resource constraints.
4. Rewinding changes one decision while holding the scenario conditions constant.
5. The two outcomes differ for an explainable, reproducible reason.
6. The product runs end to end with live Meta inference and remains understandable without voice.

Implementation details, acceptance tests, milestones and the demo sequence are in the [MVP implementation plan](crisiscraft-mvp-implementation-plan.md).
