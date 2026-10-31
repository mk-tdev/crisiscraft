import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { crew, roles, type CrewTurn } from "@crisiscraft/crew";
import { harborPoint, idleAtDepot } from "@crisiscraft/sim";
import type { CameraView, CrewMarker, Selection } from "./Town";
import { LazyTown as Town } from "./LazyTown";
import { askCrew, crewStatus, type ProviderInfo } from "./api";
import { useDrill } from "./drill";
import { describe, mm, requestNames, routeName, trucks } from "./format";
import { Icon, type IconName } from "./icons";
import { Radio, type CrewState } from "./components/Radio";
import { Dispatch } from "./components/Dispatch";
import { CrewPanel } from "./components/Crew";
import { LogPanel } from "./components/Log";
import { Compare } from "./components/Compare";
import { Briefing } from "./components/Concepts";
import { MinuteStrip } from "./components/Timeline";

type Drawer = "crew" | "log" | null;
const cameras: { id: CameraView; label: string; icon: IconName }[] = [
  { id: "overview", label: "Town", icon: "map" },
  { id: "bridge", label: "Bridge", icon: "bridge" },
  { id: "school", label: "School", icon: "home" },
  { id: "convoy", label: "Truck", icon: "truck" },
];
const BRIEFED = "crisiscraft:briefed";

function useCrew(minute: number, revision: number) {
  const [state, setState] = useState<CrewState | null>(null);
  const abort = useRef<AbortController | null>(null);
  const ask = useCallback(async (order: string, commands: Parameters<typeof askCrew>[0]["commands"]) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ order, turns: [], result: null, error: null, loading: true });
    try {
      const result = await askCrew({ minute, order, commands }, (turn: CrewTurn) =>
        setState((s) => (s ? { ...s, turns: [...s.turns, turn] } : s)), controller.signal);
      setState((s) => (s ? { ...s, turns: result.turns, result, loading: false } : s));
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((s) => (s ? { ...s, loading: false, error: error instanceof Error ? error.message : "Unknown error." } : s));
    }
  }, [minute]);
  const clear = useCallback(() => {
    abort.current?.abort();
    setState(null);
  }, []);
  const stale = !!state?.result && (state.result.minute !== minute || state.result.revision !== revision);
  return { state, setState, ask, clear, stale };
}

function firstVisit() {
  try { return !localStorage.getItem(BRIEFED); } catch { return true; }
}

