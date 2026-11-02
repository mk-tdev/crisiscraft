# CrisisCraft: what it is and how to use it

**Live app:** https://crisiscraft.vercel.app
**Code:** https://github.com/mk-tdev/crisiscraft

## The idea in one minute

Emergency coordinators make decisions with **incomplete, ageing information**. The person who saw the bridge flooding isn't the person planning the trucks. Warnings get lost, and once a truck is sent you can't take it back.

You can't practise that on a real flood. **CrisisCraft is a flight simulator for that moment.**

- You are the **coordinator** of a fictional flooding town, **Harbor Point**.
- You give orders to a **crew of three AI teammates**. Each one knows only what their character would really know.
- They report back, warn you, review each other's plans, and speak up on their own when news reaches them. Code checks every plan against hard rules before you can approve it.
- You can hand the whole drill to an **AI commander (Autopilot)** and compare its run with yours.
- When the drill ends, you **rewind one decision**. You then watch both versions of events side by side and get a debrief that explains exactly why they differed.
- An **Agents panel** shows the whole orchestration as it happens: every step, every model call and what each model saw.

The lesson the drill teaches: **a warning only helps if it reaches the person making the plan.**

## Two drills

Pick a drill in the **mission briefing**. It opens on your first visit, and the ⓘ button at the top right reopens it. Switching drills starts a fresh run.

| | **Harbor Point** (tutorial) | **Harbor Point Region** |
|---|---|---|
| **Length** | 15 minutes | 50 minutes (the clock runs twice as fast) |
| **Places in need** | School shelter, then an east shelter | Care home, hill school, village across the bay, field hospital |
| **Vehicles** | 2 trucks | 4 trucks that **drive back to reload**, plus a **Rescue Helicopter** |
| **Hazards** | North bridge closes at minute 4; school has no power until 6 | Harbour bridge closes at 12; tide floods the causeway 14–26; gusts ground the helicopter 20–25; a false landslide report at 10 |
| **Best for** | Learning the controls in 3 minutes | The full challenge, and the demo |

### The tutorial

| | |
|---|---|
| **Goal** | Get **6 crates** from the depot to the **school shelter** by **minute 9**. |
| **The catch** | The **north bridge** is the fastest road (4 minutes), but the water is rising. It **closes at minute 4**. You don't know that in advance. |
| **The safe road** | The **hill road** is slower (6 minutes) and stays open. |
| **Also** | The school has **no power to unload until minute 6**. At minute 5 the **east shelter** asks for crates too. |
| **Rule** | Keep **one truck in reserve** at the depot. You have Rescue 01 and Rescue 02. |

### The region

It uses the same crew, rules and tools, spread across the whole expanded town.

| | |
|---|---|
| **Depot** | The **port depot** in the west: **34 crates** and **four trucks**, Rescue 01–03 (8 crates each) and Lorry 04 (12). Trucks **drive back to reload** after a delivery. |
| **Who needs crates** | **Care home** on the low ground: 8 by minute 16, and the residents can't be moved. **School** on the hill estate: 12 by minute 30. **Village hall** across the bay: 8 by minute 34. **Field hospital** by the station: opens at minute 14, 6 by minute 46. That's 34 crates needed, with 34 in stock. |
| **Hazards** | The **harbour bridge** closes at **minute 12**. High tide covers the **causeway**, the village's only road, from **minute 14 to 26**. At minute 10 a caller reports a **landslide on Station Road**; it is a **false alarm**, and June can confirm that at minute 18. |
| **Rescue Helicopter** | Parked on the port **helipad**. Flies **direct** to the village hall (5 min), field hospital (6 min) or care home (4 min), and never uses roads. Carries only **4 crates** a flight. **Gusts ground it from minute 20 to 25**, and only Priya knows, from the pilot. It doesn't count towards the truck reserve. |
| **Rule** | Keep **one truck** at the depot. |

Drives take 13–16 minutes. Timing matters more than speed:

- **Care home:** send it **straight away over the harbour bridge**, and it arrives at minute 15. The ring road gets there 2 minutes late, and a bridge run sent after minute 3 hits the closure.
- **Village:** the causeway is under water from 14 to 26, so the earliest any truck can arrive is minute 30. A truck sent early just waits at the causeway head.
- **The helicopter:** while the causeway is under water, it is the only way into the village. 8 crates needs two flights, and the gusts cut into that window. If it lands at the village at minute 19, the gusts trap it there until 25, because its flight home starts at 20.
- **Field hospital:** only reachable on Station Road. Believe the landslide rumour and you'll hold back a truck you could have sent.

