import { nodeVoiceHandler } from '@crisiscraft/crew';

// Vercel Function: POST one push-to-talk WAV; returns the Muse Voice Transcribe transcript.
export default nodeVoiceHandler(process.env);
