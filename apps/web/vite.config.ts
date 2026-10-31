import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** Serves the same crew handler as the Vercel Function during `npm run dev`. */
function crewApi(env: Record<string, string>): Plugin {
  return {
    name: 'crisiscraft-crew-api',
    configureServer(server) {
      server.middlewares.use('/api/crew', async (req, res) => {
        const { nodeCrewHandler } = await server.ssrLoadModule('@crisiscraft/crew') as typeof import('@crisiscraft/crew');
        await nodeCrewHandler(env)(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), crewApi({ ...loadEnv(mode, root, ''), ...process.env } as Record<string, string>)],
  server: { port: 5173, strictPort: true },
}));
