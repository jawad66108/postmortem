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
  const paddedRank = String(rank).padStart(2, "0");

  return (
    <article className="hypothesis">
      <div className="hypothesis__header">
        <span className="hypothesis__rank">Hypothesis {paddedRank}</span>
        <span className={`stamp stamp--${confidence}`}>
          {confidence} confidence
        </span>
      </div>
      <div className="hypothesis__body">
        <h3 className="hypothesis__summary">{summary}</h3>
        <p className="hypothesis__explanation">{explanation}</p>
      </div>

      {sources.length > 0 && (
        <div className="exhibits">
          <p className="exhibits__label">Evidence exhibits</p>
          <ol>
            {sources.map((url, i) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <span className="exhibits__num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{hostnameOf(url)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
