# CrisisCraft Implementation Status

Updated 1 November 2026, Singapore time.

## Implemented

- Deterministic Harbor Point engine: resources, road events, receiving constraints, validated approvals, role observations, metrics and branch replay.
- Muse Spark crew: three bounded reports, Priya's engine-backed `list_routes` / `check_plan` / `submit_plan` tool loop, rules refusal/revision, teammate review and crew initiative.
- Muse Voice Transcribe spoken orders, optional AI commander (Autopilot), and after-action review with event-ID validation. Citation validation checks that events exist; it does not prove the model's interpretation is correct.
- June's synthetic field image: Muse Image → SAM 3.1 → Muse Spark. The water statistic intersects detected bridge and water masks in image coordinates. It is not measured flood depth or physical passability. The UI labels the image as generated.
- Expanded coastal town, streamed radio, visible planning dry runs, camera views, dispatch tickets and synchronized two-run replay.
- Shared local/Vercel Node handlers for crew, voice, photo, debrief and commander; server-held credentials. Model plans are revalidated against replayed history. Sessions are browser memory, not durable authenticated server sessions.
- Production alias: https://crisiscraft.vercel.app (unauthenticated HTML and live-provider status GET verified on 1 November). Deployment/preview URLs require login; use the production alias for judges.
- Public source repository: https://github.com/mk-tdev/crisiscraft, default branch `main`.

## Recorded live evidence

The repository includes [30 live Muse Spark crew evaluations](eval/crew-eval.md) dated 1 November, with [raw results](eval/crew-eval.json). Full radio chose the hill route in 10/10 runs; removing June's report chose the bridge in 10/10; an explicit bridge order retained the bridge while June objected in 10/10. These are scenario-specific measurements, not evidence of validated training effectiveness. The recorded median deliberation times are 10.7–19.9 seconds across the three conditions.

## Reliability fixes — 1 November

Autopilot aborts and discards requests after takeover, reset, timeline/context changes or unmounting. Its 600 ms settle period precedes the model request; changing its thinking state does not cancel the request itself.

Crew and photo workflows share a maximum **50-second total model budget**, below the **60-second Vercel function configuration**. The budget spans reports, tool steps, revisions and photo stages; it does not reset per call. Deadline failures abort upstream calls and terminate NDJSON with an actionable error. Late output is suppressed. The browser allows 55 seconds for these requests and rejects incomplete streams rather than treating partial output as success.

`MODEL_REQUEST_BUDGET_MS` can lower, but cannot increase, the 50-second workflow budget. Input upload and hosting/platform behaviour are separate concerns; a shorter hosting limit must be accommodated when deploying.

## Verification

- `npm run check`: 90 tests, strict TypeScript checking and production build.
- Regression tests exercise delayed Autopilot responses after takeover/reset/switch/unmount, stale approvals and old requests completing during a newer request.
- Mask tests exercise background water, sparse bridge masks, empty masks, fractional overlap and differing raster resolutions.
- Real localhost HTTP stand-ins complete role reports or image generation, then stall planning/SAM. Both server workflows emit terminal timeout errors; partial client streams fail clearly. No live model credits are used by these tests.
- `node scripts/build-vercel.mjs` verifies production packaging for all five functions.

Hosted API smoke checks on production code commit `167fb75` passed on 1 November: a real crew deliberation finished in 19.6 seconds with the hill route (`D → H → S`), and a real photo workflow finished image → segments → read in 20.2 seconds. Both returned terminal success, below the 50-second budget. No credentials were sent by the test client; the deployed server used its configured model key.

These checks establish the live API paths for those two runs. The [production browser rehearsal](production-browser-rehearsal.md) exercised voice through a synthetic microphone, live Autopilot approval and takeover/reset/switching, generated photo, cited review, branch replay, phone layout and forced WebGL failure. Reset/voice ownership defects and clipped phone replay controls were fixed. Physical microphone permission and recording quality still need a human check.

## Remaining submission steps

1. Rehearse the recording with a physical microphone; the production application paths have passed the documented browser rehearsal with a synthetic input stream.
2. Record/publish the required three-minute video showing only event-built work and identifying the contributions and third-party art.
3. Confirm one track, the complete team roster (maximum four), eligibility and the submitting representative.
4. Complete the submission form and verify the public repo and video links while logged out.

See [submission plan](submission-plan.md), [contributions](contributions.md) and [assets and rights](assets-and-licenses.md). Older `command-*.png`, `route-comparison.png` and `command-room-verification.md` document previous iterations.
