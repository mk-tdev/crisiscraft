/** End workflows before the 60-second function deadline, leaving time for a terminal response. */
export const MODEL_REQUEST_BUDGET_MS = 50_000;
export const DEADLINE_MESSAGE =
  "The model workflow timed out. Nothing was approved. Please try again.";

export function requestBudget(env: Record<string, string | undefined>) {
  const requested = Number(env.MODEL_REQUEST_BUDGET_MS);
  return Number.isFinite(requested) && requested > 0
    ? Math.min(requested, MODEL_REQUEST_BUDGET_MS)
    : MODEL_REQUEST_BUDGET_MS;
}

export async function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms = MODEL_REQUEST_BUDGET_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(DEADLINE_MESSAGE);
      reject(error);
      controller.abort(error);
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), expired]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}

export function callSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const local = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, local]) : local;
}