A well-run drill supplies all four places on time; the engine tests prove one such sequence. June's tide table, Malik's priorities, the pilot's gust warning and Priya's map only come together if they reach the radio.

## The crew

Each crew member is a separate Meta AI model call. Each one sees only their own **briefing**. Their posts change with the drill.

| | Who | Post (tutorial / region) | What they know |
|---|---|---|---|
| 🟦 | **Priya**, logistics lead | Supply depot / Port depot | Stock, trucks, the helicopter and the road map. She does **not** know which roads are open now. She drafts every plan. |
| 🟪 | **Malik**, shelter manager | School shelter / Shelter desk | What each place needs, by when, and whether it can unload. |
| 🟩 | **June**, field lead | North bridge / Out on the roads | What the water is actually doing: the bridge, the tide, which roads are passable. |

Nobody sees everything. **Priya plans, but only June has seen the water.** If June's warning doesn't reach the radio, Priya sends the truck over the bridge.

## How to play: a 3-minute walkthrough

These steps use the tutorial. Everything works the same way in the region; see [Playing the region](#playing-the-region) below.

### 1. Open the app

Open https://crisiscraft.vercel.app. Choose a drill in the **mission briefing** and click **Take command**.

What's on screen:

- **Top bar:**
  - the game clock with play, step and speed controls, and a timeline of the drill showing its deadlines;
  - **Autopilot** (an AI commander);
  - a green **Meta · muse-spark-1.3** badge, which means the crew is live AI;
  - the **Agents**, **Crew** and **Log** buttons.
- **Top left:** the headline and status chips: roads, the helicopter (in the region), crates, the next deadline and trucks in reserve.
- **In the town:** labels over each place show crates delivered and when they're due, and labels over each vehicle show its status.
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

Type an order, click a suggestion, or click the 🎤 **mic** and speak it; Muse Voice Transcribe turns it into text. Try:

> **Get six crates to the school. Keep one truck back.**

### 4. Listen to the radio

Over about 10–20 seconds:

1. **Malik, June and Priya each report**, in parallel, from their own briefing. Under any message, click **what X saw** to see the exact facts that person was given.
2. **Priya checks her own work.** Grey "Tool" lines show her:
   - reading her map (`list_routes`);
   - testing a plan against the rules (`check_plan`), which comes back **Passes** or **Refused** with a reason.

   While she tests a route, it **lights up in the town**. A route over a closed road glows red, and a helicopter flight shows as an arc in the sky.
3. **Priya proposes a plan** and explains which teammate's report changed it.
4. **Teammates review the plan.** Malik and June each check Priya's draft against what *they* know and answer **Agrees** or **Concern**. If either has a concern, Priya revises once, or keeps the plan and answers the concern out loud.
5. **Rules check:** our code checks the plan again for stock, capacity, closed roads, grounded aircraft and the reserve rule. A model can't get a bad plan past this.

### 4½. The crew speaks up by itself

While the clock runs, news reaches the crew. In the tutorial, the **bridge closes at minute 4**, the **east shelter calls at minute 5**, and the **school's power returns at minute 6**. When a report lands, the clock **pauses** and the person who received it radios in **unprompted** (marked **Radioed in**). Priya then proposes what should change, without waiting for your order. Turn this off with the **Auto** toggle on the radio.

### 5. Approve

A **dispatch ticket** appears with the vehicle, crates, destination and route. Click **Approve**, or **Send back** to discard it. The truck (or helicopter) starts moving and the camera follows it. Press play, or **End** to run to the last minute.

### 6. Rewind one decision

Open **Log**, find your decision and click **Rewind**. You're back at that minute with the same storm. Now give the risky order:

> **Bridge is fastest — send the school crates that way.**

Priya will **follow your order but warn you** first ("June warned the water is rising…"); the crew doesn't override you. June will also object in review. Approve it and run to the end.

If you try the bridge **after minute 4**, Priya's own test is refused ("Route uses an already-closed road") and she holds the crates instead.

### 7. Decision replay

When the drill ends, click **Decision replay**. The screen splits:

- **A** is what you did first; **B** is the "what if".
- Same storm, same clock, one changed order. In the tutorial, typically:
  - **A:** the hill road reaches the school on time at minute 8.
  - **B:** the truck hits the bridge closure at minute 4, diverts, and arrives late at minute 11.
- In the region, each side shows how many places were supplied on time.

### 8. After-action review

Click **Review** in the replay, or **After-action review** at the end of a single run. **Muse Spark** writes a debrief from the engine's event log and what each crew member knew at each order:

- a headline;
- two to four findings;
- one lesson for next time.

Every finding has to point to **real events** from the drill, shown as chips like `B · min 04 · North bridge closed to new traffic`. The server checks each one against what actually happened and **removes any finding that refers to something that didn't happen**. The footer says how many checked out, for example "9 of 9 match".

### Autopilot: let the AI command

Click **Autopilot off** in the top bar to switch it on, and an AI commander (Muse Spark) runs the drill. It sees only what you would see: the public board, public reports and the crew radio. It picks one move at a time (give an order, approve, send back, or let the clock run) and explains each move in the black **Autopilot** card at the top of the radio. It acts through the same controls you do, so every rule still applies.

Then rewind and play the same moment yourself, and open **Decision replay** to compare your run with the AI's. In the region the AI commander doesn't always win. In one test it used its spare truck on the hospital too early and missed the village. **Can you beat it?**

### The Agents panel: see the whole orchestration

Click **Agents** in the top bar. A wide panel opens with run totals (orchestrations, model calls, tokens, approvals) and three tabs:

- **Live pipeline:** the six stages (**Brief → Report → Plan → Rules → Review → Decide**), with the running stage lit, and a **timing chart** of the current deliberation:
  - the three reports overlap because they run in parallel;
  - Priya's tool calls are ticks inside her plan, marked passes or refused;
  - the two reviews run side by side;
  - the rules check is code, not a model call.
- **Model calls:** every call with its agent, model, time and tokens. Expand one to see the **exact instructions and bounded briefing** that model received, and its output.
- **Journey:** every orchestration this run, in order: your orders, crew members radioing in, bridge photos (three models chained, with timings), every Autopilot move with its reason, and the plans you approved.

The panel only renders while it's open, so it costs the 3D town nothing the rest of the time.

### Start over

Click ↻ at the top right for a new drill.

## Playing the region

1. Pick **Harbor Point Region** in the mission briefing.
2. **Minute 2:** click **Get 8 crates to the care home by minute 16.** The crew should send Rescue 01 over the harbour bridge, arriving at minute 15. Approve it.
3. **Minute 4:** the school asks for 12 crates. Lorry 04 by the West Road and Farm Lane arrives at minute 17.
4. **Minutes 6–14:** the village asks for crates, but the tide will cover the causeway from 14. Either send a truck to wait it out (it arrives at 30) or use the **helicopter**, 4 crates a flight. Watch for June's tide report and Priya's gust warning on the radio.
5. **Minute 10:** a landslide is reported on Station Road. Ask June before you believe it.
6. **Minute 14:** the field hospital opens. You'll need a truck back from an earlier run to reach it in time.

In the town, the helicopter lifts off from the port helipad, flies across the bay and lands on a pad. During the gusts, its rotors stop, the windsock streams and a **GROUNDED** board goes up.

## The 3D town

- **Two drills, one town:** a port with cranes and a container ship, a high street, a hill estate, a railway with a station and a train, farmland, a village across the bay with a wind farm, a lighthouse and a marina.
- **Flood visuals follow the drill:** the water rises over its length, the bridge is barred when it closes, and the causeway floods and is barred at high tide.
- **Object-aware:**
  - buildings, trees, lamps and parked cars are kept clear of every road vehicles drive;
  - traffic stops and pulls to the kerb for a moving rescue truck, and keeps its distance from the car ahead;
  - people pause while a truck passes;
  - crowds at shelters stand beside the buildings.
- **Kept light:** scenery placement is worked out once when the town loads. Each frame, cars check only the few moving trucks, and no new objects are created.

## What the Meta models do

| Model | Its job in CrisisCraft |
|---|---|
| **Muse Spark** (`muse-spark-1.3`) | Plays the crew: three reports in parallel, each from a bounded briefing. Priya plans as an agent that calls our engine as a tool. Malik and June review her plan, and anyone can radio in on their own when news reaches them. On Autopilot it also plays the commander. It reads June's photo and writes the after-action review. |
| **Muse Image** (`muse-image-1.0`) | Creates June's photo of the bridge at the current water level. |
| **SAM 3.1** (`sam-3.1`) | Outlines the bridge and the floodwater in the photo, so the share of the bridge under water can be measured. |
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) | Turns your spoken orders into text. |

