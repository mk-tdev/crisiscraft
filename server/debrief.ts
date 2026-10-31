import { nodeDebriefHandler } from '@crisiscraft/crew';

// Vercel Function: POST {timelines}; returns a Muse Spark after-action review whose citations are checked against the engine log.
export default nodeDebriefHandler(process.env);
