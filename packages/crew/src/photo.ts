import { callSignal, requestBudget, withDeadline } from "./deadline";
import { z } from "zod";
import {
  commandSchema,
  SimulationError,
  type Scenario,
  type WorldState,
} from "@crisiscraft/contracts";
import { replay } from "@crisiscraft/sim";
import { MAX_MINUTE, scenarioById, scenarioField } from "./scenario";
import {
  decodeMaskToRaster,
  decodeMaskToSVGPath,
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
} from "@meta-sam/parser";
import { briefing } from "./context";
import { crew } from "./roster";
import { rateLimit, visitor } from "./limit";

/**
 * June's field photo: three Meta models in one radio turn.
 * Muse Image renders what June would see at the bridge right now, SAM 3.1 outlines the bridge
 * and the floodwater so the overlap can be measured in pixels, and Muse Spark reads the photo
 * with those measurements and gives the radio call. The engine decides the water level; the
 * models only see and describe it.
 */

type Env = Record<string, string | undefined>;
const BRIDGE = "JS";

export interface Segment {
  concept: "bridge" | "floodwater";
  box: { left: number; top: number; right: number; bottom: number };
  confidence: number | null;
  /** SVG path in mask-raster units, drawn scaled into `box`. */
  path: string;
  raster: { width: number; height: number };
}

export interface PhotoRead {
  message: string;
  passable: "yes" | "risky" | "no";
}

export type PhotoEvent =
  | {
      kind: "image";
      image: string;
      minute: number;
      scene: string;
      model: string;
      ms: number;
    }
  | {
      kind: "segments";
      width: number;
      height: number;
      segments: Segment[];
      waterOnBridge: number | null;
      model: string;
      ms: number;
    }
  | {
      kind: "read";
      read: PhotoRead;
      model: string;
      ms: number;
      usage: { inputTokens: number; outputTokens: number } | null;
    };

/** What the water is doing at the north bridge, from the engine's true state at this minute. */
export function bridgeScene(scenario: Scenario, state: WorldState) {
  const open = state.roads[BRIDGE] !== false;
  const closeAt =
    scenario.events.find((e) => e.type === "close-road" && e.edgeId === BRIDGE)
      ?.tick ?? scenario.horizon;
  const left = closeAt - state.tick;
  if (!open)
    return "brown floodwater pouring over the bridge deck, the road surface submerged and the railings half under water";
  if (left <= 2)
    return "brown floodwater surging up to the underside of the deck, churning against the girders, debris snagged on the piers";
  return "a swollen brown river running high and fast a little below the deck, still clear of the road surface";
}

const readSchema = z.object({
  message: z.string().min(1).max(320),
  passable: z.enum(["yes", "risky", "no"]),
});
const readJsonSchema = z.toJSONSchema(readSchema);

async function* sse(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<ResponsesEvent> {
  const reader = body
    .pipeThrough(
      new TextDecoderStream() as unknown as ReadableWritablePair<
        string,
        Uint8Array
      >,
    )
    .getReader();
  let buffer = "";
  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  ) {
    buffer += chunk.value;
    let split: number;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      const data = buffer
        .slice(0, split)
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      buffer = buffer.slice(split + 2);
      if (data && data !== "[DONE]") yield JSON.parse(data) as ResponsesEvent;
    }
  }
}

