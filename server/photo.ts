import { nodePhotoHandler } from '@crisiscraft/crew';

// Vercel Function: POST {minute, commands}; streams June's field photo (Muse Image → SAM 3.1 → Muse Spark) as NDJSON.
export default nodePhotoHandler(process.env);
