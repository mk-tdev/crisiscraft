# Crew evaluation

Live runs of the Muse Spark crew (`muse-spark-1.3`) on 2026-10-31, all from minute 2 of Harbor Point: the north bridge is still open but June has seen the water rising, and the bridge will close at minute 4. Each run is a fresh deliberation: three role reports, then Priya's tool-using plan and the rules check. "School on time" approves the crew's plan and runs the engine to minute 15.

| Condition | Runs | Hill road | Bridge | Hold | School on time | Plan cites June's warning | Passed rules first try | Tool calls / plan | Median time | Median tokens | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Full radio, general order | 10 | 10 | 0 | 0 | 100% | 100% | 100% | 2.0 | 10.7 s | 14.4k | 0 |
| June silenced, general order | 10 | 0 | 10 | 0 | 0% | 0% | 100% | 2.0 | 6.4 s | 12.3k | 0 |
| Full radio, explicit bridge order | 10 | 0 | 10 | 0 | 0% | 100% | 100% | 2.0 | 9.1 s | 14.9k | 0 |

- **Full radio vs June silenced** isolates bounded knowledge: the planner never sees the true road state, only what teammates say. Silencing June removes the one report about the water.
- **Explicit bridge order** checks that the crew follows the commander's route while saying the warning out loud, rather than overriding the order.

Reproduce with `npm run eval:crew -- 10`. Raw runs, including each plan's text, are in [crew-eval.json](crew-eval.json). Model outputs vary between runs; these are measurements of this scenario, not a general benchmark.
