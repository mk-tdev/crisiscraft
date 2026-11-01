# CrisisCraft: submission plan

Updated 1 November 2026, Singapore time. Rules are recorded with sources in [research/meta-global-ai-developer-hackathon.md](../research/meta-global-ai-developer-hackathon.md). This is a release checklist, not confirmation that the form has been submitted.

## Deadline and scope

Submit through the [CV submission page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) by **Wednesday 4 November, 9:00 PM ET / Thursday 5 November, 10:00 AM Singapore**. Target completing the form on 4 November Singapore time to leave troubleshooting time.

The project fits **Build for Your World**: a fictional coordination rehearsal for volunteer/shelter coordinators facing partial, ageing reports and constrained resources. Choose one track only. No validated training-effectiveness or live emergency-response claims are made.

## Current evidence and outstanding items

| Requirement | Current evidence / remaining action |
| --- | --- |
| Meta integration | Implemented Muse Spark crew/tool planning/review, optional AI commander, Voice Transcribe and generated Image → SAM → Spark flow. Thirty recorded live crew runs are in [eval](eval/crew-eval.md); other paths need a final hosted smoke test. |
| Public repository | Complete: [mk-tdev/crisiscraft](https://github.com/mk-tdev/crisiscraft), default `main`. |
| New work clearly identified | [Contributions](contributions.md) now covers 28 October–1 November, including original code and third-party boundaries. Add each actual team member's contribution before submitting. |
| Rights | CC0 scene assets and dependencies recorded in [assets and licenses](assets-and-licenses.md). Generated imagery is explicitly synthetic. |
| Working judge-facing deployment | [crisiscraft.vercel.app](https://crisiscraft.vercel.app): unauthenticated HTML and `/api/crew` GET verified on 1 November; status reports live Meta and voice enabled. The latest fixes still require the hosted workflow checklist below. |
| Three-minute demo video | **Link not yet recorded/verified.** Record the actual working live path and identify what was built during the event. |
| Track and team | **Pending representative confirmation.** Choose Indie Developer or Startup, maximum four members, list everyone who worked on the project, confirm eligibility, and have one person submit. Do not use fictional crew names as contributors. |
| Submission form | **Pending.** Add repository, accessible video and every team member. Check the submitted links while logged out. |

The repository owner is GitHub account `mk-tdev`. This does not establish the legal names or eligibility of all contributors. Those must be completed by the representative.

## Reliability changes completed on 1 November

1. Autopilot cancels obsolete requests on takeover, reset, timeline/context changes and unmounting; late completions cannot act on a different situation or alter a newer request's thinking state.
2. Crew and photo workflows have a **50-second shared model deadline**, below the configured **60-second function duration**. All stages share that budget, abort upstream work on expiry, and emit a terminal NDJSON error. Browser requests allow 55 seconds and reject truncated streams. Lower `MODEL_REQUEST_BUDGET_MS` for failure testing; values above 50000 are clamped.
3. Water overlap now intersects the bridge and water masks with image-coordinate area weighting, including different raster resolutions. Water outside the bridge mask does not count; an empty detection yields no percentage. The UI calls the image generated, and the percentage is not physical flood depth or road safety.
4. Contribution, implementation and submission documents now describe the current features, public repository and recorded live evidence. Historical evaluation artifacts remain dated rather than being presented as freshly rerun measurements.

Verification: `npm run check` (85 tests, strict typecheck and production build) and production function packaging. Local HTTP stand-ins exercise completed first stages followed by stalled planning/SAM; both workflows finish with explicit deadline errors. No new live model calls were required for these regression tests.

## Hosted smoke checklist — required before recording

Run from a logged-out browser against the final URL, not just Vite. Confirm the deployment uses the intended latest commit, credentials stay server-side, `/api/crew` reports the intended provider, and the deployed function duration permits the configured model budget.

- [ ] Give a general school order; receive streamed reports, planning tools, reviews and a checked plan. Approve and finish.
- [ ] Rewind the decision, explicitly choose the bridge, finish and compare. Verify school arrival at minute 8 versus minute 11.
- [ ] Enable Autopilot, then take over while it is thinking. Verify no delayed order/approval. Repeat with New drill and a timeline switch.
- [ ] Record a voice order; show the transcript before it is used.
- [ ] Generate a bridge drill image; verify the generated label, both outlines, mask overlap and June's interpretation. A model error must leave a readable error and allow retry.
- [ ] Generate an after-action review; inspect the cited engine events. Citation existence is checked; semantic correctness still needs review.
- [ ] Exercise a deliberately short model budget on a preview deployment, verify a terminal error/retry path, then restore the release budget. Do not change the public demo's budget during judging.
- [ ] Check a phone viewport and a desktop with WebGL. Confirm basic controls remain usable if the 3D scene fails.
- [ ] Open the repo and video while logged out. Confirm track, roster, contribution attribution and form completion.

A passing local failure test or successful function bundle does not substitute for these hosted checks. Use https://crisiscraft.vercel.app for judges. Vercel deployment-specific and main-branch preview URLs redirect unauthenticated visitors to login; those are not the submission link. The fix deployment for code commit `167fb75` reached READY on 1 November. Unauthenticated live API smoke checks then completed the crew workflow in 19.6 seconds (hill route `D → H → S`) and all three photo stages in 20.2 seconds, both with terminal success under the 50-second budget. These two API runs are verified; the complete browser/microphone/takeover checklist above remains pending.

## Three-minute video

- **0:00–0:20:** A coordinator must act on partial reports while the water rises. Name the intended user and fictional drill scope.
- **0:20–1:15:** Show the town, give an order, and demonstrate live bounded reports, one planning tool call and the rules check. Open a briefing briefly.
- **1:15–2:05:** Approve, watch the consequence, rewind and make the other call. Show the synchronized outcomes and the causal event.
- **2:05–2:30:** Show the recorded full-radio versus June-silenced evaluation; explain that this is 30 runs of one authored scenario.
- **2:30–2:45:** Briefly show one stable supporting capability: voice, synthetic photo pipeline or Autopilot takeover. Keep optional features out of the critical path if they are slow.
- **2:45–3:00:** Identify event-built work, Meta models, third-party CC0 art, public repo and the product's limits.

Do not stage a rules refusal as though it happened live if the model's real plan passed. Recorded evaluation runs all passed their first rules check. Demonstrate an actual refusal only if it occurs or explicitly label a separate controlled example.

## Freeze policy

Prioritize verified deployment, the video and submission accuracy over additional scenarios or features. Optional social/bonus-prize submissions are separate from the core submission and require the representative to decide what to publish.
