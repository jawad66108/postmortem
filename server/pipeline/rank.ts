// server/pipeline/rank.ts
import { callModelJSON } from "../nebius/client";
import type { ExtractedError } from "./extract";
import type { Evidence } from "./retrieve";

export interface Hypothesis {
  rank: number; // 1 = most plausible
  summary: string; // one-sentence statement of the hypothesis
  explanation: string; // why this is plausible, referencing the evidence
  confidence: "high" | "medium" | "low";
  sources: string[]; // URLs from the evidence set that support this hypothesis
  suggested_repro_hint: string; // short hint repro.ts can build a minimal reproduction from
}

const SYSTEM_PROMPT = `/think

You are an expert software engineer investigating the root cause of a bug. You will be given
structured metadata about an error (language, framework, error class, message, implicated
symbols and packages) and a set of evidence gathered from live web search — GitHub issues,
changelogs, and discussions — each with a URL.

Your job: reason step by step about which recent dependency change, known issue, or breaking
change most plausibly caused this error, using ONLY the provided evidence as your factual basis.
Do not invent facts not supported by the evidence.

Produce 1-4 ranked hypotheses, most plausible first. For each hypothesis:
- Give a one-sentence summary of the proposed cause.
- Explain your reasoning, explicitly connecting it to specific evidence.
- Rate your confidence as "high", "medium", or "low" based on how directly the evidence supports it.
- List the exact URLs (from the evidence provided) that back this specific hypothesis. Only cite
  URLs that were actually given to you — never invent a URL.
- Give a short hint describing what a minimal reproduction of this bug would look like (this will
  be handed to another step that writes the actual repro code, so keep it concise and concrete).

If the evidence is weak, contradictory, or insufficient to form a confident hypothesis, say so
honestly in a single low-confidence hypothesis rather than fabricating certainty.

After your reasoning, output the final answer as a JSON object with exactly one key, "hypotheses",
whose value is an array of hypothesis objects with these keys: rank, summary, explanation,
confidence, sources, suggested_repro_hint.`;

function formatEvidenceForPrompt(evidence: Evidence[]): string {
  return evidence
    .map((e, i) => `[${i + 1}] ${e.title}\nURL: ${e.url}\n${e.content}\n`)
    .join("\n---\n");
}

export async function rankHypotheses(
  error: ExtractedError,
  evidence: Evidence[],
): Promise<Hypothesis[]> {
  if (evidence.length === 0) {
    // Nothing to reason over — return a single honest low-confidence hypothesis
    // rather than calling the model to speculate with no grounding at all.
    return [
      {
        rank: 1,
        summary: "No relevant evidence was found for this error.",
        explanation:
          "Tavily search did not return any sources plausibly related to this error's package, symbol, or error class. This may indicate the issue is very recent, very obscure, or specific to a private/internal codebase.",
        confidence: "low",
        sources: [],
        suggested_repro_hint:
          "Insufficient evidence to suggest a targeted reproduction.",
      },
    ];
  }

  const userPrompt = `ERROR METADATA:
${JSON.stringify(error, null, 2)}

EVIDENCE (${evidence.length} sources):
${formatEvidenceForPrompt(evidence)}`;

  const validUrls = new Set(evidence.map((e) => e.url));
  const MAX_ATTEMPTS = 3;
  let hypotheses: Hypothesis[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await callModelJSON<{ hypotheses?: Partial<Hypothesis>[] }>(
      "rank",
      SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3, maxTokens: 5000 }, // large evidence sets + /think reasoning both eat into this — this model needs the most headroom of all three
    );

    // TEMP DEBUG — remove once rank.ts is confirmed reliable
    console.log(
      `[rank] Attempt ${attempt} parsed result:`,
      JSON.stringify(result, null, 2),
    );

    hypotheses = (result.hypotheses ?? [])
      .map((h, i) => ({
        rank: h.rank ?? i + 1,
        summary: h.summary ?? "",
        explanation: h.explanation ?? "",
        confidence: (h.confidence as Hypothesis["confidence"]) ?? "low",
        // Guard against the model citing a URL it wasn't actually given —
        // only keep sources that came from our real evidence set.
        sources: Array.isArray(h.sources)
          ? h.sources.filter((url) => validUrls.has(url))
          : [],
        suggested_repro_hint: h.suggested_repro_hint ?? "",
      }))
      // Drop any hypothesis with no real content — a summary with no
      // explanation is a sign the model's output got truncated, not a
      // genuine (if low-confidence) hypothesis worth keeping.
      .filter(
        (h) => h.summary.trim().length > 0 && h.explanation.trim().length > 0,
      );

    if (hypotheses.length > 0) break;

    if (attempt < MAX_ATTEMPTS) {
      console.warn(
        `[rank] Attempt ${attempt} produced no usable hypotheses, retrying...`,
      );
    } else {
      console.warn(
        `[rank] All ${MAX_ATTEMPTS} attempts produced no usable hypotheses.`,
      );
    }
  }

  return hypotheses.length > 0
    ? hypotheses
    : [
        {
          rank: 1,
          summary: "Ranking failed after multiple attempts.",
          explanation:
            "The ranking model did not return a usable hypothesis after retries. This reflects a genuine model reliability issue rather than a lack of evidence — do not treat this as a diagnosis.",
          confidence: "low",
          sources: [],
          suggested_repro_hint: "",
        },
      ];
}
