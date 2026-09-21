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
      <label className="intake__label" htmlFor="trace-input">
        Paste the stack trace or error signature
      </label>
      <textarea
        id="trace-input"
        value={trace}
        onChange={(e) => setTrace(e.target.value)}
        placeholder={`Traceback (most recent call last):\n  File "app.py", line 12, in <module>\n    ...`}
        disabled={isLoading}
        spellCheck={false}
      />
      <button
        className="intake__submit"
        type="submit"
        disabled={isLoading || !trace.trim()}
      >
        {isLoading ? "Investigating..." : "Open the case"}
      </button>
      {error && <p className="intake__error">{error}</p>}
    </form>
  );
}
