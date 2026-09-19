// server/pipeline/extract.ts
import { callModelJSON } from "../nebius/client";

export interface ExtractedError {
  language: string; // e.g. "python", "javascript", "java"
  framework: string | null; // e.g. "django", "express", "spring" — null if unclear
  error_class: string; // e.g. "TypeError", "ModuleNotFoundError"
  message: string; // the core error message, cleaned up
  symbols: string[]; // function/method/class names implicated in the trace
  packages: string[]; // dependency/package names mentioned or implied
  versions: Record<string, string>; // package -> version, wherever a version is visible in the trace
}

const SYSTEM_PROMPT = `/no_think

You are an expert at reading stack traces and error logs across all major
programming languages and frameworks. Given a raw stack trace or error message, extract
structured metadata about it.

Rules:
- If a field can't be determined, use null (for strings) or an empty array/object (for lists/maps).
- "symbols" should list the specific function, method, or class names that appear in the trace's
  call stack, most relevant first.
- "packages" should list third-party dependency names implicated by the trace (import paths,
  node_modules paths, site-packages paths, etc) — not the user's own application code.
- "versions" should only include a package/version pair if a version number is actually visible
  somewhere in the input (e.g. in a path like node_modules/foo/2.3.1, or a pip freeze line). Do not
  guess versions that aren't shown.
- Do not invent information that isn't inferable from the input.

Return a JSON object with exactly these keys: language, framework, error_class, message, symbols,
packages, versions.`;

export async function extractFromTrace(
  rawTrace: string,
): Promise<ExtractedError> {
  if (!rawTrace || !rawTrace.trim()) {
    throw new Error("extractFromTrace: received empty input");
  }

  const MAX_ATTEMPTS = 3;
  let last: Partial<ExtractedError> = {};

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await callModelJSON<Partial<ExtractedError>>(
      "extract",
      SYSTEM_PROMPT,
      rawTrace.trim(),
      { temperature: 0 }, // maxTokens defaults to 3000 in callModelJSON — this model reasons regardless of /no_think, so it needs the room
    );

    last = result;

    // This model is a MoE architecture and isn't perfectly deterministic even
    // at temperature 0 — occasionally it comes back with everything empty on
    // an otherwise-parseable input. Treat that as a failed attempt and retry
    // rather than trusting it, since a retry costs a fraction of a cent.
    const looksEmpty =
      (!result.language || result.language.toLowerCase() === "unknown") &&
      (!result.error_class || result.error_class.toLowerCase() === "unknown") &&
      (!result.packages || result.packages.length === 0);

    if (!looksEmpty) break;

    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[extract] Attempt ${attempt} came back empty, retrying...`);
    } else {
      console.warn(
        `[extract] All ${MAX_ATTEMPTS} attempts came back empty for this input.`,
      );
    }
  }

  // Normalize in case the model omits a key or returns a wrong-shaped value —
  // downstream stages (retrieve.ts, rank.ts) should be able to rely on this shape.
  return {
    language: last.language ?? "unknown",
    framework: last.framework ?? null,
    error_class: last.error_class ?? "unknown",
    message: last.message ?? "",
    symbols: Array.isArray(last.symbols) ? last.symbols : [],
    packages: Array.isArray(last.packages) ? last.packages : [],
    versions:
      typeof last.versions === "object" && last.versions !== null
        ? last.versions
        : {},
  };
}