**Models propose; code decides.** The AI never moves a truck or a helicopter. Only an approval changes the world, and the rules are enforced in code, not in the prompt.

## Proof that it works: the measured results

We ran **30 live drills** of the tutorial from the same moment (minute 2), with three conditions:

| Condition | Took the safe hill road | School supplied on time | Plan mentions June's warning | June objected in review |
|---|---|---|---|---|
| Full radio, "get six crates to the school" | **10 of 10** | **10 of 10** | 10 of 10 | 0 of 10 |
| Same order, **June kept off the radio** | 0 of 10 | **0 of 10** | 1 of 10 | silenced |
| Full radio, "bridge is fastest, go that way" | 0 of 10 (followed your order) | 0 of 10 | **10 of 10 warned you** | **10 of 10** |

Take one person's report away and the crew drives into the flood every time. Details are in [docs/eval/crew-eval.md](docs/eval/crew-eval.md).

**Live moments from the region**, recorded during testing:

- At minute 2 the crew sent Rescue 01 to the care home over the harbour bridge before it closed, and both reviewers agreed.
- At minute 14, with the causeway flooding, Priya worked out the village was reachable only by air. Her own dry run refused a plan that sent the one helicopter twice, so she submitted a single flight.

## Without an AI key

If no key is set, the app runs a **Scripted crew** that reads the same briefings and follows the same rules, clearly labelled in the header. It plays both drills, helicopter included. The photo, voice and review buttons are hidden. The live site uses the real key.

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
| `packages/sim` | The simulation engine: roads and air routes, trucks and the helicopter, stock, closures and reopenings, deliveries and return trips. Pure and repeatable: the same orders always produce the same outcome. |
| `packages/crew` | The AI crew: briefings, the Meta model calls, Priya's tools, peer review, crew initiative, the photo pipeline, voice, the after-action review, Autopilot and the rate limits. |
| `apps/web` | The website: the 3D town and helicopter, the radio, command bar, Agents panel, replay and review. |
| `server/` | Small entry files that become the live site's API endpoints: `/api/crew`, `/api/photo`, `/api/voice`, `/api/debrief` and `/api/commander`. |
| `scenarios/` | The two drills: `harbor-point.json` (tutorial) and `harbor-point-region.json`, each with its map, reports, closures, vehicles and the shelters' needs. |
| `docs/` | Hackathon rules and plan, evaluation results, asset licences, the production rehearsal and the contribution log. |

