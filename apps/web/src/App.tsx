import { useEffect, useMemo, useState } from 'react';
import type { Role, WorldState } from '@crisiscraft/contracts';
import {
  advanceTo, approveCommand, createWorld, harborPoint, makeSchoolCommand, metrics, replay, roleContext,
} from '@crisiscraft/sim';
import { Town } from './Town';

const startingWorld = () => advanceTo(harborPoint, createWorld(harborPoint), 2);
const routes = { bridge: ['D', 'J', 'S'], hill: ['D', 'H', 'S'] };
type Route = keyof typeof routes;
const roles: { id: Role; name: string; initials: string; title: string }[] = [
  { id: 'logistics', name: 'Alex Chen', initials: 'AC', title: 'Logistics lead' },
  { id: 'shelter', name: 'Maya Reed', initials: 'MR', title: 'Shelter manager' },
  { id: 'field', name: 'Sam Torres', initials: 'ST', title: 'Field lead' },
];

function Stats({ world, compact = false }: { world: WorldState; compact?: boolean }) {
  const m = metrics(harborPoint, world);
  return <div className={`stats ${compact ? 'compact' : ''}`}>
    <div><span>Delivered</span><strong>{m.deliveredCrates}<small> crates</small></strong></div>
    <div><span>Unmet requests</span><strong>{m.unmetCrates}<small> crates</small></strong></div>
    <div><span>On-time deliveries</span><strong>{m.onTimeDeliveries}</strong></div>
    <div><span>Reserve available</span><strong>{m.idleTrucksAtDepot}<small> truck</small></strong></div>
  </div>;
}

