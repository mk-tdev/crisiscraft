import { nodeCrewHandler } from '@crisiscraft/crew';

// Vercel Function: GET reports which crew provider is connected; POST streams one deliberation as NDJSON.
export default nodeCrewHandler(process.env);
