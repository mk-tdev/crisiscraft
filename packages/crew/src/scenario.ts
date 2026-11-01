import { z } from 'zod';
import { scenarioById, scenarios } from '@crisiscraft/sim';

/** Which drill a request belongs to. Older clients that send none get the tutorial. */
export const scenarioField = z.enum(scenarios.map(s => s.id) as [string, ...string[]]).default('harbor-point');
/** Upper bound for any minute field; replay rejects minutes past the chosen scenario's horizon. */
export const MAX_MINUTE = Math.max(...scenarios.map(s => s.horizon));
export { scenarioById };
