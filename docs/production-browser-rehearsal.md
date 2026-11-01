# Production browser rehearsal — 1 November 2026

Target: https://crisiscraft.vercel.app, unauthenticated isolated Chrome session. Application lifecycle fixes were deployed as `496f246`; mobile replay CSS as `084f727`. This report distinguishes real model workflows from controlled browser failure tests.

## Method

Playwright CLI drove the public production UI at 1440 × 900 and 390 × 844. WebGL rendered through SwiftShader in headless Chrome. No credentials were loaded into the browser and no model endpoint was stubbed for the successful voice, planning, commander, photo or review workflows.

Voice used the known synthetic phrase **“Get six crates to the school. Keep one truck back.”** Chrome's file-microphone emulator returned silence, so the final voice checks supplied a synthesized Web Audio `MediaStream` as the test microphone. The real `MediaRecorder`, browser decode/resampling/WAV conversion, production `/api/voice`, Muse Voice Transcribe and crew planning all ran. This verifies the application recording pipeline, not a physical microphone or an OS permission prompt. The model transcript preserved the command's meaning, with occasional duplicated words/punctuation.

## Passed workflows

| Check | Observation |
| --- | --- |
| Initial load | Public HTML and live provider status loaded; town, asset requests, input and controls rendered. |
| Voice → crew → plan | A spoken school-supply command became a visible radio order; live role reports, planning tools, reviews and a checked hill-route ticket followed. |
| Human approval | Approving the hill plan and finishing the run supplied the school at minute 8, with six crates delivered and one truck in reserve. |
| Live Autopilot approval | Muse Spark accepted the existing checked hill plan with an explicit reason; approval flowed through the same engine validation and the UI returned to manual control. |
| Takeover while thinking | After a real `/api/commander` request started, switching Autopilot off left the radio quiet and the clock at the decision point for an eight-second observation window. Delayed-response unit tests additionally cover responses that ignore abort. |
| New drill while thinking | Reset stopped Autopilot and restored the minute-2 state. No late radio order appeared during the observation window. |
| Timeline switch while thinking | Switching B → A cancelled the pending commander action and left Autopilot off. Switching back to B did not carry over an old voice transcript. |
| Reset during recording | Reset while the test microphone was recording caused zero `/api/voice` uploads, no stale transcript and no stuck/disabled input. |
| Reset after photo | New drill removed the generated image and interpretation from the radio. |
| Branch and replay | Rewound the minute-2 school decision, explicitly ordered the bridge, approved and completed the alternative. At minute 9, A had delivered six school crates while B was waiting. At minute 15, A arrived at 8 and B at 11 (two minutes late). Both retained one truck. |
| Scrubbing | Home/End on the shared replay slider updated both timelines correctly. |
| Live after-action review | The two-run debrief explained the closure/diversion and supplied nine event citations that matched the engine log. Citation existence was checked, rather than assuming all generated text was proven true. |
| Generated photo | Muse Image → SAM 3.1 → Muse Spark completed in the browser. The radio identified a generated drill image, showed bridge/water outlines and 0% mask overlap for this image, and June described the crossing as risky. The reported stages took 9.9, 2.6 and 4.0 seconds. |
| Phone layout | Main controls and reset remained accessible at 390 px. Replay transport was corrected to wrap, the title no longer obscures the first timeline, and all deadline/end/review controls fit the viewport. |
| No WebGL | In a separate test tab, WebGL contexts were deliberately disabled. The 3D fallback appeared; the order input and Send control remained usable. |

Normal flows had no unexpected JavaScript errors. SwiftShader emitted GPU readback warnings; the deliberate WebGL-failure tab emitted the expected renderer error. This is not a frame-rate benchmark or coverage of Safari, Firefox or physical mobile hardware.

## Defects found and fixed

1. **Reset retained Autopilot.** Before the fix, resetting while a commander request was running left Autopilot on and could immediately launch another order. Reset, rewind and explicit timeline switching now return to manual control.
2. **Voice work outlived its run.** Old “Heard” text appeared on a new branch, and hook cleanup used normal stop (which submits a recording). Dispatch is now keyed to run/timeline ownership. Cleanup discards recordings, aborts transcription, releases media tracks and ignores delayed microphone permission/transcript results. Audio decode contexts are closed; the microphone button is disabled while permission is pending.
3. **Reset could retain a field image/review.** Reset now explicitly clears photo state, review state and the old initiative record.
4. **Phone replay clipped controls/evidence.** The replay title is now in normal flow on phones; controls wrap inside the fixed transport panel, timeline evidence has appropriate spacing, and long text wraps.

## Automated verification

`npm run check`: **90 passing tests**, strict TypeScript checking and production build. Five new voice lifecycle tests cover cancelled recordings, delayed permission, delayed transcription, callback freshness and recording setup failure. The production function bundle was also built successfully. The CSS correction passed a subsequent production build/typecheck.

Screenshots: [desktop replay](screenshots/production-rehearsal-replay.png), [phone replay](screenshots/production-rehearsal-mobile.png). The final phone check followed a fresh production reload and loaded `/assets/index-DhFrpGVo.css`; deadline/end/review controls all fit within 390 × 844, with the expected minute-8/minute-11 outcomes. Detailed local captures and CLI snapshots are under the ignored `output/playwright/rehearsal/` directory; synthetic audio and large request traces are not published.

## Remaining human release steps

- A short rehearsal with a real microphone in the intended recording browser, to check hardware permission and sound quality.
- Record/publish the required three-minute video; confirm track, actual contributors, eligibility and submission form fields.
- A shortened-budget hosted preview test remains separate from this rehearsal. Local HTTP deadline/truncated-stream tests passed; no production timeout settings were changed during the browser run.
