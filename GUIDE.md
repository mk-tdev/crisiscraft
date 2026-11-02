# CrisisCraft: what it is and how to use it

**Live app:** https://crisiscraft.vercel.app
**Code:** https://github.com/mk-tdev/crisiscraft

## The idea in one minute

Emergency coordinators make decisions with **incomplete, ageing information**. The person who saw the bridge flooding isn't the person planning the trucks. Warnings get lost, and once a truck is sent you can't take it back.

You can't practise that on a real flood. **CrisisCraft is a flight simulator for that moment.**

- You are the **coordinator** of a fictional flooding town, **Harbor Point**.
- You give orders to a **crew of three AI teammates**. Each one knows only what their character would really know.
- They report back, warn you, and propose a plan. Code checks every plan against hard rules before you can approve it.
- When the drill ends, you **rewind one decision**. You then watch both versions of events side by side and get a debrief that explains exactly why they differed.

The lesson the drill teaches: **a warning only helps if it reaches the person making the plan.**

## The scenario (tutorial)

There are two drills. Start with this short tutorial; the larger **Harbor Point Region** is described below.


| | |
|---|---|
| **Goal** | Get **6 crates** of supplies from the depot to the **school shelter** by **minute 9**. |
| **The catch** | The **north bridge** is the fastest road (4 minutes), but the water is rising. It **closes at minute 4**. You don't know that in advance. |
| **The safe road** | The **hill road** is slower (6 minutes) and stays open. |
| **Also** | The school has **no power to unload until minute 6**. Later, at minute 5, the **east shelter** asks for crates too. |
| **Rule** | Keep **one truck in reserve** at the depot at all times. You have two trucks: Rescue 01 and Rescue 02. |

The drill lasts **15 minutes** of game time.

## The bigger drill: Harbor Point Region

Pick **Harbor Point Region** in the mission briefing (the ⓘ button reopens it). It is the same crew, rules and tools, across the whole expanded town, over **50 minutes**.

