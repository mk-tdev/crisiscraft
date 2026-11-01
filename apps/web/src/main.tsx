import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { scenarioById, scenarios } from '@crisiscraft/sim';
import { App } from './App';
import { setScenario } from './format';
import './styles.css';
import './scene/scene.css';

const CHOSEN = 'crisiscraft:scenario';

/** Picks the drill. Switching scenario remounts the app, so every run starts clean. */
function Root() {
  const [id, setId] = useState(() => {
    try {
      const saved = localStorage.getItem(CHOSEN);
      return scenarios.some((s) => s.id === saved) ? saved! : scenarios[0]!.id;
    } catch {
      return scenarios[0]!.id;
    }
  });
  setScenario(scenarioById(id));
  const choose = (next: string) => {
    try { localStorage.setItem(CHOSEN, next); } catch { /* private mode: the choice lasts this visit */ }
    setId(next);
  };
  return <App key={id} scenarioId={id} onScenario={choose} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
