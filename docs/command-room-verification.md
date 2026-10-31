# Command-room verification — 29 October 2026

## Design benchmark

Reviewed both user-referenced chats: **Assess hackathon eligibility** and **Preview agentic coffee shop**. Inspected the deployed replay screenshot of Why That Goal and the implemented café screenshot of Brew & Reason. The café concept illustration was also inspected and treated as a concept, not evidence of its implemented fidelity.

The upgrade addresses the original preview's sparse world, detached form layout, inaccessible scene details and weak replay presentation. The adopted principles are a prominent inhabited world, inspectable state, distinct character roles, visible action consequences and an evidence-focused replay. All implementation and art in this change are original to CrisisCraft.

## Automated verification

- Existing 36 simulation tests pass. Core scenario, command validation, observation boundaries and deterministic engine behaviour are unchanged.
- Strict TypeScript checking and Vite production build pass.
- The Three.js bundle remains large; this pass does not establish a mobile frame-rate or load-time target.

## Browser checks

Local Vite app tested in the in-app Chromium browser at the default desktop viewport and a 390 × 844 responsive viewport:

- Map renders neighbourhoods, the bridge, shelters, supply inventory, crews and trucks.
- Map labels inspect actual location state. The reserve row exposes V2's status and cargo.
- Logistics and field reports expose their respective received observations and timestamps.
- Bridge approval starts playback; pausing and stepping to minute 4 shows bridge closure and diversion via J → H → S.
- Run-to-end and comparison report school delivery at minute 11 for the bridge route and minute 8 for the hill route, with one reserve truck in each.
- At the deadline, the bridge run has delivered zero crates and the hill run has delivered six.
- Retrying the alternative restores the minute-2 starting state and preselects the other route; approval remains required.
- Keyboard End/Home on the replay slider updates both timelines to minutes 15 and 2. The UI does not reuse the final world's inventory when rewinding.
- Mobile view stacks the town, command panel and replay cards without horizontal overflow. Reset and briefing remain accessible in the mobile header.
- Briefing focus wraps between its controls; Escape dismisses it and restores focus to the opener.
- Exported a completed bridge run through the browser and parsed the downloaded JSON: scenario `harbor-point`, tick 15, one approved command, 20 events, school completion at 11 and zero reserve violations.

Screenshots: [command room](screenshots/command-room.png), [field team](screenshots/command-team.png), [decision replay](screenshots/command-replay.png), [mobile](screenshots/command-mobile.png).

## Remaining product boundary

This is a playable manual rehearsal with authored reports, not an autonomous team. Live Meta inference, free-text commands, server-held credentials, persistent sessions and deployment remain the next integration milestone. No claim is made that this interface has the full agent capabilities of the reference projects.
