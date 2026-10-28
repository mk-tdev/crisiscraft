# CrisisCraft Implementation Status

Updated 28 October 2026, Singapore time.

## Completed in the first implementation milestone

- npm workspaces and locked dependencies for React, Three.js, TypeScript, Zod, Vite and Vitest.
- Shared schemas and a renderer-independent deterministic simulation package.
- Harbor Point's versioned road graph, two trucks, stock, receiving outage, bridge closure and two supply requests.
- Atomic approvals, revisions, idempotent retries, capacity and reserve rules.
- Event logs, stable routing, metrics, role observation boundaries and checkpoint/replay functions.
- Local 3D preview with manual route approval, clock controls and two-timeline comparison.
- Automated engine checks and a successful production build.

Verification: 36 automated tests passed, strict TypeScript checking passed, and Vite produced a production build. Browser QA at 1280 × 720 verified bridge and hill approvals, run-to-end, reset, and comparison in both route directions. School completion appeared at minutes 11 and 8 respectively, matching the headless fixtures. A [comparison screenshot](screenshots/route-comparison.png) records the manual preview. No frame-rate benchmark or mobile-browser verification has been performed.

The initial preview deliberately labels role reports as authored and Meta characters as disconnected. No live API call or deployment has been performed. There are no credentials in the application.

## Next implementation milestone

1. Add a Node session service around the pure engine, preserving atomic revisions and command IDs.
2. Select an actually accessible Meta model and verify a live request using server-held credentials.
3. Add free-text intent interpretation and three bounded role responses with runtime validation.
4. Connect plan approval to server authority and durable session storage.
5. Add persistence tests, provider-error integration checks and a deployed browser smoke test.

Voice, speech, extra scenarios and richer effects remain optional after these foundations. The public repository, final video and submission are still outstanding release tasks.

## Relationship to the original plan

The simulation portion of W2 is complete. W3 has a manual 3D workflow and basic comparison rendering, and W5 has tested engine primitives. W1's live model access, W4's model integration and W6's persistent deployment remain pending. These are partial work-package results, not completion of the full MVP.