async function segment(
  base: string,
  key: string,
  image: string,
  concept: Segment["concept"],
  signal?: AbortSignal,
) {
  const response = await fetch(`${base}/responses`, {
    method: "POST",
    signal: callSignal(signal, 30_000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sam-3.1",
      stream: true,
      metadata: { mask_encoding: "one_bit", include_confidence: "true" },
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: concept },
            { type: "input_image", image_url: image },
          ],
        },
      ],
    }),
  });
  if (!response.ok || !response.body)
    throw new Error(
      `SAM 3.1 returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  const result = await parseImageStream(sse(response.body)).finalResult;
  const boxes = recordsOfKind(result.records, "box");
  const masks = recordsOfKind(result.records, "mask");
  // The most confident match per concept; zero matches is a valid answer.
  const best = boxes
    .map((box) => ({
      box,
      mask: masks.find((m) => m.objectId === box.objectId),
    }))
    .filter(
      (m): m is { box: typeof m.box; mask: NonNullable<typeof m.mask> } =>
        !!m.mask,
    )
    .sort((a, b) => (b.box.confidence ?? 0) - (a.box.confidence ?? 0))[0];
  if (!best) return null;
  return {
    segment: {
      concept,
      box: {
        left: best.box.left,
        top: best.box.top,
        right: best.box.right,
        bottom: best.box.bottom,
      },
      confidence: best.box.confidence ?? null,
      path: decodeMaskToSVGPath(best.mask.mask),
      raster: { width: best.mask.mask.width, height: best.mask.mask.height },
    } satisfies Segment,
    raster: decodeMaskToRaster(best.mask.mask),
    // The parser does not surface the frame size; every box token carries it as w/h.
    size: (([, w, h]) => ({ width: Number(w), height: Number(h) }))(
      /;w=(\d+);h=(\d+)/.exec(result.rawOutput) ?? [0, "0", "0"],
    ),
  };
}

type Found = NonNullable<Awaited<ReturnType<typeof segment>>>;

/** Fraction of detected bridge-mask area also labelled floodwater, in image coordinates.
 * Integrate overlapping raster-cell rectangles exactly, including different resolutions and boxes.
 */
export function waterOnBridge(
  bridge: Found["segment"],
  water: Found["segment"],
  bridgeRaster: Uint8Array,
  waterRaster: Uint8Array,
): number | null {
  const b = bridge.box;
  const w = water.box;
  const bw = (b.right - b.left) / bridge.raster.width;
  const bh = (b.bottom - b.top) / bridge.raster.height;
  const ww = (w.right - w.left) / water.raster.width;
  const wh = (w.bottom - w.top) / water.raster.height;
  if (![bw, bh, ww, wh].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (
    bridgeRaster.length !== bridge.raster.width * bridge.raster.height ||
    waterRaster.length !== water.raster.width * water.raster.height
  )
    return null;
  let area = 0;
  let covered = 0;
  for (let row = 0; row < bridge.raster.height; row++) {
    for (let col = 0; col < bridge.raster.width; col++) {
      if (!bridgeRaster[row * bridge.raster.width + col]) continue;
      area += bw * bh;
      const left = b.left + col * bw;
      const top = b.top + row * bh;
      const firstX = Math.max(0, Math.floor((left - w.left) / ww));
      const lastX = Math.min(
        water.raster.width,
        Math.ceil((left + bw - w.left) / ww),
      );
      const firstY = Math.max(0, Math.floor((top - w.top) / wh));
      const lastY = Math.min(
        water.raster.height,
        Math.ceil((top + bh - w.top) / wh),
      );
      for (let y = firstY; y < lastY; y++)
        for (let x = firstX; x < lastX; x++) {
          if (!waterRaster[y * water.raster.width + x]) continue;
          covered +=
            Math.max(
              0,
              Math.min(left + bw, w.left + (x + 1) * ww) -
                Math.max(left, w.left + x * ww),
            ) *
            Math.max(
              0,
              Math.min(top + bh, w.top + (y + 1) * wh) -
                Math.max(top, w.top + y * wh),
            );
        }
    }
  }
  return area ? Math.min(1, Math.max(0, covered / area)) : null;
}

export async function fieldPhoto(
  scenario: Scenario,
  state: WorldState,
  env: Env,
  onEvent: (e: PhotoEvent) => void,
) {
  return withDeadline(
    (signal) =>
      buildFieldPhoto(
        scenario,
        state,
        env,
        (event) => {
          if (!signal.aborted) onEvent(event);
        },
        signal,
      ),
    requestBudget(env),
  );
}

async function buildFieldPhoto(
  scenario: Scenario,
  state: WorldState,
  env: Env,
  onEvent: (e: PhotoEvent) => void,
  signal: AbortSignal,
) {
  const key = env.MODEL_API_KEY!;
  const base = (env.MODEL_PHOTO_BASE_URL || "https://api.meta.ai/v1").replace(
    /\/$/,
    "",
  );
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const scene = bridgeScene(scenario, state);

  let started = Date.now();
  const generated = await fetch(`${base}/images/generations`, {
    method: "POST",
    signal: callSignal(signal, 45_000),
    headers,
    body: JSON.stringify({
      model: "muse-image-1.0",
      n: 1,
      size: "1536x1024",
      output_format: "jpeg",
      reasoning_strength: "low",
      tool_enablement: {
        enable_image_search: false,
        enable_web_search: false,
        enable_shell: false,
      },
      prompt: `Phone photo taken by a flood field worker on the riverbank in heavy rain: a small two-lane concrete road bridge with grey steel railings over a river in a fictional coastal town. ${scene}. Overcast, wet, realistic, eye level, no people, no text or watermarks.`,
    }),
  });
  const body = (await generated.json()) as { data?: { b64_json?: string }[] };
  const b64 = body.data?.[0]?.b64_json;
  if (!generated.ok || !b64)
    throw new Error(`Muse Image returned ${generated.status}.`);
  const image = `data:image/jpeg;base64,${b64}`;
  onEvent({
    kind: "image",
    image,
    minute: state.tick,
    scene,
    model: "muse-image-1.0",
    ms: Date.now() - started,
  });

  started = Date.now();
  const [bridge, water] = await Promise.all([
    segment(base, key, image, "bridge", signal),
    segment(base, key, image, "floodwater", signal),
  ]);
  const size = bridge?.size ?? water?.size ?? { width: 0, height: 0 };
  const share =
    bridge && water
      ? waterOnBridge(
          bridge.segment,
          water.segment,
          bridge.raster,
          water.raster,
        )
      : null;
  onEvent({
    kind: "segments",
    width: size.width,
    height: size.height,
    segments: [bridge?.segment, water?.segment].filter(
      (s): s is Segment => !!s,
    ),
    waterOnBridge: share,
    model: "sam-3.1",
    ms: Date.now() - started,
  });

  started = Date.now();
  const june = crew.field;
  const measured =
    share === null
      ? "Segmentation could not find both the bridge and the water."
      : `Segmentation: floodwater covers ${Math.round(share * 100)}% of the detected bridge mask in this generated drill image. This is image overlap, not measured flood depth or proof of passability.`;
  const read = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: callSignal(signal, 45_000),
    headers,
    body: JSON.stringify({
      model:
        env.MODEL_NAME && !env.MODEL_BASE_URL
          ? env.MODEL_NAME
          : "muse-spark-1.3",
      reasoning_effort: "low",
      max_completion_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are ${june.name}, ${june.title} at the ${june.post}, in Harbor Point: a FICTIONAL flood drill. ${june.voice} You just took this photo of the north bridge. Judge only from the photo and the measurement. Water touching the girders or the underside of the deck makes a loaded crossing risky; water on the road surface means no. Radio the team in at most two short sentences: can a loaded supply truck cross now? Use plain names, no ids.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Minute ${state.tick}. ${measured} Your briefing: ${JSON.stringify(briefing(scenario, state, "field").observations)}`,
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "photo_read", schema: readJsonSchema },
      },
    }),
  });
  const reply = (await read.json()) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = reply.choices?.[0]?.message?.content;
  if (!read.ok || !content)
    throw new Error(`Muse Spark could not read the photo (${read.status}).`);
  const parsed = readSchema.parse(JSON.parse(content));
  onEvent({
    kind: "read",
    read: parsed,
    model: "muse-spark-1.3",
    ms: Date.now() - started,
    usage: reply.usage
      ? {
          inputTokens: reply.usage.prompt_tokens ?? 0,
          outputTokens: reply.usage.completion_tokens ?? 0,
        }
      : null,
  });
}

