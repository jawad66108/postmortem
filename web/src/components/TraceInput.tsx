// web/src/components/TraceInput.tsx
import { useState, type FormEvent } from "react";

interface TraceInputProps {
  onSubmit: (trace: string) => void;
  isLoading: boolean;
  error: string | null;
}

export default function TraceInput({
  onSubmit,
  isLoading,
  error,
}: TraceInputProps) {
  const [trace, setTrace] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (trace.trim() && !isLoading) {
      onSubmit(trace.trim());
    }
  }

  return (
    <form className="intake" onSubmit={handleSubmit}>
      <div className="intake__header">
        <p className="intake__label">Case evidence / stack trace</p>
        <span className="intake__tag">Input 01</span>
      </div>
      <div className="intake__body">
        <textarea
          id="trace-input"
          value={trace}
          onChange={(e) => setTrace(e.target.value)}
          placeholder={`Traceback (most recent call last):\n  File "app.py", line 12, in <module>\n    ...`}
          disabled={isLoading}
          spellCheck={false}
          aria-label="Stack trace or error signature"
        />
        <div className="intake__footer">
          <span className="intake__meta">Plain text · UTF-8</span>
          <button
            className="intake__submit"
            type="submit"
            disabled={isLoading || !trace.trim()}
          >
            {isLoading ? "Investigating..." : "Open the case"}
          </button>
        </div>
        {error && <p className="intake__error">{error}</p>}
      </div>
    </form>
  );
}
