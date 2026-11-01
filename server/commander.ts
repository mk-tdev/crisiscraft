import { nodeCommanderHandler } from '@crisiscraft/crew';

// Vercel Function: POST the commander's view; returns Autopilot's next move (order, approve, send back or wait).
export default nodeCommanderHandler(process.env);
