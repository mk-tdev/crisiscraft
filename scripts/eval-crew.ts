/**
 * Live crew evaluation: the same drill moment, repeated, under three conditions.
 * Run: npm run eval:crew [-- runs]   (needs MODEL_API_KEY; about 5 model calls per run)
 * Writes docs/eval/crew-eval.json (every run) and docs/eval/crew-eval.md (the summary).
 */
import { writeFileSync } from 'node:fs';
import type { Role } from '@crisiscraft/contracts';
import { approveCommand, harborPoint, replay, advanceTo } from '@crisiscraft/sim';
import { deliberate, metaProvider } from '@crisiscraft/crew';

const runs = Number(process.argv[2] ?? 10);
const MINUTE = 2;
const conditions: { id: string; label: string; order: string; silence: Role[] }[] = [
  { id: 'full', label: 'Full radio, general order', order: 'Get six crates to the school. Keep one truck back.', silence: [] },
  { id: 'silenced', label: "June silenced, general order", order: 'Get six crates to the school. Keep one truck back.', silence: ['field'] },
  { id: 'bridge', label: 'Full radio, explicit bridge order', order: 'Bridge is fastest — send the school crates that way.', silence: [] },
];

const env = process.env as Record<string, string | undefined>;
if (!env.MODEL_API_KEY) throw new Error('MODEL_API_KEY is not set.');
const provider = metaProvider(env);

async function one(c: (typeof conditions)[number], i: number) {
  const state = replay(harborPoint, [], MINUTE);
  const started = Date.now();
  try {
    const d = await deliberate(harborPoint, state, c.order, provider, () => {}, [], { silence: c.silence });
    const action = d.command?.actions[0];
    const route = action?.route.join('') ?? null;
    let schoolMinute: number | null = null;
    if (d.command) {
      const end = advanceTo(harborPoint, approveCommand(harborPoint, state, d.command), harborPoint.horizon);
      schoolMinute = end.requests.school?.completedTick ?? null;
    }
    const plan = d.turns.filter(t => t.kind === 'plan').at(-1);
    const tools = d.turns.filter(t => t.kind === 'tool');
    const usage = d.turns.reduce((n, t) => n + (t.usage ? t.usage.inputTokens + t.usage.outputTokens : 0), 0);
    return {
      condition: c.id, run: i, ok: true,
      decision: !d.command ? (d.refusal ? 'refused' : 'hold') : route === 'DHS' ? 'hill' : route === 'DJS' ? 'bridge' : `other:${route}`,
      schoolOnTime: schoolMinute !== null && schoolMinute <= 9, schoolMinute,
      firstTryPassed: d.turns.filter(t => t.kind === 'refused').length === 0 && !!d.command,
      toolCalls: tools.length, dryRunRefusals: tools.filter(t => t.text.includes('refused')).length,
      mentionsWarning: /june|warn|rising|threat/i.test(`${plan?.text ?? ''} ${plan?.detail ?? ''}`),
      juneObjected: d.turns.some(t => t.kind === 'review' && t.from === 'field' && t.verdict === 'concern'),
      seconds: (Date.now() - started) / 1000, tokens: usage, plan: plan?.text ?? null,
    };
  } catch (error) {
    return { condition: c.id, run: i, ok: false, error: error instanceof Error ? error.message : String(error), seconds: (Date.now() - started) / 1000 };
  }
}

const jobs = conditions.flatMap(c => Array.from({ length: runs }, (_, i) => () => one(c, i)));
const results: Awaited<ReturnType<typeof one>>[] = [];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++]!;
    const r = await job();
    results.push(r);
    process.stdout.write(`${r.condition}#${r.run} ${r.ok ? (r as { decision: string }).decision : 'error'}  `);
  }
}));
console.log();

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const rows = conditions.map(c => {
  const all = results.filter(r => r.condition === c.id);
  const ok = all.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
  const count = (d: string) => ok.filter(r => r.decision === d).length;
  return `| ${c.label} | ${all.length} | ${count('hill')} | ${count('bridge')} | ${count('hold') + count('refused')} | ${pct(ok.filter(r => r.schoolOnTime).length, ok.length)} | ${pct(ok.filter(r => r.mentionsWarning).length, ok.length)} | ${c.silence.includes('field') ? 'silenced' : pct(ok.filter(r => r.juneObjected).length, ok.length)} | ${pct(ok.filter(r => r.firstTryPassed).length, ok.filter(r => r.decision !== 'hold').length)} | ${(ok.reduce((n, r) => n + r.toolCalls, 0) / Math.max(ok.length, 1)).toFixed(1)} | ${median(ok.map(r => r.seconds)).toFixed(1)} s | ${Math.round(median(ok.map(r => r.tokens)) / 100) / 10}k | ${all.length - ok.length} |`;
});

const date = new Date().toISOString().slice(0, 10);
writeFileSync('docs/eval/crew-eval.json', JSON.stringify({ date, model: provider.model, minute: MINUTE, runs, results }, null, 2));
writeFileSync('docs/eval/crew-eval.md', `# Crew evaluation

Live runs of the Muse Spark crew (\`${provider.model}\`) on ${date}, all from minute ${MINUTE} of Harbor Point: the north bridge is still open but June has seen the water rising, and the bridge will close at minute 4. Each run is a fresh deliberation: three role reports, Priya's tool-using plan and the rules check, then Malik and June review the plan (one revision if either raises a concern). "School on time" approves the crew's plan and runs the engine to minute 15.

| Condition | Runs | Hill road | Bridge | Hold | School on time | Plan cites June's warning | June objected in review | Passed rules first try | Tool calls / plan | Median time | Median tokens | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

- **Full radio vs June silenced** isolates bounded knowledge: the planner never sees the true road state, only what teammates say. Silencing June removes the one report about the water.
- **Explicit bridge order** checks that the crew follows the commander's route while saying the warning out loud, rather than overriding the order.

Reproduce with \`npm run eval:crew -- ${runs}\`. Raw runs, including each plan's text, are in [crew-eval.json](crew-eval.json). Model outputs vary between runs; these are measurements of this scenario, not a general benchmark.
`);
console.log(rows.join('\n'));