| | |
|---|---|
| **Depot** | The **port depot** in the west: **34 crates**, **four trucks**: Rescue 01–03 (8 crates each) and Lorry 04 (12). Trucks **drive back to reload** after a delivery. |
| **Who needs crates** | **Care home** on the low ground (8 by minute 16; residents can't be moved). **School** on the hill estate (12 by minute 30). **Village hall** across the bay (8 by minute 34). **Field hospital** by the station, which opens at minute 14 (6 by minute 46). 34 crates needed, 34 in stock. |
| **Hazards** | The **harbour bridge** closes at **minute 12**. High tide covers the **causeway** to the village from **minute 14 to 26**, and it is the village's only road. At minute 10 a caller reports a **landslide on Station Road**: it is a **false alarm**, and June can confirm that at minute 18. |
| **Rescue Helicopter** | Based on the port helipad. Flies **direct** to the village hall (5 min), field hospital (6 min) or care home (4 min) and never uses roads, but carries only **4 crates** a flight. **Gusts ground it from minute 20 to 25**: only Priya knows, from the pilot. It doesn't count towards the truck reserve. |
| **Rule** | Keep **one truck** at the depot. |

Drives take 13–16 minutes. Trucks can only be in so many places, and timing matters more than speed:

- **Care home:** send it **straight away over the harbour bridge** (it arrives at 15). The ring road gets there 2 minutes late, and a bridge run sent after minute 3 hits the closure.
- **Village:** the causeway is under water from 14 to 26. The earliest any truck can arrive is minute 30, so a truck sent early just waits at the causeway head.
- **The helicopter:** while the causeway is under water, it is the only way into the village. Two flights are needed for 8 crates, and the gusts cut into that window. Land at the village at minute 19 and the gusts trap it there until 25, because its flight home starts at 20.
- **Field hospital:** only reachable on Station Road. Believe the landslide rumour and you'll hold a truck you could have sent.

A well-run drill supplies all four places on time (the engine tests prove one such sequence). June's tide table, Malik's priorities and Priya's map only come together if they reach the radio.

## The crew

Each crew member is a separate Meta AI model call. Each one sees only their own **briefing**.

| | Who | What they know |
|---|---|---|
| 🟦 | **Priya**, logistics lead at the depot | Stock, trucks and the road map. She does **not** know which roads are open now. She drafts every plan. |
| 🟪 | **Malik**, shelter manager at the school | What the shelters need, by when, and whether they can unload. |
| 🟩 | **June**, field lead at the north bridge | What the water is actually doing. At minute 1 she sees it rising. |

Nobody sees everything. **Priya plans, but only June has seen the water.** If June's warning doesn't reach the radio, Priya sends the truck over the bridge.

## How to play: a 3-minute walkthrough

### 1. Open the app

Open https://crisiscraft.vercel.app. A **mission briefing** card explains the drill; click **Take command**. You can reopen it any time from the ⓘ button at the top right.

What's on screen:

- **Top bar:**
  - the game clock with play, step and speed controls, and a timeline of the 15 minutes;
  - on the right, a green **Meta · muse-spark-1.3** badge, which means the crew is live AI;
  - **Crew** and **Log** buttons.
- **Top left:** the headline and status chips: bridge, school power, crates, deadline, trucks in reserve.
- **Right edge:** camera buttons (Town, Bridge, School, Truck) and toggles for rain and labels. Scroll to zoom and drag to look around.
- **Bottom left:** the **Crew radio**, where the crew talks.
- **Bottom centre:** the **command bar**, where you give orders.

### 2. (Optional) Ask June for a photo

Click **Bridge photo** in the radio. About 20 seconds later June sends a photo of the bridge, made by three AI models in a chain:

1. **Muse Image** creates the photo at the water level the simulation says it is right now.
2. **SAM 3.1** outlines the bridge in blue and the water in orange, and we measure how much of the bridge is under water.
3. **Muse Spark** looks at the photo and the measurement, then calls it **Passable**, **Risky** or **Not passable**, with a two-sentence report.

Her reading goes onto the radio, so Priya hears it when she next plans.

### 3. Give an order

Type an order, click a suggestion, or click the 🎤 **mic** to speak it; Muse Voice Transcribe turns it into text. Try:

> **Get six crates to the school. Keep one truck back.**

### 4. Listen to the radio

Over about 10 seconds:

1. **Malik, June and Priya each report** from their own briefing. Under any message, click **what X saw** to see the exact facts that person was given.
2. **Priya checks her own work.** Grey "Tool" lines show her:
   - reading her map (`list_routes`);
   - testing a plan against the rules (`check_plan`), which comes back "passes" or "refused" with a reason.
3. **Priya proposes a plan**, explaining which teammate's report changed it.
4. **Teammates review the plan.** Malik and June each check Priya's draft against what *they* know and answer **Agrees** or **Concern**. If either has a concern, Priya revises once, or keeps the plan and answers the concern out loud.
5. **Rules check:** our code checks the plan again for stock, truck capacity, closed roads and the reserve rule. A model can't get a bad plan past this.

### 4½. The crew speaks up by itself

While the clock runs, news reaches the crew: the **bridge closes at minute 4**, the **east shelter calls at minute 5**, and the **school's power returns at minute 6**. When a report lands, the clock **pauses**, and the person who received it radios in **unprompted** (marked **Radioed in**). Priya then proposes what should change, without waiting for your order. Turn this off with the **Auto** toggle on the radio.

### 5. Approve

A **dispatch ticket** appears with the truck, crates, destination and route. Click **Approve**, or **Send back** to discard it. The truck starts moving in the 3D town and the camera follows it. Press play, or **End** to run to minute 15.

### 6. Rewind one decision

Open **Log**, find your decision and click **Rewind**. You're back at that minute with the same storm. Now give the risky order:

> **Bridge is fastest — send the school crates that way.**

Priya will **follow your order but warn you** first ("June warned the water is rising…"). The commander decides; the crew doesn't override you. Approve it and run to the end.

If you try the bridge **after minute 4**, Priya's own test is refused ("Route uses an already-closed road") and she holds the crates instead.

### 7. Decision replay

When the drill ends, click **Decision replay**. The screen splits:

- **A** is what you did first; **B** is the "what if".
- Same storm, same clock, one changed order. Typically:
  - **A:** the hill road reaches the school on time at minute 8.
  - **B:** the truck hits the bridge closure at minute 4, diverts, and arrives late at minute 11.

### 8. After-action review

Click **Review** in the replay, or **After-action review** at the end of a single run. **Muse Spark** writes a debrief:

- a headline;
- two to four findings;
- one lesson for next time.

Every finding has to point to **real events** from the drill, shown as chips like `B · min 04 · North bridge closed to new traffic`. The server checks each one against what actually happened and **removes any finding that refers to something that didn't happen**. The footer says how many checked out, for example "9 of 9 match".

### Autopilot: let the AI command

Click **Autopilot off** in the top bar to switch it on. An AI commander (Muse Spark) now runs the drill. It sees only what you would see, and picks one move at a time (order, approve, send back, or let the clock run), with its reason in the black **Autopilot** card at the top of the radio. Then rewind and play the same moment yourself, and open **Decision replay** to compare your run with the AI's.

While Priya tests routes, watch the town: the route she's dry-running lights up on the map.

### Start over

Click ↻ at the top right for a new drill.

## What the Meta models do

| Model | Its job in CrisisCraft |
|---|---|
| **Muse Spark** (`muse-spark-1.3`) | Plays the crew: three reports in parallel, each from a bounded briefing. Priya plans as an agent that calls our engine as a tool, Malik and June review her plan, anyone can radio in on their own when news reaches them, and on Autopilot it plays the commander too. Also reads June's photo and writes the after-action review. |
| **Muse Image** (`muse-image-1.0`) | Creates June's photo of the bridge at the current water level. |
| **SAM 3.1** (`sam-3.1`) | Outlines the bridge and the floodwater in the photo, so the share of the bridge under water can be measured. |
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) | Turns your spoken orders into text. |

