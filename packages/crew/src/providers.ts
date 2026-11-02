import { callSignal } from "./deadline";
import type { Role } from "@crisiscraft/contracts";
import { harborPoint, shortestOpenRoute } from "@crisiscraft/sim";
import type { Briefing } from "./context";
import { crew, truckNames } from "./roster";
import {
  jsonSchemas,
  planSchema,
  reportSchema,
  reviewSchema,
  type Plan,
  type Report,
  type Review,
} from "./schemas";
import { toolDefinitions, type PlanTools, type ToolCall } from "./tools";

export interface TeamMessage {
  from: Role;
  text: string;
  cites: string[];
}

export type CrewTask =
  | {
      kind: "report";
      role: Role;
      order: string;
      briefing: Briefing;
      /** Set when this crew member is radioing in unprompted about a report that just reached them. */
      news?: { id: string; fact: string };
    }
  | {
      kind: "review";
      role: Role;
      order: string;
      briefing: Briefing;
      proposal: string;
    }
  | {
      kind: "plan";
      role: "logistics";
      order: string;
      briefing: Briefing;
      team: TeamMessage[];
      refusal?: string;
      /** Engine-backed tools the planner may call before submitting; each call is reported as it happens. */
      tools?: PlanTools;
      onTool?: (call: ToolCall) => void;
      /** Teammates' reviews of the previous draft, when at least one raised a concern. */
      reviews?: { from: Role; verdict: Review["verdict"]; text: string }[];
    };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}
export interface TurnResult<T> {
  output: T;
  usage: Usage | null;
  ms: number;
  prompt: { system: string; user: string };
  calls?: number;
}

export interface CrewProvider {
  id: "meta" | "scripted";
  label: string;
  model: string | null;
  live: boolean;
  report(
    task: Extract<CrewTask, { kind: "report" }>,
  ): Promise<TurnResult<Report>>;
  plan(task: Extract<CrewTask, { kind: "plan" }>): Promise<TurnResult<Plan>>;
  review(
    task: Extract<CrewTask, { kind: "review" }>,
  ): Promise<TurnResult<Review>>;
}

export function prompts(task: CrewTask) {
  const me = crew[task.role];
  const system = [
    `You are ${me.name}, ${me.title} (${task.briefing.you.post}), in ${task.briefing.drill}: a FICTIONAL flood coordination drill.`,
    `Your remit: ${me.remit} Your voice: ${me.voice}`,
    "You know ONLY what is in your briefing JSON. Never invent roads, stock, times or reports.",
    "Every observation carries the minute it was observed; an old observation may be stale, so say how old it is when it matters.",
    "Other crew members cannot see your briefing. If you know something the team needs, say it plainly.",
    "Speak like a person on a radio: use names (Rescue 01, the north bridge, the hill road, the school shelter), never ids such as V1, JS, D-H-S or bridge-0. Ids belong only in cites and plan actions.",
    task.kind === "report"
      ? task.news
        ? "A new report just reached you and nobody asked yet. Radio it to the team unprompted in at most two short sentences: what happened and what it changes. Then list the observation ids you used."
        : "Reply on the team radio in at most two short sentences, then list the observation ids you used."
      : task.kind === "review"
        ? 'Priya has drafted a dispatch plan. Check it against YOUR briefing only. Say "concern" only if something you know makes it unsafe, late or impossible; otherwise "agree". One or two radio sentences, then the observation ids you used.'
        : [
            "You must propose the dispatch plan the commander will approve or reject.",
            "A code validator enforces: the truck must be idle at the depot; quantity <= truck capacity, depot stock and remaining unassigned demand;",
            "the route must start at the depot, end at the request destination and follow roads in your road map; a road already closed is refused;",
            "the reserve rule must still hold after dispatch. Plan only what the commander asked for.",
            "The commander decides. If the order names a route and the validator would allow it, plan that route; never silently swap in another.",
            "If a teammate warned against it, say so in your message in plain words so the commander approves with eyes open.",
            "If the order cannot be done safely, or needs a truck you must keep in reserve, set hold=true with empty actions and explain.",
            "In rationale, name the teammate report or observation id that shaped the route.",
            ...(task.tools
              ? [
                  "You have tools. Use list_routes to read your map, check_plan to dry-run a plan against the validator, then submit_plan exactly once.",
                  ...(task.briefing.board.trucks.some((t) => t.kind === "helicopter")
                    ? ["The Rescue Helicopter flies only the air routes (mode air), direct, 4 crates a flight; trucks drive only roads. One plan action uses one kind of route. The helicopter does not count towards the truck reserve, and gusts can ground it."]
                    : []),
                  "Check a plan before you submit it; if the check refuses it, fix it or hold.",
                ]
              : []),
            ...(task.reviews
              ? [
                  "Your teammates reviewed your last draft. Revise if a concern is valid, or keep the plan and answer the concern in your message. A route the commander named still wins.",
                ]
              : []),
          ].join(" "),
  ].join("\n");
  const user = JSON.stringify(
    {
      commanderOrder: task.order,
      ...(task.kind === "report" && task.news
        ? { justReceived: task.news }
        : {}),
      ...(task.kind === "review" ? { priyasDraftPlan: task.proposal } : {}),
      briefing: task.briefing,
      ...(task.kind === "plan"
        ? {
            teamRadio: task.team.map((m) => ({
              from: `${crew[m.from].name} (${crew[m.from].title})`,
              said: m.text,
            })),
          }
        : {}),
      ...(task.kind === "plan" && task.refusal
        ? {
            validatorRefusedYourLastPlan: task.refusal,
            instruction: "Revise the plan so it passes, or hold.",
          }
        : {}),
      ...(task.kind === "plan" && task.reviews
        ? {
            teammateReviewsOfYourDraft: task.reviews.map((r) => ({
              from: crew[r.from].name,
              verdict: r.verdict,
              said: r.text,
            })),
          }
        : {}),
    },
    null,
    1,
  );
  return { system, user };
}

