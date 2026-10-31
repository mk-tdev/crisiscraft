# CrisisCraft: Road to Submission

Written 31 October 2026 (Singapore), after re-reading the [participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details). The full event research, with sources, is in [research/meta-global-ai-developer-hackathon.md](../research/meta-global-ai-developer-hackathon.md).

## Hard deadlines

| What | Eastern Time | Singapore |
| --- | --- | --- |
| Last full day for submission troubleshooting on Discord | Tue 3 Nov | Tue 3 Nov evening – Wed 4 Nov |
| **Submission** through the CV platform | **Wed 4 Nov, 9:00 PM** | **Thu 5 Nov, 10:00 AM** |
| **Meta API credit claim** ($150, each person individually) | **Wed 4 Nov, 9:00 PM** | **Thu 5 Nov, 10:00 AM** |
| Most Viral: X engagement counted until | Sun 8 Nov EOD | Mon 9 Nov |
| Closing ceremony and finals | Mon 9 Nov, noon | Tue 10 Nov, 1:00 AM |

Credits arrive in batches, and the API needs a card on file. Claim them **now**, not on the deadline day. Until a key exists, there is no live Meta call in the product.

## What the rules require of us

| Rule | CrisisCraft status |
| --- | --- |
| Project fits a problem statement | **Build for Your World**: rehearsing a flood response before it happens. |
| Uses the Meta Model API or Meta open-weight models (Stage One, pass/fail) | Provider is built and unit-tested against a mocked endpoint. **No live call yet; this is the single blocker.** |
| Public repository | Not yet published. |
| Three-minute demo video of what was built during the event | Not yet recorded. |
| Demo shows only hackathon work; contributions clearly identified | The first commit is 28 Oct (inside the 27 Oct–4 Nov build period), and the research notes are dated 26–27 Oct. [contributions.md](contributions.md) needs the 30–31 Oct work and the real team names. |
| Everyone who worked on it listed; one representative submits | Team and track are still to be confirmed. |
| Rights to all code, data and assets | Poly Haven assets are CC0 ([assets-and-licenses.md](assets-and-licenses.md)); everything else is original or npm packages. |
| Not an anti-project | Not medical advice, a RAG app, political content or war. A fictional town; no real emergency guidance. |

## Scoring against the rubric

Stage Two scores each category from 0 to 10, then weights them. The top five per track go to a live final judged on the video.

| Category | Weight | What we have | What would move the score |
| --- | --- | --- | --- |
| **Impact** | 30% | Training before a crisis for coordinators who must act on partial, ageing information. | State the user clearly in the video and README: a shelter or emergency coordinator, a council, a school. Show the debrief lesson ("the bridge report never reached the plan"). Keep the honest limits. |
| **Use of Meta AI tooling** | 25% | Three role-bounded Muse Spark agents with structured JSON output. A planner reads the team radio, and the engine dry-runs each plan as a guardrail with one revision. Prompts are visible ("What they saw"). | 1. **Live Muse Spark runs** (required). 2. **Voice orders through Muse Voice Transcribe**: the "Radio the crew" bar becomes a real radio. 3. **The same crew on Muse Spark Open** via Baseten, already supported by config, for the open-weights bonus. 4. Show latency, tokens and refusals on screen. |
| **Technical depth** | 20% | A deterministic engine (36 tests), server-side replay that never trusts the client, a schema-checked guardrail loop, streamed NDJSON, and a single handler shared by dev and Vercel. | Prompt tuning against real output. Tests for live-output edge cases. A short architecture diagram in the README. |
| **Demo** | 25% | Full-screen 3D town, crew radio, dispatch ticket, decision replay. | A deployed URL that works for judges, a tight three-minute video, and a reliable live path (scripted fallback clearly labelled). |

## Bonus prizes we can reasonably target

| Prize | Fit | What it needs |
| --- | --- | --- |
| Best Agentic Use-Case ($5K) | Strong: three agents coordinate, decide, and are checked by rules. | The live model run, and agent autonomy and checks visible in the video. |
| Best Build on Meta Open Weight Models ($10K) | Possible: Muse Spark Open on Baseten through the same provider. | Baseten credits (requested separately, discretionary) and a model switch shown in the UI and README. Uses `meta-models/muse-spark-open-1026`. |
| Most Viral Project ($20K) | Depends on reach. | Post the demo clip on X and submit the link on the platform. |
| Community Vote ($10K) | Gallery votes after the ceremony. | A strong thumbnail and a clear one-line pitch. |

## Plan to the deadline

Times are Singapore. Order matters more than the exact day.

1. **Today, 31 Oct, your actions:**
   - Claim the Meta credits ([form](https://docs.google.com/forms/d/e/1FAIpQLScam78z7tHsNYibiFyJQVFzEgr0coyBTiY568SxxNbsPa3jiw/viewform)).
   - Add a card and a spend-limit alert under Billing.
   - Request Baseten credits.
   - Confirm the track and team members.
2. **31 Oct – 1 Nov, build:**
   - Voice orders through Muse Voice Transcribe: a press-to-talk mic on the command bar, with the transcript shown as the commander's turn.
   - Show the model name, latency and tokens per turn in the radio.
   - Update the contributions log.
   - Tidy the old screenshots.
3. **As soon as a key works:**
   - Run the live crew and tune the prompts on both drill paths (hill road and bridge).
   - Record real transcripts into the test fixtures.
   - Try Muse Spark Open on Baseten.
4. **2 Nov:**
   - Deploy to Vercel with the key as a server-side environment variable (needs your go-ahead).
   - Make the GitHub repository public (needs your go-ahead).
   - Run a full drill on the deployed URL.
5. **3 Nov:**
   - Record the three-minute video (script below) and finish the README.
   - Use Discord troubleshooting if anything is blocked.
6. **4 Nov, a day early:** submit and check every link in a logged-out browser. Post the clip on X.

## Three-minute video outline

1. **0:00–0:20, the problem.** Coordinators make decisions on reports that are partial and ageing. You can't rehearse that on a real flood.
2. **0:20–0:45, the town.** Harbor Point: the bridge, the school without power, the water rising. Introduce the crew, who each know a different part of the story.
3. **0:45–1:40, a live drill.**
   - Speak an order (voice).
   - Three Muse Spark reports stream in, and we open "What they saw".
   - Priya's plan is refused by the rules, revised, then passes.
   - Approve, and the truck rolls.
4. **1:40–2:20, rewind.** Change one decision and watch the decision replay: two futures side by side and a debrief that names the event that made the difference.
5. **2:20–2:45, how it's built.** Engine-checked guardrail, server replay, bounded briefings, and the Meta models used.
6. **2:45–3:00, what was built during the hackathon, and the honest limits.**

## Open decisions for you

- **Track.** Indie Developer (solo builders and students; judged on creativity, ambition and whether it works) or Startup.
- **Team members** to list on the submission.
- **Public repository name** and GitHub account.
- **Go-ahead** for each outward step: making the repository public, deploying, submitting, posting on X.
