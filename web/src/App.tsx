// web/src/App.tsx
import { useState } from "react";
import "./postmortem.css";
import TraceInput from "./components/TraceInput";
import HypothesisCard, { type Hypothesis } from "./components/HypothesisCard";
import ReproPanel, { type Reproduction } from "./components/ReproPanel";

interface ExtractedError {
  language: string;
  framework: string | null;
  error_class: string;
  message: string;
  symbols: string[];
  packages: string[];
  versions: Record<string, string>;
}

interface DiagnoseResponse {
  extracted: ExtractedError;
  evidence: unknown[];
  hypotheses: Hypothesis[];
  repro: Reproduction | null;
}

// Point this at your deployed backend URL before recording the demo video —
// Vite dev defaults to same-origin, which won't work once frontend and
// backend are on different hosts.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export default function App() {
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(trace: string) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.detail ?? data.error ?? `Request failed (${res.status})`,
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        (err as Error).message ||
          "Something went wrong reaching the diagnosis server.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="case-file">
      <div className="case-file__kicker">Root-cause investigation</div>
      <h1 className="case-file__title">Postmortem</h1>
      <p className="case-file__subtitle">
        Paste a stack trace. It searches live issue trackers, changelogs, and
        advisories to find what actually changed — then ranks the most plausible
        cause with sources attached.
      </p>

      <TraceInput onSubmit={handleSubmit} isLoading={isLoading} error={error} />

      {(isLoading || result) && (
        <div className="status-divider">
          <span className="status-divider__line" />
          <span className="status-divider__label">
            <span
              className={`status-divider__dot ${isLoading ? "status-divider__dot--active" : ""}`}
            />
            {isLoading
              ? "Cross-referencing repositories and advisories..."
              : `Investigation complete · ${result!.hypotheses.length} hypothes${result!.hypotheses.length === 1 ? "is" : "es"}`}
          </span>
          <span className="status-divider__line" />
        </div>
      )}

      {result && (
        <>
          {result.hypotheses.map((h) => (
            <HypothesisCard key={h.rank} hypothesis={h} />
          ))}
          {result.repro && <ReproPanel repro={result.repro} />}
        </>
      )}
    </div>
  );
}
