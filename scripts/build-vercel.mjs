// Produces .vercel/output (Vercel Build Output API v3): the Vite app as static files and the
// crew and voice APIs as esbuild-bundled Node functions, so no TypeScript is compiled at the edge.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const out = '.vercel/output';
rmSync(out, { recursive: true, force: true });
cpSync('apps/web/dist', `${out}/static`, { recursive: true });
for (const name of ['crew', 'voice', 'photo']) {
  const fn = `${out}/functions/api/${name}.func`;
  mkdirSync(fn, { recursive: true });
  await build({
    entryPoints: [`server/${name}.ts`], outfile: `${fn}/index.mjs`, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning',
  });
  writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({
    runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: 60,
  }, null, 2));
}
writeFileSync(`${out}/config.json`, JSON.stringify({ version: 3, routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' }] }, null, 2));
console.log(`Built ${out}`);
