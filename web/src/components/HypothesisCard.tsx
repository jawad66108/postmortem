// web/src/components/HypothesisCard.tsx
export interface Hypothesis {
  rank: number;
  summary: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
  sources: string[];
  suggested_repro_hint: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function HypothesisCard({
  hypothesis,
}: {
  hypothesis: Hypothesis;
}) {
  const { rank, summary, explanation, confidence, sources } = hypothesis;

  return (
    <article className="hypothesis">
      <div className="hypothesis__header">
        <span className="hypothesis__rank">Hypothesis {rank}</span>
        <span className={`stamp stamp--${confidence}`}>
          {confidence} confidence
        </span>
      </div>
      <h3 className="hypothesis__summary">{summary}</h3>
      <p className="hypothesis__explanation">{explanation}</p>

      {sources.length > 0 && (
        <div className="exhibits">
          <p className="exhibits__label">Exhibits</p>
          <ol>
            {sources.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {hostnameOf(url)}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