/** Meta Model API (OpenAI-compatible Chat Completions). Also works for Muse Spark Open on Baseten via MODEL_BASE_URL. */
export function metaProvider(
  env: Record<string, string | undefined>,
  signal?: AbortSignal,
): CrewProvider {
  const key = env.MODEL_API_KEY!;
  const base = (env.MODEL_BASE_URL || "https://api.meta.ai/v1").replace(
    /\/$/,
    "",
  );
  const model = env.MODEL_NAME || "muse-spark-1.3";
  async function call<T>(
    task: CrewTask,
    name: "report" | "plan" | "review",
    parse: (v: unknown) => T,
  ): Promise<TurnResult<T>> {
    const prompt = prompts(task);
    const started = Date.now();
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: callSignal(signal, 45_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning_effort: env.MODEL_REASONING || "low",
        max_completion_tokens: 2000,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name, schema: jsonSchemas[name] },
        },
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Model API ${response.status}: ${detail}`);
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        `${crew[task.role].name} replied with text that is not JSON.`,
      );
    }
    return {
      output: parse(parsed),
      usage: body.usage
        ? {
            inputTokens: body.usage.prompt_tokens ?? 0,
            outputTokens: body.usage.completion_tokens ?? 0,
          }
        : null,
      ms: Date.now() - started,
      prompt,
    };
  }
  /**
   * Priya as a tool-using agent: Chat Completions with function tools, run in our loop.
   * tool_choice can only be "auto", so a plain-text reply is nudged back to submit_plan.
   */
  async function agent(
    task: Extract<CrewTask, { kind: "plan" }>,
    tools: PlanTools,
  ): Promise<TurnResult<Plan>> {
    const prompt = prompts(task);
    const started = Date.now();
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    type Message = {
      role: string;
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
      tool_call_id?: string;
    };
    const messages: Message[] = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ];
    let calls = 0;
    for (let step = 0; step < 6; step++) {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal: callSignal(signal, 45_000),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          reasoning_effort: env.MODEL_REASONING || "low",
          max_completion_tokens: 3000,
          messages,
          tools: toolDefinitions,
          tool_choice: "auto",
        }),
      });
      if (!response.ok)
        throw new Error(
          `Model API ${response.status}: ${(await response.text()).slice(0, 300)}`,
        );
      const body = (await response.json()) as {
        choices?: { message?: Message }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      usage.inputTokens += body.usage?.prompt_tokens ?? 0;
      usage.outputTokens += body.usage?.completion_tokens ?? 0;
      const message = body.choices?.[0]?.message;
      const toolCalls = message?.tool_calls ?? [];
      if (!toolCalls.length) {
        // No tool call: accept a JSON plan in the text, otherwise ask for submit_plan.
        const parsed = planSchema.safeParse(
          (() => {
            try {
              return JSON.parse(message?.content ?? "");
            } catch {
              return null;
            }
          })(),
        );
        if (parsed.success)
          return {
            output: parsed.data,
            usage,
            ms: Date.now() - started,
            prompt,
            calls,
          };
        messages.push(
          { role: "assistant", content: message?.content ?? "" },
          {
            role: "user",
            content: "Call submit_plan with your final plan now.",
          },
        );
        continue;
      }
      messages.push({
        role: "assistant",
        content: message?.content ?? "",
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        let args: unknown = null;
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* reported back as a tool error */
        }
        if (tc.function.name === "submit_plan") {
          const plan = planSchema.safeParse(args);
          if (plan.success)
            return {
              output: plan.data,
              usage,
              ms: Date.now() - started,
              prompt,
              calls,
            };
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              error: "Plan did not match the schema.",
              issues: plan.error.issues.slice(0, 3),
            }),
          });
          continue;
        }
        const { result, call } = tools.call(tc.function.name, args);
        calls++;
        if (call) task.onTool?.(call);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }
    throw new Error(
      `${crew.logistics.name} did not submit a plan after six steps.`,
    );
  }
  return {
    id: "meta",
    label: "Meta Model API",
    model,
    live: true,
    report: (task) => call(task, "report", (v) => reportSchema.parse(v)),
    plan: (task) =>
      task.tools
        ? agent(task, task.tools)
        : call(task, "plan", (v) => planSchema.parse(v)),
    review: (task) => call(task, "review", (v) => reviewSchema.parse(v)),
  };
}

const truckName = (id: string) => truckNames[id] ?? id;
const has = (b: Briefing, id: string) =>
  b.observations.some((o) => o.id === id);
const fact = (b: Briefing, id: string) =>
  b.observations.find((o) => o.id === id);

/**
 * Deterministic stand-in used when no model key is configured. It reads the same bounded
 * briefings and is labelled "Scripted crew" in the interface; it is not presented as AI.
 */
/**
 * General scripted crew for scenarios other than the tutorial: it reads the same bounded
 * briefing, reports its newest facts, plans the shortest route on Priya's map that avoids any
 * road a teammate warned about, and reviews a plan against its own reports.
 */
const hazard = /closed|under water|rising|threat|landslide|blocked|cover/i;

function generalReport(task: Extract<CrewTask, { kind: "report" }>): Report {
  const b = task.briefing;
  const news = task.news ? b.observations.find((o) => o.id === task.news!.id) : undefined;
  const newest = news ?? [...b.observations].sort((x, y) => y.observedMinute - x.observedMinute)[0];
  if (task.role === "logistics") {
    const depot = b.roadMap?.places.find((p) => p.id === b.roadMap!.depot)?.name;
    const idle = b.board.trucks.filter((t) => t.status === "idle" && t.at === depot);
    return { message: `${idle.length} of ${b.board.trucks.length} trucks idle at the ${depot ?? "depot"}. ${b.board.reserveRule}`, cites: b.observations.filter((o) => o.id.startsWith("stock")).map((o) => o.id) };
  }
  if (!newest) return { message: "Nothing new from me yet.", cites: [] };
  const age = b.minute - newest.observedMinute;
  return { message: `${newest.fact}${age > 0 ? ` (that's ${age} min old)` : ""}`, cites: [newest.id] };
}

function generalPlan(task: Extract<CrewTask, { kind: "plan" }>): Plan {
  const b = task.briefing;
  const map = b.roadMap!;
  const order = task.order.toLowerCase();
  const name = (id: string) => map.places.find((p) => p.id === id)?.name ?? id;
  const hold = (message: string, rationale: string): Plan => ({ message, rationale, hold: true, actions: [], cites: [] });
  const open = b.board.openRequests.filter((r) => !r.complete && r.quantity > r.delivered && !b.board.trucks.some((t) => t.assignedTo === r.id && t.cargo > 0));
  const request = open.find((r) => order.includes(r.id) || order.includes(r.destinationName.toLowerCase().split(" ")[0]!)) ?? [...open].sort((x, y) => x.dueMinute - y.dueMinute)[0];
  const idle = b.board.trucks.filter((t) => t.status === "idle" && t.at === name(map.depot));
  const trucks = idle.filter((t) => t.kind !== "helicopter");
  const aircraft = idle.filter((t) => t.kind === "helicopter");
  const reserve = Number(/at least (\d+)/.exec(b.board.reserveRule)?.[1] ?? 1);
  if (!request) return hold("Nothing is waiting to be delivered right now.", "Every open request is complete or already has a truck.");
  // Avoid routes that teammates said are closed or dangerous, unless the order names them.
  // A route counts as dangerous only when the same message names it and a hazard.
  const said = [...task.team.map((m) => m.text), ...(task.reviews ?? []).filter((r) => r.verdict === "concern").map((r) => r.text)].map((t) => t.toLowerCase());
  const avoid = new Set(map.roads.filter((r) => !order.includes(r.name.toLowerCase()) && said.some((t) => t.includes(r.name.toLowerCase()) && hazard.test(t))).map((r) => r.id));
  const grounded = said.some((t) => /helicopter/.test(t) && /grounded|gust/.test(t)) || b.observations.some((o) => /grounded/i.test(o.fact) && b.minute >= o.observedMinute && !b.observations.some((p) => p.observedMinute > o.observedMinute && /fly again/i.test(p.fact)));
  const shortest = (air: boolean) => {
    const dist = new Map<string, { minutes: number; path: string[] }>([[map.depot, { minutes: 0, path: [map.depot] }]]);
    const queue = [map.depot];
    while (queue.length) {
      queue.sort((x, y) => dist.get(x)!.minutes - dist.get(y)!.minutes);
      const here = queue.shift()!;
      for (const r of map.roads) {
        if (avoid.has(r.id) || r.mode.startsWith("air") !== air || !r.between.includes(here)) continue;
        const next = r.between[0] === here ? r.between[1]! : r.between[0]!;
        const minutes = dist.get(here)!.minutes + r.minutes;
        if (!dist.has(next) || dist.get(next)!.minutes > minutes) { dist.set(next, { minutes, path: [...dist.get(here)!.path, next] }); queue.push(next); }
      }
    }
    return dist.get(request.destination);
  };
  const need = request.quantity - request.delivered;
  const byRoad = trucks.length > reserve ? shortest(false) : undefined;
  const byAir = aircraft.length && !grounded ? shortest(true) : undefined;
  // Trucks carry more; the helicopter goes when there is no safe road or no truck to spare.
  const pick = byRoad ? { route: byRoad, vehicle: [...trucks].sort((x, y) => (x.capacity >= need ? 0 : 1) - (y.capacity >= need ? 0 : 1) || x.capacity - y.capacity)[0]!, air: false }
    : byAir ? { route: byAir, vehicle: aircraft[0]!, air: true } : null;
  if (!pick) {
    if (trucks.length <= reserve && !byAir) return hold("Holding: sending another truck now would break the reserve rule, and the helicopter can't go.", b.board.reserveRule);
    return hold(`I have no safe way to the ${request.destinationName} right now.`, `Avoiding: ${[...avoid].map((id) => map.roads.find((r) => r.id === id)?.name).join(", ") || "nothing"}${grounded ? "; the helicopter is grounded" : ""}.`);
  }
  const found = pick.route;
  const quantity = Math.min(need, pick.vehicle.capacity);
  const legs = found.path.slice(1).map((n, i) => map.roads.find((r) => r.mode.startsWith("air") === pick.air && r.between.includes(found.path[i]!) && r.between.includes(n))?.name ?? n);
  return {
    message: `Send ${pick.vehicle.name} with ${quantity} crates to the ${request.destinationName} via ${legs.join(" → ")}, about ${found.minutes} minutes.`,
    rationale: pick.air ? `No safe road or no truck to spare, so the helicopter flies it${need > quantity ? `; ${need - quantity} crates still to follow` : ""}.`
      : avoid.size ? `Shortest road that avoids what the team warned about: ${[...avoid].map((id) => map.roads.find((r) => r.id === id)?.name).join(", ")}.` : `Shortest road on my map; due by minute ${request.dueMinute}.`,
    hold: false,
    actions: [{ vehicleId: pick.vehicle.id, requestId: request.id, quantity, route: found.path }],
    cites: b.observations.filter((o) => o.id.startsWith("stock") || (pick.air && o.id.startsWith("heli"))).map((o) => o.id),
  };
}

function generalReview(task: Extract<CrewTask, { kind: "review" }>): Review {
  const p = task.proposal.toLowerCase();
  const warning = task.briefing.observations.find((o) => {
    const road = /\(([^)]+)\)$/.exec(o.about)?.[1];
    return road && p.includes(road.toLowerCase()) && hazard.test(o.fact);
  });
  return warning
    ? { verdict: "concern", message: `That route uses the ${/\(([^)]+)\)$/.exec(warning.about)![1]}. ${warning.fact}`, cites: [warning.id] }
    : { verdict: "agree", message: "Nothing I know argues against it.", cites: [] };
}

export const scriptedProvider: CrewProvider = {
  id: "scripted",
  label: "Scripted crew",
  model: null,
  live: false,
  async report(task) {
    const b = task.briefing;
    if (b.drill !== harborPoint.name) return { output: generalReport(task), usage: null, ms: 0, prompt: prompts(task) };
    const lines: Record<Role, () => Report> = {
      logistics: () => {
        const idle = b.board.trucks.filter(
          (t) => t.status === "idle" && t.at === "Supply depot",
        );
        return {
          message: `${idle.length} truck${idle.length === 1 ? "" : "s"} idle at the depot, six crates each. The bridge was open when we checked at minute 0 — that's ${b.minute} minutes old.`,
          cites: ["stock-0", "bridge-0"].filter((id) => has(b, id)),
        };
      },
      shelter: () => {
        if (has(b, "power-6"))
          return {
            message: "Power is back at the school — we can unload now.",
            cites: ["power-6"],
          };
        const east = has(b, "east-5")
          ? " East shelter also needs six crates by minute 12."
          : "";
        return {
          message: `School needs six crates by minute 9, but we can't unload until power returns around minute 6.${east}`,
          cites: ["school-0", ...(east ? ["east-5"] : [])],
        };
      },
      field: () => {
        if (has(b, "closure-4"))
          return {
            message:
              "North bridge is closed to new entry. Hill road is the only way to the school.",
            cites: ["closure-4"],
          };
        const risk = fact(b, "risk-1");
        return risk
          ? {
              message: `Water is rising at the north bridge as of minute ${risk.observedMinute}. Hill road is open — I'd avoid the bridge.`,
              cites: ["risk-1"],
            }
          : { message: "No road reports from the field yet.", cites: [] };
      },
    };
    return {
      output: lines[task.role](),
      usage: null,
      ms: 0,
      prompt: prompts(task),
    };
  },
  async plan(task) {
    const b = task.briefing;
    if (b.drill !== harborPoint.name) {
      const output = generalPlan(task);
      if (task.tools && output.actions.length) {
        const { call } = task.tools.call("check_plan", { actions: output.actions });
        if (call) task.onTool?.(call);
      }
      return { output, usage: null, ms: 0, prompt: prompts(task) };
    }
    const order = task.order.toLowerCase();
    const open = b.board.openRequests.filter(
      (r) =>
        !r.complete &&
        r.quantity > r.delivered &&
        !b.board.trucks.some((t) => t.assignedTo === r.id && t.cargo > 0),
    );
    const request =
      open.find(
        (r) =>
          order.includes(r.id) ||
          order.includes(r.destinationName.toLowerCase().split(" ")[0]!),
      ) ?? open[0];
    const idle = b.board.trucks.filter(
      (t) => t.status === "idle" && t.at === "Supply depot",
    );
    const hold = (message: string, rationale: string): Plan => ({
      message,
      rationale,
      hold: true,
      actions: [],
      cites: [],
    });
    let output: Plan;
    const bridgeRefused = !!task.refusal?.includes("closed");
    if (task.refusal && !bridgeRefused)
      output = hold(
        "I can't make that plan pass the rules, so I'm holding.",
        `Validator: ${task.refusal}`,
      );
    else if (!request)
      output = hold(
        "Nothing is waiting to be delivered right now.",
        "Every open request is complete or already has a truck.",
      );
    else if (idle.length <= 1)
      output = hold(
        "Holding — sending our last idle truck would break the reserve rule.",
        b.board.reserveRule,
      );
    else {
      const warned = task.team.some(
        (m) => m.cites.includes("risk-1") || m.cites.includes("closure-4"),
      );
      const avoidBridge =
        bridgeRefused ||
        ((warned || order.includes("hill")) && !order.includes("bridge"));
      const roads = Object.fromEntries(
        harborPoint.edges.map((e) => [e.id, !(avoidBridge && e.id === "JS")]),
      );
      const route = shortestOpenRoute(
        harborPoint,
        roads,
        harborPoint.depot,
        request.destination,
      )!;
      const viaBridge = route.includes("J") && route.includes("S");
      output = {
        message: `Send ${truckName(idle[0]!.id)} with ${Math.min(6, request.quantity - request.delivered)} crates to the ${request.destinationName} via ${viaBridge ? "the north bridge" : "the hill road"}; ${truckName(idle[1]!.id)} stays in reserve.`,
        rationale: viaBridge
          ? "The bridge is the fastest road on my map and my last report says it was open."
          : bridgeRefused
            ? "The validator says the bridge is already closed, so I rerouted over the hill road."
            : warned
              ? "June reported rising water at the bridge, so I took the longer hill road."
              : "You asked for the hill road; it is three minutes slower but avoids the bridge.",
        hold: false,
        actions: [
          {
            vehicleId: idle[0]!.id,
            requestId: request.id,
            quantity: Math.min(6, request.quantity - request.delivered),
            route,
          },
        ],
        cites: warned && !viaBridge ? ["risk-1"] : ["bridge-0"],
      };
    }
    if (
      task.reviews?.some((r) => r.verdict === "concern") &&
      output.actions.length
    ) {
      const who = task.reviews
        .filter((r) => r.verdict === "concern")
        .map((r) => crew[r.from].name)
        .join(" and ");
      output = {
        ...output,
        message: `${output.message} ${who} raised a concern; I've kept the plan — your call.`,
      };
    }
    if (task.tools && output.actions.length) {
      const { call } = task.tools.call("check_plan", {
        actions: output.actions,
      });
      if (call) task.onTool?.(call);
    }
    return { output, usage: null, ms: 0, prompt: prompts(task) };
  },
  async review(task) {
    const b = task.briefing;
    if (b.drill !== harborPoint.name) return { output: generalReview(task), usage: null, ms: 0, prompt: prompts(task) };
    const p = task.proposal.toLowerCase();
    let output: Review = {
      verdict: "agree",
      message: "Works for me.",
      cites: [],
    };
    if (
      task.role === "field" &&
      p.includes("north bridge") &&
      (has(b, "risk-1") || has(b, "closure-4"))
    ) {
      output = {
        verdict: "concern",
        message:
          "That route crosses the north bridge and the water there is rising. I would not send a loaded truck over it.",
        cites: ["risk-1"].filter((id) => has(b, id)),
      };
    }
    const arrive = Number(/minute (\d+)/.exec(p)?.[1] ?? NaN);
    if (
      task.role === "shelter" &&
      p.includes("school") &&
      !has(b, "power-6") &&
      arrive < 6
    ) {
      output = {
        verdict: "concern",
        message: `Arriving around minute ${arrive} is before our power returns at minute 6 — the truck would wait at the gate.`,
        cites: ["school-0"],
      };
    }
    return { output, usage: null, ms: 0, prompt: prompts(task) };
  },
};

export function chooseProvider(
  env: Record<string, string | undefined>,
  signal?: AbortSignal,
): CrewProvider {
  return env.MODEL_API_KEY && env.CREW_PROVIDER !== "scripted"
    ? metaProvider(env, signal)
    : scriptedProvider;
}
