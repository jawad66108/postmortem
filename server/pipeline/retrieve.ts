// server/pipeline/retrieve.ts
import { tavily } from "@tavily/core";
import type { ExtractedError } from "./extract";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export interface Evidence {
  title: string;
  url: string;
  content: string; // Tavily's most-relevant snippet from the page
  score: number;
  query: string; // which query surfaced this — useful for debugging/demo transparency
}

/**
 * Builds a handful of targeted search queries from the extracted error.
 * The goal is queries a human debugging this would actually type — package
 * name + error class + "changelog"/"issue"/"breaking change" — not a raw
 * dump of the whole stack trace, which searches poorly.
 */
function buildQueries(
  error: ExtractedError,
): Array<{ query: string; exactMatch?: boolean }> {
  const queries: Array<{ query: string; exactMatch?: boolean }> = [];
  const primaryPackage = error.packages[0];
  const primarySymbol = error.symbols[0];

  if (primaryPackage) {
    // The specific symbol name is usually the single most distinctive,
    // searchable string in the whole trace — far more useful than the
    // generic error class, which mostly surfaces unrelated common errors
    // (e.g. plain "ModuleNotFoundError: No module named X" noise).
    if (primarySymbol) {
      queries.push({
        query: `"${primarySymbol}" ${primaryPackage}`,
        exactMatch: true,
      });
    }

    queries.push({
      query: `${primaryPackage} ${error.error_class} github issue`,
    });
    queries.push({
      query: `${primaryPackage} changelog breaking change ${error.error_class}`,
    });

    const version = error.versions[primaryPackage];
    if (version) {
      queries.push({ query: `${primaryPackage} ${version} release notes` });
    }
  } else {
    queries.push({
      query: `${error.language} ${error.error_class} ${error.message}`.trim(),
    });
  }

  return queries;
}

/**
 * Runs Tavily searches for the given extracted error and returns
 * deduplicated, score-sorted evidence with source URLs attached —
 * every hypothesis card downstream needs to be able to cite these.
 */
export async function retrieveEvidence(
  error: ExtractedError,
): Promise<Evidence[]> {
  const queries = buildQueries(error);

  const resultsPerQuery = await Promise.all(
    queries.map(async ({ query, exactMatch }) => {
      try {
        const response = await tvly.search(query, {
          searchDepth: "advanced",
          topic: "general",
          maxResults: 5,
          includeAnswer: false,
          includeRawContent: false,
          ...(exactMatch ? { exactMatch: true } : {}),
        });
        return response.results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          query,
        }));
      } catch (err) {
        console.error(
          `[retrieve] Tavily search failed for query "${query}":`,
          (err as Error).message,
        );
        return [];
      }
    }),
  );

  const flattened = resultsPerQuery.flat();

  // Dedupe by URL — the same GitHub issue or changelog page often surfaces
  // across multiple queries; keep the highest-scoring instance of each.
  const byUrl = new Map<string, Evidence>();
  for (const item of flattened) {
    const existing = byUrl.get(item.url);
    if (!existing || item.score > existing.score) {
      byUrl.set(item.url, item);
    }
  }

  return Array.from(byUrl.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // cap what gets passed to rank.ts — keeps the ranking prompt focused
}