const photoRequest = z
  .object({
    scenarioId: scenarioField,
    minute: z.number().int().min(0).max(MAX_MINUTE),
    commands: z
      .array(
        z
          .object({ tick: z.number().int().min(0), command: commandSchema })
          .strict(),
      )
      .max(20),
  })
  .strict();

interface NodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(body?: string): void;
}

/** POST {minute, commands}; streams NDJSON {event} lines, then {done} or {error}. */
export function nodePhotoHandler(env: Env) {
  // A photo costs one image and three model calls; a drill needs a handful at most.
  const limiter = rateLimit(Number(env.PHOTO_RATE_LIMIT) || 12, 10 * 60_000);
  return async (req: NodeRequest, res: NodeResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST")
      return json(405, { error: "Method not allowed" });
    if (!env.MODEL_API_KEY || env.CREW_PROVIDER === "scripted")
      return json(503, { error: "Field photos need MODEL_API_KEY." });
    if (!limiter.allow(visitor(req)))
      return json(429, { error: "June needs a minute before the next photo." });
    let raw = "";
    for await (const chunk of req) {
      raw +=
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      if (raw.length > 64_000)
        return json(413, { error: "Request too large." });
    }
    const parsed = photoRequest.safeParse(
      (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })(),
    );
    if (!parsed.success)
      return json(400, { error: "Expected {minute, commands}." });
    let state: WorldState;
    try {
      state = replay(scenarioById(parsed.data.scenarioId), parsed.data.commands, parsed.data.minute);
    } catch (error) {
      if (error instanceof SimulationError)
        return json(409, { error: error.message });
      throw error;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-store");
    const send = (line: unknown) => res.write(`${JSON.stringify(line)}\n`);
    try {
      await fieldPhoto(scenarioById(parsed.data.scenarioId), state, env, (event) => send({ event }));
      send({ done: true });
    } catch (error) {
      send({
        error:
          error instanceof Error
            ? error.message
            : "The photo did not come through.",
      });
    }
    res.end();
  };
}
