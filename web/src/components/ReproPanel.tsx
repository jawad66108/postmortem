// web/src/components/ReproPanel.tsx
export interface Reproduction {
  language: string;
  code: string;
  explanation: string;
}

export default function ReproPanel({ repro }: { repro: Reproduction }) {
  return (
    <div className="exhibit-panel">
      <div className="exhibit-panel__header">
        Exhibit A — Minimal reproduction ({repro.language})
      </div>
      <pre className="exhibit-panel__code">
        <code>{repro.code}</code>
      </pre>
      <p className="exhibit-panel__explanation">{repro.explanation}</p>
    </div>
  );
}
