import type {
  AgAiConversationItem,
  AgAiEvent,
  AgAiOutputItem,
  AgLlmAdapter,
  AgLlmRequest,
  AgLlmResponse,
  AgLlmResponseHandler,
} from "ag-studio";
import type { components } from "@provable/api-client";

type TurnRequest = components["schemas"]["StudioAiTurnRequest"];
type Turn = components["schemas"]["StudioAiTurn"];
type Item = components["schemas"]["StudioAiItem"];

/** The API's tool-call ids allow letters, digits, _ and -. Map any other id the same way for a call and its result. */
const callId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128) || "call";
const textOf = (parts: { type: string; text?: string; refusal?: string }[]) =>
  parts.map((part) => (part.type === "text" ? part.text ?? "" : part.type === "refusal" ? part.refusal ?? "" : "")).join("");

/**
 * Studio's conversation items in the API's provider-neutral turn format. Reasoning items are dropped (the server runs
 * these turns without thinking), and so are attachments: the dashboard assistant takes text only.
 */
export function toTurnRequest(request: AgLlmRequest): TurnRequest {
  const input: Item[] = [];
  for (const item of request.input as AgAiConversationItem[]) {
    if (item.type === "message" && item.kind === "input") input.push({ type: "message", role: item.role, text: textOf(item.content) });
    else if (item.type === "message") input.push({ type: "message", role: "assistant", text: textOf(item.content) });
    else if (item.type === "function_call") input.push({ type: "tool_call", call_id: callId(item.callId), name: item.name, arguments: item.arguments ?? "" });
    else if (item.type === "function_call_output") input.push({ type: "tool_result", call_id: callId(item.callId), output: item.output, ...(item.status === "incomplete" ? { is_error: true } : {}) });
  }
  const choice = request.toolChoice ?? "auto";
  return {
    instructions: request.instructions ?? null,
    input,
    // Only tools the page runs: a server or provider-hosted tool has no meaning to this relay.
    tools: (request.tools ?? []).filter((tool) => (tool.kind ?? "client") === "client")
      .map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters as Record<string, unknown> })),
    tool_choice: typeof choice === "string" ? choice : { name: choice.name },
    response_format: request.responseFormat.type === "json"
      ? { type: "json", name: request.responseFormat.name, ...(request.responseFormat.description ? { description: request.responseFormat.description } : {}), schema: request.responseFormat.schema as Record<string, unknown> }
      : { type: "text" },
  };
}

/** The answered turn as Studio's response and the content events its chat panel renders. */
export function fromTurn(turn: Turn): { events: AgAiEvent[]; response: AgLlmResponse } {
  const events: AgAiEvent[] = [];
  const output: AgAiOutputItem[] = [];
  const parts = turn.status === "refused"
    ? [{ type: "message" as const, text: "Claude declined to answer this request." }]
    : turn.output;
  parts.forEach((part, index) => {
    if (part.type === "message") {
      const messageId = `${turn.id}_${index}`;
      events.push({ type: "TEXT_MESSAGE_START", messageId, role: "assistant" }, { type: "TEXT_MESSAGE_CONTENT", messageId, delta: part.text }, { type: "TEXT_MESSAGE_END", messageId });
      output.push({ id: messageId, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: part.text, annotations: [] }] });
    } else {
      events.push(
        { type: "TOOL_CALL_START", toolCallId: part.call_id, toolCallName: part.name },
        { type: "TOOL_CALL_ARGS", toolCallId: part.call_id, delta: part.arguments },
        { type: "TOOL_CALL_END", toolCallId: part.call_id },
      );
      output.push({ id: part.call_id, kind: "output", type: "function_call", callId: part.call_id, name: part.name, arguments: part.arguments, status: "completed" });
    }
  });
  return {
    events,
    response: {
      id: turn.id,
      createdAt: Date.parse(turn.server_time) || Date.now(),
      model: turn.model,
      status: turn.status === "incomplete" ? "incomplete" : "completed",
      ...(turn.status === "incomplete" ? { incompleteDetails: { reason: "max_output_tokens" as const } } : {}),
      output,
      usage: {
        inputTokens: turn.usage.input_tokens,
        outputTokens: turn.usage.output_tokens,
        totalTokens: turn.usage.input_tokens + turn.usage.output_tokens,
        cachedInputTokens: turn.usage.cached_input_tokens,
        cacheWriteTokens: turn.usage.cache_write_tokens,
      },
    },
  };
}

/**
 * AG Studio's provider boundary (`AgLlmAdapter`) for the dashboard assistant. Each turn goes to this app's API with the
 * operator's own credential; the API calls Claude with a key the browser never sees. The API answers a whole turn at
 * once, so the stream replays its content as events once the turn is back.
 */
export function studioAiAdapter({ baseUrl, token, fetchImpl = fetch }: { baseUrl: string; token: string; fetchImpl?: typeof fetch }): AgLlmAdapter {
  return {
    executeTurn(request: AgLlmRequest, options?: { signal?: AbortSignal }): AgLlmResponseHandler {
      let resolveComplete!: (response: AgLlmResponse) => void;
      let rejectComplete!: (error: Error) => void;
      const complete = new Promise<AgLlmResponse>((resolve, reject) => { resolveComplete = resolve; rejectComplete = reject; });
      // A failed turn is reported once, through `complete` (as Studio's example adapter does). Mark it observed for a
      // consumer that stops reading the stream without awaiting it.
      void complete.catch(() => {});

      async function* events(): AsyncIterableIterator<AgAiEvent> {
        let turn: Turn;
        try {
          const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/operators/me/studio-ai/turns`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
            body: JSON.stringify(toTurnRequest(request)),
            signal: options?.signal,
          });
          if (!response.ok) {
            const problem = await response.json().catch(() => null) as { detail?: string } | null;
            throw new Error(problem?.detail || `The assistant is unavailable (HTTP ${response.status}).`);
          }
          turn = await response.json() as Turn;
        } catch (error) {
          rejectComplete(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        const { events, response } = fromTurn(turn);
        yield* events;
        resolveComplete(response);
      }
      const iterator = events();
      return { stream: { [Symbol.asyncIterator]: () => iterator }, complete };
    },
  };
}
