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

  const result = await callModelJSON<Partial<ExtractedError>>(
    "extract",
    SYSTEM_PROMPT,
    rawTrace.trim(),
    { temperature: 0 }, // maxTokens defaults to 3000 in callModelJSON — this model reasons regardless of /no_think, so it needs the room
  );

  // Normalize in case the model omits a key or returns a wrong-shaped value —
  // downstream stages (retrieve.ts, rank.ts) should be able to rely on this shape.
  return {
    language: result.language ?? "unknown",
    framework: result.framework ?? null,
    error_class: result.error_class ?? "unknown",
    message: result.message ?? "",
    symbols: Array.isArray(result.symbols) ? result.symbols : [],
    packages: Array.isArray(result.packages) ? result.packages : [],
    versions:
      typeof result.versions === "object" && result.versions !== null
        ? result.versions
        : {},
  };
}
