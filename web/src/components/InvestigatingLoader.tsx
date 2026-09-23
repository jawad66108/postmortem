// web/src/components/InvestigatingLoader.tsx
import { useEffect, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

const ORB_STATES = [
  "working",
  "connecting",
  "solving",
  "weaving",
  "searching",
] as const;
const ORB_INTERVAL_MS = 7500;
const ORB_SIZE = 64;

const LOADING_LINES = [
  "Fetching your data…",
  "Almost there…",
  "Putting the pieces together…",
  "Syncing the latest…",
  "Preparing your view…",
  "Crunching the numbers…",
  "Connecting the dots…",
  "Making sense of it all…",
  "Compiling the results…",
  "Refining the answer…",
  "Still working on it…",
  "Finishing touches…",
  "Nearly there…",
  "Here it comes…",
];
const LINE_INTERVAL_MS = 2500;

// A fresh mount each time isLoading flips true (see App.tsx, key={...}) means
// these intervals always restart cleanly at the beginning of a new investigation.
export default function InvestigatingLoader() {
  const [orbIndex, setOrbIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const orbTimer = setInterval(() => {
      setOrbIndex((i) => (i + 1) % ORB_STATES.length);
    }, ORB_INTERVAL_MS);
    return () => clearInterval(orbTimer);
  }, []);

  useEffect(() => {
    const lineTimer = setInterval(() => {
      setLineIndex((i) => (i + 1) % LOADING_LINES.length);
    }, LINE_INTERVAL_MS);
    return () => clearInterval(lineTimer);
  }, []);

  return (
    <div className="loader">
      <ThinkingOrb
        state={ORB_STATES[orbIndex]}
        size={ORB_SIZE}
        theme="light"
        speed={1.1}
      />
      {/* key remount retriggers the CSS fade-in on every line change */}
      <p key={lineIndex} className="loader__line">
        {LOADING_LINES[lineIndex]}
      </p>
    </div>
  );
}