## Honest limits

- Harbor Point and its region are **fictional**. Nothing here is real emergency guidance.
- There are **two authored scenarios**. Drills aren't saved between visits.
- The 30-drill measurements were run on the tutorial. The region is covered by engine tests that play its intended solution and each trap, and by recorded live runs, but not by a repeated evaluation.
- AI answers vary a little from run to run. The rules check and the engine keep outcomes trustworthy.
- Frame rate has been smooth in testing, but not measured on a range of graphics cards.
- Each visitor is rate-limited so the public site can't use up the AI credits.

## Hackathon checklist

- [x] Uses Meta models (four of them) in a working product
- [x] Public repo, live deployed site
- [x] `docs/contributions.md` covers the work built 28 Oct – 2 Nov
- [ ] Record the **3-minute demo video**. Suggested flow:
  1. the region briefing;
  2. an order with the radio and the **Agents** panel open;
  3. the helicopter over the flooded causeway;
  4. Autopilot;
  5. rewind and decision replay;
  6. the after-action review;
  7. the results table.
- [ ] Submit by **Wed 4 Nov, 9:00 PM ET** (Thu 5 Nov, 10:00 AM Singapore): repo link, video link, track (Indie Developer), team members
- [ ] Post the demo on X (for the Most Viral bonus prize) and add the link to the submission
