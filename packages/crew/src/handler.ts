import { requestBudget, withDeadline } from "./deadline";
import { z } from "zod";
import { commandSchema, SimulationError } from "@crisiscraft/contracts";
import { replay } from "@crisiscraft/sim";
import { MAX_MINUTE, scenarioById, scenarioField } from "./scenario";
import { roadName } from "./roster";
import { deliberate, type CrewTurn } from "./deliberate";
import { chooseProvider } from "./providers";
import { voiceAvailable } from "./voice";
import { rateLimit, visitor } from "./limit";

const requestSchema = z
  .object({
    scenarioId: scenarioField,
    minute: z.number().int().min(0).max(MAX_MINUTE),
    order: z.string().trim().min(2).max(400),
    commands: z
      .array(
        z
          .object({ tick: z.number().int().min(0), command: commandSchema })
          .strict(),
      )
      .max(20),
    /** June's latest field-photo reading, produced by /api/photo earlier in this run. */
    photo: z
      .object({
        minute: z.number().int().min(0),
        text: z.string().trim().min(1).max(320),
      })
      .strict()
      .optional(),
    /** A crew member radioing in unprompted about a report that just reached them. */
    initiative: z
      .object({
        role: z.enum(["logistics", "shelter", "field"]),
        observationId: z.string().max(40),
      })
      .strict()
      .optional(),
  })
  .strict();

type Env = Record<string, string | undefined>;
export interface HandlerResult {
  status: number;
  body: unknown;
}

export function crewStatus(env: Env) {
  const p = chooseProvider(env);
  return {
    provider: { id: p.id, label: p.label, model: p.model, live: p.live },
    voice: voiceAvailable(env),
  };
}

/**
 * The server never trusts client world state: it rebuilds the run from the approved command
 * history with the deterministic engine, then lets the crew deliberate on that state.
 */
export async function handleCrew(
  input: unknown,
  env: Env,
  onTurn?: (turn: CrewTurn) => void,
): Promise<HandlerResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 400,
      body: {
        error: "Order must be 2–400 characters with a valid run history.",
      },
    };
  const { minute, order, commands, photo, initiative } = parsed.data;
  const scenario = scenarioById(parsed.data.scenarioId);
  let state;
  try {
    state = replay(scenario, commands, minute);
  } catch (error) {
    if (error instanceof SimulationError)
      return { status: 409, body: { error: error.message } };
    throw error;
  }
  try {
    const earlier =
      photo && photo.minute <= minute
        ? [
            {
              from: "field" as const,
              text: `Photo from the ${roadName(scenario, "JS")} at minute ${photo.minute}: ${photo.text}`,
              cites: [],
            },
          ]
        : [];
    return {
      status: 200,
      body: await withDeadline(
        (signal) =>
          deliberate(
            scenario,
            state,
            order,
            chooseProvider(env, signal),
            (turn) => {
              if (!signal.aborted) onTurn?.(turn);
            },
            earlier,
            { initiative },
          ),
        requestBudget(env),
      ),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The crew could not respond.";
    return {
      status: 502,
      body: { error: `The crew could not respond: ${message}` },
    };
  }
}

/** Newline-delimited JSON: one {turn} line per crew turn as it happens, then {done} or {error}. */
export function streamCrew(
  input: unknown,
  env: Env,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (line: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      try {
        const result = await handleCrew(input, env, (turn) => send({ turn }));
        send(
          result.status === 200
            ? { done: result.body }
            : {
                error: (result.body as { error: string }).error,
                status: result.status,
              },
        );
      } catch {
        send({
          error:
            "The crew workflow failed. Nothing was approved. Please try again.",
          status: 502,
        });
      } finally {
        controller.close();
      }
    },
  });
}

interface NodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  write(chunk: Uint8Array): void;
  end(body?: string): void;
}

/** Node (req, res) adapter shared by the Vite dev server and the Vercel Function. */
export function nodeCrewHandler(env: Env) {
  // About four model calls per order; 40 orders per visitor per 10 minutes is far above a real drill.
  const limiter = rateLimit(Number(env.CREW_RATE_LIMIT) || 40, 10 * 60_000);
  return async (req: NodeRequest, res: NodeResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET") return json(200, crewStatus(env));
    if (req.method !== "POST")
      return json(405, { error: "Method not allowed" });
    if (!limiter.allow(visitor(req)))
      return json(429, {
        error: "The crew needs a breather. Try again in a few minutes.",
      });
    let raw = "";
    for await (const chunk of req) {
      raw +=
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      if (raw.length > 64_000)
        return json(413, { error: "Request too large." });
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: "Invalid JSON." });
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-store");
    const reader = streamCrew(body, env).getReader();
    for (
      let chunk = await reader.read();
      !chunk.done;
      chunk = await reader.read()
    )
      res.write(chunk.value);
    res.end();
  };
}