export function App() {
  const [world, setWorld] = useState(startingWorld);
  const [route, setRoute] = useState<Route>('bridge');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareTick, setCompareTick] = useState(9);
  const dispatched = world.commands.length > 0;
  useEffect(() => { window.scrollTo(0, 0); }, [comparing]);
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => setWorld(previous => {
      if (previous.tick >= harborPoint.horizon) return previous;
      return advanceTo(harborPoint, previous, previous.tick + 1);
    }), 850);
    return () => window.clearInterval(interval);
  }, [playing]);
  useEffect(() => { if (world.tick >= harborPoint.horizon) setPlaying(false); }, [world.tick]);

  const comparison = useMemo(() => {
    if (!dispatched) return null;
    const entries = structuredClone(world.commands);
    const alternativeEntries = structuredClone(entries);
    const originalRoute = entries[0]!.command.actions[0]!.route;
    alternativeEntries[0]!.command.actions[0]!.route = originalRoute.includes('J') ? routes.hill : routes.bridge;
    return {
      original: replay(harborPoint, entries, compareTick),
      alternative: replay(harborPoint, alternativeEntries, compareTick),
      originalName: originalRoute.includes('J') ? 'Bridge route' : 'Hill route',
      alternativeName: originalRoute.includes('J') ? 'Hill route' : 'Bridge route',
    };
  }, [world.commands, dispatched, compareTick]);

  function dispatch() {
    try {
      const command = makeSchoolCommand(world, routes[route]);
      setWorld(approveCommand(harborPoint, world, command));
      setError('');
    } catch (e) { setError((e as Error).message); }
  }
  function reset() {
    setWorld(startingWorld()); setPlaying(false); setComparing(false); setError(''); setCompareTick(9);
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">✳</span> CrisisCraft <span className="version">PROTOTYPE 01</span></a>
      <div className="topbar-right"><span className="status-dot" /> Fictional coordination drill <button className="text-button" onClick={reset}>Reset exercise ↺</button></div>
    </header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">COASTAL RESPONSE / HARBOR POINT</div><h1>{comparing ? 'One decision. Two timelines.' : 'The next move is yours.'}</h1>
        <p>{comparing ? 'Same town, same events, same resources. Change only the delivery route.' : 'Deliver 6 supply crates to the school by minute 9. Keep one truck available.'}</p></div>
        <div className="mode-badge">MANUAL ENGINE PREVIEW<span>Meta characters not connected yet</span></div>
      </div>

      {comparing && comparison ? <section className="compare-section">
        <div className="compare-toolbar"><span className="eyebrow">REPLAY FROM MINUTE 02 · ROUTE IS THE ONLY CHANGE</span><button className="text-button" onClick={() => setComparing(false)}>← Back to exercise</button></div>
        <div className="comparison-grid">
          {(['original', 'alternative'] as const).map((key, i) => <article className={`timeline ${key}`} key={key}>
            <div className="timeline-heading"><div><span className="eyebrow">{i === 0 ? '01 / ORIGINAL' : '02 / ALTERNATIVE'}</span><h2>{i === 0 ? comparison.originalName : comparison.alternativeName}</h2></div><span className="clock">{String(compareTick).padStart(2, '0')}:00</span></div>
            <div className="compare-scene"><Town state={comparison[key]} /></div><Stats world={comparison[key]} compact />
            <div className="timeline-outcome">{comparison[key].requests.school!.completedTick === null ? 'School delivery still pending' : `School received supplies at minute ${comparison[key].requests.school!.completedTick}`}</div>
          </article>)}
        </div>
        <div className="scrubber"><label htmlFor="compare-tick">SHARED CLOCK <strong>Minute {compareTick}</strong></label><input id="compare-tick" type="range" min="2" max="15" value={compareTick} onChange={e => setCompareTick(Number(e.target.value))} /><button onClick={() => setCompareTick(9)}>Deadline · 09</button><button onClick={() => setCompareTick(15)}>Final · 15</button></div>
        <div className="debrief"><span className="eyebrow">WHAT CHANGED</span><h2>A shorter route is not always an earlier delivery.</h2>
          <p>The bridge closes at minute 4, before a truck dispatched at minute 2 can enter it. That truck diverts through the hill junction and arrives at minute 11. The direct hill route arrives at minute 8. Both runs keep V2 in reserve; the East shelter request remains unmet.</p>
          <div className="debrief-evidence">{comparison.original.events.concat(comparison.alternative.events).filter(e => e.type === 'road-closed' || e.type === 'rerouted' || e.type === 'delivered').map((e, i) => <span key={i}>M{e.tick} · {e.message}</span>)}</div>
          <small>Calculated by the fictional scenario. Historical replay uses no model calls.</small>
        </div>
      </section> : <>
        <div className="workspace">
          <section className="scene-panel" aria-label="Town simulation">
            <div className="scene-top"><span><span className="live-dot" /> HARBOR POINT</span><span className="clock">{String(world.tick).padStart(2, '0')}:00 <small>/ 15:00</small></span></div>
            <div className="town"><Town state={world} />
              <div className="map-label depot-label">D / SUPPLY DEPOT</div><div className="map-label school-label">S / SCHOOL SHELTER</div><div className="map-label east-label">E / EAST SHELTER</div>
              <div className="map-caption">Illustrative flood extent · authored road events</div>
            </div>
            <div className="map-legend"><span><i className="legend-line" /> Open road</span><span><i className="legend-line closed" /> {world.roads.JS ? 'Bridge open · risk reported' : 'Bridge closed ×'}</span><span className="school-status">School receiving: {world.receiving.S ? 'ready' : 'power unavailable'}</span></div>
            <div className="transport"><button disabled={!dispatched || world.tick >= 15} onClick={() => setPlaying(p => !p)}>{playing ? 'Ⅱ Pause' : '▶ Play scenario'}</button><button disabled={!dispatched || world.tick >= 15 || playing} onClick={() => setWorld(advanceTo(harborPoint, world, world.tick + 1))}>Step +1 min</button><button disabled={!dispatched || world.tick >= 15} onClick={() => { setPlaying(false); setWorld(advanceTo(harborPoint, world, 15)); }}>Run to end →</button><span>{!dispatched ? 'Clock paused for your decision' : world.tick === 15 ? 'Exercise complete' : '1 tick = 1 simulated minute'}</span></div>
          </section>

          <aside className="plan-panel"><div className="panel-kicker"><span>YOUR NEXT ACTION</span><span>01</span></div><h2>Get supplies to school.</h2><p>Review the route, then approve a dispatch. The engine enforces capacity and availability.</p>
            <div className="assignment"><div><span>VEHICLE</span><strong>V1 <small>6-crate capacity</small></strong></div><div><span>LOAD</span><strong>6 <small>supply crates</small></strong></div></div>
            <fieldset disabled={dispatched}><legend>Delivery route</legend>
              <label className={`route-option ${route === 'bridge' ? 'selected' : ''}`}><input type="radio" name="route" checked={route === 'bridge'} onChange={() => setRoute('bridge')} /><span><strong>Via bridge</strong><small>D → J → S · nominal 4 min</small></span><b>01</b></label>
              <label className={`route-option ${route === 'hill' ? 'selected' : ''}`}><input type="radio" name="route" checked={route === 'hill'} onChange={() => setRoute('hill')} /><span><strong>Via hill road</strong><small>D → H → S · nominal 6 min</small></span><b>02</b></label>
            </fieldset>
            <div className="reserve"><span>▣</span><div><strong>Keep V2 in reserve</strong><small>One truck must remain idle at the depot.</small></div></div>
            <div className="warning">{!world.receiving.S ? 'Receiving power is unavailable. An early truck will wait to unload.' : 'School receiving power is restored. Deliveries can unload.'}</div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={dispatched} onClick={dispatch}>{dispatched ? '✓ Dispatch approved' : 'Approve dispatch →'}</button>
            <button className="branch-button" disabled={!dispatched} onClick={() => { setPlaying(false); setComparing(true); }}>↶ Rewind & compare routes</button>
            <small className="plan-note">{dispatched ? 'Rewind restores the same minute-2 checkpoint.' : 'Nothing moves until you approve.'}</small>
          </aside>
        </div>
        <Stats world={world} />
        <section className="radio-section"><div className="section-heading"><h2>Three roles. Different information.</h2><span>AUTHORED REPORTS · NOT AI OUTPUT</span></div><div className="radio-grid">{roles.map(role => {
          const observations = roleContext(world, role.id).observations;
          return <article className="radio-card" key={role.id}><div className="radio-person"><span className={`avatar ${role.id}`}>{role.initials}</span><div><strong>{role.name}</strong><small>{role.title}</small></div><span className="radio-indicator">◉</span></div><div className="radio-messages">{observations.map(o => <div key={o.id}><p>{o.fact}</p><span>Observed {o.observedTick}:00 · received {o.receivedTick}:00</span></div>)}</div></article>;
        })}</div></section>
        <section className="event-section"><div className="section-heading"><h2>Simulation log</h2><span>{world.events.length} RECORDED EVENTS</span></div><ol>{world.events.filter(e => e.type !== 'observation-received').slice(-8).reverse().map(e => <li key={e.id}><time>M{String(e.tick).padStart(2, '0')}</time><span>{e.message}</span><small>{e.id}</small></li>)}</ol></section>
      </>}
      <footer><span>CRISISCRAFT / BUILD THE RESPONSE. REPLAY THE DECISION.</span><span>Fictional rehearsal prototype · Not for live incident response</span></footer>
    </main>
  </div>;
}