**Models propose; code decides.** The AI never moves a truck. Only your approval changes the world, and the rules are enforced in code, not in the prompt.

## Proof that it works: the measured results

We ran **30 live drills** from the same moment (minute 2), with three conditions:

| Condition | Took the safe hill road | School supplied on time | Plan mentions June's warning | June objected in review |
|---|---|---|---|---|
| Full radio, "get six crates to the school" | **10 of 10** | **10 of 10** | 10 of 10 | 0 of 10 |
| Same order, **June kept off the radio** | 0 of 10 | **0 of 10** | 1 of 10 | silenced |
| Full radio, "bridge is fastest, go that way" | 0 of 10 (followed your order) | 0 of 10 | **10 of 10 warned you** | **10 of 10** |

Take one person's report away and the crew drives into the flood every time. Details are in [docs/eval/crew-eval.md](docs/eval/crew-eval.md).

## Without an AI key

If no key is set, the app runs a **Scripted crew**: fixed rules reading the same briefings, clearly labelled in the header. The photo, voice and review buttons are hidden. The live site uses the real key.

## Running it on your machine

```sh
npm ci
cp .env.example .env        # put your MODEL_API_KEY in .env
npm run assets:fetch        # downloads the free 3D textures and sky (needs Python 3)
npm run dev                 # open http://127.0.0.1:5173
```

Useful commands:

| Command | What it does |
|---|---|
| `npm run check` | Runs all tests, type checks, and builds the app. |
| `npm run meta:check` | One quick live call to Muse Spark and Voice Transcribe, to prove the key works. |
| `npm run eval:crew -- 10` | Re-runs the 30-drill measurement (10 per condition). |
| `git push` to `main` | Vercel automatically rebuilds and redeploys the live site. |

## Where things live

| Folder | What's in it |
|---|---|
| `packages/sim` | The simulation engine: roads, trucks, stock, closures, deliveries. Pure and repeatable: the same orders always produce the same outcome. |
| `packages/crew` | The AI crew: briefings, the Meta model calls, Priya's tools, the photo pipeline, voice, the after-action review, and the rate limits. |
| `apps/web` | The website: the 3D town, radio, command bar, replay and review. |
| `server/` | Small entry files that become the live site's API endpoints (`/api/crew`, `/api/photo`, `/api/voice`, `/api/debrief`). |
| `scenarios/harbor-point.json` | The scenario: map, reports, when the bridge closes, what the shelters need. |
| `docs/` | Hackathon rules and plan, evaluation results, asset licences, contribution log. |

## Honest limits

- Harbor Point is **fictional**. Nothing here is real emergency guidance.
- There are **two authored scenarios** (the tutorial and the region). Drills aren't saved between visits.
- The 30-drill measurements were run on the tutorial; the region has engine tests but no live evaluation yet.
- AI answers vary a little from run to run. The rules check and the engine are what keep outcomes trustworthy.
- Each visitor is rate-limited so the public site can't use up the AI credits.

## Hackathon checklist

- [x] Uses Meta models (four of them) in a working product
- [x] Public repo, live deployed site
- [ ] Update `docs/contributions.md` with everything built 30 Oct – 4 Nov
- [ ] Record the **3-minute demo video**: follow the walkthrough above, steps 2 → 8, then show the results table
- [ ] Submit by **Wed 4 Nov, 9:00 PM ET** (Thu 5 Nov, 10:00 AM Singapore): repo link, video link, track (Indie Developer), team members
- [ ] Post the demo on X (for the Most Viral bonus prize) and add the link to the submission
