// server/nebius/client.ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

// One model per pipeline stage — confirmed Public-endpoint IDs from the catalog.
export const MODELS = {
  extract: "nvidia/Nemotron-3_5-Lightning", // extract.ts — cheap/fast classification
  repro: "nvidia/nemotron-3-super-120b-a12b", // repro.ts — mid-tier reproduction snippet
  rank: "nvidia/Nemotron-3-Ultra-550b-a55b", // rank.ts — largest, does the actual judgment call
} as const;

export type PipelineStage = keyof typeof MODELS;

interface CallOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Calls a Token Factory model and returns plain text, regardless of
 * whether this particular Nemotron model put its answer in
 * `message.content` or `message.reasoning_content`. Reasoning models
 * on this platform sometimes leave `content` empty and put the real
 * answer in `reasoning_content` instead — this normalizes that so the
 * rest of the pipeline never has to think about it.
 */
export async function callModel(
  stage: PipelineStage,
  systemPrompt: string,
  userPrompt: string,
  opts: CallOptions = {},
): Promise<string> {
  const model = MODELS[stage];

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2000,
  });

  const message = completion.choices[0]?.message as
    | ((typeof completion.choices)[0]["message"] & {
        reasoning_content?: string;
      })
    | undefined;

  if (!message) {
    throw new Error(`[${stage}] No message returned from ${model}`);
  }

  const text = message.content?.trim() || message.reasoning_content?.trim();

  if (!text) {
    // Log the raw payload once so you can see exactly what came back —
    // this is the case to watch for in your first real run against
    // each of the three models.
    console.error(
      `[${stage}] Empty content AND reasoning_content:`,
      JSON.stringify(message),
    );
    throw new Error(`[${stage}] Model ${model} returned no usable text`);
  }

  return text;
}

/**
 * Scans backward from the end of `text` and returns the last
 * *balanced* {...} or [...] block. Unlike a greedy first-to-last regex,
 * this can't be fooled by a stray "{}" or "[]" mentioned earlier in a
 * reasoning model's chain-of-thought — it always resolves to the final
 * complete JSON structure in the text, which is what the model actually
 * meant as its answer.
 */
function extractLastJSONBlock(text: string): string | null {
  for (let end = text.length - 1; end >= 0; end--) {
    const closeChar = text[end];
    if (closeChar !== "}" && closeChar !== "]") continue;
    const openChar = closeChar === "}" ? "{" : "[";

    let depth = 0;
    for (let start = end; start >= 0; start--) {
      if (text[start] === closeChar) depth++;
      else if (text[start] === openChar) depth--;
      if (depth === 0) {
        const candidate = text.slice(start, end + 1);
        try {
          JSON.parse(candidate);
          return candidate; // first balanced+valid block found scanning from the end wins
        } catch {
          break; // this closing bracket didn't yield valid JSON — keep scanning further back
        }
      }
    }
  }
  return null;
}

/**
 * Convenience wrapper for stages that expect strict JSON back
 * (extract.ts, rank.ts). These Nemotron models reason before answering
 * regardless of formatting instructions, so this doesn't try to
 * suppress that — it gives the call a generous token budget and pulls
 * out the actual final JSON object however much preamble came before it.
 */
export async function callModelJSON<T = unknown>(
  stage: PipelineStage,
  systemPrompt: string,
  userPrompt: string,
  opts: CallOptions = {},
): Promise<T> {
  const raw = await callModel(
    stage,
    `${systemPrompt}\n\nWhen you have finished reasoning, output the final answer as a single JSON object on its own, as the very last thing in your response.`,
    userPrompt,
    { maxTokens: 3000, ...opts }, // reasoning models need real headroom to finish their thought before answering
  );

  const jsonText = extractLastJSONBlock(raw);

  // TEMP DEBUG — remove once rank.ts / repro.ts are confirmed reliable
  console.log(
    `[${stage}] raw response length: ${raw.length} chars, last 300 chars:\n...${raw.slice(-300)}`,
  );

  if (!jsonText) {
    console.error(`[${stage}] No valid JSON block found in model output:`, raw);
    throw new Error(
      `[${stage}] Could not find a valid JSON object in the response`,
    );
  }

  try {
    return JSON.parse(jsonText) as T;
  } catch (err) {
    console.error(`[${stage}] Failed to parse JSON from model output:`, raw);
    throw new Error(
      `[${stage}] Could not parse JSON response: ${(err as Error).message}`,
    );
  }
}
