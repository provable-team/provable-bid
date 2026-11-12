import Anthropic from '@anthropic-ai/sdk';
import type { components } from '../../../packages/api-client/src/schema.js';

type S = components['schemas'];
export type StudioAiTurnRequest = S['StudioAiTurnRequest'];
export type StudioAiTurnResult = Omit<S['StudioAiTurn'], 'server_time'>;
/** Answers one turn of AG Studio's Agent Framework. The agent loop and its tools run in the operator's browser. */
export type StudioAiRelay = (request: StudioAiTurnRequest, signal?: AbortSignal) => Promise<StudioAiTurnResult>;

// Claude Haiku 5.5, fixed server-side: the browser cannot pick a model or raise the output cap.
export const STUDIO_AI_MODEL = 'claude-haiku-5-5';
const MAX_OUTPUT_TOKENS = 8192;

/**
 * Studio's agents round-trip only what they were given back (messages, tool calls, tool results), and a replayed
 * thinking block needs its signature, which Studio's conversation items have no place for. So these turns run with
 * thinking off (accepted on Haiku 5.5 at effort medium) rather than send back thinking blocks they cannot reproduce.
 */
export function toClaudeRequest(request: StudioAiTurnRequest): Anthropic.MessageCreateParamsNonStreaming {
  const system: string[] = [];
  if (request.instructions?.trim()) system.push(request.instructions.trim());
  const messages: Anthropic.MessageParam[] = [];
  const push = (role: 'user' | 'assistant', block: Anthropic.ContentBlockParam) => {
    const last = messages.at(-1);
    if (last?.role === role && Array.isArray(last.content)) last.content.push(block);
    else messages.push({ role, content: [block] });
  };
  for (const item of request.input) {
    if (item.type === 'message') {
      if (!item.text.trim()) continue; // the API rejects empty text blocks
      // System notes Studio adds mid-conversation join the system prompt: a role the Messages API places strictly.
      if (item.role === 'system') system.push(item.text);
      else push(item.role, { type: 'text', text: item.text });
    } else if (item.type === 'tool_call') {
      let input: unknown = {};
      try { input = item.arguments.trim() ? JSON.parse(item.arguments) : {}; } catch { input = {}; }
      push('assistant', { type: 'tool_use', id: item.call_id, name: item.name, input: input && typeof input === 'object' && !Array.isArray(input) ? input : {} });
    } else {
      push('user', { type: 'tool_result', tool_use_id: item.call_id, content: item.output || '(empty)', ...(item.is_error ? { is_error: true } : {}) });
    }
  }
  // The conversation must open with the user, and tool calls must be answered before the next turn.
  if (messages[0]?.role !== 'user') messages.unshift({ role: 'user', content: [{ type: 'text', text: '(Conversation continues.)' }] });
  if (messages.at(-1)?.role === 'assistant') messages.push({ role: 'user', content: [{ type: 'text', text: 'Continue.' }] });

  if (request.response_format.type === 'json') {
    system.push(`Reply with one JSON object only, no prose and no code fence, matching this JSON Schema (${request.response_format.name}${request.response_format.description ? `: ${request.response_format.description}` : ''}):\n${JSON.stringify(request.response_format.schema)}`);
  }
  const tools: Anthropic.Tool[] = request.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: { ...(tool.parameters as Record<string, unknown>), type: 'object' } as Anthropic.Tool.InputSchema,
  }));
  const choice = request.tool_choice;
  const tool_choice: Anthropic.ToolChoice | undefined = !tools.length ? undefined
    : choice === 'auto' ? { type: 'auto' } : choice === 'none' ? { type: 'none' } : choice === 'required' ? { type: 'any' } : { type: 'tool', name: choice.name };
  return {
    model: STUDIO_AI_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: 'disabled' },
    output_config: { effort: 'medium' },
    // Studio resends the whole conversation (and the same long instructions and tools) every turn.
    cache_control: { type: 'ephemeral' },
    ...(system.length ? { system: system.join('\n\n') } : {}),
    messages,
    ...(tools.length ? { tools } : {}),
    ...(tool_choice ? { tool_choice } : {}),
  };
}

export function fromClaudeMessage(message: Anthropic.Message): StudioAiTurnResult {
  const refused = message.stop_reason === 'refusal';
  const output: StudioAiTurnResult['output'] = [];
  if (!refused) {
    for (const block of message.content) {
      if (block.type === 'text' && block.text) {
        const last = output.at(-1);
        if (last?.type === 'message') last.text += block.text;
        else output.push({ type: 'message', text: block.text });
      } else if (block.type === 'tool_use') {
        output.push({ type: 'tool_call', call_id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) });
      }
    }
  }
  const u = message.usage;
  const cached = u.cache_read_input_tokens ?? 0, written = u.cache_creation_input_tokens ?? 0;
  return {
    id: message.id,
    model: message.model,
    status: refused ? 'refused' : message.stop_reason === 'max_tokens' ? 'incomplete' : 'completed',
    output: output.slice(0, 64),
    // Anthropic counts cached and cache-written input separately; Studio's usage counts them inside input_tokens.
    usage: { input_tokens: u.input_tokens + cached + written, output_tokens: u.output_tokens, cached_input_tokens: cached, cache_write_tokens: written },
  };
}

/** A turn that failed at the provider, classified so the API can answer without knowing the provider's errors. */
export class StudioAiFailure extends Error {
  constructor(public kind: 'rate_limited' | 'rejected' | 'unavailable', message: string) { super(message); }
}

export function claudeStudioAi(client: Anthropic): StudioAiRelay {
  return async (request, signal) => {
    try {
      return fromClaudeMessage(await client.messages.create(toClaudeRequest(request), { signal, timeout: 90_000 }));
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new StudioAiFailure('rate_limited', e.message);
      if (e instanceof Anthropic.BadRequestError) throw new StudioAiFailure('rejected', e.message);
      throw new StudioAiFailure('unavailable', e instanceof Error ? e.message : String(e));
    }
  };
}