export function App() {
  const drill = useDrill();
  const { world, timeline, timelines, active } = drill;
  const crewChat = useCrew(world.tick, world.revision);
  const [provider, setProvider] = useState<ProviderInfo | null | undefined>(undefined);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [radioOpen, setRadioOpen] = useState(true);
  const [briefing, setBriefing] = useState(firstVisit);
  const [view, setView] = useState<CameraView>("overview");
  const [cameraRevision, setCameraRevision] = useState(0);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [labels, setLabels] = useState(true);
  const [weather, setWeather] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => { void crewStatus().then(setProvider); }, []);
  const closeBriefing = useCallback(() => {
    setBriefing(false);
    try { localStorage.setItem(BRIEFED, "1"); } catch { /* private mode: show again next time */ }
  }, []);
  const camera = (id: CameraView) => { setView(id); setCameraRevision((r) => r + 1); };

  const action = crewChat.state?.result?.command?.actions[0];
  const approve = () => {
    const result = crewChat.state?.result;
    if (!result?.command || !action) return;
    const summary = `${trucks[action.vehicleId]} · ${action.quantity} crates → ${requestNames[action.requestId]} via ${routeName(action.route)}`;
    drill.approve({ command: result.command, order: result.order, summary });
    crewChat.setState((s) => s && {
      ...s,
      result: { ...result, command: null },
      turns: [...s.turns, { id: `approved-${result.command!.id}`, from: "commander", kind: "order", text: `Approved. ${summary}.`, cites: [] }],
    });
    camera("convoy");
  };
  const newDrill = () => { drill.reset(); crewChat.clear(); setComparing(false); camera("overview"); };
  const switchTo = (id: "A" | "B") => { drill.switchTo(id); crewChat.clear(); };

  const markers: CrewMarker[] = useMemo(() => roles.map((role) => {
    const s = crewChat.state;
    const said = s?.turns.filter((t) => t.from === role).at(-1);
    const fresh = s && (s.loading || s.result?.minute === world.tick);
    return {
      role, name: crew[role].name, title: crew[role].title,
      status: s?.loading && !said ? "thinking" : fresh && said ? "speaking" : "idle",
      line: fresh ? said?.text : undefined,
    };
  }), [crewChat.state, world.tick]);

  const school = world.requests.school;
  const moving = Object.values(world.vehicles).find((v) => v.status === "travelling");
  const title = drill.ended ? "The water has had its say."
    : school?.completedTick != null ? "The school has its crates."
      : moving ? `${trucks[moving.id]} is on the road.`
        : "Six crates. One school. Nine minutes.";
  const latest = [...world.events].reverse().find((e) => e.type !== "observation-received" && e.type !== "edge-arrived");
  // Branch decisions are copied by reference, so a new object means the what-if made its own choice.
  const branchReady = !!timelines.B?.decisions.some((d) => !timelines.A.decisions.includes(d));
  const reserve = idleAtDepot(harborPoint, world);
  const schoolState = school?.completedTick != null ? (school.completedTick <= school.dueTick ? "good" : "warn") : world.tick > (school?.dueTick ?? 99) ? "bad" : "";

  if (comparing && timelines.B) {
    return <div className="room"><Compare a={timelines.A} b={timelines.B} onClose={() => setComparing(false)} /></div>;
  }

  return (
    <div className="room">
      <div className="world">
        <Town
          state={world}
          progress={drill.progress}
          cameraView={view}
          cameraRevision={cameraRevision}
          route={action?.route}
          selected={selected}
          onSelect={setSelected}
          crew={markers}
          labels={labels}
          weather={weather}
        />
      </div>
      <div className="vignette" aria-hidden="true" />

      <header className="hud glass">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">c<i>.</i></span>
          <strong>Crisis<em>Craft</em></strong>
        </div>

        <div className="mission-clock">
          <button className="go icon" onClick={() => drill.setPlaying(!drill.playing)} disabled={drill.ended} aria-label={drill.playing ? "Pause" : "Play"}>
            <Icon name={drill.playing ? "pause" : "play"} size={15} />
          </button>
          <button className="ghost icon" onClick={drill.step} disabled={drill.ended || drill.playing} aria-label="Step one minute" title="Step one minute">
            <Icon name="step" size={15} />
          </button>
          <MinuteStrip world={world} progress={drill.progress} decisions={timeline.decisions} />
          <select value={drill.speed} onChange={(e) => drill.setSpeed(Number(e.target.value))} aria-label="Speed">
            {[1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          <button className="ghost" onClick={drill.runToEnd} disabled={drill.ended} title="Run to minute 15">End <Icon name="arrow" size={13} /></button>
        </div>

        <div className="hud-right">
          {timelines.B && (
            <div className="segmented" role="group" aria-label="Timeline">
              <button className={active === "A" ? "on" : ""} onClick={() => switchTo("A")}>A · your run</button>
              <button className={active === "B" ? "on" : ""} onClick={() => switchTo("B")}>B · what if</button>
            </div>
          )}
          {branchReady && <button className="go" onClick={() => setComparing(true)}><Icon name="split" size={14} /> Replay</button>}
          <span
            className={`status ${provider?.live ? "live" : provider ? "scripted" : "off"}`}
            title={provider?.live ? "Every crew turn is a live Meta model call." : "Add MODEL_API_KEY to run the crew on the Meta Model API."}
          >
            <i />
            {provider === undefined ? "Connecting…" : provider === null ? "Crew offline" : provider.live ? `Meta · ${provider.model}` : "Scripted crew"}
          </span>
          <button className={`ghost ${drawer === "crew" ? "on" : ""}`} onClick={() => setDrawer(drawer === "crew" ? null : "crew")}><Icon name="users" size={15} /> Crew</button>
          <button className={`ghost ${drawer === "log" ? "on" : ""}`} onClick={() => setDrawer(drawer === "log" ? null : "log")}>
            <Icon name="clock" size={15} /> Log{timeline.decisions.length > 0 && <span className="count">{timeline.decisions.length}</span>}
          </button>
          <button className="ghost icon" onClick={() => setBriefing(true)} aria-label="How it works" title="How it works"><Icon name="info" size={16} /></button>
          <button className="ghost icon" onClick={newDrill} aria-label="New drill" title="New drill"><Icon name="reset" size={16} /></button>
        </div>
      </header>

      <section className="situation">
        <span className="eyebrow accent">
          {active === "B" ? `Timeline B · what if, from minute ${mm(timeline.branchTick ?? 0)}` : "Harbor Point · coastal flood"}
        </span>
        <h1>{title}</h1>
        <ul className="conditions">
          <li className={world.roads.JS ? "warn" : "bad"}><Icon name="bridge" size={14} /> Bridge {world.roads.JS ? "open" : "closed"}</li>
          <li className={world.receiving.S ? "good" : "bad"}><Icon name="home" size={14} /> School {world.receiving.S ? "has power" : "no power"}</li>
          <li><Icon name="layers" size={14} /> {world.stock} crates</li>
          <li className={schoolState}><Icon name="clock" size={14} /> {school?.completedTick != null ? `School supplied min ${mm(school.completedTick)}` : "School due min 09"}</li>
          <li className={reserve >= 1 ? "good" : "bad"}><Icon name="truck" size={14} /> {reserve} in reserve</li>
        </ul>
      </section>

      {latest && (
        <div key={latest.id} className={`ticker glass tone-${describe(latest).tone}`} role="status">
          <span className="time">{mm(latest.tick)}</span> {describe(latest).text}
        </div>
      )}

      <nav className={`camrail glass ${drawer ? "shifted" : ""}`} aria-label="Camera">
        {cameras.map((c) => (
          <button key={c.id} className={view === c.id ? "on" : ""} onClick={() => camera(c.id)} title={c.label}>
            <Icon name={c.icon} size={17} /><span>{c.label}</span>
          </button>
        ))}
        <hr />
        <button className={weather ? "on-soft" : ""} onClick={() => setWeather(!weather)} aria-pressed={weather} title="Rain"><Icon name="rain" size={17} /><span>Rain</span></button>
        <button className={labels ? "on-soft" : ""} onClick={() => setLabels(!labels)} aria-pressed={labels} title="Labels"><Icon name="eye" size={17} /><span>Labels</span></button>
      </nav>

      <Radio world={world} state={crewChat.state} open={radioOpen} onToggle={() => setRadioOpen(!radioOpen)} />

      <div className="dispatch-dock">
        <Dispatch
          world={world}
          state={crewChat.state}
          ended={drill.ended}
          stale={crewChat.stale}
          onAsk={(order) => { drill.setPlaying(false); setRadioOpen(true); void crewChat.ask(order, timeline.decisions.map(({ tick, command }) => ({ tick, command }))); }}
          onApprove={approve}
          onDismiss={crewChat.clear}
          onReplay={branchReady ? () => setComparing(true) : null}
        />
      </div>

      <aside className={`drawer glass ${drawer ? "open" : ""}`} aria-hidden={!drawer}>
        <div className="drawer-head">
          <div className="segmented">
            <button className={drawer === "crew" ? "on" : ""} onClick={() => setDrawer("crew")}>Crew knowledge</button>
            <button className={drawer === "log" ? "on" : ""} onClick={() => setDrawer("log")}>Event log</button>
          </div>
          <button className="ghost icon" onClick={() => setDrawer(null)} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="drawer-body">
          {drawer === "crew" && <CrewPanel world={world} turns={crewChat.state?.turns ?? []} />}
          {drawer === "log" && (
            <LogPanel world={world} decisions={timeline.decisions} timeline={active} onRewind={(i) => { drill.rewind(i); crewChat.clear(); setDrawer(null); }} />
          )}
        </div>
      </aside>

      <Briefing open={briefing} onClose={closeBriefing} />
    </div>
  );
}
