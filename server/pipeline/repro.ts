// server/pipeline/repro.ts
import { callModelJSON } from "../nebius/client";
import type { ExtractedError } from "./extract";
import type { Hypothesis } from "./rank";

export interface Reproduction {
  language: string;
  code: string;
  explanation: string; // one or two sentences on how running this confirms the hypothesis
}

const SYSTEM_PROMPT = `You are an expert software engineer. Given metadata about an error and a
specific hypothesis about its root cause (including a suggested reproduction approach), write a
minimal, runnable code snippet that reproduces this exact bug so a developer can quickly confirm
or rule out the diagnosis.

Rules:
- The snippet should be as small as possible while still actually triggering the described failure.
- Prefer snippets a developer can run immediately (e.g. a single script, or exact shell/pip commands
  plus a one-line import) over anything requiring a full project setup.
- If the hypothesis requires a specific dependency version, say so explicitly in the code as a
  comment or install command — do not silently assume a version.
- Do not fabricate library APIs that don't exist. If you are not certain of exact syntax, prefer a
  simpler snippet you are confident is correct over a more elaborate but speculative one.
- If the hypothesis genuinely cannot be reproduced in a short snippet (e.g. it depends on internal
  state you have no information about), say so honestly in "explanation" and give your best partial
  attempt in "code" rather than fabricating a misleading one.

Return a JSON object with exactly these keys: language, code, explanation.`;

export async function generateRepro(
  error: ExtractedError,
  hypothesis: Hypothesis,
): Promise<Reproduction> {
  // Don't hand a failed/empty hypothesis to the model and let it fabricate
  // specifics to compensate — that's exactly the hallucination risk this
  // whole project is designed to avoid. If rank.ts couldn't produce a real
  // hypothesis, repro.ts should say so, not invent one.
  if (hypothesis.sources.length === 0 || !hypothesis.explanation.trim()) {
    return {
      language: error.language,
      code: "// No reproduction generated — the ranking step did not produce a hypothesis backed by real evidence.",
      explanation:
        "Skipped repro generation because the provided hypothesis had no supporting sources. Generating a snippet here would mean inventing an unsupported cause.",
    };
  }

  const userPrompt = `ERROR METADATA:
${JSON.stringify(error, null, 2)}

TOP HYPOTHESIS:
Summary: ${hypothesis.summary}
Explanation: ${hypothesis.explanation}
Suggested repro approach: ${hypothesis.suggested_repro_hint}`;

  const result = await callModelJSON<Partial<Reproduction>>(
    "repro",
    SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.2 }, // maxTokens defaults to 3000 in callModelJSON
  );

  return {
    language: result.language ?? error.language,
    code:
      result.code ??
      "// Could not generate a reproduction for this hypothesis.",
    explanation: result.explanation ?? "",
  };
}
