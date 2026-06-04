import { supabase as realSupabase } from './db.ts';
import { embedBatch as realEmbedBatch } from './embed.ts';
import Anthropic from '@anthropic-ai/sdk';

// ── Real implementations ─────────────────────────────────────────────────────

function realGetSupabase() {
  return realSupabase;
}

async function realEmbed(text: string, _type?: 'document' | 'query'): Promise<number[]> {
  const results = await realEmbedBatch([text]);
  return results[0];
}

async function realEmbedBatchFn(
  texts: string[],
  _type?: 'document' | 'query'
): Promise<number[][]> {
  return realEmbedBatch(texts);
}

const _anthropic = new Anthropic();

async function realComplete(
  model: string,
  prompt: { system?: string; user: string },
  opts?: { max_tokens?: number }
): Promise<string> {
  const msgs: Anthropic.MessageParam[] = [{ role: 'user', content: prompt.user }];
  const res = await _anthropic.messages.create({
    model,
    max_tokens: opts?.max_tokens ?? 1024,
    ...(prompt.system ? { system: prompt.system } : {}),
    messages: msgs,
  });
  return res.content[0].type === 'text' ? res.content[0].text : '';
}

// ── Provider slots (swapped by installMocks in tests) ────────────────────────

let _getSupabase: typeof realGetSupabase = realGetSupabase;
let _embed: typeof realEmbed = realEmbed;
let _embedBatch: typeof realEmbedBatchFn = realEmbedBatchFn;
let _complete: typeof realComplete = realComplete;

// ── Public API ───────────────────────────────────────────────────────────────

export function getSupabase() {
  return _getSupabase();
}

export function embed(text: string, type?: 'document' | 'query'): Promise<number[]> {
  return _embed(text, type);
}

export function embedBatch(texts: string[], type?: 'document' | 'query'): Promise<number[][]> {
  return _embedBatch(texts, type);
}

export function complete(
  model: string,
  prompt: { system?: string; user: string },
  opts?: { max_tokens?: number }
): Promise<string> {
  return _complete(model, prompt, opts);
}

export interface ProviderMocks {
  getSupabase?: typeof realGetSupabase;
  embed?: typeof realEmbed;
  embedBatch?: typeof realEmbedBatchFn;
  complete?: typeof realComplete;
}

export function installMocks(mocks: ProviderMocks): void {
  if (mocks.getSupabase) _getSupabase = mocks.getSupabase;
  if (mocks.embed) _embed = mocks.embed;
  if (mocks.embedBatch) _embedBatch = mocks.embedBatch;
  if (mocks.complete) _complete = mocks.complete;
}

export function resetProviders(): void {
  _getSupabase = realGetSupabase;
  _embed = realEmbed;
  _embedBatch = realEmbedBatchFn;
  _complete = realComplete;
}
